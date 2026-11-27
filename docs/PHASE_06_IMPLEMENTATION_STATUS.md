# EDU360 — Trạng thái Chặng 6: Danh mục chương trình đào tạo

Ngày cập nhật: 2026-11-27
Nhánh triển khai tiếp theo: `feature/edu360-teaching-timetable-foundation`

## Đã triển khai production

- Migration `20261127100000_curriculum_catalog_foundation.sql` đã áp dụng vào Supabase production (migration history: `20261127094044_curriculum_catalog_foundation`).
- 7 bảng đã tạo và bật RLS: `occupations`, `training_programs`, `program_versions`, `subjects`, `program_subjects`, `academic_years`, `academic_terms`.
- RPC `approve_program_version` kiểm tra quyền `training.approve`, số quyết định, lý do và yêu cầu phiên bản có học phần trước khi phê duyệt.
- Giao diện `TrainingPage` đã có danh mục nghề, chương trình, học phần, phiên bản và cấu hình học phần theo phiên bản; route `/dao-tao` được bảo vệ bởi AccessGate.

## Kiểm thử đã thực hiện

- Migration chạy thử trong transaction rollback trên production trước khi áp dụng.
- Đã xác minh RLS bật trên cả 7 bảng.
- Kiểm thử JWT BGH mô phỏng trong transaction rollback: chỉ có `reports.view`, không đọc được danh mục nghề/chương trình/học phần/phiên bản.
- GitHub CI và Vercel production deployment của commit `825ed1946f757f97c9c38af2a0d66eb42ccce0f0` đạt trạng thái thành công/READY.
- Chưa có dữ liệu nghề/chương trình/học phần thật; không seed dữ liệu giả.

## Phạm vi còn thiếu của Chặng 6

Kế hoạch đào tạo theo khóa/năm học, mở lớp học phần, phân công giáo viên, phòng/xưởng, thời khóa biểu, chuyên cần, đánh giá, điểm, khóa điểm, tính kết quả và xét tốt nghiệp vẫn đang được triển khai theo từng lát cắt. Không coi danh mục chương trình là hoàn thành toàn bộ Chặng 6.

## Cổng nghiệm thu còn lại

- Đối chiếu chương trình, số giờ, quyết định và biểu mẫu thật của trường.
- Kiểm thử tài khoản thật theo Phòng Đào tạo/khoa/giáo viên/BGH.
- Kiểm thử browser E2E, import Excel, upload tài liệu và quy trình nghiệp vụ thực tế.
