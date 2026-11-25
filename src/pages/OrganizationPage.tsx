import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Building2, Landmark, Network, Plus, RefreshCw, Search, Users, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePermissions } from '../contexts/PermissionContext'

type UnitType = 'admin_board' | 'leadership' | 'department' | 'faculty' | 'other'
interface OrgUnit {
  id: string
  code: string
  name: string
  unit_type: UnitType
  parent_id: string | null
  sort_order: number
  is_active: boolean
}
interface UnitForm {
  code: string
  name: string
  unit_type: UnitType
  parent_id: string
  sort_order: string
  is_active: boolean
}
const emptyForm: UnitForm = {
  code: '', name: '', unit_type: 'department', parent_id: '', sort_order: '0', is_active: true,
}
const typeLabels: Record<UnitType, string> = {
  admin_board: 'Ban quản trị',
  leadership: 'Ban lãnh đạo',
  department: 'Phòng',
  faculty: 'Khoa',
  other: 'Đơn vị khác',
}
const typeOrder: UnitType[] = ['admin_board', 'leadership', 'department', 'faculty', 'other']

export default function OrganizationPage() {
  const { can } = usePermissions()
  const [units, setUnits] = useState<OrgUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | UnitType>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<OrgUnit | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<UnitForm>(emptyForm)

  const loadUnits = useCallback(async () => {
    if (!supabase) {
      setError('Chưa cấu hình kết nối cơ sở dữ liệu.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: queryError } = await supabase
      .from('org_units')
      .select('id, code, name, unit_type, parent_id, sort_order, is_active')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
    if (queryError) {
      setError(queryError.message)
      setUnits([])
    } else {
      setUnits((data ?? []) as OrgUnit[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { void loadUnits() }, [loadUnits])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi')
    return units.filter((unit) => {
      if (!showInactive && !unit.is_active) return false
      if (typeFilter !== 'all' && unit.unit_type !== typeFilter) return false
      if (!keyword) return true
      return unit.name.toLocaleLowerCase('vi').includes(keyword)
        || unit.code.toLocaleLowerCase('vi').includes(keyword)
    })
  }, [units, search, typeFilter, showInactive])

  const groups = useMemo(() => typeOrder
    .map((type) => ({ type, items: filtered.filter((unit) => unit.unit_type === type) }))
    .filter((group) => group.items.length > 0), [filtered])

  const activeCount = units.filter((unit) => unit.is_active).length
  const departmentCount = units.filter((unit) => unit.unit_type === 'department' && unit.is_active).length
  const facultyCount = units.filter((unit) => unit.unit_type === 'faculty' && unit.is_active).length

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
    setForm({ ...emptyForm, sort_order: String(Math.max(0, ...units.map((unit) => unit.sort_order)) + 1) })
    setFormError(null)
  }

  function openEdit(unit: OrgUnit) {
    setEditing(unit)
    setFormOpen(true)
    setForm({
      code: unit.code,
      name: unit.name,
      unit_type: unit.unit_type,
      parent_id: unit.parent_id ?? '',
      sort_order: String(unit.sort_order),
      is_active: unit.is_active,
    })
    setFormError(null)
  }

  function descendantsOf(unitId: string): Set<string> {
    const descendants = new Set<string>()
    let frontier = [unitId]
    while (frontier.length) {
      const next = units.filter((unit) => unit.parent_id && frontier.includes(unit.parent_id))
      next.forEach((unit) => descendants.add(unit.id))
      frontier = next.map((unit) => unit.id)
    }
    return descendants
  }

  async function saveUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const code = form.code.trim().toUpperCase()
    const name = form.name.trim()
    const sortOrder = Number(form.sort_order)
    if (!code || !/^[A-Z0-9_]+$/.test(code)) {
      setFormError('Mã đơn vị chỉ gồm chữ in hoa, số và dấu gạch dưới.')
      return
    }
    if (!name) {
      setFormError('Vui lòng nhập tên đơn vị.')
      return
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormError('Thứ tự sắp xếp phải là số nguyên không âm.')
      return
    }
    if (editing && form.parent_id && (form.parent_id === editing.id || descendantsOf(editing.id).has(form.parent_id))) {
      setFormError('Không thể chọn chính đơn vị này hoặc đơn vị cấp dưới làm đơn vị cấp trên.')
      return
    }

    setSaving(true)
    setFormError(null)
    const payload = {
      code, name, unit_type: form.unit_type,
      parent_id: form.parent_id || null,
      sort_order: sortOrder,
      is_active: form.is_active,
    }
    const result = editing
      ? await supabase.from('org_units').update(payload).eq('id', editing.id).is('deleted_at', null)
      : await supabase.from('org_units').insert(payload)
    setSaving(false)
    if (result.error) {
      setFormError(result.error.message.includes('org_units_code_uq') || result.error.code === '23505'
        ? 'Mã đơn vị đã tồn tại. Vui lòng chọn mã khác.'
        : result.error.message)
      return
    }
    setEditing(null)
    setFormOpen(false)
    setForm(emptyForm)
    await loadUnits()
  }

  const canCreate = can('org', 'create')
  const canUpdate = can('org', 'update')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-brand-700"><Network size={17} /> Tổ chức nhà trường</div>
          <h1 className="mt-1 text-2xl font-semibold text-navy-900">Cơ cấu tổ chức</h1>
          <p className="mt-1 text-sm text-slate-500">Danh mục đơn vị được lấy trực tiếp từ cơ sở dữ liệu dùng chung.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadUnits()} disabled={loading} className="btn-ghost inline-flex items-center gap-2">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm mới
          </button>
          {canCreate && <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-2"><Plus size={16} /> Thêm đơn vị</button>}
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Thống kê cơ cấu">
        <div className="card flex items-center gap-4 p-4">
          <div className="rounded-xl bg-brand-50 p-3 text-brand-700"><Building2 size={22} /></div>
          <div><div className="text-sm text-slate-500">Tổng đơn vị đang hoạt động</div><div className="text-2xl font-semibold text-navy-900">{activeCount}</div></div>
        </div>
        <div className="card flex items-center gap-4 p-4">
          <div className="rounded-xl bg-amber-50 p-3 text-amber-700"><Landmark size={22} /></div>
          <div><div className="text-sm text-slate-500">Phòng</div><div className="text-2xl font-semibold text-navy-900">{departmentCount}</div></div>
        </div>
        <div className="card flex items-center gap-4 p-4">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Users size={22} /></div>
          <div><div className="text-sm text-slate-500">Khoa</div><div className="text-2xl font-semibold text-navy-900">{facultyCount}</div></div>
        </div>
      </section>

      <section className="card space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Tìm đơn vị</span>
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc mã đơn vị..." className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400" />
          </label>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | UnitType)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 sm:w-52" aria-label="Lọc loại đơn vị">
            <option value="all">Tất cả loại đơn vị</option>
            {typeOrder.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            Hiện đơn vị ngừng hoạt động
          </label>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Đang tải cơ cấu tổ chức...</div>
        ) : error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <div className="font-semibold">Không tải được dữ liệu cơ cấu tổ chức</div>
            <p className="mt-1">{error}</p>
            <button type="button" onClick={() => void loadUnits()} className="mt-3 font-semibold underline">Thử lại</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">Không tìm thấy đơn vị phù hợp.</div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.type}>
                <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                  <h2 className="font-semibold text-navy-900">{typeLabels[group.type]}</h2>
                  <span className="text-xs text-slate-500">{group.items.length} đơn vị</span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((unit) => (
                    <article key={unit.id} className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-brand-300">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold tracking-wide text-brand-700">{unit.code}</div>
                          <h3 className="mt-1 font-semibold text-navy-900">{unit.name}</h3>
                        </div>
                        <span className={unit.is_active ? 'badge bg-emerald-50 text-emerald-700' : 'badge bg-slate-100 text-slate-600'}>
                          {unit.is_active ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                        </span>
                      </div>
                      {unit.parent_id && (
                        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">Có đơn vị cấp trên</p>
                      )}
                      {canUpdate && <button type="button" onClick={() => openEdit(unit)} className="btn-ghost mt-3 w-full">Chỉnh sửa</button>}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
      {!canCreate && !canUpdate && <p className="text-xs text-slate-400">Chế độ hiện tại: chỉ xem. Quyền quản lý cơ cấu tổ chức chưa được cấp cho tài khoản này.</p>}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy-950/50 p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="org-form-title" className="my-auto w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 id="org-form-title" className="text-lg font-semibold text-navy-900">{editing ? 'Chỉnh sửa đơn vị' : 'Thêm đơn vị'}</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng"><X size={18} /></button>
            </div>
            <form onSubmit={saveUnit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">Mã đơn vị
                  <input required value={form.code} onChange={(event) => setForm((old) => ({ ...old, code: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm uppercase" placeholder="VD: P_DT" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Loại đơn vị
                  <select value={form.unit_type} onChange={(event) => setForm((old) => ({ ...old, unit_type: event.target.value as UnitType }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    {typeOrder.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">Tên đơn vị
                <input required value={form.name} onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Nhập tên đơn vị" />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">Đơn vị cấp trên
                  <select value={form.parent_id} onChange={(event) => setForm((old) => ({ ...old, parent_id: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Không có</option>
                    {units.filter((unit) => unit.id !== editing?.id && (!editing || !descendantsOf(editing.id).has(unit.id))).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">Thứ tự hiển thị
                  <input type="number" min="0" step="1" value={form.sort_order} onChange={(event) => setForm((old) => ({ ...old, sort_order: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((old) => ({ ...old, is_active: event.target.checked }))} />
                Đơn vị đang hoạt động
              </label>
              {formError && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</div>}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setEditing(null)} className="btn-ghost">Hủy</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Đang lưu...' : 'Lưu đơn vị'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
