import api from './api'

export const journalService = {
  async getDailyJournal(journalDate) {
    const response = await api.get(`/journal/${journalDate}`)
    return response.data
  },

  async getJournalRange(startDate, endDate) {
    const response = await api.get('/journal/range', {
      params: { start_date: startDate, end_date: endDate },
    })
    return response.data
  },

  async getWeeklyStatistics(startDate) {
    const response = await api.get('/journal/weekly', {
      params: { start_date: startDate },
    })
    return response.data
  },

  async getMonthlyStatistics(year, month) {
    const response = await api.get('/journal/monthly', {
      params: { year, month },
    })
    return response.data
  },
}

export default journalService

