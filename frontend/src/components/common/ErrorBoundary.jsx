import { Component } from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled render error:', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            maxWidth: '560px',
            margin: '40px auto',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            borderRadius: 'var(--radius-lg, 12px)',
            border: '1px solid var(--border-default, #e5e7eb)',
            boxShadow: 'var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1))',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-danger-subtle, #fef2f2)',
              color: 'var(--color-danger, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
            }}
          >
            <AlertTriangle size={26} />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
            Something went wrong
          </h2>

          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected rendering error occurred. You can safely return to the dashboard.'}
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={this.handleReload}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={15} />
              <span>Try Again</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={this.handleGoHome}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Home size={15} />
              <span>Return Home</span>
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

