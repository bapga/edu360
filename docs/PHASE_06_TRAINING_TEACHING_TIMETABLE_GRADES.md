# EDU360 — Thiết kế chi tiết Chặng 6: Đào tạo, Giảng dạy, Thời khóa biểu và Điểm

Trạng thái: **Thiết kế nghiệp vụ/kỹ thuật; chưa tạo migration, chưa ghi Supabase production**  
Ngày: 2026-11-26  
Phạm vi: chương trình đào tạo, phiên bản chương trình, học phần/môn-mô-đun, kế hoạch, phân công giảng dạy, thời khóa biểu, chuyên cần, đánh giá, điểm và xét kết quả.

## 1. Mục tiêu và nguyên tắc

1. Dùng chung hồ sơ gốc từ Chặng 4–5: `students`, `student_enrollments`, `cohorts`, `class_groups`; dùng `staff` và `staff_assignments` hiện hữu.
2. Không tạo bản sao hồ sơ người học/nhân sự. Tất cả quan hệ dùng FK.
3. Chương trình đào tạo được version hóa theo quyết định và niên khóa; không sửa hồi tố phiên bản đã áp dụng.
4. Danh mục học phần dùng tên `subjects`, tuyệt đối không dùng `modules` vì `public.modules` đang là bảng phân hệ phân quyền phần mềm.
5. Phân công giảng dạy là nguồn chuẩn để xác định giáo viên được nhập điểm/điểm danh cho lớp-học phần nào và trong khoảng thời gian nào.
6. Thời khóa biểu phải kiểm tra xung đột lớp, giáo viên, phòng/xưởng và khoảng thời gian.
7. Điểm chỉ lưu một lần trong `grade_entries`; điểm trung bình/kết quả là dữ liệu tính toán theo công thức có phiên bản, không nhập tay hoặc sao chép sang hồ sơ.
8. Không cho sửa điểm đã nộp/khóa bằng UPDATE trực tiếp. Sửa điểm phải qua yêu cầu, phê duyệt, mở khóa có lý do và audit.
9. BGH chỉ xem số liệu tổng hợp qua RPC có kiểm tra `reports.view`; không đọc bảng người học, lịch học, chuyên cần hoặc điểm cá nhân.
10. RLS/RPC là lớp bảo mật quyết định. Frontend không được tự coi filter/ẩn nút là bảo mật.

## 2. Phụ thuộc và baseline

- Chặng 4–5 đề xuất `students`, `student_enrollments`, `cohorts`, `class_groups`, `student_class_history`; chưa tồn tại trong production tại lần kiểm tra gần nhất.
- Chặng 6 phụ thuộc các bảng trên và các bảng `staff`, `staff_assignments`, `org_units` đã có.
- Danh mục module/action RBAC đã có các module `training`, `teaching`, `grades`; sự tồn tại của module quyền không có nghĩa schema nghiệp vụ đã tồn tại.
- Trước migration phải kiểm tra lại schema thực tế, FK, kiểu ID, các cột `org_unit_id`, RLS helper và các migration mới phát sinh; không dùng tài liệu này như bằng chứng schema hiện tại.

## 3. Mô hình dữ liệu đề xuất

### 3.1. Danh mục nghề và chương trình

| Bảng | Trường cốt lõi | Ràng buộc/nghiệp vụ |
|---|---|---|
| occupations | id, code, name, qualification_level, active | code unique; danh mục nghề chuẩn |
| training_programs | id, occupation_id, code, name, qualification_level, total_hours, duration_months, active | code unique; không sửa nội dung phiên bản đã phát hành |
| program_versions | id, program_id, version_code, effective_from, effective_to, decision_number, decision_date, status, approved_by | unique(program_id, version_code); effective_to >= effective_from |
| subjects | id, code, name, subject_type, default_hours, grading_scale, active | code unique; subject_type general/vocational/practice/other |
| program_subjects | id, program_version_id, subject_id, term_no, sequence_no, theory_hours, practice_hours, internship_hours, total_hours, required, prerequisites | unique(version, subject, term); giờ thành phần khớp total_hours |
| academic_years | id, code, starts_on, ends_on, status | code unique; ngày hợp lệ |
| academic_terms | id, academic_year_id, term_code, starts_on, ends_on, status | unique(year, term_code); không chồng lấn kỳ nếu quy chế yêu cầu |

Không lưu cứng một bộ công thức điểm chung cho mọi nghề/học phần. Chương trình và quy định áp dụng có thể khác nhau theo trình độ, nghề, niên khóa và thời điểm.

### 3.2. Kế hoạch đào tạo và mở lớp học phần

| Bảng | Trường cốt lõi | Ràng buộc/nghiệp vụ |
|---|---|---|
| training_plans | id, cohort_id, program_version_id, academic_year_id, status, approved_by, approved_at | một kế hoạch áp dụng rõ cohort/version |
| training_plan_items | id, training_plan_id, program_subject_id, planned_start, planned_end, planned_hours, term_no, status | không vượt số giờ phiên bản; kiểm tra ngày |
| class_subject_offerings | id, class_group_id, program_subject_id, academic_term_id, planned_hours, status | unique theo lớp/học phần/kỳ; FK chương trình lớp phải phù hợp |
| teaching_assignments | id, offering_id, staff_id, org_unit_id, role, assigned_from, assigned_to, status, assigned_by | phân công có hiệu lực; hỗ trợ đồng giảng nếu được duyệt |
| teaching_assignment_events | id, assignment_id, event_type, actor_id, reason, created_at | append-only; lưu lịch sử đổi giáo viên |

Một lớp/học phần/kỳ có thể có nhiều giáo viên nếu là đồng giảng hoặc chia nhóm; cần quy tắc tỷ lệ giờ/nhóm trước khi chốt. Mỗi phân công phải có thời hạn hiệu lực và được xác thực với `staff_assignments` hiện hành.

### 3.3. Phòng học, tiết học và thời khóa biểu

| Bảng | Trường cốt lõi | Ràng buộc/nghiệp vụ |
|---|---|---|
| classrooms | id, code, name, room_type, org_unit_id, capacity, active | code unique; room_type classroom/workshop/lab/other |
| timetable_periods | id, academic_year_id, period_no, starts_at, ends_at, label | starts_at < ends_at; chuẩn hóa múi giờ |
| timetable_versions | id, academic_term_id, class_group_id, version_no, status, published_at, published_by | version_no tăng; chỉ một version published hiện hành theo lớp/kỳ |
| timetable_sessions | id, timetable_version_id, offering_id, teaching_assignment_id, classroom_id, session_date, period_id, starts_at, ends_at, planned_hours, status | kiểm tra xung đột tài nguyên và tính hợp lệ |
| timetable_change_requests | id, session_id, requested_by, proposed_date/period/room, reason, status, decided_by | thay đổi lịch sau công bố phải có lý do và duyệt |
| timetable_events | id, timetable_version_id, event_type, actor_id, payload_redacted, created_at | append-only |

Quy tắc xung đột:
- Một lớp không có hai buổi học giao nhau.
- Một giáo viên không được phân vào hai buổi giao nhau.
- Một phòng/xưởng không được có hai buổi giao nhau.
- Phải kiểm tra cả giờ bắt đầu/kết thúc thực tế, không chỉ period_no.
- Phải xét các ngày nghỉ/lịch trường được cấu hình.
- Kiểm tra concurrency ở database bằng transaction/constraint hoặc cơ chế khóa tài nguyên; không chỉ query trước ở frontend.
- Khi công bố version mới, lưu version cũ để truy vết; không xóa lịch đã công bố.

### 3.4. Chuyên cần

| Bảng | Trường cốt lõi | Ràng buộc/nghiệp vụ |
|---|---|---|
| attendance_sessions | id, timetable_session_id, opened_by, opened_at, closed_at, status | unique(timetable_session_id) hoặc version theo quy trình |
| attendance_records | id, attendance_session_id, student_enrollment_id, attendance_status, minutes_late, note, marked_by, marked_at | unique(session, enrollment); trạng thái present/absent_excused/absent_unexcused/late |
| attendance_change_requests | id, record_id, requested_by, proposed_status, reason, status, decided_by | chỉnh sửa sau khi khóa cần phê duyệt |
| attendance_events | id, attendance_session_id, event_type, actor_id, reason, created_at | append-only |

Giáo viên chỉ điểm danh người học thuộc lớp/đợt học và buổi học được phân công. Khi đóng phiên, dữ liệu không bị ghi đè; sửa sau đóng phiên phải theo luồng yêu cầu. Quy tắc tính số giờ vắng và điều kiện dự thi phải được cấu hình theo quy chế thực tế, không tự giả định.

### 3.5. Đánh giá và điểm

| Bảng | Trường cốt lõi | Ràng buộc/nghiệp vụ |
|---|---|---|
| assessment_schemes | id, program_version_id, subject_id, scheme_version, grading_scale, rounding_rule, status | version hóa; chỉ một bản active cho phạm vi áp dụng |
| assessment_items | id, offering_id, scheme_id, code, name, assessment_type, weight, max_score, min_score, sequence_no, required | unique(offering, code); tổng weight kiểm tra theo quy chế |
| grade_entries | id, assessment_item_id, student_enrollment_id, score, status, entered_by, entered_at, submitted_at, updated_by, updated_at | unique(item, enrollment); score trong thang điểm; không hard-delete |
| grade_change_requests | id, grade_entry_id, old_score_snapshot, proposed_score, reason, requested_by, status, decided_by, decided_at | snapshot chỉ để đối chiếu; audit đầy đủ |
| grade_lock_events | id, offering_id, event_type, actor_id, reason, created_at | append-only; lock/unlock có phê duyệt |
| grade_calculation_runs | id, offering_id, scheme_id, algorithm_version, calculated_at, calculated_by, input_hash, status | lưu version công thức và fingerprint đầu vào |
| academic_results | id, offering_id, student_enrollment_id, scheme_id, calculation_run_id, final_score, result_code, published_at, published_by | unique(offering, enrollment, scheme/version); snapshot có nguồn truy vết |

Điểm thành phần là nguồn dữ liệu chuẩn. `academic_results` chỉ là snapshot tính toán có version để công bố/kết xuất, có thể tái tạo từ grade_entries và scheme; không nhập trực tiếp điểm tổng kết vào snapshot.

Công thức, trọng số, làm tròn, điều kiện đạt, số lần kiểm tra và cách xử lý vắng phải được xác định theo quy chế đào tạo của trường và văn bản hiện hành áp dụng cho từng chương trình. Không hard-code công thức khi chưa có căn cứ.

### 3.6. Kết quả học tập và xét tốt nghiệp

| Bảng | Trường cốt lõi | Ràng buộc/nghiệp vụ |
|---|---|---|
| graduation_reviews | id, cohort_id, program_version_id, review_date, status, created_by | mỗi đợt có trạng thái và phạm vi |
| graduation_review_items | id, review_id, student_enrollment_id, eligibility_snapshot, result, reason | unique(review, enrollment) |
| graduation_decisions | id, review_id, decision_number, decision_date, approved_by, status | quyết định có số và audit |
| student_academic_events | id, student_enrollment_id, event_type, effective_date, reference_id, reason, actor_id | lịch sử học vụ; không xóa sự kiện đã chốt |

Xét tốt nghiệp chỉ được thực hiện sau khi có đầy đủ kết quả hợp lệ, chương trình áp dụng và tiêu chí đã được phê duyệt. Hệ thống đưa ra danh sách/điều kiện tham khảo; quyết định cuối cùng theo thẩm quyền của trường.

## 4. Quy trình nghiệp vụ đầu-cuối

1. Khai báo nghề, chương trình và danh mục học phần.
2. Tạo phiên bản chương trình, nhập học phần/giờ/học kỳ, đính kèm quyết định; trình Admin/người được ủy quyền duyệt.
3. Gán program_version cho cohort và tạo training_plan.
4. Phòng Đào tạo lập kế hoạch theo năm/học kỳ; khoa rà soát giờ, giáo viên và điều kiện thực hành.
5. Mở class_subject_offerings cho lớp/kỳ; xác định số giờ và sĩ số.
6. Khoa/Phòng Đào tạo phân công giáo viên; kiểm tra trạng thái nhân sự và đơn vị công tác.
7. Lập thời khóa biểu; kiểm tra xung đột; trình duyệt/công bố version.
8. Giáo viên xem lịch được phân công, mở phiên điểm danh và nhập chuyên cần.
9. Phòng Đào tạo/khoa thiết lập scheme và assessment_items theo quy định đã duyệt.
10. Giáo viên nhập điểm cho học viên thuộc offering được giao; validate thang điểm; lưu nháp và nộp điểm.
11. Phòng Đào tạo kiểm tra; khóa điểm. Muốn sửa sau khóa phải tạo grade_change_request và được duyệt độc lập.
12. Hệ thống tính kết quả theo algorithm_version; công bố theo quyền.
13. Tạo đợt xét tốt nghiệp; đối chiếu điều kiện; phê duyệt và ghi quyết định.
14. Báo cáo BGH chỉ lấy số liệu tổng hợp; không expose grade_entries hoặc dữ liệu cá nhân.

## 5. Phân quyền và scope

| Vai trò | Quyền nghiệp vụ đề xuất |
|---|---|
| Admin/system_admin | Quản trị cấu hình, danh mục, phân quyền và phê duyệt; không tự duyệt yêu cầu/tác vụ do chính mình tạo |
| Phòng Đào tạo | Quản lý chương trình/kế hoạch, mở học phần, thời khóa biểu tổng thể, kiểm tra/khóa điểm, báo cáo nghiệp vụ |
| Trưởng/phó khoa | Xem và quản lý trong khoa được giao; duyệt chuyên môn/phân công theo thẩm quyền |
| Giáo viên | Chỉ xem lịch và lớp/học phần được phân công; điểm danh và nhập/nộp điểm trong thời gian mở |
| Phòng Quản lý HSSV | Xem hồ sơ/lớp và chuyên cần theo quyền được cấp; không mặc định sửa điểm |
| Người học | Chỉ xem lịch cá nhân/lớp và kết quả đã công bố của chính mình |
| BGH | Chỉ `reports.view`; không đọc dữ liệu chi tiết, không duyệt, không nhập/sửa/khóa điểm |

Scope cần kiểm tra ở DB:
- `all`: toàn trường khi được cấp rõ.
- `unit`: org_unit_id thuộc đơn vị được giao và thời hạn assignment đang hiệu lực.
- `class`: class_group_id trong phạm vi được giao (nếu schema permission hỗ trợ; nếu không, kiểm tra qua quan hệ assignment).
- `teaching_assignment`: giáo viên chỉ thao tác đúng assignment và khoảng thời gian hiệu lực.
- `own`: người học chỉ truy cập student_enrollment liên kết tài khoản của chính mình.

Không cấp quyền theo chức danh chỉ bằng suy đoán. Ma trận role/action cụ thể cần Admin duyệt và được phản ánh cả frontend lẫn RLS/RPC.

## 6. RPC và transaction trọng yếu

Tên RPC dưới đây là dự kiến, phải rà soát với catalog hiện tại trước khi migration:
- `publish_program_version(p_version_id, p_reason)`: kiểm tra quyền, phê duyệt và chốt phiên bản.
- `build_training_plan(p_cohort_id, p_program_version_id, p_year_id)`: tạo kế hoạch idempotent.
- `create_class_offering(p_class_group_id, p_program_subject_id, p_term_id)`: kiểm tra chương trình của lớp.
- `assign_teacher(p_offering_id, p_staff_id, p_role, p_from, p_to)`: kiểm tra staff assignment đang hiệu lực và xung đột phân công.
- `publish_timetable(p_version_id)`: khóa tài nguyên, kiểm tra xung đột và công bố nguyên tử.
- `request_timetable_change(p_session_id, p_payload, p_reason)` / `decide_timetable_change(...)`.
- `open_attendance_session(p_timetable_session_id)`, `close_attendance_session(p_session_id)`.
- `submit_grades(p_offering_id)`: xác minh giáo viên được phân công, completeness và thời hạn.
- `lock_grades(p_offering_id, p_reason)` / `request_grade_unlock(...)` / `decide_grade_change(...)`.
- `calculate_academic_results(p_offering_id, p_algorithm_version)`: tính từ grade_entries, ghi input_hash và snapshot version.
- `publish_academic_results(p_calculation_run_id)`: công bố kết quả hợp lệ.
- `run_graduation_review(p_review_id)`: tạo snapshot điều kiện; không tự ban hành quyết định.

Mọi RPC cần kiểm tra active profile, permission, scope, trạng thái, thời gian hiệu lực, separation-of-duty và idempotency khi thích hợp. SECURITY DEFINER (nếu bắt buộc) phải `SET search_path = ''`, schema-qualify object, revoke anon/public và grant authenticated phù hợp. Ưu tiên SECURITY INVOKER.

## 7. RLS và bảo vệ dữ liệu

- Bật RLS cho tất cả bảng nghiệp vụ mới.
- Không tạo policy SELECT kiểu `is_active_user()` cho toàn bộ bảng người học/điểm.
- Teacher read/write phải đi qua offering + assignment + staff assignment active + thời gian hiệu lực.
- Người học chỉ đọc bản ghi thuộc student link của chính mình và kết quả đã công bố.
- Phòng Đào tạo/khoa giới hạn theo org_unit_id và vai trò thực tế.
- BGH không có SELECT trực tiếp trên bất kỳ bảng nguồn nào; chỉ RPC báo cáo tổng hợp.
- Các bảng `grade_entries`, `grade_change_requests`, `grade_lock_events` không cho DELETE thông thường.
- Storage tài liệu đào tạo/đề kiểm tra (nếu có) dùng bucket private, scope theo offering và quyền; không lưu đề thi/đáp án công khai.
- Audit không ghi raw personal data hoặc điểm hàng loạt; log actor, record id, action, timestamp, reason và metadata tối thiểu.
- Index FK, offering_id, student_enrollment_id, assessment_item_id, class_group_id, staff_id, session_date, status; đo EXPLAIN theo tải thực tế.

## 8. Giao diện

### Phòng Đào tạo
- Danh mục nghề/chương trình/phiên bản; import Excel có preview và mapping.
- Kế hoạch năm/học kỳ, tiến độ giờ học, học phần theo lớp.
- Lịch tổng thể, kiểm tra xung đột, duyệt và công bố thời khóa biểu.
- Bảng theo dõi chuyên cần và trạng thái nộp điểm.
- Hàng đợi duyệt sửa điểm/mở khóa; khóa điểm theo offering.
- Kết quả học tập, xét tốt nghiệp và báo cáo.

### Khoa
- Chương trình/học phần trong phạm vi; phân công giáo viên; kế hoạch thực hành.
- TKB khoa/lớp/giáo viên; xác nhận lịch.
- Theo dõi chuyên cần, tiến độ giờ và trạng thái nhập điểm.
- Duyệt chuyên môn theo thẩm quyền, không vượt phạm vi khoa.

### Giáo viên
- Lịch dạy cá nhân; danh sách lớp/học phần được giao.
- Điểm danh theo buổi; nhập điểm theo assessment item.
- Lưu nháp, nộp điểm, xem trạng thái khóa; yêu cầu sửa điểm.
- Không xem lớp/học phần ngoài phân công.

### Người học
- Lịch học cá nhân/lớp.
- Chuyên cần và kết quả đã công bố của bản thân.
- Không xem điểm nháp hoặc điểm người học khác.

### BGH
- Trang báo cáo tổng hợp: tiến độ đào tạo, giờ kế hoạch/thực hiện, tỷ lệ chuyên cần, tỷ lệ nộp điểm, kết quả tổng hợp, cảnh báo trễ tiến độ.
- Không có danh sách người học/giáo viên, bảng điểm cá nhân, nút duyệt hay thao tác ghi.

Tất cả màn hình phải có loading/empty/error, tìm kiếm/lọc/phân trang, responsive, keyboard navigation, xác nhận thao tác trọng yếu và thông báo lỗi tiếng Việt rõ ràng.

## 9. Kiểm thử chấp nhận

1. Version: chương trình đã áp dụng cho cohort không bị sửa hồi tố; version mới không làm thay đổi cohort cũ.
2. Giờ học: tổng giờ program_subjects khớp chương trình và không vượt quy định đã nhập.
3. Phân công: giáo viên hết hợp đồng/assignment không thể nhập điểm/điểm danh; giáo viên ngoài khoa không thể truy cập scope khác.
4. TKB: kiểm tra xung đột lớp, giáo viên, phòng; test hai transaction đồng thời để không công bố lịch trùng.
5. Chuyên cần: một phiên không có hai bản ghi cho cùng student_enrollment; đóng phiên thì không sửa trực tiếp.
6. Điểm: điểm ngoài thang bị từ chối; unique ngăn nhập trùng; giáo viên chỉ nhập offering được giao.
7. Khóa điểm: không UPDATE/DELETE trực tiếp; yêu cầu sửa có lý do, duyệt độc lập và audit.
8. Tính điểm: cùng input + algorithm_version cho kết quả ổn định; thay scheme tạo calculation run mới, không ghi đè lịch sử.
9. Công bố: người học chỉ xem kết quả đã công bố của bản thân.
10. BGH: REST trực tiếp vào bảng nguồn bị từ chối; chỉ reports RPC trả aggregate.
11. Import: preview, lỗi từng dòng, idempotency, rollback toàn batch khi yêu cầu; không import trực tiếp vào production không kiểm soát.
12. Kiểm thử JWT thực tế theo Admin, BGH, Phòng Đào tạo, khoa, giáo viên, người học; CI typecheck/test/build.

## 10. Dữ liệu cần đối chiếu trước migration

- Quyết định/chương trình đào tạo đang áp dụng theo từng nghề, trình độ và niên khóa.
- Danh mục môn học/mô-đun, số giờ lý thuyết/thực hành/thực tập, học kỳ và thứ tự.
- Mẫu kế hoạch đào tạo, mẫu phân công, thời khóa biểu Excel thực tế.
- Quy định điểm thành phần, trọng số, thang điểm, làm tròn, điều kiện dự thi/đạt, khóa và sửa điểm.
- Lịch năm học, kỳ, tiết học, giờ vào/ra, ngày nghỉ, phòng/xưởng và sức chứa.
- Quy trình duyệt của Phòng Đào tạo, khoa và thẩm quyền Admin.
- Quy tắc liên kết lớp/khóa/nghề và mã hồ sơ đang sử dụng.

Không tự tạo dữ liệu mẫu có vẻ như dữ liệu thật; dùng fixtures tổng hợp được đánh dấu rõ trong test.

## 11. Cổng triển khai

- [ ] Đối chiếu schema production mới nhất và xác nhận phụ thuộc Chặng 4–5.
- [ ] Thu thập biểu mẫu Excel/quyết định chương trình/quy chế điểm.
- [ ] Chốt ERD, từ điển dữ liệu, công thức có version và workflow.
- [ ] Chốt ma trận quyền/scope và separation-of-duty.
- [ ] Viết migration rollbackable, RLS, grants, RPC, audit, indexes.
- [ ] Kiểm thử concurrency, JWT từng role, API trực tiếp và Storage.
- [ ] Sau khi được phê duyệt DB mới triển khai giao diện CRUD và import.
- [ ] Preview QA, nghiệm thu nghiệp vụ, phê duyệt merge/deploy riêng.

Không có DDL/DML nào được áp dụng bởi tài liệu này.
