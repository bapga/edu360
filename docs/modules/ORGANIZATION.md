# Phân hệ Cơ cấu tổ chức — hiện trạng và thiết kế

Ngày kiểm tra: 2026-11-25  
Nguồn dữ liệu: Supabase production, truy vấn chỉ đọc.

## 1. Dữ liệu đang có

Bảng dùng chung: public.org_units. Không tạo bảng cơ cấu tổ chức mới.

Hiện có 9 đơn vị, tất cả đang hoạt động và đều là đơn vị gốc (parent_id = NULL):

| Mã | Đơn vị | Loại |
|---|---|---|
| BQTHT | Ban Quản trị hệ thống | admin_board |
| BGH | Ban Giám hiệu | leadership |
| P_TCCB | Phòng Tổ chức - Cán bộ | department |
| P_HCKT | Phòng Hành chính - Kế toán | department |
| P_DT | Phòng Đào tạo | department |
| P_QLHSSV | Phòng Quản lý HSSV | department |
| K_GDPT | Khoa Giáo dục phổ thông | faculty |
| K_KTCN | Khoa Kỹ thuật - Công nghiệp | faculty |
| K_CNDV | Khoa Công nghệ - Dịch vụ | faculty |

Chưa có quan hệ cha-con giữa 9 đơn vị. Không tự ý gán phòng/khoa trực thuộc Ban Giám hiệu hoặc Ban Quản trị khi chưa có quyết định cơ cấu được xác nhận.

## 2. Cấu trúc bảng và ràng buộc

Các trường được dùng ở giao diện:
- id, code, name, unit_type
- parent_id, sort_order, is_active, deleted_at

Ràng buộc đã xác minh:
- id là khóa chính.
- parent_id tự tham chiếu org_units(id).
- unit_type nhận admin_board, leadership, department, faculty, other.
- code có unique index có điều kiện deleted_at IS NULL.
- Có index trên parent_id.
- Xóa logic qua deleted_at; RLS hiện không có policy DELETE.

## 3. Bảo mật hiện tại

- SELECT: người dùng có profile active được đọc danh mục.
- INSERT: yêu cầu private.has_permission('org','create').
- UPDATE: yêu cầu private.has_permission('org','update').
- Không có policy DELETE.
- Bảng này không được dùng làm căn cứ thay thế quyền truy cập các phân hệ nhân sự, đào tạo hay người học.

Do role system_admin hiện chưa có org.view/create/update trong role_permissions, giao diện phân hệ vẫn bị route guard chặn cho đến khi ma trận quyền được duyệt và áp dụng. Không cấp quyền giả ở frontend.

## 4. Phạm vi giao diện đã triển khai trên nhánh tính năng

- Đọc trực tiếp org_units, không dùng dữ liệu giả.
- Thống kê tổng đơn vị, số phòng và số khoa đang hoạt động.
- Tìm kiếm theo tên/mã, lọc loại đơn vị và tùy chọn hiển thị đơn vị ngừng hoạt động.
- Loading, error, retry và empty state.
- Chỉ đọc; không thêm/sửa/xóa/sắp xếp để tránh ghi production khi chưa có quyền.

## 5. Các bước tiếp theo

1. Xác nhận sơ đồ cha-con chính thức của nhà trường.
2. Sau khi quyền org được phê duyệt, bổ sung form tạo/sửa đơn vị, validation mã không trùng, chọn đơn vị cấp trên và kiểm tra không tạo chu trình cha-con.
3. Chỉ dùng soft-delete; từ chối ngừng hoạt động đơn vị đang còn nhân sự/phân công trực thuộc nếu quy tắc nghiệp vụ yêu cầu.
4. Thêm audit log và kiểm thử RLS trực tiếp bằng tài khoản có/không có quyền.
