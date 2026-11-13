import api from './api'

export const assistantService = {
  async chat(message, history = []) {
    const response = await api.post('/assistant/chat', {
      message,
      history,
    })
    return response.data
  },
}

export default assistantService

