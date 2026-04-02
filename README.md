# GitHub Reverse

A Chrome Extension that analyzes GitHub repositories using AI. Point it at any public repo and get an architectural summary, a step-by-step rebuild prompt, or improvement recommendations — powered by your choice of LLM provider.

## Features

- **Repository Analysis** — Fetches the file tree, metadata, and README from any public GitHub repo via the GitHub API
- **AI-Powered Summary** — Generates a concise architectural breakdown (purpose, tech stack, key components)
- **Reverse Prompt Generator** — Produces a detailed step-by-step prompt to rebuild the project from scratch
- **Improvement Recommendations** — Suggests missing features, performance fixes, and security enhancements
- **Multi-Provider Support** — Works with Google Gemini, OpenAI, Anthropic, Grok (xAI), OpenRouter, and Hugging Face
- **Copy to Clipboard** — One-click copy of any generated output
- **Secure Storage** — API keys are stored locally via `chrome.storage.local` and never synced

## Tech Stack

- **React 19** + **TypeScript** — UI components
- **Vite** + **@crxjs/vite-plugin** — Build tooling optimized for Chrome Extensions
- **Tailwind CSS v4** — Styling
- **Lucide React** — Icons
- **Chrome Manifest V3** — Service workers, content scripts, storage API

## Getting Started

### Prerequisites

- Node.js 18+
- A Chromium-based browser (Chrome, Edge, Brave, etc.)
- An API key from at least one supported LLM provider

### Install & Build

```bash
git clone https://github.com/your-username/Github_Reverse.git
cd Github_Reverse
npm install
npm run build
```

### Load the Extension

1. Open `chrome://extensions` in your browser
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Configure

The Settings page opens automatically on first install. Add your API key and model name for at least one provider, then mark it as the default.

## Usage

1. Navigate to any public GitHub repository
2. Click the GitHub Reverse extension icon
3. Click **Analyze Repository**
4. Read the AI summary, then choose:
   - **Reverse Prompt** — get rebuild instructions
   - **Improvements** — get upgrade suggestions
5. Copy the output to your clipboard

## Project Structure

```
src/
├── popup/          # Main extension popup (React)
│   ├── Popup.tsx         # State machine: idle → loading → summary → result
│   └── MarkdownView.tsx  # Styled markdown renderer for LLM output
├── options/        # Settings page (React)
│   └── Options.tsx       # API key management for 6 LLM providers
├── background/     # Service worker (lifecycle events only)
├── content/        # Content script (GitHub page detection)
├── lib/            # Shared utilities
│   ├── types.ts          # Provider types and metadata
│   ├── storage.ts        # chrome.storage.local wrapper
│   ├── github.ts         # GitHub API client + file tree filtering
│   ├── llm-service.ts    # Multi-provider LLM router (6 adapters)
│   └── prompts.ts        # Prompt templates for summary/reverse/improvements
└── assets/icons/   # Extension icons (16/48/128px)
```

## Supported LLM Providers

| Provider | Endpoint | Auth |
|----------|----------|------|
| Google Gemini | `generativelanguage.googleapis.com` | API key in URL |
| OpenAI | `api.openai.com/v1/chat/completions` | Bearer token |
| Anthropic | `api.anthropic.com/v1/messages` | `x-api-key` header |
| Grok (xAI) | `api.x.ai/v1/chat/completions` | Bearer token |
| OpenRouter | `openrouter.ai/api/v1/chat/completions` | Bearer token |
| Hugging Face | `api-inference.huggingface.co` | Bearer token |

## Development

```bash
npm run dev      # Start Vite dev server with HMR
npm run build    # Production build to dist/
npm run lint     # Run ESLint
```

For development, run `npm run dev` then load the `dist/` folder as an unpacked extension. Vite + CRXJS provides hot module replacement directly inside the extension.

## License

MIT
