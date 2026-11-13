import { useEffect, useState } from 'react'
import {
  Archive,
  CheckCircle,
  Database,
  Download,
  FileText,
  HardDrive,
  Moon,
  RefreshCw,
  Settings,
  Sun,
  Upload,
} from 'lucide-react'
import backupService from '../services/backupService'
import searchService from '../services/searchService'
import { getErrorMessage } from '../services/api'
import { useTheme } from '../context/ThemeContext'

function SettingsPage() {
  const { theme, toggleTheme } = useTheme()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Import state
  const [importFile, setImportFile] = useState(null)
  const [importMode, setImportMode] = useState('merge') // 'merge' | 'replace'
  const [importing, setImporting] = useState(false)

  // Sync state
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    let ignore = false
    async function loadStats() {
      try {
        const data = await backupService.getStats()
        if (!ignore) {
          setStats(data)
        }
      } catch (err) {
        if (!ignore) {
          setError(getErrorMessage(err, 'Failed to load storage statistics.'))
        }
      }
    }
    loadStats()
    return () => {
      ignore = true
    }
  }, [])

  async function handleDownloadJson() {
    try {
      setError('')
      setSuccessMsg('')
      await backupService.downloadJsonBackup()
      setSuccessMsg('JSON backup downloaded successfully.')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to download backup.'))
    }
  }

  async function handleDownloadMarkdown() {
    try {
      setError('')
      setSuccessMsg('')
      await backupService.downloadMarkdownArchive()
      setSuccessMsg('Markdown archive exported successfully.')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to export markdown.'))
    }
  }

  async function handleImportBackup(e) {
    e.preventDefault()
    if (!importFile) {
      setError('Please select a JSON backup file to restore.')
      return
    }

    if (
      importMode === 'replace' &&
      !window.confirm(
        'Warning: Replace mode will overwrite your current entries with the backup file. Proceed?'
      )
    ) {
      return
    }

    try {
      setImporting(true)
      setError('')
      setSuccessMsg('')

      const result = await backupService.importJsonBackup(importFile, importMode)
      setSuccessMsg(
        `Import completed successfully! Restored ${result.imported} entries (skipped ${result.skipped} existing duplicates).`
      )
      setImportFile(null)

      // Refresh storage stats
      const newStats = await backupService.getStats()
      setStats(newStats)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to import backup.'))
    } finally {
      setImporting(false)
    }
  }

  async function handleSyncVectorIndex() {
    try {
      setSyncing(true)
      setError('')
      setSuccessMsg('')

      const report = await searchService.syncVectorIndex(false)
      const added = report.added?.length ?? 0
      const removed = report.removed?.length ?? 0
      setSuccessMsg(
        report.in_sync
          ? 'Vector search index is in complete sync with SQLite.'
          : `Reconciled vector index: +${added} indexed, -${removed} removed.`
      )
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reconcile search index.'))
    } finally {
      setSyncing(false)
    }
  }

  return (
    <>
      <div className="welcome">
        <div>
          <p className="eyebrow">APPLICATION MANAGEMENT</p>
          <h1>Settings &amp; Data</h1>
          <p className="subtitle">
            Manage your personal data portability, backups, theme appearance, and search indexes.
          </p>
        </div>
        <div className="welcome-icon">
          <Settings size={36} />
        </div>
      </div>

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#edf2e9',
            border: '1px solid #c9d8c4',
            color: '#3d563a',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && <p className="error" style={{ marginBottom: '20px' }}>{error}</p>}

      {/* Storage & Database Metrics */}
      <div
        className="stats"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '24px' }}
      >
        <div className="stat-card">
          <span>Database File Size</span>
          <HardDrive size={18} />
          <strong>{stats ? `${stats.database_size_kb} KB` : '...'}</strong>
        </div>
        <div className="stat-card">
          <span>Total Database Entries</span>
          <Database size={18} />
          <strong>{stats ? stats.total_entries : '...'}</strong>
        </div>
        <div className="stat-card">
          <span>Total Tasks (Open / Done)</span>
          <Archive size={18} />
          <strong>{stats ? `${stats.open_tasks} / ${stats.completed_tasks}` : '...'}</strong>
        </div>
        <div className="stat-card">
          <span>Migrated Task Records</span>
          <FileText size={18} />
          <strong>{stats ? stats.migrated_tasks : '...'}</strong>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Appearance & Preferences */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Appearance &amp; Theme</h2>
              <p>Customize the application visual mode.</p>
            </div>
            <Sun size={20} />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => toggleTheme('light')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: '8px',
                border: theme === 'light' ? '2px solid var(--primary)' : '1px solid var(--border-default)',
                background: theme === 'light' ? 'var(--primary-subtle)' : 'var(--bg-surface)',
                color: theme === 'light' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Sun size={17} />
              <span>Light Mode</span>
            </button>

            <button
              type="button"
              onClick={() => toggleTheme('dark')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: '8px',
                border: theme === 'dark' ? '2px solid var(--primary)' : '1px solid var(--border-default)',
                background: theme === 'dark' ? 'var(--primary-subtle)' : 'var(--bg-surface)',
                color: theme === 'dark' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Moon size={17} />
              <span>Dark Mode</span>
            </button>
          </div>
        </section>

        {/* Vector Search Maintenance */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Vector Search Index</h2>
              <p>Reconcile drift between SQLite and ChromaDB.</p>
            </div>
            <RefreshCw size={20} />
          </div>

          <p style={{ fontSize: '13px', color: '#666', margin: '0 0 16px', lineHeight: 1.5 }}>
            Synchronizes all database entries with local ChromaDB dense embeddings, ensuring hybrid and semantic search are up to date.
          </p>

          <button
            type="button"
            className="primary-btn"
            onClick={handleSyncVectorIndex}
            disabled={syncing}
            style={{ width: '100%' }}
          >
            <RefreshCw size={15} />
            {syncing ? 'Reconciling Index...' : 'Reconcile Search Index'}
          </button>
        </section>

        {/* Data Export Archive */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Export &amp; Portability</h2>
              <p>Download your complete diary records.</p>
            </div>
            <Download size={20} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              className="primary-btn"
              onClick={handleDownloadJson}
              style={{ width: '100%' }}
            >
              <Download size={15} />
              <span>Download JSON Database Backup</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadMarkdown}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #526d50',
                background: '#edf2e9',
                color: '#496447',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <FileText size={15} />
              <span>Export Full Journal Markdown (.md)</span>
            </button>
          </div>
        </section>

        {/* Data Restore / Import */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Restore from Backup</h2>
              <p>Import entries from a JSON backup file.</p>
            </div>
            <Upload size={20} />
          </div>

          <form onSubmit={handleImportBackup}>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="file"
                accept=".json"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #e8e9e3',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '14px', marginBottom: '16px', fontSize: '13px', color: '#555' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="importMode"
                  value="merge"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                />
                <span>Merge (Skip existing)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                />
                <span>Replace (Fresh restore)</span>
              </label>
            </div>

            <button
              type="submit"
              className="primary-btn"
              disabled={importing || !importFile}
              style={{ width: '100%', background: importMode === 'replace' ? '#8a5a44' : '#526d50' }}
            >
              <Upload size={15} />
              {importing ? 'Restoring Entries...' : 'Restore Backup File'}
            </button>
          </form>
        </section>
      </div>
    </>
  )
}

export default SettingsPage
