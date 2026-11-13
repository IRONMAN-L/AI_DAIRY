import api, { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from './api'

export const authService = {
  async signup({ email, password, fullName }) {
    const response = await api.post('/auth/signup', {
      email,
      password,
      full_name: fullName || null,
    })
    const { access_token, user } = response.data
    if (access_token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, access_token)
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
    }
    return { token: access_token, user }
  },

  async login({ email, password }) {
    const response = await api.post('/auth/login', {
      email,
      password,
    })
    const { access_token, user } = response.data
    if (access_token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, access_token)
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
    }
    return { token: access_token, user }
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me')
    const user = response.data
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
    }
    return user
  },

  logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
  },

  getStoredToken() {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  },

  getStoredUser() {
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
}

export default authService

