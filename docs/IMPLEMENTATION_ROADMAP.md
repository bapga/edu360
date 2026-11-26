# EDU360 — Lộ trình hoàn thiện hệ thống

## Bối cảnh và nguyên tắc nghiệp vụ

Đơn vị: **Trường Trung học nghề Đông Nam Nghệ An**.

Cơ cấu tổ chức đã thống nhất:
- Ban Quản trị hệ thống: quản trị kỹ thuật, tài khoản, cấu hình và quyền; tách biệt Ban Giám hiệu.
- 4 phòng: Tổ chức - Cán bộ; Hành chính - Kế toán; Đào tạo; Quản lý HSSV.
- 3 khoa: Giáo dục phổ thông; Kỹ thuật - Công nghiệp; Công nghệ - Dịch vụ.

Nguyên tắc dữ liệu:
- Một cơ sở dữ liệu thống nhất, không tạo các kho dữ liệu rời cho từng phân hệ.
- Hồ sơ nhân sự và hồ sơ người học là hồ sơ gốc duy nhất.
- Điểm được nhập một lần, liên kết với người học, lớp, môn/mô-đun, giáo viên và khoa; Phòng Đào tạo quản lý tổng thể, khoa triển khai/xác nhận theo quyền.
- Quy trình liên thông: tuyển sinh → nhập học → đào tạo/giảng dạy → đánh giá/kết quả → xét tốt nghiệp.
- Khoa quản lý chuyên môn, giáo viên, chương trình/mô-đun, kế hoạch, thực hành, thiết bị và kết quả trong phạm vi được phân công.

## Danh mục module đã có trong database

`system`, `org`, `hr`, `admin_docs`, `finance`, `assets`, `admissions`, `students`, `training`, `teaching`, `grades`, `tasks`, `reports`, `ai_office`.

Mỗi module hỗ trợ các action: `view`, `create`, `update`, `delete`, `approve`, `import`, `export`.

## Mô hình phân quyền 5 lớp

1. **Trạng thái tài khoản:** chỉ hồ sơ `profiles.status = active` được truy cập.
2. **Vai trò:** xác định qua `user_roles`; không lấy quyền từ metadata người dùng có thể tự sửa.
3. **Quyền chức năng:** `role_permissions` theo module/action.
4. **Phạm vi tổ chức/dữ liệu:** `org_unit_id`, phân công công tác đang hiệu lực và các scope `all`, `unit`, `own`.
5. **Thực thi bảo mật:** RLS/RPC ở PostgreSQL là lớp quyết định; giao diện chỉ bổ sung ẩn menu, chặn route và ẩn nút thao tác.

### Vai trò ưu tiên

- `system_admin`: Admin quản lý hệ thống và phê duyệt; không đồng nghĩa Ban Giám hiệu.
- `ban_giam_hieu`: chỉ xem báo cáo theo tiêu chí người dùng đã chốt; không quản lý nhân sự/người học/đào tạo, không thao tác ghi, không quản trị/phê duyệt.
- Giáo viên, chuyên viên, trưởng/phó phòng, trưởng/phó khoa và học sinh: quyền tối thiểu theo nhiệm vụ và phạm vi được giao; mặc định deny nếu chưa được cấp.

## Trạng thái thực hiện ngày 2026-11-26

| Phân hệ | Tình trạng nhánh tính năng | Chặn phát hành |
|---|---|---|
| Đăng nhập và quyền | Frontend guards; permission RPC payload được kiểm tra chặt; CI #129 PASS, Preview READY | Cần sửa RLS metadata và role matrix production; chưa test tài khoản thật |
| Quản trị hệ thống | Ma trận quyền, request/approval queue, lịch sử, audit viewer; đã có bản SQL dự thảo vá separation-of-duty và upsert scope | SQL chưa áp dụng; cần kiểm tra quyền EXECUTE, test hai Admin và xác nhận quy trình quản trị độc lập |
| Cơ cấu tổ chức | Trang đọc/ghi theo permission, tìm kiếm/lọc, kiểm soát cha-con | Quyền org chưa cấp cho system_admin trong DB; cần kiểm thử tài khoản |
| Nhân sự | Danh sách, hồ sơ, phân công, kết thúc phân công | Chưa có dữ liệu; cần kiểm thử RLS theo scope |
| Báo cáo | Trang BGH riêng, xử lý lỗi/stale request, kiểm tra cấu trúc payload, không hiển thị số liệu giả | Chưa có report RPC/view production và chưa có bảng nghiệp vụ người học/đào tạo |
| Tuyển sinh | Đã hoàn tất thiết kế chi tiết Chặng 4–5 | Chờ chốt biểu mẫu, migration/RLS và phê duyệt DB |
| Người học | Đã hoàn tất thiết kế chi tiết Chặng 4–5 | Chờ chốt biểu mẫu, migration/RLS và phê duyệt DB |
| Đào tạo/giảng dạy/điểm | Đã hoàn tất thiết kế chi tiết Chặng 6 tại `docs/PHASE_06_TRAINING_TEACHING_TIMETABLE_GRADES.md` | Chờ đối chiếu biểu mẫu/quy chế, chốt ERD/RLS/RPC và phê duyệt DB |
| Hành chính/tài chính/tài sản | Chưa triển khai giao diện | Chờ data model và migration được duyệt |
| AI-OFFICE | Đã có thiết kế an toàn Chặng 8 tại `docs/PHASE_08_AI_OFFICE.md`; feature flag mặc định OFF | Chờ chính sách AI, phân loại dữ liệu, provider, ACL, ngân sách và phê duyệt |

Mô hình dữ liệu tổng quan cho các miền nghiệp vụ chưa có bảng được ghi tại docs/DATA_MODEL_PROPOSAL.md. Thiết kế chi tiết Chặng 3 (Hành chính - Kế toán và Tài sản), Chặng 4–5 (Tuyển sinh và Người học), Chặng 6 (Đào tạo, Giảng dạy, Thời khóa biểu và Điểm), Chặng 7 (Điều hành, Công việc, Lịch công tác và Báo cáo), Chặng 8 (AI-OFFICE) lần lượt được ghi tại `docs/PHASE_03_ADMIN_FINANCE_ASSETS.md`, `docs/PHASE_04_05_ADMISSIONS_STUDENTS.md`, `docs/PHASE_06_TRAINING_TEACHING_TIMETABLE_GRADES.md`, `docs/PHASE_07_OPERATIONS_TASKS_REPORTS.md`, `docs/PHASE_08_AI_OFFICE.md`. Đây là tài liệu thiết kế, chưa tạo migration và chưa áp dụng DDL lên production.

## Lộ trình triển khai

| Chặng | Phạm vi | Tiêu chí hoàn thành |
|---|---|---|
| 0 | Nền tảng, đăng nhập, hồ sơ, vai trò, quyền, nhật ký | Auth ổn định; fail-closed; ma trận quyền thống nhất frontend/RLS |
| 1 | Cơ cấu tổ chức | Phòng/khoa/đơn vị, cây tổ chức, trạng thái và lịch sử |
| 2 | Nhân sự | Hồ sơ gốc, hợp đồng, quá trình công tác, phân công, đơn vị |
| 3 | Hành chính - Kế toán, tài sản | Đã có thiết kế chi tiết; cần chốt biểu mẫu/quy chế, ERD, RLS/Storage/RPC và phê duyệt DB |
| 4 | Tuyển sinh | Đợt tuyển sinh, chỉ tiêu, hồ sơ thí sinh, xét tuyển, nhập học |
| 5 | Người học | Hồ sơ gốc, lớp/khóa, biến động, chuyên cần, rèn luyện |
| 6 | Đào tạo, giảng dạy, điểm | Nghề/chương trình/môn-mô-đun, kế hoạch, TKB, phân công, nhập điểm, khóa điểm, xét kết quả |
| 7 | Điều hành và báo cáo | Đã có thiết kế chi tiết Chặng 7 tại `docs/PHASE_07_OPERATIONS_TASKS_REPORTS.md` | Chờ chốt quy chế giao việc/lịch và chỉ số báo cáo, RLS/RPC, phê duyệt DB |
| 8 | AI-OFFICE | Hỏi đáp dữ liệu được phép, soạn thảo/tổng hợp có kiểm soát truy cập |

## Kiểm tra kỹ thuật gần nhất (2026-11-26)

- Commit nhánh tính năng: `89714ae35b8724e087a4a931765c92a8c8ec7abc`.
- GitHub Actions EDU360 CI #144: PASS (install, dependency audit, typecheck, production build).
- Dependency audit CI: **0 vulnerabilities** (0 info, low, moderate, high, critical).
- Vercel Preview tương ứng: READY — https://thndongnamna-pabwvklat-dangquangphuchungbap-2025.vercel.app.
- Đã nâng Vite lên 6.4.6 và React Router lên 7.18.7; loại bỏ Zod 3 không được sử dụng; override PostCSS selector parser lên bản vá 6.1.5.
- Vite dev server chỉ bind tại 127.0.0.1, không expose ra mạng.
- Vẫn chưa có package-lock.json; CI dùng `npm install`, dependency resolution chưa được khóa tái lập.
- Chưa có kiểm thử browser/login với tài khoản thật; chưa kiểm thử RLS trực tiếp theo JWT từng vai trò.
- Không có thay đổi schema/dữ liệu Supabase, không merge và không triển khai production.

## Chuẩn giao diện

- Giao diện tiếng Việt, hiện đại, thân thiện, trực quan như SaaS.
- Dashboard có số liệu/biểu đồ phù hợp quyền của người dùng.
- Bảng dữ liệu có tìm kiếm, lọc, sắp xếp, phân trang và trạng thái rõ ràng.
- Hồ sơ nhân sự/người học có cấu trúc khoa học, tránh nhập lặp.
- Thời khóa biểu trực quan, hỗ trợ thao tác nhanh.
- Ưu tiên responsive, dùng tốt trên máy tính và điện thoại.

## Cổng chất lượng cho từng chặng

- Đối chiếu yêu cầu nghiệp vụ và schema đang tồn tại trước khi sửa.
- Không tự ý đổi schema/RLS/migration hoặc ghi dữ liệu production.
- Có loading/empty/error state, validation, phân trang và accessibility cơ bản.
- Có kiểm thử quyền: menu, route trực tiếp, action UI, gọi API/RPC trực tiếp.
- TypeScript, lint/test (khi có), production build đều phải đạt.
- Kiểm thử không làm hỏng phân hệ khác và không tạo dữ liệu trùng.
- Chỉ merge/deploy sau khi người dùng phê duyệt.


## Kế hoạch phát hành và migration
Toàn bộ cổng bảo mật, thứ tự migration, nghiệm thu theo JWT, rollback và ranh giới phê duyệt được tổng hợp tại `docs/RELEASE_READINESS_AND_MIGRATION_PLAN.md`. Đây là checklist phát hành; các P0 production đang chặn phát hành cho đến khi được xử lý và kiểm thử.
