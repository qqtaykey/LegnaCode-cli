/**
 * OpenAI Chat Completions protocol — streams from OpenAI-compatible APIs.
 * Works with: OpenAI, Groq, Together, Fireworks, Mistral, OpenRouter, xAI, etc.
 */

import type { ProtocolModule, ProtocolStreamChunk, ProtocolStreamOptions } from './index.js'

export const OpenAICompletionsProtocol: ProtocolModule = {
  protocol: 'openai-completions',
  displayName: 'OpenAI Chat Completions',

  async *stream(options: ProtocolStreamOptions): AsyncGenerator<ProtocolStreamChunk> {
    const { model, messages, maxTokens, temperature, tools, baseUrl, apiKey, signal, headers: extraHeaders } = options

    const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`

    const body: any = {
      model,
      messages: messages.map(formatMessage),
      stream: true,
    }
    if (maxTokens) body.max_tokens = maxTokens
    if (temperature !== undefined) body.temperature = temperature
    if (tools && tools.length > 0) {
      body.tools = tools.map((t: any) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.input_schema },
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
      yield { type: 'error', error: `API error ${response.status}: ${text}` }
      return
    }

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

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const data = JSON.parse(trimmed.slice(6))
            const delta = data.choices?.[0]?.delta
            if (!delta) continue

            if (delta.content) {
              yield { type: 'text', content: delta.content }
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.function?.name) {
                  yield {
                    type: 'tool_use',
                    toolName: tc.function.name,
                    toolInput: tc.function.arguments ? JSON.parse(tc.function.arguments) : {},
                    toolId: tc.id,
                  }
                }
              }
            }
          } catch {}
        }
      }
    } finally {
      reader.releaseLock()
    }

    yield { type: 'done' }
  },
}

function formatMessage(msg: any): any {
  if (typeof msg.content === 'string') return msg
  const text = msg.content
    ?.filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')
  return { role: msg.role, content: text || '' }
}
