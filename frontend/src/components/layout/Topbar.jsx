import { Link, useLocation } from 'react-router-dom'
import { CalendarDays, Moon, PenLine, Sun } from 'lucide-react'
import { formatDisplayDate, getToday } from '../../utils/dateUtils'
import { useTheme } from '../../context/ThemeContext'

function getSectionName(pathname) {
  if (pathname === '/') return 'Overview & Analytics'
  if (pathname.startsWith('/editor')) return 'Journal Studio Editor'
  if (pathname.startsWith('/journal')) return 'Daily Journal'
  if (pathname.startsWith('/tasks')) return 'Bullet Journal & Tasks'
  if (pathname.startsWith('/calendar')) return 'Monthly Calendar'
  if (pathname.startsWith('/search')) return 'Knowledge Base & Search'
  if (pathname.startsWith('/assistant')) return 'AI Diary Assistant'
  if (pathname.startsWith('/settings')) return 'Settings & Data Portability'
  return 'Personal Journal'
}

function Topbar() {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const section = getSectionName(location.pathname)
  const todayFormatted = formatDisplayDate(getToday())
  const isEditorPage = location.pathname.startsWith('/editor')

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-section-title">{section}</span>
      </div>

      <div className="topbar-right">
        {!isEditorPage && (
          <Link to="/editor" className="btn btn-primary" title="Open Full-Page Journal Editor">
            <PenLine size={15} />
            <span>Write Entry</span>
          </Link>
        )}

        <span className="today" title="Today's Date">
          <CalendarDays size={15} />
          <span>{todayFormatted}</span>
        </span>

        <button
          type="button"
          className="theme-toggle-btn"
          onClick={() => toggleTheme()}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  )
}

export default Topbar
