import { useEffect, useState } from 'react'
import {
  GitBranch,
  Settings,
  ExternalLink,
  Globe,
  Search,
} from 'lucide-react'
import { parseGitHubUrl } from '../lib/github'
import { hasConfiguredProvider } from '../lib/storage'

/**
 * Lightweight popup launcher.
 * Detects the current tab, shows repo info, and opens the full dashboard UI.
 */
export default function Popup() {
  const [repo, setRepo] = useState<{ owner: string; repo: string } | null>(null)
  const [isGitHub, setIsGitHub] = useState(true)
  const [configured, setConfigured] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        const url = tab?.url
        if (!url) { setIsGitHub(false); return }
        const parsed = parseGitHubUrl(url)
        if (!parsed) { setIsGitHub(false); return }
        setRepo(parsed)
        setConfigured(await hasConfiguredProvider())
      } catch {
        setIsGitHub(false)
      }
    }
    init()
  }, [])

  const openDashboard = (tab?: string) => {
    const dashUrl = chrome.runtime.getURL('src/dashboard/index.html')
    const url = tab ? `${dashUrl}?tab=${tab}` : dashUrl
    if (repo) {
      const withRepo = `${url}${url.includes('?') ? '&' : '?'}repo=${repo.owner}/${repo.repo}`
      chrome.tabs.create({ url: withRepo })
    } else {
      chrome.tabs.create({ url })
    }
  }

  return (
    <div className="w-[340px] bg-gray-950 text-gray-100 p-4 flex flex-col">
      <header className="flex items-center justify-between pb-3 mb-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-emerald-400" />
          <h1 className="text-base font-semibold">GitHub Reverse</h1>
        </div>
        <button
          onClick={() => openDashboard('settings')}
          className="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {!isGitHub && (
        <div className="py-6 text-center">
          <Globe className="w-7 h-7 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-400 mb-3">Navigate to a GitHub repo to analyze it.</p>
          <button
            onClick={() => openDashboard()}
            className="text-xs text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 mx-auto"
          >
            Open Dashboard <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}

      {isGitHub && repo && !configured && (
        <div className="py-6 text-center">
          <Settings className="w-7 h-7 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-400 mb-3">Set up an LLM provider first.</p>
          <button
            onClick={() => openDashboard('settings')}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer mx-auto"
          >
            <Settings className="w-4 h-4" />
            Open Settings
          </button>
        </div>
      )}

      {isGitHub && repo && configured && (
        <div className="py-4 text-center">
          <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 mb-4 inline-flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-sm font-mono text-gray-300">{repo.owner}/{repo.repo}</span>
          </div>
          <button
            onClick={() => openDashboard()}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4" />
            Analyze in Dashboard
          </button>
          <button
            onClick={() => openDashboard()}
            className="mt-2 text-xs text-gray-500 hover:text-gray-300 cursor-pointer flex items-center gap-1 mx-auto"
          >
            Open full dashboard <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}
