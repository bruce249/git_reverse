import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Search,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Undo2,
  Sparkles,
  Wrench,
  GitBranch,
} from 'lucide-react'
import { fetchRepoContext } from '../lib/github'
import { queryLLM, type LLMResponse } from '../lib/llm-service'
import {
  buildSummaryPrompt,
  buildReversePromptPrompt,
  buildImprovementsPrompt,
  type RepoContext,
} from '../lib/prompts'
import MarkdownView from '../components/MarkdownView'

// ─── State Machine ──────────────────────────────────────────────────────────

type AnalysisState =
  | { phase: 'idle' }
  | { phase: 'fetching-context'; owner: string; repo: string }
  | { phase: 'generating-summary'; owner: string; repo: string }
  | { phase: 'summary'; owner: string; repo: string; context: RepoContext; summary: LLMResponse }
  | { phase: 'generating-action'; owner: string; repo: string; context: RepoContext; summary: LLMResponse; action: 'reverse' | 'improvements' }
  | { phase: 'result'; owner: string; repo: string; context: RepoContext; summary: LLMResponse; result: LLMResponse; action: 'reverse' | 'improvements' }
  | { phase: 'error'; message: string; owner?: string; repo?: string }

export default function AnalysisPanel({ initialRepo = '' }: { initialRepo?: string }) {
  const [state, setState] = useState<AnalysisState>({ phase: 'idle' })
  const [repoUrl, setRepoUrl] = useState(initialRepo)
  const [copied, setCopied] = useState(false)
  const activeRequestId = useRef(0)
  const autoStarted = useRef(false)

  // Auto-start analysis if a repo was passed via URL params
  useEffect(() => {
    if (initialRepo && !autoStarted.current) {
      autoStarted.current = true
      const parsed = parseInput(initialRepo)
      if (parsed) analyze(parsed.owner, parsed.repo)
    }
  }, [initialRepo])

  const parseInput = (input: string): { owner: string; repo: string } | null => {
    const trimmed = input.trim()
    // Handle owner/repo format
    const shortMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/)
    if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] }
    // Handle full URL
    try {
      const u = new URL(trimmed)
      if (u.hostname === 'github.com') {
        const m = u.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\/|$)/)
        if (m) return { owner: m[1], repo: m[2].replace(/\.git$/, '') }
      }
    } catch { /* not a URL */ }
    return null
  }

  const analyze = useCallback(async (owner: string, repo: string) => {
    const requestId = ++activeRequestId.current
    try {
      setState({ phase: 'fetching-context', owner, repo })
      const context = await fetchRepoContext(owner, repo)
      if (requestId !== activeRequestId.current) return

      setState({ phase: 'generating-summary', owner, repo })
      const prompt = buildSummaryPrompt(context)
      const summary = await queryLLM(prompt)
      if (requestId !== activeRequestId.current) return

      setState({ phase: 'summary', owner, repo, context, summary })
    } catch (err) {
      if (requestId !== activeRequestId.current) return
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'An unexpected error occurred.',
        owner,
        repo,
      })
    }
  }, [])

  const runAction = useCallback(
    async (action: 'reverse' | 'improvements', owner: string, repo: string, context: RepoContext, summary: LLMResponse) => {
      const requestId = ++activeRequestId.current
      try {
        setState({ phase: 'generating-action', owner, repo, context, summary, action })
        const prompt =
          action === 'reverse'
            ? buildReversePromptPrompt(context, summary.text)
            : buildImprovementsPrompt(context, summary.text)
        const result = await queryLLM(prompt)
        if (requestId !== activeRequestId.current) return
        setState({ phase: 'result', owner, repo, context, summary, result, action })
      } catch (err) {
        if (requestId !== activeRequestId.current) return
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : 'An unexpected error occurred.',
          owner,
          repo,
        })
      }
    },
    [],
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseInput(repoUrl)
    if (parsed) analyze(parsed.owner, parsed.repo)
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isLoading = state.phase === 'fetching-context' || state.phase === 'generating-summary' || state.phase === 'generating-action'

  return (
    <div>
      {/* Repo URL Input */}
      <form onSubmit={handleSubmit} className="mb-6">
        <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">
          Repository
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="owner/repo or https://github.com/owner/repo"
            className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors font-mono"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !parseInput(repoUrl)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Analyze
          </button>
        </div>
      </form>

      {/* ─── Loading States ─── */}
      {(state.phase === 'fetching-context' || state.phase === 'generating-summary' || state.phase === 'generating-action') && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 flex flex-col items-center">
          <RepoBadge owner={state.owner} repo={state.repo} />
          <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mt-6" />
          <p className="text-base text-gray-300 mt-4 font-medium">
            {state.phase === 'fetching-context' && 'Fetching repository structure...'}
            {state.phase === 'generating-summary' && 'Generating AI summary...'}
            {state.phase === 'generating-action' && (
              'action' in state && state.action === 'reverse'
                ? 'Generating reverse prompt...'
                : 'Analyzing for improvements...'
            )}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {state.phase === 'fetching-context' && 'Reading file tree, metadata, and README'}
            {state.phase === 'generating-summary' && 'Analyzing architecture and purpose'}
            {state.phase === 'generating-action' && 'This may take a moment for detailed output'}
          </p>
        </div>
      )}

      {/* ─── Summary ─── */}
      {state.phase === 'summary' && (
        <div className="space-y-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <RepoBadge owner={state.owner} repo={state.repo} />
              <ProviderBadge provider={state.summary.provider} model={state.summary.model} />
            </div>
            <MarkdownView content={state.summary.text} />
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider font-medium">
              What would you like to do next?
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => runAction('reverse', state.owner, state.repo, state.context, state.summary)}
                className="flex items-center gap-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-emerald-500/30 rounded-xl p-5 transition-all cursor-pointer group text-left"
              >
                <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                  <Sparkles className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-200 block">Generate Reverse Prompt</span>
                  <span className="text-xs text-gray-500">Step-by-step rebuild instructions</span>
                </div>
              </button>
              <button
                onClick={() => runAction('improvements', state.owner, state.repo, state.context, state.summary)}
                className="flex items-center gap-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-purple-500/30 rounded-xl p-5 transition-all cursor-pointer group text-left"
              >
                <div className="p-3 bg-purple-500/10 rounded-xl group-hover:bg-purple-500/20 transition-colors">
                  <Wrench className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-200 block">Recommend Improvements</span>
                  <span className="text-xs text-gray-500">Features, performance, security</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Final Result ─── */}
      {state.phase === 'result' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <RepoBadge owner={state.owner} repo={state.repo} />
            <div className="flex items-center gap-2">
              <ProviderBadge provider={state.result.provider} model={state.result.model} />
              <button
                onClick={() => copyToClipboard(state.result.text)}
                className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg transition-colors cursor-pointer border border-gray-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={() =>
                  setState({
                    phase: 'summary',
                    owner: state.owner,
                    repo: state.repo,
                    context: state.context,
                    summary: state.summary,
                  })
                }
                className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg transition-colors cursor-pointer border border-gray-700"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Back
              </button>
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-4">
              {state.action === 'reverse' ? 'Reverse-Engineering Prompt' : 'Improvement Recommendations'}
            </h3>
            <MarkdownView content={state.result.text} />
          </div>
        </div>
      )}

      {/* ─── Error ─── */}
      {state.phase === 'error' && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-400 mb-1">Something went wrong</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{state.message}</p>
            </div>
          </div>
          {state.owner && state.repo && (
            <button
              onClick={() => analyze(state.owner!, state.repo!)}
              className="mt-4 flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer border border-red-500/20"
            >
              <Undo2 className="w-4 h-4" />
              Retry
            </button>
          )}
        </div>
      )}

      {/* ─── Empty idle ─── */}
      {state.phase === 'idle' && (
        <div className="bg-gray-900/30 border border-gray-800/50 border-dashed rounded-xl p-12 flex flex-col items-center text-center">
          <div className="p-4 bg-gray-800/50 rounded-2xl mb-4">
            <Search className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-base font-medium text-gray-400 mb-1">Enter a repository to analyze</h3>
          <p className="text-sm text-gray-600 max-w-md">
            Paste a GitHub URL or type owner/repo above. The extension will fetch the file tree and generate an AI-powered summary.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function RepoBadge({ owner, repo }: { owner: string; repo: string }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 inline-flex items-center gap-2">
      <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
      <span className="text-sm font-mono text-gray-300">{owner}/{repo}</span>
    </div>
  )
}

function ProviderBadge({ provider, model }: { provider: string; model: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className="bg-gray-800 border border-gray-700 px-2 py-0.5 rounded text-gray-400 capitalize">{provider}</span>
      <span className="font-mono truncate max-w-[200px]">{model}</span>
    </div>
  )
}
