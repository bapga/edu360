import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// Chỉ dùng khóa công khai. Quyền truy cập dữ liệu được thực thi bằng RLS tại PostgreSQL.
export const supabase = isSupabaseConfigured ? createClient(url as string, anonKey as string) : null
