/**
 * API Protocol Registry — defines supported API wire formats.
 * Each protocol implements a stream() function for streaming completions.
 *
 * Supported protocols:
 * - anthropic-messages: Anthropic Messages API (native)
 * - openai-completions: OpenAI Chat Completions API
 * - openai-responses: OpenAI Responses API
 * - google-generative-ai: Google Gemini API
 * - ollama-chat: Ollama local models
 * - bedrock-converse: AWS Bedrock Converse API
 * - azure-openai: Azure OpenAI
 */

export type ApiProtocol =
  | 'anthropic-messages'
  | 'openai-completions'
  | 'openai-responses'
  | 'google-generative-ai'
  | 'ollama-chat'
  | 'bedrock-converse'
  | 'azure-openai'
  | 'google-vertex'
  | 'cursor-agent'

export interface ProtocolStreamOptions {
  model: string
  messages: any[]
  maxTokens?: number
  temperature?: number
  tools?: any[]
  systemPrompt?: string
  signal?: AbortSignal
  baseUrl: string
  apiKey?: string
  headers?: Record<string, string>
}

export interface ProtocolStreamChunk {
  type: 'text' | 'tool_use' | 'thinking' | 'error' | 'done'
  content?: string
  toolName?: string
  toolInput?: any
  toolId?: string
  error?: string
}

export interface ProtocolModule {
  protocol: ApiProtocol
  displayName: string
  stream(options: ProtocolStreamOptions): AsyncGenerator<ProtocolStreamChunk>
}

// Lazy-loaded protocol modules
const _protocols = new Map<ApiProtocol, ProtocolModule>()

/**
 * Register a protocol module.
 */
export function registerProtocol(module: ProtocolModule): void {
  _protocols.set(module.protocol, module)
}

/**
 * Get a registered protocol module, loading it lazily if needed.
 */
export function getProtocol(protocol: ApiProtocol): ProtocolModule | null {
  return _protocols.get(protocol) ?? null
}

/**
 * Get all registered protocol names.
 */
export function getRegisteredProtocols(): ApiProtocol[] {
  return [..._protocols.keys()]
}

/**
 * Infer protocol from a base URL.
 */
export function inferProtocolFromUrl(baseUrl: string): ApiProtocol {
  const url = baseUrl.toLowerCase()
  if (url.includes('api.anthropic.com') || url.includes('/anthropic')) return 'anthropic-messages'
  if (url.includes('api.openai.com') || url.includes('/v1/chat')) return 'openai-completions'
  if (url.includes('generativelanguage.googleapis.com')) return 'google-generative-ai'
  if (url.includes('localhost:11434') || url.includes('ollama')) return 'ollama-chat'
  if (url.includes('bedrock')) return 'bedrock-converse'
  if (url.includes('openai.azure.com')) return 'azure-openai'
  if (url.includes('aiplatform.googleapis.com')) return 'google-vertex'
  // Default to OpenAI-compatible
  return 'openai-completions'
}

/**
 * Initialize all built-in protocols (lazy-loaded on first use).
 */
export async function ensureProtocolsRegistered(): Promise<void> {
  if (_protocols.size > 0) return

  const { OpenAICompletionsProtocol } = await import('./openai.js')
  const { GoogleGenerativeAIProtocol } = await import('./google.js')
  const { OllamaChatProtocol } = await import('./ollama.js')
  const { AzureOpenAIProtocol } = await import('./azure-openai.js')
  const { BedrockConverseProtocol } = await import('./bedrock.js')
  const { GoogleVertexProtocol } = await import('./vertex.js')
  const { OpenAIResponsesProtocol } = await import('./openai-responses.js')

  registerProtocol(OpenAICompletionsProtocol)
  registerProtocol(GoogleGenerativeAIProtocol)
  registerProtocol(OllamaChatProtocol)
  registerProtocol(AzureOpenAIProtocol)
  registerProtocol(BedrockConverseProtocol)
  registerProtocol(GoogleVertexProtocol)
  registerProtocol(OpenAIResponsesProtocol)
}
