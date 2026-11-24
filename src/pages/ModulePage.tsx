import { Hammer } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { findNav } from '../lib/nav'

export default function ModulePage() {
  const { pathname } = useLocation()
  const item = findNav(pathname)

  if (!item) {
    return (
      <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold text-navy-900">Không tìm thấy trang</h1>
        <p className="mt-2 text-sm text-slate-500">Địa chỉ này không tồn tại trong EDU360. Hãy quay lại trang tổng quan để chọn phân hệ.</p>
        <Link to="/" className="btn-primary mt-5">Về trang tổng quan</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">{item.label}</h1>
        <p className="mt-1 text-sm text-slate-500">{item.description}</p>
      </div>
      <div className="card flex flex-col items-center px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Hammer size={22} />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-800">Phân hệ đang được xây dựng</h2>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          Phân hệ này nằm trong kế hoạch triển khai ({item.phase}). Dữ liệu sẽ dùng chung một cơ sở dữ liệu với các phân hệ khác.
        </p>
        <Link to="/" className="btn-ghost mt-5">Về trang tổng quan</Link>
      </div>
    </div>
  )
}
