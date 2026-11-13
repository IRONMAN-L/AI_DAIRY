import api from './api'

export const mediaService = {
  async extractImageText(file) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/media/ocr', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  async transcribeAudio(file) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/media/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  async extractDocumentText(file) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/media/extract-doc', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
}

export default mediaService

