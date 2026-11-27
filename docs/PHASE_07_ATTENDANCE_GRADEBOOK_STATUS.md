# EDU360 — Chặng 7: Chuyên cần và sổ điểm

Ngày cập nhật: 2026-11-27

## Phạm vi production

Cơ sở dữ liệu chuyên cần và sổ điểm đã có trong Supabase migration history:
- `20261127113254_attendance_grades_foundation`
- Bảng: `attendance_sessions`, `attendance_records`, `grade_sheets`, `grade_components`, `grade_entries`.
- RLS bật trên cả 5 bảng; chính sách theo quyền `teaching` và `grades`.
- Sổ điểm dùng trọng số dạng tỷ lệ 0–1, thang điểm cấu hình trên `grade_sheets`.

Migration hardening bổ sung:
- Sửa trigger xác thực chuyên cần/điểm: trạng thái tuyển sinh hợp lệ là `studying` (không phải `active`).
- Kiểm tra ngày buổi học nằm trong học kỳ; nếu gắn tiết TKB thì tiết phải thuộc đúng lớp học phần và đã công bố.
- Siết tạo buổi chuyên cần mới chỉ ở trạng thái `draft`.
- RPC lấy danh sách lớp chỉ trả mã người học và họ tên; không cấp quyền đọc rộng bảng hồ sơ cá nhân.
- RPC gửi duyệt và phê duyệt chuyên cần; không cho người lập tự duyệt.
- Hoàn thiện gửi duyệt sổ điểm với kiểm tra tổng trọng số 100%, có người học, đủ điểm thành phần; bổ sung trả lại/mở khóa có lý do và audit.

## Giao diện

- Route `/nguoi-hoc/diem`, là phân hệ con của Người học.
- Điểm danh theo buổi, ghi nhận có mặt/đi muộn/vắng có phép/vắng không phép, số tiết vắng.
- Tạo sổ điểm, thêm cột điểm/trọng số, nhập điểm theo từng người học.
- Gửi duyệt, phê duyệt, trả lại, khóa và mở khóa có lý do.
- BGH vẫn chỉ có `reports.view`, không đọc được các bảng chuyên cần/điểm.

## Kiểm thử và giới hạn

- Migration hardening chạy thử transaction rollback trước khi áp dụng.
- Migration production: `20261127114321_attendance_workflow_hardening`.
- Migration production: `20261127115000_grade_offering_read_access`, bổ sung quyền `grades.view` xem lớp học phần mà không cấp quyền đọc dữ liệu đào tạo ngoài phạm vi.
- RLS bật trên 5 bảng; BGH mô phỏng chỉ có `reports.view`, truy vấn 5 bảng trả 0 dòng.
- Các RPC SECURITY DEFINER đều dùng `search_path=''` và chỉ cấp EXECUTE cho authenticated.
- Vercel Preview build (TypeScript + Vite) đạt READY; npm audit: 0 vulnerabilities.
- Chưa có dữ liệu học sinh/lớp học phần/giáo viên thật nên chưa thể nghiệm thu nghiệp vụ bằng dữ liệu thật hoặc browser E2E.
- Nguồn migration nền `attendance_grades_foundation` đã có trong lịch sử Supabase nhưng chưa được đối chiếu thành file nguồn trên nhánh main; cần đồng bộ lại lịch sử migration trong công việc tiếp theo.
