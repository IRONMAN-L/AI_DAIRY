import api from './api'

export const entriesService = {
  async getEntries(params = {}) {
    const response = await api.get('/entries/', { params })
    return response.data
  },

  async getEntryById(id) {
    const response = await api.get(`/entries/${id}`)
    return response.data
  },

  async createEntry(payload) {
    const response = await api.post('/entries/', payload)
    return response.data
  },

  async updateEntry(id, payload) {
    const response = await api.put(`/entries/${id}`, payload)
    return response.data
  },

  async deleteEntry(id) {
    const response = await api.delete(`/entries/${id}`)
    return response.data
  },

  async migrateTask(id, targetDate) {
    const response = await api.post(`/entries/${id}/migrate`, {
      target_date: targetDate,
    })
    return response.data
  },

  async getTaskHistory(id) {
    const response = await api.get(`/entries/${id}/history`)
    return response.data
  },
}

export default entriesService

