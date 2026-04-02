import { useEffect, useState, useCallback, useRef } from 'react'
import {
  GitBranch,
  Settings,
  Search,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Undo2,
  Sparkles,
  Wrench,
  Globe,
} from 'lucide-react'
import { parseGitHubUrl, fetchRepoContext } from '../lib/github'
import { hasConfiguredProvider } from '../lib/storage'
import { queryLLM, type LLMResponse } from '../lib/llm-service'
import {
  buildSummaryPrompt,
  buildReversePromptPrompt,
  buildImprovementsPrompt,
  type RepoContext,
} from '../lib/prompts'
import MarkdownView from './MarkdownView'

// ─── State Machine ──────────────────────────────────────────────────────────

type PopupState =
  | { phase: 'not-github' }
  | { phase: 'no-provider' }
  | { phase: 'idle'; owner: string; repo: string }
  | { phase: 'fetching-context'; owner: string; repo: string }
  | { phase: 'generating-summary'; owner: string; repo: string }
  | { phase: 'summary'; owner: string; repo: string; context: RepoContext; summary: LLMResponse }
  | { phase: 'generating-action'; owner: string; repo: string; context: RepoContext; summary: LLMResponse; action: 'reverse' | 'improvements' }
  | { phase: 'result'; owner: string; repo: string; context: RepoContext; summary: LLMResponse; result: LLMResponse; action: 'reverse' | 'improvements' }
  | { phase: 'error'; message: string; canRetry: boolean; owner?: string; repo?: string }

// ─── Component ──────────────────────────────────────────────────────────────

export default function Popup() {
  const [state, setState] = useState<PopupState>({ phase: 'not-github' })
  const [copied, setCopied] = useState(false)
  // Guard against setting state after popup closes or action is superseded
  const activeRequestId = useRef(0)

  // On mount: detect if we're on a GitHub repo and if a provider is configured
  useEffect(() => {
    async function init() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        const url = tab?.url
        if (!url) {
          setState({ phase: 'not-github' })
          return
        }

        const parsed = parseGitHubUrl(url)
        if (!parsed) {
          setState({ phase: 'not-github' })
          return
        }

        const configured = await hasConfiguredProvider()
        if (!configured) {
          setState({ phase: 'no-provider' })
          return
        }

        setState({ phase: 'idle', owner: parsed.owner, repo: parsed.repo })
      } catch {
        setState({ phase: 'not-github' })
      }
    }
    init()
  }, [])

  // ─── Actions (all API calls happen directly in popup context) ───────────

  const analyze = useCallback(async (owner: string, repo: string) => {
    const requestId = ++activeRequestId.current
    try {
      // Phase 1: Fetch repo context from GitHub API
      setState({ phase: 'fetching-context', owner, repo })
      const context = await fetchRepoContext(owner, repo)
      if (requestId !== activeRequestId.current) return

      // Phase 2: Generate summary via LLM
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
        canRetry: true,
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
          canRetry: false,
          owner,
          repo,
        })
      }
    },
    [],
  )

  const copyToClipboard = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  const openOptions = () => chrome.runtime.openOptionsPage()

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-[420px] min-h-[320px] max-h-[580px] bg-gray-950 text-gray-100 flex flex-col">
      {/* Header — always visible */}
      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-emerald-400" />
          <h1 className="text-base font-semibold">GitHub Reverse</h1>
        </div>
        <button
          onClick={openOptions}
          className="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* ─── Not on GitHub ─── */}
        {state.phase === 'not-github' && (
          <EmptyState
            icon={<Globe className="w-8 h-8 text-gray-600" />}
            title="Not a GitHub Repository"
            description="Navigate to a GitHub repository page to analyze it."
          />
        )}

        {/* ─── No Provider Configured ─── */}
        {state.phase === 'no-provider' && (
          <EmptyState
            icon={<Settings className="w-8 h-8 text-gray-600" />}
            title="No LLM Provider Configured"
            description="Add at least one API key and model name in Settings to get started."
          >
            <button
              onClick={openOptions}
              className="mt-3 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              Open Settings
            </button>
          </EmptyState>
        )}

        {/* ─── Idle — Ready to analyze ─── */}
        {state.phase === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full py-8">
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 mb-5 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-mono text-gray-300">
                {state.owner}/{state.repo}
              </span>
            </div>
            <button
              onClick={() => analyze(state.owner, state.repo)}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
              Analyze Repository
            </button>
            <p className="text-xs text-gray-600 mt-3 text-center">
              Fetches the repo structure and generates an AI summary.
            </p>
          </div>
        )}

        {/* ─── Loading: Fetching Context ─── */}
        {state.phase === 'fetching-context' && (
          <LoadingState
            owner={state.owner}
            repo={state.repo}
            message="Fetching repository structure..."
            detail="Reading file tree, metadata, and README"
          />
        )}

        {/* ─── Loading: Generating Summary ─── */}
        {state.phase === 'generating-summary' && (
          <LoadingState
            owner={state.owner}
            repo={state.repo}
            message="Generating AI summary..."
            detail="Analyzing architecture and purpose"
          />
        )}

        {/* ─── Summary + Choice ─── */}
        {state.phase === 'summary' && (
          <div>
            <RepoHeader owner={state.owner} repo={state.repo} />
            <ProviderBadge provider={state.summary.provider} model={state.summary.model} />

            <div className="mt-3 mb-4">
              <MarkdownView content={state.summary.text} />
            </div>

            <div className="border-t border-gray-800 pt-4">
              <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider font-medium">
                What would you like to do next?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <ActionButton
                  icon={<Sparkles className="w-4 h-4" />}
                  label="Reverse Prompt"
                  description="Rebuild instructions"
                  onClick={() => runAction('reverse', state.owner, state.repo, state.context, state.summary)}
                />
                <ActionButton
                  icon={<Wrench className="w-4 h-4" />}
                  label="Improvements"
                  description="Upgrade suggestions"
                  onClick={() => runAction('improvements', state.owner, state.repo, state.context, state.summary)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ─── Loading: Generating Action ─── */}
        {state.phase === 'generating-action' && (
          <LoadingState
            owner={state.owner}
            repo={state.repo}
            message={
              state.action === 'reverse'
                ? 'Generating reverse prompt...'
                : 'Analyzing for improvements...'
            }
            detail="This may take a moment for detailed output"
          />
        )}

        {/* ─── Final Result ─── */}
        {state.phase === 'result' && (
          <div>
            <RepoHeader owner={state.owner} repo={state.repo} />
            <div className="flex items-center justify-between mb-3">
              <ProviderBadge provider={state.result.provider} model={state.result.model} />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(state.result.text)}
                  className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
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
                  className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  title="Back to summary"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Back
                </button>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-3">
              <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">
                {state.action === 'reverse' ? 'Reverse-Engineering Prompt' : 'Improvement Recommendations'}
              </h3>
              <MarkdownView content={state.result.text} />
            </div>
          </div>
        )}

        {/* ─── Error ─── */}
        {state.phase === 'error' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 w-full">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-red-400 mb-1">Something went wrong</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{state.message}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              {state.canRetry && state.owner && state.repo && (
                <button
                  onClick={() => analyze(state.owner!, state.repo!)}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <Undo2 className="w-4 h-4" />
                  Retry
                </button>
              )}
              <button
                onClick={openOptions}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon}
      <h2 className="text-sm font-semibold text-gray-300 mt-3">{title}</h2>
      <p className="text-xs text-gray-500 mt-1 max-w-[260px]">{description}</p>
      {children}
    </div>
  )
}

function LoadingState({
  owner,
  repo,
  message,
  detail,
}: {
  owner: string
  repo: string
  message: string
  detail: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <RepoHeader owner={owner} repo={repo} />
      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mt-4" />
      <p className="text-sm text-gray-300 mt-3 font-medium">{message}</p>
      <p className="text-xs text-gray-500 mt-1">{detail}</p>
    </div>
  )
}

function RepoHeader({ owner, repo }: { owner: string; repo: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 mb-3 inline-flex items-center gap-2">
      <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
      <span className="text-xs font-mono text-gray-300">
        {owner}/{repo}
      </span>
    </div>
  )
}

function ProviderBadge({ provider, model }: { provider: string; model: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-400 capitalize">{provider}</span>
      <span className="font-mono truncate max-w-[200px]">{model}</span>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-emerald-500/30 rounded-xl px-3 py-4 transition-all cursor-pointer group"
    >
      <div className="text-emerald-400 group-hover:text-emerald-300 transition-colors">{icon}</div>
      <span className="text-sm font-medium text-gray-200">{label}</span>
      <span className="text-xs text-gray-500">{description}</span>
    </button>
  )
}
