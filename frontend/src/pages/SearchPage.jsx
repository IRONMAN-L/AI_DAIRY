import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Calendar,
  Filter,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'
import EntryCard from '../components/EntryCard'
import TaskHistoryModal from '../components/TaskHistoryModal'
import MigrationModal from '../components/common/MigrationModal'
import ConfirmModal from '../components/common/ConfirmModal'
import EntryDetailModal from '../components/common/EntryDetailModal'
import searchService from '../services/searchService'
import entriesService from '../services/entriesService'
import { getErrorMessage } from '../services/api'
import { formatDisplayDate } from '../utils/dateUtils'

function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [method, setMethod] = useState('hybrid') // 'keyword' | 'semantic' | 'hybrid'
  const [entryType, setEntryType] = useState('')
  const [status, setStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [results, setResults] = useState([])
  const [totalCount, setTotalCount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [syncStatus, setSyncStatus] = useState('')

  // Modals state
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [readerOpen, setReaderOpen] = useState(false)
  const [historyModalData, setHistoryModalData] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [migratingTask, setMigratingTask] = useState(null)
  const [deletingEntry, setDeletingEntry] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function handleSearch(e) {
    if (e) e.preventDefault()
    if (!query.trim() || query.trim().length < 2) {
      setError('Please enter at least 2 characters to search.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSyncStatus('')

      const params = {
        q: query.trim(),
        limit: 50,
      }
      if (entryType) params.entry_type = entryType
      if (status) params.status = status
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate

      let data
      if (method === 'semantic') {
        data = await searchService.searchSemantic(params)
      } else if (method === 'hybrid') {
        data = await searchService.searchHybrid(params)
      } else {
        data = await searchService.searchKeyword(params)
      }

      const items = data.results || []
      setResults(items)
      setTotalCount(data.total_results ?? items.length)
    } catch (err) {
      setError(getErrorMessage(err, 'Search query failed.'))
    } finally {
      setLoading(false)
    }
  }

  function handleResetFilters() {
    setQuery('')
    setEntryType('')
    setStatus('')
    setStartDate('')
    setEndDate('')
    setResults([])
    setTotalCount(null)
    setError('')
  }

  async function handleSyncVectorIndex() {
    try {
      setSyncStatus('Reconciling vector index with database...')
      setError('')
      const report = await searchService.syncVectorIndex(false)
      const added = report.added?.length ?? 0
      const removed = report.removed?.length ?? 0
      setSyncStatus(
        report.in_sync
          ? 'Vector index is fully synchronized with database (0 drift).'
          : `Sync complete: Reconciled +${added} indexed, -${removed} removed.`
      )
    } catch (err) {
      setError(getErrorMessage(err, 'Vector synchronization failed.'))
      setSyncStatus('')
    }
  }

  function handleViewEntry(entry) {
    setSelectedEntry(entry)
    setReaderOpen(true)
  }

  function handleEditEntry(entry) {
    navigate(`/editor/${entry.id}`)
  }

  async function handleCompleteTask(entry) {
    try {
      const newStatus = entry.status === 'done' ? 'open' : 'done'
      setError('')
      await entriesService.updateEntry(entry.id, { status: newStatus })
      if (selectedEntry?.id === entry.id) {
        setSelectedEntry((prev) => ({ ...prev, status: newStatus }))
      }
      await handleSearch()
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
    await handleSearch()
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
      await handleSearch()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete entry.'))
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

  return (
    <>
      <div className="welcome">
        <div>
          <p className="eyebrow">PERSONAL KNOWLEDGE RETRIEVAL</p>
          <h1>Search Your Journal</h1>
          <p className="subtitle">
            Retrieve past thoughts, bullet journal tasks, and reflections using keyword queries, semantic meaning, or hybrid AI fusion.
          </p>
        </div>
        <div className="welcome-icon">
          <Search size={36} />
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div className="editor-banner success-banner">
          {syncStatus}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {/* Search Console Panel */}
      <section className="panel" style={{ marginBottom: '25px', padding: '24px' }}>
        {/* Method Toggle */}
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'hybrid', label: 'Hybrid AI Fusion', icon: Sparkles, desc: 'Keyword + Semantic' },
              { id: 'semantic', label: 'Semantic Search', icon: Search, desc: 'Conceptual Meaning' },
              { id: 'keyword', label: 'Exact Keyword', icon: Filter, desc: 'Exact Matches' },
            ].map(({ id, label, icon: Icon, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMethod(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: method === id ? '1.5px solid var(--primary)' : '1px solid var(--border-default)',
                  backgroundColor: method === id ? 'var(--primary-subtle)' : 'var(--bg-surface)',
                  color: method === id ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: method === id ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={15} />
                <div style={{ textAlign: 'left' }}>
                  <span>{label}</span>
                  <small style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {desc}
                  </small>
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSyncVectorIndex}
            style={{ fontSize: '12px', padding: '7px 12px' }}
            title="Reconcile database with vector search index"
          >
            <RefreshCw size={13} />
            <span>Sync Vector Index</span>
          </button>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
          <div className="search-box" style={{ flex: 1, padding: '0 14px' }}>
            <Search size={18} />
            <input
              type="text"
              placeholder={`Search via ${method} mode (e.g. "exam preparation", "workout routine", "reading goals")...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ padding: '0 24px' }}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Faceted Filters Toolbar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            backgroundColor: 'var(--bg-subtle)',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <label>Entry Type</label>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="task">Tasks</option>
              <option value="event">Journal Events</option>
              <option value="note">Notes</option>
            </select>
          </div>

          <div>
            <label>Task Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="done">Completed</option>
              <option value="migrated">Migrated</option>
            </select>
          </div>

          <div>
            <label>From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label>To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetFilters}
              style={{ width: '100%', padding: '9px 12px' }}
            >
              Reset Filters
            </button>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="panel entries-panel">
        <div className="panel-heading">
          <div>
            <h2>Search Results</h2>
            <p>
              {totalCount !== null
                ? `Found ${totalCount} matching ${totalCount === 1 ? 'entry' : 'entries'} via ${method} retrieval`
                : 'Enter a query and run search'}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="empty">Searching your diary...</p>
        ) : totalCount === 0 ? (
          <p className="empty">No matching entries found for &ldquo;{query}&rdquo;.</p>
        ) : results.length > 0 ? (
          <div className="entry-list">
            {results.map((result) => {
              const item = result.entry ?? result
              const score = result.score
              const matchedBy = result.matched_by

              return (
                <div
                  key={item.id}
                  style={{
                    position: 'relative',
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    padding: '16px',
                  }}
                >
                  {/* Top Meta Bar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`entry-badge badge-${item.entry_type}`}>
                        {item.entry_type.toUpperCase()}
                      </span>

                      {typeof score === 'number' && (
                        <span
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            fontWeight: 600,
                          }}
                        >
                          Relevance: {score > 1 ? score : `${Math.round(score * 100)}%`}
                        </span>
                      )}

                      {Array.isArray(matchedBy) && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          (Matched: {matchedBy.join(' + ')})
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/journal?date=${item.entry_date}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        border: 0,
                        background: 'transparent',
                        color: 'var(--primary)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title="Open in daily journal view"
                    >
                      <Calendar size={14} />
                      <span>{formatDisplayDate(item.entry_date)}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  {/* Render the Entry Card content & actions */}
                  <EntryCard
                    result={result}
                    onView={handleViewEntry}
                    completeTask={handleCompleteTask}
                    migrateTask={(e) => setMigratingTask(e)}
                    showTaskHistory={handleShowTaskHistory}
                    historyLoading={historyLoading}
                    editEntry={handleEditEntry}
                    deleteEntry={(e) => setDeletingEntry(e)}
                  />
                </div>
              )
            })}
          </div>
        ) : null}
      </section>

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
        title="Delete Search Result"
        message={`Delete "${deletingEntry?.title || 'this entry'}"?`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onClose={() => setDeletingEntry(null)}
      />
    </>
  )
}

export default SearchPage
