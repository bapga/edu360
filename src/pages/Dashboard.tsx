import { CalendarDays, CheckCircle2, Clock, Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'
import { demo, showDemoData, type Tone } from '../lib/demo'
import { allNavItems } from '../lib/nav'
import { usePermissions } from '../contexts/PermissionContext'

const toneBar: Record<Tone, string> = {
  blue: 'bg-brand-600',
  navy: 'bg-navy-800',
  green: 'bg-emerald-500',
  orange: 'bg-amber-500',
}

const statusStyle: Record<string, string> = {
  'Hoàn thành': 'bg-emerald-50 text-emerald-700',
  'Đang thực hiện': 'bg-brand-50 text-brand-700',
  'Quá hạn': 'bg-red-50 text-red-700',
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <Inbox size={28} className="text-slate-300" />
      <div className="mt-3 text-sm font-medium text-slate-700">{title}</div>
      <div className="mt-1 max-w-xs text-sm text-slate-500">{hint}</div>
    </div>
  )
}

export default function Dashboard() {
  const { can } = usePermissions()
  const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const quick = [
    { path: '/nhan-su', module: 'hr' },
    { path: '/dao-tao', module: 'training' },
    { path: '/nguoi-hoc', module: 'students' },
    { path: '/van-ban', module: 'admin_docs' },
  ].filter((item) => can(item.module, 'view') || (item.module === 'students' && can('grades', 'view')))
    .map(({ path }) => allNavItems.find((i) => i.path === path)!)
  const maxFaculty = Math.max(...demo.faculties.map((f) => f.value))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Tổng quan toàn trường</h1>
          <p className="mt-1 text-sm capitalize text-slate-500">{today}</p>
        </div>
        {showDemoData && (
          <span className="badge bg-amber-50 text-amber-700">Đang hiển thị dữ liệu mẫu</span>
        )}
      </div>

      <section aria-label="Chỉ số chính" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {showDemoData
          ? demo.kpis.map((k) => (
              <div key={k.label} className="card overflow-hidden">
                <div className={`h-1 ${toneBar[k.tone]}`} />
                <div className="p-5">
                  <div className="text-sm text-slate-500">{k.label}</div>
                  <div className="mt-2 text-3xl font-semibold text-navy-900">{k.value}</div>
                  <div className="mt-1 text-xs text-slate-500">{k.note}</div>
                </div>
              </div>
            ))
          : ['Học sinh đang học', 'Cán bộ, giáo viên', 'Lớp đang hoạt động', 'Công việc quá hạn'].map((l) => (
              <div key={l} className="card p-5">
                <div className="text-sm text-slate-500">{l}</div>
                <div className="mt-2 text-3xl font-semibold text-slate-300">—</div>
                <div className="mt-1 text-xs text-slate-500">Chưa có dữ liệu</div>
              </div>
            ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2" aria-label="Tiến độ công việc">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-navy-900">Tiến độ công việc</h2>
            <Link to="/cong-viec" className="text-sm font-medium text-brand-600 hover:text-brand-700">Xem tất cả</Link>
          </div>
          {showDemoData ? (
            <ul className="divide-y divide-slate-100">
              {demo.tasks.map((t) => (
                <li key={t.title} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{t.title}</div>
                      <div className="text-xs text-slate-500">{t.owner}</div>
                    </div>
                    <span className={`badge ${statusStyle[t.status] ?? 'bg-slate-100 text-slate-600'}`}>{t.status}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${t.status === 'Quá hạn' ? 'bg-amber-500' : t.progress === 100 ? 'bg-emerald-500' : 'bg-brand-600'}`}
                        style={{ width: `${t.progress}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-medium text-slate-600">{t.progress}%</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Chưa có công việc nào" hint="Công việc được giao sẽ hiển thị tại đây cùng tiến độ thực hiện." />
          )}
        </section>

        <section className="card" aria-label="Lịch công tác hôm nay">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <CalendarDays size={18} className="text-brand-600" />
            <h2 className="font-semibold text-navy-900">Lịch công tác hôm nay</h2>
          </div>
          {showDemoData ? (
            <ul className="divide-y divide-slate-100">
              {demo.schedule.map((s) => (
                <li key={s.time} className="flex gap-4 px-5 py-3.5">
                  <div className="w-12 shrink-0 text-sm font-semibold text-brand-700">{s.time}</div>
                  <div>
                    <div className="text-sm text-slate-800">{s.title}</div>
                    <div className="text-xs text-slate-500">{s.place}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Hôm nay chưa có lịch" hint="Lịch họp và lịch công tác sẽ xuất hiện khi được tạo." />
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2" aria-label="Học sinh theo khoa">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-navy-900">Quy mô học sinh theo khoa</h2>
          </div>
          {showDemoData ? (
            <ul className="space-y-4 p-5">
              {demo.faculties.map((f) => (
                <li key={f.name}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="text-slate-700">{f.name}</span>
                    <span className="font-medium text-navy-900">{f.value.toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-navy-800" style={{ width: `${(f.value / maxFaculty) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Chưa có số liệu học sinh" hint="Biểu đồ sẽ hiển thị sau khi nhập hồ sơ người học và lớp học." />
          )}
        </section>

        <section className="card" aria-label="Hoạt động gần đây">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Clock size={18} className="text-brand-600" />
            <h2 className="font-semibold text-navy-900">Hoạt động gần đây</h2>
          </div>
          {showDemoData ? (
            <ul className="divide-y divide-slate-100">
              {demo.activity.map((a) => (
                <li key={a.text} className="flex gap-3 px-5 py-3.5">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                  <div>
                    <div className="text-sm text-slate-800">{a.text}</div>
                    <div className="text-xs text-slate-500">{a.time}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Chưa có hoạt động" hint="Các thao tác quan trọng sẽ được ghi nhận tại đây." />
          )}
        </section>
      </div>

      <section aria-label="Thao tác nhanh">
        <h2 className="mb-3 font-semibold text-navy-900">Thao tác nhanh</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quick.map((q) => (
            <Link key={q.path} to={q.path} className="card flex min-h-[64px] items-center gap-3 p-4 hover:border-brand-500 hover:bg-brand-50">
              <q.icon size={22} className="shrink-0 text-brand-600" />
              <span className="text-sm font-medium text-slate-800">{q.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
