import { useState, useEffect } from 'react'
import type { Scope } from '../api/client'
import { getSettings, saveSettings, getProfileSettings, saveProfileSettings } from '../api/client'

interface Props {
  scope: Scope
  targetFile?: string  // specific profile filename to edit
  onClose?: () => void // callback to close inline editor
  onSave?: () => void  // callback after successful save
}

interface SettingField {
  key: string
  label: string
  envKey?: string
  type: 'text' | 'password' | 'select' | 'toggle' | 'number'
  options?: { value: string; label: string }[]
  nested?: string // dot path like "env.ANTHROPIC_BASE_URL"
  showWhen?: string[] // only show when apiFormat matches one of these values
}

// Core fields — always visible
const CORE_FIELDS: SettingField[] = [
  { key: 'apiFormat', label: 'API 路由模式', type: 'select', options: [
    { value: '', label: '自动 (根据 URL 推断)' },
    { value: 'anthropic', label: 'Anthropic Messages API' },
    { value: 'openai', label: 'OpenAI Chat Completions API' },
    { value: 'responses', label: 'OpenAI Responses API (Codex)' },
    { value: 'azure-openai', label: 'Azure OpenAI' },
    { value: 'bedrock-converse', label: 'AWS Bedrock Converse' },
    { value: 'google-generative-ai', label: 'Google Gemini' },
    { value: 'google-vertex', label: 'Google Vertex AI' },
    { value: 'ollama-chat', label: 'Ollama (本地)' },
  ]},
  { key: 'env.ANTHROPIC_BASE_URL', label: 'API 端点', type: 'text', nested: 'env.ANTHROPIC_BASE_URL' },
  { key: 'env.ANTHROPIC_AUTH_TOKEN', label: 'API Key', type: 'password', nested: 'env.ANTHROPIC_AUTH_TOKEN' },
  { key: 'env.ANTHROPIC_MODEL', label: '指定模型 (覆盖所有层级)', type: 'text', nested: 'env.ANTHROPIC_MODEL' },
  { key: 'model', label: '模型别名 (sonnet/opus/haiku)', type: 'text' },
  { key: 'env.ANTHROPIC_DEFAULT_OPUS_MODEL', label: 'Opus 模型映射', type: 'text', nested: 'env.ANTHROPIC_DEFAULT_OPUS_MODEL' },
  { key: 'env.ANTHROPIC_DEFAULT_SONNET_MODEL', label: 'Sonnet 模型映射', type: 'text', nested: 'env.ANTHROPIC_DEFAULT_SONNET_MODEL' },
  { key: 'env.ANTHROPIC_DEFAULT_HAIKU_MODEL', label: 'Haiku 模型映射', type: 'text', nested: 'env.ANTHROPIC_DEFAULT_HAIKU_MODEL' },
  { key: 'env.CLAUDE_CODE_MAX_OUTPUT_TOKENS', label: '最大输出 Tokens', type: 'number', nested: 'env.CLAUDE_CODE_MAX_OUTPUT_TOKENS' },
  { key: 'env.API_TIMEOUT_MS', label: 'API 超时 (ms)', type: 'number', nested: 'env.API_TIMEOUT_MS' },
]

// Provider-specific fields — shown only when apiFormat matches
const PROVIDER_FIELDS: SettingField[] = [
  { key: 'env.AZURE_OPENAI_ENDPOINT', label: 'Azure 端点', type: 'text', nested: 'env.AZURE_OPENAI_ENDPOINT', showWhen: ['azure-openai'] },
  { key: 'env.AZURE_OPENAI_API_KEY', label: 'Azure API Key', type: 'password', nested: 'env.AZURE_OPENAI_API_KEY', showWhen: ['azure-openai'] },
  { key: 'env.AWS_REGION', label: 'AWS Region', type: 'text', nested: 'env.AWS_REGION', showWhen: ['bedrock-converse'] },
  { key: 'env.AWS_ACCESS_KEY_ID', label: 'AWS Access Key', type: 'password', nested: 'env.AWS_ACCESS_KEY_ID', showWhen: ['bedrock-converse'] },
  { key: 'env.AWS_SECRET_ACCESS_KEY', label: 'AWS Secret Key', type: 'password', nested: 'env.AWS_SECRET_ACCESS_KEY', showWhen: ['bedrock-converse'] },
  { key: 'env.VERTEX_ENDPOINT', label: 'Vertex AI 端点', type: 'text', nested: 'env.VERTEX_ENDPOINT', showWhen: ['google-vertex'] },
  { key: 'env.GOOGLE_API_KEY', label: 'Google API Key', type: 'password', nested: 'env.GOOGLE_API_KEY', showWhen: ['google-generative-ai', 'google-vertex'] },
  { key: 'env.OPENROUTER_API_KEY', label: 'OpenRouter API Key', type: 'password', nested: 'env.OPENROUTER_API_KEY', showWhen: ['openai', 'responses'] },
]

// Behavior fields — always visible
const BEHAVIOR_FIELDS: SettingField[] = [
  { key: 'kiroGateway', label: 'Kiro Gateway 优化', type: 'toggle' },
  { key: 'alwaysThinkingEnabled', label: '始终思考', type: 'toggle' },
  { key: 'skipDangerousModePermissionPrompt', label: '跳过危险确认', type: 'toggle' },
  { key: 'env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', label: 'Agent Teams', type: 'select', nested: 'env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', options: [
    { value: '', label: '关闭' }, { value: '1', label: '开启' },
  ]},
  { key: 'permissions.defaultMode', label: '权限模式', type: 'select', nested: 'permissions.defaultMode', options: [
    { value: 'default', label: 'Default' }, { value: 'plan', label: 'Plan' },
    { value: 'bypassPermissions', label: 'Bypass' }, { value: 'acceptEdits', label: 'Accept Edits' },
  ]},
  { key: 'language', label: '语言', type: 'text' },
]

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj)
}

function setNestedValue(obj: any, path: string, value: any): any {
  const clone = JSON.parse(JSON.stringify(obj))
  const keys = path.split('.')
  let cur = clone
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]!]) cur[keys[i]!] = {}
    cur = cur[keys[i]!]
  }
  cur[keys[keys.length - 1]!] = value
  return clone
}

export function SettingsPanel({ scope, targetFile, onClose, onSave }: Props) {
  const [data, setData] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setLoading(true)
    const loader = targetFile
      ? getProfileSettings(scope, targetFile)
      : getSettings(scope)
    loader.then(setData).catch(() => setData({})).finally(() => setLoading(false))
  }, [scope, targetFile])

  const getValue = (field: SettingField) => {
    const path = field.nested || field.key
    return getNestedValue(data, path) ?? ''
  }

  const setValue = (field: SettingField, value: any) => {
    const path = field.nested || field.key
    setData(prev => setNestedValue(prev, path, value))
  }

  const save = async () => {
    setSaving(true)
    setMsg('')
    try {
      if (targetFile) {
        await saveProfileSettings(scope, targetFile, data)
      } else {
        await saveSettings(scope, data)
      }
      setMsg('已保存')
      onSave?.()
      setTimeout(() => setMsg(''), 2000)
    } catch (e: any) {
      setMsg(`保存失败: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-gray-500 text-sm">加载中...</div>

  const currentFormat = String(getNestedValue(data, 'apiFormat') ?? '')
  const visibleProviderFields = PROVIDER_FIELDS.filter(f =>
    f.showWhen?.includes(currentFormat)
  )

  const renderField = (field: SettingField) => {
    if (field.type === 'toggle') {
      return (
        <button
          onClick={() => setValue(field, !getValue(field))}
          className={`w-10 h-5 rounded-full transition-colors relative ${
            getValue(field) ? 'bg-blue-600' : 'bg-gray-600'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            getValue(field) ? 'left-5' : 'left-0.5'
          }`} />
        </button>
      )
    }
    if (field.type === 'select') {
      return (
        <select
          value={String(getValue(field))}
          onChange={e => setValue(field, e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200"
        >
          <option value="">--</option>
          {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
    return (
      <input
        type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
        value={String(getValue(field))}
        onChange={e => setValue(field, field.type === 'number' ? Number(e.target.value) || '' : e.target.value)}
        className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200"
        placeholder={field.label}
      />
    )
  }

  return (
    <div className="space-y-4">
      {CORE_FIELDS.map(field => (
        <div key={field.key} className="flex items-center gap-4">
          <label className="w-40 text-sm text-gray-400 shrink-0">{field.label}</label>
          {renderField(field)}
        </div>
      ))}

      {visibleProviderFields.length > 0 && (
        <>
          <div className="border-t border-gray-800 pt-3 mt-3">
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              {currentFormat ? CORE_FIELDS[0]!.options!.find(o => o.value === currentFormat)?.label : ''}配置
            </span>
          </div>
          {visibleProviderFields.map(field => (
            <div key={field.key} className="flex items-center gap-4">
              <label className="w-40 text-sm text-gray-400 shrink-0">{field.label}</label>
              {renderField(field)}
            </div>
          ))}
        </>
      )}

      <div className="border-t border-gray-800 pt-3 mt-3">
        <span className="text-xs text-gray-500 uppercase tracking-wide">行为设置</span>
      </div>
      {BEHAVIOR_FIELDS.map(field => (
        <div key={field.key} className="flex items-center gap-4">
          <label className="w-40 text-sm text-gray-400 shrink-0">{field.label}</label>
          {renderField(field)}
        </div>
      ))}

      <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        {msg && <span className={`text-xs ${msg.startsWith('已') ? 'text-green-400' : 'text-red-400'}`}>{msg}</span>}
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
          >
            关闭
          </button>
        )}
      </div>
    </div>
  )
}
