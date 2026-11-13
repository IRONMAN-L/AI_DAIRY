import { useCallback, useState } from 'react'
import { getErrorMessage } from '../services/api'
import entriesService from '../services/entriesService'
import searchService from '../services/searchService'

export default function useEntries() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [history, setHistory] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadEntries = useCallback(async (params = { limit: 50, offset: 0 }) => {
    try {
      setLoading(true)
      setError('')
      const data = await entriesService.getEntries(params)
      const list = Array.isArray(data) ? data : []
      setEntries(list)
      return list
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load diary entries.'))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const searchEntries = useCallback(async query => {
    try {
      setLoading(true)
      setError('')
      const data = await searchService.searchKeyword({ q: query, limit: 50 })
      const results = data.results || []
      setEntries(results)
      return results
    } catch (err) {
      setError(getErrorMessage(err, 'Search failed.'))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const createEntry = useCallback(async payload => {
    try {
      setError('')
      const created = await entriesService.createEntry(payload)
      return created
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save entry.'))
      return null
    }
  }, [])

  const updateEntry = useCallback(async (id, payload) => {
    try {
      setError('')
      const updated = await entriesService.updateEntry(id, payload)
      return updated
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update entry.'))
      return null
    }
  }, [])

  const deleteEntry = useCallback(async id => {
    try {
      setError('')
      await entriesService.deleteEntry(id)
      return true
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to delete entry.'))
      return false
    }
  }, [])

  const completeTask = useCallback(async (id, reloadParams = { limit: 50, offset: 0 }) => {
    try {
      setError('')
      await entriesService.updateEntry(id, { status: 'done' })
      await loadEntries(reloadParams)
      return true
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to complete task.'))
      return false
    }
  }, [loadEntries])

  const migrateTask = useCallback(async (id, targetDate, reloadParams = { limit: 50, offset: 0 }) => {
    try {
      setError('')
      await entriesService.migrateTask(id, targetDate)
      await loadEntries(reloadParams)
      return true
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to migrate task.'))
      return false
    }
  }, [loadEntries])

  const showTaskHistory = useCallback(async entry => {
    try {
      setHistoryLoading(true)
      setError('')
      const data = await entriesService.getTaskHistory(entry.id)
      setHistory({
        title: entry.title,
        items: data,
      })
      return true
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load task history.'))
      return false
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const closeTaskHistory = useCallback(() => {
    setHistory(null)
  }, [])

  return {
    entries,
    loading,
    error,
    setError,
    history,
    historyLoading,
    loadEntries,
    searchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    completeTask,
    migrateTask,
    showTaskHistory,
    closeTaskHistory,
  }
}
