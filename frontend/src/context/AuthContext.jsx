/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import authService from '../services/authService'

const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
})

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => authService.getStoredToken())
  const [user, setUser] = useState(() => authService.getStoredUser())
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    authService.logout()
    setToken(null)
    setUser(null)
  }, [])

  // Validate session on boot if a token exists
  useEffect(() => {
    let isMounted = true

    async function validateSession() {
      const storedToken = authService.getStoredToken()
      if (!storedToken) {
        if (isMounted) {
          setUser(null)
          setToken(null)
          setIsLoading(false)
        }
        return
      }

      try {
        const currentUser = await authService.getCurrentUser()
        if (isMounted) {
          setUser(currentUser)
          setToken(storedToken)
        }
      } catch (err) {
        console.warn('Session expired or invalid, logging out', err)
        if (isMounted) {
          authService.logout()
          setUser(null)
          setToken(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    validateSession()

    const handleExpired = () => {
      logout()
    }
    window.addEventListener('auth:expired', handleExpired)

    return () => {
      isMounted = false
      window.removeEventListener('auth:expired', handleExpired)
    }
  }, [logout])

  const login = async (email, password) => {
    const result = await authService.login({ email, password })
    setToken(result.token)
    setUser(result.user)
    return result
  }

  const signup = async (email, password, fullName) => {
    const result = await authService.signup({ email, password, fullName })
    setToken(result.token)
    setUser(result.user)
    return result
  }

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    login,
    signup,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

