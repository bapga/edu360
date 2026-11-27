import {useCallback,useEffect,useState,type FormEvent} from 'react'
import {ClipboardList,RefreshCw,Plus,UserPlus,Send,Play,CheckCircle2,Flag} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {usePermissions} from '../contexts/PermissionContext'

type Unit={id:string;code:string;name:string}
type Task={id:string;org_unit_id:string;task_no:string;title:string;description:string|null;category:string|null;priority:string;status:string;start_date:string|null;due_date:string|null;created_by:string;decision_note:string|null}
type Staff={staff_id:string;staff_code:string;full_name:string}
type Assignment={id:string;work_item_id:string;staff_id:string;assignment_role:string;status:string;assigned_at:string}
type Update={id:string;work_item_id:string;progress_percent:number;update_text:string;blocker:string|null;created_by:string;created_at:string}
type Event={id:string;work_item_id:string;event_type:string;from_status:string|null;to_status:string|null;note:string|null;created_at:string}
const statusLabel:Record<string,string>={draft:'Bản nháp',submitted:'Chờ duyệt',approved:'Đã duyệt',returned:'Yêu cầu sửa',in_progress:'Đang thực hiện',blocked:'Đang vướng',completion_requested:'Chờ nghiệm thu',completed:'Hoàn thành',cancelled:'Đã hủy'}
const priorityLabel:Record<string,string>={low:'Thấp',normal:'Bình thường',high:'Cao',urgent:'Khẩn'}
const roleLabel:Record<string,string>={owner:'Chủ trì',contributor:'Phối hợp',reviewer:'Theo dõi'}

export default function TasksPage(){
 const {can}=usePermissions()
 const [units,setUnits]=useState<Unit[]>([])
 const [tasks,setTasks]=useState<Task[]>([])
 const [staff,setStaff]=useState<Staff[]>([])
 const [assignments,setAssignments]=useState<Assignment[]>([])
 const [updates,setUpdates]=useState<Update[]>([])
 const [events,setEvents]=useState<Event[]>([])
 const [selectedId,setSelectedId]=useState('')
 const [staffUnit,setStaffUnit]=useState('')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState<string|null>(null)
 const [notice,setNotice]=useState<string|null>(null)
 const [form,setForm]=useState({org_unit_id:'',task_no:'',title:'',description:'',category:'',priority:'normal',start_date:'',due_date:''})
 const [assignForm,setAssignForm]=useState({staff_id:'',assignment_role:'owner'})
 const [updateForm,setUpdateForm]=useState({progress_percent:'10',update_text:'',blocker:''})
 const selected=tasks.find(t=>t.id===selectedId)
 const canCreate=can('tasks','create'),canUpdate=can('tasks','update'),canApprove=can('tasks','approve')
 const selectedAssignments=assignments.filter(a=>a.work_item_id===selectedId)
 const selectedUpdates=updates.filter(u=>u.work_item_id===selectedId)
 const selectedEvents=events.filter(e=>e.work_item_id===selectedId)

 const load=useCallback(async()=>{
  if(!supabase){setError('Chưa cấu hình Supabase.');setLoading(false);return}
  setLoading(true);setError(null)
  const [u,t,a,w,e]=await Promise.all([
   supabase.from('org_units').select('id,code,name').eq('is_active',true).is('deleted_at',null).order('sort_order'),
   supabase.from('work_items').select('id,org_unit_id,task_no,title,description,category,priority,status,start_date,due_date,created_by,decision_note').order('created_at',{ascending:false}),
   supabase.from('work_assignments').select('id,work_item_id,staff_id,assignment_role,status,assigned_at').order('assigned_at',{ascending:false}),
   supabase.from('work_updates').select('id,work_item_id,progress_percent,update_text,blocker,created_by,created_at').order('created_at',{ascending:false}),
   supabase.from('work_events').select('id,work_item_id,event_type,from_status,to_status,note,created_at').order('created_at',{ascending:false})
  ])
  const failure=u.error??t.error??a.error??w.error??e.error;if(failure)setError(failure.message)
  setUnits((u.data??[]) as Unit[]);setTasks((t.data??[]) as Task[]);setAssignments((a.data??[]) as Assignment[]);setUpdates((w.data??[]) as Update[]);setEvents((e.data??[]) as Event[])
  setSelectedId(old=>old||t.data?.[0]?.id||'')
  setLoading(false)
 },[])
 useEffect(()=>{void load()},[load])
 useEffect(()=>{if(selected?.org_unit_id)setStaffUnit(selected.org_unit_id)},[selected?.org_unit_id])
 useEffect(()=>{if(!supabase||!staffUnit){setStaff([]);return}void supabase.rpc('get_task_staff_lookup',{p_org_unit_id:staffUnit}).then(({data,error:e})=>{if(e)setError(e.message);setStaff((data??[]) as Staff[])})},[staffUnit])
 const unitName=(id:string)=>units.find(u=>u.id===id)?.name??'Đơn vị'
 const staffName=(id:string)=>{const s=staff.find(x=>x.staff_id===id);return s?s.staff_code+' · '+s.full_name:'Nhân sự'}

 async function createTask(e:FormEvent){e.preventDefault();if(!supabase)return;setSaving(true);setError(null)
  const {data,error:e1}=await supabase.from('work_items').insert({...form,task_no:form.task_no.trim(),title:form.title.trim(),description:form.description.trim()||null,category:form.category.trim()||null,start_date:form.start_date||null,due_date:form.due_date||null,status:'draft'}).select('id').single()
  setSaving(false);if(e1){setError(e1.message);return};setSelectedId(data.id);setStaffUnit(form.org_unit_id);setNotice('Đã tạo công việc nháp.');setForm({org_unit_id:'',task_no:'',title:'',description:'',category:'',priority:'normal',start_date:'',due_date:''});await load()
 }
 async function runAction(name:string,args:Record<string,unknown>,message:string){if(!supabase)return;setSaving(true);setError(null);const {error:e}=await supabase.rpc(name,args);setSaving(false);if(e){setError(e.message);return};setNotice(message);await load()}
 async function assign(){if(!selected)return;await runAction('assign_work_item',{p_work_item_id:selected.id,p_staff_id:assignForm.staff_id,p_role:assignForm.assignment_role},'Đã phân công công việc.')}
 async function submit(){if(!selected)return;await runAction('submit_work_item',{p_work_item_id:selected.id},'Đã gửi công việc chờ duyệt.')}
 async function decide(approve:boolean){if(!selected)return;const note=window.prompt(approve?'Căn cứ phê duyệt (tối thiểu 5 ký tự):':'Lý do trả lại (tối thiểu 5 ký tự):')??'';if(note.trim().length<5)return;await runAction('decide_work_item',{p_work_item_id:selected.id,p_approve:approve,p_note:note},approve?'Đã duyệt công việc.':'Đã trả lại công việc.')}
 async function start(){if(!selected)return;await runAction('start_work_item',{p_work_item_id:selected.id},'Đã chuyển công việc sang đang thực hiện.')}
 async function addUpdate(e:FormEvent){e.preventDefault();if(!selected)return;await runAction('add_work_update',{p_work_item_id:selected.id,p_progress:Number(updateForm.progress_percent),p_text:updateForm.update_text,p_blocker:updateForm.blocker},'Đã cập nhật tiến độ.');setUpdateForm({progress_percent:'10',update_text:'',blocker:''})}
 async function requestCompletion(){if(!selected)return;const note=window.prompt('Ghi chú đề nghị nghiệm thu/hoàn thành:')??'';if(note.trim().length<5)return;await runAction('request_work_completion',{p_work_item_id:selected.id,p_note:note},'Đã gửi đề nghị hoàn thành chờ duyệt.')}
 async function decideCompletion(approve:boolean){if(!selected)return;const note=window.prompt(approve?'Ghi chú nghiệm thu (tối thiểu 5 ký tự):':'Lý do chưa nghiệm thu (tối thiểu 5 ký tự):')??'';if(note.trim().length<5)return;await runAction('decide_work_completion',{p_work_item_id:selected.id,p_approve:approve,p_note:note},approve?'Đã xác nhận hoàn thành.':'Đã trả lại công việc để tiếp tục xử lý.')}

 return <div className="space-y-6">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-medium text-brand-700"><ClipboardList size={17}/> Điều hành</div><h1 className="mt-1 text-2xl font-semibold text-navy-900">Công việc & tiến độ</h1><p className="mt-1 text-sm text-slate-500">Giao việc, phân công, cập nhật tiến độ, gửi nghiệm thu và phê duyệt hoàn thành.</p></div><button type="button" onClick={()=>void load()} className="btn-ghost inline-flex items-center gap-2"><RefreshCw size={16}/> Làm mới</button></header>
  {error&&<div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}{notice&&<div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
  {canCreate&&<section className="card space-y-3 p-4"><h2 className="font-semibold">Tạo công việc</h2><form onSubmit={createTask} className="grid gap-2 md:grid-cols-2 xl:grid-cols-4"><select required value={form.org_unit_id} onChange={e=>setForm(v=>({...v,org_unit_id:e.target.value}))} className="field"><option value="">Đơn vị chủ trì</option>{units.map(u=><option key={u.id} value={u.id}>{u.code} · {u.name}</option>)}</select><input required value={form.task_no} onChange={e=>setForm(v=>({...v,task_no:e.target.value}))} placeholder="Mã công việc" className="field"/><input required value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))} placeholder="Tên công việc" className="field md:col-span-2"/><input value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))} placeholder="Nhóm công việc" className="field"/><select value={form.priority} onChange={e=>setForm(v=>({...v,priority:e.target.value}))} className="field">{Object.entries(priorityLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><input type="date" value={form.start_date} onChange={e=>setForm(v=>({...v,start_date:e.target.value}))} className="field"/><input type="date" value={form.due_date} onChange={e=>setForm(v=>({...v,due_date:e.target.value}))} className="field"/><textarea value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))} placeholder="Mô tả, kết quả cần đạt" className="field md:col-span-3"/><button disabled={saving} className="btn-primary"><Plus size={14} className="mr-1 inline"/> Lưu bản nháp</button></form></section>}
  <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]"><div className="card overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="p-2">Mã</th><th className="p-2">Công việc</th><th className="p-2">Đơn vị</th><th className="p-2">Hạn</th><th className="p-2">Ưu tiên</th><th className="p-2">Trạng thái</th></tr></thead><tbody className="divide-y">{tasks.map(t=><tr key={t.id} onClick={()=>{setSelectedId(t.id);setStaffUnit(t.org_unit_id)}} className={'cursor-pointer '+(selectedId===t.id?'bg-brand-50':'')}><td className="p-2">{t.task_no}</td><td className="p-2">{t.title}</td><td className="p-2">{unitName(t.org_unit_id)}</td><td className="p-2">{t.due_date??'—'}</td><td className="p-2">{priorityLabel[t.priority]??t.priority}</td><td className="p-2">{statusLabel[t.status]??t.status}</td></tr>)}</tbody></table>{!tasks.length&&<p className="p-6 text-center text-sm text-slate-500">Chưa có công việc.</p>}</div>
   {selected&&<div className="card space-y-3 p-4"><div><div className="text-xs text-slate-500">{unitName(selected.org_unit_id)} · {priorityLabel[selected.priority]}</div><h2 className="mt-1 font-semibold">{selected.task_no} · {selected.title}</h2><p className="text-sm text-slate-500">{statusLabel[selected.status]}</p>{selected.description&&<p className="mt-2 text-sm">{selected.description}</p>}{selected.due_date&&<p className="text-xs text-slate-500">Hạn hoàn thành: {selected.due_date}</p>}</div>
    <div className="flex flex-wrap gap-2">{['draft','returned'].includes(selected.status)&&<><button type="button" onClick={()=>void submit()} disabled={saving||!selectedAssignments.some(a=>a.assignment_role==='owner'&&a.status==='active')} className="btn-primary"><Send size={14} className="mr-1 inline"/> Gửi duyệt</button></>}{selected.status==='submitted'&&canApprove&&<><button type="button" onClick={()=>void decide(false)} disabled={saving} className="btn-ghost">Trả lại</button><button type="button" onClick={()=>void decide(true)} disabled={saving} className="btn-primary"><CheckCircle2 size={14} className="mr-1 inline"/> Duyệt</button></>}{selected.status==='approved'&&<button type="button" onClick={()=>void start()} disabled={saving} className="btn-primary"><Play size={14} className="mr-1 inline"/> Bắt đầu</button>}{['in_progress','blocked'].includes(selected.status)&&<button type="button" onClick={()=>void requestCompletion()} disabled={saving} className="btn-primary"><Flag size={14} className="mr-1 inline"/> Gửi nghiệm thu</button>}{selected.status==='completion_requested'&&canApprove&&<><button type="button" onClick={()=>void decideCompletion(false)} disabled={saving} className="btn-ghost">Trả lại</button><button type="button" onClick={()=>void decideCompletion(true)} disabled={saving} className="btn-primary">Xác nhận hoàn thành</button></>}</div>
    {canUpdate&&<div className="space-y-2 border-t pt-3"><h3 className="text-sm font-semibold">Phân công</h3><div className="flex flex-wrap gap-2"><select value={staffUnit===selected.org_unit_id?assignForm.staff_id:''} onChange={e=>setAssignForm(v=>({...v,staff_id:e.target.value}))} className="field min-w-0 flex-1"><option value="">Chọn nhân sự</option>{staff.map(s=><option key={s.staff_id} value={s.staff_id}>{s.staff_code} · {s.full_name}</option>)}</select><select value={assignForm.assignment_role} onChange={e=>setAssignForm(v=>({...v,assignment_role:e.target.value}))} className="field w-32">{Object.entries(roleLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><button type="button" onClick={()=>void assign()} disabled={saving||!assignForm.staff_id} className="btn-ghost"><UserPlus size={14} className="mr-1 inline"/> Giao</button></div><div className="text-xs text-slate-500">{selectedAssignments.map(a=>staff.find(s=>s.staff_id===a.staff_id)?.full_name??a.staff_id).join(', ')||'Chưa phân công'}</div></div>}
    {['in_progress','blocked'].includes(selected.status)&&<form onSubmit={addUpdate} className="space-y-2 border-t pt-3"><h3 className="text-sm font-semibold">Cập nhật tiến độ</h3><div className="flex gap-2"><input required type="number" min="0" max="100" value={updateForm.progress_percent} onChange={e=>setUpdateForm(v=>({...v,progress_percent:e.target.value}))} className="field w-24"/><input required value={updateForm.update_text} onChange={e=>setUpdateForm(v=>({...v,update_text:e.target.value}))} placeholder="Kết quả đã thực hiện" className="field min-w-0 flex-1"/></div><input value={updateForm.blocker} onChange={e=>setUpdateForm(v=>({...v,blocker:e.target.value}))} placeholder="Khó khăn/vướng mắc (nếu có)" className="field"/><button disabled={saving} className="btn-primary">Ghi nhận tiến độ</button></form>}
    <div className="border-t pt-3"><h3 className="text-sm font-semibold">Cập nhật gần đây</h3>{selectedUpdates.map(u=><div key={u.id} className="mt-2 rounded-lg bg-slate-50 p-2 text-sm"><div className="flex justify-between"><b>{u.progress_percent}%</b><span className="text-xs text-slate-500">{new Date(u.created_at).toLocaleString('vi-VN')}</span></div><p>{u.update_text}</p>{u.blocker&&<p className="text-xs text-amber-700">Vướng mắc: {u.blocker}</p>}</div>)}</div>
    <div className="border-t pt-3"><h3 className="text-sm font-semibold">Lịch sử</h3>{selectedEvents.map(e=><div key={e.id} className="mt-2 border-l-2 border-slate-200 pl-3 text-xs"><b>{e.event_type}</b> · {e.from_status??'—'} → {e.to_status??'—'}<div className="text-slate-500">{new Date(e.created_at).toLocaleString('vi-VN')} {e.note??''}</div></div>)}</div>
   </div>}
  </section>
  {loading&&<p className="text-center text-sm text-slate-500">Đang tải dữ liệu...</p>}
 </div>
}
