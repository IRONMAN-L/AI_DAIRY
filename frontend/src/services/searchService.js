import api from './api'

export const searchService = {
  async searchKeyword(params) {
    const response = await api.get('/search/', { params })
    return response.data
  },

  async searchSemantic(params) {
    const response = await api.get('/search/semantic', { params })
    return response.data
  },

  async searchHybrid(params) {
    const response = await api.get('/search/hybrid', { params })
    return response.data
  },

  async syncVectorIndex(dryRun = false) {
    const response = await api.post('/search/sync', null, {
      params: { dry_run: dryRun },
    })
    return response.data
  },
}

export default searchService

