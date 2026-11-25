import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ModulePage from './pages/ModulePage'
import OrganizationPage from './pages/OrganizationPage'
import StaffPage from './pages/StaffPage'
import Login from './pages/Login'
import { useAuth } from './contexts/AuthContext'
import { usePermissions } from './contexts/PermissionContext'

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" /><p className="mt-4 text-sm text-slate-500">Đang kiểm tra phiên đăng nhập...</p></div></div>
}

export default function App() {
  const { user, loading } = useAuth()
  const { isBgh, loading: permissionsLoading } = usePermissions()
  if (loading) return <LoadingScreen />
  if (!user) return <Login />
  if (permissionsLoading) return <LoadingScreen />
  if (isBgh && window.location.pathname === '/') return <Navigate to="/bao-cao" replace />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="to-chuc" element={<OrganizationPage />} />
        <Route path="nhan-su" element={<StaffPage />} />
        <Route path="*" element={<ModulePage />} />
      </Route>
    </Routes>
  )
}
