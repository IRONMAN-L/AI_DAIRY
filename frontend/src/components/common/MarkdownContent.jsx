/**
 * Format inline markdown text: bold, italic, inline code, and URLs
 */
function renderInline(text) {
  if (!text) return null

  const tokens = []
  let remaining = text
  let keyIndex = 0

  while (remaining.length > 0) {
    // 1. Inline Code `code`
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      tokens.push(
        <code key={`code-${keyIndex++}`} className="inline-code">
          {codeMatch[1]}
        </code>
      )
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // 2. Bold **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/)
    if (boldMatch) {
      tokens.push(<strong key={`b-${keyIndex++}`}>{boldMatch[1]}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // 3. Italic *text*
    const italicMatch = remaining.match(/^\*([^*]+)\*/)
    if (italicMatch) {
      tokens.push(<em key={`i-${keyIndex++}`}>{italicMatch[1]}</em>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // 4. Regular text chunk until next special character
    const nextSpecial = remaining.search(/[`*]/)
    if (nextSpecial === -1) {
      tokens.push(remaining)
      break
    } else if (nextSpecial === 0) {
      // Just a lone character without a closing pair
      tokens.push(remaining[0])
      remaining = remaining.slice(1)
    } else {
      tokens.push(remaining.slice(0, nextSpecial))
      remaining = remaining.slice(nextSpecial)
    }
  }

  return tokens
}

/**
 * MarkdownContent
 *
 * Robust, accessible rendering for journal entries, notes, and bullet tasks.
 * Preserves paragraphs, line breaks, lists, headings, and formatting.
 */
export function MarkdownContent({ content = '', compact = false, className = '' }) {
  if (!content || !content.trim()) {
    return <span className="empty-content-placeholder" style={{ color: 'var(--text-dimmed)', fontStyle: 'italic' }}>No content recorded.</span>
  }

  if (compact) {
    // Extract first 3 non-empty lines for snippet
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 3)

    return (
      <div
        className={`entry-content-preview ${className}`}
        style={{
          margin: '6px 0 10px 0',
          fontSize: '14px',
          color: 'var(--text-secondary)',
          lineHeight: '1.55',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          wordBreak: 'break-word',
        }}
      >
        {lines.map((l, idx) => (
          <div key={idx} style={{ marginBottom: idx < lines.length - 1 ? '2px' : 0 }}>
            {renderInline(l)}
          </div>
        ))}
      </div>
    )
  }

  // Full formatted document parsing
  const rawLines = content.split('\n')
  const blocks = []
  let currentList = null
  let listType = null // 'ul' | 'ol'
  let inCodeBlock = false
  let codeBlockLines = []
  let blockKey = 0

  function flushList() {
    if (currentList && currentList.length > 0) {
      if (listType === 'ol') {
        blocks.push(
          <ol key={`ol-${blockKey++}`} className="md-ol">
            {currentList.map((item, idx) => (
              <li key={idx}>{renderInline(item)}</li>
            ))}
          </ol>
        )
      } else {
        blocks.push(
          <ul key={`ul-${blockKey++}`} className="md-ul">
            {currentList.map((item, idx) => (
              <li key={idx}>{renderInline(item)}</li>
            ))}
          </ul>
        )
      }
      currentList = null
      listType = null
    }
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    const trimmed = line.trim()

    // Handle code blocks ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push(
          <pre key={`pre-${blockKey++}`} className="md-pre">
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        )
        codeBlockLines = []
        inCodeBlock = false
      } else {
        flushList()
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(line)
      continue
    }

    // Blank line -> Paragraph separator
    if (!trimmed) {
      flushList()
      continue
    }

    // Headings (# , ## , ### , ####)
    if (trimmed.startsWith('#### ')) {
      flushList()
      blocks.push(
        <h5 key={`h5-${blockKey++}`} className="md-h3">
          {renderInline(trimmed.slice(5))}
        </h5>
      )
      continue
    }
    if (trimmed.startsWith('### ')) {
      flushList()
      blocks.push(
        <h4 key={`h4-${blockKey++}`} className="md-h3">
          {renderInline(trimmed.slice(4))}
        </h4>
      )
      continue
    }
    if (trimmed.startsWith('## ')) {
      flushList()
      blocks.push(
        <h3 key={`h3-${blockKey++}`} className="md-h2">
          {renderInline(trimmed.slice(3))}
        </h3>
      )
      continue
    }
    if (trimmed.startsWith('# ')) {
      flushList()
      blocks.push(
        <h2 key={`h2-${blockKey++}`} className="md-h1">
          {renderInline(trimmed.slice(2))}
        </h2>
      )
      continue
    }

    // Blockquote (> )
    if (trimmed.startsWith('> ')) {
      flushList()
      blocks.push(
        <blockquote key={`quote-${blockKey++}`} className="md-quote">
          {renderInline(trimmed.slice(2))}
        </blockquote>
      )
      continue
    }

    // Task checkbox items (- [ ] or - [x] or * [ ])
    const taskMatch = trimmed.match(/^[-*•]\s*\[([ xX])\]\s*(.*)$/)
    if (taskMatch) {
      flushList()
      const isChecked = taskMatch[1].toLowerCase() === 'x'
      blocks.push(
        <div key={`task-${blockKey++}`} className={`md-task-item ${isChecked ? 'completed' : ''}`}>
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
            className="md-checkbox"
          />
          <span className={isChecked ? 'strikethrough' : ''}>
            {renderInline(taskMatch[2])}
          </span>
        </div>
      )
      continue
    }

    // Bullet list items (- , * , • , + )
    if (/^[-*•+]\s+/.test(trimmed)) {
      if (listType !== 'ul') {
        flushList()
        listType = 'ul'
        currentList = []
      }
      currentList.push(trimmed.replace(/^[-*•+]\s+/, ''))
      continue
    }

    // Numbered list items (1. or 1) )
    const olMatch = trimmed.match(/^(\d+)[.)]\s+(.*)$/)
    if (olMatch) {
      if (listType !== 'ol') {
        flushList()
        listType = 'ol'
        currentList = []
      }
      currentList.push(olMatch[2])
      continue
    }

    // Standard paragraph line (preserves line breaks and formatting)
    flushList()
    blocks.push(
      <p key={`p-${blockKey++}`} className="md-p">
        {renderInline(line)}
      </p>
    )
  }

  // Flush any remaining list or code block
  flushList()
  if (inCodeBlock && codeBlockLines.length > 0) {
    blocks.push(
      <pre key={`pre-${blockKey++}`} className="md-pre">
        <code>{codeBlockLines.join('\n')}</code>
      </pre>
    )
  }

  return <div className={`markdown-body ${className}`}>{blocks}</div>
}

export default MarkdownContent
