import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CheckCircle2,
  Clock,
  ListTodo,
  PenLine,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import EntryForm from '../components/EntryForm'
import EntryCard from '../components/EntryCard'
import TaskHistoryModal from '../components/TaskHistoryModal'
import MigrationModal from '../components/common/MigrationModal'
import ConfirmModal from '../components/common/ConfirmModal'
import EntryDetailModal from '../components/common/EntryDetailModal'
import entriesService from '../services/entriesService'
import journalService from '../services/journalService'
import searchService from '../services/searchService'
import { getErrorMessage } from '../services/api'
import {
  getStartOfWeek,
  getToday,
} from '../utils/dateUtils'

function emptyForm() {
  return {
    title: '',
    content: '',
    entry_date: getToday(),
    entry_type: 'event',
    status: 'open',
    source: 'typed',
  }
}

function DashboardPage() {
  const navigate = useNavigate()
  const today = getToday()

  // State
  const [entries, setEntries] = useState([])
  const [upcomingTasks, setUpcomingTasks] = useState([])
  const [weeklyActivity, setWeeklyActivity] = useState([])
  const [activeView, setActiveView] = useState('recent') // 'recent' | 'upcoming'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  // Form & editing
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  // Real backend statistics
  const [stats, setStats] = useState({
    totalEntries: 0,
    openTasks: 0,
    completedTasks: 0,
    completionPercentage: 0,
    todayTotal: 0,
    todayCompleted: 0,
  })

  // Modals state
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [readerOpen, setReaderOpen] = useState(false)
  const [historyModalData, setHistoryModalData] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [migratingTask, setMigratingTask] = useState(null)
  const [deletingEntry, setDeletingEntry] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const reload = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    let ignore = false

    async function fetchDashboard() {
      try {
        const startOfWeek = getStartOfWeek(today)

        const [
          recentEntries,
          todayJournal,
          weeklyRes,
          upcomingTasksRes,
          allOpenTasks,
          allDoneTasks,
        ] = await Promise.all([
          entriesService.getEntries({ limit: 50 }),
          journalService.getDailyJournal(today).catch(() => null),
          journalService.getWeeklyStatistics(startOfWeek).catch(() => null),
          entriesService.getEntries({
            entry_type: 'task',
            status: 'open',
            start_date: today,
            limit: 20,
          }),
          entriesService.getEntries({ entry_type: 'task', status: 'open', limit: 100 }),
          entriesService.getEntries({ entry_type: 'task', status: 'done', limit: 100 }),
        ])

        if (!ignore) {
          const entryList = Array.isArray(recentEntries) ? recentEntries : []
          setEntries(entryList)

          const upcomingList = Array.isArray(upcomingTasksRes) ? upcomingTasksRes : []
          setUpcomingTasks(upcomingList)

          // Weekly strip
          if (weeklyRes && Array.isArray(weeklyRes.days)) {
            setWeeklyActivity(weeklyRes.days)
          }

          // Compute accurate stats
          const openCount = Array.isArray(allOpenTasks) ? allOpenTasks.length : 0
          const doneCount = Array.isArray(allDoneTasks) ? allDoneTasks.length : 0
          const totalTasks = openCount + doneCount
          const completionPct =
            totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0

          const todayEntries = todayJournal?.entries || []
          const todayCompleted = todayJournal?.statistics?.completed_tasks || 0

          setStats({
            totalEntries: entryList.length,
            openTasks: openCount,
            completedTasks: doneCount,
            completionPercentage: completionPct,
            todayTotal: todayEntries.length,
            todayCompleted,
          })

          setError('')
          setLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          setError(getErrorMessage(err, 'Failed to load dashboard metrics.'))
          setLoading(false)
        }
      }
    }

    fetchDashboard()

    return () => {
      ignore = true
    }
  }, [today, refreshKey])

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function resetForm() {
    setForm(emptyForm())
    setEditingId(null)
    setError('')
  }

  async function handleSaveEntry(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and content are required.')
      return
    }

    try {
      setSaving(true)
      setError('')

      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        entry_date: form.entry_date,
        entry_type: form.entry_type,
        status: form.entry_type === 'task' ? form.status : 'open',
        source: form.source || 'typed',
      }

      if (editingId !== null) {
        await entriesService.updateEntry(editingId, payload)
      } else {
        await entriesService.createEntry(payload)
      }

      resetForm()
      reload()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save entry.'))
    } finally {
      setSaving(false)
    }
  }

  function handleViewEntry(entry) {
    setSelectedEntry(entry)
    setReaderOpen(true)
  }

  function handleEditEntry(entry) {
    if (entry.status === 'migrated') {
      setError('Migrated entries are read-only.')
      return
    }
    navigate(`/editor/${entry.id}`)
  }

  async function confirmDelete() {
    if (!deletingEntry) return
    try {
      setDeleteLoading(true)
      setError('')
      await entriesService.deleteEntry(deletingEntry.id)
      if (editingId === deletingEntry.id) {
        resetForm()
      }
      if (selectedEntry?.id === deletingEntry.id) {
        setReaderOpen(false)
        setSelectedEntry(null)
      }
      setDeletingEntry(null)
      reload()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete entry.'))
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleCompleteTask(entry) {
    try {
      const newStatus = entry.status === 'done' ? 'open' : 'done'
      setError('')
      await entriesService.updateEntry(entry.id, { status: newStatus })
      if (selectedEntry?.id === entry.id) {
        setSelectedEntry((prev) => ({ ...prev, status: newStatus }))
      }
      reload()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update task.'))
    }
  }

  async function confirmMigrate(taskId, targetDate) {
    await entriesService.migrateTask(taskId, targetDate)
    setMigratingTask(null)
    if (selectedEntry?.id === taskId) {
      setReaderOpen(false)
      setSelectedEntry(null)
    }
    reload()
  }

  async function handleShowTaskHistory(entry) {
    try {
      setHistoryLoading(true)
      setError('')
      const items = await entriesService.getTaskHistory(entry.id)
      setHistoryModalData({ title: entry.title, items })
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load task history.'))
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) {
      reload()
      return
    }

    try {
      setLoading(true)
      setError('')
      const results = await searchService.searchKeyword({ q: query.trim() })
      const matched = (results.results || []).map((r) => r.entry ?? r)
      setEntries(matched)
      setActiveView('recent')
    } catch (err) {
      setError(getErrorMessage(err, 'Search filter failed.'))
    } finally {
      setLoading(false)
    }
  }

  function handleClearSearch() {
    setQuery('')
    reload()
  }

  const displayedList = activeView === 'recent' ? entries : upcomingTasks

  return (
    <>
      {/* Welcome Banner */}
      <div className="welcome">
        <div>
          <p className="eyebrow">YOUR PERSONAL PRODUCTIVITY HUB</p>
          <h1>Good day.</h1>
          <p className="subtitle">
            Reflect on your thoughts, manage bullet journal commitments, and organize personal archives with ease.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/editor')}
            style={{ padding: '10px 18px', fontSize: '14px' }}
          >
            <PenLine size={16} />
            <span>Open Journal Studio</span>
          </button>
        </div>
      </div>

      {/* Real Statistics Cards */}
      <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '22px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span>Total Entries</span>
            <BookOpen size={18} />
          </div>
          <strong>{stats.totalEntries}</strong>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span>Open Tasks</span>
            <Clock size={18} />
          </div>
          <strong>{stats.openTasks}</strong>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span>Completed Tasks</span>
            <CheckCircle2 size={18} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <strong>{stats.completedTasks}</strong>
            <small style={{ color: 'var(--color-success)', fontWeight: 600 }}>
              ({stats.completionPercentage}%)
            </small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span>Today&apos;s Activity</span>
            <Sparkles size={18} />
          </div>
          <strong>{stats.todayTotal} items</strong>
        </div>
      </div>

      {/* Weekly Activity Strip */}
      {weeklyActivity.length > 0 && (
        <section
          className="panel"
          style={{
            marginBottom: '25px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '130px' }}>
            <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              This Week
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${weeklyActivity.length}, 1fr)`,
              gap: '8px',
              flex: 1,
            }}
          >
            {weeklyActivity.map((day) => {
              const dateStr = typeof day.date === 'string' ? day.date : String(day.date)
              const isToday = dateStr === today
              const dayLabel = new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
                weekday: 'narrow',
              })

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => navigate(`/journal?date=${dateStr}`)}
                  style={{
                    backgroundColor: isToday ? 'var(--primary-subtle)' : 'var(--bg-subtle)',
                    border: isToday ? '1.5px solid var(--primary)' : '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 4px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    transition: 'all 0.15s ease',
                  }}
                  title={`View ${dateStr}: ${day.total_entries} entries (${day.tasks} tasks)`}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: isToday ? 'var(--primary)' : 'var(--text-muted)',
                    }}
                  >
                    {dayLabel}
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: isToday ? 'var(--primary)' : 'var(--text-primary)',
                    }}
                  >
                    {day.total_entries}
                  </span>
                  {day.tasks > 0 && (
                    <span
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary)',
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {error && <div className="error">{error}</div>}

      {/* Workspace split */}
      <div className="workspace">
        <EntryForm
          form={form}
          editingId={editingId}
          saving={saving}
          updateForm={updateForm}
          resetForm={resetForm}
          saveEntry={handleSaveEntry}
        />

        <section className="panel entries-panel">
          {/* Feed Header with View Switcher */}
          <div className="panel-heading" style={{ marginBottom: '16px' }}>
            <div>
              <h2>Activity Feed</h2>
              <p>Keep track of thoughts and pending commitments.</p>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={`btn btn-secondary ${activeView === 'recent' ? 'btn-primary' : ''}`}
                onClick={() => setActiveView('recent')}
                style={{
                  fontSize: '12px',
                  padding: '5px 12px',
                  backgroundColor: activeView === 'recent' ? 'var(--primary)' : 'transparent',
                  color: activeView === 'recent' ? '#fff' : 'var(--text-secondary)',
                }}
              >
                <BookOpen size={14} />
                <span>Recent ({entries.length})</span>
              </button>

              <button
                type="button"
                className={`btn btn-secondary ${activeView === 'upcoming' ? 'btn-primary' : ''}`}
                onClick={() => setActiveView('upcoming')}
                style={{
                  fontSize: '12px',
                  padding: '5px 12px',
                  backgroundColor: activeView === 'upcoming' ? 'var(--primary)' : 'transparent',
                  color: activeView === 'upcoming' ? '#fff' : 'var(--text-secondary)',
                }}
              >
                <ListTodo size={14} />
                <span>Upcoming Tasks ({upcomingTasks.length})</span>
              </button>
            </div>
          </div>

          {/* Search box for recent view */}
          {activeView === 'recent' && (
            <form className="search-box" onSubmit={handleSearch} style={{ marginBottom: '16px' }}>
              <Clock size={16} />
              <input
                type="text"
                placeholder="Filter entries by keyword..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button type="submit">Filter</button>
              {query && (
                <button type="button" onClick={handleClearSearch} style={{ color: 'var(--text-muted)' }}>
                  Clear
                </button>
              )}
            </form>
          )}

          {/* List items */}
          {loading ? (
            <p className="empty">Loading entries...</p>
          ) : displayedList.length === 0 ? (
            <div className="empty">
              <p>
                {activeView === 'recent'
                  ? 'No entries found. Create your first one on the left or in the Journal Studio!'
                  : 'No upcoming tasks scheduled. You are all caught up!'}
              </p>
            </div>
          ) : (
            <div className="entry-list">
              {displayedList.map((item) => (
                <EntryCard
                  key={item.id}
                  result={item}
                  onView={handleViewEntry}
                  completeTask={handleCompleteTask}
                  migrateTask={(entry) => setMigratingTask(entry)}
                  showTaskHistory={handleShowTaskHistory}
                  historyLoading={historyLoading}
                  editEntry={handleEditEntry}
                  deleteEntry={(entry) => setDeletingEntry(entry)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Universal Entry Detail Reader Modal */}
      <EntryDetailModal
        entry={selectedEntry}
        isOpen={readerOpen}
        onClose={() => {
          setReaderOpen(false)
          setSelectedEntry(null)
        }}
        onEdit={(entry) => {
          setReaderOpen(false)
          handleEditEntry(entry)
        }}
        onDelete={(entry) => {
          setReaderOpen(false)
          setDeletingEntry(entry)
        }}
        onToggleDone={handleCompleteTask}
        onMigrate={(entry) => {
          setReaderOpen(false)
          setMigratingTask(entry)
        }}
        onShowHistory={(entry) => {
          setReaderOpen(false)
          handleShowTaskHistory(entry)
        }}
      />

      {/* Modals */}
      <TaskHistoryModal
        history={historyModalData}
        onClose={() => setHistoryModalData(null)}
      />

      <MigrationModal
        task={migratingTask}
        onClose={() => setMigratingTask(null)}
        onConfirm={confirmMigrate}
      />

      <ConfirmModal
        isOpen={Boolean(deletingEntry)}
        title="Delete Journal Entry"
        message={`Are you sure you want to permanently delete "${deletingEntry?.title || 'this entry'}"? This cannot be undone.`}
        confirmLabel="Delete Entry"
        confirmVariant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onClose={() => setDeletingEntry(null)}
      />
    </>
  )
}

export default DashboardPage
