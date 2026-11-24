import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, GraduationCap, ShieldCheck } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!supabase) return
    setBusy(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (authError) setError(authError.message === 'Invalid login credentials'
      ? 'Email hoặc mật khẩu không chính xác.'
      : authError.message)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-cyan-200/50 blur-3xl" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10 md:grid-cols-2">
        <section className="hidden flex-col justify-between bg-navy-900 p-10 text-white md:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><GraduationCap size={28} /></div>
            <div><div className="text-xl font-bold tracking-wide">EDU360</div><div className="text-xs text-blue-200">Hệ thống quản trị trường học</div></div>
          </div>
          <div>
            <div className="mb-5 h-1 w-14 rounded-full bg-cyan-400" />
            <h1 className="text-3xl font-semibold leading-tight">Một nền tảng.<br />Toàn trường đồng bộ.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">Kết nối quản trị, nhân sự, đào tạo và người học trên một hệ thống dữ liệu thống nhất.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300"><ShieldCheck size={16} /> Đăng nhập an toàn · Phân quyền theo vai trò</div>
        </section>
        <section className="p-7 sm:p-10 lg:p-12">
          <div className="mb-8 md:hidden">
            <div className="text-xl font-bold text-navy-900">EDU360</div>
            <div className="text-sm text-slate-500">Quản trị trường học</div>
          </div>
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Cổng làm việc nội bộ</p>
            <h2 className="mt-2 text-2xl font-semibold text-navy-900">Đăng nhập hệ thống</h2>
            <p className="mt-2 text-sm text-slate-500">Sử dụng tài khoản do quản trị hệ thống cấp.</p>
          </div>
          {!isSupabaseConfigured && <div className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Chưa cấu hình kết nối Supabase. Vui lòng kiểm tra biến môi trường triển khai.</div>}
          {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">Email</label>
              <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ten@nhatruong.edu.vn" className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">Mật khẩu</label>
              <div className="relative">
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu" className="h-12 w-full rounded-xl border border-slate-200 px-4 pr-12 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>
            <button type="submit" disabled={busy || !isSupabaseConfigured} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? 'Đang xác thực...' : 'Đăng nhập'} {!busy && <ArrowRight size={17} />}
            </button>
          </form>
          <p className="mt-8 text-center text-xs leading-5 text-slate-400">Nếu chưa có tài khoản hoặc không đăng nhập được, liên hệ quản trị hệ thống của nhà trường.</p>
        </section>
      </div>
    </main>
  )
}
