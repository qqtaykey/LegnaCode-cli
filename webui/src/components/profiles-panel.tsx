import { useState, useEffect } from 'react'
import type { Scope, Profile } from '../api/client'
import { getProfiles, switchProfile, cloneProfile, createProfile } from '../api/client'
import { SettingsPanel } from './settings-panel'

interface Props { scope: Scope }

interface Preset {
  id: string
  name: string
  color: string
  content: Record<string, any>
}

const PRESETS: Preset[] = [
  {
    id: 'deepseek', name: 'DeepSeek', color: '#4D6BFE',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'sk-',
        ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
        ANTHROPIC_MODEL: 'deepseek-v4-flash',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'deepseek-v4-flash',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'deepseek-v4-flash',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'deepseek-v4-pro',
      },
      model: 'deepseek-v4-flash',
    },
  },
  {
    id: 'kimi', name: 'Kimi (Moonshot)', color: '#6366F1',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'sk-',
        ANTHROPIC_BASE_URL: 'https://api.moonshot.cn/v1',
        ANTHROPIC_MODEL: 'kimi-k2.6',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'kimi-k2.6',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'kimi-k2.6',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'kimi-k2.6',
      },
      apiFormat: 'openai',
      model: 'kimi-k2.6',
    },
  },
  {
    id: 'glm', name: 'GLM (ZhipuAI)', color: '#3B82F6',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic',
        ANTHROPIC_MODEL: 'glm-5.1',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.7-flash',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-4.7',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5.1',
      },
      model: 'glm-5.1',
    },
  },
  {
    id: 'qwen', name: 'Qwen (百炼)', color: '#8B5CF6',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_BASE_URL: 'https://dashscope.aliyuncs.com/apps/anthropic',
        ANTHROPIC_MODEL: 'qwen3.6-plus',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'qwen3.6-flash',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'qwen3.6-plus',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'qwen3.6-plus',
      },
      model: 'qwen3.6-plus',
    },
  },
  {
    id: 'minimax', name: 'MiniMax', color: '#EC4899',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_BASE_URL: 'https://api.minimaxi.com/anthropic',
        ANTHROPIC_MODEL: 'MiniMax-M2.7',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'MiniMax-M2.7-highspeed',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'MiniMax-M2.7',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'MiniMax-M2.7',
      },
      model: 'MiniMax-M2.7',
    },
  },
  {
    id: 'mimo', name: 'MiMo (Xiaomi)', color: '#F97316',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_BASE_URL: 'https://api.xiaomimimo.com/anthropic',
        ANTHROPIC_MODEL: 'mimo-v2.5-pro',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'mimo-v2.5',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'mimo-v2.5-pro',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'mimo-v2.5-pro',
      },
      model: 'mimo-v2.5-pro',
    },
  },
  {
    id: 'anthropic', name: 'Anthropic', color: '#D97706',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      },
      model: 'sonnet',
    },
  },
  {
    id: 'openai', name: 'OpenAI', color: '#10B981',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'sk-',
        ANTHROPIC_BASE_URL: 'https://api.openai.com',
        ANTHROPIC_MODEL: 'gpt-4.1',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'gpt-4.1-mini',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'gpt-4.1',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'o3',
      },
      apiFormat: 'openai',
      model: 'gpt-4.1',
    },
  },
  {
    id: 'openrouter', name: 'OpenRouter', color: '#6D28D9',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'sk-or-',
        ANTHROPIC_BASE_URL: 'https://openrouter.ai/api',
        ANTHROPIC_MODEL: 'anthropic/claude-sonnet-4-20250514',
      },
      apiFormat: 'openai',
      model: 'anthropic/claude-sonnet-4-20250514',
    },
  },
  {
    id: 'groq', name: 'Groq', color: '#F59E0B',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'gsk_',
        ANTHROPIC_BASE_URL: 'https://api.groq.com/openai',
        ANTHROPIC_MODEL: 'llama-4-scout-17b-16e-instruct',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'llama-4-scout-17b-16e-instruct',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'llama-4-maverick-17b-128e-instruct',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'llama-4-maverick-17b-128e-instruct',
      },
      apiFormat: 'openai',
      model: 'llama-4-scout-17b-16e-instruct',
    },
  },
  {
    id: 'xai', name: 'xAI (Grok)', color: '#1D4ED8',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'xai-',
        ANTHROPIC_BASE_URL: 'https://api.x.ai',
        ANTHROPIC_MODEL: 'grok-3',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'grok-3-mini',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'grok-3',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'grok-3',
      },
      apiFormat: 'openai',
      model: 'grok-3',
    },
  },
  {
    id: 'azure', name: 'Azure OpenAI', color: '#0078D4',
    content: {
      env: {
        AZURE_OPENAI_API_KEY: '',
        AZURE_OPENAI_ENDPOINT: 'https://YOUR_RESOURCE.openai.azure.com',
        ANTHROPIC_MODEL: 'gpt-4o',
      },
      apiFormat: 'azure-openai',
      model: 'gpt-4o',
    },
  },
  {
    id: 'gemini', name: 'Google Gemini', color: '#4285F4',
    content: {
      env: {
        GOOGLE_API_KEY: '',
        ANTHROPIC_BASE_URL: 'https://generativelanguage.googleapis.com',
        ANTHROPIC_MODEL: 'gemini-2.5-pro',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'gemini-2.5-flash',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'gemini-2.5-pro',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'gemini-2.5-pro',
      },
      apiFormat: 'google-generative-ai',
      model: 'gemini-2.5-pro',
    },
  },
  {
    id: 'ollama', name: 'Ollama (本地)', color: '#374151',
    content: {
      env: {
        ANTHROPIC_BASE_URL: 'http://localhost:11434',
        ANTHROPIC_MODEL: 'qwen3:32b',
      },
      apiFormat: 'ollama-chat',
      model: 'qwen3:32b',
    },
  },
  {
    id: 'together', name: 'Together AI', color: '#059669',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_BASE_URL: 'https://api.together.xyz',
        ANTHROPIC_MODEL: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
      },
      apiFormat: 'openai',
      model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    },
  },
  {
    id: 'fireworks', name: 'Fireworks AI', color: '#DC2626',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_BASE_URL: 'https://api.fireworks.ai/inference',
        ANTHROPIC_MODEL: 'accounts/fireworks/models/llama4-maverick-instruct-basic',
      },
      apiFormat: 'openai',
      model: 'accounts/fireworks/models/llama4-maverick-instruct-basic',
    },
  },
  {
    id: 'mistral', name: 'Mistral AI', color: '#FF7000',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_BASE_URL: 'https://api.mistral.ai',
        ANTHROPIC_MODEL: 'mistral-large-latest',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'mistral-small-latest',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'mistral-large-latest',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'mistral-large-latest',
      },
      apiFormat: 'openai',
      model: 'mistral-large-latest',
    },
  },
  {
    id: 'sambanova', name: 'SambaNova', color: '#7C3AED',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_BASE_URL: 'https://api.sambanova.ai',
        ANTHROPIC_MODEL: 'Meta-Llama-4-Maverick-17B-128E-Instruct',
      },
      apiFormat: 'openai',
      model: 'Meta-Llama-4-Maverick-17B-128E-Instruct',
    },
  },
  {
    id: 'cerebras', name: 'Cerebras', color: '#2563EB',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_BASE_URL: 'https://api.cerebras.ai',
        ANTHROPIC_MODEL: 'llama-4-scout-17b-16e-instruct',
      },
      apiFormat: 'openai',
      model: 'llama-4-scout-17b-16e-instruct',
    },
  },
  {
    id: 'yi', name: 'Yi (零一万物)', color: '#14B8A6',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_BASE_URL: 'https://api.lingyiwanwu.com',
        ANTHROPIC_MODEL: 'yi-lightning',
      },
      apiFormat: 'openai',
      model: 'yi-lightning',
    },
  },
  {
    id: 'baichuan', name: 'Baichuan (百川)', color: '#0EA5E9',
    content: {
      env: {
        ANTHROPIC_AUTH_TOKEN: '',
        ANTHROPIC_BASE_URL: 'https://api.baichuan-ai.com',
        ANTHROPIC_MODEL: 'Baichuan4',
      },
      apiFormat: 'openai',
      model: 'Baichuan4',
    },
  },
]

export function ProfilesPanel({ scope }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<string | null>(null)
  const [cloning, setCloning] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [showPresets, setShowPresets] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null)
  const [presetName, setPresetName] = useState('')

  const load = () => {
    setLoading(true)
    getProfiles(scope).then(setProfiles).catch(() => setProfiles([])).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [scope])

  const handleSwitch = async (filename: string) => {
    setSwitching(filename)
    try {
      await switchProfile(scope, filename)
      load()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSwitching(null)
    }
  }

  const handleClone = async (source: string) => {
    if (!newName.trim()) { setError('请输入配置文件名'); return }
    const target = newName.startsWith('settings') ? newName : `settings-${newName}`
    const finalName = target.endsWith('.json') ? target : `${target}.json`
    setError('')
    try {
      await cloneProfile(scope, source, finalName)
      setCloning(null); setNewName(''); load()
    } catch (e: any) { setError(e.message) }
  }

  const handleCreateFromPreset = async () => {
    if (!selectedPreset || !presetName.trim()) { setError('请输入配置文件名'); return }
    const target = presetName.startsWith('settings') ? presetName : `settings-${presetName}`
    const finalName = target.endsWith('.json') ? target : `${target}.json`
    setError('')
    try {
      await createProfile(scope, finalName, selectedPreset.content)
      await switchProfile(scope, finalName)
      setShowPresets(false); setSelectedPreset(null); setPresetName(''); load()
    } catch (e: any) { setError(e.message) }
  }

  if (loading) return <div className="text-gray-500 text-sm">加载中...</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-300">配置文件列表</h2>
        <button
          onClick={() => { setShowPresets(!showPresets); setSelectedPreset(null); setError('') }}
          className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
        >
          {showPresets ? '收起' : '从预设创建'}
        </button>
      </div>

      {showPresets && (
        <div className="p-3 rounded-lg border border-green-700/50 bg-green-900/10 space-y-3">
          <div className="text-sm text-gray-300">选择 Provider 预设</div>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedPreset(p); setPresetName(p.id); setError('') }}
                className={`p-2 rounded border text-left text-xs transition-colors ${
                  selectedPreset?.id === p.id
                    ? 'border-green-500 bg-green-500/10 text-green-300'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-500'
                }`}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
                {p.name}
              </button>
            ))}
          </div>
          {selectedPreset && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500">
                端点: {selectedPreset.content.env?.ANTHROPIC_BASE_URL} · 模型: {selectedPreset.content.env?.ANTHROPIC_MODEL || selectedPreset.content.model}
              </div>
              <div className="flex gap-2">
                <span className="text-sm text-gray-500 leading-8">settings-</span>
                <input
                  type="text"
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreateFromPreset()}
                />
                <span className="text-sm text-gray-500 leading-8">.json</span>
              </div>
              {error && <div className="text-xs text-red-400">{error}</div>}
              <button
                onClick={handleCreateFromPreset}
                className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
              >
                创建并切换
              </button>
            </div>
          )}
        </div>
      )}

      {profiles.length === 0 && !showPresets && (
        <div className="text-gray-500 text-sm">未找到配置文件 (settings*.json)</div>
      )}

      {profiles.map(p => (
        <div key={p.filename}>
          <div className={`flex items-center justify-between p-3 rounded-lg border ${
            p.isActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-800/50'
          }`}>
          <div>
            <div className="text-sm font-medium text-gray-200">
              {p.filename}
              {p.isActive && <span className="ml-2 text-xs text-blue-400">当前</span>}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {p.baseUrl && <span className="mr-3">端点: {p.baseUrl}</span>}
              {p.model && <span>模型: {p.model}</span>}
              {!p.baseUrl && !p.model && <span>无额外配置</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(editing === p.filename ? null : p.filename)}
              className={`px-3 py-1 text-xs ${editing === p.filename ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-gray-600 hover:bg-gray-500'} text-white rounded transition-colors`}
            >
              {editing === p.filename ? '收起' : '编辑'}
            </button>
            <button
              onClick={() => { setCloning(p.filename); setNewName(''); setError('') }}
              className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              复制
            </button>
            {!p.isActive && (
              <button
                onClick={() => handleSwitch(p.filename)}
                disabled={switching !== null}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {switching === p.filename ? '切换中...' : '切换'}
              </button>
            )}
          </div>
        </div>
        {editing === p.filename && (
          <div className="ml-2 border-l-2 border-yellow-600/50 pl-3">
            <SettingsPanel scope={scope} targetFile={p.filename} onClose={() => setEditing(null)} onSave={load} />
          </div>
        )}
        </div>
      ))}

      {cloning && (
        <div className="p-3 rounded-lg border border-gray-600 bg-gray-800/80 space-y-2">
          <div className="text-sm text-gray-300">
            从 <span className="text-blue-400">{cloning}</span> 复制新配置
          </div>
          <div className="flex gap-2">
            <span className="text-sm text-gray-500 leading-8">settings-</span>
            <input
              type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="例如: deepseek, kimi, qwen"
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200"
              autoFocus onKeyDown={e => e.key === 'Enter' && handleClone(cloning)}
            />
            <span className="text-sm text-gray-500 leading-8">.json</span>
          </div>
          {error && <div className="text-xs text-red-400">{error}</div>}
          <div className="flex gap-2">
            <button onClick={() => handleClone(cloning)} className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors">确认</button>
            <button onClick={() => { setCloning(null); setError('') }} className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors">取消</button>
          </div>
        </div>
      )}
    </div>
  )
}
