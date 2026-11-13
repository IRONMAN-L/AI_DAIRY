import api from './api'

export const backupService = {
  async getStats() {
    const response = await api.get('/backup/stats')
    return response.data
  },

  async downloadJsonBackup() {
    const response = await api.get('/backup/export', {
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `diary_backup_${new Date().toISOString().slice(0, 10)}.json`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },

  async downloadMarkdownArchive() {
    const response = await api.get('/backup/markdown', {
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `journal_archive_${new Date().toISOString().slice(0, 10)}.md`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },

  async importJsonBackup(file, mode = 'merge') {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post(`/backup/import?mode=${mode}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
}

export default backupService

