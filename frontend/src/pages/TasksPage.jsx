import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRightCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  ListTodo,
  PenLine,
  Plus,
  X,
} from 'lucide-react'
import EntryCard from '../components/EntryCard'
import TaskHistoryModal from '../components/TaskHistoryModal'
import MigrationModal from '../components/common/MigrationModal'
import ConfirmModal from '../components/common/ConfirmModal'
import EntryDetailModal from '../components/common/EntryDetailModal'
import entriesService from '../services/entriesService'
import { getErrorMessage } from '../services/api'
import { getToday } from '../utils/dateUtils'

function TasksPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('open') // 'open' | 'done' | 'migrated' | 'all'
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Date filters & text filter
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [keyword, setKeyword] = useState('')

  // Overall counts for tabs & metrics
  const [counts, setCounts] = useState({
    open: 0,
    done: 0,
    migrated: 0,
    total: 0,
  })

  // Task creation & editing
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskContent, setNewTaskContent] = useState('')
  const [newTaskDate, setNewTaskDate] = useState(getToday())
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

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

    async function fetchTasks() {
      try {
        const params = {
          entry_type: 'task',
          limit: 100,
        }

        if (activeTab !== 'all') {
          params.status = activeTab
        }
        if (startDate) params.start_date = startDate
        if (endDate) params.end_date = endDate

        const [filteredRes, openRes, doneRes, migratedRes] = await Promise.all([
          entriesService.getEntries(params),
          entriesService.getEntries({ entry_type: 'task', status: 'open', limit: 100 }),
          entriesService.getEntries({ entry_type: 'task', status: 'done', limit: 100 }),
          entriesService.getEntries({ entry_type: 'task', status: 'migrated', limit: 100 }),
        ])

        if (!ignore) {
          setTasks(Array.isArray(filteredRes) ? filteredRes : [])

          const openCount = Array.isArray(openRes) ? openRes.length : 0
          const doneCount = Array.isArray(doneRes) ? doneRes.length : 0
          const migratedCount = Array.isArray(migratedRes) ? migratedRes.length : 0

          setCounts({
            open: openCount,
            done: doneCount,
            migrated: migratedCount,
            total: openCount + doneCount + migratedCount,
          })

          setError('')
          setLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          setError(getErrorMessage(err, 'Failed to load tasks.'))
          setLoading(false)
        }
      }
    }

    fetchTasks()

    return () => {
      ignore = true
    }
  }, [activeTab, startDate, endDate, refreshKey])

  function resetForm() {
    setNewTaskTitle('')
    setNewTaskContent('')
    setNewTaskDate(getToday())
    setEditingId(null)
    setError('')
  }

  async function handleSaveTask(e) {
    e.preventDefault()
    if (!newTaskTitle.trim()) {
      setError('Task title is required.')
      return
    }

    try {
      setSubmitting(true)
      setError('')

      const payload = {
        title: newTaskTitle.trim(),
        content: newTaskContent.trim() || newTaskTitle.trim(),
        entry_date: newTaskDate,
        entry_type: 'task',
        status: 'open',
        source: 'typed',
      }

      if (editingId !== null) {
        await entriesService.updateEntry(editingId, payload)
      } else {
        await entriesService.createEntry(payload)
      }

      resetForm()
      reload()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save task.'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleViewTask(task) {
    setSelectedEntry(task)
    setReaderOpen(true)
  }

  function handleEditTask(task) {
    if (task.status === 'migrated') {
      setError('Migrated tasks are historical records and cannot be edited.')
      return
    }
    navigate(`/editor/${task.id}`)
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

  async function confirmDelete() {
    if (!deletingEntry) return
    try {
      setDeleteLoading(true)
      setError('')
      await entriesService.deleteEntry(deletingEntry.id)
      if (editingId === deletingEntry.id) resetForm()
      if (selectedEntry?.id === deletingEntry.id) {
        setReaderOpen(false)
        setSelectedEntry(null)
      }
      setDeletingEntry(null)
      reload()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete task.'))
    } finally {
      setDeleteLoading(false)
    }
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

  function handleClearFilters() {
    setStartDate('')
    setEndDate('')
    setKeyword('')
  }

  // Filter tasks client-side by keyword
  const displayedTasks = tasks.filter((t) => {
    if (!keyword.trim()) return true
    const q = keyword.toLowerCase()
    return (
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.content && t.content.toLowerCase().includes(q))
    )
  })

  const totalFinishedOrOpen = counts.open + counts.done
  const completionPercentage =
    totalFinishedOrOpen > 0
      ? Math.round((counts.done / totalFinishedOrOpen) * 100)
      : 0

  return (
    <>
      <div className="welcome">
        <div>
          <p className="eyebrow">BULLET JOURNAL SYSTEM</p>
          <h1>Tasks &amp; Migration</h1>
          <p className="subtitle">
            Manage your daily tasks, complete items, track migration lineage, and push unfinished work forward.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/editor?type=task')}
          >
            <PenLine size={15} />
            <span>Open Studio Task Editor</span>
          </button>
        </div>
      </div>

      {/* Task Metrics Bar */}
      <div
        className="stats"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '22px' }}
      >
        <div className="stat-card">
          <div className="stat-card-header">
            <span>Open Tasks</span>
            <Clock size={18} />
          </div>
          <strong>{counts.open}</strong>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span>Completed Tasks</span>
            <CheckCircle2 size={18} />
          </div>
          <strong>{counts.done}</strong>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span>Migrated Forward</span>
            <ArrowRightCircle size={18} />
          </div>
          <strong>{counts.migrated}</strong>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span>Completion Rate</span>
            <CalendarDays size={18} />
          </div>
          <strong>{completionPercentage}%</strong>
        </div>
      </div>

      {/* Status Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-default)',
          paddingBottom: '14px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        {[
          { key: 'open', label: 'Open Tasks', icon: Clock, count: counts.open },
          { key: 'done', label: 'Completed', icon: CheckCircle2, count: counts.done },
          { key: 'migrated', label: 'Migrated History', icon: ArrowRightCircle, count: counts.migrated },
          { key: 'all', label: 'All Tasks', icon: ListTodo, count: counts.total },
        ].map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setLoading(true)
              setActiveTab(key)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              borderRadius: 'var(--radius-md)',
              border: activeTab === key ? '1px solid var(--primary-border)' : '1px solid var(--border-default)',
              backgroundColor: activeTab === key ? 'var(--primary-subtle)' : 'transparent',
              color: activeTab === key ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === key ? 700 : 500,
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.15s ease',
            }}
          >
            <Icon size={16} />
            <span>
              {label} ({count})
            </span>
          </button>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      {/* Workspace Split */}
      <div className="workspace">
        {/* Quick Task Creator / Editor */}
        <section className="panel create-panel">
          <div className="panel-heading">
            <div>
              <h2>{editingId !== null ? 'Edit Task' : 'Quick Add Task'}</h2>
              <p>
                {editingId !== null
                  ? 'Update task details.'
                  : 'Capture an actionable task for your bullet journal.'}
              </p>
            </div>
            {editingId !== null ? (
              <button
                className="icon-btn"
                onClick={resetForm}
                type="button"
                title="Cancel editing"
              >
                <X size={18} />
              </button>
            ) : (
              <Plus size={18} />
            )}
          </div>

          <form onSubmit={handleSaveTask} style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label>Task Date</label>
              <input
                type="date"
                value={newTaskDate}
                onChange={(e) => setNewTaskDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label>Task Title</label>
              <input
                type="text"
                placeholder="What needs to be done?"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label>Details / Checklists (Optional Markdown)</label>
              <textarea
                placeholder="Add subtasks or notes (- [ ] item, bullet points, etc.)..."
                value={newTaskContent}
                onChange={(e) => setNewTaskContent(e.target.value)}
                rows={4}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate(`/editor?type=task&date=${newTaskDate}`)}
                title="Open in full-page Studio Editor"
              >
                Studio Editor
              </button>

              <button className="btn btn-primary" type="submit" disabled={submitting}>
                <Plus size={16} />
                <span>{submitting ? 'Saving...' : editingId !== null ? 'Update Task' : 'Add Task'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Task List Panel with Filters */}
        <section className="panel entries-panel">
          <div className="panel-heading" style={{ marginBottom: '14px' }}>
            <div>
              <h2>
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Tasks
              </h2>
              <p>Showing {displayedTasks.length} items</p>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '10px',
              backgroundColor: 'var(--bg-subtle)',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '16px',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              placeholder="Filter tasks by text..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ fontSize: '13px', padding: '6px 10px' }}
            />

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ fontSize: '13px', padding: '5px 8px' }}
              title="Start date filter"
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ fontSize: '13px', padding: '5px 8px' }}
              title="End date filter"
            />

            {(startDate || endDate || keyword) && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClearFilters}
                style={{ fontSize: '12px', padding: '6px 10px' }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {loading ? (
            <p className="empty">Loading tasks...</p>
          ) : displayedTasks.length === 0 ? (
            <div className="empty">
              <p>No tasks found in this view.</p>
              {(startDate || endDate || keyword) && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleClearFilters}
                  style={{ marginTop: '8px' }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="entry-list">
              {displayedTasks.map((task) => (
                <EntryCard
                  key={task.id}
                  result={task}
                  onView={handleViewTask}
                  completeTask={handleCompleteTask}
                  migrateTask={(t) => setMigratingTask(t)}
                  showTaskHistory={handleShowTaskHistory}
                  historyLoading={historyLoading}
                  editEntry={handleEditTask}
                  deleteEntry={(t) => setDeletingEntry(t)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Universal Journal Entry Reader Modal */}
      <EntryDetailModal
        entry={selectedEntry}
        isOpen={readerOpen}
        onClose={() => {
          setReaderOpen(false)
          setSelectedEntry(null)
        }}
        onEdit={(entry) => {
          setReaderOpen(false)
          handleEditTask(entry)
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
        title="Delete Task"
        message={`Are you sure you want to delete task "${deletingEntry?.title || 'this task'}"?`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onClose={() => setDeletingEntry(null)}
      />
    </>
  )
}

export default TasksPage
