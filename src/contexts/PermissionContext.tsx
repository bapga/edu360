import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

export type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'import' | 'export'
export interface PermissionRow {
  module_code: string
  action: PermissionAction
  data_scope: 'all' | 'unit' | 'own'
  org_unit_id: string | null
  role_code: string
}
interface PermissionState {
  permissions: PermissionRow[]
  profileStatus: string | null
  loading: boolean
  error: string | null
  can: (moduleCode: string, action?: PermissionAction) => boolean
  scopeFor: (moduleCode: string, action?: PermissionAction) => PermissionRow['data_scope'] | null
  refresh: () => Promise<void>
  isSystemAdmin: boolean
  isBgh: boolean
}
const PermissionContext = createContext<PermissionState | null>(null)

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<PermissionRow[]>([])
  const [profileStatus, setProfileStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedUserIdRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current
    if (!supabase || !user) {
      loadedUserIdRef.current = null
      setPermissions([])
      setProfileStatus(null)
      setError(null)
      setLoading(false)
      return
    }
    const isNewUser = loadedUserIdRef.current !== user.id
    if (isNewUser) setLoading(true)
    setError(null)
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles').select('status').eq('id', user.id).maybeSingle()
      if (profileError) throw profileError
      if (!profile) throw new Error('Tài khoản chưa có hồ sơ trong hệ thống.')
      const nextStatus = profile.status
      let nextPermissions: PermissionRow[] = []
      if (nextStatus === 'active') {
        const { data, error: permissionError } = await supabase.rpc('my_permissions')
        if (permissionError) throw permissionError
        nextPermissions = (data ?? []) as PermissionRow[]
      }
      if (requestId !== requestIdRef.current) return
      setProfileStatus(nextStatus)
      setPermissions(nextPermissions)
    } catch (cause) {
      if (requestId !== requestIdRef.current) return
      setPermissions([])
      setProfileStatus(null)
      setError(cause instanceof Error ? cause.message : 'Không thể tải quyền truy cập.')
    } finally {
      if (requestId === requestIdRef.current) {
        loadedUserIdRef.current = user.id
        setLoading(false)
      }
    }
  }, [user])

  useEffect(() => {
    void refresh()
    if (!user) return
    const timer = window.setInterval(() => void refresh(), 60_000)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh, user])

  const roleCodes = permissions.map((permission) => permission.role_code.toLowerCase())
  const isSystemAdmin = roleCodes.includes('system_admin')
  const isBgh = roleCodes.includes('ban_giam_hieu') && !isSystemAdmin

  const value = useMemo<PermissionState>(() => ({
    permissions, profileStatus, loading, error, refresh, isSystemAdmin, isBgh,
    can: (moduleCode, action = 'view') => {
      if (loading || error || profileStatus !== 'active') return false
      if (isBgh) return moduleCode === 'reports' && action === 'view'
      return permissions.some((p) => p.module_code === moduleCode && p.action === action)
    },
    scopeFor: (moduleCode, action = 'view') => {
      if (loading || error || profileStatus !== 'active') return null
      if (isBgh && (moduleCode !== 'reports' || action !== 'view')) return null
      const rows = permissions.filter((p) => p.module_code === moduleCode && p.action === action)
      if (!rows.length) return null
      if (rows.some((p) => p.data_scope === 'all')) return 'all'
      if (rows.some((p) => p.data_scope === 'unit')) return 'unit'
      return 'own'
    },
  }), [permissions, profileStatus, loading, error, refresh, isSystemAdmin, isBgh])

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
}

export function usePermissions() {
  const value = useContext(PermissionContext)
  if (!value) throw new Error('usePermissions phải được dùng bên trong PermissionProvider')
  return value
}
