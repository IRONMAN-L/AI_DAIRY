import { useState } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { getNextDate, isValidDateString } from '../../utils/dateUtils'

function MigrationModal({ task, onClose, onConfirm }) {
  const [targetDate, setTargetDate] = useState(() =>
    task ? getNextDate(task.entry_date) : ''
  )
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!task) return null

  const originalDate = task.entry_date

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isValidDateString(targetDate)) {
      setError('Please provide a valid date in YYYY-MM-DD format.')
      return
    }

    if (targetDate <= originalDate) {
      setError('The target date must be strictly after the current date.')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      await onConfirm(task.id, targetDate)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to migrate task.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          boxShadow: 'var(--shadow-modal)',
          padding: '24px',
        }}
      >
        <div className="panel-heading" style={{ marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', margin: 0 }}>Migrate Task</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
              Push &ldquo;{task.title || 'Untitled task'}&rdquo; forward.
            </p>
          </div>
          <button
            className="icon-btn"
            onClick={onClose}
            type="button"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {error && <div className="error" style={{ marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
          <div>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Current Date: <strong>{originalDate}</strong>
            </span>
          </div>

          <div>
            <label htmlFor="target-migration-date">New Target Date:</label>
            <input
              id="target-migration-date"
              type="date"
              min={getNextDate(originalDate)}
              value={targetDate}
              onChange={(e) => {
                setTargetDate(e.target.value)
                setError('')
              }}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              <CalendarDays size={15} />
              <span>{submitting ? 'Migrating...' : 'Confirm Migration'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default MigrationModal
