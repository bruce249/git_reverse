import { useEffect, useState, useCallback } from 'react'
import {
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  Server,
  Wifi,
  WifiOff,
  Loader2,
  Cloud,
  Monitor,
} from 'lucide-react'
import type { ExtensionSettings, ProviderId } from '../lib/types'
import { PROVIDERS } from '../lib/types'
import { getSettings, saveSettings } from '../lib/storage'
import { testLocalConnection } from '../lib/llm-service'

export default function SettingsPanel() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<ProviderId>>(new Set())
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [testingLocal, setTestingLocal] = useState(false)
  const [localStatus, setLocalStatus] = useState<{ ok: boolean; models?: string[]; error?: string } | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const handleSave = useCallback(async () => {
    if (!settings) return
    setSaving(true)
    try {
      if (settings.defaultProvider && settings.defaultProvider !== 'local') {
        const cfg = settings.providers[settings.defaultProvider]
        if (!cfg.apiKey.trim()) {
          setToast('Default provider has no API key.')
          setSaving(false)
          return
        }
      }
      if (settings.defaultProvider === 'local') {
        if (!settings.localProvider.serverUrl.trim() || !settings.localProvider.modelName.trim()) {
          setToast('Local provider needs both a server URL and model name.')
          setSaving(false)
          return
        }
      }
      await saveSettings(settings)
      setToast('Settings saved!')
    } catch {
      setToast('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [settings])

  const handleTestLocal = useCallback(async () => {
    if (!settings) return
    setTestingLocal(true)
    setLocalStatus(null)
    const result = await testLocalConnection(settings.localProvider.serverUrl)
    setLocalStatus(result)
    // Auto-fill model name if models were found and field is empty
    if (result.ok && result.models && result.models.length > 0 && !settings.localProvider.modelName) {
      setSettings({
        ...settings,
        localProvider: { ...settings.localProvider, modelName: result.models[0] },
      })
    }
    setTestingLocal(false)
  }, [settings])

  const updateProvider = (id: Exclude<ProviderId, 'local'>, field: 'modelName' | 'apiKey', value: string) => {
    if (!settings) return
    setSettings({
      ...settings,
      providers: {
        ...settings.providers,
        [id]: { ...settings.providers[id], [field]: value },
      },
    })
  }

  const toggleKeyVisibility = (id: ProviderId) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const setDefault = (id: ProviderId) => {
    if (!settings) return
    setSettings({
      ...settings,
      defaultProvider: settings.defaultProvider === id ? null : id,
    })
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 shadow-lg">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm">{toast}</span>
        </div>
      )}

      {/* Security notice */}
      <div className="flex items-start gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 mb-6">
        <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-sm text-gray-300">
          <strong className="text-emerald-400">Secure storage:</strong> All credentials are saved
          in <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">chrome.storage.local</code> and
          never leave your machine.
        </p>
      </div>

      {/* ─── Local LLM Section ─── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Monitor className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold">Local Models</h2>
          <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full">Ollama / LM Studio / LocalAI</span>
        </div>

        <div className={`rounded-xl border transition-colors ${
          settings.defaultProvider === 'local'
            ? 'border-purple-500/50 bg-purple-500/5'
            : 'border-gray-800 bg-gray-900/50'
        }`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/50">
            <div className="flex items-center gap-3">
              <Server className="w-4 h-4 text-purple-400" />
              <h3 className="font-semibold text-base">Local LLM Server</h3>
              {settings.localProvider.serverUrl && settings.localProvider.modelName && (
                <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full">Configured</span>
              )}
            </div>
            <button
              onClick={() => setDefault('local')}
              className={`text-xs font-medium px-3 py-1 rounded-full border transition-all cursor-pointer ${
                settings.defaultProvider === 'local'
                  ? 'bg-purple-500 text-white border-purple-500'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
            >
              {settings.defaultProvider === 'local' ? 'Default' : 'Set Default'}
            </button>
          </div>

          <div className="px-5 py-4 space-y-3">
            {/* Server URL */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">
                Server URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.localProvider.serverUrl}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      localProvider: { ...settings.localProvider, serverUrl: e.target.value },
                    })
                  }
                  placeholder="http://localhost:11434"
                  className="flex-1 bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-colors font-mono"
                />
                <button
                  onClick={handleTestLocal}
                  disabled={testingLocal || !settings.localProvider.serverUrl.trim()}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer border border-gray-700"
                >
                  {testingLocal ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wifi className="w-3.5 h-3.5" />
                  )}
                  Test
                </button>
              </div>
              {localStatus && (
                <div className={`mt-2 flex items-center gap-2 text-xs ${localStatus.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {localStatus.ok ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                  {localStatus.ok
                    ? `Connected! ${localStatus.models?.length ?? 0} model(s) available`
                    : localStatus.error}
                </div>
              )}
            </div>

            {/* Model name */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">
                Model Name
              </label>
              {localStatus?.ok && localStatus.models && localStatus.models.length > 0 ? (
                <select
                  value={settings.localProvider.modelName}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      localProvider: { ...settings.localProvider, modelName: e.target.value },
                    })
                  }
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-colors"
                >
                  <option value="">Select a model...</option>
                  {localStatus.models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={settings.localProvider.modelName}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      localProvider: { ...settings.localProvider, modelName: e.target.value },
                    })
                  }
                  placeholder="llama3, mistral, deepseek-coder..."
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-colors"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Cloud Providers Section ─── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Cloud className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold">Cloud Providers</h2>
        </div>

        <div className="space-y-3">
          {PROVIDERS.map((provider) => {
            const cfg = settings.providers[provider.id]
            const isDefault = settings.defaultProvider === provider.id
            const isKeyVisible = visibleKeys.has(provider.id)
            const isConfigured = cfg.apiKey.trim() !== '' && cfg.modelName.trim() !== ''

            return (
              <div
                key={provider.id}
                className={`rounded-xl border transition-colors ${
                  isDefault
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-gray-800 bg-gray-900/50'
                }`}
              >
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/50">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-sm">{provider.label}</h3>
                    {isConfigured && (
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
                        Configured
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => setDefault(provider.id)}
                      className={`text-xs font-medium px-3 py-1 rounded-full border transition-all cursor-pointer ${
                        isDefault
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                      }`}
                    >
                      {isDefault ? 'Default' : 'Set Default'}
                    </button>
                  </div>
                </div>

                <div className="px-5 py-3 flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Model</label>
                    <input
                      type="text"
                      value={cfg.modelName}
                      onChange={(e) => updateProvider(provider.id, 'modelName', e.target.value)}
                      placeholder={provider.placeholder}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">API Key</label>
                    <div className="relative">
                      <input
                        type={isKeyVisible ? 'text' : 'password'}
                        value={cfg.apiKey}
                        onChange={(e) => updateProvider(provider.id, 'apiKey', e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 pr-9 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors font-mono"
                      />
                      <button
                        onClick={() => toggleKeyVisibility(provider.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                      >
                        {isKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Save button */}
      <div className="mt-6 flex justify-end sticky bottom-0 py-4 bg-gray-950/80 backdrop-blur-sm">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
