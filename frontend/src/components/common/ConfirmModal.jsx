import { AlertTriangle, X } from 'lucide-react'

function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Delete',
  confirmVariant = 'danger',
  onConfirm,
  onClose,
  loading = false,
}) {
  if (!isOpen) return null

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
        <div className="panel-heading" style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle
              size={22}
              style={{
                color: confirmVariant === 'danger' ? 'var(--color-danger)' : 'var(--primary)',
                flexShrink: 0,
              }}
            />
            <h2 style={{ fontSize: '18px', margin: 0 }}>{title}</h2>
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

        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '14px 0 24px', lineHeight: 1.6 }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${confirmVariant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

export default ConfirmModal
