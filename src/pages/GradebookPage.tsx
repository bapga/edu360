import { useCallback,useEffect,useMemo,useState,type FormEvent } from 'react'
import { ClipboardList,RefreshCw,Plus,Save,Send,Lock,Unlock,CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePermissions } from '../contexts/PermissionContext'

type Offering={id:string;org_unit_id:string;class_group_id:string;program_subject_id:string;academic_term_id:string;planned_hours:number;status:string}
type RosterRow={enrollment_id:string;student_id:string;student_code:string;full_name:string;enrollment_status:string}
type AttendanceSession={id:string;offering_id:string;timetable_slot_id:string|null;session_date:string;session_no:number;planned_periods:number;status:string;note:string|null;created_by:string}
type AttendanceRecord={id?:string;session_id:string;student_enrollment_id:string;attendance_status:string;periods_absent:number;note:string|null;marked_by?:string}
type GradeSheet={id:string;offering_id:string;sheet_code:string;status:string;grading_scale:number;formula_note:string|null;created_by:string}
type Component={id:string;grade_sheet_id:string;component_code:string;component_name:string;weight:number;max_score:number;sequence_no:number}
type GradeEntry={id?:string;grade_sheet_id:string;grade_component_id:string;student_enrollment_id:string;score:number|null;comment:string|null;entered_by?:string;updated_by?:string}
const attendanceLabels:Record<string,string>={present:'Có mặt',late:'Đi muộn',absent_excused:'Vắng có phép',absent_unexcused:'Vắng không phép'}
const statusLabels:Record<string,string>={draft:'Bản nháp',open:'Đang mở / cần sửa',submitted:'Chờ duyệt',approved:'Đã duyệt',locked:'Đã khóa',reopened:'Mở lại'}
export default function GradebookPage(){
 const {can}=usePermissions()
 const [tab,setTab]=useState<'attendance'|'grades'>('attendance')
 const [offerings,setOfferings]=useState<Offering[]>([])
 const [sessions,setSessions]=useState<AttendanceSession[]>([])
 const [records,setRecords]=useState<AttendanceRecord[]>([])
 const [roster,setRoster]=useState<RosterRow[]>([])
 const [gradeSheets,setGradeSheets]=useState<GradeSheet[]>([])
 const [components,setComponents]=useState<Component[]>([])
 const [entries,setEntries]=useState<GradeEntry[]>([])
 const [selectedOffering,setSelectedOffering]=useState('')
 const [selectedSession,setSelectedSession]=useState('')
 const [selectedSheet,setSelectedSheet]=useState('')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState<string|null>(null)
 const [notice,setNotice]=useState<string|null>(null)
 const [sessionForm,setSessionForm]=useState({session_date:'',session_no:'1',planned_periods:'1',note:''})
 const [componentForm,setComponentForm]=useState({code:'',name:'',weight:'',max_score:'10'})
 const [scores,setScores]=useState<Record<string,string>>({})
 const canAttendanceCreate=can('teaching','create')
 const canAttendanceEdit=canAttendanceCreate||can('teaching','update')
 const canAttendanceView=can('teaching','view')
 const canAttendanceApprove=can('teaching','approve')
 const canGradeCreate=can('grades','create')
 const canGradeEdit=canGradeCreate||can('grades','update')
 const canGradeApprove=can('grades','approve')
 const activeSheet=gradeSheets.find(g=>g.id===selectedSheet&&g.offering_id===selectedOffering)
 const totalWeight=useMemo(()=>components.reduce((sum,c)=>sum+Number(c.weight)*100,0),[components])
 const attendanceSession=sessions.find(s=>s.id===selectedSession&&s.offering_id===selectedOffering)
 const offeringLabel=(id:string)=>{const o=offerings.find(x=>x.id===id);return o?'Lớp '+o.class_group_id.slice(0,8)+' · '+o.planned_hours+' giờ':'Lớp học phần'}

 const load=useCallback(async()=>{
  if(!supabase){setError('Chưa cấu hình kết nối Supabase.');setLoading(false);return}
  setLoading(true);setError(null)
  const [o,a,g]=await Promise.all([
   supabase.from('class_subject_offerings').select('id,org_unit_id,class_group_id,program_subject_id,academic_term_id,planned_hours,status').order('created_at',{ascending:false}),
   supabase.from('attendance_sessions').select('id,offering_id,timetable_slot_id,session_date,session_no,planned_periods,status,note,created_by').order('session_date',{ascending:false}),
   supabase.from('grade_sheets').select('id,offering_id,sheet_code,status,grading_scale,formula_note,created_by').order('created_at',{ascending:false})
  ])
  const failure=o.error??a.error??g.error
  if(failure)setError(failure.message)
  setOfferings((o.data??[]) as Offering[]);setSessions((a.data??[]) as AttendanceSession[]);setGradeSheets((g.data??[]) as GradeSheet[])
  setSelectedOffering(old=>old||o.data?.[0]?.id||'')
  setSelectedSession(old=>old||a.data?.[0]?.id||'')
  setSelectedSheet(old=>old||g.data?.[0]?.id||'')
  setLoading(false)
 },[])
 useEffect(()=>{void load()},[load])
 useEffect(()=>{if(!canAttendanceView)setTab('grades')},[canAttendanceView])
 const loadRoster=useCallback(async(id:string)=>{
  if(!supabase||!id){setRoster([]);return}
  const {data,error:e}=await supabase.rpc('get_offering_roster',{p_offering_id:id})
  if(e){setError(e.message);setRoster([]);return}
  setRoster((data??[]) as RosterRow[])
 },[])
 const loadAttendance=useCallback(async(id:string)=>{
  if(!supabase||!id){setRecords([]);return}
  const {data,error:e}=await supabase.from('attendance_records').select('id,session_id,student_enrollment_id,attendance_status,periods_absent,note,marked_by').eq('session_id',id)
  if(e){setError(e.message);return}
  setRecords((data??[]) as AttendanceRecord[])
 },[])
 const loadSheet=useCallback(async(id:string)=>{
  if(!supabase||!id){setComponents([]);setEntries([]);return}
  const c=await supabase.from('grade_components').select('id,grade_sheet_id,component_code,component_name,weight,max_score,sequence_no').eq('grade_sheet_id',id).order('sequence_no')
  if(c.error){setError(c.error.message);return}
  setComponents((c.data??[]) as Component[])
  const ids=(c.data??[]).map(x=>x.id)
  if(ids.length){
   const result=await supabase.from('grade_entries').select('id,grade_sheet_id,grade_component_id,student_enrollment_id,score,comment').in('grade_component_id',ids)
   if(result.error)setError(result.error.message)
   setEntries((result.data??[]) as GradeEntry[])
  }else setEntries([])
  setScores({})
 },[])
 useEffect(()=>{if(selectedOffering)void loadRoster(selectedOffering)},[selectedOffering,loadRoster])
 useEffect(()=>{const list=sessions.filter(s=>s.offering_id===selectedOffering);if(!list.some(s=>s.id===selectedSession))setSelectedSession(list[0]?.id??'')},[sessions,selectedOffering,selectedSession])
 useEffect(()=>{const list=gradeSheets.filter(g=>g.offering_id===selectedOffering);if(!list.some(g=>g.id===selectedSheet))setSelectedSheet(list[0]?.id??'')},[gradeSheets,selectedOffering,selectedSheet])
 useEffect(()=>{if(selectedSession)void loadAttendance(selectedSession)},[selectedSession,loadAttendance])
 useEffect(()=>{if(selectedSheet)void loadSheet(selectedSheet)},[selectedSheet,loadSheet])

 async function createSession(e:FormEvent){e.preventDefault();if(!supabase||!selectedOffering)return;setSaving(true);setError(null)
  const {data,error:e1}=await supabase.from('attendance_sessions').insert({offering_id:selectedOffering,session_date:sessionForm.session_date,session_no:Number(sessionForm.session_no),planned_periods:Number(sessionForm.planned_periods),note:sessionForm.note.trim()||null,status:'draft'}).select('id').single()
  setSaving(false);if(e1){setError(e1.message);return};setSessionForm({session_date:'',session_no:'1',planned_periods:'1',note:''});setSelectedSession(data.id);setNotice('Đã tạo buổi học ở trạng thái bản nháp.');await load()
 }
 function updateAttendance(enrollmentId:string,status:string){
  setRecords(old=>{const existing=old.find(r=>r.student_enrollment_id===enrollmentId);const absent=status==='absent_excused'||status==='absent_unexcused';const next:AttendanceRecord={session_id:selectedSession,student_enrollment_id:enrollmentId,attendance_status:status,periods_absent:absent?Number(attendanceSession?.planned_periods??1):0,note:existing?.note??null};return [...old.filter(r=>r.student_enrollment_id!==enrollmentId),next]})
 }
 async function saveAttendance(){if(!supabase||!selectedSession)return;setSaving(true);setError(null);const {data:user}=await supabase.auth.getUser();if(!user.user){setSaving(false);setError('Phiên đăng nhập không hợp lệ.');return}
  const payload=roster.map(p=>{const row=records.find(r=>r.student_enrollment_id===p.enrollment_id);return {session_id:selectedSession,student_enrollment_id:p.enrollment_id,attendance_status:row?.attendance_status??'present',periods_absent:row?.periods_absent??0,note:row?.note??null,marked_by:user.user.id}})
  const {error:e}=await supabase.from('attendance_records').upsert(payload,{onConflict:'session_id,student_enrollment_id'})
  setSaving(false);if(e){setError(e.message);return};setNotice('Đã lưu điểm danh '+payload.length+' người học.');await loadAttendance(selectedSession)
 }
 async function submitAttendance(){if(!supabase||!selectedSession)return;setSaving(true);setError(null);const {error:e}=await supabase.rpc('submit_attendance_session',{p_session_id:selectedSession});setSaving(false);if(e){setError(e.message);return};setNotice('Đã gửi buổi điểm danh chờ duyệt.');await load()}
 async function decideAttendance(approve:boolean){if(!supabase||!selectedSession)return;const note=window.prompt(approve?'Lý do phê duyệt (tối thiểu 5 ký tự):':'Lý do trả lại (tối thiểu 5 ký tự):')??'';if(note.trim().length<5)return;setSaving(true);setError(null);const {error:e}=await supabase.rpc('decide_attendance_session',{p_session_id:selectedSession,p_approve:approve,p_note:note});setSaving(false);if(e){setError(e.message);return};setNotice(approve?'Đã duyệt điểm danh.':'Đã trả lại điểm danh.');await load()}

 async function createSheet(){if(!supabase||!selectedOffering)return;const code=window.prompt('Nhập mã sổ điểm (duy nhất trong lớp học phần):')?.trim();if(!code)return;setSaving(true);setError(null);const {data,error:e}=await supabase.from('grade_sheets').insert({offering_id:selectedOffering,sheet_code:code,grading_scale:10,status:'draft'}).select('id').single();setSaving(false);if(e){setError(e.message);return};setSelectedSheet(data.id);setNotice('Đã tạo sổ điểm.');await load()}
 async function addComponent(e:FormEvent){e.preventDefault();if(!supabase||!activeSheet)return;const percent=Number(componentForm.weight);if(percent<=0||totalWeight+percent>100){setError('Trọng số phải lớn hơn 0 và tổng không vượt 100%.');return};setSaving(true);setError(null)
  const {error:e1}=await supabase.from('grade_components').insert({grade_sheet_id:activeSheet.id,component_code:componentForm.code.trim().toUpperCase(),component_name:componentForm.name.trim(),weight:percent/100,max_score:Number(componentForm.max_score),sequence_no:components.length+1})
  setSaving(false);if(e1){setError(e1.message);return};setComponentForm({code:'',name:'',weight:'',max_score:'10'});setNotice('Đã thêm cột điểm.');await loadSheet(activeSheet.id)
 }
 async function saveGrades(){if(!supabase||!activeSheet)return;setSaving(true);setError(null);const {data:user}=await supabase.auth.getUser();if(!user.user){setSaving(false);setError('Phiên đăng nhập không hợp lệ.');return}
  const payload=Object.entries(scores).filter(([,v])=>v.trim()!=='').map(([key,v])=>{const [component_id,enrollment_id]=key.split(':');return {grade_sheet_id:activeSheet.id,grade_component_id:component_id,student_enrollment_id:enrollment_id,score:Number(v),entered_by:user.user!.id,updated_by:user.user!.id}})
  if(!payload.length){setSaving(false);setError('Chưa có điểm nào được nhập.');return}
  const {error:e}=await supabase.from('grade_entries').upsert(payload,{onConflict:'grade_component_id,student_enrollment_id'})
  setSaving(false);if(e){setError(e.message);return};setNotice('Đã lưu '+payload.length+' điểm.');await loadSheet(activeSheet.id)
 }
 async function submitSheet(){if(!supabase||!activeSheet)return;setSaving(true);setError(null);const {error:e}=await supabase.rpc('submit_grade_sheet',{p_grade_sheet_id:activeSheet.id});setSaving(false);if(e){setError(e.message);return};setNotice('Đã gửi sổ điểm chờ phê duyệt.');await load()}
 async function approveSheet(){if(!supabase||!activeSheet)return;const reason=window.prompt('Lý do/căn cứ phê duyệt (tối thiểu 10 ký tự):')??'';if(reason.trim().length<10)return;setSaving(true);setError(null);const {error:e}=await supabase.rpc('approve_grade_sheet',{p_grade_sheet_id:activeSheet.id,p_reason:reason});setSaving(false);if(e){setError(e.message);return};setNotice('Đã phê duyệt sổ điểm.');await load()}
 async function returnSheet(){if(!supabase||!activeSheet)return;const reason=window.prompt('Lý do trả lại (tối thiểu 10 ký tự):')??'';if(reason.trim().length<10)return;setSaving(true);setError(null);const {error:e}=await supabase.rpc('return_grade_sheet',{p_grade_sheet_id:activeSheet.id,p_reason:reason});setSaving(false);if(e){setError(e.message);return};setNotice('Đã trả lại sổ điểm để chỉnh sửa.');await load()}
 async function lockSheet(){if(!supabase||!activeSheet)return;const reason=window.prompt('Lý do khóa sổ điểm (tối thiểu 10 ký tự):')??'';if(reason.trim().length<10)return;setSaving(true);setError(null);const {error:e}=await supabase.rpc('lock_grade_sheet',{p_grade_sheet_id:activeSheet.id,p_reason:reason});setSaving(false);if(e){setError(e.message);return};setNotice('Đã khóa sổ điểm.');await load()}
 async function reopenSheet(){if(!supabase||!activeSheet)return;const reason=window.prompt('Lý do mở khóa (tối thiểu 10 ký tự):')??'';if(reason.trim().length<10)return;setSaving(true);setError(null);const {error:e}=await supabase.rpc('reopen_grade_sheet',{p_grade_sheet_id:activeSheet.id,p_reason:reason});setSaving(false);if(e){setError(e.message);return};setNotice('Đã mở lại sổ điểm theo phê duyệt.');await load()}

 const attendanceMap=new Map(records.map(r=>[r.student_enrollment_id,r]))
 const scoreValue=(componentId:string,enrollmentId:string)=>scores[componentId+':'+enrollmentId]??String(entries.find(e=>e.grade_component_id===componentId&&e.student_enrollment_id===enrollmentId)?.score??'')
 return <div className="space-y-6">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-medium text-brand-700"><ClipboardList size={17}/> Người học</div><h1 className="mt-1 text-2xl font-semibold text-navy-900">Điểm danh & kết quả học tập</h1><p className="mt-1 text-sm text-slate-500">Theo lớp học phần, có quy trình gửi duyệt, phê duyệt và khóa sổ điểm.</p></div><button type="button" onClick={()=>void load()} disabled={loading} className="btn-ghost inline-flex items-center gap-2"><RefreshCw size={16}/> Làm mới</button></header>
  <div className="flex gap-2 border-b border-slate-200">{canAttendanceView&&<button type="button" onClick={()=>setTab('attendance')} className={'px-3 py-2 text-sm '+(tab==='attendance'?'border-b-2 border-brand-600 font-semibold text-brand-700':'text-slate-500')}>Điểm danh</button>}<button type="button" onClick={()=>setTab('grades')} className={'px-3 py-2 text-sm '+(tab==='grades'?'border-b-2 border-brand-600 font-semibold text-brand-700':'text-slate-500')}>Sổ điểm</button></div>
  {error&&<div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}{notice&&<div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
  <section className="card space-y-4 p-4">
   <div className="flex flex-wrap items-center gap-3"><label className="text-sm font-medium">Lớp học phần <select value={selectedOffering} onChange={e=>setSelectedOffering(e.target.value)} className="field mt-1 min-w-64"><option value="">Chọn lớp học phần</option>{offerings.map(o=><option key={o.id} value={o.id}>{offeringLabel(o.id)}</option>)}</select></label>{tab==='grades'&&canGradeCreate&&selectedOffering&&!gradeSheets.some(g=>g.offering_id===selectedOffering)&&<button type="button" onClick={()=>void createSheet()} disabled={saving} className="btn-primary mt-5"><Plus size={14} className="mr-1 inline"/> Tạo sổ điểm</button>}</div>
   {!offerings.length&&<p className="py-6 text-center text-sm text-slate-500">Chưa có lớp học phần hoặc tài khoản chưa được cấp quyền xem.</p>}
   {tab==='attendance'&&selectedOffering&&<div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><label className="text-sm font-medium">Buổi học<select value={selectedSession} onChange={e=>setSelectedSession(e.target.value)} className="field mt-1 min-w-64"><option value="">Chọn buổi học</option>{sessions.filter(s=>s.offering_id===selectedOffering).map(s=><option key={s.id} value={s.id}>{s.session_date} · buổi {s.session_no} · {statusLabels[s.status]??s.status}</option>)}</select></label>{canAttendanceCreate&&<form onSubmit={createSession} className="flex flex-wrap items-end gap-2"><label className="text-xs text-slate-500">Ngày học<input required type="date" value={sessionForm.session_date} onChange={e=>setSessionForm(v=>({...v,session_date:e.target.value}))} className="field mt-1"/></label><label className="text-xs text-slate-500">Buổi số<input required type="number" min="1" value={sessionForm.session_no} onChange={e=>setSessionForm(v=>({...v,session_no:e.target.value}))} className="field mt-1 w-24"/></label><label className="text-xs text-slate-500">Số tiết<input required type="number" min="0.5" step="0.5" value={sessionForm.planned_periods} onChange={e=>setSessionForm(v=>({...v,planned_periods:e.target.value}))} className="field mt-1 w-24"/></label><button disabled={saving} className="btn-primary"><Plus size={14} className="mr-1 inline"/> Buổi học</button></form>}</div>
    {attendanceSession&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3"><div className="text-sm"><b>{attendanceSession.session_date}</b> · Buổi {attendanceSession.session_no} · {attendanceSession.planned_periods} tiết · {statusLabels[attendanceSession.status]??attendanceSession.status}</div><div className="flex flex-wrap gap-2">{['draft','open'].includes(attendanceSession.status)?<><button type="button" onClick={()=>void saveAttendance()} disabled={saving||!roster.length||!canAttendanceEdit} className="btn-ghost"><Save size={14} className="mr-1 inline"/> Lưu điểm danh</button><button type="button" onClick={()=>void submitAttendance()} disabled={saving||!roster.length||!canAttendanceEdit} className="btn-primary"><Send size={14} className="mr-1 inline"/> Gửi duyệt</button></>:null}{attendanceSession.status==='submitted'&&canAttendanceApprove&&<><button type="button" onClick={()=>void decideAttendance(false)} disabled={saving} className="btn-ghost">Trả lại</button><button type="button" onClick={()=>void decideAttendance(true)} disabled={saving} className="btn-primary"><CheckCircle2 size={14} className="mr-1 inline"/> Duyệt</button></>}</div></div>}
    {attendanceSession&&<div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="p-2">Mã người học</th><th className="p-2">Họ và tên</th><th className="p-2">Tình trạng</th><th className="p-2">Số tiết vắng</th></tr></thead><tbody className="divide-y">{roster.map(p=>{const row=attendanceMap.get(p.enrollment_id);return <tr key={p.enrollment_id}><td className="p-2 font-mono">{p.student_code}</td><td className="p-2">{p.full_name}</td><td className="p-2"><select disabled={!['draft','open'].includes(attendanceSession.status)||!canAttendanceEdit} value={row?.attendance_status??'present'} onChange={e=>updateAttendance(p.enrollment_id,e.target.value)} className="field max-w-48">{Object.entries(attendanceLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td><td className="p-2">{row?.periods_absent??0}</td></tr>})}</tbody></table>{!roster.length&&<p className="py-6 text-center text-sm text-slate-500">Lớp chưa có người học đang theo học.</p>}</div>}
   </div>}
   {tab==='grades'&&selectedOffering&&<div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="text-sm font-medium">Sổ điểm<select value={selectedSheet} onChange={e=>setSelectedSheet(e.target.value)} className="field mt-1 min-w-64"><option value="">Chọn sổ điểm</option>{gradeSheets.filter(g=>g.offering_id===selectedOffering).map(g=><option key={g.id} value={g.id}>{g.sheet_code} · {statusLabels[g.status]??g.status}</option>)}</select></label>{activeSheet&&<div className="flex flex-wrap items-center gap-2 text-sm"><span className="rounded-full bg-slate-100 px-3 py-1">{statusLabels[activeSheet.status]??activeSheet.status}</span>{['draft','reopened'].includes(activeSheet.status)&&canGradeEdit&&<button type="button" onClick={()=>void saveGrades()} disabled={saving||!components.length} className="btn-ghost"><Save size={14} className="mr-1 inline"/> Lưu điểm</button>}{['draft','reopened'].includes(activeSheet.status)&&canGradeEdit&&<button type="button" onClick={()=>void submitSheet()} disabled={saving||!components.length} className="btn-primary"><Send size={14} className="mr-1 inline"/> Gửi duyệt</button>}{activeSheet.status==='submitted'&&canGradeApprove&&<><button type="button" onClick={()=>void returnSheet()} disabled={saving} className="btn-ghost">Trả lại</button><button type="button" onClick={()=>void approveSheet()} disabled={saving} className="btn-primary">Duyệt sổ điểm</button></>}{activeSheet.status==='approved'&&canGradeApprove&&<button type="button" onClick={()=>void lockSheet()} disabled={saving} className="btn-primary"><Lock size={14} className="mr-1 inline"/> Khóa điểm</button>}{activeSheet.status==='locked'&&canGradeApprove&&<button type="button" onClick={()=>void reopenSheet()} disabled={saving} className="btn-ghost"><Unlock size={14} className="mr-1 inline"/> Mở khóa có lý do</button>}</div>}</div>
    {activeSheet&&<><div className="rounded-lg bg-slate-50 p-3 text-sm">Tổng trọng số: <b>{totalWeight.toFixed(2)}%</b> · Thang điểm: <b>{activeSheet.grading_scale}</b> · Sĩ số đang học: <b>{roster.length}</b></div>{['draft','reopened'].includes(activeSheet.status)&&canGradeCreate&&<form onSubmit={addComponent} className="grid gap-2 md:grid-cols-2 xl:grid-cols-5"><input required value={componentForm.code} onChange={e=>setComponentForm(v=>({...v,code:e.target.value}))} placeholder="Mã cột" className="field"/><input required value={componentForm.name} onChange={e=>setComponentForm(v=>({...v,name:e.target.value}))} placeholder="Tên bài đánh giá" className="field"/><input required type="number" min="0.01" max="100" step="0.01" value={componentForm.weight} onChange={e=>setComponentForm(v=>({...v,weight:e.target.value}))} placeholder="Trọng số %" className="field"/><input required type="number" min="0.01" step="0.01" value={componentForm.max_score} onChange={e=>setComponentForm(v=>({...v,max_score:e.target.value}))} placeholder="Điểm tối đa" className="field"/><button disabled={saving||totalWeight+Number(componentForm.weight)>100} className="btn-primary"><Plus size={14} className="mr-1 inline"/> Thêm cột</button></form>}
     <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="p-2">Mã</th><th className="p-2">Nội dung</th><th className="p-2">Trọng số</th><th className="p-2">Tối đa</th></tr></thead><tbody className="divide-y">{components.map(c=><tr key={c.id}><td className="p-2 font-mono">{c.component_code}</td><td className="p-2">{c.component_name}</td><td className="p-2">{(Number(c.weight)*100).toFixed(2)}%</td><td className="p-2">{c.max_score}</td></tr>)}</tbody></table></div>
     <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="sticky left-0 bg-white p-2">Người học</th>{components.map(c=><th key={c.id} className="min-w-28 p-2">{c.component_name}<div className="font-normal">{(Number(c.weight)*100).toFixed(2)}%</div></th>)}<th className="p-2">Điểm tổng</th></tr></thead><tbody className="divide-y">{roster.map(p=>{const weighted=components.reduce((sum,c)=>{const raw=scoreValue(c.id,p.enrollment_id);return raw.trim()?sum+(Number(raw)/Number(c.max_score))*Number(c.weight)*Number(activeSheet.grading_scale):sum},0);const complete=components.length>0&&components.every(c=>scoreValue(c.id,p.enrollment_id).trim()!=='');return <tr key={p.enrollment_id}><td className="sticky left-0 bg-white p-2"><div className="font-medium">{p.full_name}</div><div className="text-xs text-slate-500">{p.student_code}</div></td>{components.map(c=><td key={c.id} className="p-2"><input type="number" min="0" max={c.max_score} step="0.01" disabled={!['draft','reopened'].includes(activeSheet.status)||!canGradeEdit} value={scoreValue(c.id,p.enrollment_id)} onChange={e=>setScores(v=>({...v,[c.id+':'+p.enrollment_id]:e.target.value}))} className="field w-24"/></td>)}<td className="p-2 font-semibold">{complete?weighted.toFixed(2):'—'}</td></tr>})}</tbody></table>{!roster.length&&<p className="py-6 text-center text-sm text-slate-500">Lớp chưa có người học đang theo học.</p>}</div></>}
    {!activeSheet&&<p className="py-6 text-center text-sm text-slate-500">Chưa có sổ điểm cho lớp học phần này.</p>}
   </div>}
  </section>
  {loading&&<p className="text-center text-sm text-slate-500">Đang tải dữ liệu...</p>}
 </div>
}
