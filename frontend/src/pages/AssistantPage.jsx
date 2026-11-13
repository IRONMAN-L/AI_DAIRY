import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Bot,
  CornerDownRight,
  Eye,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react'
import { useAssistant } from '../context/AssistantContext'
import entriesService from '../services/entriesService'
import { formatDisplayDate } from '../utils/dateUtils'
import EntryDetailModal from '../components/common/EntryDetailModal'
import MarkdownContent from '../components/common/MarkdownContent'

const PROMPT_SUGGESTIONS = [
  'What tasks did I postpone or migrate recently?',
  'What are my current open tasks?',
  'Summarize my recent journal notes and reflections.',
  'What goals or plans did I write about?',
  'What topics appear frequently in my diary?',
]

function AssistantPage() {
  const navigate = useNavigate()
  const {
    messages,
    input,
    setInput,
    loading,
    error,
    sendMessage,
    clearConversation,
  } = useAssistant()

  const [modalEntry, setModalEntry] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)

  const chatBottomRef = useRef(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  async function handleOpenCitation(citation) {
    try {
      setModalLoading(true)
      const fullEntry = await entriesService.getEntryById(citation.entry_id)
      setModalEntry(fullEntry)
      setModalOpen(true)
    } catch {
      // If fetching full entry fails, open minimal representation from citation
      setModalEntry({
        id: citation.entry_id,
        title: citation.title || 'Referenced Journal Entry',
        content: citation.snippet || '',
        entry_date: citation.entry_date,
        entry_type: 'event',
        status: 'open',
      })
      setModalOpen(true)
    } finally {
      setModalLoading(false)
    }
  }

  return (
    <>
      <div className="welcome">
        <div>
          <p className="eyebrow">GROUNDED INTELLIGENCE</p>
          <h1>AI Diary Assistant</h1>
          <p className="subtitle">
            Converse with your personal archives. Answers are retrieved directly from your entries with verified citations. Your conversation stays active as you navigate between sections.
          </p>
        </div>
        <div className="welcome-icon">
          <Sparkles size={34} />
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Main Persistent Chat Container */}
      <section
        className="panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 250px)',
          minHeight: '580px',
          padding: '0',
          overflow: 'hidden',
        }}
      >
        {/* Chat Header Toolbar */}
        <div
          style={{
            padding: '14px 22px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--primary-subtle)',
                color: 'var(--primary)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Bot size={18} />
            </div>
            <div>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Daybook Personal Knowledge Agent
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                }}
              >
                Grounded via semantic and lexical search
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={clearConversation}
            style={{ fontSize: '13px', padding: '6px 12px' }}
            title="Reset conversation history"
          >
            <Trash2 size={14} />
            <span>Clear Chat</span>
          </button>
        </div>

        {/* Messages Feed */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {messages.map((m) => {
            const isUser = m.role === 'user'

            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: isUser ? '80%' : '88%',
                }}
              >
                {!isUser && (
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--primary-subtle)',
                      color: 'var(--primary)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={18} />
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  {/* Bubble */}
                  <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}>
                    {isUser ? (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                    ) : (
                      <MarkdownContent content={m.content} />
                    )}
                  </div>

                  {/* Citations Box */}
                  {!isUser && m.citations && m.citations.length > 0 && (
                    <div className="citations-box">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: 'var(--primary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '10px',
                        }}
                      >
                        <BookOpen size={14} />
                        Grounded References ({m.citations.length})
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {m.citations.map((c) => (
                          <div key={c.entry_id} className="citation-item">
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '4px',
                              }}
                            >
                              <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                                {c.title || 'Untitled Entry'}
                              </strong>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {formatDisplayDate(c.entry_date)}
                              </span>
                            </div>

                            <p
                              style={{
                                margin: '0 0 8px 0',
                                color: 'var(--text-secondary)',
                                fontSize: '12.5px',
                                lineHeight: '1.5',
                              }}
                            >
                              {c.snippet}
                            </p>

                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="btn-tiny"
                                onClick={() => handleOpenCitation(c)}
                                disabled={modalLoading}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Open full entry reader"
                              >
                                <Eye size={12} />
                                <span>Read Full Entry</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => navigate(`/journal?date=${c.entry_date}`)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  border: 0,
                                  background: 'transparent',
                                  color: 'var(--primary)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  padding: 0,
                                  cursor: 'pointer',
                                }}
                              >
                                <span>Go to Day Log</span>
                                <ArrowRight size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isUser && m.model && m.model !== 'assistant' && (
                    <small
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-dimmed)',
                        alignSelf: 'flex-start',
                        marginTop: '2px',
                      }}
                    >
                      Engine: {m.model}
                    </small>
                  )}
                </div>

                {isUser && (
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--primary)',
                      color: '#ffffff',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <User size={18} />
                  </div>
                )}
              </div>
            )
          })}

          {loading && (
            <div
              style={{
                display: 'flex',
                gap: '12px',
                alignSelf: 'flex-start',
                alignItems: 'center',
                padding: '12px 18px',
                backgroundColor: 'var(--primary-subtle)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--primary)',
                fontSize: '14px',
                border: '1px solid var(--primary-border)',
              }}
            >
              <Loader2 size={16} className="animate-spin" />
              <span>Synthesizing answer from personal diary records...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Prompt Suggestions */}
        <div
          style={{
            padding: '10px 18px',
            backgroundColor: 'var(--bg-subtle)',
            borderTop: '1px solid var(--border-default)',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          {PROMPT_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="btn btn-secondary"
              onClick={() => sendMessage(suggestion)}
              disabled={loading}
              style={{
                fontSize: '12px',
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                flexShrink: 0,
              }}
            >
              <CornerDownRight size={12} />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          <input
            type="text"
            placeholder="Ask about your diary entries or tasks (e.g. 'What did I plan last week?')..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{ padding: '10px 22px' }}
          >
            <Send size={15} />
            <span>Ask</span>
          </button>
        </div>
      </section>

      {/* Reusable Universal Journal Entry Reader Modal for Citations */}
      <EntryDetailModal
        entry={modalEntry}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setModalEntry(null)
        }}
      />
    </>
  )
}

export default AssistantPage
