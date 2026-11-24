// Dữ liệu mẫu chỉ phục vụ giao diện trong môi trường development/preview.
// Production không dùng dữ liệu giả: đặt VITE_DEMO_DATA=false (hoặc bỏ trống).
export const showDemoData: boolean =
  import.meta.env.DEV || import.meta.env.VITE_DEMO_DATA === 'true'

export type Tone = 'blue' | 'navy' | 'green' | 'orange'

export const demo = {
  kpis: [
    { label: 'Học sinh đang học', value: '1.248', note: '+32 so với kỳ trước', tone: 'blue' as Tone },
    { label: 'Cán bộ, giáo viên', value: '86', note: '5 người đang kiêm nhiệm', tone: 'navy' as Tone },
    { label: 'Lớp đang hoạt động', value: '42', note: 'Học kỳ 1, năm học 2026-2027', tone: 'green' as Tone },
    { label: 'Công việc quá hạn', value: '3', note: 'Cần xử lý trong tuần', tone: 'orange' as Tone },
  ],
  faculties: [
    { name: 'Khoa Giáo dục phổ thông', value: 512 },
    { name: 'Khoa Kỹ thuật - Công nghiệp', value: 431 },
    { name: 'Khoa Công nghệ - Dịch vụ', value: 305 },
  ],
  tasks: [
    { title: 'Kế hoạch đào tạo học kỳ 2', owner: 'Phòng Đào tạo', progress: 72, status: 'Đang thực hiện' },
    { title: 'Rà soát hồ sơ nhân sự năm 2026', owner: 'Phòng Tổ chức - Cán bộ', progress: 100, status: 'Hoàn thành' },
    { title: 'Kiểm kê thiết bị xưởng thực hành', owner: 'Phòng Hành chính - Kế toán', progress: 35, status: 'Quá hạn' },
    { title: 'Tổng hợp kết quả rèn luyện học kỳ 1', owner: 'Phòng Quản lý HSSV', progress: 58, status: 'Đang thực hiện' },
  ],
  schedule: [
    { time: '07:30', title: 'Họp giao ban Ban Giám hiệu', place: 'Phòng họp A' },
    { time: '09:00', title: 'Dự giờ Khoa Kỹ thuật - Công nghiệp', place: 'Xưởng thực hành 2' },
    { time: '14:00', title: 'Họp xét điều kiện thi', place: 'Phòng Đào tạo' },
  ],
  activity: [
    { text: 'Phòng Đào tạo đã cập nhật thời khóa biểu lớp CNTT-K12', time: '10 phút trước' },
    { text: 'Khoa Giáo dục phổ thông nộp báo cáo chuyên môn tháng 11', time: '1 giờ trước' },
    { text: 'Phòng Quản lý HSSV ghi nhận 4 đơn xin nghỉ phép', time: 'Hôm qua' },
  ],
  notifications: [
    { title: 'Có 3 công việc quá hạn', time: '08:00' },
    { title: 'Báo cáo tuyển sinh tháng 11 đã sẵn sàng', time: 'Hôm qua' },
  ],
}
