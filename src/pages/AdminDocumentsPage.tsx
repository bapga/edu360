import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react'
import {FileText,RefreshCw,Plus,Send,CheckCircle2,Archive} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {usePermissions} from '../contexts/PermissionContext'

type Unit={id:string;code:string;name:string}
type Doc={id:string;org_unit_id:string;document_no:string;document_type:string;subject:string;sender:string|null;recipient:string|null;issued_date:string|null;received_date:string|null;effective_date:string|null;confidentiality:string;summary:string|null;file_reference:string|null;status:string;created_by:string}
type Event={id:string;event_type:string;from_status:string|null;to_status:string|null;note:string|null;created_at:string}
const labels:Record<string,string>={draft:'Bản nháp',submitted:'Chờ duyệt',approved:'Đã duyệt',returned:'Yêu cầu sửa',issued:'Đã ban hành',archived:'Lưu trữ'}
const types:Record<string,string>={incoming:'Văn bản đến',outgoing:'Văn bản đi',internal:'Văn bản nội bộ'}
const privacy:Record<string,string>={public:'Công khai',internal:'Nội bộ',confidential:'Mật'}

export default function AdminDocumentsPage(){
 const {can}=usePermissions()
 const [units,setUnits]=useState<Unit[]>([])
 const [docs,setDocs]=useState<Doc[]>([])
 const [events,setEvents]=useState<Event[]>([])
 const [selectedId,setSelectedId]=useState('')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState<string|null>(null)
 const [notice,setNotice]=useState<string|null>(null)
 const [form,setForm]=useState({org_unit_id:'',document_no:'',document_type:'incoming',subject:'',sender:'',recipient:'',issued_date:'',received_date:new Date().toISOString().slice(0,10),effective_date:'',confidentiality:'internal',summary:'',file_reference:''})
 const selected=docs.find(d=>d.id===selectedId)
 const canCreate=can('admin_docs','create'),canApprove=can('admin_docs','approve')
 const selectedEvents=useMemo(()=>events.filter(e=>e.id&&selectedId),[events,selectedId])
 const load=useCallback(async()=>{
  if(!supabase){setError('Chưa cấu hình Supabase.');setLoading(false);return}
  setLoading(true);setError(null)
  const [u,d]=await Promise.all([
   supabase.from('org_units').select('id,code,name').eq('is_active',true).is('deleted_at',null).order('sort_order'),
   supabase.from('admin_documents').select('id,org_unit_id,document_no,document_type,subject,sender,recipient,issued_date,received_date,effective_date,confidentiality,summary,file_reference,status,created_by').order('created_at',{ascending:false})
  ])
  const failure=u.error??d.error;if(failure)setError(failure.message)
  setUnits((u.data??[]) as Unit[]);setDocs((d.data??[]) as Doc[])
  setSelectedId(old=>old||d.data?.[0]?.id||'')
  setLoading(false)
 },[])
 useEffect(()=>{void load()},[load])
 useEffect(()=>{if(!supabase||!selectedId){setEvents([]);return}void supabase.from('document_events').select('id,event_type,from_status,to_status,note,created_at').eq('document_id',selectedId).order('created_at',{ascending:false}).then(({data,error:e})=>{if(e)setError(e.message);setEvents((data??[]) as Event[])})},[selectedId])
 async function createDoc(e:FormEvent){e.preventDefault();if(!supabase)return;setSaving(true);setError(null)
  const {data,error:e1}=await supabase.from('admin_documents').insert({...form,document_no:form.document_no.trim(),subject:form.subject.trim(),sender:form.sender.trim()||null,recipient:form.recipient.trim()||null,issued_date:form.issued_date||null,received_date:form.received_date||null,effective_date:form.effective_date||null,summary:form.summary.trim()||null,file_reference:form.file_reference.trim()||null,status:'draft'}).select('id').single()
  setSaving(false);if(e1){setError(e1.message);return};setSelectedId(data.id);setNotice('Đã tạo văn bản nháp.');setForm({org_unit_id:'',document_no:'',document_type:'incoming',subject:'',sender:'',recipient:'',issued_date:'',received_date:new Date().toISOString().slice(0,10),effective_date:'',confidentiality:'internal',summary:'',file_reference:''});await load()
 }
 async function action(name:string,args:Record<string,unknown>,success:string){if(!supabase)return;setSaving(true);setError(null);const {error:e}=await supabase.rpc(name,args);setSaving(false);if(e){setError(e.message);return};setNotice(success);await load()}
 async function submit(){if(!selected)return;await action('submit_admin_document',{p_document_id:selected.id},'Đã gửi văn bản chờ duyệt.')}
 async function decide(approve:boolean){if(!selected)return;const note=window.prompt(approve?'Căn cứ phê duyệt (tối thiểu 5 ký tự):':'Lý do trả lại (tối thiểu 5 ký tự):')??'';if(note.trim().length<5)return;await action('decide_admin_document',{p_document_id:selected.id,p_approve:approve,p_note:note},approve?'Đã phê duyệt văn bản.':'Đã trả lại văn bản.')}
 async function issue(){if(!selected)return;const ref=window.prompt('Số/ký hiệu hoặc đường dẫn file văn bản đã ký (nếu có):')??'';await action('issue_admin_document',{p_document_id:selected.id,p_issue_reference:ref},'Đã ban hành văn bản.')}
 async function archive(){if(!selected)return;const reason=window.prompt('Lý do lưu trữ:')??'';if(reason.trim().length<5)return;await action('archive_admin_document',{p_document_id:selected.id,p_reason:reason},'Đã chuyển văn bản vào lưu trữ.')}
 return <div className="space-y-6">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-medium text-brand-700"><FileText size={17}/> Hành chính</div><h1 className="mt-1 text-2xl font-semibold text-navy-900">Văn bản & hồ sơ hành chính</h1><p className="mt-1 text-sm text-slate-500">Văn bản đến, văn bản đi, văn bản nội bộ và quy trình trình duyệt/ban hành.</p></div><button type="button" onClick={()=>void load()} className="btn-ghost inline-flex items-center gap-2"><RefreshCw size={16}/> Làm mới</button></header>
  {error&&<div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}{notice&&<div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
  {canCreate&&<section className="card space-y-3 p-4"><h2 className="font-semibold">Tạo văn bản</h2><form onSubmit={createDoc} className="grid gap-2 md:grid-cols-2 xl:grid-cols-4"><select required value={form.org_unit_id} onChange={e=>setForm(v=>({...v,org_unit_id:e.target.value}))} className="field"><option value="">Đơn vị quản lý</option>{units.map(u=><option key={u.id} value={u.id}>{u.code} · {u.name}</option>)}</select><input required value={form.document_no} onChange={e=>setForm(v=>({...v,document_no:e.target.value}))} placeholder="Số/ký hiệu văn bản" className="field"/><select value={form.document_type} onChange={e=>setForm(v=>({...v,document_type:e.target.value}))} className="field">{Object.entries(types).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select value={form.confidentiality} onChange={e=>setForm(v=>({...v,confidentiality:e.target.value}))} className="field">{Object.entries(privacy).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><input required value={form.subject} onChange={e=>setForm(v=>({...v,subject:e.target.value}))} placeholder="Trích yếu / tiêu đề" className="field md:col-span-2"/><input value={form.sender} onChange={e=>setForm(v=>({...v,sender:e.target.value}))} placeholder="Nơi gửi" className="field"/><input value={form.recipient} onChange={e=>setForm(v=>({...v,recipient:e.target.value}))} placeholder="Nơi nhận" className="field"/><label className="text-xs text-slate-500">Ngày ban hành<input type="date" value={form.issued_date} onChange={e=>setForm(v=>({...v,issued_date:e.target.value}))} className="field mt-1"/></label><label className="text-xs text-slate-500">Ngày tiếp nhận<input type="date" value={form.received_date} onChange={e=>setForm(v=>({...v,received_date:e.target.value}))} className="field mt-1"/></label><label className="text-xs text-slate-500">Ngày hiệu lực<input type="date" value={form.effective_date} onChange={e=>setForm(v=>({...v,effective_date:e.target.value}))} className="field mt-1"/></label><input value={form.file_reference} onChange={e=>setForm(v=>({...v,file_reference:e.target.value}))} placeholder="Mã hồ sơ / tham chiếu file" className="field"/><textarea value={form.summary} onChange={e=>setForm(v=>({...v,summary:e.target.value}))} placeholder="Nội dung tóm tắt" className="field md:col-span-2 xl:col-span-3"/><button disabled={saving} className="btn-primary"><Plus size={14} className="mr-1 inline"/> Lưu bản nháp</button></form></section>}
  <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]"><div className="card overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="p-2">Số/ký hiệu</th><th className="p-2">Trích yếu</th><th className="p-2">Loại</th><th className="p-2">Ngày nhận</th><th className="p-2">Trạng thái</th></tr></thead><tbody className="divide-y">{docs.map(d=><tr key={d.id} onClick={()=>setSelectedId(d.id)} className={'cursor-pointer '+(selectedId===d.id?'bg-brand-50':'')}><td className="p-2">{d.document_no}</td><td className="p-2">{d.subject}</td><td className="p-2">{types[d.document_type]??d.document_type}</td><td className="p-2">{d.received_date??'—'}</td><td className="p-2">{labels[d.status]??d.status}</td></tr>)}</tbody></table>{!docs.length&&<p className="p-6 text-center text-sm text-slate-500">Chưa có văn bản.</p>}</div>
   {selected&&<div className="card space-y-3 p-4"><div><div className="text-xs text-slate-500">{unitName(selected.org_unit_id)} · {privacy[selected.confidentiality]}</div><h2 className="mt-1 font-semibold">{selected.document_no}</h2><p className="text-sm">{selected.subject}</p><p className="mt-1 text-sm text-slate-500">{types[selected.document_type]} · {labels[selected.status]}</p></div><div className="text-sm text-slate-600">Nơi gửi: {selected.sender??'—'} · Nơi nhận: {selected.recipient??'—'}</div>{selected.summary&&<p className="text-sm">{selected.summary}</p>}{selected.file_reference&&<p className="break-all text-xs text-slate-500">Tham chiếu: {selected.file_reference}</p>}<div className="flex flex-wrap gap-2">{['draft','returned'].includes(selected.status)&&<button type="button" onClick={()=>void submit()} disabled={saving} className="btn-primary"><Send size={14} className="mr-1 inline"/> Gửi duyệt</button>}{selected.status==='submitted'&&canApprove&&<><button type="button" onClick={()=>void decide(false)} disabled={saving} className="btn-ghost">Trả lại</button><button type="button" onClick={()=>void decide(true)} disabled={saving} className="btn-primary"><CheckCircle2 size={14} className="mr-1 inline"/> Duyệt</button></>}{selected.status==='approved'&&canApprove&&<button type="button" onClick={()=>void issue()} disabled={saving} className="btn-primary">Ban hành</button>}{selected.status==='issued'&&canApprove&&<button type="button" onClick={()=>void archive()} disabled={saving} className="btn-ghost"><Archive size={14} className="mr-1 inline"/> Lưu trữ</button>}</div><div className="border-t pt-3"><h3 className="text-sm font-semibold">Lịch sử xử lý</h3>{events.map(e=><div key={e.id} className="mt-2 border-l-2 border-slate-200 pl-3 text-xs"><b>{e.event_type}</b> · {e.from_status??'—'} → {e.to_status??'—'}<div className="text-slate-500">{new Date(e.created_at).toLocaleString('vi-VN')} {e.note??''}</div></div>)}</div></div>}
  </section>
  {loading&&<p className="text-center text-sm text-slate-500">Đang tải dữ liệu...</p>}
 </div>
}
