

import Markdown from 'react-markdown'

interface Props {
  content: string
}

/**
 * Renders LLM markdown output with styled prose.
 * Tailwind classes applied via component overrides since
 * react-markdown renders raw HTML elements.
 */
export default function MarkdownView({ content }: Props) {
  return (
    <Markdown
      components={{
        h1: ({ children }) => (
          <h1 className="text-lg font-bold text-gray-100 mt-4 mb-2">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-semibold text-gray-100 mt-3 mb-1.5">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-gray-200 mt-2 mb-1">{children}</h3>
        ),
        p: ({ children }) => <p className="text-sm text-gray-300 mb-2 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside text-sm text-gray-300 mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-gray-300 mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ children, className }) => {
          // Inline code vs code blocks
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return (
              <code className="block bg-gray-900 rounded-lg p-3 text-xs text-emerald-300 overflow-x-auto my-2 font-mono">
                {children}
              </code>
            )
          }
          return (
            <code className="bg-gray-800 text-emerald-300 px-1 py-0.5 rounded text-xs font-mono">
              {children}
            </code>
          )
        },
        pre: ({ children }) => <pre className="my-2">{children}</pre>,
        strong: ({ children }) => <strong className="text-gray-100 font-semibold">{children}</strong>,
        em: ({ children }) => <em className="text-gray-400">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-emerald-500/50 pl-3 my-2 text-gray-400 italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-gray-800 my-3" />,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </Markdown>
  )
}
