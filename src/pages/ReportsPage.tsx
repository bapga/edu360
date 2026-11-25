import { useEffect, useState } from 'react'
import { BarChart3, BookOpen, ClipboardList, GraduationCap, RefreshCw, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface ReportMetric { metric_code: string; metric_label: string; metric_value: number | null; availability: 'available' | 'not_available'; as_of: string }

const reportAreas = [
  {
    title: 'Nhân sự',
    description: 'Số lượng cán bộ, giáo viên theo phòng/khoa; cơ cấu chức danh và tình trạng công tác.',
    icon: Users,
    status: 'Chưa có dữ liệu nhân sự',
  },
  {
    title: 'Người học',
    description: 'Quy mô người học theo khóa, nghề, lớp, giới tính và tình trạng học tập.',
    icon: GraduationCap,
    status: 'Chưa có bảng dữ liệu người học',
  },
  {
    title: 'Tuyển sinh',
    description: 'Chỉ tiêu, hồ sơ đăng ký, kết quả xét tuyển và tỷ lệ nhập học theo đợt.',
    icon: ClipboardList,
    status: 'Chưa có bảng dữ liệu tuyển sinh',
  },
  {
    title: 'Đào tạo và kết quả',
    description: 'Tiến độ chương trình, thời khóa biểu, kết quả học tập, điểm và xét tốt nghiệp.',
    icon: BookOpen,
    status: 'Chưa có bảng dữ liệu đào tạo/điểm',
  },
]

export default function ReportsPage() {
  const [metrics, setMetrics] = useState<ReportMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [summaryReady, setSummaryReady] = useState(false)

  async function loadSummary() {
    if (!supabase) {
      setSummaryReady(false)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.rpc('reports_summary')
    if (error) {
      setMetrics([])
      setSummaryReady(false)
    } else {
      setMetrics((data ?? []) as ReportMetric[])
      setSummaryReady(true)
    }
    setLoading(false)
  }

  useEffect(() => { void loadSummary() }, [])

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-brand-700"><BarChart3 size={17} /> Điều hành nhà trường</div>
        <h1 className="mt-1 text-2xl font-semibold text-navy-900">Báo cáo tổng hợp</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">Khu vực dành cho lãnh đạo xem báo cáo tổng hợp. Báo cáo chỉ lấy dữ liệu đã được phân quyền, không mở quyền đọc trực tiếp các hồ sơ nghiệp vụ.</p>
      </div>

      <section className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
        <div className="font-semibold text-navy-900">Nguyên tắc bảo mật báo cáo</div>
        <p className="mt-1 text-sm text-slate-600">Ban Giám hiệu chỉ có quyền xem báo cáo. Không có chức năng thêm, sửa, xóa, nhập/xuất dữ liệu hoặc phê duyệt tại phân hệ này.</p>
      </section>

      <section className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold text-navy-900">Chỉ số tổng hợp</h2><p className="mt-1 text-xs text-slate-500">Chỉ số được trả về từ RPC báo cáo đã kiểm tra quyền reports.view.</p></div>
          <button type="button" onClick={() => void loadSummary()} disabled={loading} className="btn-ghost inline-flex items-center gap-2"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Cập nhật</button>
        </div>
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Đang tải số liệu báo cáo...</p> : summaryReady ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map((metric) => <div key={metric.metric_code} className="rounded-xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">{metric.metric_label}</div>
              <div className="mt-2 text-2xl font-semibold text-navy-900">{metric.availability === 'available' && metric.metric_value !== null ? metric.metric_value.toLocaleString('vi-VN') : 'Chưa có nguồn dữ liệu'}</div>
              {metric.availability === 'available' && <div className="mt-1 text-xs text-slate-400">Cập nhật: {new Date(metric.as_of).toLocaleString('vi-VN')}</div>}
            </div>)}
          </div>
        ) : <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">RPC tổng hợp báo cáo chưa được triển khai trên database. Chỉ hiển thị khi migration báo cáo được phê duyệt và áp dụng.</div>}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {reportAreas.map((area) => (
          <article key={area.title} className="card p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-slate-100 p-3 text-slate-600"><area.icon size={22} /></div>
              <div className="min-w-0">
                <h2 className="font-semibold text-navy-900">{area.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{area.description}</p>
                <span className="badge mt-3 bg-amber-50 text-amber-700">{area.status}</span>
              </div>
            </div>
          </article>
        ))}
      </section>

      <div className="card flex flex-col items-center px-6 py-12 text-center">
        <BarChart3 size={34} className="text-slate-300" />
        <h2 className="mt-3 font-semibold text-navy-900">Chưa có báo cáo dữ liệu thực tế</h2>
        <p className="mt-2 max-w-xl text-sm text-slate-500">Các báo cáo nghiệp vụ chỉ được mở khi nguồn dữ liệu và RPC tổng hợp đã sẵn sàng. Hệ thống không hiển thị số liệu giả hoặc cho BGH truy cập trực tiếp hồ sơ cá nhân.</p>
      </div>
    </div>
  )
}
