import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BriefcaseBusiness, Plus, RefreshCw, Search, Users, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePermissions } from '../contexts/PermissionContext'

type StaffStatus = 'active' | 'on_leave' | 'resigned' | 'retired'
type Gender = 'male' | 'female' | 'other'
interface Staff {
  id: string
  staff_code: string
  full_name: string
  date_of_birth: string | null
  gender: Gender | null
  national_id: string | null
  phone: string | null
  email: string | null
  address: string | null
  status: StaffStatus
}
interface Assignment {
  id: string
  staff_id: string
  org_unit_id: string
  position_title: string | null
  is_primary: boolean
  start_date: string
  end_date: string | null
  status: 'active' | 'ended'
  org_units: { name: string; code: string } | null
}
interface OrgUnitOption { id: string; code: string; name: string }
interface AssignmentForm { org_unit_id: string; position_title: string; is_primary: boolean; start_date: string; end_date: string; status: 'active' | 'ended' }
const emptyAssignment: AssignmentForm = { org_unit_id: '', position_title: '', is_primary: false, start_date: new Date().toISOString().slice(0, 10), end_date: '', status: 'active' }
interface StaffForm {
  staff_code: string
  full_name: string
  date_of_birth: string
  gender: '' | Gender
  national_id: string
  phone: string
  email: string
  address: string
  status: StaffStatus
}
const emptyForm: StaffForm = {
  staff_code: '', full_name: '', date_of_birth: '', gender: '',
  national_id: '', phone: '', email: '', address: '', status: 'active',
}
const statusLabels: Record<StaffStatus, string> = {
  active: 'Đang công tác', on_leave: 'Nghỉ chế độ', resigned: 'Đã thôi việc', retired: 'Đã nghỉ hưu',
}
const statusStyles: Record<StaffStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  on_leave: 'bg-amber-50 text-amber-700',
  resigned: 'bg-slate-100 text-slate-600',
  retired: 'bg-slate-100 text-slate-600',
}

export default function StaffPage() {
  const { can } = usePermissions()
  const [staff, setStaff] = useState<Staff[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [orgUnits, setOrgUnits] = useState<OrgUnitOption[]>([])
  const [assignmentTarget, setAssignmentTarget] = useState<Staff | null>(null)
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>(emptyAssignment)
  const [assignmentError, setAssignmentError] = useState<string | null>(null)
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | StaffStatus>('all')
  const [editing, setEditing] = useState<Staff | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<StaffForm>(emptyForm)

  const loadStaff = useCallback(async () => {
    if (!supabase) {
      setError('Chưa cấu hình kết nối cơ sở dữ liệu.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const [staffResult, assignmentResult, unitsResult] = await Promise.all([
      supabase.from('staff')
        .select('id,staff_code,full_name,date_of_birth,gender,national_id,phone,email,address,status')
        .is('deleted_at', null)
        .order('full_name', { ascending: true }),
      supabase.from('staff_assignments')
        .select('id,staff_id,org_unit_id,position_title,is_primary,start_date,end_date,status,org_units(name,code)')
        .order('start_date', { ascending: false }),
      supabase.from('org_units').select('id,code,name').is('deleted_at', null).eq('is_active', true).order('sort_order'),
    ])
    if (unitsResult.error) setOrgUnits([])
    else setOrgUnits((unitsResult.data ?? []) as OrgUnitOption[])
    if (staffResult.error) {
      setError(staffResult.error.message)
      setStaff([])
      setAssignments([])
    } else {
      setStaff((staffResult.data ?? []) as Staff[])
      if (assignmentResult.error) {
        setError('Đã tải hồ sơ nhân sự nhưng không tải được phân công: ' + assignmentResult.error.message)
        setAssignments([])
      } else {
        setAssignments((assignmentResult.data ?? []) as unknown as Assignment[])
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => { void loadStaff() }, [loadStaff])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi')
    return staff.filter((person) => {
      if (statusFilter !== 'all' && person.status !== statusFilter) return false
      if (!keyword) return true
      return [person.staff_code, person.full_name, person.email ?? '', person.phone ?? '']
        .some((value) => value.toLocaleLowerCase('vi').includes(keyword))
    })
  }, [staff, search, statusFilter])

  const assignmentByStaff = useMemo(() => {
    const map = new Map<string, Assignment[]>()
    assignments.forEach((assignment) => {
      const current = map.get(assignment.staff_id) ?? []
      current.push(assignment)
      map.set(assignment.staff_id, current)
    })
    return map
  }, [assignments])

  const activeCount = staff.filter((person) => person.status === 'active').length
  const canCreate = can('hr', 'create')
  const canUpdate = can('hr', 'update')

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(person: Staff) {
    setEditing(person)
    setForm({
      staff_code: person.staff_code,
      full_name: person.full_name,
      date_of_birth: person.date_of_birth ?? '',
      gender: person.gender ?? '',
      national_id: person.national_id ?? '',
      phone: person.phone ?? '',
      email: person.email ?? '',
      address: person.address ?? '',
      status: person.status,
    })
    setFormError(null)
    setFormOpen(true)
  }

  function openAssignment(person: Staff) {
    setAssignmentTarget(person)
    setAssignmentForm(emptyAssignment)
    setAssignmentError(null)
    setAssignmentOpen(true)
  }

  async function saveAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !assignmentTarget) return
    if (!assignmentForm.org_unit_id) {
      setAssignmentError('Vui lòng chọn đơn vị công tác.')
      return
    }
    if (!assignmentForm.start_date || (assignmentForm.end_date && assignmentForm.end_date < assignmentForm.start_date)) {
      setAssignmentError('Ngày kết thúc không được trước ngày bắt đầu.')
      return
    }
    if (assignmentForm.status === 'ended' && !assignmentForm.end_date) {
      setAssignmentError('Phân công đã kết thúc phải có ngày kết thúc.')
      return
    }
    setAssignmentSaving(true)
    setAssignmentError(null)
    const { error: insertError } = await supabase.from('staff_assignments').insert({
      staff_id: assignmentTarget.id,
      org_unit_id: assignmentForm.org_unit_id,
      position_title: assignmentForm.position_title.trim() || null,
      is_primary: assignmentForm.is_primary,
      start_date: assignmentForm.start_date,
      end_date: assignmentForm.end_date || null,
      status: assignmentForm.status,
    })
    setAssignmentSaving(false)
    if (insertError) {
      setAssignmentError(insertError.code === '23505'
        ? 'Phân công bị trùng hoặc nhân sự đã có một phân công chính đang hiệu lực.'
        : insertError.message)
      return
    }
    setAssignmentOpen(false)
    setAssignmentTarget(null)
    await loadStaff()
  }

  async function endAssignment(assignment: Assignment) {
    if (!supabase || !canUpdate) return
    const now = new Date()
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
    const endDate = today < assignment.start_date ? assignment.start_date : today
    const { error: updateError } = await supabase.from('staff_assignments')
      .update({ status: 'ended', end_date: endDate, is_primary: false })
      .eq('id', assignment.id)
      .eq('status', 'active')
    if (updateError) {
      setError(updateError.message)
      return
    }
    await loadStaff()
  }

  async function saveStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const staffCode = form.staff_code.trim().toUpperCase()
    const fullName = form.full_name.trim()
    if (!staffCode || !/^[A-Z0-9_-]+$/.test(staffCode)) {
      setFormError('Mã nhân sự chỉ gồm chữ in hoa, số, dấu gạch dưới hoặc gạch ngang.')
      return
    }
    if (!fullName) {
      setFormError('Vui lòng nhập họ và tên.')
      return
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setFormError('Địa chỉ email chưa đúng định dạng.')
      return
    }
    setSaving(true)
    setFormError(null)
    const payload = {
      staff_code: staffCode,
      full_name: fullName,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      national_id: form.national_id.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      status: form.status,
    }
    const result = editing
      ? await supabase.from('staff').update(payload).eq('id', editing.id).is('deleted_at', null)
      : await supabase.from('staff').insert(payload)
    setSaving(false)
    if (result.error) {
      if (result.error.code === '23505') {
        setFormError(result.error.message.includes('national_id')
          ? 'Số định danh đã được sử dụng cho hồ sơ khác.'
          : 'Mã nhân sự hoặc tài khoản liên kết đã tồn tại.')
      } else {
        setFormError(result.error.message)
      }
      return
    }
    setFormOpen(false)
    setEditing(null)
    setForm(emptyForm)
    await loadStaff()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-brand-700"><BriefcaseBusiness size={17} /> Tổ chức - Cán bộ</div>
          <h1 className="mt-1 text-2xl font-semibold text-navy-900">Quản lý nhân sự</h1>
          <p className="mt-1 text-sm text-slate-500">Hồ sơ nhân sự gốc và các phân công công tác trong trường.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadStaff()} disabled={loading} className="btn-ghost inline-flex items-center gap-2">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm mới
          </button>
          {canCreate && <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-2"><Plus size={16} /> Thêm nhân sự</button>}
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Thống kê nhân sự">
        <div className="card flex items-center gap-4 p-4">
          <div className="rounded-xl bg-brand-50 p-3 text-brand-700"><Users size={22} /></div>
          <div><div className="text-sm text-slate-500">Tổng hồ sơ</div><div className="text-2xl font-semibold text-navy-900">{staff.length}</div></div>
        </div>
        <div className="card flex items-center gap-4 p-4">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><BriefcaseBusiness size={22} /></div>
          <div><div className="text-sm text-slate-500">Đang công tác</div><div className="text-2xl font-semibold text-navy-900">{activeCount}</div></div>
        </div>
        <div className="card flex items-center gap-4 p-4">
          <div className="rounded-xl bg-amber-50 p-3 text-amber-700"><Users size={22} /></div>
          <div><div className="text-sm text-slate-500">Phân công công tác</div><div className="text-2xl font-semibold text-navy-900">{assignments.length}</div></div>
        </div>
      </section>

      <section className="card space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Tìm nhân sự</span>
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo mã, họ tên, email hoặc số điện thoại..." className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400" />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | StaffStatus)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:w-52" aria-label="Lọc trạng thái">
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Đang tải hồ sơ nhân sự...</div>
        ) : error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <div className="font-semibold">Không tải được dữ liệu nhân sự</div>
            <p className="mt-1">{error}</p>
            <button type="button" onClick={() => void loadStaff()} className="mt-3 font-semibold underline">Thử lại</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Users size={30} className="mx-auto text-slate-300" />
            <div className="mt-3 font-medium text-slate-700">{staff.length === 0 ? 'Chưa có hồ sơ nhân sự' : 'Không tìm thấy kết quả'}</div>
            <p className="mt-1 text-sm text-slate-500">{staff.length === 0 ? 'Hồ sơ sẽ được tạo tại đây và dùng chung cho các phân hệ khác.' : 'Thử thay đổi từ khóa hoặc bộ lọc.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">Mã nhân sự</th><th className="px-3 py-3">Họ và tên</th><th className="px-3 py-3">Đơn vị / chức vụ</th><th className="px-3 py-3">Liên hệ</th><th className="px-3 py-3">Trạng thái</th><th className="px-3 py-3 text-right">Thao tác</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((person) => {
                  const personAssignments = assignmentByStaff.get(person.id) ?? []
                  const primary = personAssignments.find((assignment) => assignment.is_primary && assignment.status === 'active') ?? personAssignments[0]
                  return <tr key={person.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-brand-700">{person.staff_code}</td>
                    <td className="px-3 py-3"><div className="font-medium text-navy-900">{person.full_name}</div><div className="mt-0.5 text-xs text-slate-500">{person.email ?? 'Chưa có email'}</div></td>
                    <td className="px-3 py-3">
                      <div className="text-slate-700">{primary?.org_units?.name ?? 'Chưa phân công'}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{primary?.position_title ?? '—'}</div>
                      {personAssignments.filter((assignment) => assignment.status === 'active').map((assignment) => (
                        <div key={assignment.id} className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span>{assignment.org_units?.name ?? 'Đơn vị'}{assignment.is_primary ? ' · Chính' : ''}</span>
                          {canUpdate && <button type="button" onClick={() => void endAssignment(assignment)} className="font-medium text-amber-700 hover:underline">Kết thúc</button>}
                        </div>
                      ))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{person.phone ?? '—'}</td>
                    <td className="px-3 py-3"><span className={'badge ' + statusStyles[person.status]}>{statusLabels[person.status]}</span></td>
                    <td className="px-3 py-3 text-right"><div className="flex justify-end gap-2">{canCreate && <button type="button" onClick={() => openAssignment(person)} className="btn-ghost">Phân công</button>}{canUpdate && <button type="button" onClick={() => openEdit(person)} className="btn-ghost">Sửa</button>}</div></td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {!canCreate && !canUpdate && <p className="text-xs text-slate-400">Chế độ hiện tại: chỉ xem. Quyền quản lý nhân sự phụ thuộc phân quyền HR và phạm vi đơn vị được giao.</p>}

      {assignmentOpen && assignmentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy-950/50 p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="assignment-form-title" className="my-auto w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 id="assignment-form-title" className="text-lg font-semibold text-navy-900">Phân công công tác</h2><p className="mt-1 text-sm text-slate-500">{assignmentTarget.full_name} · {assignmentTarget.staff_code}</p></div>
              <button type="button" onClick={() => setAssignmentOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng"><X size={18} /></button>
            </div>
            <form onSubmit={saveAssignment} className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">Đơn vị công tác
                <select required value={assignmentForm.org_unit_id} onChange={(event) => setAssignmentForm((old) => ({ ...old, org_unit_id: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Chọn phòng/khoa</option>
                  {orgUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.code})</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">Chức vụ / vị trí công tác
                <input value={assignmentForm.position_title} onChange={(event) => setAssignmentForm((old) => ({ ...old, position_title: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="VD: Trưởng phòng, Giáo viên..." />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">Ngày bắt đầu
                  <input type="date" required value={assignmentForm.start_date} onChange={(event) => setAssignmentForm((old) => ({ ...old, start_date: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Ngày kết thúc
                  <input type="date" value={assignmentForm.end_date} onChange={(event) => setAssignmentForm((old) => ({ ...old, end_date: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={assignmentForm.is_primary} onChange={(event) => setAssignmentForm((old) => ({ ...old, is_primary: event.target.checked }))} /> Phân công chính</label>
              <label className="block text-sm font-medium text-slate-700">Trạng thái
                <select value={assignmentForm.status} onChange={(event) => setAssignmentForm((old) => ({ ...old, status: event.target.value as 'active' | 'ended' }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="active">Đang hiệu lực</option><option value="ended">Đã kết thúc</option></select>
              </label>
              {assignmentError && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{assignmentError}</div>}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setAssignmentOpen(false)} className="btn-ghost">Hủy</button>
                <button type="submit" disabled={assignmentSaving} className="btn-primary">{assignmentSaving ? 'Đang lưu...' : 'Lưu phân công'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy-950/50 p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="staff-form-title" className="my-auto w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 id="staff-form-title" className="text-lg font-semibold text-navy-900">{editing ? 'Chỉnh sửa hồ sơ nhân sự' : 'Thêm hồ sơ nhân sự'}</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng"><X size={18} /></button>
            </div>
            <form onSubmit={saveStaff} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">Mã nhân sự
                  <input required value={form.staff_code} onChange={(event) => setForm((old) => ({ ...old, staff_code: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm uppercase" placeholder="VD: GV001" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Họ và tên
                  <input required value={form.full_name} onChange={(event) => setForm((old) => ({ ...old, full_name: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Nhập họ và tên" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Ngày sinh
                  <input type="date" value={form.date_of_birth} onChange={(event) => setForm((old) => ({ ...old, date_of_birth: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Giới tính
                  <select value={form.gender} onChange={(event) => setForm((old) => ({ ...old, gender: event.target.value as '' | Gender }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Chưa cập nhật</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">Số định danh
                  <input value={form.national_id} onChange={(event) => setForm((old) => ({ ...old, national_id: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" autoComplete="off" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Số điện thoại
                  <input value={form.phone} onChange={(event) => setForm((old) => ({ ...old, phone: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Email
                  <input type="email" value={form.email} onChange={(event) => setForm((old) => ({ ...old, email: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Trạng thái
                  <select value={form.status} onChange={(event) => setForm((old) => ({ ...old, status: event.target.value as StaffStatus }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">Địa chỉ
                <textarea value={form.address} onChange={(event) => setForm((old) => ({ ...old, address: event.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              {formError && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</div>}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => { setFormOpen(false); setEditing(null) }} className="btn-ghost">Hủy</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Đang lưu...' : 'Lưu hồ sơ'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
