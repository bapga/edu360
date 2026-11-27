import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { FileText, Plus, RefreshCw, Send, CheckCircle2, Archive, FileCheck2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePermissions } from '../contexts/PermissionContext'

type Unit = { id: string; code: string; name: string }
type Doc = { id: string; org_unit_id: string; document_no: string; document_type: string; subject: string; sender: string | null; recipient: string | null; issued_date: string | null; received_date: string | null; effective_date: string | null; confidentiality: string; summary: string | null; file_reference: string | null; status: string; created_at: string; created_by: string }
const labels: Record<string,string> = { draft:'Bản nháp', submitted:'Chờ duyệt', returned:'Yêu cầu chỉnh sửa', approved:'Đã duyệt', issued:'Đã ban hành', archived:'Đã lưu trữ' }
const types = [{value:'incoming',label:'Văn bản đến'},{value:'outgoing',label:'Văn bản đi'},{value:'internal',label:'Văn bản nội bộ'},{value:'decision',label:'Quyết định'},{value:'plan',label:'Kế hoạch'},{value:'report',label:'Báo cáo'},{value:'other',label:'Khác'}]

export default function AdminDocsPage() {
 const { can } = usePermissions()
 const [rows,setRows] = useState<Doc[]>([])
 const [units,setUnits] = useState<Unit[]>([])
 const [loading,setLoading] = useState(true)
 const [saving,setSaving] = useState(false)
 const [error,setError] = useState<string|null>(null)
 const [notice,setNotice] = useState<string|null>(null)
 const [showForm,setShowForm] = useState(false)
 const [form,setForm] = useState({org_unit_id:'',document_no:'',document_type:'incoming',subject:'',sender:'',recipient:'',issued_date:'',received_date:'',effective_date:'',confidentiality:'internal',summary:'',file_reference:''})
 const canCreate=can('admin_docs','create'), canUpdate=can('admin_docs','update'), canApprove=can('admin_docs','approve')
 const load=useCallback(async()=>{
  if(!supabase){setError('Chưa cấu hình Supabase.');setLoading(false);return}
  setLoading(true);setError(null)
  const [d,u]=await Promise.all([
   supabase.from('admin_documents').select('id,org_unit_id,document_no,document_type,subject,sender,recipient,issued_date,received_date,effective_date,confidentiality,summary,file_reference,status,created_at,created_by').order('created_at',{ascending:false}).limit(200),
   supabase.from('org_units').select('id,code,name').eq('is_active',true).is('deleted_at',null).order('sort_order')
  ])
  if(d.error)setError(d.error.message);else setRows((d.data??[]) as Doc[])
  if(u.error)setError(u.error.message);else setUnits((u.data??[]) as Unit[])
  setLoading(false)
 },[])
 useEffect(()=>{void load()},[load])
 async function create(e:FormEvent){e.preventDefault();if(!supabase)return
  if(!form.org_unit_id||!form.document_no.trim()||!form.subject.trim()){setError('Cần chọn đơn vị, nhập số/ký hiệu và trích yếu.');return}
  setSaving(true);setError(null);setNotice(null)
  const payload={...form,document_no:form.document_no.trim(),subject:form.subject.trim(),sender:form.sender.trim()||null,recipient:form.recipient.trim()||null,issued_date:form.issued_date||null,received_date:form.received_date||null,effective_date:form.effective_date||null,summary:form.summary.trim()||null,file_reference:form.file_reference.trim()||null}
  const {error:e1}=await supabase.from('admin_documents').insert(payload)
  setSaving(false);if(e1){setError(e1.message);return}
  setNotice('Đã tạo hồ sơ văn bản ở trạng thái bản nháp.');setShowForm(false)
  setForm({org_unit_id:'',document_no:'',document_type:'incoming',subject:'',sender:'',recipient:'',issued_date:'',received_date:'',effective_date:'',confidentiality:'internal',summary:'',file_reference:''});await load()
 }
 async function act(fn:string,args:Record<string,unknown>,success:string){
  if(!supabase)return;setSaving(true);setError(null);setNotice(null)
  const {error:e1}=await supabase.rpc(fn,args);setSaving(false)
  if(e1){setError(e1.message);return};setNotice(success);await load()
 }
 const decide=(id:string,approve:boolean)=>{const note=window.prompt(approve?'Ý kiến phê duyệt (tối thiểu 5 ký tự):':'Lý do trả lại (tối thiểu 5 ký tự):')??'';if(note.trim().length<5)return;void act('decide_admin_document',{p_document_id:id,p_approve:approve,p_note:note.trim()},approve?'Đã phê duyệt văn bản.':'Đã trả văn bản để chỉnh sửa.')}
 const issue=(id:string)=>{const ref=window.prompt('Số ban hành / thông tin phát hành:')??'';if(!ref.trim())return;void act('issue_admin_document',{p_document_id:id,p_issue_reference:ref.trim()},'Đã ghi nhận ban hành văn bản.')}
 const archive=(id:string)=>{const reason=window.prompt('Lý do lưu trữ (tối thiểu 5 ký tự):')??'';if(reason.trim().length<5)return;void act('archive_admin_document',{p_document_id:id,p_reason:reason.trim()},'Đã lưu trữ văn bản.')}
 const unit=(id:string)=>units.find(x=>x.id===id)?.name??'Đơn vị'
 return <div className="space-y-6">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-medium text-brand-700"><FileText size={17}/> Văn thư - Hành chính</div><h1 className="mt-1 text-2xl font-semibold text-navy-900">Quản lý văn bản</h1><p className="mt-1 text-sm text-slate-500">Theo dõi văn bản đến, văn bản đi, trình duyệt, ban hành và lưu trữ.</p></div><div className="flex gap-2"><button className="btn-ghost inline-flex items-center gap-2" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Làm mới</button>{canCreate&&<button className="btn-primary inline-flex items-center gap-2" onClick={()=>setShowForm(v=>!v)}><Plus size={16}/> Tạo văn bản</button>}</div></header>
  <div className="grid gap-3 sm:grid-cols-3"><div className="card p-4"><div className="text-sm text-slate-500">Tổng hồ sơ</div><div className="mt-1 text-2xl font-semibold">{rows.length}</div></div><div className="card p-4"><div className="text-sm text-slate-500">Chờ duyệt</div><div className="mt-1 text-2xl font-semibold">{rows.filter(x=>x.status==='submitted').length}</div></div><div className="card p-4"><div className="text-sm text-slate-500">Đã ban hành</div><div className="mt-1 text-2xl font-semibold">{rows.filter(x=>x.status==='issued').length}</div></div></div>
  {showForm&&<form onSubmit={create} className="card space-y-4 p-5"><h2 className="font-semibold">Tạo hồ sơ văn bản</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
   <label className="text-sm">Đơn vị quản lý<select required className="input mt-1 w-full" value={form.org_unit_id} onChange={e=>setForm({...form,org_unit_id:e.target.value})}><option value="">Chọn đơn vị</option>{units.map(x=><option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></label>
   <label className="text-sm">Loại văn bản<select className="input mt-1 w-full" value={form.document_type} onChange={e=>setForm({...form,document_type:e.target.value})}>{types.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
   <label className="text-sm">Số / ký hiệu<input required className="input mt-1 w-full" value={form.document_no} onChange={e=>setForm({...form,document_no:e.target.value})}/></label>
   <label className="text-sm sm:col-span-2">Trích yếu<input required className="input mt-1 w-full" value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/></label>
   <label className="text-sm">Mức độ bảo mật<select className="input mt-1 w-full" value={form.confidentiality} onChange={e=>setForm({...form,confidentiality:e.target.value})}><option value="internal">Nội bộ</option><option value="public">Công khai</option><option value="confidential">Mật</option><option value="restricted">Hạn chế</option></select></label>
   <label className="text-sm">Cơ quan gửi<input className="input mt-1 w-full" value={form.sender} onChange={e=>setForm({...form,sender:e.target.value})}/></label><label className="text-sm">Nơi nhận<input className="input mt-1 w-full" value={form.recipient} onChange={e=>setForm({...form,recipient:e.target.value})}/></label>
   <label className="text-sm">Ngày văn bản<input type="date" className="input mt-1 w-full" value={form.issued_date} onChange={e=>setForm({...form,issued_date:e.target.value})}/></label><label className="text-sm">Ngày tiếp nhận<input type="date" className="input mt-1 w-full" value={form.received_date} onChange={e=>setForm({...form,received_date:e.target.value})}/></label><label className="text-sm">Ngày hiệu lực<input type="date" className="input mt-1 w-full" value={form.effective_date} onChange={e=>setForm({...form,effective_date:e.target.value})}/></label>
   <label className="text-sm sm:col-span-2">Tóm tắt<textarea className="input mt-1 w-full" rows={2} value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})}/></label><label className="text-sm">Mã tham chiếu tệp<input className="input mt-1 w-full" value={form.file_reference} onChange={e=>setForm({...form,file_reference:e.target.value})}/></label>
  </div><div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={()=>setShowForm(false)}>Hủy</button><button disabled={saving} className="btn-primary">{saving?'Đang lưu...':'Lưu bản nháp'}</button></div></form>}
  {error&&<div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}{notice&&<div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
  <section className="card overflow-hidden"><div className="border-b border-slate-100 px-4 py-3 font-semibold">Danh sách văn bản</div>{loading?<p className="p-6 text-center text-sm text-slate-500">Đang tải...</p>:rows.length===0?<p className="p-8 text-center text-sm text-slate-500">Chưa có hồ sơ văn bản trong phạm vi được phân quyền.</p>:<div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Số / ký hiệu</th><th className="p-3">Trích yếu</th><th className="p-3">Đơn vị</th><th className="p-3">Loại</th><th className="p-3">Trạng thái</th><th className="p-3">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(d=><tr key={d.id}><td className="whitespace-nowrap p-3 font-medium">{d.document_no}</td><td className="min-w-56 p-3">{d.subject}<div className="text-xs text-slate-400">{d.created_at?new Date(d.created_at).toLocaleDateString('vi-VN'):''}</div></td><td className="p-3">{unit(d.org_unit_id)}</td><td className="p-3">{types.find(x=>x.value===d.document_type)?.label??d.document_type}</td><td className="p-3"><span className="badge">{labels[d.status]??d.status}</span></td><td className="p-3"><div className="flex flex-wrap gap-1">{canUpdate&&['draft','returned'].includes(d.status)&&<button className="btn-ghost inline-flex items-center gap-1" disabled={saving} onClick={()=>void act('submit_admin_document',{p_document_id:d.id},'Đã trình duyệt văn bản.')}><Send size={14}/> Trình duyệt</button>}{canApprove&&d.status==='submitted'&&<><button className="btn-ghost inline-flex items-center gap-1 text-emerald-700" disabled={saving} onClick={()=>decide(d.id,true)}><CheckCircle2 size={14}/> Duyệt</button><button className="btn-ghost" disabled={saving} onClick={()=>decide(d.id,false)}>Trả lại</button></>}{canApprove&&d.status==='approved'&&<button className="btn-ghost inline-flex items-center gap-1" disabled={saving} onClick={()=>issue(d.id)}><FileCheck2 size={14}/> Ban hành</button>}{canApprove&&d.status==='issued'&&<button className="btn-ghost inline-flex items-center gap-1" disabled={saving} onClick={()=>archive(d.id)}><Archive size={14}/> Lưu trữ</button>}</div></td></tr>)}</tbody></table></div>}</section>
 </div>
}
