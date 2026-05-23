/**
 * Google Generative AI (Gemini) protocol — streams completions from Google's API.
 */

import type { ProtocolModule, ProtocolStreamChunk, ProtocolStreamOptions } from './index.js'

export const GoogleGenerativeAIProtocol: ProtocolModule = {
  protocol: 'google-generative-ai',
  displayName: 'Google Gemini',

  async *stream(options: ProtocolStreamOptions): AsyncGenerator<ProtocolStreamChunk> {
    const { model, messages, maxTokens, temperature, tools, baseUrl, apiKey, signal } = options

    const url = `${baseUrl.replace(/\/$/, '')}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`

    const contents = messages
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: typeof m.content === 'string'
          ? [{ text: m.content }]
          : m.content?.filter((b: any) => b.type === 'text').map((b: any) => ({ text: b.text })) ?? [],
      }))

    const systemInstruction = messages.find((m: any) => m.role === 'system')
    const body: any = { contents }

    if (systemInstruction) {
      const text = typeof systemInstruction.content === 'string'
        ? systemInstruction.content
        : systemInstruction.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
      body.systemInstruction = { parts: [{ text }] }
    }

    if (maxTokens || temperature !== undefined) {
      body.generationConfig = {}
      if (maxTokens) body.generationConfig.maxOutputTokens = maxTokens
      if (temperature !== undefined) body.generationConfig.temperature = temperature
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const text = await response.text()
      yield { type: 'error', error: `Gemini error ${response.status}: ${text}` }
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
          if (!trimmed.startsWith('data: ')) continue
          try {
            const data = JSON.parse(trimmed.slice(6))
            const parts = data.candidates?.[0]?.content?.parts ?? []
            for (const part of parts) {
              if (part.text) yield { type: 'text', content: part.text }
              if (part.functionCall) {
                yield {
                  type: 'tool_use',
                  toolName: part.functionCall.name,
                  toolInput: part.functionCall.args ?? {},
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
