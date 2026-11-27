# EDU360 — Chặng 6B: Mở lớp học phần, phân công và thời khóa biểu

Ngày: 2026-11-27
Trạng thái: **đã áp dụng production** sau khi PR #6 được merge.

## Phạm vi lát cắt

Migration `20261127111000_teaching_timetable_foundation.sql` bổ sung:

- `class_subject_offerings`: mở lớp học phần từ lớp hành chính, học phần thuộc phiên bản chương trình đã phê duyệt và học kỳ.
- `classrooms`: danh mục phòng học, xưởng, phòng thực hành/lab, sức chứa và trạng thái.
- `teaching_assignments`: phân công giáo viên vào lớp học phần, có vai trò và thời hạn hiệu lực.
- `timetable_slots`: tiết học theo thứ, khoảng tiết, khoảng ngày, giáo viên và phòng/xưởng.

## Bảo mật và quy tắc dữ liệu

- RLS bật trên cả 4 bảng; scope theo đơn vị và quyền `training`/`teaching`.
- Không cho tạo lịch ở trạng thái công bố trực tiếp; lịch mới bắt đầu ở `draft`.
- Trigger kiểm tra giáo viên đang hoạt động, có phân công công tác cùng đơn vị trong toàn bộ thời hạn giảng dạy; phòng/xưởng phải hoạt động và cùng đơn vị.
- RPC `publish_timetable(p_academic_term_id,p_org_unit_id,p_reason)` yêu cầu `teaching.approve`, lý do tối thiểu 10 ký tự, khóa giao dịch theo học kỳ, kiểm tra xung đột lớp/giáo viên/phòng trước khi công bố nguyên tử và ghi audit.
- Không có policy DELETE cho các bảng nghiệp vụ này.
- BGH không có quyền `teaching` hoặc `training`; chỉ được xem báo cáo tổng hợp qua RPC hiện hữu.

## Kiểm tra

- Migration đã chạy thử thành công trong transaction rollback trước khi áp dụng.
- Migration production đã áp dụng: `20261127111338_teaching_timetable_foundation`.
- Xác minh RLS bật trên cả 4 bảng; mỗi bảng có 3 policy.
- Kiểm thử JWT mô phỏng Admin: có `training.view`, `teaching.view`, `teaching.approve`.
- Kiểm thử JWT mô phỏng BGH: không có các quyền trên; SELECT cả 4 bảng trả 0 dòng.
- GitHub CI/Vercel Preview thành công; Vercel production commit `ed2da7bc6495e35b8cc04d88b99073548552c5d9` đạt READY.
- Runtime Errors production 24 giờ: không phát hiện lỗi.
- Chưa có dữ liệu nhân sự, lớp, học phần, phòng hoặc lịch thật để kiểm thử nghiệp vụ.
- Chưa có giao diện nhập phân công/thời khóa biểu trong lát cắt này; UI sẽ được nối sau khi schema được duyệt qua CI.

## Kiểm thử nghiệm thu bắt buộc

1. Không thể mở lớp học phần nếu chương trình chưa phê duyệt hoặc lớp/học kỳ/học phần khác đơn vị.
2. Không thể phân công nhân sự không hoạt động hoặc không có phân công công tác phù hợp thời hạn.
3. Không thể xếp một lớp, giáo viên hoặc phòng vào hai tiết giao nhau trong cùng khoảng ngày.
4. Người dùng không có `teaching.approve` không thể gọi RPC công bố trực tiếp.
5. BGH chỉ đọc được báo cáo tổng hợp; không đọc trực tiếp lịch, phân công hay hồ sơ nguồn.
6. Lịch đã công bố không được sửa trực tiếp; thay đổi lịch phải triển khai qua workflow yêu cầu/duyệt riêng.
