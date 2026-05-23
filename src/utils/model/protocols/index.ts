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
