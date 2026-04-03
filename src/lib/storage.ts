/**
 * Chrome Storage utility for securely persisting extension settings.
 * All data is stored in chrome.storage.local (never synced) to protect API keys.
 */

import type { ExtensionSettings, ProviderId, ProviderConfig, LocalProviderConfig } from './types'
import { PROVIDERS } from './types'

const STORAGE_KEY = 'github_reverse_settings'

/** Returns a blank settings object with empty provider configs */
function defaultSettings(): ExtensionSettings {
  const providers = {} as Record<Exclude<ProviderId, 'local'>, ProviderConfig>
  for (const p of PROVIDERS) {
    providers[p.id] = { modelName: '', apiKey: '' }
  }
  return {
    providers,
    localProvider: { modelName: '', serverUrl: 'http://localhost:11434' },
    defaultProvider: null,
  }
}

/** Load the full settings from chrome.storage.local */
export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const stored = result[STORAGE_KEY] as ExtensionSettings | undefined
  if (!stored) return defaultSettings()

  const defaults = defaultSettings()
  return {
    providers: { ...defaults.providers, ...stored.providers },
    localProvider: stored.localProvider ?? defaults.localProvider,
    defaultProvider: stored.defaultProvider,
  }
}

/** Persist the full settings object */
export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings })
}

/** Get the active provider's config (supports both cloud and local) */
export async function getActiveProvider(): Promise<{
  id: ProviderId
  config: ProviderConfig | LocalProviderConfig
} | null> {
  const settings = await getSettings()
  if (!settings.defaultProvider) return null

  if (settings.defaultProvider === 'local') {
    const local = settings.localProvider
    if (!local.serverUrl || !local.modelName) return null
    return { id: 'local', config: local }
  }

  const config = settings.providers[settings.defaultProvider]
  if (!config.apiKey) return null
  return { id: settings.defaultProvider, config }
}

/** Quick check: is at least one provider fully configured? */
export async function hasConfiguredProvider(): Promise<boolean> {
  const settings = await getSettings()

  // Check cloud providers
  const hasCloud = Object.values(settings.providers).some(
    (p) => p.apiKey.trim() !== '' && p.modelName.trim() !== '',
  )
  // Check local provider
  const hasLocal =
    settings.localProvider.serverUrl.trim() !== '' &&
    settings.localProvider.modelName.trim() !== ''

  return hasCloud || hasLocal
}
