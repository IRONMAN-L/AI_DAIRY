import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Calendar,
  LayoutDashboard,
  ListTodo,
  LogOut,
  PenLine,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/journal', label: 'Daily Journal', icon: BookOpen },
  { to: '/tasks', label: 'Tasks & Bullets', icon: ListTodo },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/assistant', label: 'AI Assistant', icon: Sparkles },
  { to: '/settings', label: 'Settings & Data', icon: Settings },
]

function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const displayName = user?.full_name || (user?.email ? user.email.split('@')[0] : 'My Diary')
  const displayEmail = user?.email || 'Personal & Secure'
  const initial = displayName.charAt(0).toUpperCase() || 'D'

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="sidebar">
      <Link to="/" className="brand" style={{ textDecoration: 'none' }}>
        <div className="brand-icon">
          <BookOpen size={22} />
        </div>
        <span>Daybook</span>
      </Link>

      <Link to="/editor" className="sidebar-write-btn" title="Create a new journal entry">
        <PenLine size={16} />
        <span>Write Entry</span>
      </Link>

      <div className="nav-label">WORKSPACE</div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="profile-avatar" title={displayName}>
          {initial}
        </div>
        <div className="sidebar-bottom-info">
          <strong title={displayName}>{displayName}</strong>
          <small title={displayEmail}>{displayEmail}</small>
        </div>
        <button
          type="button"
          className="profile-logout-btn"
          onClick={handleLogout}
          title="Sign out of Daybook"
          aria-label="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
