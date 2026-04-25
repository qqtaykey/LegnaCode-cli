import { useState, useEffect } from 'react'
import type { Scope, Profile } from '../api/client'
import { getProfiles, switchProfile, cloneProfile } from '../api/client'

interface Props { scope: Scope }

export function ProfilesPanel({ scope }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<string | null>(null)
  const [cloning, setCloning] = useState<string | null>(null) // source filename being cloned
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

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
    if (!newName.trim()) {
      setError('请输入配置文件名')
      return
    }
    const target = newName.startsWith('settings') ? newName : `settings-${newName}`
    const finalName = target.endsWith('.json') ? target : `${target}.json`
    setError('')
    try {
      await cloneProfile(scope, source, finalName)
      setCloning(null)
      setNewName('')
      load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (loading) return <div className="text-gray-500 text-sm">加载中...</div>

  if (profiles.length === 0) {
    return <div className="text-gray-500 text-sm">未找到配置文件 (settings*.json)</div>
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-gray-300 mb-3">配置文件列表</h2>
      {profiles.map(p => (
        <div key={p.filename} className={`flex items-center justify-between p-3 rounded-lg border ${
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
      ))}

      {cloning && (
        <div className="p-3 rounded-lg border border-gray-600 bg-gray-800/80 space-y-2">
          <div className="text-sm text-gray-300">
            从 <span className="text-blue-400">{cloning}</span> 复制新配置
          </div>
          <div className="flex gap-2">
            <span className="text-sm text-gray-500 leading-8">settings-</span>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="例如: deepseek, kimi, qwen"
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleClone(cloning)}
            />
            <span className="text-sm text-gray-500 leading-8">.json</span>
          </div>
          {error && <div className="text-xs text-red-400">{error}</div>}
          <div className="flex gap-2">
            <button
              onClick={() => handleClone(cloning)}
              className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
            >
              确认
            </button>
            <button
              onClick={() => { setCloning(null); setError('') }}
              className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
