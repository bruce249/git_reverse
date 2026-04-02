import { useEffect, useState, useCallback } from 'react'
import {
  Settings,
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  GitBranch,
} from 'lucide-react'
import type { ExtensionSettings, ProviderId } from '../lib/types'
import { PROVIDERS } from '../lib/types'
import { getSettings, saveSettings } from '../lib/storage'

export default function Options() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<ProviderId>>(new Set())
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Load settings on mount
  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const handleSave = useCallback(async () => {
    if (!settings) return
    setSaving(true)
    try {
      // If a default is selected but has no API key, warn the user
      if (settings.defaultProvider) {
        const cfg = settings.providers[settings.defaultProvider]
        if (!cfg.apiKey.trim()) {
          setToast('Default provider has no API key. Please add one or choose a different default.')
          setSaving(false)
          return
        }
      }
      await saveSettings(settings)
      setToast('Settings saved successfully!')
    } catch {
      setToast('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [settings])

  const updateProvider = (id: ProviderId, field: 'modelName' | 'apiKey', value: string) => {
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
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 shadow-lg animate-[fadeIn_0.2s_ease-out]">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm">{toast}</span>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <GitBranch className="w-6 h-6 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold">GitHub Reverse</h1>
          </div>
          <p className="text-gray-400 mt-2">
            Configure your LLM providers below. Your API keys are stored locally and never synced to
            the cloud.
          </p>
        </header>

        {/* Security notice */}
        <div className="flex items-start gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 mb-8">
          <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm text-gray-300">
            <strong className="text-emerald-400">Secure storage:</strong> All credentials are saved
            in <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">chrome.storage.local</code> —
            they never leave your machine and are not synced across devices.
          </div>
        </div>

        {/* Provider cards */}
        <div className="space-y-4">
          {PROVIDERS.map((provider) => {
            const cfg = settings.providers[provider.id]
            const isDefault = settings.defaultProvider === provider.id
            const isKeyVisible = visibleKeys.has(provider.id)
            const hasKey = cfg.apiKey.trim() !== ''
            const hasModel = cfg.modelName.trim() !== ''
            const isConfigured = hasKey && hasModel

            return (
              <div
                key={provider.id}
                className={`rounded-xl border transition-colors ${
                  isDefault
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-gray-800 bg-gray-900/50'
                }`}
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/50">
                  <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-base">{provider.label}</h2>
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
                      title="API Docs"
                    >
                      <ExternalLink className="w-4 h-4" />
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

                {/* Card body */}
                <div className="px-5 py-4 space-y-3">
                  {/* Model name */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">
                      Model Name
                    </label>
                    <input
                      type="text"
                      value={cfg.modelName}
                      onChange={(e) => updateProvider(provider.id, 'modelName', e.target.value)}
                      placeholder={provider.placeholder}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                    />
                  </div>

                  {/* API key */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={isKeyVisible ? 'text' : 'password'}
                        value={cfg.apiKey}
                        onChange={(e) => updateProvider(provider.id, 'apiKey', e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors font-mono"
                      />
                      <button
                        onClick={() => toggleKeyVisibility(provider.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                        title={isKeyVisible ? 'Hide key' : 'Show key'}
                      >
                        {isKeyVisible ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Save button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            {saving ? (
              <>
                <Settings className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-10">
          GitHub Reverse v1.0.0 — Your keys never leave this device.
        </p>
      </div>
    </div>
  )
}
