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
| Đăng nhập và quyền | Frontend guards fail-closed; migration production `20261126153433` đã áp dụng; Admin 91 actions trên 13 module (trừ AI Office); BGH chỉ `reports.view`; RLS metadata đã siết | Chưa có tài khoản BGH thật để nghiệm thu; cần browser E2E/JWT test bằng người dùng thực |
| Quản trị hệ thống | Ma trận quyền, request/approval queue, lịch sử, audit viewer; RPC đã vá validation, upsert scope, advisory lock và separation-of-duty | Hai Admin hiện đều giữ `system_admin`; thay đổi chính role này cần DBA/bootstrap, không thể tự duyệt; cần kiểm thử UI qua browser |
| Cơ cấu tổ chức | Trang đọc/ghi theo permission, tìm kiếm/lọc, kiểm soát cha-con; Admin đã có quyền production | Chưa có dữ liệu nhân sự/đơn vị chi tiết và chưa nghiệm thu browser |
| Nhân sự | Danh sách, hồ sơ, phân công, kết thúc phân công | Bảng staff và assignments đang trống; cần kiểm thử theo đơn vị và bổ sung quy trình hồ sơ/hợp đồng |
| Báo cáo | RPC `reports_summary` đã áp dụng; BGH chỉ nhận số tổng hợp: 9 đơn vị, 0 nhân sự, 0 phân công; dữ liệu tuyển sinh/người học/đào tạo báo chưa có nguồn | Cần hoàn thiện nguồn dữ liệu và báo cáo nghiệp vụ |
| Tuyển sinh | Đã hoàn tất thiết kế chi tiết Chặng 4–5 | Chờ chốt biểu mẫu, migration/RLS và phê duyệt DB |
| Người học | Đã hoàn tất thiết kế chi tiết Chặng 4–5 | Chờ chốt biểu mẫu, migration/RLS và phê duyệt DB |
| Đào tạo/giảng dạy/điểm | Đã hoàn tất thiết kế chi tiết Chặng 6 tại `docs/PHASE_06_TRAINING_TEACHING_TIMETABLE_GRADES.md` | Chờ đối chiếu biểu mẫu/quy chế, chốt ERD/RLS/RPC và phê duyệt DB |
| Hành chính/tài chính/tài sản | Chưa triển khai giao diện | Chờ data model và migration được duyệt |
| AI-OFFICE | Đã có thiết kế an toàn Chặng 8 tại `docs/PHASE_08_AI_OFFICE.md`; feature flag mặc định OFF | Chờ chính sách AI, phân loại dữ liệu, provider, ACL, ngân sách và phê duyệt |

Mô hình dữ liệu tổng quan cho các miền nghiệp vụ chưa có bảng được ghi tại docs/DATA_MODEL_PROPOSAL.md. Thiết kế chi tiết Chặng 3 (Hành chính - Kế toán và Tài sản), Chặng 4–5 (Tuyển sinh và Người học), Chặng 6 (Đào tạo, Giảng dạy, Thời khóa biểu và Điểm), Chặng 7 (Điều hành, Công việc, Lịch công tác và Báo cáo), Chặng 8 (AI-OFFICE) lần lượt được ghi tại `docs/PHASE_03_ADMIN_FINANCE_ASSETS.md`, `docs/PHASE_04_05_ADMISSIONS_STUDENTS.md`, `docs/PHASE_06_TRAINING_TEACHING_TIMETABLE_GRADES.md`, `docs/PHASE_07_OPERATIONS_TASKS_REPORTS.md`, `docs/PHASE_08_AI_OFFICE.md`. Đây là tài liệu thiết kế, chưa tạo migration và chưa áp dụng DDL lên production cho các phân hệ nghiệp vụ tương ứng.

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

- Migration production đã áp dụng: `20261126153433_production_rbac_reporting_hardening`.
- Kiểm thử SQL trong transaction rollback: BGH chỉ có `reports.view`; không đọc được roles/modules/role_permissions/org_units/user_roles; RPC báo cáo trả aggregate; không có dữ liệu BGH giả được giữ lại.
- Kiểm thử Admin bằng JWT mô phỏng: 91 quyền trên 13 module; đọc được 10 vai trò, 14 module, 9 đơn vị và nhật ký.
- Kiểm thử quy trình hai Admin trong transaction rollback: chặn người duyệt thay đổi role mình đang giữ; phê duyệt thay đổi role khác thành công.
- Migration file đã lưu tại `supabase/migrations/20261126153433_production_rbac_reporting_hardening.sql`.
- GitHub Actions CI #179 trên nhánh trước merge: PASS; CI #180 trên `main` commit `fcd0e66`: PASS — npm ci, audit gate high, typecheck, production build.
- Dependency audit gần nhất: 0 vulnerabilities.
- Vercel Preview commit `deddeee`: READY; sau đó PR #2 đã squash-merge vào `main` và production deployment commit `fcd0e66` READY.
- Vite 6.4.6, React Router 7.18.7, PostCSS selector parser 6.1.5; Zod 3 không dùng đã loại bỏ.
- Vite dev server chỉ bind 127.0.0.1; route pages lazy-load; main chunk khoảng 473 KB.
- Vercel còn cảnh báo esbuild install script chưa allowScripts và npm config `cache-dir` không nhận diện.
- Supabase Security Advisor: leaked-password protection đang OFF; có 9 SECURITY DEFINER RPC warnings (các RPC có guard quyền, cần tiếp tục review định kỳ).
- Supabase table inventory ghi nhận `private.c8_removed_role_permissions` có 36 dòng lưu trữ, RLS OFF; schema private có USAGE cho authenticated nhưng role anon/authenticated không có SELECT grant trên bảng. Không tự bật RLS vì cần xác định policy/luồng đọc phù hợp.
- Production hiện có 2 tài khoản active, cả hai đều `system_admin`; chưa có tài khoản BGH/giáo viên/chuyên viên được gán. Chưa có staff/assignments.
- Các phân hệ tuyển sinh, người học, đào tạo/điểm, tài chính, tài sản, văn bản, điều hành vẫn là thiết kế; `ModulePage` hiện là placeholder, chưa đủ điều kiện vận hành.
- PR #2 đã squash-merge: `fcd0e66e33ea420a43e215ad4e58140eadb5e821`.
- Production Vercel đã deploy thành công tại https://thndongnamna.vercel.app; endpoint HTML, main JS, CSS và 5 lazy-loaded JS chunks đều trả HTTP 200.
- Đây là đợt phát hành nền tảng phân quyền/quản trị; chưa phải nghiệm thu toàn bộ hệ thống quản lý đào tạo.
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


## Cập nhật triển khai thực tế — 2026-11-27

Các trạng thái bên trên là mốc thiết kế ngày 2026-11-26. Tình trạng triển khai mới nhất được đối chiếu với Supabase migration history, GitHub và Vercel:

- **Nền tảng/RBAC:** đã triển khai production; Admin có quyền quản trị theo ma trận, BGH chỉ `reports.view`.
- **Tuyển sinh và Người học:** đã có schema/RLS/RPC và giao diện nền tảng; chưa có dữ liệu thật, chưa tích hợp lưu file hồ sơ vào private Storage.
- **Danh mục đào tạo:** 7 bảng `occupations`, `training_programs`, `program_versions`, `subjects`, `program_subjects`, `academic_years`, `academic_terms` đã áp dụng production; có RPC phê duyệt phiên bản.
- **Mở lớp học phần/giảng dạy/ thời khóa biểu:** 4 bảng `class_subject_offerings`, `classrooms`, `teaching_assignments`, `timetable_slots` đã áp dụng production bằng migration `20261127111338_teaching_timetable_foundation`; RLS bật, kiểm tra hiệu lực phân công giáo viên, RPC công bố lịch có kiểm tra xung đột.
- **Chưa hoàn tất:** giao diện quản lý lớp học phần/phân công/TKB; chuyên cần; đánh giá/điểm; khóa điểm/sửa điểm; xét tốt nghiệp; tài chính/kế toán; tài sản; văn bản/hành chính; công việc/lịch công tác; AI Office.
- **Chặn nghiệm thu toàn trường:** chưa có dữ liệu nhân sự, lớp, chương trình, học phần, phòng/xưởng và hồ sơ tuyển sinh thực tế; chưa có tài khoản giáo viên/BGH/chuyên viên thật để E2E; chưa đối chiếu biểu mẫu và quyết định đào tạo thực tế; chưa chạy browser E2E toàn luồng.

Không coi việc tạo bảng/RLS là hoàn tất giao diện hoặc nghiệm thu nghiệp vụ. Mọi chặng tiếp theo phải có UI, workflow, kiểm thử phân quyền API/RLS, kiểm thử dữ liệu thật được cung cấp và production verification.
