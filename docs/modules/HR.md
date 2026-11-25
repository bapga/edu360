# Phân hệ Nhân sự — hiện trạng và thiết kế

Ngày kiểm tra: 2026-11-25  
Nguồn: Supabase production, chỉ đọc metadata và số liệu tổng hợp.

## 1. Dữ liệu hiện có

Dùng hai bảng gốc hiện hữu:
- public.staff: hồ sơ nhân sự.
- public.staff_assignments: lịch sử/phân công nhân sự theo đơn vị.

Số liệu hiện tại:
- 0 hồ sơ nhân sự.
- 0 phân công công tác.
- Không truy vấn hay xuất dữ liệu cá nhân trong bước kiểm kê.

## 2. Hồ sơ nhân sự

Các trường đã xác minh:
- staff_code, full_name.
- date_of_birth, gender, national_id.
- phone, email, address.
- status, user_id, deleted_at.
- created_at/updated_at và người tạo/cập nhật.

Ràng buộc:
- gender: male, female, other.
- status: active, on_leave, resigned, retired.
- staff_code duy nhất trong hồ sơ chưa xóa.
- national_id duy nhất nếu có và hồ sơ chưa xóa.
- user_id liên kết duy nhất với auth.users; hai FK trùng lặp đang tồn tại, chưa tự ý xóa.

## 3. Phân công công tác

Các trường:
- staff_id, org_unit_id, position_title.
- is_primary, start_date, end_date, status.

Ràng buộc:
- end_date không được trước start_date.
- status: active hoặc ended.
- Mỗi nhân sự chỉ có một phân công chính đang active.
- Không trùng phân công active theo nhân sự + đơn vị + chức vụ.
- Liên kết tới staff và org_units.

## 4. Bảo mật và audit

- Staff SELECT: hồ sơ của chính người dùng, hoặc quyền hr.view toàn cục/đơn vị theo phân công.
- Staff INSERT: hr.create.
- Staff UPDATE: hr.update toàn cục hoặc theo đơn vị có phân công.
- Staff assignments SELECT: quyền hr.view theo đơn vị hoặc phân công của chính người dùng.
- Staff assignments INSERT: hr.create theo org_unit_id.
- Staff assignments UPDATE: hr.update theo org_unit_id.
- Không có policy DELETE cho hai bảng.
- Hai bảng đều có trigger ghi audit log và trigger tự cập nhật audit fields.

## 5. Giao diện đã triển khai trên nhánh tính năng

- Danh sách nhân sự đọc trực tiếp từ staff.
- Tìm kiếm mã, họ tên, email, điện thoại; lọc trạng thái.
- Hiển thị đơn vị/chức vụ từ staff_assignments trong phạm vi RLS cho phép.
- Tạo/sửa hồ sơ được ẩn/hiện theo hr.create và hr.update.
- Không có chức năng xóa cứng; trạng thái nghỉ việc/nghỉ hưu được lưu theo status.
- Không tự tạo tài khoản đăng nhập khi thêm hồ sơ nhân sự; liên kết user_id là quy trình riêng.
- Không tạo dữ liệu mẫu trên production.

## 6. Các bước tiếp theo

1. Bổ sung màn hình quản lý phân công: đơn vị, chức vụ, ngày hiệu lực, phân công chính, kết thúc phân công.
2. Thiết kế luồng liên kết hồ sơ staff với profiles/auth.users; không tự gửi email mời hoặc tạo tài khoản nếu chưa có phê duyệt.
3. Bổ sung import Excel có xem trước, kiểm tra trùng mã/số định danh và báo cáo lỗi trước khi ghi.
4. Kiểm thử RLS theo quyền hr.view/create/update và phạm vi org_unit_id.
5. BGH không được xem hồ sơ nhân sự theo chính sách nghiệp vụ đã thống nhất; phải thu hồi hr.view ở database, không chỉ chặn frontend.
