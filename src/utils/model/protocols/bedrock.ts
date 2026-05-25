/**
 * AWS Bedrock Converse protocol — streams from Amazon Bedrock.
 * Uses SigV4 signing and Bedrock's converse-stream API format.
 */

import type { ProtocolModule, ProtocolStreamChunk, ProtocolStreamOptions } from './index.js'

export const BedrockConverseProtocol: ProtocolModule = {
  protocol: 'bedrock-converse',
  displayName: 'AWS Bedrock Converse',

  async *stream(options: ProtocolStreamOptions): AsyncGenerator<ProtocolStreamChunk> {
    const { model, messages, maxTokens, temperature, tools, systemPrompt, baseUrl, signal, headers: extraHeaders } = options

    // Bedrock URL: {baseUrl}/model/{modelId}/converse-stream
    const url = `${baseUrl.replace(/\/$/, '')}/model/${encodeURIComponent(model)}/converse-stream`

    const bedrockMessages = messages
      .filter((m: any) => m.role !== 'system')
      .map(formatBedrockMessage)

    const body: any = { messages: bedrockMessages }

    // System prompt
    const sysContent = systemPrompt || messages.find((m: any) => m.role === 'system')?.content
    if (sysContent) {
      const text = typeof sysContent === 'string'
        ? sysContent
        : sysContent?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
      body.system = [{ text }]
    }

    // Inference config
    const inferenceConfig: any = {}
    if (maxTokens) inferenceConfig.maxTokens = maxTokens
    if (temperature !== undefined) inferenceConfig.temperature = temperature
    if (Object.keys(inferenceConfig).length > 0) body.inferenceConfig = inferenceConfig

    // Tools
    if (tools && tools.length > 0) {
      body.toolConfig = {
        tools: tools.map((t: any) => ({
          toolSpec: { name: t.name, description: t.description, inputSchema: { json: t.input_schema } },
        })),
      }
    }

    // Headers — AWS SigV4 should be pre-computed and passed via extraHeaders
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.amazon.eventstream',
      ...extraHeaders,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const text = await response.text()
      yield { type: 'error', error: `Bedrock error ${response.status}: ${text}` }
      return
    }

    // Bedrock uses event-stream format (newline-delimited JSON events)
    yield* parseBedrockEventStream(response)
  },
}

async function* parseBedrockEventStream(response: Response): AsyncGenerator<ProtocolStreamChunk> {
  const reader = response.body?.getReader()
  if (!reader) { yield { type: 'error', error: 'No response body' }; return }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Bedrock event stream: each event is a JSON object on its own line
      // or wrapped in :event-type headers similar to SSE
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        // Handle SSE-style format
        let jsonStr = trimmed
        if (trimmed.startsWith('data: ')) jsonStr = trimmed.slice(6)
        if (jsonStr === '[DONE]') continue

        try {
          const event = JSON.parse(jsonStr)

          // contentBlockDelta — text content
          if (event.contentBlockDelta?.delta?.text) {
            yield { type: 'text', content: event.contentBlockDelta.delta.text }
          }

          // contentBlockDelta — tool use
          if (event.contentBlockDelta?.delta?.toolUse) {
            const tu = event.contentBlockDelta.delta.toolUse
            if (tu.input) {
              yield { type: 'text', content: tu.input } // Accumulate tool input as text
            }
          }

          // contentBlockStart — tool use start
          if (event.contentBlockStart?.start?.toolUse) {
            const tu = event.contentBlockStart.start.toolUse
            yield {
              type: 'tool_use',
              toolName: tu.name,
              toolInput: {},
              toolId: tu.toolUseId,
            }
          }

          // messageStop
          if (event.messageStop) {
            // Stream complete
          }

          // metadata (usage, etc.) — skip
        } catch {
          // Not JSON — skip
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  yield { type: 'done' }
}

function formatBedrockMessage(msg: any): any {
  const role = msg.role === 'assistant' ? 'assistant' : 'user'
  if (typeof msg.content === 'string') {
    return { role, content: [{ text: msg.content }] }
  }
  const content = (msg.content ?? []).map((block: any) => {
    if (block.type === 'text') return { text: block.text }
    if (block.type === 'tool_use') return { toolUse: { toolUseId: block.id, name: block.name, input: block.input } }
    if (block.type === 'tool_result') return { toolResult: { toolUseId: block.tool_use_id, content: [{ text: typeof block.content === 'string' ? block.content : JSON.stringify(block.content) }] } }
    return { text: JSON.stringify(block) }
  })
  return { role, content }
}
