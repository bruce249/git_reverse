/**
 * GitHub API Service
 * Fetches repository metadata, file tree, and README content.
 * Includes filtering to exclude noise (node_modules, .git, binaries, images).
 */

import type { RepoContext } from './prompts'

// ─── URL Parsing ────────────────────────────────────────────────────────────

/** Parse a GitHub URL into owner/repo. Returns null if not a valid repo URL. */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'github.com') return null
    // Match /owner/repo, ignoring trailing segments like /tree/main/...
    const match = u.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\/|$)/)
    if (!match) return null
    const [, owner, repo] = match
    // Filter out GitHub non-repo pages
    const reserved = new Set([
      'settings', 'notifications', 'explore', 'topics',
      'trending', 'collections', 'sponsors', 'marketplace',
      'pulls', 'issues', 'codespaces', 'login', 'signup',
      'orgs', 'users', 'new',
    ])
    if (reserved.has(owner)) return null
    return { owner, repo: repo.replace(/\.git$/, '') }
  } catch {
    return null
  }
}

// ─── File Tree Filtering ────────────────────────────────────────────────────

/** Directories to always skip when building the file tree */
const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out',
  '.next', '.nuxt', '__pycache__', '.cache', '.parcel-cache',
  'vendor', 'bower_components', '.gradle', '.idea', '.vscode',
  'coverage', '.nyc_output', '.tox', 'eggs', '.eggs',
])

/** File extensions to skip (images, binaries, media, fonts) */
const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
  '.mp4', '.mp3', '.wav', '.avi', '.mov', '.flv', '.wmv',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
  '.pyc', '.pyo', '.class', '.o', '.obj',
  '.DS_Store', '.lock',
])

/** Lock / generated files to skip entirely */
const IGNORED_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock',
  'Gemfile.lock', 'poetry.lock', 'composer.lock', 'Pipfile.lock',
  '.DS_Store', 'Thumbs.db',
])

interface TreeNode {
  path: string
  type: 'blob' | 'tree'
  size?: number
}

/** Filter the flat tree array, removing ignored dirs/files/extensions */
function filterTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.filter((node) => {
    const parts = node.path.split('/')
    const filename = parts[parts.length - 1]

    // Skip if any path segment is an ignored directory
    if (parts.some((p) => IGNORED_DIRS.has(p))) return false

    // Skip ignored files
    if (IGNORED_FILES.has(filename)) return false

    // Skip ignored extensions for blobs
    if (node.type === 'blob') {
      const ext = filename.includes('.') ? '.' + filename.split('.').pop()!.toLowerCase() : ''
      if (IGNORED_EXTENSIONS.has(ext)) return false
      // Skip very large files (>500KB) — they're likely generated/data
      if (node.size && node.size > 500_000) return false
    }

    return true
  })
}

/** Format filtered tree nodes into a readable string for the LLM prompt */
function formatTree(nodes: TreeNode[]): string {
  // Sort: directories first, then files, both alphabetically
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'tree' ? -1 : 1
    return a.path.localeCompare(b.path)
  })

  const lines: string[] = []
  for (const node of sorted) {
    const prefix = node.type === 'tree' ? '📁 ' : '   '
    lines.push(`${prefix}${node.path}`)
  }

  // If the tree is very large, truncate and indicate count
  const MAX_LINES = 200
  if (lines.length > MAX_LINES) {
    const truncated = lines.slice(0, MAX_LINES)
    truncated.push(`\n... and ${lines.length - MAX_LINES} more files (truncated)`)
    return truncated.join('\n')
  }
  return lines.join('\n')
}

// ─── GitHub API Calls ───────────────────────────────────────────────────────

const API_BASE = 'https://api.github.com'

/** Common fetch wrapper with error handling and optional auth */
async function ghFetch<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { headers })

  if (res.status === 403 && res.headers.get('X-RateLimit-Remaining') === '0') {
    const reset = res.headers.get('X-RateLimit-Reset')
    const resetTime = reset ? new Date(Number(reset) * 1000).toLocaleTimeString() : 'soon'
    throw new Error(
      `GitHub API rate limit exceeded. Resets at ${resetTime}. ` +
      'Add a GitHub token in a future update to increase limits.',
    )
  }

  if (res.status === 404) {
    throw new Error('Repository not found. It may be private or the URL is invalid.')
  }

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<T>
}

// ─── API Response Types ─────────────────────────────────────────────────────

interface RepoResponse {
  description: string | null
  language: string | null
  topics?: string[]
  default_branch: string
}

interface GitTreeResponse {
  tree: TreeNode[]
  truncated: boolean
}

interface ContentResponse {
  content: string
  encoding: string
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch all repository context needed for LLM prompts.
 * Makes 3 API calls: repo metadata, git tree, and README.
 */
export async function fetchRepoContext(
  owner: string,
  repo: string,
  token?: string,
): Promise<RepoContext> {
  // 1. Fetch repo metadata
  const repoData = await ghFetch<RepoResponse>(`/repos/${owner}/${repo}`, token)

  // 2. Fetch the full git tree (recursive) for the default branch
  let treeNodes: TreeNode[] = []
  let treeTruncated = false
  try {
    const tree = await ghFetch<GitTreeResponse>(
      `/repos/${owner}/${repo}/git/trees/${repoData.default_branch}?recursive=1`,
      token,
    )
    treeNodes = tree.tree
    treeTruncated = tree.truncated
  } catch {
    // If tree fetch fails (e.g. empty repo), continue with empty tree
    treeNodes = []
  }

  // 3. Filter and format the tree
  const filtered = filterTree(treeNodes)
  let fileTree = formatTree(filtered)
  if (treeTruncated) {
    fileTree += '\n\n⚠️ Repository is very large — file tree was truncated by GitHub.'
  }

  // 4. Try to fetch README (best-effort, not critical)
  let readmeSnippet: string | undefined
  try {
    const readme = await ghFetch<ContentResponse>(
      `/repos/${owner}/${repo}/readme`,
      token,
    )
    if (readme.encoding === 'base64' && readme.content) {
      const decoded = atob(readme.content.replace(/\n/g, ''))
      // Truncate to ~2000 chars to save tokens
      readmeSnippet = decoded.length > 2000 ? decoded.slice(0, 2000) + '\n...(truncated)' : decoded
    }
  } catch {
    // README not found or not readable — that's fine
  }

  return {
    owner,
    repo,
    description: repoData.description,
    language: repoData.language,
    topics: repoData.topics ?? [],
    fileTree,
    readmeSnippet,
  }
}
