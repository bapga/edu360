# EDU360 — Trạng thái khắc phục phân quyền production

Ngày áp dụng: 2026-11-26  
Supabase project: `akckcnijujtevfbginja`  
Migration: `20261126153433_production_rbac_reporting_hardening`  
Nguồn triển khai: `supabase/migrations/20261126153433_production_rbac_reporting_hardening.sql`

## 1. Đã áp dụng

- `system_admin`: 91 quyền trên 13 module gồm `system`, `org`, `hr`, `admin_docs`, `finance`, `assets`, `admissions`, `students`, `training`, `teaching`, `grades`, `tasks`, `reports`; không cấp `ai_office`.
- `ban_giam_hieu`: chỉ giữ `reports.view`; đã thu hồi `hr.view` và `students.view`.
- RLS SELECT trên `modules`, `roles`, `role_permissions` chỉ cho người có `system.view`.
- RLS SELECT trên `org_units` theo `system.view` hoặc quyền view tương ứng trong phạm vi đơn vị.
- RLS SELECT trên `user_roles` chỉ cho `system.view`; self authorization dùng RPC `my_permissions()`.
- `private.apply_permission_change`: validate payload; matrix grant dùng `ON CONFLICT(role_id,module_id,action)`; role assignment được serialize bằng transaction advisory lock theo bộ khóa tự nhiên.
- `request_permission_change`: validate role/module/action/scope, user active, org unit active, lý do tối thiểu 10 ký tự; chặn self role assignment request và giữ AI Office đóng.
- `decide_permission_change`: chặn requester tự duyệt; chặn approver thay đổi ma trận hoặc assignment của role mà chính approver đang giữ; chặn tự thay đổi role.
- `reports_summary()`: chỉ trả aggregate counts và kiểm tra `reports.view`; không trả hồ sơ nguồn. Chỉ số chưa có bảng nguồn trả `not_available`.
- RPC quyền thay đổi và báo cáo chỉ EXECUTE cho authenticated; thu hồi PUBLIC/anon.

## 2. Kiểm thử đã chạy

Các kiểm thử được thực hiện bằng cách mô phỏng JWT trong transaction và rollback toàn bộ thay đổi thử nghiệm:

- BGH: `my_permissions()` chỉ trả `reports.view`.
- BGH: 0 rows đọc được từ `roles`, `modules`, `role_permissions`, `org_units`, `user_roles`.
- BGH: `reports_summary()` trả 9 đơn vị, 0 nhân sự, 0 phân công; tuyển sinh/người học/kết quả đào tạo báo `not_available`.
- Admin: 91 permission rows, đọc được metadata quản trị, 9 đơn vị và audit log.
- Separation of duty: người duyệt bị từ chối khi yêu cầu tác động đến role họ đang giữ; luồng phê duyệt role khác chạy thành công trong transaction rollback.

Đây là kiểm thử SQL/RLS với JWT claims mô phỏng, không thay thế browser E2E hoặc nghiệm thu bằng tài khoản BGH/giáo viên/chuyên viên thật.

## 3. Tình trạng tài khoản production

- Hiện có 2 hồ sơ active; cả hai đang giữ `system_admin`.
- Chưa có hồ sơ nào được gán `ban_giam_hieu`, giáo viên, chuyên viên, trưởng/phó phòng hoặc trưởng/phó khoa.
- Vì cả hai Admin đều giữ `system_admin`, quy trình hai người không cho phép họ phê duyệt thay đổi ma trận/assignment của chính role `system_admin`. Bootstrap role này chỉ được thực hiện qua migration DBA có kiểm soát.
- Không tạo tài khoản mới, không đặt mật khẩu mặc định và không gửi email mời trong migration.

## 4. Cảnh báo còn lại

- Supabase Security Advisor báo leaked-password protection đang tắt: cần bật tại Authentication > Settings > Password Security sau khi kiểm tra tác động chính sách mật khẩu.
- Security Advisor liệt kê 9 SECURITY DEFINER RPC callable bởi authenticated. Các RPC đã kiểm tra có guard quyền/ownership và `search_path = ''`; cần giữ regression test và review mỗi khi sửa.
- `private.c8_removed_role_permissions` đang có 36 dòng, RLS OFF. Bảng nằm trong schema private; anon/authenticated không có SELECT grant, nhưng authenticated có USAGE schema. Không tự bật RLS khi chưa quyết định chính sách đọc/giữ/xóa archive; bật RLS không policy sẽ khóa mọi truy cập của role không phải owner.
- Vercel build cảnh báo install script `esbuild` chưa được allowScripts và npm config `cache-dir` không nhận diện.
- Một số FK chưa có index; cần ưu tiên theo truy vấn và quy mô dữ liệu thực tế thay vì tạo index hàng loạt không cần thiết.

## 5. Cổng phát hành còn mở

1. Kiểm thử browser đăng nhập bằng hai tài khoản Admin và một tài khoản BGH thật; xác nhận BGH không truy cập được các route/API quản trị.
2. Tạo/gán tài khoản giáo viên, chuyên viên, trưởng/phó phòng/khoa theo danh sách được trường phê duyệt; không tự tạo password mặc định.
3. Hoàn thiện các phân hệ còn placeholder: văn bản, tài chính, tài sản, tuyển sinh, người học, chương trình, giảng dạy, TKB, chuyên cần, điểm, công việc và báo cáo chuyên sâu.
4. Chốt biểu mẫu và quy chế thực tế của trường trước khi tạo bảng/migration nghiệp vụ.
5. Chạy CI/Preview mới nhất; nghiệm thu người dùng; sau đó mới merge và promote Vercel production.

Migration trên đã hoàn tất phần nền tảng phân quyền production. Không được xem toàn bộ EDU360 là đã hoàn tất vận hành cho đến khi các cổng trên được nghiệm thu.
