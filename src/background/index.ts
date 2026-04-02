/**
 * Background Service Worker
 * Handles extension lifecycle events only.
 * All API work (GitHub fetch, LLM calls) runs directly in the popup context
 * to avoid MV3 service worker reliability issues.
 */

// Open the options page on first install for onboarding
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage()
  }
})

export {}
