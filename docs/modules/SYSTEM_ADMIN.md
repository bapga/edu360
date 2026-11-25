# Quản trị hệ thống — quy trình phân quyền và kiểm soát

## 1. Nguồn dữ liệu và RPC hiện hữu

- roles: danh mục vai trò.
- modules: danh mục phân hệ.
- role_permissions: ma trận quyền theo role/module/action/data_scope.
- user_roles: gán vai trò cho tài khoản và phạm vi đơn vị.
- permission_change_requests: yêu cầu thay đổi, người đề xuất, người quyết định và trạng thái.
- audit_logs: nhật ký sự kiện theo bảng, thao tác, bản ghi và actor.

RPC hiện hữu:
- request_permission_change(p_type, p_payload, p_reason): tạo yêu cầu; lý do tối thiểu 10 ký tự; không cho tự đề xuất thay đổi role assignment của chính mình.
- decide_permission_change(p_id, p_approve, p_note): chỉ người có system.approve; không cho người đề xuất tự quyết định; không cho approver thay đổi role assignment của chính mình.

## 2. Giao diện đã triển khai

- Hiển thị danh mục vai trò, module và ma trận quyền đang có trong database.
- Gửi yêu cầu cấp/thu hồi action cho role.
- Gửi yêu cầu gán/gỡ role cho tài khoản khác; không cho chọn chính tài khoản hiện tại.
- Hàng đợi yêu cầu chờ phê duyệt.
- Khóa thao tác duyệt yêu cầu do chính mình đề xuất.
- Khóa ở giao diện khi yêu cầu ma trận tác động đến role mà người duyệt đang giữ.
- Lịch sử yêu cầu đã xử lý.
- Nhật ký hệ thống 100 sự kiện gần nhất; chỉ lấy metadata, không truy xuất old_data/new_data.

## 3. Giới hạn bảo mật cần xử lý ở database

- Kiểm tra cùng role trong giao diện là lớp UX; không thay thế kiểm tra trong RPC.
- decide_permission_change production hiện chưa chặn approver duyệt matrix_grant/matrix_revoke cho role mà họ đang giữ. Cần áp dụng bản vá server-side đã mô tả trong docs/proposed/PRODUCTION_PERMISSION_REMEDIATION.md.
- apply_permission_change hiện có thể duplicate-key khi matrix_grant cho action đã tồn tại với scope khác. UI tạm chặn gửi yêu cầu này; RPC cần được sửa bằng upsert có chủ đích.
- Mọi thay đổi quyền phải có hai tài khoản độc lập: một người đề xuất, một người phê duyệt.
- Không tạo user/auth account tại màn hình này. Quy trình tạo tài khoản và liên kết hồ sơ nhân sự cần được thiết kế riêng, không gửi email tự động khi chưa có phê duyệt.

## 4. Điều kiện nghiệm thu

- BGH không đọc được màn hình quản trị, role matrix, request queue hoặc audit logs.
- Người không có system.update không thể gọi request_permission_change.
- Người không có system.approve không thể gọi decide_permission_change.
- Người đề xuất không tự quyết định yêu cầu.
- Người duyệt không thay đổi role assignment hoặc ma trận quyền của role mình đang giữ.
- Mọi quyết định có người thực hiện, thời gian và ghi chú.
- Test trực tiếp bằng RPC/RLS, không chỉ kiểm thử UI.
