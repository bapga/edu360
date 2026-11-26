# EDU360 — Ma trận quyền và tiêu chí nghiệm thu

## 1. Vai trò chuẩn

| Vai trò | Dashboard | Báo cáo | Phân hệ nghiệp vụ | Quản trị hệ thống | Phê duyệt |
|---|---:|---:|---:|---:|---:|
| `system_admin` (Admin) | Có | Có | Quản lý toàn hệ thống | Có | Có |
| `ban_giam_hieu` (BGH) | Không | Chỉ xem | Không | Không | Không |
| Các vai trò còn lại | Theo quyền được cấp | Theo quyền được cấp | Theo phân công và phạm vi dữ liệu | Không mặc định | Không mặc định |

BGH chỉ được truy cập module `reports` với action `view`. Không cấp `create`, `update`, `delete`, `approve`, `import` hoặc `export`.

## 2. Nguyên tắc thực thi

1. PostgreSQL RLS và quyền EXECUTE của RPC là lớp bảo mật có thẩm quyền.
2. Frontend chỉ hiển thị menu, trang và thao tác tương ứng quyền đã xác minh; không được coi là biện pháp bảo mật thay thế RLS.
3. Khi không tải được hồ sơ hoặc quyền, hệ thống phải từ chối truy cập (fail closed).
4. Không dùng `user_metadata` do người dùng tự sửa để quyết định quyền.
5. Phạm vi dữ liệu `all`, `unit`, `own` phải được kiểm tra tại truy vấn/RLS, không chỉ ẩn dữ liệu trên giao diện.

## 3. Điều kiện phê duyệt

- Chỉ Admin có quyền `system.approve` mới được quyết định yêu cầu thay đổi quyền.
- Người tạo yêu cầu không được tự phê duyệt yêu cầu đó.
- Không cho phép cùng một cá nhân phê duyệt yêu cầu tác động đến quyền/quyền lợi của chính tài khoản đó nếu không có người duyệt độc lập.
- Ghi nhật ký người đề xuất, người duyệt, thời điểm, nội dung trước/sau và lý do.
- Yêu cầu bị từ chối hoặc đã xử lý không được phê duyệt lại.

## 4. Kiểm thử chấp nhận bắt buộc

### Admin
- Mở được các phân hệ được quản trị.
- Thực hiện được các thao tác quản lý theo quyền.
- Có thể xem, đề xuất và phê duyệt theo đúng quy trình tách biệt người thực hiện.
- Không vượt qua các kiểm tra RLS bằng cách gọi trực tiếp API/RPC.

### Ban Giám hiệu
- Sau đăng nhập được điều hướng đến `/bao-cao`.
- Menu chỉ hiển thị Báo cáo.
- Truy cập trực tiếp `/`, `/nhan-su`, `/nguoi-hoc`, `/quan-tri` hoặc URL phân hệ khác đều bị từ chối/điều hướng phù hợp.
- Gọi trực tiếp Supabase API để đọc bảng nhân sự/người học phải bị RLS từ chối.
- Không thể tạo, sửa, xóa, import, export hoặc phê duyệt.

### Tài khoản không có quyền
- Không nhìn thấy menu tương ứng.
- Truy cập URL trực tiếp bị chặn.
- Không đọc/ghi dữ liệu qua API khi thiếu quyền.

## 5. Trạng thái database đã xác minh (2026-11-25)

- Role code thực tế: `system_admin` và `ban_giam_hieu`.
- `system_admin` hiện có 7 quyền thuộc module `system`.
- `ban_giam_hieu` hiện có quyền `view` trên `hr`, `reports`, `students`.
- Vì vậy, frontend có thể chặn điều hướng BGH, nhưng yêu cầu “BGH chỉ xem báo cáo” **chưa được bảo đảm ở database**.
- Admin chưa có quyền nghiệp vụ toàn hệ thống trong bảng `role_permissions`; giao diện có thể hiển thị theo vai trò nhưng các thao tác dữ liệu vẫn phụ thuộc RLS và quyền database.

## 6. Cổng phát hành

Không merge hoặc triển khai production cho đến khi:
- Migration quyền/RLS đã được rà soát, phê duyệt và áp dụng có kiểm soát.
- Kiểm thử trực tiếp bằng tài khoản thuộc từng vai trò xác nhận đúng ma trận.
- CI typecheck, test và production build thành công.
- Kiểm tra không có secrets trong bundle, logs hoặc repository.
- Có phương án rollback và xác nhận không làm thay đổi dữ liệu nghiệp vụ ngoài phạm vi.
