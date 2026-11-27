import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Plus, RefreshCw, Send, MapPin, Clock3 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionContext'

type OrgUnit = { id: string; code: string; name: string }
type CalendarEvent = {
  id: string
  org_unit_id: string
  title: string
  description: string | null
  location: string | null
  starts_at: string
  ends_at: string
  all_day: boolean
  status: 'draft' | 'published' | 'cancelled'
  created_by: string
  published_at: string | null
}
const statusLabels: Record<CalendarEvent['status'], string> = {
  draft: 'Bản nháp',
  published: 'Đã công bố',
  cancelled: 'Đã hủy',
}
function toLocalInput(value: Date) {
  const offset = value.getTimezoneOffset()
  return new Date(value.getTime() - offset * 60000).toISOString().slice(0, 16)
}
function monthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function CalendarPage() {
  const { user } = useAuth()
  const { can } = usePermissions()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [units, setUnits] = useState<OrgUnit[]>([])
  const [month, setMonth] = useState(monthValue)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [publishReasons, setPublishReasons] = useState<Record<string, string>>({})
  const [form, setForm] = useState(() => {
    const start = new Date()
    start.setDate(start.getDate() + 1)
    start.setMinutes(0, 0, 0)
    const end = new Date(start)
    end.setHours(end.getHours() + 1)
    return {
      org_unit_id: '',
      title: '',
      description: '',
      location: '',
      starts_at: toLocalInput(start),
      ends_at: toLocalInput(end),
      all_day: false,
    }
  })

  const canCreate = can('tasks', 'create')
  const canPublish = can('tasks', 'approve')
  const unitNames = useMemo(() => new Map(units.map((unit) => [unit.id, unit.name])), [units])

  const loadData = useCallback(async () => {
    if (!supabase) {
      setError('Chưa cấu hình kết nối dữ liệu.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const [unitResult, eventResult] = await Promise.all([
      supabase.from('org_units').select('id,code,name').is('deleted_at', null).eq('is_active', true).order('sort_order'),
      (() => {
        const [year, monthNumber] = month.split('-').map(Number)
        const start = new Date(year, monthNumber - 1, 1)
        const end = new Date(year, monthNumber, 1)
        return supabase.from('calendar_events')
          .select('id,org_unit_id,title,description,location,starts_at,ends_at,all_day,status,created_by,published_at')
          .gte('starts_at', start.toISOString())
          .lt('starts_at', end.toISOString())
          .order('starts_at')
      })(),
    ])
    if (unitResult.error || eventResult.error) {
      setError(unitResult.error?.message ?? eventResult.error?.message ?? 'Không thể tải lịch công tác.')
    } else {
      const nextUnits = (unitResult.data ?? []) as OrgUnit[]
      setUnits(nextUnits)
      setEvents((eventResult.data ?? []) as CalendarEvent[])
      setForm((current) => ({ ...current, org_unit_id: current.org_unit_id || nextUnits[0]?.id || '' }))
    }
    setLoading(false)
  }, [month])

  useEffect(() => { void loadData() }, [loadData])

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !user) return
    if (!form.org_unit_id) {
      setMessage('Chọn đơn vị tổ chức sự kiện.')
      return
    }
    const start = new Date(form.starts_at)
    const end = new Date(form.ends_at)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      setMessage('Thời gian kết thúc phải sau thời gian bắt đầu.')
      return
    }
    setSaving(true)
    setMessage(null)
    const { error: insertError } = await supabase.from('calendar_events').insert({
      org_unit_id: form.org_unit_id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: form.all_day,
      status: 'draft',
      created_by: user.id,
    })
    setSaving(false)
    if (insertError) {
      setMessage(insertError.message)
      return
    }
    setMessage('Đã lưu lịch ở trạng thái bản nháp. Cần người có quyền phê duyệt để công bố.')
    setForm((current) => ({ ...current, title: '', description: '', location: '' }))
    await loadData()
  }

  async function publishEvent(eventId: string) {
    if (!supabase || !canPublish) return
    const reason = (publishReasons[eventId] ?? '').trim()
    if (reason.length < 10) {
      setMessage('Lý do công bố phải có ít nhất 10 ký tự.')
      return
    }
    setSaving(true)
    setMessage(null)
    const { error: publishError } = await supabase.rpc('publish_calendar_event', {
      p_event_id: eventId,
      p_reason: reason,
    })
    setSaving(false)
    if (publishError) {
      setMessage(publishError.message)
      return
    }
    setMessage('Đã công bố lịch công tác.')
    await loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-brand-700"><CalendarDays size={17} /> Điều hành</div>
          <h1 className="mt-1 text-2xl font-semibold text-navy-900">Lịch công tác</h1>
          <p className="mt-1 text-sm text-slate-500">Lịch họp, sự kiện và hoạt động theo đơn vị; lịch chỉ hiển thị sau khi được công bố.</p>
        </div>
        <div className="flex items-center gap-2">
          <input aria-label="Tháng xem lịch" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="field" />
          <button type="button" onClick={() => void loadData()} disabled={loading} className="btn-ghost inline-flex items-center gap-2"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Làm mới</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div>}

      {canCreate && <section className="card space-y-4 p-4">
        <div className="flex items-center gap-2 font-semibold text-navy-900"><Plus size={17} /> Tạo lịch công tác</div>
        <form onSubmit={createEvent} className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-600">Đơn vị tổ chức
            <select required value={form.org_unit_id} onChange={(event) => setForm((v) => ({ ...v, org_unit_id: event.target.value }))} className="field mt-1">
              <option value="">Chọn đơn vị</option>
              {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600">Tên sự kiện
            <input required minLength={3} maxLength={240} value={form.title} onChange={(event) => setForm((v) => ({ ...v, title: event.target.value }))} className="field mt-1" placeholder="Ví dụ: Họp giao ban tuần" />
          </label>
          <label className="text-sm text-slate-600">Bắt đầu
            <input required type="datetime-local" value={form.starts_at} onChange={(event) => setForm((v) => ({ ...v, starts_at: event.target.value }))} className="field mt-1" />
          </label>
          <label className="text-sm text-slate-600">Kết thúc
            <input required type="datetime-local" value={form.ends_at} onChange={(event) => setForm((v) => ({ ...v, ends_at: event.target.value }))} className="field mt-1" />
          </label>
          <label className="text-sm text-slate-600">Địa điểm
            <input maxLength={240} value={form.location} onChange={(event) => setForm((v) => ({ ...v, location: event.target.value }))} className="field mt-1" placeholder="Phòng họp / địa điểm" />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.all_day} onChange={(event) => setForm((v) => ({ ...v, all_day: event.target.checked }))} />
            Sự kiện cả ngày
          </label>
          <label className="text-sm text-slate-600 md:col-span-2">Nội dung / ghi chú
            <textarea rows={3} maxLength={5000} value={form.description} onChange={(event) => setForm((v) => ({ ...v, description: event.target.value }))} className="field mt-1" placeholder="Nội dung, thành phần tham dự, chuẩn bị..." />
          </label>
          <div className="md:col-span-2">
            <button disabled={saving || !units.length} className="btn-primary"><Plus size={14} className="mr-1 inline" /> Lưu bản nháp</button>
          </div>
        </form>
      </section>}

      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-navy-900">Sự kiện trong tháng</h2>
          <span className="text-xs text-slate-500">{events.length} sự kiện</span>
        </div>
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Đang tải lịch...</p> : events.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">Chưa có lịch công tác trong tháng này.</div>
        ) : <div className="divide-y">
          {events.map((item) => (
            <article key={item.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-navy-900">{item.title}</h3>
                  <span className={item.status === 'published' ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700' : 'rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700'}>{statusLabels[item.status]}</span>
                </div>
                <p className="text-xs text-slate-500">{unitNames.get(item.org_unit_id) ?? 'Đơn vị'} · {item.all_day ? 'Cả ngày' : new Date(item.starts_at).toLocaleString('vi-VN')} – {item.all_day ? '' : new Date(item.ends_at).toLocaleString('vi-VN')}</p>
                {item.location && <p className="flex items-center gap-1 text-sm text-slate-600"><MapPin size={14} /> {item.location}</p>}
                {item.description && <p className="whitespace-pre-wrap text-sm text-slate-600">{item.description}</p>}
              </div>
              {item.status === 'draft' && canPublish && <div className="flex min-w-64 flex-col gap-2">
                <input aria-label={`Lý do công bố ${item.title}`} value={publishReasons[item.id] ?? ''} onChange={(event) => setPublishReasons((v) => ({ ...v, [item.id]: event.target.value }))} className="field" placeholder="Lý do công bố (tối thiểu 10 ký tự)" />
                <button type="button" onClick={() => void publishEvent(item.id)} disabled={saving} className="btn-primary"><Send size={14} className="mr-1 inline" /> Công bố lịch</button>
              </div>}
              {item.status === 'published' && <div className="flex items-center gap-1 text-xs text-slate-500"><Clock3 size={14} /> {item.published_at ? new Date(item.published_at).toLocaleString('vi-VN') : 'Đã công bố'}</div>}
            </article>
          ))}
        </div>}
      </section>
      {!canCreate && <p className="text-xs text-slate-400">Bạn đang ở chế độ chỉ xem. Quyền tạo và công bố lịch do quản trị viên phân công.</p>}
    </div>
  )
}
