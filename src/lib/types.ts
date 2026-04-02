/**
 * Shared type definitions for the GitHub Reverse extension.
 */

/** Supported LLM provider identifiers */
export type ProviderId =
  | 'google'
  | 'huggingface'
  | 'openrouter'
  | 'grok'
  | 'anthropic'
  | 'openai'

/** Configuration for a single LLM provider */
export interface ProviderConfig {
  modelName: string
  apiKey: string
}

/** Display metadata for each provider (used in the Options UI) */
export interface ProviderMeta {
  id: ProviderId
  label: string
  placeholder: string // example model name
  docsUrl: string
}

/** The full settings object persisted in chrome.storage.local */
export interface ExtensionSettings {
  providers: Record<ProviderId, ProviderConfig>
  defaultProvider: ProviderId | null
}

/** All supported providers with their UI metadata */
export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'google',
    label: 'Google Gemini',
    placeholder: 'gemini-2.0-flash',
    docsUrl: 'https://ai.google.dev/docs',
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    placeholder: 'meta-llama/Llama-3.1-70B-Instruct',
    docsUrl: 'https://huggingface.co/docs/api-inference',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    placeholder: 'anthropic/claude-3.5-sonnet',
    docsUrl: 'https://openrouter.ai/docs',
  },
  {
    id: 'grok',
    label: 'Grok (xAI)',
    placeholder: 'grok-2-latest',
    docsUrl: 'https://docs.x.ai/docs',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    placeholder: 'claude-sonnet-4-20250514',
    docsUrl: 'https://docs.anthropic.com',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    placeholder: 'gpt-4o',
    docsUrl: 'https://platform.openai.com/docs',
  },
]
