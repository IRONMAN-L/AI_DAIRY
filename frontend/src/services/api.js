import axios from 'axios'

export const TOKEN_STORAGE_KEY = 'daybook_token'
export const USER_STORAGE_KEY = 'daybook_user'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach Bearer token from localStorage to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 unauthorized session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRoute =
      error.config?.url?.includes('/auth/login') ||
      error.config?.url?.includes('/auth/signup')

    if (error.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      localStorage.removeItem(USER_STORAGE_KEY)
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
    return Promise.reject(error)
  }
)

export function getErrorMessage(error, fallback = 'An unexpected error occurred.') {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d) => d.msg || d.detail || JSON.stringify(d)).join(', ')
  }
  return error.message || fallback
}

export default api
