import axios from 'axios'

const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '')
const configuredBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL)

if (!configuredBaseUrl && !import.meta.env.DEV) {
  // Vercel deployments should point this to the Render backend URL.
  console.warn('VITE_API_URL is not set. Production API requests will use the current origin.')
}

const BASE = configuredBaseUrl || '/api'

const api = axios.create({
  baseURL: BASE,
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
