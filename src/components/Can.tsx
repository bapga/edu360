import type { ReactNode } from 'react'
import { usePermissions, type PermissionAction } from '../contexts/PermissionContext'

interface Props {
  module: string
  action?: PermissionAction
  children: ReactNode
  fallback?: ReactNode
}
export default function Can({ module, action = 'view', children, fallback = null }: Props) {
  const { can } = usePermissions()
  return can(module, action) ? <>{children}</> : <>{fallback}</>
}
