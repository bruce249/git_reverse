/**
 * Modular LLM Service
 * Routes requests to the correct provider API based on user settings.
 * Each provider adapter formats the request/response per that API's spec.
 */

import type { ProviderId, ProviderConfig } from './types'
import { getActiveProvider } from './storage'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LLMRequest {
  system: string
  user: string
}

export interface LLMResponse {
  text: string
  provider: ProviderId
  model: string
}

export class LLMError extends Error {
  provider: ProviderId
  status?: number

  constructor(message: string, provider: ProviderId, status?: number) {
    super(message)
    this.name = 'LLMError'
    this.provider = provider
    this.status = status
  }
}

// ─── Provider Adapters ──────────────────────────────────────────────────────
// Each adapter takes a config + request and returns the response text.
// They handle the specific API format for their provider.

type Adapter = (config: ProviderConfig, req: LLMRequest) => Promise<string>

/** Google Gemini — generateContent endpoint */
const googleAdapter: Adapter = async (config, req) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.modelName}:generateContent?key=${config.apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: req.system }] },
      contents: [{ parts: [{ text: req.user }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new LLMError(`Google API error: ${err}`, 'google', res.status)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

/** Hugging Face Inference API — chat completions (Messages API) */
const huggingfaceAdapter: Adapter = async (config, req) => {
  const url = `https://api-inference.huggingface.co/models/${config.modelName}/v1/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelName,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new LLMError(`Hugging Face API error: ${err}`, 'huggingface', res.status)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

/** OpenRouter — OpenAI-compatible chat completions */
const openrouterAdapter: Adapter = async (config, req) => {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'HTTP-Referer': 'https://github.com',
      'X-Title': 'GitHub Reverse',
    },
    body: JSON.stringify({
      model: config.modelName,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new LLMError(`OpenRouter API error: ${err}`, 'openrouter', res.status)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

/** Grok (xAI) — OpenAI-compatible chat completions */
const grokAdapter: Adapter = async (config, req) => {
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelName,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new LLMError(`Grok API error: ${err}`, 'grok', res.status)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

/** Anthropic — Messages API (requires anthropic-version header) */
const anthropicAdapter: Adapter = async (config, req) => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.modelName,
      max_tokens: 4096,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new LLMError(`Anthropic API error: ${err}`, 'anthropic', res.status)
  }
  const data = await res.json()
  // Anthropic returns content as an array of blocks
  const blocks: Array<{ type: string; text?: string }> = data.content ?? []
  return blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

/** OpenAI — Chat Completions API */
const openaiAdapter: Adapter = async (config, req) => {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelName,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new LLMError(`OpenAI API error: ${err}`, 'openai', res.status)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ─── Adapter Registry ───────────────────────────────────────────────────────

const adapters: Record<ProviderId, Adapter> = {
  google: googleAdapter,
  huggingface: huggingfaceAdapter,
  openrouter: openrouterAdapter,
  grok: grokAdapter,
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Send a prompt to the user's configured default LLM provider.
 * Reads settings from chrome.storage, selects the right adapter, and returns
 * the parsed text response.
 *
 * @throws {LLMError} on API errors or misconfiguration
 */
export async function queryLLM(request: LLMRequest): Promise<LLMResponse> {
  const active = await getActiveProvider()
  if (!active) {
    throw new LLMError(
      'No LLM provider configured. Please open Settings and add an API key.',
      'openai', // placeholder
    )
  }

  const { id, config } = active
  const adapter = adapters[id]

  const text = await adapter(config, request)

  return {
    text,
    provider: id,
    model: config.modelName,
  }
}

/**
 * Send a prompt to a specific provider (useful for testing or overrides).
 */
export async function queryProvider(
  providerId: ProviderId,
  config: ProviderConfig,
  request: LLMRequest,
): Promise<LLMResponse> {
  const adapter = adapters[providerId]
  const text = await adapter(config, request)
  return { text, provider: providerId, model: config.modelName }
}
