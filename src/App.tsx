import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ModulePage from './pages/ModulePage'
import Login from './pages/Login'
import { useAuth } from './contexts/AuthContext'

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" /><p className="mt-4 text-sm text-slate-500">Đang kiểm tra phiên đăng nhập...</p></div></div>
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Login />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="*" element={<ModulePage />} />
      </Route>
    </Routes>
  )
}
