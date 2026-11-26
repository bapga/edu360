# EDU360 — Thiết kế chi tiết Chặng 3: Hành chính - Kế toán và Tài sản

Trạng thái: **Thiết kế nghiệp vụ và kỹ thuật; chưa tạo migration, chưa triển khai CRUD, chưa ghi dữ liệu production**  
Ngày: 2026-11-26  
Phạm vi: `admin_docs`, `finance`, `assets`; dùng chung `profiles`, `staff`, `staff_assignments`, `org_units`, RBAC và audit hiện hữu.

## 1. Mục tiêu và ranh giới

- Quản lý văn bản đến/đi, luân chuyển xử lý, hạn xử lý, tệp đính kèm và lịch sử.
- Quản lý dự toán, chứng từ thu/chi, quy trình duyệt và khóa sổ; không thay thế phần mềm kế toán chuyên ngành nếu chưa thống nhất chuẩn nghiệp vụ/kế toán.
- Quản lý danh mục, hồ sơ, bàn giao, kiểm kê, bảo trì và điều chuyển tài sản.
- Một nguồn dữ liệu thống nhất; phân hệ khác chỉ tham chiếu khóa định danh.
- BGH chỉ xem báo cáo tổng hợp qua `reports.view`; không được đọc trực tiếp hồ sơ văn bản, chứng từ, tài sản hoặc dữ liệu cá nhân.
- Admin quản lý và phê duyệt theo ma trận quyền; người đề xuất không tự duyệt yêu cầu của mình.

## 2. Phân hệ Hành chính - Văn bản

### 2.1. Danh mục dữ liệu đề xuất

| Bảng | Trường/ý nghĩa chính | Ràng buộc |
|---|---|---|
| document_registers | id, register_code, direction (in/out), year, org_unit_id, next_number, status | unique(register_code, year); cấp số nguyên tử |
| document_types | id, code, name, direction, active | code unique |
| admin_documents | id, register_id, document_type_id, document_number, symbol, subject, summary, issued_at, received_at, sender, recipient, priority, confidentiality, status, owner_org_unit_id, created_by | số đến/số đi duy nhất trong sổ và năm; không xóa văn bản đã cấp số |
| document_routes | id, document_id, sequence_no, from_org_unit_id, to_org_unit_id, assignee_staff_id, assigned_at, due_at, completed_at, status, instruction | lịch sử luân chuyển append-only; sequence unique theo document |
| document_attachments | id, document_id, bucket_id, object_path, file_name, mime_type, size_bytes, checksum, uploaded_by | metadata; object private; checksum hỗ trợ phát hiện trùng |
| document_comments | id, document_id, route_id, author_id, body, visibility, created_at | không sửa lịch sử đã phát hành; bổ sung comment mới khi cần |
| document_events | id, document_id, event_type, actor_id, payload_redacted, created_at | nhật ký nghiệp vụ append-only |

Không đưa nội dung nhạy cảm hoặc toàn bộ file vào audit log. Không lưu URL public cố định cho file.

### 2.2. Quy trình văn bản

1. Tiếp nhận văn bản đến hoặc khởi tạo văn bản đi ở trạng thái `draft`.
2. Kiểm tra trường bắt buộc, loại văn bản, sổ đăng ký và đơn vị chịu trách nhiệm.
3. Cấp số đến/số đi bằng RPC transaction-safe; không cấp số ở frontend.
4. Trình duyệt/phê duyệt nếu loại văn bản hoặc quy chế yêu cầu; ghi người duyệt, thời điểm và ý kiến.
5. Chuyển xử lý đến đơn vị/cá nhân; đặt hạn xử lý; lưu từng chặng luân chuyển.
6. Người nhận cập nhật tiến độ/kết quả; người giao xác nhận hoàn thành nếu cần.
7. Kết thúc/lưu trữ; văn bản đã phát hành hoặc đã cấp số không hard-delete.

Trạng thái gợi ý: `draft → registered → pending_approval → approved/rejected → in_progress → completed → archived`. Chỉ cho phép chuyển trạng thái hợp lệ bằng RPC; từ chối chuyển trực tiếp bỏ qua bước.

## 3. Phân hệ Tài chính - Kế toán

### 3.1. Danh mục dữ liệu đề xuất

| Bảng | Trường/ý nghĩa chính | Ràng buộc |
|---|---|---|
| finance_periods | id, fiscal_year, starts_on, ends_on, status | không chồng lấn kỳ; kỳ đã khóa không ghi mới |
| finance_funds | id, code, name, source_type, active | code unique |
| budget_lines | id, period_id, fund_id, org_unit_id, item_code, description, planned_amount, approved_amount, status | tiền numeric(18,2), không dùng float |
| finance_vouchers | id, voucher_type (receipt/payment), voucher_no, period_id, org_unit_id, voucher_date, payee_payer, description, amount, status, created_by, approved_by, posted_at | số chứng từ unique theo loại/kỳ; amount > 0 |
| finance_voucher_lines | id, voucher_id, budget_line_id, account_code, description, amount | tổng dòng phải khớp chứng từ |
| finance_transactions | id, voucher_id, transaction_date, amount, direction, reference_no | chỉ tạo khi ghi sổ thành công |
| finance_attachments | id, voucher_id, object_path, file metadata | bucket private |
| finance_events | id, voucher_id, event_type, actor_id, reason, created_at | append-only |

Các trường tài khoản/mục lục ngân sách, nguồn kinh phí, biểu mẫu và cách hạch toán cần được đối chiếu quy định kế toán hiện hành của trường trước migration. Không tự đặt hệ thống tài khoản hoặc công thức quyết toán.

### 3.2. Quy trình chứng từ

1. Lập phiếu thu/chi ở trạng thái `draft`; nhập bên nộp/nhận, nội dung, nguồn và dòng dự toán.
2. Validate số tiền, kỳ tài chính, số dư dự toán và chứng từ đính kèm.
3. Gửi duyệt; người lập không được tự duyệt.
4. Người có `finance.approve` duyệt/từ chối, ghi lý do.
5. Người có `finance.post` (cần bổ sung action nếu ma trận hiện tại chưa có) ghi sổ qua RPC; thao tác idempotent.
6. Phiếu đã ghi sổ không sửa/xóa; điều chỉnh bằng chứng từ đảo/điều chỉnh liên kết chứng từ gốc.
7. Khóa kỳ tài chính; chỉ Admin hoặc người được phân quyền độc lập mới được mở khóa theo quy trình có audit.

Trạng thái: `draft → submitted → approved/rejected → posted → reversed`. Không cho phép `posted → draft` hoặc xóa chứng từ đã ghi sổ.

## 4. Phân hệ Tài sản

### 4.1. Danh mục dữ liệu đề xuất

| Bảng | Trường/ý nghĩa chính | Ràng buộc |
|---|---|---|
| asset_categories | id, code, name, depreciation_policy, active | code unique |
| assets | id, asset_code, category_id, name, description, serial_number, acquired_on, acquisition_cost, funding_source, org_unit_id, location, condition, status | asset_code unique; cost numeric(18,2) |
| asset_assignments | id, asset_id, staff_id, org_unit_id, assigned_at, returned_at, handover_document_id, condition_out, condition_in | một bàn giao đang hiệu lực cho mỗi tài sản |
| asset_inventory_sessions | id, inventory_code, org_unit_id, started_at, completed_at, status, created_by | unique code; kỳ kiểm kê |
| asset_inventory_items | id, session_id, asset_id, observed_condition, observed_location, result, note, verified_by | unique(session_id, asset_id) |
| asset_maintenance | id, asset_id, maintenance_type, requested_at, completed_at, vendor, cost, description, status | chi phí numeric(18,2) |
| asset_events | id, asset_id, event_type, actor_id, payload_redacted, created_at | append-only |

### 4.2. Quy trình tài sản

- Tạo hồ sơ khi tiếp nhận; mã tài sản cấp duy nhất bằng RPC.
- Bàn giao/thu hồi phải ghi biên bản, người giao, người nhận, đơn vị, tình trạng và thời điểm.
- Điều chuyển phải kết thúc assignment cũ và tạo assignment mới trong cùng transaction.
- Kiểm kê lưu kết quả từng tài sản, đối chiếu hồ sơ và lập biên bản chênh lệch.
- Thanh lý/mất/hỏng chuyển trạng thái bằng quy trình duyệt; không xóa hồ sơ gốc.
- Bảo trì lưu lịch sử, chi phí và tệp minh chứng.

## 5. Phân quyền và phạm vi dữ liệu

| Action | Hành chính | Tài chính | Tài sản |
|---|---|---|---|
| view | Xem văn bản theo đơn vị/luồng được giao | Xem chứng từ/dự toán theo đơn vị/kỳ | Xem tài sản theo đơn vị |
| create | Tạo bản nháp/tiếp nhận | Lập dự toán, phiếu nháp | Tạo hồ sơ tài sản |
| update | Sửa bản nháp/chưa phát hành | Sửa phiếu nháp/chưa duyệt | Sửa hồ sơ chưa khóa |
| approve | Duyệt văn bản theo thẩm quyền | Duyệt chứng từ/dự toán | Duyệt điều chuyển/thanh lý |
| import/export | Chỉ bật khi có quy trình, log và kiểm soát file | Tắt mặc định; xuất dữ liệu tài chính phải ghi audit | Theo quyền và phạm vi |

- Mọi truy vấn phải áp dụng `all`, `unit`, `own` và quan hệ phân công tại RLS/RPC.
- BGH chỉ có `reports.view`; không cấp bất kỳ quyền nào trên ba module này.
- Admin có thể quản lý toàn trường nhưng thao tác duyệt nhạy cảm cần separation-of-duty ở database.
- Không coi ẩn nút/route là kiểm soát bảo mật.
- Các action `post`, `lock_period`, `issue_number`, `transfer_asset`, `dispose_asset` cần RPC chuyên biệt; không cho client update trực tiếp các cột trạng thái trọng yếu.

## 6. Storage và bảo vệ tệp

- Bucket private riêng theo miền: `admin-documents`, `finance-vouchers`, `asset-records`.
- Đường dẫn chuẩn: `{org_unit_id}/{record_id}/{uuid}-{safe_filename}`; không dùng tên file do người dùng cung cấp làm object key.
- Policy kiểm tra quyền module, scope đơn vị và quyền truy cập record tương ứng.
- Tải file bằng signed URL thời hạn ngắn; không công khai bucket.
- Giới hạn MIME/đuôi file/kích thước ở cả client và server; quét malware nếu hạ tầng hỗ trợ.
- Kiểm tra quyền trước khi upload, download, replace hoặc xóa object; log hành động.
- Khi xóa hồ sơ theo chính sách lưu trữ, xử lý metadata và object theo transaction/outbox; không xóa file chỉ vì UI xóa bản ghi.

## 7. RPC, transaction và tính toàn vẹn

Các RPC đề xuất (tên tạm, cần rà soát naming trước migration):
- `register_admin_document(p_document_id)`: cấp số đến/đi nguyên tử.
- `transition_document_route(p_route_id, p_action, p_note)`: chuyển trạng thái/hoàn tất chặng.
- `submit_finance_voucher(p_voucher_id)`, `decide_finance_voucher(p_voucher_id, p_approve, p_reason)`.
- `post_finance_voucher(p_voucher_id, p_idempotency_key)`: kiểm tra duyệt/kỳ/số tiền và ghi sổ một lần.
- `close_finance_period(p_period_id, p_reason)`: kiểm tra giao dịch chưa hoàn tất và khóa kỳ.
- `assign_asset(p_asset_id, p_staff_id, p_org_unit_id, p_handover_document_id)`: bàn giao/điều chuyển nguyên tử.
- `dispose_asset(p_asset_id, p_reason, p_approval_id)`: duyệt thanh lý và chuyển trạng thái.

Tất cả RPC SECURITY DEFINER (nếu cần) phải đặt `search_path = ''`, schema-qualify object, kiểm tra `auth.uid()`, active profile, permission, scope, trạng thái hợp lệ và separation-of-duty; revoke EXECUTE khỏi anon/public; chỉ grant authenticated phù hợp. Ưu tiên SECURITY INVOKER khi có thể.

## 8. Chỉ số và báo cáo

Các báo cáo cho BGH chỉ tổng hợp, không chứa tên người, số tài khoản, số chứng từ có thể truy ngược hoặc đường dẫn file:
- Văn bản đến/đi theo tháng, trạng thái xử lý, tỷ lệ đúng hạn/quá hạn.
- Dự toán/đã duyệt/đã thực hiện theo nguồn, kỳ và đơn vị ở mức tổng hợp.
- Số lượng tài sản theo nhóm, đơn vị, tình trạng; biến động tăng/giảm và kết quả kiểm kê.
- Chỉ trả số liệu khi RPC xác thực `reports.view`; không cho BGH SELECT bảng nguồn.
- Kiểm soát ngưỡng tổng hợp khi nhóm dữ liệu có quá ít bản ghi để tránh suy luận cá nhân.

## 9. Giao diện dự kiến

- Văn bản: Inbox đến, Outbox đi, Việc cần xử lý, Sổ văn bản, chi tiết văn bản với timeline, tệp và luồng xử lý.
- Tài chính: Tổng quan kỳ, dự toán, phiếu thu/chi, hàng đợi duyệt, sổ giao dịch, khóa kỳ.
- Tài sản: Danh mục, chi tiết tài sản, bàn giao, điều chuyển, kiểm kê, bảo trì, thanh lý.
- Tất cả danh sách có tìm kiếm, lọc, sắp xếp, phân trang, loading/empty/error state, xác nhận hành động trọng yếu và responsive.
- Nút/action chỉ xuất hiện theo quyền; thao tác trọng yếu gọi RPC và hiển thị mã tham chiếu kết quả.

## 10. Kiểm thử chấp nhận

### Hành chính
- Hai yêu cầu cấp số đồng thời không sinh số trùng.
- Người không thuộc luồng không đọc được nội dung/tệp.
- Văn bản đã phát hành không thể bị sửa/xóa trực tiếp.
- Quá hạn được tính theo múi giờ `Asia/Ho_Chi_Minh`.

### Tài chính
- Người lập không tự duyệt; người không có quyền không thể gọi RPC.
- Ghi sổ lặp cùng idempotency key không tạo giao dịch kép.
- Không ghi sổ vào kỳ đã khóa; không sửa/xóa chứng từ đã post.
- Tổng dòng khớp tổng chứng từ; không vượt dự toán nếu quy chế yêu cầu.

### Tài sản
- Một tài sản không thể có hai bàn giao đang hiệu lực.
- Điều chuyển thất bại phải rollback cả kết thúc assignment cũ và tạo assignment mới.
- Kiểm kê không tạo hai dòng cho cùng tài sản trong một đợt.
- Thanh lý phải có phê duyệt và giữ lịch sử.

### Quyền và báo cáo
- BGH chỉ truy cập trang báo cáo; gọi trực tiếp REST/RPC/Storage với bảng nguồn đều bị từ chối.
- Admin có quyền quản lý; không tự phê duyệt giao dịch do mình tạo.
- Tài khoản không quyền và tài khoản inactive đều fail-closed.
- Kiểm thử RLS bằng JWT từng vai trò, không chỉ mock frontend.

## 11. Cần xác nhận nghiệp vụ trước migration

1. Sổ văn bản: sổ đến/đi dùng chung hay riêng theo phòng; quy tắc số và ký hiệu; thẩm quyền ký/phát hành.
2. Tài chính: danh mục nguồn kinh phí, mục lục ngân sách, tài khoản kế toán, biểu mẫu thu/chi, quy tắc khóa sổ và vai trò kế toán trưởng/người duyệt.
3. Tài sản: chuẩn mã tài sản, phân loại, cách tính hao mòn/khấu hao, kiểm kê và thẩm quyền thanh lý.
4. Thời hạn lưu trữ, phân loại mật/độ nhạy cảm, giới hạn dung lượng và định dạng tệp.
5. Quy tắc phân cấp quyền theo phòng/khoa và các trường hợp xử lý liên phòng.

Các nội dung trên là quyết định nghiệp vụ cần căn cứ biểu mẫu/quy chế thực tế; không tự suy diễn và không dùng dữ liệu giả để hoàn thiện giao diện.

## 12. Cổng triển khai

- [ ] Nhận biểu mẫu sổ văn bản, phiếu thu/chi, sổ tài sản và quy chế liên quan.
- [ ] Chốt ERD, từ điển dữ liệu, status transition và retention.
- [ ] Chốt action permission và scope; bổ sung action chuyên biệt nếu cần.
- [ ] Viết migration có rollback, index/FK/unique/check constraints.
- [ ] Viết RLS, Storage policies, RPC và audit.
- [ ] Kiểm thử trên dữ liệu giả lập và JWT từng vai trò.
- [ ] Chỉ áp dụng production sau phê duyệt riêng.
