import { Link } from 'react-router-dom'
import { usePermissions, type PermissionAction } from '../contexts/PermissionContext'

interface Props {
  moduleCode: string
  action?: PermissionAction
  children: React.ReactNode
}
export default function AccessGate({ moduleCode, action = 'view', children }: Props) {
  const { can, loading, error, profileStatus } = usePermissions()
  if (loading) return <div className="card p-8 text-center text-sm text-slate-500">Đang kiểm tra quyền truy cập...</div>
  if (error) return <div role="alert" className="card p-6"><h1 className="font-semibold text-red-700">Không thể xác minh quyền</h1><p className="mt-2 text-sm text-slate-600">{error}</p><p className="mt-2 text-xs text-slate-500">Hệ thống tạm khóa truy cập để bảo vệ dữ liệu. Vui lòng tải lại trang hoặc liên hệ quản trị.</p></div>
  if (profileStatus !== 'active') return <div className="card p-8 text-center"><h1 className="font-semibold text-navy-900">Tài khoản chưa được kích hoạt</h1><p className="mt-2 text-sm text-slate-500">Vui lòng liên hệ quản trị hệ thống.</p></div>
  if (!can(moduleCode, action)) return <div className="card mx-auto mt-8 max-w-lg p-8 text-center"><h1 className="text-xl font-semibold text-navy-900">Không có quyền truy cập</h1><p className="mt-2 text-sm text-slate-500">Tài khoản của bạn chưa được cấp quyền xem phân hệ này.</p><Link to="/" className="btn-primary mt-5 inline-flex">Về trang tổng quan</Link></div>
  return <>{children}</>
}
