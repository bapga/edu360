import { ChevronsLeft, ChevronsRight, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { navGroups } from '../lib/nav'
import { usePermissions } from '../contexts/PermissionContext'

const moduleByPath: Record<string, string> = {
  '/to-chuc': 'org', '/nhan-su': 'hr', '/hanh-chinh': 'admin_docs',
  '/tuyen-sinh': 'admissions', '/dao-tao': 'training', '/giang-day': 'training', '/nguoi-hoc/diem': 'grades', '/tai-chinh': 'finance', '/tai-san': 'assets', '/nguoi-hoc': 'students',
  '/cong-viec': 'tasks', '/lich-cong-tac': 'tasks', '/van-ban': 'admin_docs',
  '/bao-cao': 'reports', '/ai-office': 'ai_office', '/quan-tri': 'system',
}
interface Props { collapsed: boolean; mobileOpen: boolean; onToggleCollapse: () => void; onCloseMobile: () => void }

export default function Sidebar({ collapsed, mobileOpen, onToggleCollapse, onCloseMobile }: Props) {
  const { can, loading, isBgh } = usePermissions()
  const visibleGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.path === '/') return !isBgh
      if (loading) return false
      if (item.path === '/nguoi-hoc') return can('students', 'view') || can('grades', 'view')
      return can(moduleByPath[item.path] ?? '', 'view')
    }),
  })).filter((group) => group.items.length > 0)

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-navy-950/50 lg:hidden" onClick={onCloseMobile} aria-hidden="true" />}
      <aside aria-label="Điều hướng chính" className={[
        'fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-navy-900 text-slate-200 transition-all duration-200',
        mobileOpen ? 'translate-x-0' : '-translate-x-full', 'lg:static lg:translate-x-0',
        collapsed ? 'lg:w-[72px]' : 'lg:w-64',
      ].join(' ')}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <img src="/favicon.svg" alt="" className="h-9 w-9 shrink-0 rounded-lg" />
            <div className={['leading-tight', collapsed ? 'lg:hidden' : ''].join(' ')}>
              <div className="text-base font-semibold tracking-wide text-white">EDU360</div>
              <div className="text-xs text-slate-400">Quản trị trường học</div>
            </div>
          </div>
          <button type="button" onClick={onCloseMobile} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden" aria-label="Đóng menu"><X size={20} /></button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <div className={['mb-1.5 px-3 text-xs font-medium text-slate-400', collapsed ? 'lg:hidden' : ''].join(' ')}>{group.title}</div>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.path}>
                    <NavLink to={item.path} end={item.path === '/'} onClick={onCloseMobile} title={collapsed ? item.label : undefined}
                      className={({ isActive }) => [
                        'flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                        collapsed ? 'lg:justify-center' : '',
                        isActive ? 'bg-brand-600 font-medium text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white',
                      ].join(' ')}>
                      <item.icon size={20} className="shrink-0" /><span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <button type="button" onClick={onToggleCollapse} className="hidden h-12 shrink-0 items-center justify-center gap-2 border-t border-white/10 text-sm text-slate-300 hover:bg-white/10 lg:flex" aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}>
          {collapsed ? <ChevronsRight size={18} /> : <><ChevronsLeft size={18} /> Thu gọn</>}
        </button>
      </aside>
    </>
  )
}
