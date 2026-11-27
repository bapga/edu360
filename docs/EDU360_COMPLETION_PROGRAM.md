# EDU360 — Chương trình hoàn thiện tổng thể

Ngày khởi động: 2026-11-27  
Nhánh triển khai: `feat/edu360-completion-program`  
Production hiện tại: `https://thndongnamna.vercel.app`  
Repository: `https://github.com/bapga/edu360`  
Supabase project: `akckcnijujtevfbginja`

## Mục tiêu

Hoàn thiện EDU360 thành hệ thống quản lý đào tạo có thể nghiệm thu và vận hành tại Trường Trung học nghề Đông Nam Nghệ An. Không coi route placeholder, trang dashboard hoặc bảng tổng hợp là phân hệ hoàn thành nếu chưa có schema, RLS, quy trình nghiệp vụ, giao diện CRUD, kiểm thử và tài liệu vận hành.

## Nguyên tắc bắt buộc

1. Giữ nguyên repository, Supabase project, Vercel project và domain hiện có.
2. Không xóa, ghi đè hoặc tái cấu trúc dữ liệu production khi chưa có backup, migration review và kiểm thử.
3. Mỗi miền nghiệp vụ có migration độc lập; additive-first; có forward-fix/rollback plan.
4. Bật RLS mặc định deny cho mọi bảng trong schema exposed; kiểm tra cả SELECT/INSERT/UPDATE/DELETE, RPC, views và Storage.
5. Không dùng user_metadata cho quyết định phân quyền. Không đưa service_role/secret key vào frontend.
6. SECURITY DEFINER chỉ dùng khi thật sự cần, cố định search_path, kiểm tra auth.uid()/quyền trong thân hàm, thu hẹp EXECUTE; rà soát PUBLIC/anon/authenticated.
7. BGH chỉ có reports.view và chỉ đọc dữ liệu tổng hợp qua RPC an toàn; không truy cập trực tiếp bảng nguồn hoặc dữ liệu cá nhân.
8. Admin quản trị và phê duyệt. Mọi thay đổi ma trận quyền, khóa điểm, sửa điểm sau khóa, công bố thời khóa biểu, chốt sổ tài chính và duyệt hồ sơ phải có audit trail và separation-of-duty.
9. Dữ liệu cá nhân, hồ sơ tuyển sinh, học sinh, nhân sự và tài chính phải tối thiểu hóa, phân quyền theo đơn vị và phạm vi công việc.
10. Không merge vào main hoặc deploy production chỉ vì build xanh; phải qua CI, preview, role-based browser tests, database tests và phê duyệt release.

## Hiện trạng nền tảng đã xác minh

- Supabase production project `akckcnijujtevfbginja`, PostgreSQL 17.12.
- Migration nền tảng RBAC/reporting đã áp dụng.
- GitHub `bapga/edu360`, default branch `main`.
- Vercel project thực tế `thndongnamna`, framework Vite; production deployment READY.
- Có 9 đơn vị tổ chức, 10 vai trò, 14 phân hệ, 2 profile và 2 user-role records.
- Staff và staff_assignments hiện rỗng; chưa có tài khoản thực tế cho BGH, giáo viên, chuyên viên và quản lý khoa/phòng.
- Phân hệ nghiệp vụ tuyển sinh, người học, chương trình, TKB, điểm, văn bản, tài chính, tài sản, công việc còn thiếu bảng dữ liệu và quy trình CRUD production.
- Chưa có browser E2E acceptance với tài khoản thật.

## Lộ trình triển khai

### Giai đoạn 0 — Khóa nền tảng và kiểm thử bảo mật (P0)
- Chụp trạng thái schema, migration history, grants, RLS policies, function definitions, views, triggers, Storage policies.
- Lập ma trận role × module × action × org scope; xác minh Admin và BGH theo đúng nguyên tắc đã chốt.
- Rà soát 9 SECURITY DEFINER findings: function owner, search_path, auth.uid(), authorization checks, EXECUTE grants cho PUBLIC/anon/authenticated.
- Bật leaked-password protection sau khi kiểm tra cấu hình Auth và tác động đăng nhập.
- Kiểm tra bảng private archive 36 rows, quyền schema/table và retention; không xóa dữ liệu lưu trữ khi chưa có quyết định.
- Xử lý 22 foreign-key index findings sau khi phân tích workload và duplicate FK constraints.
- Hợp nhất 3 nhóm permissive SELECT policies nếu tương đương logic; không làm thay đổi quyền thực tế.
- Kiểm thử JWT thật: anon, Admin, BGH, giáo viên, chuyên viên, trưởng/phó khoa/phòng; cả REST, RPC và deep-link.
- Kiểm thử BGH không thể đọc bảng nguồn/PII dù gọi API trực tiếp.
- Bổ sung CI: typecheck, lint, unit, integration, SQL/RLS tests, production build, dependency/security checks.
- Điều kiện đạt: không còn P0 security findings; mọi cảnh báo còn lại có lý do và biện pháp giảm thiểu được ghi nhận.

### Giai đoạn 1 — Cơ cấu, nhân sự, tài khoản
- Chuẩn hóa danh mục đơn vị, vị trí/chức danh, ngạch/chuyên môn, trạng thái làm việc.
- Hoàn thiện hồ sơ nhân sự, hợp đồng/quyết định, quá trình công tác, chuyên môn, phân công theo đơn vị.
- Liên kết profile Auth với staff bằng RPC an toàn; hỗ trợ tạo tài khoản trực tiếp bởi Admin theo chính sách mật khẩu/khởi tạo bảo mật, không phụ thuộc email invite.
- Quản lý vai trò, đơn vị, phạm vi dữ liệu, trạng thái tài khoản, khóa/mở khóa, thu hồi phiên khi nghỉ/chuyển công tác.
- Import Excel có preview, mapping, phát hiện trùng, lỗi từng dòng, idempotency và rollback.
- Không tự tạo người thật hoặc gán vai trò khi chưa có dữ liệu được nhà trường xác nhận.

### Giai đoạn 2 — Tuyển sinh và người học
- Danh mục năm tuyển sinh, đợt tuyển sinh, nghề/ngành, trình độ, chỉ tiêu, điều kiện và phương thức.
- Hồ sơ đăng ký, người dự tuyển, giấy tờ, xét tuyển, quyết định trúng tuyển, nhập học, chuyển trạng thái.
- Hồ sơ người học, mã học sinh, lớp/khóa, chương trình, tình trạng học tập, bảo lưu, thôi học, tốt nghiệp.
- Quản lý hồ sơ đính kèm bằng Storage private, signed URL ngắn hạn và quyền theo hồ sơ.
- Import/export có kiểm soát; chống trùng mã và hồ sơ; audit mọi sửa đổi nhạy cảm.

### Giai đoạn 3 — Chương trình và kế hoạch đào tạo
- Danh mục nghề, chương trình/phiên bản, môn học/mô-đun, chuẩn đầu ra, thời lượng, phân bổ lý thuyết/thực hành.
- Khóa/lớp, năm học/học kỳ, kế hoạch đào tạo, lớp học phần/đợt giảng dạy, phân công giáo viên.
- Ràng buộc dữ liệu: phiên bản chương trình có hiệu lực, tổng giờ, tiên quyết, trùng mã và phân công.

### Giai đoạn 4 — Thời khóa biểu và giảng dạy
- Phòng học/xưởng, ca/tiết, lịch học, lịch thực hành, lịch thi.
- Tạo phiên bản TKB, kiểm tra xung đột giáo viên/phòng/lớp, quy tắc giờ và ngày học.
- Workflow dự thảo → kiểm tra → phê duyệt → công bố; lịch sử thay đổi và thông báo.
- Giao diện theo ngày/lớp/giáo viên; tối ưu mobile; xuất Excel/PDF.

### Giai đoạn 5 — Điểm, chuyên cần và kết quả
- Cấu hình quy chế tính điểm theo chương trình/nghề/môn/học kỳ; loại đánh giá, trọng số, điều kiện dự thi.
- Nhập điểm theo phân công, kiểm tra biên điểm, lưu nháp, gửi duyệt, khóa điểm.
- Sửa điểm sau khóa qua yêu cầu có lý do và phê duyệt độc lập; lưu giá trị cũ/mới và người thao tác.
- Tính điểm tổng kết có version, có thể tái lập; không tính ngầm hoặc ghi đè lịch sử.
- Bảng điểm, kết quả học tập, cảnh báo thiếu điểm, báo cáo; phân quyền người học xem dữ liệu của chính mình nếu được bật.

### Giai đoạn 6 — Hành chính, tài chính, tài sản, điều hành
- Văn bản đến/đi, sổ văn bản, luân chuyển, hạn xử lý, hồ sơ và chữ ký/đính kèm.
- Tài chính: kỳ, dự toán, khoản thu/chi, chứng từ, phê duyệt, khóa sổ; không thay thế phần mềm kế toán chuyên dụng nếu chưa có quy chế tích hợp.
- Tài sản: danh mục, mã tài sản, nguồn, vị trí, bàn giao, kiểm kê, bảo trì, thanh lý.
- Công việc/lịch công tác: giao việc, người phụ trách, hạn, trạng thái, nhắc việc, biên bản và audit.
- Workflow phê duyệt tách biệt người lập/người duyệt; quyền theo đơn vị và giá trị giao dịch.

### Giai đoạn 7 — Báo cáo và AI Office
- Báo cáo aggregate theo vai trò; BGH chỉ xem số liệu tổng hợp, không truy cập bảng nguồn.
- Định nghĩa chỉ tiêu, thời điểm chốt, nguồn dữ liệu, công thức và đối soát.
- AI Office mặc định OFF; chỉ bật khi có phê duyệt chính sách dữ liệu, nhà cung cấp, ngân sách, logging, retention, ACL và cơ chế không gửi PII ngoài phạm vi cho phép.
- AI chỉ truy xuất tài liệu/dữ liệu theo quyền người gọi; không tự phê duyệt, sửa điểm, thay đổi quyền hoặc thực hiện giao dịch.

## Cổng nghiệm thu chung cho từng giai đoạn

1. Migration được review, chạy trên test/staging và có backup/rollback plan.
2. RLS/grants/RPC/views/Storage được kiểm thử độc lập với UI.
3. Unit + integration + browser tests qua trên dữ liệu giả lập.
4. Tài khoản thử nghiệm từng vai trò chứng minh cả quyền được phép và bị cấm.
5. Import/export, lỗi mạng, pagination, responsive, accessibility và audit được kiểm tra.
6. Preview Vercel READY và được nghiệm thu trước khi merge/deploy production.
7. Ghi lại commit SHA, migration version, kết quả test, người duyệt và phương án rollback.

## Trạng thái

- [x] Khởi tạo nhánh triển khai riêng từ main.
- [x] Ghi nhận baseline và phạm vi hoàn thiện.
- [ ] Hoàn tất kiểm thử bảo mật P0.
- [ ] Hoàn thiện cơ cấu, nhân sự, tài khoản.
- [ ] Hoàn thiện tuyển sinh, người học.
- [ ] Hoàn thiện đào tạo, giảng dạy, TKB, điểm.
- [ ] Hoàn thiện hành chính, tài chính, tài sản, điều hành, báo cáo, AI Office.
- [ ] Nghiệm thu toàn hệ thống và phát hành production.

## Giới hạn thay đổi ở đợt khởi động

Đợt này chỉ tạo nhánh và tài liệu lộ trình. Chưa chạy migration nghiệp vụ, chưa thay đổi dữ liệu production, chưa thay đổi cấu hình Auth, chưa merge và chưa deploy.
