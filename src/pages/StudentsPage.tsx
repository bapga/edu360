import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { GraduationCap, Plus, RefreshCw, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePermissions } from '../contexts/PermissionContext'

type Student={id:string;student_code:string;full_name:string;date_of_birth:string|null;phone:string|null;status:string;org_unit_id:string}
type Cohort={id:string;cohort_code:string;name:string;start_year:number;end_year:number;org_unit_id:string;status:string}
type ClassGroup={id:string;class_code:string;name:string;cohort_id:string;org_unit_id:string;status:string}
type Unit={id:string;code:string;name:string}\ntype EnrollmentRef={student_id:string;cohort_id:string}
const statusLabel:Record<string,string>={active:'Đang học',reserved:'Bảo lưu',withdrawn:'Thôi học',graduated:'Đã tốt nghiệp',transferred:'Chuyển trường'}

export default function StudentsPage(){
 const {can}=usePermissions()
 const [students,setStudents]=useState<Student[]>([])
 const [cohorts,setCohorts]=useState<Cohort[]>([])
 const [classes,setClasses]=useState<ClassGroup[]>([])\n const [enrollments,setEnrollments]=useState<EnrollmentRef[]>([])
 const [units,setUnits]=useState<Unit[]>([])
 const [search,setSearch]=useState('')
 const [cohortFilter,setCohortFilter]=useState('')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState<string|null>(null)
 const [modal,setModal]=useState<'student'|'cohort'|'class'|null>(null)
 const [studentForm,setStudentForm]=useState({org_unit_id:'',student_code:'',full_name:'',date_of_birth:'',phone:''})
 const [cohortForm,setCohortForm]=useState({org_unit_id:'',cohort_code:'',name:'',start_year:'2026',end_year:'2028'})
 const [classForm,setClassForm]=useState({org_unit_id:'',cohort_id:'',class_code:'',name:''})
 const load=useCallback(async()=>{
  if(!supabase){setError('Chưa cấu hình kết nối Supabase.');setLoading(false);return}
  setLoading(true);setError(null)
  const [s,c,g,e,u]=await Promise.all([
   supabase.from('students').select('id,student_code,full_name,date_of_birth,phone,status,org_unit_id').order('created_at',{ascending:false}).limit(500),
   supabase.from('cohorts').select('id,cohort_code,name,start_year,end_year,org_unit_id,status').order('start_year',{ascending:false}),
   supabase.from('class_groups').select('id,class_code,name,cohort_id,org_unit_id,status').order('class_code'),
   supabase.from('org_units').select('id,code,name').eq('is_active',true).is('deleted_at',null).order('sort_order')
  ])
  const failure=s.error??c.error??g.error??e.error
  if(failure)setError(failure.message)
  setStudents((s.data??[]) as Student[]);setCohorts((c.data??[]) as Cohort[]);setClasses((g.data??[]) as ClassGroup[]);setEnrollments((e.data??[]) as EnrollmentRef[]);setUnits((u.data??[]) as Unit[])
  setLoading(false)
 },[])
 useEffect(()=>{void load()},[load])
 const filtered=useMemo(()=>students.filter(s=>(!search||[s.student_code,s.full_name,s.phone??''].some(v=>v.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))))&&(!cohortFilter||enrollments.some(e=>e.student_id===s.id&&e.cohort_id===cohortFilter))),[students,search,cohortFilter,enrollments])
 const canCreate=can('students','create'),canUpdate=can('students','update')
 async function saveStudent(e:FormEvent){e.preventDefault();if(!supabase)return;setSaving(true);setError(null)
  const {error:e1}=await supabase.from('students').insert({org_unit_id:studentForm.org_unit_id,student_code:studentForm.student_code.trim().toUpperCase(),full_name:studentForm.full_name.trim(),date_of_birth:studentForm.date_of_birth||null,phone:studentForm.phone.trim()||null})
  setSaving(false);if(e1){setError(e1.code==='23505'?'Mã người học đã tồn tại.':e1.message);return};setModal(null);setStudentForm({org_unit_id:'',student_code:'',full_name:'',date_of_birth:'',phone:''});await load()
 }
 async function saveCohort(e:FormEvent){e.preventDefault();if(!supabase)return;setSaving(true)
  const {error:e1}=await supabase.from('cohorts').insert({org_unit_id:cohortForm.org_unit_id,cohort_code:cohortForm.cohort_code.trim().toUpperCase(),name:cohortForm.name.trim(),start_year:Number(cohortForm.start_year),end_year:Number(cohortForm.end_year)})
  setSaving(false);if(e1){setError(e1.code==='23505'?'Mã khóa đã tồn tại trong đơn vị.':e1.message);return};setModal(null);await load()
 }
 async function saveClass(e:FormEvent){e.preventDefault();if(!supabase)return;setSaving(true)
  const cohort=cohorts.find(c=>c.id===classForm.cohort_id);if(!cohort){setError('Chọn khóa hợp lệ.');setSaving(false);return}
  const {error:e1}=await supabase.from('class_groups').insert({org_unit_id:cohort.org_unit_id,cohort_id:cohort.id,class_code:classForm.class_code.trim().toUpperCase(),name:classForm.name.trim()})
  setSaving(false);if(e1){setError(e1.code==='23505'?'Mã lớp đã tồn tại trong khóa.':e1.message);return};setModal(null);await load()
 }
 return <div className="space-y-6">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-medium text-brand-700"><GraduationCap size={17}/> Quản lý HSSV</div><h1 className="mt-1 text-2xl font-semibold text-navy-900">Người học</h1><p className="mt-1 text-sm text-slate-500">Hồ sơ người học gốc, khóa tuyển sinh và lớp hành chính.</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>void load()} disabled={loading} className="btn-ghost inline-flex items-center gap-2"><RefreshCw size={16}/> Làm mới</button>{canCreate&&<><button onClick={()=>setModal('cohort')} className="btn-ghost"><Plus size={15} className="mr-1 inline"/> Tạo khóa</button><button onClick={()=>setModal('class')} disabled={!cohorts.length} className="btn-ghost"><Plus size={15} className="mr-1 inline"/> Tạo lớp</button><button onClick={()=>setModal('student')} className="btn-primary"><Plus size={15} className="mr-1 inline"/> Thêm người học</button></>}</div></header>
  <section className="grid gap-3 sm:grid-cols-3"><div className="card p-4"><div className="text-sm text-slate-500">Người học</div><div className="mt-1 text-2xl font-semibold">{students.length}</div></div><div className="card p-4"><div className="text-sm text-slate-500">Khóa</div><div className="mt-1 text-2xl font-semibold">{cohorts.length}</div></div><div className="card p-4"><div className="text-sm text-slate-500">Lớp</div><div className="mt-1 text-2xl font-semibold">{classes.length}</div></div></section>
  <section className="card space-y-4 p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã người học, họ tên, điện thoại..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"/></label><select value={cohortFilter} onChange={e=>setCohortFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">Tất cả khóa</option>{cohorts.map(c=><option key={c.id} value={c.id}>{c.name} ({c.start_year}-{c.end_year})</option>)}</select></div>{error&&<div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}{loading?<p className="py-10 text-center text-sm text-slate-500">Đang tải danh sách người học...</p>:filtered.length===0?<div className="py-12 text-center text-sm text-slate-500">Chưa có hồ sơ người học phù hợp. Có thể tạo hồ sơ trực tiếp hoặc chuyển từ tuyển sinh sau khi trúng tuyển.</div>:<div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="p-3">Mã người học</th><th className="p-3">Họ và tên</th><th className="p-3">Ngày sinh</th><th className="p-3">Điện thoại</th><th className="p-3">Trạng thái</th></tr></thead><tbody className="divide-y">{filtered.map(s=><tr key={s.id}><td className="p-3 font-mono text-xs">{s.student_code}</td><td className="p-3 font-medium">{s.full_name}</td><td className="p-3">{s.date_of_birth??'—'}</td><td className="p-3">{s.phone??'—'}</td><td className="p-3"><span className="badge bg-slate-100 text-slate-700">{statusLabel[s.status]??s.status}</span></td></tr>)}</tbody></table></div>}</section>
  {modal&&<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy-950/50 p-4"><form onSubmit={modal==='student'?saveStudent:modal==='cohort'?saveCohort:saveClass} className="my-auto w-full max-w-xl space-y-4 rounded-2xl bg-white p-6"><h2 className="text-lg font-semibold">{modal==='student'?'Thêm hồ sơ người học':modal==='cohort'?'Tạo khóa tuyển sinh':'Tạo lớp hành chính'}</h2>
   {modal==='student'&&<><label className="block text-sm">Đơn vị quản lý<select required value={studentForm.org_unit_id} onChange={e=>setStudentForm(f=>({...f,org_unit_id:e.target.value}))} className="mt-1 w-full rounded-lg border p-2"><option value="">Chọn đơn vị</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label className="block text-sm">Mã người học<input required value={studentForm.student_code} onChange={e=>setStudentForm(f=>({...f,student_code:e.target.value}))} className="mt-1 w-full rounded-lg border p-2"/></label><label className="block text-sm">Họ và tên<input required value={studentForm.full_name} onChange={e=>setStudentForm(f=>({...f,full_name:e.target.value}))} className="mt-1 w-full rounded-lg border p-2"/></label><label className="block text-sm">Ngày sinh<input type="date" value={studentForm.date_of_birth} onChange={e=>setStudentForm(f=>({...f,date_of_birth:e.target.value}))} className="mt-1 w-full rounded-lg border p-2"/></label><label className="block text-sm">Điện thoại<input value={studentForm.phone} onChange={e=>setStudentForm(f=>({...f,phone:e.target.value}))} className="mt-1 w-full rounded-lg border p-2"/></label></>}
   {modal==='cohort'&&<><label className="block text-sm">Đơn vị quản lý<select required value={cohortForm.org_unit_id} onChange={e=>setCohortForm(f=>({...f,org_unit_id:e.target.value}))} className="mt-1 w-full rounded-lg border p-2"><option value="">Chọn đơn vị</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label className="block text-sm">Mã khóa<input required value={cohortForm.cohort_code} onChange={e=>setCohortForm(f=>({...f,cohort_code:e.target.value}))} className="mt-1 w-full rounded-lg border p-2"/></label><label className="block text-sm">Tên khóa<input required value={cohortForm.name} onChange={e=>setCohortForm(f=>({...f,name:e.target.value}))} className="mt-1 w-full rounded-lg border p-2"/></label><div className="grid grid-cols-2 gap-3"><label className="text-sm">Năm bắt đầu<input type="number" min="2000" max="2200" value={cohortForm.start_year} onChange={e=>setCohortForm(f=>({...f,start_year:e.target.value}))} className="mt-1 w-full rounded-lg border p-2"/></label><label className="text-sm">Năm kết thúc<input type="number" min="2000" max="2200" value={cohortForm.end_year} onChange={e=>setCohortForm(f=>({...f,end_year:e.target.value}))} className="mt-1 w-full rounded-lg border p-2"/></label></div></>}
   {modal==='class'&&<><label className="block text-sm">Khóa<select required value={classForm.cohort_id} onChange={e=>setClassForm(f=>({...f,cohort_id:e.target.value}))} className="mt-1 w-full rounded-lg border p-2"><option value="">Chọn khóa</option>{cohorts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="block text-sm">Mã lớp<input required value={classForm.class_code} onChange={e=>setClassForm(f=>({...f,class_code:e.target.value}))} className="mt-1 w-full rounded-lg border p-2"/></label><label className="block text-sm">Tên lớp<input required value={classForm.name} onChange={e=>setClassForm(f=>({...f,name:e.target.value}))} className="mt-1 w-full rounded-lg border p-2"/></label></>}
   <div className="flex justify-end gap-2"><button type="button" onClick={()=>setModal(null)} className="btn-ghost">Hủy</button><button disabled={saving} className="btn-primary">{saving?'Đang lưu...':'Lưu'}</button></div>
  </form></div>}
 </div>
}
