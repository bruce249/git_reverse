import { useState } from 'react'
import {
  GitBranch,
  Search,
  Settings,
} from 'lucide-react'
import SettingsPanel from './SettingsPanel'
import AnalysisPanel from './AnalysisPanel'

type Tab = 'analyze' | 'settings'

export default function Dashboard() {
  // Read URL params for initial state (popup passes ?tab=settings&repo=owner/repo)
  const params = new URLSearchParams(window.location.search)
  const initialTab = params.get('tab') === 'settings' ? 'settings' : 'analyze'
  const initialRepo = params.get('repo') ?? ''

  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      {/* ─── Sidebar ─── */}
      <aside className="w-64 bg-gray-900/50 border-r border-gray-800 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg">
              <GitBranch className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">GitHub Reverse</h1>
              <p className="text-xs text-gray-500">Repository Analyzer</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem
            icon={<Search className="w-4 h-4" />}
            label="Analyze"
            active={activeTab === 'analyze'}
            onClick={() => setActiveTab('analyze')}
          />
          <NavItem
            icon={<Settings className="w-4 h-4" />}
            label="Settings"
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          />
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800">
          <p className="text-xs text-gray-600">v1.0.0</p>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {/* Page header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold">
              {activeTab === 'analyze' ? 'Analyze Repository' : 'Settings'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {activeTab === 'analyze'
                ? 'Generate summaries, rebuild prompts, and improvement suggestions for any GitHub repo.'
                : 'Configure your LLM providers and local model servers.'}
            </p>
          </div>

          {/* Panel */}
          {activeTab === 'analyze' && <AnalysisPanel initialRepo={initialRepo} />}
          {activeTab === 'settings' && <SettingsPanel />}
        </div>
      </main>
    </div>
  )
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
        active
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
