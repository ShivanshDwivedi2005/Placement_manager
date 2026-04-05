import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Applicants from './pages/Applicants'
import PlacedStudents from './pages/PlacedStudents'
import TrulyUnplaced from './pages/TrulyUnplaced'
import Layout from './components/Layout'

function Protected({ children }) {
  const { isAuth, loading } = useAuth()
  if (loading) return null
  return isAuth ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="applicants" element={<Applicants />} />
        <Route path="placed" element={<PlacedStudents />} />
        <Route path="unplaced" element={<TrulyUnplaced />} />
      </Route>
    </Routes>
  )
}
