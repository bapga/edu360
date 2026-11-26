# EDU360 — Kế hoạch phát hành, migration và nghiệm thu tổng thể

Ngày rà soát: 2026-11-26  
Trạng thái: Nền tảng RBAC đã được phê duyệt, áp dụng Supabase production và deploy Vercel ngày 2026-11-26; các phân hệ nghiệp vụ còn lại chưa đủ điều kiện vận hành.

## 1. Kết luận hiện trạng

EDU360 đã phát hành nền tảng frontend (đăng nhập/quyền/route guard, cơ cấu tổ chức, nhân sự, quản trị hệ thống, báo cáo) tại https://thndongnamna.vercel.app. Migration RBAC/reporting đã áp dụng production; BGH chỉ có reports.view, Admin có quyền quản trị 13 module (AI Office đóng). Đây chưa phải hệ thống nghiệp vụ hoàn chỉnh: phần lớn bảng nghiệp vụ và giao diện còn thiếu.

Không được gọi là hoàn thành hoặc phát hành production cho đến khi tất cả cổng dưới đây đạt.

## 2. Các điều kiện chặn phát hành

### P0 — Bảo mật quyền và dữ liệu
- [x] Thu hồi role_permissions của ban_giam_hieu trên hr và students; chỉ giữ reports.view.
- [x] Siết SELECT policies cho roles, modules, role_permissions và org_units theo quyền tối thiểu cần thiết.
- [ ] Kiểm tra tất cả embedded relationship queries sau khi siết RLS.
- [x] Sửa decide_permission_change để separation-of-duty được enforce ở database, bao gồm người duyệt không thể duyệt thay đổi ma trận cho role mà chính họ đang giữ.
- [x] Sửa apply_permission_change để xử lý idempotent/upsert và advisory lock chống trùng role assignment.
- [x] Chốt ma trận quyền system_admin: 91 actions trên 13 module; AI Office không cấp mặc định.
- [ ] Xử lý staff_insert theo scope unit bằng RPC an toàn hoặc giữ rõ yêu cầu hr.create global.
- [ ] Rà soát SECURITY DEFINER, EXECUTE grants, search_path, leaked-password protection, FK indexes và duplicate FK constraints.
- [ ] Kiểm thử browser/REST/RPC với JWT thật cho Admin, BGH và các vai trò nghiệp vụ (đã có SQL JWT-claims smoke tests trong transaction rollback).
- [ ] BGH chỉ xem reports aggregate; chứng minh không thể SELECT dữ liệu cá nhân/bảng nguồn.

### P1 — Nền tảng nghiệp vụ
- [ ] Chốt biểu mẫu và quyết định thật cho Tuyển sinh, Người học, chương trình đào tạo, TKB, điểm.
- [ ] Chốt biểu mẫu văn bản, chứng từ tài chính, sổ tài sản.
- [ ] Chốt quy chế công việc/lịch công tác và danh mục KPI báo cáo.
- [ ] Hoàn tất ERD/từ điển dữ liệu, FK, unique/check constraints, indexes, trạng thái và audit.
- [ ] Thiết kế migration theo miền, có rollback/forward-fix và kế hoạch backup.
- [ ] Bật RLS mặc định deny; policy theo module/action/scope.
- [ ] Thiết kế RPC transaction-safe cho workflow; không để client tự chuyển trạng thái trọng yếu.
- [ ] Thiết kế Storage private và lifecycle/retention.
- [ ] Xây CRUD/import/export chỉ sau khi schema/RLS được chốt.

### P2 — Chất lượng ứng dụng
- [ ] Unit tests cho permission provider, guards, form validation, state transitions.
- [ ] Integration tests cho Supabase RPC, RLS và lỗi mạng.
- [ ] Browser tests với tài khoản thật từng role; kiểm tra deep links, responsive, keyboard/focus.
- [ ] Import Excel có preview, mapping, duplicate detection, per-row errors, idempotency và rollback.
- [ ] Audit mọi hành động quan trọng; không log PII thừa.
- [ ] Kiểm tra hiệu năng: pagination server-side, indexes, query plan, large dataset.
- [ ] Kiểm tra accessibility, iOS/Android/mobile viewport và desktop.
- [ ] Kiểm tra secrets trong source, bundle, logs, Vercel env và Supabase policies.

## 3. Thứ tự migration đề xuất

Mỗi nhóm migration phải độc lập, review và test trước khi chạy production. Không gộp toàn bộ vào một migration khổng lồ.

1. Security remediation: role matrix, metadata RLS, separation-of-duty RPC, duplicate-safe permission apply, grants.
2. Core admissions/students: cohorts, class_groups, students, enrollments, applicants, documents, decisions, conversion RPC.
3. Curriculum: occupations, programs, versions, subjects, program_subjects, academic years/terms.
4. Training delivery: training plans, offerings, staff assignments for teaching.
5. Timetable: rooms, periods, timetable versions/sessions, conflict-safe publish.
6. Attendance: sessions, records, correction requests.
7. Grades: schemes, assessment items, grade entries, lock/change workflows, calculation runs/results.
8. Administration: document registers/routes/attachments.
9. Finance: periods, funds, budget, vouchers, posting/close period.
10. Assets: assets, assignments, inventory, maintenance.
11. Tasks/calendar: work tasks, assignees, events, notifications.
12. Reporting: aggregate RPCs after source tables exist; verify BGH only reports.view.
13. AI-OFFICE: last; default OFF; only after privacy, provider, ACL and cost approval.

Dependency order is mandatory: do not migrate timetable/grades before students/classes/programs/offerings; do not build reports before source tables exist.

## 4. Release gates per migration

For each migration:
1. Confirm current production schema and applied migration version.
2. Review SQL for data loss, lock duration, backfill, FK/index strategy and rollback.
3. Run on a non-production database or isolated disposable test environment with synthetic data.
4. Run pgTAP/SQL tests for constraints, RLS, RPC permissions, concurrency and idempotency.
5. Verify grants for anon/authenticated/service_role and function execute privileges.
6. Obtain explicit production approval.
7. Take/verify backup and record rollback owner/window.
8. Apply one migration group, inspect logs and schema, run smoke tests.
9. Test with real JWTs for each role; BGH direct table access must fail.
10. Record migration SHA, execution time, validation evidence and rollback decision.

No production SQL is to be applied by inference from this plan.

## 5. Application release gates

- GitHub Actions: install, typecheck, lint, unit/integration tests, production build all green.
- Vercel Preview: READY and tested with authorized accounts; note whether SSO protects Preview.
- No secrets or privileged service key in client bundle.
- Supabase policies tested independently of UI.
- No unresolved P0 security finding.
- Admin and BGH role journeys pass.
- BGH sees only Reports navigation and aggregate output.
- Mobile/desktop critical flows pass.
- Backup/rollback and incident contact are documented.
- PR reviewed and approved; merge/deploy are separate approvals.

## 6. Rollback strategy

- Database: use additive migrations where possible; destructive changes require backup and explicit rollback SQL/restore plan. Do not assume every DDL can be rolled back without data loss.
- Application: retain previous production deployment and use Vercel rollback only after confirming DB compatibility.
- Feature flags: disable new modules/AI quickly without deleting data.
- Data corrections: prefer compensating events/records over destructive edits.
- Any rollback must preserve audit evidence and reconcile application/database versions.

## 7. Known facts and limitations at this checkpoint

- Production project: `akckcnijujtevfbginja`; RBAC migration `20261126153433_production_rbac_reporting_hardening` applied.
- `system_admin`: 91 permissions across 13 modules, excluding `ai_office`; `ban_giam_hieu`: only `reports.view`.
- SQL smoke tests using simulated JWT claims and rollback verified BGH metadata denial, aggregate report access, Admin metadata access and separation-of-duty.
- Two active production profiles exist and both are system_admin; no actual BGH, teacher, specialist or department/faculty manager accounts are assigned.
- Staff and staff_assignments are empty. Reports currently show 9 active org units, 0 staff, 0 assignments; student/admissions/training result metrics are unavailable.
- PR #2 was squash-merged as `fcd0e66e33ea420a43e215ad4e58140eadb5e821`; GitHub Actions CI #180 passed; Vercel production is READY at https://thndongnamna.vercel.app. HTML, CSS, main JS and lazy page chunks returned HTTP 200.
- No real browser login/E2E acceptance has been run.
- Business modules admissions, students, curriculum, timetable, attendance, grades, documents, finance, assets and tasks still lack production tables and CRUD workflows; current routes are placeholders.
- Security follow-ups: leaked-password protection is OFF; private archive table `private.c8_removed_role_permissions` contains 36 rows with RLS OFF and no anon/authenticated SELECT grant; Vercel install-script and npm cache-dir warnings remain.
- Full production acceptance depends on actual school forms, program decisions, timetable and grading regulations, real role accounts and browser/JWT acceptance tests.
## 8. Explicit approval boundary

Đã được người dùng phê duyệt và hoàn tất cho đợt nền tảng ngày 2026-11-26: áp dụng migration RBAC/reporting, merge PR #2 vào main và deploy Vercel production. Các thay đổi tiếp theo liên quan đến schema nghiệp vụ, tài khoản/role thật, cấu hình bảo mật Auth và AI provider vẫn phải được kiểm thử và phê duyệt theo từng phạm vi. Việc production foundation READY không đồng nghĩa toàn bộ dự án hoàn thành; chỉ nghiệm thu sau khi tất cả phân hệ nghiệp vụ và tiêu chí ở trên đạt.
