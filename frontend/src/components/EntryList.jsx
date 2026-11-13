import { RefreshCw, Search } from 'lucide-react'
import EntryCard from './EntryCard'

function EntryList({
  entries,
  loading,
  error,
  query,
  setQuery,
  searchEntries,
  clearSearch,
  completeTask,
  migrateTask,
  showTaskHistory,
  historyLoading,
  editEntry,
  deleteEntry,
}) {
  return (
    <section className="panel entries-panel">
      <div className="panel-heading">
        <div>
          <h2>Your entries</h2>
          <p>Your latest journal activity.</p>
        </div>

        <button
          className="icon-btn"
          onClick={clearSearch}
          type="button"
          title="Refresh entries"
        >
          <RefreshCw size={17} />
        </button>
      </div>

      <form className="search-box" onSubmit={searchEntries}>
        <Search size={18} />
        <input
          type="text"
          placeholder="Search your journal..."
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      {query && (
        <button className="icon-btn" type="button" onClick={clearSearch}>
          Clear search
        </button>
      )}

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading entries...</p>
      ) : entries.length === 0 ? (
        <p className="empty">No entries found. Create your first one!</p>
      ) : (
        <div className="entry-list">
          {entries.map(result => {
            const item = result.entry ?? result

            return (
              <EntryCard
                key={item.id}
                result={result}
                completeTask={completeTask}
                migrateTask={migrateTask}
                showTaskHistory={showTaskHistory}
                historyLoading={historyLoading}
                editEntry={editEntry}
                deleteEntry={deleteEntry}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

export default EntryList
