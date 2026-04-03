/**
 * Modular LLM Service
 * Routes requests to the correct provider API based on user settings.
 * Each provider adapter formats the request/response per that API's spec.
 * Supports both cloud providers and local models (Ollama, LM Studio, etc.).
 */

import type { ProviderId, ProviderConfig, LocalProviderConfig } from './types'
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

// ─── Cloud Provider Adapters ────────────────────────────────────────────────

type CloudAdapter = (config: ProviderConfig, req: LLMRequest) => Promise<string>

/** Google Gemini */
const googleAdapter: CloudAdapter = async (config, req) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.modelName}:generateContent?key=${config.apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: req.system }] },
      contents: [{ parts: [{ text: req.user }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 16384 },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new LLMError(`Google API error: ${err}`, 'google', res.status)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

/** Hugging Face Inference API */
const huggingfaceAdapter: CloudAdapter = async (config, req) => {
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
      max_tokens: 16384,
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

/** OpenRouter */
const openrouterAdapter: CloudAdapter = async (config, req) => {
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
      max_tokens: 16384,
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

/** Grok (xAI) */
const grokAdapter: CloudAdapter = async (config, req) => {
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
      max_tokens: 16384,
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

/** Anthropic */
const anthropicAdapter: CloudAdapter = async (config, req) => {
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
      max_tokens: 16384,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new LLMError(`Anthropic API error: ${err}`, 'anthropic', res.status)
  }
  const data = await res.json()
  const blocks: Array<{ type: string; text?: string }> = data.content ?? []
  return blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

/** OpenAI */
const openaiAdapter: CloudAdapter = async (config, req) => {
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
      max_tokens: 16384,
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

// ─── Local Model Adapter ────────────────────────────────────────────────────

/**
 * Local LLM adapter (Ollama, LM Studio, LocalAI, or any OpenAI-compatible server).
 * Uses the OpenAI-compatible /v1/chat/completions endpoint that most local servers expose.
 */
async function localAdapter(config: LocalProviderConfig, req: LLMRequest): Promise<string> {
  const baseUrl = config.serverUrl.replace(/\/+$/, '')

  // Try OpenAI-compatible endpoint first (works with Ollama, LM Studio, LocalAI)
  let url = `${baseUrl}/v1/chat/completions`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        temperature: 0.7,
        stream: false,
      }),
    })
  } catch (fetchErr) {
    // If /v1/chat/completions fails, try Ollama's native /api/chat endpoint
    try {
      url = `${baseUrl}/api/chat`
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.modelName,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          stream: false,
          options: { temperature: 0.7 },
        }),
      })
    } catch {
      throw new LLMError(
        `Cannot connect to local server at ${config.serverUrl}. Make sure it is running.`,
        'local',
      )
    }
  }

  if (!res!.ok) {
    const raw = await res!.text()
    // Ollama returns JSON errors like {"error": "model not found"}
    let errorMsg = raw
    try {
      const parsed = JSON.parse(raw)
      errorMsg = parsed.error || parsed.message || raw
    } catch { /* not JSON, use raw text */ }
    if (!errorMsg) errorMsg = `HTTP ${res!.status} ${res!.statusText}`
    // 403 from Ollama means the extension origin is blocked
    if (res!.status === 403) {
      throw new LLMError(
        'Ollama blocked the request (403 Forbidden). You need to allow the Chrome extension origin.\n\n' +
        'Fix: Set the OLLAMA_ORIGINS environment variable to * and restart Ollama.\n\n' +
        'Windows (PowerShell):\n  $env:OLLAMA_ORIGINS="*"; ollama serve\n\n' +
        'Windows (permanent): Add OLLAMA_ORIGINS with value * in System Environment Variables, then restart Ollama.\n\n' +
        'Mac/Linux:\n  OLLAMA_ORIGINS=* ollama serve',
        'local',
        403,
      )
    }
    throw new LLMError(`Local model error: ${errorMsg}`, 'local', res!.status)
  }

  const data = await res!.json()

  // OpenAI-compatible response format
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content
  }
  // Ollama native response format
  if (data.message?.content) {
    return data.message.content
  }

  throw new LLMError('Unexpected response format from local model.', 'local')
}

// ─── Adapter Registry ───────────────────────────────────────────────────────

const cloudAdapters: Record<Exclude<ProviderId, 'local'>, CloudAdapter> = {
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
 */
export async function queryLLM(request: LLMRequest): Promise<LLMResponse> {
  const active = await getActiveProvider()
  if (!active) {
    throw new LLMError(
      'No LLM provider configured. Please open Settings and add a provider.',
      'openai',
    )
  }

  const { id, config } = active
  let text: string

  if (id === 'local') {
    text = await localAdapter(config as LocalProviderConfig, request)
  } else {
    const adapter = cloudAdapters[id]
    text = await adapter(config as ProviderConfig, request)
  }

  return {
    text,
    provider: id,
    model: config.modelName,
  }
}

/**
 * Test connection to a local LLM server. Returns true if the server responds.
 */
export async function testLocalConnection(serverUrl: string): Promise<{ ok: boolean; models?: string[]; error?: string }> {
  const baseUrl = serverUrl.replace(/\/+$/, '')
  try {
    // Try Ollama's /api/tags endpoint (lists available models)
    const res = await fetch(`${baseUrl}/api/tags`, { method: 'GET' })
    if (res.ok) {
      const data = await res.json()
      const models = (data.models ?? []).map((m: { name: string }) => m.name)
      return { ok: true, models }
    }
    if (res.status === 403) {
      return { ok: false, error: 'Ollama blocked the request (403). Set OLLAMA_ORIGINS=* in your environment variables and restart Ollama.' }
    }
  } catch {
    // Not Ollama, try OpenAI-compatible /v1/models
  }

  try {
    const res = await fetch(`${baseUrl}/v1/models`, { method: 'GET' })
    if (res.ok) {
      const data = await res.json()
      const models = (data.data ?? []).map((m: { id: string }) => m.id)
      return { ok: true, models }
    }
    if (res.status === 403) {
      return { ok: false, error: 'Server blocked the request (403). Set OLLAMA_ORIGINS=* in your environment variables and restart Ollama.' }
    }
    return { ok: false, error: `Server returned ${res.status}` }
  } catch {
    return { ok: false, error: `Cannot reach server at ${serverUrl}` }
  }
}
