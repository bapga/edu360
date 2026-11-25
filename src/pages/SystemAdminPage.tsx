import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Clock3, LockKeyhole, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionContext'

type ChangeType = 'matrix_grant' | 'matrix_revoke' | 'role_assign' | 'role_unassign'
type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'import' | 'export'
type DataScope = 'all' | 'unit' | 'own'
interface Role { id: string; code: string; name: string }
interface Module { id: string; code: string; name: string }
interface Profile { id: string; full_name: string | null; email: string | null; status: string }
interface OrgUnit { id: string; code: string; name: string }
interface PermissionRequest {
  id: string
  change_type: ChangeType
  payload: Record<string, unknown>
  reason: string
  status: string
  requested_by: string
  requested_at: string
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
}
interface AuditLog { id: number; occurred_at: string; actor_id: string | null; action: string; table_name: string; record_id: string | null }
interface RolePermission {
  role_id: string
  module_id: string
  action: PermissionAction
  data_scope: DataScope
  roles: { code: string; name: string } | null
  modules: { code: string; name: string } | null
}
const actions: PermissionAction[] = ['view', 'create', 'update', 'delete', 'approve', 'import', 'export']
const actionLabels: Record<PermissionAction, string> = {
  view: 'Xem', create: 'Thêm', update: 'Sửa', delete: 'Xóa',
  approve: 'Phê duyệt', import: 'Nhập', export: 'Xuất',
}
const changeLabels: Record<ChangeType, string> = {
  matrix_grant: 'Cấp quyền', matrix_revoke: 'Thu hồi quyền',
  role_assign: 'Gán vai trò', role_unassign: 'Gỡ vai trò',
}
const statusLabels: Record<string, string> = {
  pending: 'Chờ duyệt', applied: 'Đã áp dụng', rejected: 'Đã từ chối',
}

export default function SystemAdminPage() {
  const { user } = useAuth()
  const { can, isSystemAdmin } = usePermissions()
  const [roles, setRoles] = useState<Role[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [units, setUnits] = useState<OrgUnit[]>([])
  const [requests, setRequests] = useState<PermissionRequest[]>([])
  const [matrix, setMatrix] = useState<RolePermission[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [myRoleCodes, setMyRoleCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [changeType, setChangeType] = useState<ChangeType>('matrix_grant')
  const [roleCode, setRoleCode] = useState('')
  const [moduleCode, setModuleCode] = useState('')
  const [action, setAction] = useState<PermissionAction>('view')
  const [dataScope, setDataScope] = useState<DataScope>('all')
  const [targetUserId, setTargetUserId] = useState('')
  const [orgUnitId, setOrgUnitId] = useState('')
  const [reason, setReason] = useState('')
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({})

  const loadData = useCallback(async () => {
    if (!supabase || !user) {
      setError('Không có phiên đăng nhập hoặc chưa cấu hình Supabase.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const [rolesResult, modulesResult, profilesResult, unitsResult, requestsResult, matrixResult, myRolesResult, auditResult] = await Promise.all([
      supabase.from('roles').select('id,code,name').order('name'),
      supabase.from('modules').select('id,code,name').order('sort_order'),
      supabase.from('profiles').select('id,full_name,email,status').order('full_name'),
      supabase.from('org_units').select('id,code,name').is('deleted_at', null).eq('is_active', true).order('sort_order'),
      supabase.from('permission_change_requests').select('id,change_type,payload,reason,status,requested_by,requested_at,decided_by,decided_at,decision_note').order('requested_at', { ascending: false }),
      supabase.from('role_permissions').select('role_id,module_id,action,data_scope,roles(code,name),modules(code,name)'),
      supabase.from('user_roles').select('roles!user_roles_role_id_fkey(code)').eq('user_id', user.id),
      supabase.from('audit_logs').select('id,occurred_at,actor_id,action,table_name,record_id').order('occurred_at', { ascending: false }).limit(100),
    ])
    const failure = rolesResult.error || modulesResult.error || profilesResult.error || unitsResult.error || requestsResult.error || matrixResult.error || myRolesResult.error || auditResult.error
    if (failure) {
      setError(failure.message)
    } else {
      setRoles((rolesResult.data ?? []) as Role[])
      setModules((modulesResult.data ?? []) as Module[])
      setProfiles((profilesResult.data ?? []) as Profile[])
      setUnits((unitsResult.data ?? []) as OrgUnit[])
      setRequests((requestsResult.data ?? []) as PermissionRequest[])
      setMatrix((matrixResult.data ?? []) as unknown as RolePermission[])
      setAuditLogs((auditResult.data ?? []) as AuditLog[])
      setMyRoleCodes((myRolesResult.data ?? []).map((row) => (row.roles as unknown as { code: string } | null)?.code?.toLowerCase()).filter((code): code is string => Boolean(code)))
      if (!roleCode && rolesResult.data?.length) setRoleCode(rolesResult.data[0].code)
      if (!moduleCode && modulesResult.data?.length) setModuleCode(modulesResult.data[0].code)
    }
    setLoading(false)
  }, [user, roleCode, moduleCode])

  useEffect(() => { void loadData() }, [loadData])

  const pending = useMemo(() => requests.filter((request) => request.status === 'pending'), [requests])
  const history = useMemo(() => requests.filter((request) => request.status !== 'pending'), [requests])
  const canRequest = can('system', 'update')
  const canApprove = can('system', 'approve')
  const selectedRole = roles.find((role) => role.code === roleCode)
  const selectedModule = modules.find((module) => module.code === moduleCode)

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    if (reason.trim().length < 10) {
      setMessage('Nêu rõ lý do, tối thiểu 10 ký tự.')
      return
    }
    let payload: Record<string, unknown>
    if (changeType === 'matrix_grant' || changeType === 'matrix_revoke') {
      if (!roleCode || !moduleCode) return
      const existing = matrix.find((item) => item.role_id === selectedRole?.id && item.module_id === selectedModule?.id && item.action === action)
      if (changeType === 'matrix_grant' && existing) {
        setMessage(existing.data_scope === dataScope
          ? 'Quyền này đã tồn tại.'
          : 'Action đã có trong ma trận với phạm vi khác. Cần cập nhật RPC để đổi phạm vi an toàn trước khi gửi yêu cầu.')
        return
      }
      if (changeType === 'matrix_revoke' && (!existing || existing.data_scope !== dataScope)) {
        setMessage('Không tìm thấy quyền với phạm vi dữ liệu đã chọn.')
        return
      }
      payload = { role_code: roleCode, module_code: moduleCode, action, data_scope: dataScope }
    } else {
      if (!targetUserId || !roleCode) {
        setMessage('Chọn tài khoản và vai trò.')
        return
      }
      if (targetUserId === user?.id) {
        setMessage('Không thể tự đề xuất thay đổi vai trò của chính tài khoản.')
        return
      }
      payload = { user_id: targetUserId, role_code: roleCode, org_unit_id: orgUnitId || null }
    }
    setSaving(true)
    setMessage(null)
    const { error: requestError } = await supabase.rpc('request_permission_change', {
      p_type: changeType,
      p_payload: payload,
      p_reason: reason.trim(),
    })
    setSaving(false)
    if (requestError) {
      setMessage(requestError.message)
      return
    }
    setReason('')
    setMessage('Đã gửi yêu cầu. Yêu cầu đang chờ một Admin khác phê duyệt.')
    await loadData()
  }

  async function decideRequest(request: PermissionRequest, approve: boolean) {
    if (!supabase || !canApprove) return
    if (request.requested_by === user?.id) {
      setMessage('Bạn không thể tự phê duyệt yêu cầu do mình đề xuất.')
      return
    }
    const targetRole = String(request.payload.role_code ?? '').toLowerCase()
    if ((request.change_type === 'matrix_grant' || request.change_type === 'matrix_revoke') && myRoleCodes.includes(targetRole)) {
      setMessage('Không thể duyệt thay đổi ma trận của vai trò mà bạn đang giữ. Cần Admin độc lập khác xử lý.')
      return
    }
    if ((request.change_type === 'role_assign' || request.change_type === 'role_unassign') && request.payload.user_id === user?.id) {
      setMessage('Không thể duyệt thay đổi vai trò của chính tài khoản.')
      return
    }
    setSaving(true)
    setMessage(null)
    const { error: decisionError } = await supabase.rpc('decide_permission_change', {
      p_id: request.id,
      p_approve: approve,
      p_note: decisionNotes[request.id]?.trim() || null,
    })
    setSaving(false)
    if (decisionError) {
      setMessage(decisionError.message)
      return
    }
    setMessage(approve ? 'Đã phê duyệt yêu cầu.' : 'Đã từ chối yêu cầu.')
    await loadData()
  }

  function requestDescription(request: PermissionRequest) {
    if (request.change_type === 'matrix_grant' || request.change_type === 'matrix_revoke') {
      const module = modules.find((item) => item.code === request.payload.module_code)
      const role = roles.find((item) => item.code === request.payload.role_code)
      const actionLabel = actionLabels[String(request.payload.action) as PermissionAction] ?? String(request.payload.action)
      return `${role?.name ?? request.payload.role_code} · ${module?.name ?? request.payload.module_code} · ${actionLabel} · ${request.payload.data_scope}`
    }
    const profile = profiles.find((item) => item.id === request.payload.user_id)
    const role = roles.find((item) => item.code === request.payload.role_code)
    return `${profile?.full_name ?? profile?.email ?? 'Tài khoản'} · ${role?.name ?? request.payload.role_code} · ${request.payload.org_unit_id ? units.find((unit) => unit.id === request.payload.org_unit_id)?.name ?? 'Đơn vị' : 'Toàn trường'}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-brand-700"><ShieldCheck size={17} /> Quản trị hệ thống</div>
          <h1 className="mt-1 text-2xl font-semibold text-navy-900">Vai trò, phân quyền và phê duyệt</h1>
          <p className="mt-1 text-sm text-slate-500">Mọi thay đổi quyền đều đi qua quy trình đề xuất và phê duyệt độc lập.</p>
        </div>
        <button type="button" onClick={() => void loadData()} disabled={loading} className="btn-ghost inline-flex items-center gap-2"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm mới</button>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card p-4"><div className="text-sm text-slate-500">Vai trò</div><div className="mt-1 text-2xl font-semibold text-navy-900">{roles.length}</div></div>
        <div className="card p-4"><div className="text-sm text-slate-500">Module</div><div className="mt-1 text-2xl font-semibold text-navy-900">{modules.length}</div></div>
        <div className="card p-4"><div className="flex items-center gap-2 text-sm text-slate-500"><Clock3 size={15} /> Chờ phê duyệt</div><div className="mt-1 text-2xl font-semibold text-navy-900">{pending.length}</div></div>
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{message}</div>}

      {canRequest && (
        <section className="card p-4 sm:p-5">
          <h2 className="font-semibold text-navy-900">Tạo yêu cầu thay đổi</h2>
          <p className="mt-1 text-sm text-slate-500">Người đề xuất không thể tự phê duyệt yêu cầu của mình.</p>
          <form onSubmit={submitRequest} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">Loại yêu cầu
                <select value={changeType} onChange={(event) => setChangeType(event.target.value as ChangeType)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="matrix_grant">Cấp quyền cho vai trò</option>
                  <option value="matrix_revoke">Thu hồi quyền của vai trò</option>
                  <option value="role_assign">Gán vai trò cho tài khoản</option>
                  <option value="role_unassign">Gỡ vai trò khỏi tài khoản</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">Vai trò
                <select value={roleCode} onChange={(event) => setRoleCode(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  {roles.map((role) => <option key={role.id} value={role.code}>{role.name} ({role.code})</option>)}
                </select>
              </label>
            </div>
            {(changeType === 'matrix_grant' || changeType === 'matrix_revoke') ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block text-sm font-medium text-slate-700">Phân hệ
                  <select value={moduleCode} onChange={(event) => setModuleCode(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    {modules.map((module) => <option key={module.id} value={module.code}>{module.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">Thao tác
                  <select value={action} onChange={(event) => setAction(event.target.value as PermissionAction)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    {actions.map((item) => <option key={item} value={item}>{actionLabels[item]}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">Phạm vi dữ liệu
                  <select value={dataScope} onChange={(event) => setDataScope(event.target.value as DataScope)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="all">Toàn trường</option><option value="unit">Theo đơn vị</option><option value="own">Của bản thân</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">Tài khoản
                  <select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Chọn tài khoản</option>
                    {profiles.filter((profile) => profile.id !== user?.id).map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name ?? profile.email ?? profile.id} · {profile.status}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">Đơn vị áp dụng
                  <select value={orgUnitId} onChange={(event) => setOrgUnitId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Toàn trường / không gắn đơn vị</option>
                    {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                  </select>
                </label>
              </div>
            )}
            <label className="block text-sm font-medium text-slate-700">Lý do đề xuất
              <textarea required minLength={10} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Nêu căn cứ và lý do thay đổi..." />
            </label>
            <div className="flex justify-end"><button type="submit" disabled={saving || loading} className="btn-primary">{saving ? 'Đang gửi...' : 'Gửi yêu cầu phê duyệt'}</button></div>
          </form>
        </section>
      )}

      <section className="card p-4 sm:p-5">
        <div className="flex items-center justify-between"><h2 className="font-semibold text-navy-900">Hàng đợi phê duyệt</h2><span className="badge bg-amber-50 text-amber-700">{pending.length} đang chờ</span></div>
        {loading ? <div className="py-10 text-center text-sm text-slate-500">Đang tải yêu cầu...</div> : pending.length === 0 ? (
          <div className="py-10 text-center"><LockKeyhole size={28} className="mx-auto text-slate-300" /><p className="mt-2 text-sm text-slate-500">Không có yêu cầu chờ phê duyệt.</p></div>
        ) : (
          <div className="mt-4 space-y-3">
            {pending.map((request) => {
              const requester = profiles.find((profile) => profile.id === request.requested_by)
              const selfRequest = request.requested_by === user?.id
              const targetRole = String(request.payload.role_code ?? '').toLowerCase()
              const sameRole = (request.change_type === 'matrix_grant' || request.change_type === 'matrix_revoke') && myRoleCodes.includes(targetRole)
              const selfTarget = (request.change_type === 'role_assign' || request.change_type === 'role_unassign') && request.payload.user_id === user?.id
              const blocked = selfRequest || sameRole || selfTarget
              return <article key={request.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-navy-900">{changeLabels[request.change_type]}</div>
                    <div className="mt-1 text-sm text-slate-700">{requestDescription(request)}</div>
                    <div className="mt-1 text-xs text-slate-500">Người đề xuất: {requester?.full_name ?? requester?.email ?? 'Tài khoản'} · {new Date(request.requested_at).toLocaleString('vi-VN')}</div>
                    <p className="mt-2 text-sm text-slate-600">{request.reason}</p>
                  </div>
                  <span className="badge bg-amber-50 text-amber-700">{statusLabels[request.status] ?? request.status}</span>
                </div>
                {canApprove && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    {blocked && <p className="mb-2 text-xs text-amber-700">{selfRequest ? 'Bạn là người đề xuất.' : sameRole ? 'Bạn đang giữ vai trò bị thay đổi.' : 'Yêu cầu tác động đến chính tài khoản của bạn.'} Cần một Admin độc lập khác xử lý.</p>}
                    <label className="block text-xs font-medium text-slate-600">Ghi chú quyết định
                      <input value={decisionNotes[request.id] ?? ''} onChange={(event) => setDecisionNotes((old) => ({ ...old, [request.id]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Không bắt buộc" />
                    </label>
                    <div className="mt-3 flex justify-end gap-2">
                      <button type="button" disabled={saving || blocked} onClick={() => void decideRequest(request, false)} className="btn-ghost inline-flex items-center gap-2"><X size={15} /> Từ chối</button>
                      <button type="button" disabled={saving || blocked} onClick={() => void decideRequest(request, true)} className="btn-primary inline-flex items-center gap-2"><Check size={15} /> Phê duyệt</button>
                    </div>
                  </div>
                )}
              </article>
            })}
          </div>
        )}
      </section>

      <section className="card p-4 sm:p-5">
        <div className="flex items-center justify-between"><h2 className="font-semibold text-navy-900">Lịch sử phê duyệt</h2><span className="text-xs text-slate-500">{history.length} yêu cầu đã xử lý</span></div>
        {history.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Chưa có yêu cầu nào được xử lý.</p> : (
          <div className="mt-4 space-y-3">
            {history.slice(0, 30).map((request) => {
              const requester = profiles.find((profile) => profile.id === request.requested_by)
              const decider = profiles.find((profile) => profile.id === request.decided_by)
              return <div key={request.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-navy-900">{changeLabels[request.change_type]} · {requestDescription(request)}</div>
                  <span className={request.status === 'applied' ? 'badge bg-emerald-50 text-emerald-700' : 'badge bg-slate-100 text-slate-600'}>{statusLabels[request.status] ?? request.status}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">Đề xuất: {requester?.full_name ?? requester?.email ?? 'Tài khoản'} · {new Date(request.requested_at).toLocaleString('vi-VN')}</div>
                <div className="mt-1 text-xs text-slate-500">Quyết định: {decider?.full_name ?? decider?.email ?? 'Chưa rõ'} · {request.decided_at ? new Date(request.decided_at).toLocaleString('vi-VN') : '—'}</div>
                {request.decision_note && <p className="mt-2 text-sm text-slate-600">{request.decision_note}</p>}
              </div>
            })}
          </div>
        )}
      </section>

      <section className="card p-4 sm:p-5">
        <div className="flex items-center justify-between"><h2 className="font-semibold text-navy-900">Nhật ký hệ thống</h2><span className="text-xs text-slate-500">100 sự kiện gần nhất</span></div>
        <p className="mt-1 text-xs text-slate-500">Chỉ hiển thị metadata sự kiện; không tải old_data/new_data để tránh lộ dữ liệu cá nhân.</p>
        {auditLogs.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Chưa có nhật ký.</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Thời điểm</th><th className="px-3 py-3">Người thực hiện</th><th className="px-3 py-3">Thao tác</th><th className="px-3 py-3">Bảng dữ liệu</th><th className="px-3 py-3">Mã bản ghi</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => {
                  const actor = profiles.find((profile) => profile.id === log.actor_id)
                  return <tr key={log.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{new Date(log.occurred_at).toLocaleString('vi-VN')}</td>
                    <td className="px-3 py-2">{actor?.full_name ?? actor?.email ?? (log.actor_id ? 'Tài khoản' : 'Hệ thống / chưa ghi nhận')}</td>
                    <td className="px-3 py-2"><span className="badge bg-slate-100 text-slate-700">{log.action}</span></td>
                    <td className="px-3 py-2 font-mono text-xs">{log.table_name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{log.record_id ?? '—'}</td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="font-semibold text-navy-900">Ma trận quyền hiện tại</h2>
        <p className="mt-1 text-sm text-slate-500">Đây là quyền đã được ghi trong database, không phải quyền đang chờ duyệt.</p>
        {loading ? <div className="py-8 text-center text-sm text-slate-500">Đang tải ma trận...</div> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Vai trò</th><th className="px-3 py-3">Phân hệ</th><th className="px-3 py-3">Thao tác</th><th className="px-3 py-3">Phạm vi</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {matrix.map((item, index) => <tr key={item.role_id + item.module_id + item.action + index}>
                  <td className="px-3 py-2">{item.roles?.name ?? item.role_id}</td><td className="px-3 py-2">{item.modules?.name ?? item.module_id}</td><td className="px-3 py-2">{actionLabels[item.action]}</td><td className="px-3 py-2">{item.data_scope}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {!canRequest && !canApprove && <p className="text-xs text-slate-400">Tài khoản không có quyền quản trị vai trò hoặc phê duyệt.</p>}
      {isSystemAdmin && <p className="text-xs text-slate-400">Thay đổi quyền chỉ được áp dụng sau khi một Admin độc lập phê duyệt. Tài khoản và email đăng nhập không được tạo tại màn hình này.</p>}
    </div>
  )
}
