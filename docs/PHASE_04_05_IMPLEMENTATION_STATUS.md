# EDU360 — Trạng thái triển khai Chặng 4–5

Ngày cập nhật: 2026-11-27  
Nhánh: `feature/edu360-admissions-students-foundation`

## Phạm vi đã xây dựng

- Migration `20261127093000_admissions_students_foundation.sql`: đợt tuyển sinh, hồ sơ thí sinh, giấy tờ metadata, quyết định, lịch sử trạng thái, khóa, lớp, hồ sơ người học, lần nhập học, liên kết nhập học, lịch sử lớp và người liên hệ.
- Migration `20261127093100_admissions_workflow_guard.sql`: khóa cập nhật trạng thái hồ sơ bằng trigger; nộp hồ sơ, xét duyệt và chuyển đổi nhập học qua RPC có kiểm tra người dùng/quyền, khóa hồ sơ và transaction.
- Migration `20261127093200_admissions_students_reporting.sql`: báo cáo BGH chỉ trả số lượng tổng hợp hồ sơ tuyển sinh/người học.
- Giao diện `AdmissionsPage`: tạo đợt tuyển sinh, nhập hồ sơ nháp, nộp hồ sơ và thao tác xét duyệt theo quyền.
- Giao diện `StudentsPage`: danh sách người học, tìm kiếm, lọc khóa, tạo khóa/lớp và hồ sơ người học cơ bản.
- Route-level AccessGate cho Tuyển sinh, Người học và các phân hệ nền tảng.
- Tất cả bảng nghiệp vụ mới bật RLS; truy cập giới hạn theo module/action và org_unit_id; không cấp quyền xóa trực tiếp.

## Kiểm tra đã thực hiện

- Đã chạy thử toàn bộ ba migration trong một transaction trên Supabase production và rollback toàn bộ. DDL/trigger/RPC/policies chạy qua không lỗi; không để lại thay đổi schema hoặc dữ liệu.
- Sau khi áp dụng production, đã xác minh 13/13 bảng có RLS bật; kiểm thử JWT claims mô phỏng BGH trong transaction rollback: chỉ có reports.view, đọc trực tiếp applicants/students = 0 dòng, RPC reports_summary trả số tổng hợp; transaction rollback không tạo tài khoản/role test.
- Đã áp dụng đủ 4 migration lên Supabase production ngày 2026-11-27; 13/13 bảng nghiệp vụ mới bật RLS.
- Chưa có biểu mẫu tuyển sinh chính thức của trường để đối chiếu các trường thông tin; trường dữ liệu hiện là bộ tối thiểu theo đặc tả đã thống nhất, cần bổ sung/điều chỉnh sau khi đối chiếu mẫu thực tế.
- Chưa triển khai upload file và Storage policies; hai bảng documents hiện chỉ lưu metadata/object path. Không tải tài liệu thật vào cho đến khi private bucket và policies được cấu hình.
- Chưa có UI chuyển đổi nhập học từ thí sinh trúng tuyển; RPC chuyển đổi đã có nhưng cần thêm bước chọn khóa/lớp, xác nhận và test idempotency/concurrency.
- Chưa có UI biến động lớp/bảo lưu/thôi học, quản lý người liên hệ và hồ sơ giấy tờ chi tiết.
- Chưa có import Excel, export, phân trang server-side hoặc browser E2E.
- Chưa có dữ liệu thí sinh/người học thật. Không seed dữ liệu giả.

- Supabase Security Advisor ghi nhận 13 SECURITY DEFINER RPC có thể gọi bởi authenticated (gồm các RPC workflow mới và RPC nền tảng đã rà soát); tất cả RPC mới có auth.uid(), kiểm tra quyền/scoped unit, search_path rỗng và EXECUTE chỉ cấp authenticated. Advisor cũng nhắc leaked-password protection đang OFF; cần bật trong cấu hình Auth.
- Performance Advisor hiện báo FK index bổ sung và các index mới chưa được sử dụng do bảng đang rỗng; đây là cảnh báo hiệu năng cần xem lại sau khi có dữ liệu, không phải lỗi phát hành.

## Cổng phát hành

1. CI/typecheck/build phải đạt trên PR.
2. Review lại migration, grants, RLS, trigger và SECURITY DEFINER.
3. Kiểm thử JWT thật theo Admin, Phòng Đào tạo, Phòng Quản lý HSSV, Khoa/Giáo viên và BGH; BGH không được SELECT bảng nguồn.
4. Kiểm thử RPC nộp hồ sơ, xét tuyển, nhập học lặp và đồng thời.
5. Chốt biểu mẫu chính thức; thiết lập private Storage và quy trình backup/rollback.
6. Chỉ sau khi đạt các bước trên mới áp dụng production migration và phát hành ứng dụng.

## Giới hạn nghiệp vụ

Chặng này không bao gồm chương trình/nghề/môn-mô-đun, thời khóa biểu, chuyên cần, điểm, xét tốt nghiệp. Các nội dung đó phụ thuộc Chặng 6 và sẽ được triển khai riêng, không giả định dữ liệu chương trình khi chưa có danh mục chuẩn.
