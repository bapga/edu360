# EDU360 — Baseline cơ sở dữ liệu production (read-only inventory)

Ngày kiểm tra: 2026-11-25. Project ref: `akckcnijujtevfbginja`.

Tài liệu này ghi nhận cấu trúc đã quan sát bằng truy vấn metadata chỉ đọc. Không có DDL/DML nào được thực hiện.

## Bảng hiện có trong schema public

- `profiles`
- `roles`
- `user_roles`
- `modules`
- `role_permissions`
- `org_units`
- `staff`
- `staff_assignments`
- `system_settings`
- `audit_logs`
- `auth_events`
- `notifications`
- `permission_change_requests`

## Những gì schema hiện có hỗ trợ

- Hồ sơ tài khoản và liên kết nhân sự: `profiles`, `staff`.
- Cơ cấu đơn vị: `org_units`.
- Phân công nhân sự theo đơn vị/vị trí/thời hạn: `staff_assignments`.
- RBAC và module/action: `roles`, `user_roles`, `modules`, `role_permissions`.
- Cấu hình, nhật ký và thông báo: `system_settings`, `audit_logs`, `auth_events`, `notifications`.
- Yêu cầu thay đổi quyền có luồng đề xuất/quyết định: `permission_change_requests`.

## Khoảng trống dữ liệu nghiệp vụ cần thiết kế trước khi lập trình

Tại thời điểm kiểm tra, chưa thấy các bảng miền nghiệp vụ riêng cho:
- Hồ sơ người học, khóa/lớp và biến động người học.
- Tuyển sinh, thí sinh, hồ sơ xét tuyển và nhập học.
- Nghề/chương trình đào tạo, môn học/mô-đun, kế hoạch đào tạo.
- Thời khóa biểu, buổi học, phân công giảng dạy và chuyên cần.
- Bảng điểm, thành phần đánh giá, khóa điểm, xét kết quả và tốt nghiệp.
- Văn bản hành chính, tài chính/kế toán và tài sản.
- Công việc, lịch công tác và dữ liệu báo cáo tổng hợp.

Các module trong bảng `modules` không đồng nghĩa các bảng nghiệp vụ đã được triển khai. Không viết frontend giả định bảng/column chưa tồn tại.

## Quy tắc triển khai tiếp theo

1. Thiết kế ERD và từ điển dữ liệu cho từng chặng, đối chiếu quy trình nghiệp vụ và quan hệ dữ liệu dùng chung.
2. Kiểm tra RLS, grants, indexes, constraints, triggers và RPC trước khi tạo client CRUD.
3. Không tự ý thêm bảng/cột hoặc áp dụng migration lên production.
4. Khi người dùng phê duyệt thay đổi database, tạo migration có thể rollback, kiểm thử trên môi trường phù hợp và xác minh sau áp dụng.
5. Dữ liệu điểm phải là một nguồn chuẩn, không sao chép điểm sang các bảng/phân hệ khác.
