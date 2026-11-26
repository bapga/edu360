import {
  BarChart3, BookOpen, Bot, Building2, CalendarDays, ClipboardList, FileText, GraduationCap,
  LayoutDashboard, Settings, UserPlus, Users, Wallet, type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  phase: string
  description: string
}
export interface NavGroup { title: string; items: NavItem[] }

export const navGroups: NavGroup[] = [
  {
    title: 'Tổng quan',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard, phase: 'Đã có', description: 'Tổng quan hoạt động toàn trường.' },
    ],
  },
  {
    title: 'Quản trị',
    items: [
      { path: '/to-chuc', label: 'Cơ cấu tổ chức', icon: Building2, phase: 'Giai đoạn 2', description: 'Quản lý ban, phòng, khoa và quan hệ đơn vị.' },
      { path: '/nhan-su', label: 'Nhân sự', icon: Users, phase: 'Giai đoạn 4', description: 'Hồ sơ viên chức, hợp đồng, kiêm nhiệm, đánh giá.' },
      { path: '/hanh-chinh', label: 'Hành chính - Tài chính', icon: Wallet, phase: 'Giai đoạn 4', description: 'Văn bản, thu chi, tài sản và cơ sở vật chất.' },
    ],
  },
  {
    title: 'Đào tạo',
    items: [
      { path: '/tuyen-sinh', label: 'Tuyển sinh', icon: UserPlus, phase: 'Giai đoạn 5', description: 'Chỉ tiêu, đợt tuyển sinh và hồ sơ thí sinh.' },
      { path: '/dao-tao', label: 'Chương trình & kế hoạch', icon: BookOpen, phase: 'Giai đoạn 5', description: 'Nghề, môn học, mô-đun, lớp, thời khóa biểu.' },
      { path: '/nguoi-hoc', label: 'Người học & điểm', icon: GraduationCap, phase: 'Giai đoạn 6', description: 'Hồ sơ HSSV, chuyên cần, rèn luyện, điểm, tốt nghiệp.' },
    ],
  },
  {
    title: 'Điều hành',
    items: [
      { path: '/cong-viec', label: 'Công việc', icon: ClipboardList, phase: 'Giai đoạn 8', description: 'Giao việc và theo dõi tiến độ.' },
      { path: '/lich-cong-tac', label: 'Lịch công tác', icon: CalendarDays, phase: 'Giai đoạn 8', description: 'Lịch công tác, lịch họp toàn trường.' },
      { path: '/van-ban', label: 'Văn bản', icon: FileText, phase: 'Giai đoạn 8', description: 'Văn bản đến, văn bản đi, trình ký.' },
      { path: '/bao-cao', label: 'Báo cáo', icon: BarChart3, phase: 'Giai đoạn 8', description: 'Báo cáo tổng hợp và thống kê.' },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { path: '/ai-office', label: 'Trợ lý AI-OFFICE', icon: Bot, phase: 'Giai đoạn 9', description: 'Hỏi đáp dữ liệu, tổng hợp, soạn thảo văn bản.' },
      { path: '/quan-tri', label: 'Quản trị hệ thống', icon: Settings, phase: 'Giai đoạn 2', description: 'Tài khoản, vai trò, phân quyền, nhật ký.' },
    ],
  },
]

export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items)

export function findNav(path: string): NavItem | undefined {
  const exact = allNavItems.find((item) => item.path === path)
  if (exact) return exact
  return [...allNavItems]
    .filter((item) => path.startsWith(item.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0]
}
