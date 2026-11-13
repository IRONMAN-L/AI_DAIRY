import {
  BookOpen,
  CalendarDays,
  Check,
  CornerDownRight,
  Eye,
  FileText,
  History,
  ListTodo,
  Pencil,
  Trash2,
} from 'lucide-react'
import { getEntryTypeLabel, getSourceLabel, getStatusLabel } from '../utils/entryUtils'
import { formatDisplayDate } from '../utils/dateUtils'
import MarkdownContent from './common/MarkdownContent'

function getEntryIcon(type) {
  switch (type) {
    case 'task':
      return <ListTodo size={18} />
    case 'note':
      return <FileText size={18} />
    default:
      return <BookOpen size={18} />
  }
}

function EntryCard({
  result,
  entry,
  completeTask,
  onToggleDone,
  migrateTask,
  onMigrate,
  showTaskHistory,
  onShowHistory,
  historyLoading,
  editEntry,
  onEdit,
  deleteEntry,
  onDelete,
  onView,
}) {
  const item = result?.entry ?? result ?? entry ?? null
  if (!item || !item.id) return null

  const isDone = item.status === 'done'
  const isMigrated = item.status === 'migrated'

  const handleToggle = completeTask || onToggleDone
  const handleMigrate = migrateTask || onMigrate
  const handleHistory = showTaskHistory || onShowHistory
  const handleEdit = editEntry || onEdit
  const handleDelete = deleteEntry || onDelete

  function handleCardClick(e) {
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return
    if (onView) {
      onView(item)
    }
  }

  function handleCardDoubleClick(e) {
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return
    if (handleEdit && !isMigrated) {
      handleEdit(item)
    } else if (onView) {
      onView(item)
    }
  }

  return (
    <article
      className="entry"
      onClick={handleCardClick}
      onDoubleClick={handleCardDoubleClick}
      title="Click to view details, double-click to edit"
      style={{ cursor: 'pointer' }}
    >
      <div
        className="entry-marker"
        style={{
          backgroundColor: isDone
            ? 'var(--color-success-bg)'
            : isMigrated
            ? 'var(--bg-muted)'
            : 'var(--primary-subtle)',
          color: isDone
            ? 'var(--color-success)'
            : isMigrated
            ? 'var(--text-muted)'
            : 'var(--primary)',
          border: `1px solid ${
            isDone
              ? 'var(--color-success-border)'
              : isMigrated
              ? 'var(--border-subtle)'
              : 'var(--primary-border)'
          }`,
        }}
      >
        {getEntryIcon(item.entry_type)}
      </div>

      <div className="entry-info">
        <h3 className={isDone ? 'done-title' : ''}>
          {item.title || 'Untitled entry'}
        </h3>

        {/* Structured markdown snippet preserving lines and formatting */}
        <MarkdownContent content={item.content} compact={true} />

        <div className="entry-meta-line">
          <span>{formatDisplayDate(item.entry_date)}</span>
          <span>•</span>
          <span className={`entry-badge badge-${item.entry_type}`}>
            {getEntryTypeLabel(item.entry_type)}
          </span>
          <span>•</span>
          <span className={`entry-badge badge-status status-${item.status}`}>
            {getStatusLabel(item.status)}
          </span>

          {item.source && item.source !== 'typed' && (
            <span className="entry-badge badge-source">
              {getSourceLabel(item.source)}
            </span>
          )}
        </div>

        {item.original_date && item.original_date !== item.entry_date && (
          <small
            className="migration-info"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--text-muted)',
              fontSize: '12px',
              marginTop: '4px',
            }}
          >
            <CornerDownRight size={13} />
            <span>Original date: {formatDisplayDate(item.original_date)}</span>
          </small>
        )}

        {item.completed_at && (
          <small
            style={{
              color: 'var(--color-success)',
              display: 'block',
              marginTop: '3px',
              fontWeight: 600,
              fontSize: '12px',
            }}
          >
            Completed on {item.completed_at.slice(0, 10)}
          </small>
        )}

        {isMigrated && (
          <small
            style={{
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              display: 'block',
              marginTop: '3px',
              fontSize: '12px',
            }}
          >
            Migrated forward (preserved as read-only)
          </small>
        )}
      </div>

      <div className="entry-actions" onClick={(e) => e.stopPropagation()}>
        {onView && (
          <button
            className="icon-btn"
            type="button"
            title="Read full entry details"
            onClick={() => onView(item)}
          >
            <Eye size={17} />
          </button>
        )}

        {item.entry_type === 'task' && (
          <>
            {item.status === 'open' && (
              <>
                {handleToggle && (
                  <button
                    className="icon-btn"
                    type="button"
                    title="Mark task completed"
                    onClick={() => handleToggle(item)}
                  >
                    <Check size={17} />
                  </button>
                )}

                {handleMigrate && (
                  <button
                    className="icon-btn"
                    type="button"
                    title="Migrate task to future date"
                    onClick={() => handleMigrate(item)}
                  >
                    <CalendarDays size={17} />
                  </button>
                )}
              </>
            )}

            {handleHistory && (
              <button
                className="icon-btn"
                type="button"
                title="View task migration lineage history"
                onClick={() => handleHistory(item)}
                disabled={historyLoading}
              >
                <History size={17} />
              </button>
            )}
          </>
        )}

        {item.status !== 'migrated' && handleEdit && (
          <button
            className="icon-btn"
            type="button"
            title="Edit entry in Journal Editor"
            onClick={() => handleEdit(item)}
          >
            <Pencil size={17} />
          </button>
        )}

        {handleDelete && (
          <button
            className="delete-btn"
            type="button"
            title="Delete entry"
            onClick={() => handleDelete(item)}
          >
            <Trash2 size={17} />
          </button>
        )}
      </div>
    </article>
  )
}

export default EntryCard
