import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import AccessGate from './AccessGate'
import { usePermissions } from '../contexts/PermissionContext'

const routeModules: Record<string, string> = {
  '/to-chuc': 'org', '/nhan-su': 'hr', '/hanh-chinh': 'admin_docs',
  '/tuyen-sinh': 'admissions', '/dao-tao': 'training', '/giang-day': 'teaching',
  '/nguoi-hoc/diem': 'grades', '/tai-chinh': 'finance', '/tai-san': 'assets', '/nguoi-hoc': 'students',
  '/cong-viec': 'tasks', '/lich-cong-tac': 'tasks', '/van-ban': 'admin_docs',
  '/bao-cao': 'reports', '/ai-office': 'ai_office', '/quan-tri': 'system',
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const { can } = usePermissions()
  const moduleCode = pathname === '/nguoi-hoc' && !can('students', 'view') && can('grades', 'view')
    ? 'grades'
    : Object.entries(routeModules).find(([path]) => pathname === path || pathname.startsWith(path + '/'))?.[1]
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((v) => !v)} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <AccessGate moduleCode={moduleCode}><Outlet /></AccessGate>
          </div>
        </main>
      </div>
    </div>
  )
}
