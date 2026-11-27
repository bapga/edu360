# EDU360 — Chặng 8A: Tài chính và kế toán nền tảng

Ngày cập nhật: 2026-11-27

## Đã triển khai trên Supabase production

Migration:
- `20261127115025_finance_foundation`
- `20261127115104_finance_student_lookup`

Bảng nghiệp vụ:
- `fee_catalog`: danh mục khoản thu theo đơn vị.
- `student_invoices`, `invoice_lines`: hóa đơn người học và chi tiết khoản thu; tổng hóa đơn tự tính từ các dòng.
- `payment_receipts`: phiếu thu chờ xác nhận, xác nhận theo nguyên tắc người ghi không tự xác nhận.
- `expense_requests`: đề nghị chi, gửi duyệt, phê duyệt/từ chối, ghi nhận thanh toán.

RPC/workflow:
- `get_finance_student_lookup`: chỉ trả mã người học, họ tên, mã lớp/đơn vị và enrollment đang học; không mở SELECT rộng bảng hồ sơ cá nhân.
- `create_student_invoice`, `issue_student_invoice`, `confirm_payment_receipt`.
- `submit_expense_request`, `decide_expense_request`, `mark_expense_paid`.
- Tách quyền tạo, cập nhật, phê duyệt; không cho người lập hóa đơn/phiếu thu/đề nghị chi tự phê duyệt.
- `reports_summary()` bổ sung số hóa đơn, công nợ phải thu và đề nghị chi ở dạng tổng hợp.

## Bảo mật

- RLS bật trên cả 5 bảng tài chính; mỗi bảng có chính sách theo `finance.view/create/update/approve`.
- BGH mô phỏng: `finance.view=false`; không đọc được danh mục khoản thu, hóa đơn, chi tiết hóa đơn, phiếu thu, đề nghị chi.
- BGH chỉ xem các chỉ số tài chính tổng hợp qua `reports_summary()`.
- Không tạo dữ liệu giao dịch giả.

## Giao diện

- Route `/tai-chinh`, menu Tài chính - Kế toán.
- Danh mục khoản thu; tạo hóa đơn và dòng hóa đơn; phát hành hóa đơn.
- Lập phiếu thu và xác nhận phiếu thu.
- Lập đề nghị chi, gửi duyệt, phê duyệt/từ chối, ghi nhận đã thanh toán.
- Preview build TypeScript + Vite thành công; npm audit 0 vulnerabilities.

## Giới hạn nghiệm thu

- Đây là phân hệ quản lý khoản thu/chi cơ bản, chưa phải phần mềm kế toán tổng hợp/GL, chưa có sổ cái, đối chiếu ngân hàng, hóa đơn điện tử, khấu hao hay báo cáo quyết toán theo mẫu tài chính của trường.
- Chưa có danh mục mức thu, quyết định học phí, quy chế thu chi và dữ liệu giao dịch thật.
- Chưa có browser E2E với tài khoản kế toán thật; cần đối chiếu biểu mẫu/quy định tài chính trước nghiệm thu nghiệp vụ.
