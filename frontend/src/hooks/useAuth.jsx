import { createContext, useContext, useState, useEffect } from 'react'
import api from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
    setLoading(false)
  }, [token])

  const login = async (password) => {
    const res = await api.post('/auth/login', { password })
    setToken(res.data.access_token)
    return res.data
  }

  const logout = () => setToken(null)

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuth: !!token, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
