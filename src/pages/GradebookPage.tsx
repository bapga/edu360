import { useCallback,useEffect,useMemo,useState,type FormEvent } from 'react'
import { ClipboardList,RefreshCw,Plus,Save,Send,Lock,Unlock,CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePermissions } from '../contexts/PermissionContext'

type Offering={id:string;org_unit_id:string;class_group_id:string;program_subject_id:string;academic_term_id:string;planned_hours:number;status:string}
type RosterRow={enrollment_id:string;student_id:string;student_code:string;full_name:string;enrollment_status:string}
type AttendanceSession={id:string;offering_id:string;session_date:string;period_start:number;period_end:number;topic:string|null;status:string;created_by:string}
type AttendanceRecord={id?:string;session_id:string;enrollment_id:string;attendance_status:string;minutes_late:number|null;note:string|null}
type Gradebook={id:string;offering_id:string;status:string;created_by:string;decision_note:string|null}
type Component={id:string;gradebook_id:string;code:string;name:string;category:string;weight:number;max_score:number;assessment_date:string|null;is_required:boolean;sort_order:number}
type GradeEntry={id?:string;component_id:string;enrollment_id:string;score:number;note:string|null}
const attendanceLabels:Record<string,string>={present:'Có mặt',absent:'Vắng',late:'Đi muộn',excused:'Có phép'}
const gradeStatus:Record<string,string>={draft:'Bản nháp',submitted:'Chờ duyệt',approved:'Đã duyệt',returned:'Yêu cầu sửa',locked:'Đã khóa'}
const categories:Record<string,string>={regular:'Thường xuyên',midterm:'Giữa kỳ',final:'Cuối kỳ',practice:'Thực hành',internship:'Thực tập',other:'Khác'}

export default function GradebookPage(){
 const {can}=usePermissions()
 const [tab,setTab]=useState<'attendance'|'grades'>('attendance')
 const [offerings,setOfferings]=useState<Offering[]>([])
 const [sessions,setSessions]=useState<AttendanceSession[]>([])
 const [records,setRecords]=useState<AttendanceRecord[]>([])
 const [roster,setRoster]=useState<RosterRow[]>([])
 const [gradebooks,setGradebooks]=useState<Gradebook[]>([])
 const [components,setComponents]=useState<Component[]>([])
 const [entries,setEntries]=useState<GradeEntry[]>([])
 const [selectedOffering,setSelectedOffering]=useState('')
 const [selectedSession,setSelectedSession]=useState('')
 const [selectedGradebook,setSelectedGradebook]=useState('')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState<string|null>(null)
 const [notice,setNotice]=useState<string|null>(null)
 const [sessionForm,setSessionForm]=useState({session_date:'',period_start:'1',period_end:'4',topic:''})
 const [componentForm,setComponentForm]=useState({code:'',name:'',category:'regular',weight:'',max_score:'10',assessment_date:'',is_required:true})
 const [scores,setScores]=useState<Record<string,string>>({})
 const canAttendanceCreate=can('teaching','create')
 const canAttendanceEdit=canAttendanceCreate||can('teaching','update')
 const canAttendanceView=can('teaching','view')
 const canAttendanceApprove=can('teaching','approve')
 const canGradeCreate=can('grades','create')
 const canGradeEdit=canGradeCreate||can('grades','update')
 const canGradeApprove=can('grades','approve')
 const activeGradebook=gradebooks.find(g=>g.id===selectedGradebook&&g.offering_id===selectedOffering)
 const totalWeight=useMemo(()=>components.reduce((sum,c)=>sum+Number(c.weight),0),[components])
 const attendanceSession=sessions.find(s=>s.id===selectedSession&&s.offering_id===selectedOffering)
 const offeringLabel=(id:string)=>{const o=offerings.find(x=>x.id===id);return o?'Lớp '+o.class_group_id.slice(0,8)+' · '+o.planned_hours+' giờ':'Lớp học phần'}

 const load=useCallback(async()=>{
  if(!supabase){setError('Chưa cấu hình kết nối Supabase.');setLoading(false);return}
  setLoading(true);setError(null)
  const [o,a,g]=await Promise.all([
   supabase.from('class_subject_offerings').select('id,org_unit_id,class_group_id,program_subject_id,academic_term_id,planned_hours,status').order('created_at',{ascending:false}),
   supabase.from('attendance_sessions').select('id,offering_id,session_date,period_start,period_end,topic,status,created_by').order('session_date',{ascending:false}),
   supabase.from('gradebooks').select('id,offering_id,status,created_by,decision_note').order('created_at',{ascending:false})
  ])
  const failure=o.error??a.error??g.error
  if(failure)setError(failure.message)
  setOfferings((o.data??[]) as Offering[]);setSessions((a.data??[]) as AttendanceSession[]);setGradebooks((g.data??[]) as Gradebook[])
  setSelectedOffering(old=>old||o.data?.[0]?.id||'')
  setSelectedSession(old=>old||a.data?.[0]?.id||'')
  setSelectedGradebook(old=>old||g.data?.[0]?.id||'')
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
  const {data,error:e}=await supabase.from('attendance_records').select('id,session_id,enrollment_id,attendance_status,minutes_late,note').eq('session_id',id)
  if(e){setError(e.message);return}
  setRecords((data??[]) as AttendanceRecord[])
 },[])
 const loadGradebook=useCallback(async(id:string)=>{
  if(!supabase||!id){setComponents([]);setEntries([]);return}
  const c=await supabase.from('grade_components').select('id,gradebook_id,code,name,category,weight,max_score,assessment_date,is_required,sort_order').eq('gradebook_id',id).order('sort_order')
  if(c.error){setError(c.error.message);return}
  setComponents((c.data??[]) as Component[])
  const ids=(c.data??[]).map(x=>x.id)
  if(ids.length){
   const result=await supabase.from('grade_entries').select('id,component_id,enrollment_id,score,note').in('component_id',ids)
   if(result.error)setError(result.error.message)
   setEntries((result.data??[]) as GradeEntry[])
  }else setEntries([])
  setScores({})
 },[])
 useEffect(()=>{if(selectedOffering)void loadRoster(selectedOffering)},[selectedOffering,loadRoster])
 useEffect(()=>{const list=sessions.filter(s=>s.offering_id===selectedOffering);if(!list.some(s=>s.id===selectedSession))setSelectedSession(list[0]?.id??'')},[sessions,selectedOffering,selectedSession])
 useEffect(()=>{const list=gradebooks.filter(g=>g.offering_id===selectedOffering);if(!list.some(g=>g.id===selectedGradebook))setSelectedGradebook(list[0]?.id??'')},[gradebooks,selectedOffering,selectedGradebook])
 useEffect(()=>{if(selectedSession)void loadAttendance(selectedSession)},[selectedSession,loadAttendance])
 useEffect(()=>{if(selectedGradebook)void loadGradebook(selectedGradebook)},[selectedGradebook,loadGradebook])

 async function createSession(e:FormEvent){e.preventDefault();if(!supabase||!selectedOffering)return;setSaving(true);setError(null)
  const {data,error:e1}=await supabase.from('attendance_sessions').insert({offering_id:selectedOffering,session_date:sessionForm.session_date,period_start:Number(sessionForm.period_start),period_end:Number(sessionForm.period_end),topic:sessionForm.topic.trim()||null,status:'draft'}).select('id').single()
  setSaving(false);if(e1){setError(e1.message);return};setSessionForm({session_date:'',period_start:'1',period_end:'4',topic:''});setSelectedSession(data.id);setNotice('Đã tạo buổi học ở trạng thái bản nháp.');await load()
 }
 function updateAttendance(enrollmentId:string,status:string){
  setRecords(old=>{const existing=old.find(r=>r.enrollment_id===enrollmentId);const next:AttendanceRecord={session_id:selectedSession,enrollment_id:enrollmentId,attendance_status:status,minutes_late:status==='late'?(existing?.minutes_late??5):null,note:existing?.note??null};return [...old.filter(r=>r.enrollment_id!==enrollmentId),next]})
 }
 async function saveAttendance(){if(!supabase||!selectedSession)return;setSaving(true);setError(null)
  const payload=roster.map(p=>{const row=records.find(r=>r.enrollment_id===p.enrollment_id);return {session_id:selectedSession,enrollment_id:p.enrollment_id,attendance_status:row?.attendance_status??'present',minutes_late:row?.minutes_late??null,note:row?.note??null}})
  const {error:e}=await supabase.from('attendance_records').upsert(payload,{onConflict:'session_id,enrollment_id'})
  setSaving(false);if(e){setError(e.message);return};setNotice('Đã lưu điểm danh '+payload.length+' người học.');await loadAttendance(selectedSession)
 }
 async function submitAttendance(){if(!supabase||!selectedSession)return;setSaving(true);setError(null);const {error:e}=await supabase.rpc('submit_attendance_session',{p_session_id:selectedSession});setSaving(false);if(e){setError(e.message);return};setNotice('Đã gửi buổi điểm danh chờ duyệt.');await load()}
 async function decideAttendance(approve:boolean){if(!supabase||!selectedSession)return;const note=window.prompt(approve?'Ghi chú phê duyệt (có thể để trống):':'Lý do yêu cầu sửa điểm danh:')??'';if(!approve&&note.trim().length<5)return;setSaving(true);setError(null);const {error:e}=await supabase.rpc('decide_attendance_session',{p_session_id:selectedSession,p_approve:approve,p_note:note});setSaving(false);if(e){setError(e.message);return};setNotice(approve?'Đã duyệt điểm danh.':'Đã trả lại điểm danh.');await load()}

 async function createGradebook(){if(!supabase||!selectedOffering)return;setSaving(true);setError(null);const {data,error:e}=await supabase.from('gradebooks').insert({offering_id:selectedOffering,status:'draft'}).select('id').single();setSaving(false);if(e){setError(e.message);return};setSelectedGradebook(data.id);setNotice('Đã tạo sổ điểm.');await load()}
 async function addComponent(e:FormEvent){e.preventDefault();if(!supabase||!activeGradebook)return;const weight=Number(componentForm.weight);if(totalWeight+weight>100){setError('Tổng trọng số không được vượt quá 100%.');return};setSaving(true);setError(null)
  const {error:e1}=await supabase.from('grade_components').insert({gradebook_id:activeGradebook.id,code:componentForm.code.trim().toUpperCase(),name:componentForm.name.trim(),category:componentForm.category,weight,max_score:Number(componentForm.max_score),assessment_date:componentForm.assessment_date||null,is_required:componentForm.is_required,sort_order:components.length+1})
  setSaving(false);if(e1){setError(e1.message);return};setComponentForm({code:'',name:'',category:'regular',weight:'',max_score:'10',assessment_date:'',is_required:true});setNotice('Đã thêm cột điểm.');await loadGradebook(activeGradebook.id)
 }
 async function saveGrades(){if(!supabase||!activeGradebook)return;setSaving(true);setError(null)
  const payload=Object.entries(scores).filter(([,v])=>v.trim()!=='').map(([key,v])=>{const [component_id,enrollment_id]=key.split(':');return {component_id,enrollment_id,score:Number(v)}})
  if(!payload.length){setSaving(false);setError('Chưa có điểm nào được nhập.');return}
  const {error:e}=await supabase.from('grade_entries').upsert(payload,{onConflict:'component_id,enrollment_id'})
  setSaving(false);if(e){setError(e.message);return};setNotice('Đã lưu '+payload.length+' điểm.');await loadGradebook(activeGradebook.id)
 }
 async function submitGrades(){if(!supabase||!activeGradebook)return;setSaving(true);setError(null);const {error:e}=await supabase.rpc('submit_gradebook',{p_gradebook_id:activeGradebook.id});setSaving(false);if(e){setError(e.message);return};setNotice('Đã gửi sổ điểm chờ phê duyệt.');await load()}
 async function decideGrades(approve:boolean){if(!supabase||!activeGradebook)return;const note=window.prompt(approve?'Ghi chú phê duyệt (có thể để trống):':'Lý do yêu cầu sửa sổ điểm:')??'';if(!approve&&note.trim().length<5)return;setSaving(true);setError(null);const {error:e}=await supabase.rpc('decide_gradebook',{p_gradebook_id:activeGradebook.id,p_approve:approve,p_note:note});setSaving(false);if(e){setError(e.message);return};setNotice(approve?'Đã duyệt sổ điểm.':'Đã trả lại sổ điểm.');await load()}
 async function lockGrades(){if(!supabase||!activeGradebook)return;setSaving(true);setError(null);const {error:e}=await supabase.rpc('lock_gradebook',{p_gradebook_id:activeGradebook.id});setSaving(false);if(e){setError(e.message);return};setNotice('Đã khóa sổ điểm.');await load()}
 async function reopenGrades(){if(!supabase||!activeGradebook)return;const reason=window.prompt('Lý do mở khóa (tối thiểu 10 ký tự):')??'';if(reason.trim().length<10)return;setSaving(true);setError(null);const {error:e}=await supabase.rpc('reopen_gradebook',{p_gradebook_id:activeGradebook.id,p_reason:reason});setSaving(false);if(e){setError(e.message);return};setNotice('Đã mở lại sổ điểm theo phê duyệt.');await load()}

 const attendanceMap=new Map(records.map(r=>[r.enrollment_id,r]))
 const scoreValue=(componentId:string,enrollmentId:string)=>scores[componentId+':'+enrollmentId]??String(entries.find(e=>e.component_id===componentId&&e.enrollment_id===enrollmentId)?.score??'')
 return <div className="space-y-6">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-medium text-brand-700"><ClipboardList size={17}/> Người học</div><h1 className="mt-1 text-2xl font-semibold text-navy-900">Điểm danh & kết quả học tập</h1><p className="mt-1 text-sm text-slate-500">Theo lớp học phần, có quy trình gửi duyệt, phê duyệt và khóa sổ điểm.</p></div><button type="button" onClick={()=>void load()} disabled={loading} className="btn-ghost inline-flex items-center gap-2"><RefreshCw size={16}/> Làm mới</button></header>
  <div className="flex gap-2 border-b border-slate-200">{canAttendanceView&&<button type="button" onClick={()=>setTab('attendance')} className={'px-3 py-2 text-sm '+(tab==='attendance'?'border-b-2 border-brand-600 font-semibold text-brand-700':'text-slate-500')}>Điểm danh</button>}<button type="button" onClick={()=>setTab('grades')} className={'px-3 py-2 text-sm '+(tab==='grades'?'border-b-2 border-brand-600 font-semibold text-brand-700':'text-slate-500')}>Sổ điểm</button></div>
  {error&&<div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}{notice&&<div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
  <section className="card space-y-4 p-4">
   <div className="flex flex-wrap items-center gap-3"><label className="text-sm font-medium">Lớp học phần <select value={selectedOffering} onChange={e=>setSelectedOffering(e.target.value)} className="field mt-1 min-w-64"><option value="">Chọn lớp học phần</option>{offerings.map(o=><option key={o.id} value={o.id}>{offeringLabel(o)}</option>)}</select></label>{tab==='grades'&&canGradeCreate&&selectedOffering&&!gradebooks.some(g=>g.offering_id===selectedOffering)&&<button type="button" onClick={()=>void createGradebook()} disabled={saving} className="btn-primary mt-5"><Plus size={14} className="mr-1 inline"/> Tạo sổ điểm</button>}</div>
   {!offerings.length&&<p className="py-6 text-center text-sm text-slate-500">Chưa có lớp học phần hoặc tài khoản chưa được cấp quyền xem.</p>}
   {tab==='attendance'&&selectedOffering&&<div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><label className="text-sm font-medium">Buổi học<select value={selectedSession} onChange={e=>setSelectedSession(e.target.value)} className="field mt-1 min-w-64"><option value="">Chọn buổi học</option>{sessions.filter(s=>s.offering_id===selectedOffering).map(s=><option key={s.id} value={s.id}>{s.session_date} · tiết {s.period_start}-{s.period_end} · {gradeStatus[s.status]??s.status}</option>)}</select></label>{can('teaching','create')&&<form onSubmit={createSession} className="flex flex-wrap items-end gap-2"><label className="text-xs text-slate-500">Ngày học<input required type="date" value={sessionForm.session_date} onChange={e=>setSessionForm(v=>({...v,session_date:e.target.value}))} className="field mt-1"/></label><label className="text-xs text-slate-500">Tiết bắt đầu<input required type="number" min="1" value={sessionForm.period_start} onChange={e=>setSessionForm(v=>({...v,period_start:e.target.value}))} className="field mt-1 w-24"/></label><label className="text-xs text-slate-500">Tiết kết thúc<input required type="number" min={sessionForm.period_start} value={sessionForm.period_end} onChange={e=>setSessionForm(v=>({...v,period_end:e.target.value}))} className="field mt-1 w-24"/></label><button disabled={saving} className="btn-primary"><Plus size={14} className="mr-1 inline"/> Buổi học</button></form>}</div>
    {attendanceSession&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3"><div className="text-sm"><b>{attendanceSession.session_date}</b> · Tiết {attendanceSession.period_start}-{attendanceSession.period_end} · {gradeStatus[attendanceSession.status]??attendanceSession.status}</div><div className="flex flex-wrap gap-2">{attendanceSession.status==='draft'||attendanceSession.status==='returned'?<><button type="button" onClick={()=>void saveAttendance()} disabled={saving||!roster.length||!canAttendanceEdit} className="btn-ghost"><Save size={14} className="mr-1 inline"/> Lưu điểm danh</button><button type="button" onClick={()=>void submitAttendance()} disabled={saving||!roster.length||!canAttendanceEdit} className="btn-primary"><Send size={14} className="mr-1 inline"/> Gửi duyệt</button></>:null}{attendanceSession.status==='submitted'&&canAttendanceApprove&&<><button type="button" onClick={()=>void decideAttendance(false)} disabled={saving} className="btn-ghost">Trả lại</button><button type="button" onClick={()=>void decideAttendance(true)} disabled={saving} className="btn-primary"><CheckCircle2 size={14} className="mr-1 inline"/> Duyệt</button></>}</div></div>}
    {attendanceSession&&<div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="p-2">Mã người học</th><th className="p-2">Họ và tên</th><th className="p-2">Tình trạng</th></tr></thead><tbody className="divide-y">{roster.map(p=><tr key={p.enrollment_id}><td className="p-2 font-mono">{p.student_code}</td><td className="p-2">{p.full_name}</td><td className="p-2"><select disabled={!['draft','returned'].includes(attendanceSession.status)||!canAttendanceEdit} value={attendanceMap.get(p.enrollment_id)?.attendance_status??'present'} onChange={e=>updateAttendance(p.enrollment_id,e.target.value)} className="field max-w-48">{Object.entries(attendanceLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td></tr>)}</tbody></table>{!roster.length&&<p className="py-6 text-center text-sm text-slate-500">Lớp chưa có người học đang theo học.</p>}</div>}
   </div>}
   {tab==='grades'&&selectedOffering&&<div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="text-sm font-medium">Sổ điểm<select value={selectedGradebook} onChange={e=>setSelectedGradebook(e.target.value)} className="field mt-1 min-w-64"><option value="">Chọn sổ điểm</option>{gradebooks.filter(g=>g.offering_id===selectedOffering).map(g=><option key={g.id} value={g.id}>{gradeStatus[g.status]??g.status}</option>)}</select></label>{activeGradebook&&<div className="flex flex-wrap items-center gap-2 text-sm"><span className="rounded-full bg-slate-100 px-3 py-1">{gradeStatus[activeGradebook.status]??activeGradebook.status}</span>{['draft','returned'].includes(activeGradebook.status)&&canGradeEdit&&<button type="button" onClick={()=>void saveGrades()} disabled={saving||!components.length} className="btn-ghost"><Save size={14} className="mr-1 inline"/> Lưu điểm</button>}{['draft','returned'].includes(activeGradebook.status)&&canGradeEdit&&<button type="button" onClick={()=>void submitGrades()} disabled={saving||!components.length} className="btn-primary"><Send size={14} className="mr-1 inline"/> Gửi duyệt</button>}{activeGradebook.status==='submitted'&&canGradeApprove&&<><button type="button" onClick={()=>void decideGrades(false)} className="btn-ghost">Trả lại</button><button type="button" onClick={()=>void decideGrades(true)} className="btn-primary">Duyệt sổ điểm</button></>}{activeGradebook.status==='approved'&&canGradeApprove&&<button type="button" onClick={()=>void lockGrades()} className="btn-primary"><Lock size={14} className="mr-1 inline"/> Khóa điểm</button>}{activeGradebook.status==='locked'&&canGradeApprove&&<button type="button" onClick={()=>void reopenGrades()} className="btn-ghost"><Unlock size={14} className="mr-1 inline"/> Mở khóa có lý do</button>}</div>}</div>
    {activeGradebook&&<><div className="rounded-lg bg-slate-50 p-3 text-sm">Tổng trọng số: <b>{totalWeight.toFixed(2)}%</b> · Sĩ số đang học: <b>{roster.length}</b></div>{['draft','returned'].includes(activeGradebook.status)&&canGradeCreate&&<form onSubmit={addComponent} className="grid gap-2 md:grid-cols-2 xl:grid-cols-6"><input required value={componentForm.code} onChange={e=>setComponentForm(v=>({...v,code:e.target.value}))} placeholder="Mã cột" className="field"/><input required value={componentForm.name} onChange={e=>setComponentForm(v=>({...v,name:e.target.value}))} placeholder="Tên bài đánh giá" className="field"/><select value={componentForm.category} onChange={e=>setComponentForm(v=>({...v,category:e.target.value}))} className="field">{Object.entries(categories).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><input required type="number" min="0.01" max="100" step="0.01" value={componentForm.weight} onChange={e=>setComponentForm(v=>({...v,weight:e.target.value}))} placeholder="Trọng số %" className="field"/><input required type="number" min="0.01" step="0.01" value={componentForm.max_score} onChange={e=>setComponentForm(v=>({...v,max_score:e.target.value}))} placeholder="Điểm tối đa" className="field"/><button disabled={saving||totalWeight+Number(componentForm.weight)>100} className="btn-primary"><Plus size={14} className="mr-1 inline"/> Thêm cột</button></form>}
     <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="p-2">Mã</th><th className="p-2">Nội dung</th><th className="p-2">Loại</th><th className="p-2">Trọng số</th><th className="p-2">Tối đa</th><th className="p-2">Ngày</th></tr></thead><tbody className="divide-y">{components.map(c=><tr key={c.id}><td className="p-2 font-mono">{c.code}</td><td className="p-2">{c.name}</td><td className="p-2">{categories[c.category]??c.category}</td><td className="p-2">{c.weight}%</td><td className="p-2">{c.max_score}</td><td className="p-2">{c.assessment_date??'—'}</td></tr>)}</tbody></table></div>
     <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="sticky left-0 bg-white p-2">Người học</th>{components.map(c=><th key={c.id} className="min-w-28 p-2">{c.name}<div className="font-normal">{c.weight}%</div></th>)}<th className="p-2">Điểm tổng</th></tr></thead><tbody className="divide-y">{roster.map(p=>{const weighted=components.reduce((sum,c)=>{const raw=scoreValue(c.id,p.enrollment_id);return raw.trim()?sum+(Number(raw)/Number(c.max_score))*Number(c.weight):sum},0);const complete=components.every(c=>scoreValue(c.id,p.enrollment_id).trim()!=='');return <tr key={p.enrollment_id}><td className="sticky left-0 bg-white p-2"><div className="font-medium">{p.full_name}</div><div className="text-xs text-slate-500">{p.student_code}</div></td>{components.map(c=><td key={c.id} className="p-2"><input type="number" min="0" max={c.max_score} step="0.01" disabled={!['draft','returned'].includes(activeGradebook.status)||!canGradeEdit} value={scoreValue(c.id,p.enrollment_id)} onChange={e=>setScores(v=>({...v,[c.id+':'+p.enrollment_id]:e.target.value}))} className="field w-24"/></td>)}<td className="p-2 font-semibold">{complete?weighted.toFixed(2):'—'}</td></tr>})}</tbody></table>{!roster.length&&<p className="py-6 text-center text-sm text-slate-500">Lớp chưa có người học đang theo học.</p>}</div></>}
    {!activeGradebook&&<p className="py-6 text-center text-sm text-slate-500">Chưa có sổ điểm cho lớp học phần này.</p>}
   </div>}
  </section>
  {loading&&<p className="text-center text-sm text-slate-500">Đang tải dữ liệu...</p>}
 </div>
}
