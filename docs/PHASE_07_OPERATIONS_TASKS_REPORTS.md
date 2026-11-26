# EDU360 — Chặng 7: Điều hành, Công việc, Lịch công tác và Báo cáo

Trạng thái: Thiết kế; chưa tạo migration hoặc ghi Supabase production.
Ngày: 2026-11-26

## 1. Mục tiêu
- Quản lý nhiệm vụ, người giao/nhận, phối hợp, hạn, tiến độ, minh chứng và lịch sử.
- Quản lý lịch họp, lịch công tác, sự kiện trường/phòng/khoa.
- Xây dựng báo cáo tổng hợp dùng chung, không tạo kho dữ liệu báo cáo lệch nguồn.
- BGH chỉ xem báo cáo aggregate; không có quyền CRUD task, lịch hoặc bảng nghiệp vụ.

## 2. Mô hình dữ liệu đề xuất

| Bảng | Trường chính | Kiểm soát |
|---|---|---|
| work_tasks | task_code, title, description, priority, status, starts_at, due_at, owner_user_id, owner_staff_id, org_unit_id, created_by | mã unique; due_at >= starts_at |
| task_assignees | task_id, assignee_user_id, assignee_staff_id, org_unit_id, responsibility, assigned_at, accepted_at, status | assignment active duy nhất theo người/nhiệm vụ |
| task_checklists | task_id, title, sort_order, required, completed_at, completed_by | lưu lịch sử hoàn thành |
| task_comments | task_id, author_id, body, visibility, created_at | append-only |
| task_attachments | task_id, object_path, file metadata, uploaded_by | Storage private |
| task_events | task_id, event_type, actor_id, reason, metadata_redacted, created_at | append-only |
| work_calendar_events | event_code, title, event_type, starts_at, ends_at, org_unit_id, location, visibility, created_by, status | starts_at < ends_at |
| calendar_attendees | event_id, user_id, staff_id, response_status | unique(event_id,user_id) |
| calendar_event_changes | event_id, actor_id, old_period, new_period, reason, created_at | lịch sử thay đổi |

Dùng ID auth.users khi cần; không sao chép hồ sơ nhân sự.

## 3. Quy trình công việc
Trạng thái đề xuất: draft → assigned → accepted → in_progress → blocked → submitted → completed; cancelled/reopened phải có lý do.
- Người giao tạo task, chọn đơn vị/người chịu trách nhiệm, hạn và ưu tiên.
- Người nhận xác nhận; từ chối phải ghi lý do.
- Người thực hiện cập nhật tiến độ, checklist, bình luận và minh chứng.
- Người giao hoặc người có tasks.approve nghiệm thu nếu quy trình yêu cầu.
- Hạn tính theo Asia/Ho_Chi_Minh, lưu timestamp UTC.
- Thay đổi người nhận/hạn sau khi giao phải tạo event; không xóa lịch sử.
- Không hard-delete task đã giao.

## 4. Lịch công tác
- Sự kiện có thời gian, địa điểm, đơn vị chủ trì, người tham dự và visibility private/unit/school.
- Mời người tham dự, lưu trạng thái xác nhận.
- Sửa/hủy lịch đã thông báo phải ghi lịch sử và phát thông báo cập nhật.
- Policy kiểm tra visibility và scope; không mặc định mở lịch cá nhân cho BGH.

## 5. Phân quyền
| Vai trò | Quyền |
|---|---|
| Admin | Quản trị và giám sát toàn trường theo quyền |
| Trưởng/phó phòng/khoa | Giao, theo dõi, nghiệm thu trong đơn vị |
| Chuyên viên/giáo viên | Xem việc được giao, cập nhật tiến độ |
| BGH | Chỉ xem chỉ số tổng hợp trong reports; không CRUD task/lịch |
| Người học | Không mặc định có quyền |

Mọi policy xác minh scope đơn vị và assignment; không cho người dùng tự thêm mình vào task để mở quyền.

## 6. Báo cáo tổng hợp
Chỉ số: tuyển sinh, người học, tiến độ đào tạo/giờ học, chuyên cần, tỷ lệ nộp/khóa điểm, nhân sự aggregate, văn bản đúng hạn, dự toán/chi tổng hợp, tài sản theo nhóm, nhiệm vụ đúng hạn/quá hạn.

RPC reports_summary cần:
- Kiểm tra reports.view ở database; scope do server xác thực.
- Chỉ trả count/tỷ lệ/aggregate; không trả tên, email, số điện thoại, mã học sinh/nhân sự, điểm cá nhân, số chứng từ hoặc file path.
- Suppression nhóm quá nhỏ để tránh suy luận danh tính.
- Validate khoảng ngày, timezone, org scope; không nhận tên bảng/cột/SQL tùy ý.
- Export chỉ khi có reports.export và ghi audit.

## 7. Giao diện
- Dashboard điều hành theo quyền; KPI, xu hướng, cảnh báo.
- Task board/list với lọc trạng thái, ưu tiên, đơn vị, người phụ trách, hạn; timeline/checklist.
- Calendar tháng/tuần/ngày, lọc đơn vị.
- Reports có bộ lọc thời gian/phân hệ/đơn vị theo scope, biểu đồ và bảng tổng hợp.
- BGH landing /bao-cao, menu duy nhất Báo cáo; không có task CRUD hoặc lịch chi tiết mặc định.

## 8. Kiểm thử
- Người ngoài scope không đọc task/attachment.
- Người nhận không thể tự đổi owner hoặc tự nghiệm thu.
- Task hoàn tất chỉ mở lại với quyền và lý do.
- Lịch private không lộ qua API.
- RPC reports không trả row-level records; BGH đọc bảng nguồn bị từ chối.
- Org filter bị giới hạn theo scope, không dò đơn vị khác bằng UUID.
- Số liệu aggregate khớp dữ liệu nguồn; không có dữ liệu phải thể hiện rõ, không giả số.
- Kiểm thử JWT Admin, BGH, trưởng phòng/khoa và người được giao.

## 9. Cổng triển khai
- [ ] Chốt mẫu giao việc, quy chế giao/nhận/nghiệm thu và lịch công tác.
- [ ] Chốt chỉ số và suppression.
- [ ] Thiết kế ERD, indexes, RLS, Storage, RPC, audit.
- [ ] Kiểm thử scope, privacy, timezone và concurrency.
- [ ] Chỉ áp dụng migration sau phê duyệt riêng.
