import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  CheckCircle,
  CornerDownRight,
  Edit3,
  FileText,
  History,
  ListTodo,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import MarkdownContent from './MarkdownContent'
import {
  getEntryTypeLabel,
  getSourceLabel,
  getStatusLabel,
} from '../../utils/entryUtils'
import { formatDisplayDate } from '../../utils/dateUtils'

export function EntryDetailModal({
  entry,
  isOpen = true,
  onClose,
  onEdit,
  onDelete,
  onToggleDone,
  onMigrate,
  onShowHistory,
}) {
  const navigate = useNavigate()

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose?.()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen || !entry) return null

  const isTask = entry.entry_type === 'task'
  const isDone = entry.status === 'done'
  const isMigrated = entry.status === 'migrated'

  function handleEditClick() {
    onClose?.()
    if (onEdit) {
      onEdit(entry)
    } else {
      navigate(`/editor/${entry.id}`)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container entry-reader-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reader-entry-title"
      >
        {/* Header Action Bar */}
        <div className="entry-reader-header">
          <div className="entry-reader-meta">
            <span className={`entry-badge badge-${entry.entry_type}`}>
              {isTask ? (
                <ListTodo size={14} />
              ) : entry.entry_type === 'note' ? (
                <FileText size={14} />
              ) : (
                <BookOpen size={14} />
              )}
              <span>{getEntryTypeLabel(entry.entry_type)}</span>
            </span>

            <span className={`entry-badge badge-status status-${entry.status}`}>
              {getStatusLabel(entry.status)}
            </span>

            {entry.source && entry.source !== 'typed' && (
              <span className="entry-badge badge-source">
                {getSourceLabel(entry.source)}
              </span>
            )}
          </div>

          <button
            type="button"
            className="icon-btn close-btn"
            onClick={onClose}
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Entry Reader Content */}
        <div className="entry-reader-body">
          <h1
            id="reader-entry-title"
            className={`entry-reader-title ${isDone ? 'strikethrough text-muted' : ''}`}
          >
            {entry.title || 'Untitled Entry'}
          </h1>

          <div className="entry-reader-timestamps">
            <span className="date-tag">
              <CalendarDays size={14} />
              {formatDisplayDate(entry.entry_date)}
            </span>

            {entry.completed_at && (
              <span className="date-tag done-tag">
                <CheckCircle size={14} />
                Completed on {entry.completed_at.slice(0, 10)}
              </span>
            )}

            {entry.original_date && entry.original_date !== entry.entry_date && (
              <span className="date-tag migration-tag">
                <CornerDownRight size={14} />
                Migrated from {entry.original_date}
              </span>
            )}
          </div>

          {/* Formatted Content */}
          <div className="entry-reader-markdown">
            <MarkdownContent content={entry.content} />
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="entry-reader-footer">
          <div className="footer-left">
            {isTask && !isMigrated && onToggleDone && (
              <button
                type="button"
                className={`btn ${isDone ? 'btn-secondary' : 'btn-success'}`}
                onClick={() => {
                  onToggleDone(entry)
                }}
              >
                {isDone ? (
                  <>
                    <RotateCcw size={15} />
                    <span>Reopen Task</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={15} />
                    <span>Mark as Complete</span>
                  </>
                )}
              </button>
            )}

            {isTask && !isDone && !isMigrated && onMigrate && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  onClose?.()
                  onMigrate(entry)
                }}
              >
                <CornerDownRight size={15} />
                <span>Migrate to Another Date</span>
              </button>
            )}

            {isTask && (entry.parent_id || isMigrated) && onShowHistory && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  onClose?.()
                  onShowHistory(entry)
                }}
              >
                <History size={15} />
                <span>Lineage History</span>
              </button>
            )}
          </div>

          <div className="footer-right">
            {!isMigrated && (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleEditClick}
                >
                  <Edit3 size={15} />
                  <span>Edit in Journal Editor</span>
                </button>

                {onDelete && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      onClose?.()
                      onDelete(entry)
                    }}
                    title="Delete entry"
                  >
                    <Trash2 size={15} />
                    <span>Delete</span>
                  </button>
                )}
              </>
            )}

            {isMigrated && (
              <span className="migrated-notice">
                This entry was migrated and is preserved as an immutable historical record.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default EntryDetailModal

