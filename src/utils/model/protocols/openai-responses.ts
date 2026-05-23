/**
 * OpenAI Responses API protocol — streams from OpenAI's newer Responses API.
 * Different from Chat Completions: uses /v1/responses, event-based streaming,
 * supports built-in tools (web_search, code_interpreter, file_search).
 */

import type { ProtocolModule, ProtocolStreamChunk, ProtocolStreamOptions } from './index.js'

export const OpenAIResponsesProtocol: ProtocolModule = {
  protocol: 'openai-responses',
  displayName: 'OpenAI Responses',

  async *stream(options: ProtocolStreamOptions): AsyncGenerator<ProtocolStreamChunk> {
    const { model, messages, maxTokens, temperature, tools, systemPrompt, baseUrl, apiKey, signal, headers: extraHeaders } = options

    const url = `${baseUrl.replace(/\/$/, '')}/v1/responses`

    // Responses API uses "input" instead of "messages"
    const input: any[] = []

    // System prompt as developer message
    const sysContent = systemPrompt || messages.find((m: any) => m.role === 'system')?.content
    if (sysContent) {
      const text = typeof sysContent === 'string' ? sysContent
        : sysContent?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
      input.push({ role: 'developer', content: text })
    }

    // Convert messages
    for (const msg of messages) {
      if (msg.role === 'system') continue
      if (typeof msg.content === 'string') {
        input.push({ role: msg.role, content: msg.content })
      } else {
        const text = msg.content
          ?.filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('\n')
        input.push({ role: msg.role, content: text || '' })
      }
    }

    const body: any = {
      model,
      input,
      stream: true,
    }
    if (maxTokens) body.max_output_tokens = maxTokens
    if (temperature !== undefined) body.temperature = temperature
    if (tools && tools.length > 0) {
      body.tools = tools.map((t: any) => ({
        type: 'function',
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      }))
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
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
      yield { type: 'error', error: `OpenAI Responses error ${response.status}: ${text}` }
      return
    }

    yield* parseResponsesStream(response)
  },
}

async function* parseResponsesStream(response: Response): AsyncGenerator<ProtocolStreamChunk> {
  const reader = response.body?.getReader()
  if (!reader) { yield { type: 'error', error: 'No response body' }; return }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      let currentEvent = ''
      for (const line of lines) {
        const trimmed = line.trim()

        // SSE event type
        if (trimmed.startsWith('event: ')) {
          currentEvent = trimmed.slice(7)
          continue
        }

        if (!trimmed.startsWith('data: ')) continue
        const jsonStr = trimmed.slice(6)
        if (!jsonStr || jsonStr === '[DONE]') continue

        try {
          const data = JSON.parse(jsonStr)

          switch (currentEvent) {
            case 'response.output_text.delta':
              if (data.delta) yield { type: 'text', content: data.delta }
              break

            case 'response.function_call_arguments.delta':
              // Tool call argument streaming — accumulate
              break

            case 'response.output_item.added':
              if (data.item?.type === 'function_call') {
                yield {
                  type: 'tool_use',
                  toolName: data.item.name,
                  toolInput: {},
                  toolId: data.item.call_id,
                }
              }
              break

            case 'response.output_item.done':
              if (data.item?.type === 'function_call' && data.item.arguments) {
                try {
                  yield {
                    type: 'tool_use',
                    toolName: data.item.name,
                    toolInput: JSON.parse(data.item.arguments),
                    toolId: data.item.call_id,
                  }
                } catch {}
              }
              break

            case 'response.completed':
            case 'response.done':
              break

            default:
              // Handle content_part delta for older format
              if (data.delta?.text) {
                yield { type: 'text', content: data.delta.text }
              }
              break
          }
        } catch {}

        currentEvent = ''
      }
    }
  } finally {
    reader.releaseLock()
  }

  yield { type: 'done' }
}
