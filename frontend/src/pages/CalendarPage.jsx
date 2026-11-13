import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  BookOpen,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  PenLine,
  Plus,
} from 'lucide-react'
import EntryCard from '../components/EntryCard'
import TaskHistoryModal from '../components/TaskHistoryModal'
import MigrationModal from '../components/common/MigrationModal'
import ConfirmModal from '../components/common/ConfirmModal'
import EntryDetailModal from '../components/common/EntryDetailModal'
import journalService from '../services/journalService'
import entriesService from '../services/entriesService'
import { getErrorMessage } from '../services/api'
import { formatDisplayDate, getToday } from '../utils/dateUtils'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function CalendarPage() {
  const navigate = useNavigate()
  const today = getToday()
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1) // 1-indexed
  const [selectedDate, setSelectedDate] = useState(today)

  const [monthlyData, setMonthlyData] = useState(null)
  const [loadingMonth, setLoadingMonth] = useState(true)
  const [monthError, setMonthError] = useState('')

  // Selected Day entries state
  const [selectedDayData, setSelectedDayData] = useState(null)
  const [selectedDayLoading, setSelectedDayLoading] = useState(true)
  const [selectedDayError, setSelectedDayError] = useState('')

  // Modals state for selected day entries
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [readerOpen, setReaderOpen] = useState(false)
  const [historyModalData, setHistoryModalData] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [migratingTask, setMigratingTask] = useState(null)
  const [deletingEntry, setDeletingEntry] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  // Automatic synchronization counter
  const [refreshKey, setRefreshKey] = useState(0)
  const reload = () => setRefreshKey((k) => k + 1)

  // 1. Fetch Month Data
  useEffect(() => {
    let ignore = false

    async function fetchMonthData() {
      try {
        const data = await journalService.getMonthlyStatistics(currentYear, currentMonth)
        if (!ignore) {
          setMonthlyData(data)
          setMonthError('')
          setLoadingMonth(false)
        }
      } catch (err) {
        if (!ignore) {
          setMonthError(getErrorMessage(err, 'Failed to load calendar month.'))
          setLoadingMonth(false)
        }
      }
    }

    fetchMonthData()

    return () => {
      ignore = true
    }
  }, [currentYear, currentMonth, refreshKey])

  // 2. Fetch Selected Day Entries
  useEffect(() => {
    let ignore = false

    async function fetchDayData() {
      try {
        setSelectedDayLoading(true)
        const data = await journalService.getDailyJournal(selectedDate)
        if (!ignore) {
          setSelectedDayData(data)
          setSelectedDayError('')
          setSelectedDayLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          setSelectedDayError(getErrorMessage(err, 'Failed to load entries for selected date.'))
          setSelectedDayLoading(false)
        }
      }
    }

    fetchDayData()

    return () => {
      ignore = true
    }
  }, [selectedDate, refreshKey])

  function handlePrevMonth() {
    setLoadingMonth(true)
    if (currentMonth === 1) {
      setCurrentMonth(12)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  function handleNextMonth() {
    setLoadingMonth(true)
    if (currentMonth === 12) {
      setCurrentMonth(1)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  function handleJumpToday() {
    setLoadingMonth(true)
    const d = new Date()
    setCurrentYear(d.getFullYear())
    setCurrentMonth(d.getMonth() + 1)
    setSelectedDate(today)
  }

  function handleDayClick(dateStr) {
    setSelectedDate(dateStr)
  }

  function handleOpenJournal(dateStr) {
    navigate(`/journal?date=${dateStr}`)
  }

  // Selected Day Actions
  function handleViewEntry(entry) {
    setSelectedEntry(entry)
    setReaderOpen(true)
  }

  function handleEditEntry(entry) {
    if (entry.status === 'migrated') {
      setActionError('Migrated entries are read-only.')
      return
    }
    navigate(`/editor/${entry.id}`)
  }

  async function handleToggleDone(entry) {
    try {
      setActionError('')
      const newStatus = entry.status === 'done' ? 'open' : 'done'
      await entriesService.updateEntry(entry.id, { status: newStatus })
      if (selectedEntry?.id === entry.id) {
        setSelectedEntry((prev) => ({ ...prev, status: newStatus }))
      }
      reload()
    } catch (err) {
      setActionError(getErrorMessage(err, 'Unable to update task status.'))
    }
  }

  async function confirmDelete() {
    if (!deletingEntry) return
    try {
      setDeleteLoading(true)
      setActionError('')
      await entriesService.deleteEntry(deletingEntry.id)
      if (selectedEntry?.id === deletingEntry.id) {
        setReaderOpen(false)
        setSelectedEntry(null)
      }
      setDeletingEntry(null)
      reload()
    } catch (err) {
      setActionError(getErrorMessage(err, 'Unable to delete entry.'))
    } finally {
      setDeleteLoading(false)
    }
  }

  async function confirmMigrate(taskId, targetDate) {
    try {
      setActionError('')
      await entriesService.migrateTask(taskId, targetDate)
      setMigratingTask(null)
      if (selectedEntry?.id === taskId) {
        setReaderOpen(false)
        setSelectedEntry(null)
      }
      reload()
    } catch (err) {
      setActionError(getErrorMessage(err, 'Unable to migrate task.'))
    }
  }

  async function handleShowTaskHistory(entry) {
    try {
      setHistoryLoading(true)
      setActionError('')
      const items = await entriesService.getTaskHistory(entry.id)
      setHistoryModalData({ title: entry.title, items })
    } catch (err) {
      setActionError(getErrorMessage(err, 'Unable to load task history.'))
    } finally {
      setHistoryLoading(false)
    }
  }

  // Build calendar matrix
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()

  const dailyActivityList = monthlyData?.daily_activity || monthlyData?.days || []
  const dailyActivityMap = new Map()
  for (const item of dailyActivityList) {
    if (item && item.date) {
      const dKey = typeof item.date === 'string' ? item.date.slice(0, 10) : String(item.date)
      dailyActivityMap.set(dKey, item)
    }
  }

  const activeDaysCount = dailyActivityList.filter((d) => (d.total_entries || 0) > 0).length

  const calendarCells = []

  // Preceding empty slots
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push({ empty: true, key: `empty-${i}` })
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const monthStr = String(currentMonth).padStart(2, '0')
    const dayStr = String(d).padStart(2, '0')
    const dateStr = `${currentYear}-${monthStr}-${dayStr}`
    const activity = dailyActivityMap.get(dateStr) || {
      total_entries: 0,
      tasks: 0,
      events: 0,
      notes: 0,
    }

    calendarCells.push({
      empty: false,
      key: dateStr,
      day: d,
      dateStr,
      activity,
      isToday: dateStr === today,
      isSelected: dateStr === selectedDate,
    })
  }

  const selectedDayActivity = dailyActivityMap.get(selectedDate) || {
    total_entries: 0,
    tasks: 0,
    events: 0,
    notes: 0,
  }

  const selectedEntries = selectedDayData?.entries || []

  return (
    <>
      <div className="welcome">
        <div>
          <p className="eyebrow">TEMPORAL MAPPING</p>
          <h1>Monthly Calendar</h1>
          <p className="subtitle">
            Navigate through past entries and future tasks with high-level monthly visual density.
          </p>
        </div>
        <div className="welcome-icon">
          <CalendarIcon size={34} />
        </div>
      </div>

      {monthError && <div className="error">{monthError}</div>}
      {actionError && <div className="error">{actionError}</div>}

      {/* Monthly Statistics Overview */}
      {monthlyData?.statistics && (
        <div
          className="stats"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '22px' }}
        >
          <div className="stat-card">
            <div className="stat-card-header">
              <span>Month Entries</span>
              <BookOpen size={18} />
            </div>
            <strong>{monthlyData.statistics.total_entries}</strong>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span>Tasks Logged</span>
              <Clock size={18} />
            </div>
            <strong>{monthlyData.statistics.total_tasks}</strong>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span>Completed Tasks</span>
              <CheckCircle2 size={18} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <strong>{monthlyData.statistics.completed_tasks}</strong>
              <small style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                ({monthlyData.statistics.completion_percentage}%)
              </small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span>Active Days</span>
              <Sparkles size={18} />
            </div>
            <strong>{activeDaysCount} days</strong>
          </div>
        </div>
      )}

      {/* Main Calendar Grid Panel */}
      <section className="panel" style={{ marginBottom: '25px', padding: '24px' }}>
        {/* Calendar Month Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontSize: '20px', margin: 0, color: 'var(--text-primary)' }}>
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </h2>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleJumpToday}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              Today
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="icon-btn"
              type="button"
              onClick={handlePrevMonth}
              title="Previous Month"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className="icon-btn"
              type="button"
              onClick={handleNextMonth}
              title="Next Month"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '8px',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginBottom: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {DAYS_OF_WEEK.map((d) => (
            <div key={d} style={{ padding: '8px 0' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid Cells */}
        {loadingMonth ? (
          <p className="empty">Loading month data...</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px',
            }}
          >
            {calendarCells.map((cell) => {
              if (cell.empty) {
                return (
                  <div
                    key={cell.key}
                    style={{
                      minHeight: '88px',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      opacity: 0.35,
                    }}
                  />
                )
              }

              const journalCount = (cell.activity.events || 0) + (cell.activity.notes || 0)
              const taskCount = cell.activity.tasks || 0
              const totalCount = cell.activity.total_entries || 0
              const hasEntries = totalCount > 0

              let cellBorder = 'var(--border-default)'
              if (cell.isSelected) cellBorder = 'var(--primary)'
              else if (cell.isToday) cellBorder = 'var(--primary-border)'

              return (
                <div
                  key={cell.key}
                  onClick={() => handleDayClick(cell.dateStr)}
                  onDoubleClick={() => handleOpenJournal(cell.dateStr)}
                  style={{
                    minHeight: '88px',
                    padding: '8px 10px',
                    backgroundColor: cell.isSelected
                      ? 'var(--primary-subtle)'
                      : cell.isToday
                      ? 'var(--bg-subtle)'
                      : 'var(--bg-surface)',
                    border: cell.isSelected
                      ? '2px solid var(--primary)'
                      : `1px solid ${cellBorder}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                  }}
                  title={`Click to inspect entries, double click to open daily journal for ${cell.dateStr}`}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: cell.isToday || cell.isSelected ? 700 : 500,
                        color: cell.isSelected
                          ? 'var(--primary)'
                          : cell.isToday
                          ? 'var(--primary)'
                          : 'var(--text-primary)',
                        fontSize: '14px',
                      }}
                    >
                      {cell.day}
                    </span>

                    {cell.isToday && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        Today
                      </span>
                    )}
                  </div>

                  {/* Indicators for tasks and journal entries */}
                  {hasEntries ? (
                    <div
                      style={{
                        marginTop: 'auto',
                        paddingTop: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                      }}
                    >
                      {journalCount > 0 && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'var(--bg-canvas)',
                            border: '1px solid var(--border-default)',
                            borderRadius: '4px',
                            padding: '2px 5px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            width: 'fit-content',
                            lineHeight: 1.2,
                          }}
                          title={`${journalCount} journal ${journalCount === 1 ? 'entry' : 'entries'}`}
                        >
                          <BookOpen size={11} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span>{journalCount} {journalCount === 1 ? 'entry' : 'entries'}</span>
                        </div>
                      )}

                      {taskCount > 0 && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'var(--bg-canvas)',
                            border: '1px solid var(--border-default)',
                            borderRadius: '4px',
                            padding: '2px 5px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            width: 'fit-content',
                            lineHeight: 1.2,
                          }}
                          title={`${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`}
                        >
                          <CheckCircle2 size={11} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                          <span>{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span>
                        </div>
                      )}

                      {/* Fallback if total_entries > 0 but journal and task counts both 0 */}
                      {journalCount === 0 && taskCount === 0 && (
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--primary)',
                          }}
                        >
                          {totalCount} {totalCount === 1 ? 'entry' : 'entries'}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Selected Date Quick Inspection & Entries List */}
      <section className="panel" style={{ padding: '24px', marginBottom: '32px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            paddingBottom: '18px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>
                Entries for {formatDisplayDate(selectedDate)}
              </h3>
              {selectedDate === today && (
                <span
                  style={{
                    fontSize: '11px',
                    backgroundColor: 'var(--primary-subtle)',
                    color: 'var(--primary)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 700,
                  }}
                >
                  Today
                </span>
              )}
            </div>

            <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {selectedDayActivity.total_entries === 0
                ? 'No entries recorded on this day.'
                : `${selectedDayActivity.total_entries} recorded: ${selectedDayActivity.tasks} tasks, ${selectedDayActivity.events} events, ${selectedDayActivity.notes} notes.`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(`/editor?date=${selectedDate}`)}
            >
              <PenLine size={15} />
              <span>Write Entry</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleOpenJournal(selectedDate)}
            >
              <span>Open Daily Journal</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* Selected Date Entries List */}
        <div style={{ marginTop: '20px' }}>
          {selectedDayError && <div className="error">{selectedDayError}</div>}

          {selectedDayLoading ? (
            <p className="empty">Loading entries for this date...</p>
          ) : selectedEntries.length === 0 ? (
            <div
              className="empty"
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                marginTop: '10px',
              }}
            >
              <p style={{ margin: '0 0 14px', color: 'var(--text-muted)' }}>
                No tasks or journal entries recorded for {formatDisplayDate(selectedDate)}.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate(`/editor?date=${selectedDate}`)}
              >
                <Plus size={15} />
                <span>Create an Entry for this Date</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  result={entry}
                  entry={entry}
                  onView={handleViewEntry}
                  editEntry={handleEditEntry}
                  onEdit={handleEditEntry}
                  completeTask={handleToggleDone}
                  onToggleDone={handleToggleDone}
                  migrateTask={(item) => setMigratingTask(item)}
                  onMigrate={(item) => setMigratingTask(item)}
                  deleteEntry={(item) => setDeletingEntry(item)}
                  onDelete={(item) => setDeletingEntry(item)}
                  showTaskHistory={handleShowTaskHistory}
                  onShowHistory={handleShowTaskHistory}
                  historyLoading={historyLoading}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Universal Reader Modal */}
      {readerOpen && selectedEntry && (
        <EntryDetailModal
          isOpen={readerOpen}
          entry={selectedEntry}
          onClose={() => {
            setReaderOpen(false)
            setSelectedEntry(null)
          }}
          onEdit={handleEditEntry}
          onToggleDone={handleToggleDone}
          onMigrate={(item) => setMigratingTask(item)}
          onDelete={(item) => setDeletingEntry(item)}
          onShowHistory={handleShowTaskHistory}
        />
      )}

      {/* Task History Modal */}
      {historyModalData && (
        <TaskHistoryModal
          data={historyModalData}
          loading={historyLoading}
          onClose={() => setHistoryModalData(null)}
        />
      )}

      {/* Task Migration Modal */}
      {migratingTask && (
        <MigrationModal
          task={migratingTask}
          onClose={() => setMigratingTask(null)}
          onMigrate={confirmMigrate}
        />
      )}

      {/* Entry Deletion Confirmation Modal */}
      {deletingEntry && (
        <ConfirmModal
          title="Delete Journal Entry?"
          message={`Are you sure you want to permanently delete "${deletingEntry.title}"? This action cannot be undone.`}
          confirmText={deleteLoading ? 'Deleting...' : 'Delete Permanently'}
          confirmVariant="danger"
          loading={deleteLoading}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingEntry(null)}
        />
      )}
    </>
  )
}

export default CalendarPage
