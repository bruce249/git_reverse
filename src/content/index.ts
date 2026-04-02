/**
 * Content Script
 * Injected on github.com pages.
 * Extracts repository metadata from the DOM when requested.
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_REPO_INFO') {
    // Extract owner/repo from the current GitHub URL
    const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)/)
    if (match) {
      sendResponse({ owner: match[1], repo: match[2] })
    } else {
      sendResponse(null)
    }
  }
  return true // keep the message channel open for async response
})

export {}
