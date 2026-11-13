import {
  ArrowDown,
  CheckCircle2,
  Clock,
  CornerDownRight,
  X,
} from 'lucide-react'
import { getStatusLabel } from '../utils/entryUtils'
import { formatDisplayDate } from '../utils/dateUtils'

function TaskHistoryModal({ history, onClose }) {
  if (!history) return null

  const items = Array.isArray(history.items) ? history.items : []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="panel"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-modal)',
          padding: '24px',
        }}
      >
        <div className="panel-heading" style={{ marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', margin: 0 }}>Bullet Journal Migration Lineage</h2>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 0' }}>
              &ldquo;{history.title}&rdquo;
            </p>
          </div>

          <button
            className="icon-btn"
            onClick={onClose}
            type="button"
            aria-label="Close task history"
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
          This timeline traces the complete migration chain from the original task
          down to the latest forward-migrated copy.
        </p>

        {items.length === 0 ? (
          <p className="empty">No migration records found.</p>
        ) : (
          <div style={{ position: 'relative', margin: '15px 0 25px 8px' }}>
            {items.map((item, index) => {
              const isRoot = index === 0
              const isLatest = index === items.length - 1
              const isDone = item.status === 'done'
              const isMigrated = item.status === 'migrated'

              return (
                <div
                  key={item.id}
                  style={{
                    position: 'relative',
                    paddingLeft: '32px',
                    paddingBottom: isLatest ? '5px' : '24px',
                  }}
                >
                  {/* Vertical connecting line */}
                  {!isLatest && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '11px',
                        top: '22px',
                        bottom: '0',
                        width: '2px',
                        backgroundColor: 'var(--border-default)',
                      }}
                    />
                  )}

                  {/* Node icon */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '0',
                      top: '2px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: isDone
                        ? 'var(--color-success)'
                        : isMigrated
                        ? 'var(--bg-muted)'
                        : 'var(--primary)',
                      color: isDone || !isMigrated ? '#ffffff' : 'var(--text-muted)',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      zIndex: 1,
                    }}
                  >
                    {isDone ? (
                      <CheckCircle2 size={14} />
                    ) : isMigrated ? (
                      <ArrowDown size={14} />
                    ) : (
                      <Clock size={14} />
                    )}
                  </div>

                  {/* Content card */}
                  <div
                    style={{
                      backgroundColor: isLatest ? 'var(--primary-subtle)' : 'var(--bg-subtle)',
                      border: isLatest ? '1.5px solid var(--primary-border)' : '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {formatDisplayDate(item.entry_date)}
                      </span>
                      <span
                        className={`entry-badge badge-status status-${item.status}`}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    </div>

                    <p style={{ margin: '4px 0 8px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                      {item.content}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        flexWrap: 'wrap',
                      }}
                    >
                      {isRoot ? (
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                          * Original entry on {formatDisplayDate(item.entry_date)}
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CornerDownRight size={13} />
                          Migrated from {formatDisplayDate(item.original_date || 'earlier copy')}
                        </span>
                      )}

                      {item.completed_at && (
                        <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                          Completed on {item.completed_at.slice(0, 10)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </section>
    </div>
  )
}

export default TaskHistoryModal
