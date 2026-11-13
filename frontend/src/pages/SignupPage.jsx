import { useState } from 'react'
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { BookOpen, Eye, EyeOff, Loader2, Moon, Sun, AlertCircle, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { getErrorMessage } from '../services/api'

export default function SignupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signup, isAuthenticated, isLoading } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isAuthenticated && !isLoading) {
    const from = location.state?.from?.pathname || '/'
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setError('Please enter your email address.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both fields.')
      return
    }

    setSubmitting(true)
    try {
      await signup(cleanEmail, password, fullName.trim() || null)
      navigate('/', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Sign up failed. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <button
        type="button"
        className="auth-theme-toggle"
        onClick={() => toggleTheme()}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label="Toggle color theme"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand">
            <div className="auth-brand-icon">
              <BookOpen size={24} />
            </div>
            <span className="auth-brand-name">Daybook</span>
          </div>
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">
            Start keeping your thoughts, tasks, and memories organized in private.
          </p>
        </div>

        {/* Data preservation assurance banner */}
        <div className="auth-alert-info" style={{ marginBottom: '16px' }}>
          <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--primary)' }} />
          <span>
            <strong>Data preserved:</strong> Any existing journal entries or tasks will be automatically linked to your new account.
          </span>
        </div>

        {error && (
          <div className="auth-alert-error" role="alert" style={{ marginBottom: '16px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="auth-field">
            <label htmlFor="signup-name" className="auth-label">
              Full Name <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              placeholder="Alex Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="signup-email" className="auth-label">
              Email Address
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="signup-password" className="auth-label">
              Password <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>(Min 6 characters)</span>
            </label>
            <div className="auth-input-wrapper">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Choose a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="signup-confirm-password" className="auth-label">
              Confirm Password
            </label>
            <div className="auth-input-wrapper">
              <input
                id="signup-confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="auth-btn-submit"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

