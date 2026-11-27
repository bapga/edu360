# EDU360 — Chặng 8B: Quản lý tài sản

Ngày cập nhật: 2026-11-27

## Đã triển khai trên Supabase production

Migration: `20261127115827_assets_foundation`.

Bảng nghiệp vụ:
- `asset_categories`: nhóm tài sản theo đơn vị.
- `assets`: sổ tài sản, mã quản lý, serial, nguyên giá, vị trí, tình trạng.
- `asset_assignments`: lịch sử bàn giao/thu hồi cho nhân sự.
- `asset_maintenance`: đề nghị bảo trì/sửa chữa, phê duyệt và hoàn thành.
- `asset_movements`: nhật ký biến động append-only.

Workflow:
- RPC `get_asset_staff_lookup` chỉ trả mã nhân sự/họ tên/đơn vị đủ quyền, không mở rộng quyền đọc hồ sơ nhân sự.
- `assign_asset`: kiểm tra tài sản sẵn sàng, nhân sự hoạt động và phân công công tác cùng đơn vị.
- `return_asset`: nhận lại tài sản, cập nhật tình trạng và ghi lịch sử.
- `decide_asset_maintenance`: người đề xuất không tự phê duyệt; khi duyệt chuyển tài sản sang bảo trì.
- `complete_asset_maintenance`: ghi chi phí thực tế, tình trạng và khôi phục trạng thái trước bảo trì.
- Trigger chặn thay đổi trạng thái tài sản trực tiếp ngoài workflow; lịch sử biến động chỉ đọc từ giao diện.

## Bảo mật

- RLS bật trên cả 5 bảng; chính sách theo quyền `assets.view/create/update/approve`.
- BGH mô phỏng: `assets.view=false`, SELECT 5 bảng trả 0 dòng.
- `asset_assignments` và `asset_movements` không cấp quyền INSERT/UPDATE trực tiếp cho client; thao tác qua RPC có kiểm tra quyền.
- Báo cáo BGH chỉ bổ sung số lượng tổng hợp tài sản, tài sản đang bàn giao và đang bảo trì.

## Giao diện

- Route `/tai-san`.
- Danh mục nhóm tài sản, ghi tăng tài sản.
- Bàn giao, thu hồi, bảo trì, phê duyệt, hoàn thành và xem lịch sử biến động.
- Vercel Preview TypeScript + Vite build thành công; npm audit 0 vulnerabilities.

## Giới hạn nghiệm thu

- Chưa có dữ liệu tài sản, hồ sơ bàn giao, biên bản kiểm kê, quyết định mua sắm/thanh lý thực tế.
- Chưa có khấu hao, kiểm kê theo đợt, điều chuyển liên đơn vị, QR/barcode, tích hợp mua sắm/kế toán.
- Chưa có browser E2E với tài khoản quản trị tài sản thật.
