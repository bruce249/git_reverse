import { useEffect } from 'react'

/**
 * Options page redirect.
 * The options_page in manifest now points to the dashboard,
 * but this is kept as a fallback that redirects there.
 */
export default function Options() {
  useEffect(() => {
    const dashUrl = chrome.runtime.getURL('src/dashboard/index.html?tab=settings')
    window.location.href = dashUrl
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
      <p className="text-gray-500">Redirecting to dashboard...</p>
    </div>
  )
}
