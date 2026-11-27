# EDU360 — Trạng thái Chặng 6: Đào tạo, giảng dạy và thời khóa biểu

Ngày đối chiếu production: 2026-11-27

## Đã triển khai

### Danh mục chương trình đào tạo
- Migration `20261127094044_curriculum_catalog_foundation` đã áp dụng production.
- 7 bảng có RLS: `occupations`, `training_programs`, `program_versions`, `subjects`, `program_subjects`, `academic_years`, `academic_terms`.
- Có RPC phê duyệt phiên bản chương trình; phiên bản đã duyệt được bảo vệ khỏi sửa trực tiếp.
- Giao diện tại `/dao-tao`.

### Mở lớp học phần, phân công và thời khóa biểu
- Migration `20261127111338_teaching_timetable_foundation` đã có trong Supabase migration history.
- 4 bảng có RLS: `class_subject_offerings`, `classrooms`, `teaching_assignments`, `timetable_slots`.
- RPC `publish_timetable` yêu cầu `teaching.approve`, lý do công bố và kiểm tra xung đột lớp, giáo viên, phòng/xưởng trước khi công bố.
- Giao diện tại `/giang-day`: mở lớp học phần, quản lý phòng/xưởng, phân công giáo viên, tạo tiết và công bố thời khóa biểu.
- Phân công giáo viên được đối chiếu với hồ sơ nhân sự và phân công công tác hiện hành.

## Xác minh production ngày 2026-11-27

- Supabase migration history xác nhận cả hai migration ở trên đã áp dụng.
- Supabase table inventory xác nhận 11 bảng danh mục/kế hoạch/giảng dạy tương ứng tồn tại và RLS đang bật.
- Vercel production deployment commit `63a971cdefdf0c14a74eece70d9b13bdc7516f33` đạt trạng thái `READY`.
- Runtime Errors trong 24 giờ gần nhất: không phát hiện lỗi.
- Dữ liệu thực tế của lớp, chương trình, học phần, nhân sự, phân công và phòng/xưởng hiện chưa được nhập; không seed dữ liệu giả.

## Chưa hoàn thành — không được coi là nghiệm thu Chặng 6

1. Kế hoạch đào tạo theo khóa/năm học và theo dõi tiến độ giờ.
2. Điểm danh theo buổi, đóng phiên và yêu cầu sửa chuyên cần.
3. Cấu hình thang điểm/công thức theo quy chế từng chương trình.
4. Đánh giá, nhập/nộp điểm, duyệt, khóa điểm và quy trình sửa điểm.
5. Tính/công bố kết quả học tập và xét tốt nghiệp.
6. Báo cáo đào tạo tổng hợp cho Ban Giám hiệu qua RPC; BGH chỉ được xem số liệu tổng hợp, không truy cập bảng nguồn.
7. Kiểm thử browser E2E với tài khoản thật của Phòng Đào tạo, khoa, giáo viên và BGH.

## Cổng nghiệm thu

- Đối chiếu chương trình, số giờ, quyết định, biểu mẫu, quy chế và công thức điểm thực tế của trường.
- Kiểm thử RLS/RPC bằng JWT của từng vai trò; kiểm tra cả truy cập trực tiếp API.
- Kiểm thử xung đột lịch đồng thời, khóa điểm, separation-of-duty và audit.
- Chạy browser E2E, kiểm tra import/export và phục hồi dữ liệu.
- Chỉ xác nhận nghiệm thu khi có dữ liệu và tài khoản thật; không dùng dữ liệu giả để đánh dấu đạt.

## Nguyên tắc bảo mật

- RLS/RPC ở PostgreSQL là lớp bảo mật quyết định; frontend guards không thay thế RLS.
- BGH chỉ có `reports.view`; không cấp quyền đọc trực tiếp dữ liệu người học, nhân sự, lịch cá nhân hay điểm cá nhân.
- Không hard-code công thức điểm hoặc điều kiện tốt nghiệp khi chưa đối chiếu quy chế được phê duyệt.
- Mọi sửa điểm sau khi nộp/khóa phải qua yêu cầu, người duyệt độc lập, lý do và audit.
