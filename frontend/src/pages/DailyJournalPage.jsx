import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  ListTodo,
  Maximize2,
  PenLine,
  Plus,
} from 'lucide-react'
import EntryCard from '../components/EntryCard'
import TaskHistoryModal from '../components/TaskHistoryModal'
import MigrationModal from '../components/common/MigrationModal'
import ConfirmModal from '../components/common/ConfirmModal'
import EntryDetailModal from '../components/common/EntryDetailModal'
import entriesService from '../services/entriesService'
import journalService from '../services/journalService'
import { getErrorMessage } from '../services/api'
import {
  formatDisplayDate,
  getNextDate,
  getPreviousDate,
  getToday,
} from '../utils/dateUtils'

function DailyJournalPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentDate = searchParams.get('date') || getToday()

  const [journalData, setJournalData] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'task' | 'event' | 'note'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Quick Inline Capture State
  const [quickTitle, setQuickTitle] = useState('')
  const [quickType, setQuickType] = useState('event')
  const [quickSaving, setQuickSaving] = useState(false)

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

    async function fetchData() {
      try {
        setLoading(true)
        const data = await journalService.getDailyJournal(currentDate)
        if (!ignore) {
          setJournalData(data)
          setError('')
          setLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          setError(getErrorMessage(err, 'Failed to load journal for this date.'))
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      ignore = true
    }
  }, [currentDate, refreshKey])

  function navigateToDate(date) {
    setLoading(true)
    setSearchParams({ date })
    setTypeFilter('all')
  }

  // Quick capture handler
  async function handleQuickCapture(e) {
    e.preventDefault()
    if (!quickTitle.trim()) return

    try {
      setQuickSaving(true)
      setError('')
      const payload = {
        title: quickTitle.trim(),
        content: quickTitle.trim(),
        entry_date: currentDate,
        entry_type: quickType,
        status: 'open',
        source: 'typed',
      }
      await entriesService.createEntry(payload)
      setQuickTitle('')
      reload()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save quick entry.'))
    } finally {
      setQuickSaving(false)
    }
  }

  function handleOpenEditor(type = 'event') {
    navigate(`/editor?date=${currentDate}&type=${type}`)
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

  async function handleToggleDone(entry) {
    try {
      const newStatus = entry.status === 'done' ? 'open' : 'done'
      await entriesService.updateEntry(entry.id, { status: newStatus })
      if (selectedEntry?.id === entry.id) {
        setSelectedEntry((prev) => ({ ...prev, status: newStatus }))
      }
      reload()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update task status.'))
    }
  }

  async function confirmDelete() {
    if (!deletingEntry) return
    try {
      setDeleteLoading(true)
      setError('')
      await entriesService.deleteEntry(deletingEntry.id)
      if (selectedEntry?.id === deletingEntry.id) {
        setReaderOpen(false)
        setSelectedEntry(null)
      }
      setDeletingEntry(null)
      reload()
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to delete entry.'))
    } finally {
      setDeleteLoading(false)
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
      setError(getErrorMessage(err, 'Unable to load task history.'))
    } finally {
      setHistoryLoading(false)
    }
  }

  const allEntries = journalData?.entries || []
  const filteredEntries =
    typeFilter === 'all'
      ? allEntries
      : allEntries.filter((e) => e.entry_type === typeFilter)

  const stats = journalData?.statistics
  const isViewingToday = currentDate === getToday()

  return (
    <>
      {/* Date Navigation Bar */}
      <div
        className="panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          padding: '14px 22px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="icon-btn"
            type="button"
            onClick={() => navigateToDate(getPreviousDate(currentDate))}
            title="Previous Day"
          >
            <ChevronLeft size={20} />
          </button>

          <input
            type="date"
            value={currentDate}
            onChange={(e) => navigateToDate(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-canvas)',
              fontWeight: 600,
              fontSize: '14px',
              color: 'var(--text-primary)',
              outline: 'none',
              width: 'auto',
            }}
          />

          <button
            className="icon-btn"
            type="button"
            onClick={() => navigateToDate(getNextDate(currentDate))}
            title="Next Day"
          >
            <ChevronRight size={20} />
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigateToDate(getToday())}
            style={{
              padding: '5px 12px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: isViewingToday ? 'var(--primary-subtle)' : 'transparent',
              color: isViewingToday ? 'var(--primary)' : 'var(--text-secondary)',
              borderColor: isViewingToday ? 'var(--primary-border)' : 'var(--border-default)',
            }}
          >
            Today
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate('/calendar')}
            style={{
              padding: '5px 10px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
            title="Return to Monthly Calendar view"
          >
            <CalendarDays size={15} />
            <span>Calendar</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)' }}>
            {formatDisplayDate(currentDate)}
          </span>
          {isViewingToday && (
            <span
              style={{
                fontSize: '11px',
                backgroundColor: 'var(--primary-subtle)',
                color: 'var(--primary)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Today
            </span>
          )}
        </div>
      </div>

      {/* Daily Activity Overview Bar */}
      {stats && (
        <div className="stats">
          <div className="stat-card">
            <div className="stat-card-header">
              <span>Day Entries</span>
              <BookOpen size={18} />
            </div>
            <strong>{stats.total_entries}</strong>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <span>Tasks Completed</span>
              <CheckCircle2 size={18} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <strong>{stats.completed_tasks}</strong>
              <small style={{ color: 'var(--text-muted)' }}>/ {stats.total_tasks} tasks</small>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <span>Completion Rate</span>
              <ListTodo size={18} />
            </div>
            <strong>{stats.completion_percentage}%</strong>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <span>Reflections &amp; Notes</span>
              <FileText size={18} />
            </div>
            <strong>{stats.total_notes + stats.total_events}</strong>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {/* Prominent Dedicated Journal Writing Launcher & Quick Capture */}
      <section
        className="panel"
        style={{
          marginBottom: '22px',
          padding: '20px 24px',
          background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-subtle) 100%)',
          border: '1.5px solid var(--primary-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0' }}>
              Daily Journal Studio
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
              Open the full-screen writing studio with distraction-free typography, live markdown preview, voice dictation, and OCR.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleOpenEditor('event')}
              style={{ padding: '9px 16px', fontSize: '14px' }}
            >
              <PenLine size={16} />
              <span>Write Journal Entry</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleOpenEditor('task')}
              title="Add a bullet journal task in the full editor"
            >
              <ListTodo size={15} />
              <span>Add Task</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleOpenEditor('note')}
              title="Write a quick reflection or note in the full editor"
            >
              <FileText size={15} />
              <span>New Note</span>
            </button>
          </div>
        </div>

        {/* Quick inline capture bar */}
        <form
          onSubmit={handleQuickCapture}
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface)',
            padding: '6px 8px 6px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
          }}
        >
          <select
            value={quickType}
            onChange={(e) => setQuickType(e.target.value)}
            style={{
              width: 'auto',
              border: 0,
              backgroundColor: 'transparent',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--primary)',
              cursor: 'pointer',
              padding: '6px 4px',
              outline: 'none',
            }}
          >
            <option value="event">Journal</option>
            <option value="task">Bullet Task</option>
            <option value="note">Note</option>
          </select>

          <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-default)' }} />

          <input
            type="text"
            placeholder="Quick capture a thought or task for today... (Press Enter to record)"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            style={{
              border: 0,
              backgroundColor: 'transparent',
              padding: '8px 4px',
              fontSize: '14px',
              flex: 1,
              boxShadow: 'none',
            }}
          />

          <button
            type="submit"
            className="btn btn-secondary"
            disabled={quickSaving || !quickTitle.trim()}
            style={{ padding: '6px 12px', fontSize: '13px' }}
            title="Record quick entry"
          >
            <Plus size={15} />
            <span>Add</span>
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={() => handleOpenEditor(quickType)}
            title="Expand to Full Journal Studio"
          >
            <Maximize2 size={16} />
          </button>
        </form>
      </section>

      {/* Day Log Entries Panel */}
      <section className="panel entries-panel">
        <div className="panel-heading" style={{ marginBottom: '16px' }}>
          <div>
            <h2>Day Log — {formatDisplayDate(currentDate)}</h2>
            <p>Everything recorded on this date.</p>
          </div>

          {/* Type Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: `All (${allEntries.length})` },
              {
                id: 'task',
                label: `Tasks (${stats?.total_tasks || 0})`,
              },
              {
                id: 'event',
                label: `Journal (${stats?.total_events || 0})`,
              },
              {
                id: 'note',
                label: `Notes (${stats?.total_notes || 0})`,
              },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`type-pill ${typeFilter === id ? 'active' : ''}`}
                onClick={() => setTypeFilter(id)}
                style={{
                  border: typeFilter === id ? '1px solid var(--primary-border)' : '1px solid var(--border-default)',
                  backgroundColor: typeFilter === id ? 'var(--primary-subtle)' : 'transparent',
                  color: typeFilter === id ? 'var(--primary)' : 'var(--text-secondary)',
                  padding: '4px 10px',
                  fontSize: '12px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="empty">Loading entries for {currentDate}...</p>
        ) : filteredEntries.length === 0 ? (
          <div className="empty" style={{ padding: '40px 20px' }}>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              {allEntries.length === 0
                ? 'No entries recorded for this date yet.'
                : `No ${typeFilter} entries found for this date.`}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '22px' }}>
              What would you like to reflect on or accomplish for {formatDisplayDate(currentDate)}?
            </p>

            {/* Quick Template Shortcuts */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleOpenEditor('event')}
              >
                <CalendarDays size={15} />
                <span>Log Journal Reflection</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleOpenEditor('task')}
              >
                <ListTodo size={15} />
                <span>Plan a Task</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleOpenEditor('note')}
              >
                <FileText size={15} />
                <span>Write a Note</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="entry-list">
            {filteredEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                result={entry}
                onView={handleViewEntry}
                completeTask={handleToggleDone}
                migrateTask={(e) => setMigratingTask(e)}
                showTaskHistory={handleShowTaskHistory}
                historyLoading={historyLoading}
                editEntry={handleEditEntry}
                deleteEntry={(e) => setDeletingEntry(e)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Universal Journal Entry Reader & Action Modal */}
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
        onToggleDone={handleToggleDone}
        onMigrate={(entry) => {
          setReaderOpen(false)
          setMigratingTask(entry)
        }}
        onShowHistory={(entry) => {
          setReaderOpen(false)
          handleShowTaskHistory(entry)
        }}
      />

      {/* Task Lineage & Migration History Modal */}
      <TaskHistoryModal
        history={historyModalData}
        onClose={() => setHistoryModalData(null)}
      />

      {/* Migration Target Date Selector Modal */}
      <MigrationModal
        task={migratingTask}
        onClose={() => setMigratingTask(null)}
        onConfirm={confirmMigrate}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingEntry)}
        title="Delete Journal Entry"
        message={`Delete "${deletingEntry?.title || 'this entry'}" from ${currentDate}?`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onClose={() => setDeletingEntry(null)}
      />
    </>
  )
}

export default DailyJournalPage
