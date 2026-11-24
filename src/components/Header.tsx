import { Bell, ChevronRight, Menu, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { demo, showDemoData } from '../lib/demo'
import { allNavItems, findNav } from '../lib/nav'

export default function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const [query, setQuery] = useState('')
  const [bellOpen, setBellOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const current = findNav(pathname)
  const notifications = showDemoData ? demo.notifications : []

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim().toLowerCase()
    if (!q) return
    const hit = allNavItems.find((i) => i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    if (hit) {
      navigate(hit.path)
      setQuery('')
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <button type="button" onClick={onOpenMenu} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Mở menu">
        <Menu size={22} />
      </button>

      <nav aria-label="Vị trí hiện tại" className="hidden min-w-0 items-center gap-1.5 text-sm text-slate-500 sm:flex">
        <Link to="/" className="hover:text-brand-600">EDU360</Link>
        {current && current.path !== '/' && (
          <>
            <ChevronRight size={14} />
            <span className="truncate font-medium text-slate-800">{current.label}</span>
          </>
        )}
      </nav>

      <form onSubmit={onSearch} role="search" className="ml-auto flex-1 sm:max-w-md">
        <label htmlFor="global-search" className="sr-only">Tìm kiếm trong hệ thống</label>
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="global-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm phân hệ, ví dụ: điểm, nhân sự..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none"
          />
        </div>
      </form>

      <div className="relative">
        <button
          type="button"
          onClick={() => setBellOpen((v) => !v)}
          className="relative rounded-lg p-2.5 text-slate-600 hover:bg-slate-100"
          aria-label="Thông báo"
          aria-expanded={bellOpen}
        >
          <Bell size={20} />
          {notifications.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />}
        </button>
        {bellOpen && (
          <div className="card absolute right-0 mt-2 w-72 p-2 shadow-lg">
            <div className="px-3 py-2 text-sm font-semibold text-slate-800">Thông báo</div>
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-slate-500">Chưa có thông báo mới.</div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n.title} className="rounded-lg px-3 py-2 hover:bg-slate-50">
                    <div className="text-sm text-slate-800">{n.title}</div>
                    <div className="text-xs text-slate-500">{n.time}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-white" aria-hidden="true">K</div>
        <div className="hidden leading-tight md:block">
          <div className="text-sm font-medium text-slate-800">Khách</div>
          <div className="text-xs text-slate-500">Chưa đăng nhập</div>
        </div>
      </div>
    </header>
  )
}
