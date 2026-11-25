import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ModulePage from './pages/ModulePage'
import OrganizationPage from './pages/OrganizationPage'
import StaffPage from './pages/StaffPage'
import SystemAdminPage from './pages/SystemAdminPage'
import ReportsPage from './pages/ReportsPage'
import Login from './pages/Login'
import { useAuth } from './contexts/AuthContext'
import { usePermissions } from './contexts/PermissionContext'

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" /><p className="mt-4 text-sm text-slate-500">Đang kiểm tra phiên đăng nhập...</p></div></div>
}

export default function App() {
  const { user, loading } = useAuth()
  const { isBgh, permissions, profileStatus, error: permissionError, loading: permissionsLoading } = usePermissions()
  if (loading) return <LoadingScreen />
  if (!user) return <Login />
  if (permissionsLoading) return <LoadingScreen />
  if (permissionError) return <div className="flex min-h-screen items-center justify-center p-6 text-center"><div><h1 className="font-semibold text-red-700">Không thể xác minh quyền truy cập</h1><p className="mt-2 text-sm text-slate-500">{permissionError}</p></div></div>
  if (profileStatus !== 'active') return <div className="flex min-h-screen items-center justify-center p-6 text-center"><div><h1 className="font-semibold text-navy-900">Tài khoản chưa được kích hoạt</h1><p className="mt-2 text-sm text-slate-500">Vui lòng liên hệ quản trị hệ thống.</p></div></div>
  if (permissions.length === 0) return <div className="flex min-h-screen items-center justify-center p-6 text-center"><div><h1 className="font-semibold text-navy-900">Chưa được phân quyền</h1><p className="mt-2 text-sm text-slate-500">Tài khoản chưa có quyền truy cập phân hệ nào. Vui lòng liên hệ Admin.</p></div></div>
  if (isBgh && window.location.pathname === '/') return <Navigate to="/bao-cao" replace />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="to-chuc" element={<OrganizationPage />} />
        <Route path="nhan-su" element={<StaffPage />} />
        <Route path="quan-tri" element={<SystemAdminPage />} />
        <Route path="bao-cao" element={<ReportsPage />} />
        <Route path="*" element={<ModulePage />} />
      </Route>
    </Routes>
  )
}
