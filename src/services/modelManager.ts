/**
 * Model Manager — orchestrates model discovery, caching, and resolution.
 * Sits above the adapter layer, providing dynamic model lists from providers.
 */

import {
  getCachedModels,
  setCachedModels,
  type CachedModelEntry,
  type ModelRefreshStrategy,
} from '../modelCache/index.js'
import { type ApiProtocol, inferProtocolFromUrl } from '../../utils/model/protocols/index.js'
import { logForDebugging } from '../../utils/debug.js'

export interface ProviderConfig {
  id: string
  displayName: string
  protocol: ApiProtocol
  baseUrl: string
  apiKeyEnvVar?: string
  modelsEndpoint?: string
  defaultModels?: CachedModelEntry[]
}

export interface ResolvedModel {
  id: string
  name: string
  provider: ProviderConfig
  contextWindow?: number
  maxOutputTokens?: number
}

// Built-in provider configurations
const BUILTIN_PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    protocol: 'anthropic-messages',
    baseUrl: 'https://api.anthropic.com',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    modelsEndpoint: '/v1/models',
  },
  {
    id: 'openai',
    displayName: 'OpenAI',
    protocol: 'openai-completions',
    baseUrl: 'https://api.openai.com',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    modelsEndpoint: '/v1/models',
  },
  {
    id: 'google',
    displayName: 'Google Gemini',
    protocol: 'google-generative-ai',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKeyEnvVar: 'GOOGLE_API_KEY',
    modelsEndpoint: '/v1beta/models',
  },
  {
    id: 'ollama',
    displayName: 'Ollama (Local)',
    protocol: 'ollama-chat',
    baseUrl: 'http://localhost:11434',
    modelsEndpoint: '/api/tags',
  },
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    protocol: 'openai-completions',
    baseUrl: 'https://api.deepseek.com',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    modelsEndpoint: '/v1/models',
  },
  {
    id: 'groq',
    displayName: 'Groq',
    protocol: 'openai-completions',
    baseUrl: 'https://api.groq.com/openai',
    apiKeyEnvVar: 'GROQ_API_KEY',
    modelsEndpoint: '/v1/models',
  },
  {
    id: 'together',
    displayName: 'Together AI',
    protocol: 'openai-completions',
    baseUrl: 'https://api.together.xyz',
    apiKeyEnvVar: 'TOGETHER_API_KEY',
    modelsEndpoint: '/v1/models',
  },
  {
    id: 'fireworks',
    displayName: 'Fireworks AI',
    protocol: 'openai-completions',
    baseUrl: 'https://api.fireworks.ai/inference',
    apiKeyEnvVar: 'FIREWORKS_API_KEY',
    modelsEndpoint: '/v1/models',
  },
  {
    id: 'mistral',
    displayName: 'Mistral AI',
    protocol: 'openai-completions',
    baseUrl: 'https://api.mistral.ai',
    apiKeyEnvVar: 'MISTRAL_API_KEY',
    modelsEndpoint: '/v1/models',
  },
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    protocol: 'openai-completions',
    baseUrl: 'https://openrouter.ai/api',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    modelsEndpoint: '/v1/models',
  },
  {
    id: 'xai',
    displayName: 'xAI (Grok)',
    protocol: 'openai-completions',
    baseUrl: 'https://api.x.ai',
    apiKeyEnvVar: 'XAI_API_KEY',
    modelsEndpoint: '/v1/models',
  },
  {
    id: 'sambanova',
    displayName: 'SambaNova',
    protocol: 'openai-completions',
    baseUrl: 'https://api.sambanova.ai',
    apiKeyEnvVar: 'SAMBANOVA_API_KEY',
    modelsEndpoint: '/v1/models',
  },
  {
    id: 'cerebras',
    displayName: 'Cerebras',
    protocol: 'openai-completions',
    baseUrl: 'https://api.cerebras.ai',
    apiKeyEnvVar: 'CEREBRAS_API_KEY',
    modelsEndpoint: '/v1/models',
  },
  {
    id: 'perplexity',
    displayName: 'Perplexity',
    protocol: 'openai-completions',
    baseUrl: 'https://api.perplexity.ai',
    apiKeyEnvVar: 'PERPLEXITY_API_KEY',
  },
  {
    id: 'cohere',
    displayName: 'Cohere',
    protocol: 'openai-completions',
    baseUrl: 'https://api.cohere.com/compatibility',
    apiKeyEnvVar: 'COHERE_API_KEY',
    modelsEndpoint: '/v1/models',
  },
]

// Custom providers added at runtime
const _customProviders: ProviderConfig[] = []

/**
 * Register a custom provider configuration.
 */
export function registerProvider(config: ProviderConfig): void {
  _customProviders.push(config)
}

/**
 * Get all available providers (built-in + custom).
 */
export function getAllProviders(): ProviderConfig[] {
  return [...BUILTIN_PROVIDERS, ..._customProviders]
}

/**
 * Get a provider by ID.
 */
export function getProvider(id: string): ProviderConfig | undefined {
  return getAllProviders().find(p => p.id === id)
}

/**
 * Check if a provider has credentials configured.
 */
export function isProviderAvailable(provider: ProviderConfig): boolean {
  if (!provider.apiKeyEnvVar) return true // No auth needed (e.g., Ollama)
  return !!process.env[provider.apiKeyEnvVar]
}

/**
 * Get all providers that have credentials configured.
 */
export function getAvailableProviders(): ProviderConfig[] {
  return getAllProviders().filter(isProviderAvailable)
}

/**
 * Fetch model list from a provider's API endpoint.
 */
async function fetchProviderModels(provider: ProviderConfig): Promise<CachedModelEntry[]> {
  if (!provider.modelsEndpoint) return provider.defaultModels ?? []

  const apiKey = provider.apiKeyEnvVar ? process.env[provider.apiKeyEnvVar] : undefined
  const url = `${provider.baseUrl.replace(/\/$/, '')}${provider.modelsEndpoint}`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) {
    if (provider.id === 'anthropic') {
      headers['x-api-key'] = apiKey
      headers['anthropic-version'] = '2023-06-01'
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`
    }
  }

  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
    if (!response.ok) return provider.defaultModels ?? []

    const data = await response.json() as any

    // Handle different response formats
    const models = data.data ?? data.models ?? []
    return models.map((m: any) => ({
      id: m.id ?? m.name ?? m.model,
      name: m.id ?? m.name ?? m.model,
      provider: provider.id,
      contextWindow: m.context_length ?? m.context_window,
      maxOutputTokens: m.max_output_tokens ?? m.max_tokens,
    }))
  } catch (err) {
    logForDebugging(`[modelManager] Failed to fetch models from ${provider.id}: ${err}`)
    return provider.defaultModels ?? []
  }
}

/**
 * Resolve models for a provider with caching strategy.
 */
export async function resolveProviderModels(
  providerId: string,
  strategy: ModelRefreshStrategy = 'online-if-uncached',
): Promise<CachedModelEntry[]> {
  // Check cache first
  const cached = getCachedModels(providerId, strategy)
  if (cached) return cached.models

  // Fetch from provider
  const provider = getProvider(providerId)
  if (!provider) return []

  const models = await fetchProviderModels(provider)
  if (models.length > 0) {
    setCachedModels(providerId, models)
  }
  return models
}

/**
 * Resolve a model ID to its provider and full configuration.
 */
export async function resolveModel(modelId: string): Promise<ResolvedModel | null> {
  // Check all available providers
  for (const provider of getAvailableProviders()) {
    const models = await resolveProviderModels(provider.id, 'offline')
    const match = models.find(m => m.id === modelId || m.name === modelId)
    if (match) {
      return {
        id: match.id,
        name: match.name,
        provider,
        contextWindow: match.contextWindow,
        maxOutputTokens: match.maxOutputTokens,
      }
    }
  }
  return null
}
