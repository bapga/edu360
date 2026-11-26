# Phân hệ Báo cáo — phạm vi BGH

## 1. Quy tắc nghiệp vụ

- Ban Giám hiệu chỉ được xem báo cáo tổng hợp.
- Không cấp quyền đọc trực tiếp hồ sơ nhân sự, người học, tuyển sinh, điểm hoặc dữ liệu quản trị.
- Dữ liệu báo cáo phải được cung cấp qua view/RPC tổng hợp có kiểm tra reports.view.
- Không hiển thị số liệu demo hoặc số liệu suy diễn như dữ liệu thật.

## 2. Hiện trạng nguồn dữ liệu

- Có bảng staff và staff_assignments nhưng hiện chưa có hồ sơ nhân sự.
- Có org_units với 9 đơn vị, nhưng cần RLS giới hạn truy cập theo quyền org/hr; BGH không nên đọc trực tiếp org_units.
- Chưa có bảng nghiệp vụ người học, tuyển sinh, đào tạo, thời khóa biểu, điểm và xét tốt nghiệp.
- Chưa có public view hoặc RPC báo cáo tổng hợp trên production. Bản dự thảo reports_summary() nằm tại docs/proposed/reports_summary.sql; chưa áp dụng.

## 3. Giao diện đã triển khai

- Trang /bao-cao riêng cho BGH.
- Có thể tải chỉ số tổng hợp qua reports_summary() sau khi RPC được phê duyệt và triển khai; nếu chưa có RPC, giao diện báo rõ trạng thái chưa sẵn sàng.
- Danh mục các nhóm báo cáo: nhân sự, người học, tuyển sinh, đào tạo và kết quả.
- Hiển thị trạng thái nguồn dữ liệu chưa sẵn sàng; không sinh số liệu giả.
- Không có thao tác quản lý, ghi dữ liệu, import/export hoặc phê duyệt.

## 4. Kế hoạch triển khai dữ liệu báo cáo

1. Sau khi hoàn thành bảng nghiệp vụ, xây dựng RPC tổng hợp theo từng miền dữ liệu.
2. Mỗi RPC phải kiểm tra reports.view và chỉ trả về số liệu tổng hợp tối thiểu cần thiết.
3. Không trả về national_id, ngày sinh, số điện thoại, email cá nhân hoặc dữ liệu hồ sơ chi tiết nếu không có căn cứ nghiệp vụ riêng.
4. Kiểm thử BGH gọi trực tiếp RPC và API; mọi thao tác ngoài báo cáo phải bị từ chối.
5. Báo cáo có thời điểm cập nhật, bộ lọc thời gian/đơn vị và xuất báo cáo chỉ khi có quyền reports.export riêng.
