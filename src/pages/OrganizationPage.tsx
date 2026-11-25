import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Landmark, Network, RefreshCw, Search, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

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
const typeLabels: Record<UnitType, string> = {
  admin_board: 'Ban quản trị',
  leadership: 'Ban lãnh đạo',
  department: 'Phòng',
  faculty: 'Khoa',
  other: 'Đơn vị khác',
}
const typeOrder: UnitType[] = ['admin_board', 'leadership', 'department', 'faculty', 'other']

export default function OrganizationPage() {
  const [units, setUnits] = useState<OrgUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | UnitType>('all')
  const [showInactive, setShowInactive] = useState(false)

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-brand-700"><Network size={17} /> Tổ chức nhà trường</div>
          <h1 className="mt-1 text-2xl font-semibold text-navy-900">Cơ cấu tổ chức</h1>
          <p className="mt-1 text-sm text-slate-500">Danh mục đơn vị được lấy trực tiếp từ cơ sở dữ liệu dùng chung.</p>
        </div>
        <button type="button" onClick={() => void loadUnits()} disabled={loading} className="btn-ghost inline-flex items-center gap-2">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm mới
        </button>
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
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
      <p className="text-xs text-slate-400">Chế độ hiện tại: xem dữ liệu. Chức năng thêm, sửa và sắp xếp cơ cấu sẽ chỉ được bật sau khi hoàn thiện quyền org và quy trình phê duyệt.</p>
    </div>
  )
}
