# EDU360 — Triển khai nền tảng Chặng 6 (Danh mục chương trình)

Ngày cập nhật: 2026-11-27  
Nhánh: `feature/edu360-curriculum-foundation`

## Đã xây dựng trong nhánh

- Migration `20261127100000_curriculum_catalog_foundation.sql`:
  - occupations, training_programs, program_versions
  - subjects, program_subjects
  - academic_years, academic_terms
  - khóa ngoại, unique/check constraints, indexes và RLS theo training permission + org_unit
  - phiên bản chương trình chỉ sửa khi draft/review; phê duyệt qua RPC `approve_program_version` và cần số quyết định/lý do.
- Giao diện `TrainingPage`: danh mục nghề, chương trình, học phần, tạo phiên bản, cấu hình học phần theo phiên bản, gửi duyệt/phê duyệt.
- Route `/dao-tao` được bảo vệ bằng AccessGate `training`.

## Kiểm tra

- Migration đã chạy thử trong transaction rollback trên Supabase production; DDL, policies và RPC chạy qua không lỗi; không để lại thay đổi.
- Chưa áp dụng migration production.
- Preview/CI đang chờ kết quả trên PR.
- Chưa có dữ liệu nghề/chương trình/học phần thật; không seed dữ liệu giả.

## Cổng trước production

- Đối chiếu danh mục nghề, mã nghề, trình độ, chương trình và quyết định đang áp dụng của trường.
- Đối chiếu số giờ lý thuyết/thực hành/thực tập, học kỳ và thứ tự học phần.
- Kiểm thử JWT theo Phòng Đào tạo/khoa/Giáo viên/BGH; BGH chỉ xem báo cáo.
- Kiểm thử tính bất biến của phiên bản đã phê duyệt và separation-of-duty.
- Sau khi chốt dữ liệu chuẩn mới triển khai kế hoạch đào tạo, mở lớp học phần, phân công giáo viên, TKB, chuyên cần và điểm.

## Chưa thuộc phạm vi đã hoàn tất

Kế hoạch đào tạo chi tiết, phân công giảng dạy, thời khóa biểu, phòng/xưởng, chuyên cần, đánh giá, điểm, khóa điểm và xét tốt nghiệp chưa được xây dựng trong nhánh này. Không coi danh mục chương trình là hoàn thành toàn bộ Chặng 6.
