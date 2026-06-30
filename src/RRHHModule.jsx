import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Users, UserPlus, Edit, Trash2, Save, X,
  FileText, Upload, Calendar, Clock, Building2, Phone, Mail, CreditCard,
  Briefcase, MapPin, BookOpen, Shield, GraduationCap,
  FileBadge, FileSignature, Plus, Eye, Banknote, Hash, FlaskConical, UserSearch, Pencil,
  CheckCircle, XCircle, ChevronDown, ChevronRight, ClipboardList, AlertTriangle, MinusCircle,
} from 'lucide-react';
import logo from './assets/logo.png';
import CandidatesView from './CandidatesView';
import VacationCalendar from './VacationCalendar';

// ── Constantes ────────────────────────────────────────────────────────────────
const DELEGACIONES = ['Baleares', 'Canarias (Tenerife)', 'Canarias (Gran Canaria)', 'Madrid', 'Barcelona', 'Andalucía', 'Valencia'];
const CANARIAS_DELEG = ['Canarias (Tenerife)', 'Canarias (Gran Canaria)'];
const PENINSULA_DELEG = ['Madrid', 'Barcelona', 'Andalucía', 'Valencia'];
const DEPARTMENTS = ['Consultoría', 'Laboratorio', 'Dirección', 'Financiero', 'Operaciones', 'Marketing'];
const CONTRACT_TYPES = ['Indefinido', 'Temporal', 'Prácticas', 'Obra y servicio', 'Otro'];
const STATUSES = ['Activo', 'Baja', 'Excedencia', 'Pendiente'];
const ABSENCE_TYPES = ['Vacaciones', 'Baja médica', 'Permiso', 'Asuntos propios', 'Otro'];
const ABSENCE_STATUSES = ['Pendiente', 'Aprobado', 'Denegado'];

const POSITIONS_BY_DEPT = {
  'Consultoría': ['Consultor Junior', 'Consultor Senior', 'Jefe de Consultores'],
  'Laboratorio': ['Analista Junior', 'Analista Senior', 'Jefe de Laboratorio'],
};

const DEPT_STYLE = {
  'Consultoría': { color: '#185FA5', bg: '#e6f1fb', border: '#b5d4f4' },
  'Laboratorio': { color: '#534AB7', bg: '#eeedfe', border: '#afa9ec' },
  'Dirección':   { color: '#993C1D', bg: '#faece7', border: '#f5c4b3' },
};

const DOC_CATEGORIES = [
  { key: 'Contrato',                    label: 'Contratos',                      icon: <FileSignature size={16} />, color: '#0076CE' },
  { key: 'Nómina',                      label: 'Nóminas',                        icon: <Banknote size={16} />,      color: '#16A34A' },
  { key: 'Titulación',                  label: 'Titulaciones',                   icon: <GraduationCap size={16} />, color: '#7C3AED' },
  { key: 'Confidencialidad',            label: 'Confidencialidad',               icon: <Shield size={16} />,        color: '#DC2626' },
  { key: 'Política ISO',                label: 'Políticas ISO',                  icon: <BookOpen size={16} />,      color: '#D97706' },
  { key: 'Certificado de capacitación', label: 'Certificados de capacitación',   icon: <FileBadge size={16} />,     color: '#0891B2' },
  { key: 'Otro',                        label: 'Otros documentos',               icon: <FileText size={16} />,      color: '#6B7280' },
];

const DOC_SECTIONS = [
  {
    label: 'Titulación y Formación',
    icon: <GraduationCap size={15} />,
    color: '#7C3AED',
    bg: '#f5f3ff',
    keys: ['Titulación', 'Certificado de capacitación'],
  },
  {
    label: 'Documentación Laboral y Firma de Políticas',
    icon: <FileSignature size={15} />,
    color: '#0076CE',
    bg: '#eff6ff',
    keys: ['Contrato', 'Nómina', 'Confidencialidad', 'Política ISO', 'Otro'],
  },
];

const STATUS_COLORS = {
  'Activo':     { bg: '#dcfce7', color: '#166534' },
  'Baja':       { bg: '#fee2e2', color: '#991b1b' },
  'Excedencia': { bg: '#fef3c7', color: '#92400e' },
  'Pendiente':  { bg: '#e0e7ff', color: '#3730a3' },
};

const ABSENCE_STATUS_COLORS = {
  'Aprobado':  { bg: '#dcfce7', color: '#166534' },
  'Denegado':  { bg: '#fee2e2', color: '#991b1b' },
  'Pendiente': { bg: '#fef3c7', color: '#92400e' },
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const fmtCurrency = (v) => {
  if (!v && v !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);
};

const initials = (name) => name ? name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?';

const emptyEmployee = () => ({
  full_name: '', dni: '', email: '', phone: '', address: '', birth_date: '',
  employee_number: '', position: '', department: 'Consultoría', delegacion: 'Baleares',
  hire_date: '', contract_type: 'Indefinido', work_schedule: '', status: 'Activo',
  salary_gross: '', salary_net: '', irpf_pct: '', ss_number: '', bank_iban: '',
  titulacion: '', notes: '',
});

const emptyAbsence = (employeeId = '') => ({
  employee_id: employeeId, type: 'Vacaciones', start_date: '', end_date: '',
  status: 'Aprobado', notes: '',
});

// ── Componentes base ──────────────────────────────────────────────────────────
const Badge = ({ label, bg, color }) => (
  <span style={{ backgroundColor: bg, color, borderRadius: '999px', padding: '2px 10px', fontSize: '0.78rem', fontWeight: 600 }}>
    {label}
  </span>
);

const Modal = ({ open, onClose, title, children, width = 700 }) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
          <h3 style={{ margin: 0, color: 'var(--secondary)', fontSize: '1.1rem', fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={22} /></button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  );
};

const Field = ({ label, children, half }) => (
  <div style={{ gridColumn: half ? 'span 1' : 'span 2', display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
    {children}
  </div>
);

const inputStyle = {
  padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)',
  fontSize: '0.95rem', color: 'var(--text)', outline: 'none', width: '100%', backgroundColor: 'white',
};

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, dept, size = 36, photoUrl, onClick }) {
  const style = DEPT_STYLE[dept] || { color: 'var(--primary)', bg: 'var(--primary-light)' };
  return (
    <div onClick={onClick} style={{ width: size, height: size, borderRadius: '50%', backgroundColor: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: style.color, fontSize: size * 0.33, flexShrink: 0, overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', position: 'relative' }}>
      {photoUrl
        ? <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials(name)}
    </div>
  );
}

// ── MÓDULO PRINCIPAL ──────────────────────────────────────────────────────────
export default function RRHHModule({ onBackToHub }) {
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'list' | 'candidates' | 'calendar'
  const [employees, setEmployees] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros lista
  const [filterDelegacion, setFilterDelegacion] = useState('Todos');
  const [filterDept, setFilterDept] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Activo');
  const [search, setSearch] = useState('');

  // Dashboard: filtros zona
  const [consultZone, setConsultZone] = useState('Todos');
  const [labZone, setLabZone] = useState('Todos');

  // Empleado seleccionado (detalle)
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [fichaTab, setFichaTab] = useState('datos');

  // Modal empleado
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState(emptyEmployee());
  const [saving, setSaving] = useState(false);

  // Ausencias
  const [absences, setAbsences] = useState([]);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [absenceForm, setAbsenceForm] = useState(emptyAbsence());
  const [editingAbsence, setEditingAbsence] = useState(null);

  // Competencias Lab
  const [pnts, setPnts] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [editingComp, setEditingComp] = useState(null);
  const [compMode, setCompMode] = useState(null); // null = selector | 'edit' | 'new'
  const [compForm, setCompForm] = useState({});
  const [compHistory, setCompHistory] = useState([]);
  const [compEvidenceFile, setCompEvidenceFile] = useState(null);
  const [uploadingCompEvidence, setUploadingCompEvidence] = useState(false);
  const compEvidenceRef = useRef(null);
  const [expandedCompGroups, setExpandedCompGroups] = useState({});

  // Historial por PNT (editable manual)
  const [showCompHistForm, setShowCompHistForm] = useState(false);
  const [editingCompHist, setEditingCompHist] = useState(null);
  const emptyCompHistForm = () => ({ status: 'Cumple', eval_date: '', validity_date: '', evaluator: '', justification: '' });
  const [compHistForm, setCompHistForm] = useState(emptyCompHistForm());
  const [savingCompHist, setSavingCompHist] = useState(false);
  // Entrada de historial específica siendo editada en el form principal
  const [editingHistEntry, setEditingHistEntry] = useState(null);

  // Historial de evaluaciones (tabla manual)
  const [evalHistory, setEvalHistory] = useState([]);
  const [showEvalHistoryForm, setShowEvalHistoryForm] = useState(false);
  const [editingEvalHistory, setEditingEvalHistory] = useState(null);
  const [evalHistFile, setEvalHistFile] = useState(null);
  const evalHistFileRef = useRef(null);
  const [uploadingEvalHist, setUploadingEvalHist] = useState(false);
  const emptyEvalForm = () => ({ eval_date: '', document_url: '', document_name: '' });
  const [evalHistoryForm, setEvalHistoryForm] = useState(emptyEvalForm());
  const [savingEvalHistory, setSavingEvalHistory] = useState(false);

  // Documentos
  const [documents, setDocuments] = useState([]);
  const [showDocForm, setShowDocForm] = useState(false);
  const [docForm, setDocForm] = useState({ category: 'Contrato', name: '', issue_date: '', expiry_date: '', notes: '' });
  const [docFile, setDocFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileQueue, setFileQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [dragDocId, setDragDocId] = useState(null);
  const [dragOverCat, setDragOverCat] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editDocForm, setEditDocForm] = useState({});

  const [salaryVisible, setSalaryVisible] = useState(false);
  const [showSalaryPrompt, setShowSalaryPrompt] = useState(false);
  const [salaryPwdInput, setSalaryPwdInput] = useState('');

  useEffect(() => { loadEmployees(); loadCandidates(); }, []);

  const loadEmployees = async () => {
    setLoading(true);
    const { data } = await supabase.from('employees').select('*').order('full_name');
    setEmployees(data || []);
    setLoading(false);
  };

  const loadCandidates = async () => {
    const { data } = await supabase.from('candidates').select('*').order('created_at', { ascending: false });
    setCandidates(data || []);
  };

  const loadAbsences = async (id) => {
    const { data } = await supabase.from('absences').select('*').eq('employee_id', id).order('start_date', { ascending: false });
    setAbsences(data || []);
  };

  const loadDocuments = async (id) => {
    const { data } = await supabase.from('employee_documents').select('*').eq('employee_id', id).order('created_at', { ascending: false });
    setDocuments(data || []);
  };

  const loadCompetencies = async (id) => {
    const [{ data: pntData }, { data: compData }, { data: histData }] = await Promise.all([
      supabase.from('lab_pnts').select('*').order('sort_order'),
      supabase.from('employee_competencies').select('*').eq('employee_id', id),
      supabase.from('competency_eval_history').select('*').eq('employee_id', id).order('eval_date', { ascending: false }),
    ]);
    setPnts(pntData || []);
    setCompetencies(compData || []);
    setEvalHistory(histData || []);
  };

  const saveEvalHistoryEntry = async () => {
    if (!evalHistoryForm.eval_date) { alert('La fecha es obligatoria.'); return; }
    setSavingEvalHistory(true);
    let doc_url = evalHistoryForm.document_url || null;
    let doc_name = evalHistoryForm.document_name || null;
    if (evalHistFile) {
      setUploadingEvalHist(true);
      const ext = evalHistFile.name.split('.').pop();
      const path = `eval-history/${selectedEmployee.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('employee-documents').upload(path, evalHistFile, { upsert: true, contentType: evalHistFile.type || 'application/pdf' });
      if (upErr) { alert(`Error subiendo PDF: ${upErr.message}`); setSavingEvalHistory(false); setUploadingEvalHist(false); return; }
      const { data: urlData } = supabase.storage.from('employee-documents').getPublicUrl(path);
      doc_url = urlData.publicUrl;
      doc_name = evalHistFile.name;
      setUploadingEvalHist(false);
    }
    const payload = {
      employee_id: selectedEmployee.id,
      eval_date: evalHistoryForm.eval_date,
      result: 'PDF Adjunto',
      document_url: doc_url,
      document_name: doc_name,
    };
    let error;
    if (editingEvalHistory) {
      ({ error } = await supabase.from('competency_eval_history').update(payload).eq('id', editingEvalHistory.id));
    } else {
      ({ error } = await supabase.from('competency_eval_history').insert([payload]));
    }
    setSavingEvalHistory(false);
    if (error) { alert(`Error: ${error.message}`); return; }
    const { data } = await supabase.from('competency_eval_history').select('*').eq('employee_id', selectedEmployee.id).order('eval_date', { ascending: false });
    setEvalHistory(data || []);
    setShowEvalHistoryForm(false);
    setEditingEvalHistory(null);
    setEvalHistoryForm(emptyEvalForm());
    setEvalHistFile(null);
    if (evalHistFileRef.current) evalHistFileRef.current.value = '';
  };

  const deleteEvalHistoryEntry = async (id) => {
    if (!confirm('¿Eliminar esta entrada del historial?')) return;
    await supabase.from('competency_eval_history').delete().eq('id', id);
    setEvalHistory(prev => prev.filter(e => e.id !== id));
  };

  const openEditEvalHistory = (entry) => {
    setEditingEvalHistory(entry);
    setEvalHistoryForm({
      eval_date: entry.eval_date || '',
      document_url: entry.document_url || '',
      document_name: entry.document_name || '',
    });
    setEvalHistFile(null);
    if (evalHistFileRef.current) evalHistFileRef.current.value = '';
    setShowEvalHistoryForm(true);
  };

  const uploadPhoto = async (file) => {
    if (!file || !selectedEmployee) return;
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const path = `${selectedEmployee.id}/photo_${Date.now()}.jpg`;
      const { error: storageErr } = await supabase.storage.from('employee-documents').upload(path, compressed, { upsert: true, contentType: compressed.type || 'image/jpeg' });
      if (storageErr) { alert(`Error al subir foto: ${storageErr.message}`); return; }
      const { data: urlData } = supabase.storage.from('employee-documents').getPublicUrl(path);
      const photoUrl = urlData.publicUrl;
      const { error: dbErr } = await supabase.from('employees').update({ photo_url: photoUrl }).eq('id', selectedEmployee.id);
      if (dbErr) { alert(`Error al guardar foto: ${dbErr.message}`); return; }
      setSelectedEmployee(prev => ({ ...prev, photo_url: photoUrl }));
      setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? { ...e, photo_url: photoUrl } : e));
    } catch (e) {
      alert(`Error inesperado: ${e.message}`);
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const guessName = (file) =>
    file.name.replace(/\.[^/.]+$/, '').replace(/[_\-]+/g, ' ').trim().slice(0, 80);

  const openFileQueue = (files) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setFileQueue(arr);
    setQueueIndex(0);
    setDocFile(arr[0]);
    setDocForm({ category: 'Contrato', name: guessName(arr[0]), issue_date: '', expiry_date: '', notes: '' });
    setShowDocForm(true);
  };

  const openEmployee = (emp) => {
    setSelectedEmployee(emp);
    setFichaTab('datos');
    setSalaryVisible(false);
    loadAbsences(emp.id);
    loadDocuments(emp.id);
    if (emp.department === 'Laboratorio' || emp.department === 'Dirección') loadCompetencies(emp.id);
  };

  const SALARY_MASK = '••••••';
  const maskSalary = (val) => salaryVisible ? val : SALARY_MASK;
  const handleSalaryUnlock = () => {
    if (salaryPwdInput === 'conectar77') { setSalaryVisible(true); setShowSalaryPrompt(false); setSalaryPwdInput(''); }
    else { setSalaryPwdInput(''); alert('Contraseña incorrecta'); }
  };

  const openNewEmployee = () => {
    setEditingEmployee(null);
    setFormData(emptyEmployee());
    setShowEmployeeForm(true);
  };

  const openEditEmployee = (emp) => {
    setEditingEmployee(emp);
    setFormData({ ...emp, birth_date: emp.birth_date || '', hire_date: emp.hire_date || '' });
    setShowEmployeeForm(true);
  };

  const saveEmployee = async () => {
    if (!formData.full_name.trim()) return;
    setSaving(true);
    const payload = { ...formData };
    ['salary_gross', 'salary_net', 'irpf_pct'].forEach(k => { if (payload[k] === '') payload[k] = null; });
    ['birth_date', 'hire_date'].forEach(k => { if (payload[k] === '') payload[k] = null; });
    if (editingEmployee) {
      await supabase.from('employees').update(payload).eq('id', editingEmployee.id);
    } else {
      await supabase.from('employees').insert([payload]);
    }
    setSaving(false);
    setShowEmployeeForm(false);
    await loadEmployees();
    if (editingEmployee && selectedEmployee?.id === editingEmployee.id) {
      const { data } = await supabase.from('employees').select('*').eq('id', editingEmployee.id).single();
      setSelectedEmployee(data);
    }
  };

  const deleteEmployee = async (emp) => {
    if (!confirm(`¿Eliminar a ${emp.full_name}? Se borrarán también sus ausencias y documentos.`)) return;
    await supabase.from('employees').delete().eq('id', emp.id);
    if (selectedEmployee?.id === emp.id) setSelectedEmployee(null);
    loadEmployees();
  };

  const saveAbsence = async () => {
    if (!absenceForm.start_date || !absenceForm.end_date) return;
    const payload = { ...absenceForm, employee_id: selectedEmployee.id };
    if (editingAbsence) {
      await supabase.from('absences').update(payload).eq('id', editingAbsence.id);
    } else {
      await supabase.from('absences').insert([payload]);
    }
    setShowAbsenceForm(false);
    setEditingAbsence(null);
    loadAbsences(selectedEmployee.id);
  };

  const deleteAbsence = async (id) => {
    if (!confirm('¿Eliminar esta ausencia?')) return;
    await supabase.from('absences').delete().eq('id', id);
    loadAbsences(selectedEmployee.id);
  };

  const compressImage = (file) => new Promise((resolve) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1500;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.75);
    };
    img.src = url;
  });

  const uploadDocument = async () => {
    if (!docForm.name.trim()) return;
    setUploadingDoc(true);
    try {
      let file_url = null, file_name = null, file_size = null;
      if (!docFile) {
        if (!confirm('No has seleccionado ningún fichero. ¿Guardar el documento sin adjunto?')) return;
      } else {
        const fileToUpload = await compressImage(docFile);
        const safeName = fileToUpload.name.replace(/[^a-zA-Z0-9._\-]/g, '_');
        const path = `${selectedEmployee.id}/${Date.now()}_${safeName}`;
        const { error: storageError } = await supabase.storage.from('employee-documents').upload(path, fileToUpload, { upsert: true, contentType: fileToUpload.type || 'application/pdf' });
        if (storageError) {
          alert(`Error al subir el fichero: ${storageError.message}`);
          return;
        }
        const { data: urlData } = supabase.storage.from('employee-documents').getPublicUrl(path);
        file_url = urlData.publicUrl;
        file_name = fileToUpload.name;
        file_size = fileToUpload.size;
      }
      const { error: dbError } = await supabase.from('employee_documents').insert([{
        employee_id: selectedEmployee.id, category: docForm.category, name: docForm.name,
        file_url, file_name, file_size,
        issue_date: docForm.issue_date || null, expiry_date: docForm.expiry_date || null, notes: docForm.notes,
      }]);
      if (dbError) {
        alert(`Error al guardar el documento: ${dbError.message}`);
        return;
      }
      loadDocuments(selectedEmployee.id);
      const nextIndex = queueIndex + 1;
      if (nextIndex < fileQueue.length) {
        setQueueIndex(nextIndex);
        setDocFile(fileQueue[nextIndex]);
        setDocForm({ category: 'Contrato', name: guessName(fileQueue[nextIndex]), issue_date: '', expiry_date: '', notes: '' });
      } else {
        setShowDocForm(false);
        setDocForm({ category: 'Contrato', name: '', issue_date: '', expiry_date: '', notes: '' });
        setDocFile(null);
        setFileQueue([]);
        setQueueIndex(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (e) {
      alert(`Error inesperado: ${e.message}`);
    } finally {
      setUploadingDoc(false);
    }
  };

  const deleteDocument = async (doc) => {
    if (!confirm(`¿Eliminar "${doc.name}"?`)) return;
    if (doc.file_url) {
      const path = doc.file_url.split('/employee-documents/')[1];
      if (path) await supabase.storage.from('employee-documents').remove([path]);
    }
    await supabase.from('employee_documents').delete().eq('id', doc.id);
    loadDocuments(selectedEmployee.id);
  };

  const updateDocCategory = async (docId, newCategory) => {
    await supabase.from('employee_documents').update({ category: newCategory }).eq('id', docId);
    loadDocuments(selectedEmployee.id);
  };

  const openEditComp = async (pnt) => {
    const existing = competencies.find(c => c.pnt_id === pnt.id) || {};
    const today = new Date();
    const isExpired = existing.validity_date && new Date(existing.validity_date) < today;

    // Todo el estado se fija ANTES del await para evitar flashes
    setEditingComp({ pnt, existing });
    setCompHistory([]);
    setCompEvidenceFile(null);
    if (compEvidenceRef.current) compEvidenceRef.current.value = '';

    if (!existing.id) {
      // Sin evaluación previa → directo a formulario nuevo
      setCompMode('new');
      setCompForm({ status: '', justification: '', eval_date: '', validity_date: '', evaluator: '', evidence_url: null, evidence_name: null });
    } else {
      // Con evaluación existente → siempre mostrar selector (null)
      setCompMode(null);
      setCompForm({
        status: existing.status || '',
        justification: existing.justification || '',
        eval_date: existing.eval_date || '',
        validity_date: existing.validity_date || '',
        evaluator: existing.evaluator || '',
        evidence_url: existing.evidence_url || null,
        evidence_name: existing.evidence_name || null,
      });
    }

    // Cargar historial en segundo plano (no bloquea la apertura del modal)
    const { data } = await supabase
      .from('competency_evaluations')
      .select('*')
      .eq('employee_id', selectedEmployee.id)
      .eq('pnt_id', pnt.id)
      .order('eval_date', { ascending: false });
    setCompHistory(data || []);
  };

  const switchCompMode = (mode) => {
    if (mode === 'new') {
      setCompForm({ status: '', justification: '', eval_date: '', validity_date: '', evaluator: '', evidence_url: null, evidence_name: null });
      setCompEvidenceFile(null);
    } else {
      const existing = editingComp?.existing || {};
      setCompForm({
        status: existing.status || '',
        justification: existing.justification || '',
        eval_date: existing.eval_date || '',
        validity_date: existing.validity_date || '',
        evaluator: existing.evaluator || '',
        evidence_url: existing.evidence_url || null,
        evidence_name: existing.evidence_name || null,
      });
      setCompEvidenceFile(null);
    }
    setCompMode(mode);
  };

  const saveComp = async () => {
    if (!editingComp || !selectedEmployee || !compForm.status) return;

    const { pnt, existing } = editingComp;
    setUploadingCompEvidence(true);
    let evidenceUrl = compForm.evidence_url || null;
    let evidenceName = compForm.evidence_name || null;
    if (compEvidenceFile) {
      const safeName = compEvidenceFile.name.replace(/[^A-Za-z0-9._\-]/g, '_');
      const storagePath = `${selectedEmployee.id}/competencias/${pnt.id}_${Date.now()}_${safeName}`;
      const { error: storErr } = await supabase.storage.from('employee-documents').upload(storagePath, compEvidenceFile, { upsert: true, contentType: compEvidenceFile.type || 'application/pdf' });
      if (storErr) { alert(`Error al subir evidencia: ${storErr.message}`); setUploadingCompEvidence(false); return; }
      evidenceUrl = supabase.storage.from('employee-documents').getPublicUrl(storagePath).data.publicUrl;
      evidenceName = compEvidenceFile.name;
    }
    const sanitize = (f) => ({
      employee_id: selectedEmployee.id,
      pnt_id: pnt.id,
      status: f.status,
      justification: f.justification || null,
      eval_date: f.eval_date || null,
      validity_date: f.validity_date || null,
      evaluator: f.evaluator || null,
      evidence_url: evidenceUrl,
      evidence_name: evidenceName,
    });
    const rec = sanitize(compForm);

    // 1. Guardar en historial (competency_evaluations)
    if (editingHistEntry) {
      const { error } = await supabase.from('competency_evaluations').update(rec).eq('id', editingHistEntry.id);
      if (error) { alert(`Error al guardar: ${error.message}`); setUploadingCompEvidence(false); return; }
    } else if (compMode === 'edit' && compHistory.length > 0) {
      const { error } = await supabase.from('competency_evaluations').update(rec).eq('id', compHistory[0].id);
      if (error) { alert(`Error al guardar: ${error.message}`); setUploadingCompEvidence(false); return; }
    } else {
      const { error } = await supabase.from('competency_evaluations').insert([rec]);
      if (error) { alert(`Error al guardar: ${error.message}`); setUploadingCompEvidence(false); return; }
    }

    // 2. Actualizar employee_competencies con la evaluación MÁS RECIENTE por eval_date
    const { data: allHist } = await supabase
      .from('competency_evaluations')
      .select('*')
      .eq('employee_id', selectedEmployee.id)
      .eq('pnt_id', pnt.id)
      .not('eval_date', 'is', null)
      .order('eval_date', { ascending: false })
      .limit(1);

    const latest = allHist?.[0] || rec;
    const latestRec = {
      employee_id: selectedEmployee.id,
      pnt_id: pnt.id,
      status: latest.status,
      justification: latest.justification || null,
      eval_date: latest.eval_date || null,
      validity_date: latest.validity_date || null,
      evaluator: latest.evaluator || null,
      evidence_url: latest.evidence_url || null,
      evidence_name: latest.evidence_name || null,
    };
    const upsertResult = existing.id
      ? await supabase.from('employee_competencies').update(latestRec).eq('id', existing.id)
      : await supabase.from('employee_competencies').insert(latestRec);
    if (upsertResult.error) { alert(`Error al actualizar estado: ${upsertResult.error.message}`); setUploadingCompEvidence(false); return; }

    setUploadingCompEvidence(false);
    const { data } = await supabase.from('employee_competencies').select('*').eq('employee_id', selectedEmployee.id);
    setCompetencies(data || []);
    setEditingComp(null);
    setCompMode(null);
    setCompHistory([]);
    setEditingHistEntry(null);
    setCompEvidenceFile(null);
    if (compEvidenceRef.current) compEvidenceRef.current.value = '';
  };

  const saveCompHistEntry = async () => {
    if (!compHistForm.status || !editingComp) return;
    setSavingCompHist(true);
    const payload = {
      employee_id: selectedEmployee.id,
      pnt_id: editingComp.pnt.id,
      status: compHistForm.status,
      eval_date: compHistForm.eval_date || null,
      validity_date: compHistForm.validity_date || null,
      evaluator: compHistForm.evaluator || null,
      justification: compHistForm.justification || null,
    };
    let error;
    if (editingCompHist) {
      ({ error } = await supabase.from('competency_evaluations').update(payload).eq('id', editingCompHist.id));
    } else {
      ({ error } = await supabase.from('competency_evaluations').insert([payload]));
    }
    setSavingCompHist(false);
    if (error) { alert(`Error: ${error.message}`); return; }
    const { data } = await supabase.from('competency_evaluations').select('*')
      .eq('employee_id', selectedEmployee.id).eq('pnt_id', editingComp.pnt.id)
      .order('eval_date', { ascending: false });
    setCompHistory(data || []);
    setShowCompHistForm(false);
    setEditingCompHist(null);
    setCompHistForm(emptyCompHistForm());
  };

  const deleteCompHistEntry = async (id) => {
    if (!confirm('¿Eliminar esta entrada del historial?')) return;
    const pnt = editingComp?.pnt;
    const empId = selectedEmployee?.id;
    await supabase.from('competency_evaluations').delete().eq('id', id);
    const remaining = compHistory.filter(h => h.id !== id);
    setCompHistory(remaining);

    if (!pnt || !empId) return;
    if (remaining.length === 0) {
      // Sin evaluaciones → eliminar estado vigente
      await supabase.from('employee_competencies').delete().eq('employee_id', empId).eq('pnt_id', pnt.id);
      setCompetencies(prev => prev.filter(c => !(c.employee_id === empId && c.pnt_id === pnt.id)));
    } else {
      // Quedan evaluaciones → actualizar con la más reciente por eval_date
      const latest = [...remaining].sort((a, b) => (b.eval_date || '').localeCompare(a.eval_date || ''))[0];
      const { employee_id, pnt_id, ...fields } = latest;
      await supabase.from('employee_competencies')
        .update({ status: latest.status, eval_date: latest.eval_date, validity_date: latest.validity_date, evaluator: latest.evaluator, justification: latest.justification, evidence_url: latest.evidence_url, evidence_name: latest.evidence_name })
        .eq('employee_id', empId).eq('pnt_id', pnt.id);
      setCompetencies(prev => prev.map(c => (c.employee_id === empId && c.pnt_id === pnt.id) ? { ...c, ...latest } : c));
    }
  };

  const openEditCompHist = (entry) => {
    // Cargar la entrada del historial en el formulario principal
    setEditingHistEntry(entry);
    setCompForm({
      status: entry.status || '',
      justification: entry.justification || '',
      eval_date: entry.eval_date || '',
      validity_date: entry.validity_date || '',
      evaluator: entry.evaluator || '',
      evidence_url: entry.evidence_url || null,
      evidence_name: entry.evidence_name || null,
    });
    setCompEvidenceFile(null);
    if (compEvidenceRef.current) compEvidenceRef.current.value = '';
    setCompMode('edit');
  };

  const openEditDoc = (doc) => {
    setEditingDoc(doc);
    setEditDocForm({ name: doc.name, category: doc.category, issue_date: doc.issue_date || '', expiry_date: doc.expiry_date || '', notes: doc.notes || '' });
  };

  const saveEditDoc = async () => {
    if (!editingDoc) return;
    const payload = {
      ...editDocForm,
      issue_date: editDocForm.issue_date || null,
      expiry_date: editDocForm.expiry_date || null,
    };
    const { error } = await supabase.from('employee_documents').update(payload).eq('id', editingDoc.id);
    if (error) { alert(`Error al guardar: ${error.message}`); return; }
    setEditingDoc(null);
    loadDocuments(selectedEmployee.id);
  };

  // ── Helpers de filtrado ────────────────────────────────────────────────────
  const byDept = (dept) => employees.filter(e => e.department === dept);

  const consultByZone = (zone) => {
    const base = byDept('Consultoría');
    if (zone === 'Baleares') return base.filter(e => e.delegacion === 'Baleares');
    if (zone === 'Canarias') return base.filter(e => CANARIAS_DELEG.includes(e.delegacion));
    if (zone === 'Península') return base.filter(e => PENINSULA_DELEG.includes(e.delegacion));
    return base;
  };

  const filteredEmployees = employees.filter(e => {
    const matchDel = filterDelegacion === 'Todos' || e.delegacion === filterDelegacion;
    const matchDept = filterDept === 'Todos' || e.department === filterDept;
    const matchStatus = filterStatus === 'Todos' || e.status === filterStatus;
    const matchSearch = !search || e.full_name.toLowerCase().includes(search.toLowerCase()) || (e.position || '').toLowerCase().includes(search.toLowerCase());
    return matchDel && matchDept && matchStatus && matchSearch;
  });

  const goToList = (dept = 'Todos', status = 'Todos', deleg = 'Todos') => {
    setFilterDept(dept);
    setFilterStatus(status);
    setFilterDelegacion(deleg);
    setSearch('');
    setView('list');
  };

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = {
    total:     employees.length,
    activos:   employees.filter(e => e.status === 'Activo').length,
    bajas:     employees.filter(e => e.status === 'Baja').length,
    pendientes: employees.filter(e => e.status === 'Pendiente').length,
  };

  const delagDist = DELEGACIONES.map(d => ({
    label: d === 'Canarias (Tenerife)' ? 'CAN Tfe' : d === 'Canarias (Gran Canaria)' ? 'CAN GC' : d,
    count: employees.filter(e => e.delegacion === d).length,
    deleg: d,
  })).filter(d => d.count > 0);

  // ── RENDER: Ficha empleado ─────────────────────────────────────────────────
  if (selectedEmployee) {
    const docsGrouped = DOC_CATEGORIES.map(cat => ({ ...cat, docs: documents.filter(d => d.category === cat.key) }));
    const vacDays = absences.filter(a => a.type === 'Vacaciones' && a.status === 'Aprobado').reduce((s, a) => s + (a.days || 0), 0);
    const deptStyle = DEPT_STYLE[selectedEmployee.department] || { color: 'var(--primary)', bg: 'var(--primary-light)', border: 'var(--border)' };

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', overflowY: 'auto' }}>

        {/* ── Top bar ── */}
        <div style={{ backgroundColor: 'white', borderBottom: '1px solid var(--border)', padding: '0 32px', display: 'flex', alignItems: 'center', gap: '16px', height: '56px', position: 'sticky', top: 0, zIndex: 10 }}>
          <button type="button" onClick={() => setSelectedEmployee(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', padding: '6px 0' }}>
            ← Volver a Plantilla
          </button>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{selectedEmployee.full_name}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => { setEditingAbsence(null); setAbsenceForm(emptyAbsence(selectedEmployee.id)); setShowAbsenceForm(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
              <Plus size={14} /> Ausencia
            </button>
            <button className="btn btn-secondary" onClick={() => { setFileQueue([]); setQueueIndex(0); setDocFile(null); setDocForm({ category: 'Contrato', name: '', issue_date: '', expiry_date: '', notes: '' }); setShowDocForm(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
              <Upload size={14} /> Documento
            </button>
            <button className="btn btn-primary" onClick={() => openEditEmployee(selectedEmployee)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
              <Edit size={14} /> Editar ficha
            </button>
          </div>
        </div>

        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

          {/* ── Hero del empleado ── */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px 32px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '24px', borderTop: `4px solid ${deptStyle.color}` }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Avatar name={selectedEmployee.full_name} dept={selectedEmployee.department} size={72} photoUrl={selectedEmployee.photo_url} onClick={() => photoInputRef.current?.click()} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', cursor: 'pointer', pointerEvents: 'none' }}>
                {uploadingPhoto ? <Clock size={12} color="white" /> : <Upload size={12} color="white" />}
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) uploadPhoto(e.target.files[0]); }} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '1.6rem', color: 'var(--secondary)', fontWeight: 800 }}>{selectedEmployee.full_name}</h2>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 500 }}>{selectedEmployee.position || 'Sin cargo asignado'}</span>
                {selectedEmployee.department && <span style={{ fontSize: '0.8rem', backgroundColor: deptStyle.bg, color: deptStyle.color, border: `1px solid ${deptStyle.border}`, padding: '2px 10px', borderRadius: '999px', fontWeight: 700 }}>{selectedEmployee.department}</span>}
                {selectedEmployee.delegacion && <span style={{ fontSize: '0.8rem', backgroundColor: '#e0e7ff', color: '#3730a3', padding: '2px 10px', borderRadius: '999px', fontWeight: 600 }}>{selectedEmployee.delegacion}</span>}
                <Badge label={selectedEmployee.status} {...(STATUS_COLORS[selectedEmployee.status] || {})} />
              </div>
            </div>
            {/* KPI chips */}
            <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
              {[
                { label: 'Días vacaciones', value: vacDays, color: '#16a34a', bg: '#dcfce7' },
                { label: 'Ausencias', value: absences.length, color: '#d97706', bg: '#fef3c7' },
                { label: 'Documentos', value: documents.length, color: '#0076CE', bg: '#dbeafe' },
              ].map(k => (
                <div key={k.label} style={{ textAlign: 'center', backgroundColor: k.bg, borderRadius: '12px', padding: '12px 18px', minWidth: '80px' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: '0.7rem', color: k.color, fontWeight: 600, marginTop: '4px', opacity: 0.8 }}>{k.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Grid de tarjetas principales ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '20px' }}>

            {/* Datos personales */}
            <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Users size={16} color="var(--primary)" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--secondary)' }}>Datos personales</span>
              </div>
              <InfoRow icon={<Hash size={13} />}           label="DNI/NIE"        value={selectedEmployee.dni} />
              <InfoRow icon={<Mail size={13} />}           label="Email"          value={selectedEmployee.email} />
              <InfoRow icon={<Phone size={13} />}          label="Teléfono"       value={selectedEmployee.phone} />
              <InfoRow icon={<MapPin size={13} />}         label="Dirección"      value={selectedEmployee.address} />
              <InfoRow icon={<Calendar size={13} />}       label="Nacimiento"     value={fmtDate(selectedEmployee.birth_date)} />
              <InfoRow icon={<GraduationCap size={13} />}  label="Titulación"     value={selectedEmployee.titulacion} />
              {selectedEmployee.notes && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Observaciones</div>
                  <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{selectedEmployee.notes}</p>
                </div>
              )}
            </div>

            {/* Datos laborales + económicos */}
            <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Briefcase size={16} color="#7c3aed" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--secondary)' }}>Datos laborales y económicos</span>
              </div>
              <InfoRow icon={<Briefcase size={13} />}      label="Cargo"          value={selectedEmployee.position} />
              <InfoRow icon={<Building2 size={13} />}      label="Departamento"   value={selectedEmployee.department} />
              <InfoRow icon={<MapPin size={13} />}         label="Delegación"     value={selectedEmployee.delegacion} />
              <InfoRow icon={<Calendar size={13} />}       label="Alta"           value={fmtDate(selectedEmployee.hire_date)} />
              <InfoRow icon={<FileText size={13} />}       label="Contrato"       value={selectedEmployee.contract_type} />
              <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Datos económicos</span>
                <button type="button" onClick={() => salaryVisible ? setSalaryVisible(false) : setShowSalaryPrompt(true)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: '2px 8px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Eye size={12} />{salaryVisible ? 'Ocultar' : 'Ver'}
                </button>
              </div>
              <InfoRow icon={<Banknote size={13} />}       label="Salario bruto"  value={salaryVisible ? fmtCurrency(selectedEmployee.salary_gross) : SALARY_MASK} />
              <InfoRow icon={<Banknote size={13} />}       label="Salario neto"   value={salaryVisible ? fmtCurrency(selectedEmployee.salary_net) : SALARY_MASK} />
              <InfoRow icon={<CreditCard size={13} />}     label="IRPF %"         value={salaryVisible ? (selectedEmployee.irpf_pct ? `${selectedEmployee.irpf_pct}%` : '—') : SALARY_MASK} />
              <InfoRow icon={<Hash size={13} />}           label="Nº SS"          value={salaryVisible ? selectedEmployee.ss_number : SALARY_MASK} />
              <InfoRow icon={<CreditCard size={13} />}     label="IBAN"           value={salaryVisible ? selectedEmployee.bank_iban : SALARY_MASK} />
            </div>
          </div>

          {/* ── Tarjeta Documentación (expandible) ── */}
          <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid var(--border)', marginBottom: '20px', overflow: 'hidden' }}>
            <button type="button" onClick={() => setFichaTab(fichaTab === 'documentos' ? '' : 'documentos')}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
              <FileText size={18} color="#0076CE" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--secondary)', flex: 1 }}>Documentación</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {DOC_SECTIONS.map(sec => {
                  const cnt = docsGrouped.filter(g => sec.keys.includes(g.key)).reduce((s, g) => s + g.docs.length, 0);
                  if (!cnt) return null;
                  return <span key={sec.label} style={{ fontSize: '0.75rem', backgroundColor: sec.bg, color: sec.color, borderRadius: '999px', padding: '2px 9px', fontWeight: 600, border: `1px solid ${sec.color}30` }}>{cnt} {sec.label.split(' ')[0]}</span>;
                })}
                {documents.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin documentos</span>}
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '1rem', marginLeft: '8px' }}>{fichaTab === 'documentos' ? '▲' : '▼'}</span>
            </button>

            {fichaTab === 'documentos' && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                  <button className="btn btn-primary" onClick={() => { setFileQueue([]); setQueueIndex(0); setDocFile(null); setDocForm({ category: 'Contrato', name: '', issue_date: '', expiry_date: '', notes: '' }); setShowDocForm(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                    <Plus size={14} /> Subir documento
                  </button>
                </div>
                {documents.length === 0 ? (
                  <EmptyState icon={<FileText size={36} />} text="Sin documentos subidos" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                    {DOC_SECTIONS.map(section => {
                      const sectionGroups = docsGrouped.filter(g => section.keys.includes(g.key) && g.docs.length > 0);
                      if (sectionGroups.length === 0) return null;
                      return (
                        <div key={section.label}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: section.bg, borderRadius: '10px', borderLeft: `4px solid ${section.color}`, marginBottom: '16px' }}>
                            <span style={{ color: section.color }}>{section.icon}</span>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: section.color }}>{section.label}</span>
                            <span style={{ fontSize: '0.75rem', backgroundColor: 'white', color: section.color, borderRadius: '999px', padding: '1px 8px', border: `1px solid ${section.color}`, marginLeft: 'auto' }}>
                              {sectionGroups.reduce((a, g) => a + g.docs.length, 0)} docs
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingLeft: '8px' }}>
                            {sectionGroups.map(group => (
                              <div
                                key={group.key}
                                onDragOver={e => { e.preventDefault(); setDragOverCat(group.key); }}
                                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCat(null); }}
                                onDrop={e => { e.preventDefault(); setDragOverCat(null); if (dragDocId) { updateDocCategory(dragDocId, group.key); setDragDocId(null); } }}
                                style={{ borderRadius: '10px', border: dragOverCat === group.key ? `2px dashed ${group.color}` : '2px dashed transparent', padding: dragOverCat === group.key ? '8px' : '0', background: dragOverCat === group.key ? `${group.color}11` : 'transparent', transition: 'all 0.15s' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                  <span style={{ color: group.color }}>{group.icon}</span>
                                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--secondary)' }}>{group.label}</span>
                                  <span style={{ fontSize: '0.75rem', backgroundColor: '#f1f5f9', color: 'var(--text-muted)', borderRadius: '999px', padding: '1px 8px' }}>{group.docs.length}</span>
                                  {dragDocId && dragOverCat === group.key && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: group.color, fontWeight: 600 }}>Soltar aquí →</span>}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                                  {group.docs.map(doc => (
                                    <DocCard
                                      key={doc.id}
                                      doc={doc}
                                      color={group.color}
                                      onDelete={() => deleteDocument(doc)}
                                      onEdit={() => openEditDoc(doc)}
                                      onDragStart={() => setDragDocId(doc.id)}
                                      onDragEnd={() => setDragDocId(null)}
                                      isDragging={dragDocId === doc.id}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Tarjeta Vacaciones (expandible) ── */}
          <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <button type="button" onClick={() => setFichaTab(fichaTab === 'ausencias' ? '' : 'ausencias')}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
              <Calendar size={18} color="#d97706" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--secondary)', flex: 1 }}>Vacaciones</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>{fichaTab === 'ausencias' ? '▲' : '▼'}</span>
            </button>

            {fichaTab === 'ausencias' && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                  <button className="btn btn-primary" onClick={() => { setEditingAbsence(null); setAbsenceForm({ ...emptyAbsence(selectedEmployee.id), type: 'Vacaciones' }); setShowAbsenceForm(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                    <Plus size={14} /> Nueva vacación
                  </button>
                </div>
                {absences.filter(a => a.type === 'Vacaciones').length === 0 ? (
                  <EmptyState icon={<Calendar size={36} />} text="Sin vacaciones registradas" />
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        {['Inicio', 'Fin', 'Días', 'Estado', 'Notas', ''].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {absences.filter(a => a.type === 'Vacaciones').map(a => (
                        <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{fmtDate(a.start_date)}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{fmtDate(a.end_date)}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--primary)' }}>{a.days}</td>
                          <td style={{ padding: '10px 14px' }}><Badge label={a.status} {...(ABSENCE_STATUS_COLORS[a.status] || {})} /></td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{a.notes || '—'}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button type="button" onClick={() => { setEditingAbsence(a); setAbsenceForm({ ...a }); setShowAbsenceForm(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}><Edit size={14} /></button>
                              <button type="button" onClick={() => deleteAbsence(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* ── Competencia Técnica ISO 17025 (Laboratorio y Dirección) ─────────────── */}
          {(selectedEmployee.department === 'Laboratorio' || selectedEmployee.department === 'Dirección') && (() => {
            const groups = [...new Set((pnts || []).map(p => p.group_name))];
            const compByPnt = {};
            competencies.forEach(c => {
              if (!compByPnt[c.pnt_id] || (c.eval_date || '') > (compByPnt[c.pnt_id].eval_date || '')) {
                compByPnt[c.pnt_id] = c;
              }
            });
            const cumple = competencies.filter(c => c.status === 'Cumple').length;
            const noCumple = competencies.filter(c => c.status === 'No cumple').length;
            const noAplica = competencies.filter(c => c.status === 'No aplica').length;
            const evaluables = pnts.length - noAplica;
            const today = new Date();
            const isExpired = (d) => d && new Date(d) < today;
            const isSoon = (d) => d && !isExpired(d) && (new Date(d) - today) < 60 * 24 * 60 * 60 * 1000;
            return (
              <div style={{ border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
                <button type="button" onClick={() => setFichaTab(fichaTab === 'competencias' ? '' : 'competencias')}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
                  <ClipboardList size={18} color="#0891b2" />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--secondary)', flex: 1 }}>Competencia Técnica ISO 17025</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#166534', borderRadius: '999px', padding: '2px 10px', fontWeight: 600 }}>{cumple} Cumple</span>
                    {noCumple > 0 && <span style={{ fontSize: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '999px', padding: '2px 10px', fontWeight: 600 }}>{noCumple} No cumple</span>}
                    {noAplica > 0 && <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#94a3b8', borderRadius: '999px', padding: '2px 10px' }}>{noAplica} N/A</span>}
                    <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: 'var(--text-muted)', borderRadius: '999px', padding: '2px 10px' }}>{cumple}/{evaluables}</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '1rem', marginLeft: '8px' }}>{fichaTab === 'competencias' ? '▲' : '▼'}</span>
                </button>

                {fichaTab === 'competencias' && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                    {/* ── Historial de evaluaciones ── */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Historial de evaluaciones</span>
                        <button
                          type="button"
                          onClick={() => { setEditingEvalHistory(null); setEvalHistoryForm(emptyEvalForm()); setShowEvalHistoryForm(true); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '7px', border: '1px solid #0891b2', background: '#ecfeff', color: '#0e7490', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          <Plus size={13} /> Añadir
                        </button>
                      </div>

                      {/* Documentos PDF de evaluación adjuntos */}
                      {(() => {
                        const evalDocs = documents.filter(d => d.category === 'Evaluación de Competencia');
                        if (!evalDocs.length && !evalHistory.length) return (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '12px', background: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
                            Sin entradas. Usa "Añadir" para registrar una evaluación.
                          </div>
                        );
                        return (
                          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 110px 36px 36px', gap: '8px', padding: '7px 14px', background: '#f8fafc', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>
                              <span>Fecha</span><span>Archivo</span><span>Resultado</span><span></span><span></span>
                            </div>
                            {evalHistory.map(entry => (
                              <div key={entry.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 110px 36px 36px', gap: '8px', padding: '9px 14px', alignItems: 'center', borderBottom: '1px solid #f1f5f9', fontSize: '0.82rem' }}>
                                <span style={{ fontWeight: 600, color: 'var(--secondary)' }}>{entry.eval_date ? fmtDate(entry.eval_date) : '—'}</span>
                                <div style={{ minWidth: 0 }}>
                                  {entry.document_url ? (
                                    <a href={entry.document_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                      <Eye size={12} /> {entry.document_name || 'Abrir PDF'}
                                    </a>
                                  ) : (
                                    <span style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>Sin archivo</span>
                                  )}
                                </div>
                                <span style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-block', background: '#eff6ff', color: '#1d4ed8' }}>PDF Adjunto</span>
                                <button type="button" onClick={() => openEditEvalHistory(entry)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '5px' }} title="Editar"><Pencil size={13} /></button>
                                <button type="button" onClick={() => deleteEvalHistoryEntry(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '4px', borderRadius: '5px' }} title="Eliminar"><Trash2 size={13} /></button>
                              </div>
                            ))}
                            {documents.filter(d => d.category === 'Evaluación de Competencia').map(doc => (
                              <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 110px 36px 36px', gap: '8px', padding: '9px 14px', alignItems: 'center', borderBottom: '1px solid #f1f5f9', fontSize: '0.82rem', background: '#fafcff' }}>
                                <span style={{ fontWeight: 600, color: 'var(--secondary)' }}>{doc.issue_date ? fmtDate(doc.issue_date) : '—'}</span>
                                <div style={{ minWidth: 0 }}>
                                  {doc.file_url ? (
                                    <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                                      <Eye size={12} /> {doc.name}
                                    </a>
                                  ) : (
                                    <span style={{ fontSize: '0.8rem', color: 'var(--secondary)', fontWeight: 600 }}>{doc.name}</span>
                                  )}
                                </div>
                                <span style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-block', background: '#eff6ff', color: '#1d4ed8' }}>PDF Adjunto</span>
                                <span /><span />
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', marginBottom: '4px' }} />

                    {groups.map(group => {
                      const groupPnts = pnts.filter(p => p.group_name === group);
                      const groupCumple = groupPnts.filter(p => compByPnt[p.id]?.status === 'Cumple').length;
                      const groupNoAplica = groupPnts.filter(p => compByPnt[p.id]?.status === 'No aplica').length;
                      const groupEvaluables = groupPnts.length - groupNoAplica;
                      const isOpen = expandedCompGroups[group] !== false;
                      return (
                        <div key={group} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                          <button type="button"
                            onClick={() => setExpandedCompGroups(prev => ({ ...prev, [group]: !isOpen }))}
                            style={{ width: '100%', background: '#f8fafc', border: 'none', cursor: 'pointer', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
                            {isOpen ? <ChevronDown size={15} color="var(--text-muted)" /> : <ChevronRight size={15} color="var(--text-muted)" />}
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--secondary)', flex: 1 }}>{group}</span>
                            <span style={{ fontSize: '0.73rem', background: groupCumple === groupEvaluables && groupCumple > 0 ? '#dcfce7' : '#f1f5f9', color: groupCumple === groupEvaluables && groupCumple > 0 ? '#166534' : 'var(--text-muted)', borderRadius: '999px', padding: '1px 8px', fontWeight: 600 }}>
                              {groupCumple}/{groupEvaluables}
                            </span>
                          </button>
                          {isOpen && (
                            <div>
                              {groupPnts.map((pnt, idx) => {
                                const comp = compByPnt[pnt.id];
                                const exp = isExpired(comp?.validity_date);
                                const soon = isSoon(comp?.validity_date);
                                return (
                                  <div key={pnt.id}
                                    onClick={() => openEditComp(pnt)}
                                    style={{ display: 'grid', gridTemplateColumns: '26px 1fr 90px 100px 100px', alignItems: 'center', gap: '10px', padding: '10px 16px', cursor: 'pointer', borderTop: '1px solid #f1f5f9', background: comp?.status === 'No aplica' ? '#fafafa' : 'white', transition: 'background 0.1s', opacity: comp?.status === 'No aplica' ? 0.55 : 1 }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                    onMouseLeave={e => e.currentTarget.style.background = comp?.status === 'No aplica' ? '#fafafa' : 'white'}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {comp?.status === 'Cumple' ? <CheckCircle size={17} color="#16a34a" /> :
                                       comp?.status === 'No cumple' ? <XCircle size={17} color="#dc2626" /> :
                                       comp?.status === 'No aplica' ? <MinusCircle size={17} color="#94a3b8" /> :
                                       <div style={{ width: 17, height: 17, borderRadius: '50%', border: '2px solid #cbd5e1' }} />}
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: comp?.status === 'No aplica' ? '#94a3b8' : 'var(--secondary)', lineHeight: 1.3, textDecoration: comp?.status === 'No aplica' ? 'line-through' : 'none' }}>{pnt.name}</div>
                                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>{pnt.code}</div>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                                      {comp?.eval_date ? fmtDate(comp.eval_date) : <span style={{ color: '#cbd5e1' }}>—</span>}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', textAlign: 'right', color: exp ? '#dc2626' : soon ? '#d97706' : 'var(--text-muted)', fontWeight: exp || soon ? 600 : 400 }}>
                                      {comp?.validity_date ? (exp ? '⚠ ' : soon ? '⏰ ' : '') + fmtDate(comp.validity_date) : <span style={{ color: '#cbd5e1' }}>—</span>}
                                    </div>
                                    <div style={{ fontSize: '0.73rem', color: '#64748b', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp?.evaluator || <span style={{ color: '#cbd5e1' }}>—</span>}</span>
                                      {comp?.evidence_url && <a href={comp.evidence_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)', flexShrink: 0 }} title={comp.evidence_name || 'Ver evidencia'}><Eye size={13} /></a>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

        </div>{/* /maxWidth */}

        <Modal open={showAbsenceForm} onClose={() => setShowAbsenceForm(false)} title={editingAbsence ? 'Editar ausencia' : 'Nueva ausencia'} width={520}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Tipo" half><select value={absenceForm.type} onChange={e => setAbsenceForm(p => ({ ...p, type: e.target.value }))} style={inputStyle}>{ABSENCE_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Estado" half><select value={absenceForm.status} onChange={e => setAbsenceForm(p => ({ ...p, status: e.target.value }))} style={inputStyle}>{ABSENCE_STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Fecha inicio" half><input type="date" value={absenceForm.start_date} onChange={e => setAbsenceForm(p => ({ ...p, start_date: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Fecha fin" half><input type="date" value={absenceForm.end_date} onChange={e => setAbsenceForm(p => ({ ...p, end_date: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Observaciones"><textarea value={absenceForm.notes} onChange={e => setAbsenceForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }} /></Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button className="btn btn-secondary" onClick={() => setShowAbsenceForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={saveAbsence} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Save size={16} /> Guardar</button>
          </div>
        </Modal>

        <Modal open={showDocForm} onClose={() => { setShowDocForm(false); setFileQueue([]); setQueueIndex(0); setDocFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} title={fileQueue.length > 1 ? `Subir documento (${queueIndex + 1} / ${fileQueue.length})` : 'Subir documento'} width={540}>
          {fileQueue.length > 1 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                <span>📎 {docFile?.name}</span>
                <span>{queueIndex + 1} de {fileQueue.length}</span>
              </div>
              <div style={{ height: '4px', borderRadius: '4px', background: 'var(--border)' }}>
                <div style={{ height: '100%', borderRadius: '4px', background: 'var(--primary)', width: `${((queueIndex + 1) / fileQueue.length) * 100}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Categoría"><select value={docForm.category} onChange={e => setDocForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>{DOC_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Field>
            <Field label="Nombre del documento" half><input value={docForm.name} onChange={e => setDocForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="Ej: Contrato indefinido 2024" /></Field>
            <Field label="Fecha emisión" half><input type="date" value={docForm.issue_date} onChange={e => setDocForm(p => ({ ...p, issue_date: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Fecha vencimiento" half><input type="date" value={docForm.expiry_date} onChange={e => setDocForm(p => ({ ...p, expiry_date: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Observaciones"><textarea value={docForm.notes} onChange={e => setDocForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} /></Field>
            <Field label="Fichero (PDF / imagen)">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 1) { openFileQueue(e.dataTransfer.files); } else if (e.dataTransfer.files[0]) { setDocFile(e.dataTransfer.files[0]); setDocForm(p => ({ ...p, name: p.name || guessName(e.dataTransfer.files[0]) })); } }}
                style={{ border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '10px', padding: '20px', textAlign: 'center', cursor: 'pointer', backgroundColor: dragOver ? '#f0f7ff' : '#fafafa', transition: 'border-color 0.15s, background-color 0.15s' }}>
                <Upload size={24} color={dragOver ? 'var(--primary)' : 'var(--text-muted)'} style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {docFile
                    ? <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>📎 {docFile.name}</span>
                    : <span>Arrastra uno o varios ficheros aquí o <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>haz clic para seleccionar</span></span>}
                </div>
              </div>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={e => { if (e.target.files.length > 1) { openFileQueue(e.target.files); } else if (e.target.files[0]) { setDocFile(e.target.files[0]); setDocForm(p => ({ ...p, name: p.name || guessName(e.target.files[0]) })); } }} />
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button className="btn btn-secondary" onClick={() => { setShowDocForm(false); setFileQueue([]); setQueueIndex(0); setDocFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Cancelar</button>
            <button className="btn btn-primary" onClick={uploadDocument} disabled={uploadingDoc} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {uploadingDoc ? <Clock size={16} /> : <Upload size={16} />}
              {uploadingDoc ? 'Subiendo...' : fileQueue.length > 1 && queueIndex < fileQueue.length - 1 ? `Subir y siguiente (${fileQueue.length - queueIndex - 1} restantes)` : 'Subir documento'}
            </button>
          </div>
        </Modal>

        <EmployeeFormModal open={showEmployeeForm} onClose={() => setShowEmployeeForm(false)} formData={formData} setFormData={setFormData} saving={saving} onSave={saveEmployee} isEdit={!!editingEmployee} />

        <Modal open={!!editingDoc} onClose={() => setEditingDoc(null)} title="Editar documento" width={520}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Field label="Nombre">
              <input value={editDocForm.name || ''} onChange={e => setEditDocForm(p => ({ ...p, name: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.9rem' }} />
            </Field>
            <Field label="Categoría">
              <select value={editDocForm.category || ''} onChange={e => setEditDocForm(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.9rem' }}>
                {DOC_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Field label="Fecha emisión">
                <input type="date" value={editDocForm.issue_date || ''} onChange={e => setEditDocForm(p => ({ ...p, issue_date: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.9rem' }} />
              </Field>
              <Field label="Fecha vencimiento">
                <input type="date" value={editDocForm.expiry_date || ''} onChange={e => setEditDocForm(p => ({ ...p, expiry_date: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.9rem' }} />
              </Field>
            </div>
            <Field label="Notas">
              <textarea value={editDocForm.notes || ''} onChange={e => setEditDocForm(p => ({ ...p, notes: e.target.value }))} rows={3} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.9rem', resize: 'vertical' }} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
              <button onClick={() => setEditingDoc(null)} style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.9rem' }}>Cancelar</button>
              <button onClick={saveEditDoc} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>Guardar</button>
            </div>
          </div>
        </Modal>

        {/* ── Modal Historial de Evaluaciones ─────────────────────────────── */}
        <Modal open={showEvalHistoryForm} onClose={() => { setShowEvalHistoryForm(false); setEditingEvalHistory(null); setEvalHistoryForm(emptyEvalForm()); setEvalHistFile(null); }} title={editingEvalHistory ? 'Editar evaluación' : 'Nueva evaluación'} width={440}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="Fecha de evaluación">
              <input type="date" value={evalHistoryForm.eval_date} onChange={e => setEvalHistoryForm(p => ({ ...p, eval_date: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="PDF de la evaluación">
              <div onClick={() => evalHistFileRef.current?.click()}
                style={{ border: `2px dashed ${evalHistFile ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '8px', padding: '16px', cursor: 'pointer', background: evalHistFile ? '#f0f7ff' : '#fafafa', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.15s' }}>
                <Upload size={18} color={evalHistFile ? 'var(--primary)' : '#94a3b8'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {evalHistFile ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{evalHistFile.name}</span>
                  ) : evalHistoryForm.document_name ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{evalHistoryForm.document_name} · <span style={{ color: 'var(--primary)' }}>Cambiar</span></span>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Seleccionar PDF o documento</span>
                  )}
                </div>
                {evalHistoryForm.document_url && !evalHistFile && (
                  <a href={evalHistoryForm.document_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)', flexShrink: 0 }} title="Ver documento actual"><Eye size={15} /></a>
                )}
              </div>
              <input ref={evalHistFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) setEvalHistFile(e.target.files[0]); }} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '4px' }}>
              <button className="btn btn-secondary" onClick={() => { setShowEvalHistoryForm(false); setEditingEvalHistory(null); setEvalHistoryForm(emptyEvalForm()); setEvalHistFile(null); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveEvalHistoryEntry} disabled={savingEvalHistory || uploadingEvalHist} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {uploadingEvalHist ? <Clock size={15} /> : <Save size={15} />}
                {uploadingEvalHist ? 'Subiendo...' : savingEvalHistory ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>

        {/* ── Modal Entrada Historial PNT ──────────────────────────────────── */}
        <Modal open={showCompHistForm} onClose={() => { setShowCompHistForm(false); setEditingCompHist(null); setCompHistForm(emptyCompHistForm()); }} title={editingCompHist ? 'Editar entrada del historial' : 'Nueva entrada del historial'} width={480}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Field label="Resultado">
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { val: 'Cumple',    color: '#16a34a', bg: '#f0fdf4' },
                  { val: 'No cumple', color: '#dc2626', bg: '#fef2f2' },
                  { val: 'No aplica', color: '#64748b', bg: '#f1f5f9' },
                ].map(({ val, color, bg }) => (
                  <button key={val} type="button" onClick={() => setCompHistForm(p => ({ ...p, status: val }))}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', border: `2px solid ${compHistForm.status === val ? color : 'var(--border)'}`, background: compHistForm.status === val ? bg : 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', color: compHistForm.status === val ? color : 'var(--text-muted)', transition: 'all 0.15s' }}>
                    {val}
                  </button>
                ))}
              </div>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Fecha evaluación">
                <input type="date" value={compHistForm.eval_date} onChange={e => setCompHistForm(p => ({ ...p, eval_date: e.target.value }))} style={inputStyle} />
              </Field>
              <Field label="Fecha validez">
                <input type="date" value={compHistForm.validity_date} onChange={e => setCompHistForm(p => ({ ...p, validity_date: e.target.value }))} style={inputStyle} />
              </Field>
            </div>
            <Field label="Evaluador">
              <input value={compHistForm.evaluator} onChange={e => setCompHistForm(p => ({ ...p, evaluator: e.target.value }))} style={inputStyle} placeholder="Nombre del evaluador" />
            </Field>
            <Field label="Justificación / Observaciones">
              <textarea value={compHistForm.justification} onChange={e => setCompHistForm(p => ({ ...p, justification: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
              <button className="btn btn-secondary" onClick={() => { setShowCompHistForm(false); setEditingCompHist(null); setCompHistForm(emptyCompHistForm()); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveCompHistEntry} disabled={savingCompHist} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={14} />{savingCompHist ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>

        {/* ── Modal Evaluación Competencia ──────────────────────────────────── */}
        <Modal open={!!editingComp} onClose={() => { setEditingComp(null); setCompMode(null); }}
          title={editingComp ? `${editingComp.pnt.code}` : ''} width={560}>
          {editingComp && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ── Vista: Historial (compMode === null) ── */}
              {compMode === null && (() => {
                const today = new Date();
                const vd = editingComp.existing?.validity_date;
                const expired = vd && new Date(vd) < today;
                const soon = vd && !expired && (new Date(vd) - today) < 60 * 24 * 60 * 60 * 1000;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Banner validez */}
                    {expired && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        <AlertTriangle size={15} /> Evaluación CADUCADA el {fmtDate(vd)} — se requiere nueva evaluación
                      </div>
                    )}
                    {soon && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={15} /> Evaluación próxima a caducar el {fmtDate(vd)}
                      </div>
                    )}

                    {/* Tabla de historial */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                      {/* Cabecera */}
                      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 60px', gap: '0', background: '#f8fafc', borderBottom: '1px solid var(--border)', padding: '8px 14px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <span>Fecha</span><span>Resultado</span><span>Evaluador</span><span></span>
                      </div>
                      {compHistory.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Sin evaluaciones registradas
                        </div>
                      ) : (
                        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                          {compHistory.map((h, i) => {
                            const isLatest = i === 0;
                            const statusColor = h.status === 'Cumple' ? '#16a34a' : h.status === 'No aplica' ? '#64748b' : '#dc2626';
                            const statusBg = h.status === 'Cumple' ? '#f0fdf4' : h.status === 'No aplica' ? '#f1f5f9' : '#fef2f2';
                            return (
                              <div key={h.id}
                                onClick={() => openEditCompHist(h)}
                                style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 60px', gap: '0', padding: '10px 14px', borderBottom: i < compHistory.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.1s', alignItems: 'center' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                                <div style={{ fontSize: '0.82rem', color: 'var(--secondary)', fontWeight: isLatest ? 700 : 400 }}>
                                  {fmtDate(h.eval_date)}
                                  {isLatest && <div style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 600 }}>Última</div>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: statusBg, color: statusColor, fontSize: '0.75rem', fontWeight: 700 }}>
                                    {h.status === 'Cumple' ? <CheckCircle size={11} /> : h.status === 'No aplica' ? <MinusCircle size={11} /> : <XCircle size={11} />}
                                    {h.status}
                                  </span>
                                  {h.evidence_url && <a href={h.evidence_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="Ver documento" style={{ color: 'var(--primary)' }}><Eye size={13} /></a>}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.evaluator || '—'}</div>
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                  <button type="button" onClick={e => { e.stopPropagation(); deleteCompHistEntry(h.id); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '3px', borderRadius: '4px' }} title="Eliminar">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Botones de acción */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button onClick={() => { setEditingComp(null); setCompHistory([]); setEditingHistEntry(null); }}
                        style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                        Cerrar
                      </button>
                      <button onClick={() => { setEditingHistEntry(null); setCompForm({ status: '', justification: '', eval_date: '', validity_date: '', evaluator: '', evidence_url: null, evidence_name: null }); setCompEvidenceFile(null); setCompMode('new'); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '8px', border: 'none', background: expired ? '#dc2626' : 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                        <Plus size={15} /> Nueva evaluación
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── Vista: Formulario (compMode !== null) ── */}
              {compMode !== null && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Banner modo */}
                  {compMode === 'new' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f0fdf4', borderRadius: '8px', fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>
                      <CheckCircle size={13} /> Nueva evaluación — quedará registrada en el historial al guardar
                    </div>
                  )}
                  {compMode === 'edit' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#fefce8', borderRadius: '8px', fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>
                      <Pencil size={13} />
                      Editando evaluación del {fmtDate(editingHistEntry?.eval_date || editingComp.existing?.eval_date)} — los cambios sobreescriben ese registro
                    </div>
                  )}

                  <Field label="Resultado de la evaluación">
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[
                        { val: 'Cumple',    icon: <CheckCircle size={15} />,   active: { border: '#16a34a', bg: '#f0fdf4', color: '#16a34a' } },
                        { val: 'No cumple', icon: <XCircle size={15} />,       active: { border: '#dc2626', bg: '#fef2f2', color: '#dc2626' } },
                        { val: 'No aplica', icon: <MinusCircle size={15} />,   active: { border: '#94a3b8', bg: '#f1f5f9', color: '#64748b' } },
                      ].map(({ val, icon, active }) => (
                        <button key={val} type="button" onClick={() => setCompForm(p => ({ ...p, status: p.status === val ? '' : val }))}
                          style={{ flex: 1, padding: '9px 6px', borderRadius: '8px', border: `2px solid ${compForm.status === val ? active.border : 'var(--border)'}`, background: compForm.status === val ? active.bg : 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', color: compForm.status === val ? active.color : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s' }}>
                          {icon}{val}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label={compForm.status === 'No aplica' ? 'Motivo (opcional)' : 'Justificación / Observaciones'}>
                    <textarea value={compForm.justification} onChange={e => setCompForm(p => ({ ...p, justification: e.target.value }))}
                      rows={3} placeholder={compForm.status === 'No aplica' ? 'Ej: El puesto no requiere esta competencia...' : 'Ej: Evaluación práctica supervisada...'} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.88rem', resize: 'vertical' }} />
                  </Field>

                  {compForm.status !== 'No aplica' && (
                    <>
                      <Field label="Documentación justificativa">
                        <div onClick={() => compEvidenceRef.current?.click()}
                          style={{ border: `2px dashed ${compEvidenceFile ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '8px', padding: '12px 16px', cursor: 'pointer', background: compEvidenceFile ? '#f0f7ff' : '#fafafa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Upload size={16} color={compEvidenceFile ? 'var(--primary)' : '#94a3b8'} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {compEvidenceFile ? (
                              <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{compEvidenceFile.name}</span>
                            ) : compForm.evidence_name ? (
                              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Adjunto: {compForm.evidence_name} · <span style={{ color: 'var(--primary)' }}>Cambiar</span></span>
                            ) : (
                              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Adjuntar PDF, imagen o documento</span>
                            )}
                          </div>
                          {compForm.evidence_url && !compEvidenceFile && (
                            <a href={compForm.evidence_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)', display: 'flex', flexShrink: 0 }}><Eye size={15} /></a>
                          )}
                        </div>
                        <input ref={compEvidenceRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }}
                          onChange={e => { if (e.target.files[0]) setCompEvidenceFile(e.target.files[0]); }} />
                      </Field>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <Field label="Fecha de evaluación">
                          <input type="date" value={compForm.eval_date} onChange={e => setCompForm(p => ({ ...p, eval_date: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.88rem' }} />
                        </Field>
                        <Field label="Fecha de validez">
                          <input type="date" value={compForm.validity_date} onChange={e => setCompForm(p => ({ ...p, validity_date: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.88rem' }} />
                        </Field>
                      </div>
                      <Field label="Evaluador">
                        <input value={compForm.evaluator} onChange={e => setCompForm(p => ({ ...p, evaluator: e.target.value }))}
                          placeholder="Nombre del evaluador" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.88rem' }} />
                      </Field>
                    </>
                  )}

                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={14} />
                    La firma física del evaluador queda acreditada en el documento AX-12-A adjunto en la sección Documentos.
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                    <button onClick={() => { setCompMode(null); setEditingHistEntry(null); setCompEvidenceFile(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                      ← Volver al historial
                    </button>
                    <button onClick={saveComp} disabled={!compForm.status || uploadingCompEvidence}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '8px', border: 'none', background: compForm.status && !uploadingCompEvidence ? 'var(--primary)' : '#94a3b8', color: 'white', cursor: compForm.status && !uploadingCompEvidence ? 'pointer' : 'default', fontSize: '0.9rem', fontWeight: 600 }}>
                      {uploadingCompEvidence ? <Clock size={15} /> : <Save size={15} />}
                      {uploadingCompEvidence ? 'Subiendo...' : 'Guardar evaluación'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}
        </Modal>

        {showSalaryPrompt && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '28px 32px', width: '320px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Shield size={20} color="#7c3aed" />
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--secondary)' }}>Datos protegidos</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Introduce la contraseña para ver los datos económicos.</p>
              <input
                type="password"
                value={salaryPwdInput}
                onChange={e => setSalaryPwdInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSalaryUnlock()}
                autoFocus
                placeholder="Contraseña"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '16px' }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowSalaryPrompt(false); setSalaryPwdInput(''); }}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
                <button type="button" onClick={handleSalaryUnlock}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Ver datos</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── RENDER: Lista completa ─────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="layout">
        <aside className="sidebar" style={{ backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
          <div className="sidebar-header" style={{ padding: '0 10px', height: '180px' }}>
            <img src={logo} alt="HSLAB Logo" className="sidebar-logo" />
          </div>
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => setView('dashboard')}
              style={{ width: '100%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)', display: 'flex', justifyContent: 'center', fontWeight: 'bold' }}>
              ← Panel principal
            </button>
            <button className="btn btn-primary" onClick={openNewEmployee} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
              <UserPlus size={16} /> Nuevo empleado
            </button>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Filtros</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ ...inputStyle, fontSize: '0.85rem' }}>
                <option value="Todos">Todos los departamentos</option>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
              <select value={filterDelegacion} onChange={e => setFilterDelegacion(e.target.value)} style={{ ...inputStyle, fontSize: '0.85rem' }}>
                <option value="Todos">Todas las delegaciones</option>
                {DELEGACIONES.map(d => <option key={d}>{d}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, fontSize: '0.85rem' }}>
                <option value="Todos">Todos los estados</option>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '16px', marginTop: '8px' }}>
            <div onClick={() => setView('candidates')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--primary-light)'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = ''}>
              <UserSearch size={16} /> Candidatos
            </div>
          </div>
        </aside>

        <main className="main-content" style={{ padding: '32px', display: 'block', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h2 className="page-title" style={{ margin: '0 0 4px 0' }}>
                {filterDept !== 'Todos' ? filterDept : 'Toda la plantilla'}
              </h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{filteredEmployees.length} empleados</p>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <input type="text" placeholder="Buscar por nombre o cargo..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, maxWidth: '380px' }} />
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Cargando plantilla...</div>
          ) : filteredEmployees.length === 0 ? (
            <EmptyState icon={<Users size={48} />} text="No hay empleados con estos filtros" />
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    {['Empleado', 'Cargo', 'Dpto.', 'Delegación', 'Contrato', 'Alta', 'Estado', ''].map(h => (
                      <th key={h} style={{ padding: '13px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => (
                    <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = ''}
                      onClick={() => openEmployee(emp)}>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar name={emp.full_name} dept={emp.department} size={36} />
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--secondary)' }}>{emp.full_name}</div>
                            {emp.email && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{emp.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{emp.position || '—'}</td>
                      <td style={{ padding: '13px 16px', fontSize: '0.85rem' }}>
                        {emp.department && (
                          <span style={{ backgroundColor: DEPT_STYLE[emp.department]?.bg || '#f1f5f9', color: DEPT_STYLE[emp.department]?.color || '#475569', padding: '2px 8px', borderRadius: '999px', fontWeight: 600, fontSize: '0.78rem' }}>
                            {emp.department}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: '0.9rem' }}>{emp.delegacion || '—'}</td>
                      <td style={{ padding: '13px 16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{emp.contract_type || '—'}</td>
                      <td style={{ padding: '13px 16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{fmtDate(emp.hire_date)}</td>
                      <td style={{ padding: '13px 16px' }}><Badge label={emp.status} {...(STATUS_COLORS[emp.status] || {})} /></td>
                      <td style={{ padding: '13px 16px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => openEditEmployee(emp)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }} title="Editar"><Edit size={16} /></button>
                          <button onClick={() => deleteEmployee(emp)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }} title="Eliminar"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>

        <EmployeeFormModal open={showEmployeeForm} onClose={() => setShowEmployeeForm(false)} formData={formData} setFormData={setFormData} saving={saving} onSave={saveEmployee} isEdit={!!editingEmployee} />
      </div>
    );
  }

  // ── Valores derivados para el dashboard ──────────────────────────────────────
  const consultList = consultByZone(consultZone);
  const labList = (() => {
    const base = byDept('Laboratorio');
    if (labZone === 'Baleares') return base.filter(e => e.delegacion === 'Baleares');
    if (labZone === 'Canarias') return base.filter(e => CANARIAS_DELEG.includes(e.delegacion));
    return base;
  })();
  const dirList = byDept('Dirección');
  const opList = byDept('Operaciones');

  // ── RENDER: Candidatos ───────────────────────────────────────────────────────
  if (view === 'candidates') {
    return (
      <div className="layout">
        <aside className="sidebar" style={{ backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
          <div className="sidebar-header" style={{ padding: '0 10px', height: '180px' }}>
            <img src={logo} alt="HSLAB Logo" className="sidebar-logo" />
          </div>
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
            <button className="btn btn-secondary" onClick={() => setView('dashboard')}
              style={{ width: '100%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)', display: 'flex', justifyContent: 'center', fontWeight: 'bold' }}>
              ← Panel principal
            </button>
          </div>
          <nav className="nav-links" style={{ marginTop: '12px' }}>
            <div className="nav-item active" style={{ color: 'var(--primary)', backgroundColor: 'var(--primary-light)' }}>
              <UserSearch size={18} /><span>Candidatos</span>
            </div>
            <div className="nav-item" onClick={() => setView('dashboard')} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
              <Users size={18} /><span>Panel RRHH</span>
            </div>
            <div className="nav-item" onClick={() => goToList('Todos', 'Todos')} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
              <Briefcase size={18} /><span>Plantilla</span>
            </div>
            <div className="nav-item" onClick={() => setView('calendar')} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
              <Calendar size={18} /><span>Calendario vacaciones</span>
            </div>
          </nav>
          <div style={{ margin: '16px', padding: '14px', backgroundColor: 'var(--primary-light)', borderRadius: '10px', fontSize: '0.82rem', color: 'var(--primary)' }}>
            <div style={{ fontWeight: 700, marginBottom: '6px', fontSize: '0.85rem' }}>Resumen</div>
            <div>Total: <strong>{candidates.length}</strong></div>
            <div>Sin contactar: <strong>{candidates.filter(c => !c.contacted).length}</strong></div>
            <div>Contratados: <strong>{candidates.filter(c => c.status === 'Contratado').length}</strong></div>
          </div>
        </aside>
        <main className="main-content" style={{ padding: '32px', display: 'block', overflowY: 'auto' }}>
          <CandidatesView candidates={candidates} onReload={loadCandidates} />
        </main>
      </div>
    );
  }

  // ── RENDER: Calendario ───────────────────────────────────────────────────────
  if (view === 'calendar') {
    return (
      <div className="layout">
        <aside className="sidebar" style={{ backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
          <div className="sidebar-header" style={{ padding: '0 10px', height: '180px' }}>
            <img src={logo} alt="HSLAB Logo" className="sidebar-logo" />
          </div>
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setView('dashboard')}
              style={{ width: '100%', backgroundColor: 'var(--primary)', color: 'white', border: 'none', display: 'flex', justifyContent: 'center', fontWeight: 'bold' }}>
              ← Volver al Panel RRHH
            </button>
          </div>
          <nav className="nav-links" style={{ marginTop: '12px' }}>
            <div className="nav-item active" style={{ color: 'var(--primary)', backgroundColor: 'var(--primary-light)' }}>
              <Calendar size={18} /><span>Calendario vacaciones</span>
            </div>
            <div className="nav-item" onClick={() => goToList('Todos', 'Todos')} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
              <Users size={18} /><span>Plantilla</span>
            </div>
            <div className="nav-item" onClick={() => setView('candidates')} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
              <UserSearch size={18} /><span>Candidatos</span>
            </div>
          </nav>
        </aside>
        <main className="main-content" style={{ padding: '32px', display: 'block', overflowY: 'auto' }}>
          <VacationCalendar />
        </main>
      </div>
    );
  }

  // ── RENDER: Dashboard ──────────────────────────────────────────────────────
  return (
    <div className="layout">
      <aside className="sidebar" style={{ backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
        <div className="sidebar-header" style={{ padding: '0 10px', height: '180px' }}>
          <img src={logo} alt="HSLAB Logo" className="sidebar-logo" />
        </div>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={onBackToHub}
            style={{ width: '100%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)', display: 'flex', justifyContent: 'center', fontWeight: 'bold' }}>
            ← Volver al Hub
          </button>
          <button className="btn btn-primary" onClick={openNewEmployee} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
            <UserPlus size={16} /> Nuevo empleado
          </button>
        </div>
        <nav className="nav-links" style={{ marginTop: '12px' }}>
          <div className="nav-item active" style={{ color: 'var(--primary)', backgroundColor: 'var(--primary-light)' }}>
            <Users size={18} /><span>Panel RRHH</span>
          </div>
          <div className="nav-item" onClick={() => goToList('Consultoría', 'Activo')} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
            <Briefcase size={18} /><span>Consultoría</span>
          </div>
          <div className="nav-item" onClick={() => goToList('Laboratorio', 'Activo')} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
            <FlaskConical size={18} /><span>Laboratorio</span>
          </div>
          <div className="nav-item" onClick={() => goToList('Dirección', 'Todos')} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
            <Building2 size={18} /><span>Dirección</span>
          </div>
          <div className="nav-item" onClick={() => goToList('Operaciones', 'Activo')} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
            <ClipboardList size={18} /><span>Operaciones</span>
          </div>
          <div className="nav-item" onClick={() => goToList('Todos', 'Todos')} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
            <Users size={18} /><span>Ver toda la plantilla</span>
          </div>
          <div className="nav-item" onClick={() => setView('candidates')}
            style={{ color: 'var(--text-muted)', cursor: 'pointer', borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: '8px', paddingTop: '12px' }}>
            <UserSearch size={18} /><span>Candidatos {candidates.filter(c => !c.contacted).length > 0 && <span style={{ backgroundColor: 'var(--primary)', color: 'white', borderRadius: '999px', padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700, marginLeft: '4px' }}>{candidates.filter(c => !c.contacted).length}</span>}</span>
          </div>
          <div className="nav-item" onClick={() => setView('calendar')} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
            <Calendar size={18} /><span>Calendario vacaciones</span>
          </div>
        </nav>
      </aside>

      <main className="main-content" style={{ padding: '32px', display: 'block', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 className="page-title" style={{ margin: '0 0 4px 0' }}>Recursos Humanos</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Gestión de plantilla, ausencias y documentación</p>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Total plantilla', value: kpis.total,     color: 'var(--primary)',  bg: 'var(--primary-light)', dept: 'Todos',  status: 'Todos' },
            { label: 'Activos',         value: kpis.activos,   color: '#166534',         bg: '#dcfce7',              dept: 'Todos',  status: 'Activo' },
            { label: 'De baja',         value: kpis.bajas,     color: '#991b1b',         bg: '#fee2e2',              dept: 'Todos',  status: 'Baja' },
            { label: 'Pendientes',      value: kpis.pendientes,color: '#92400e',         bg: '#fef3c7',              dept: 'Todos',  status: 'Pendiente' },
          ].map(k => (
            <div key={k.label} onClick={() => goToList(k.dept, k.status)}
              style={{ backgroundColor: k.bg, borderRadius: '12px', padding: '16px 20px', cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: k.color, textTransform: 'uppercase', marginBottom: '4px' }}>{k.label}</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Bloques principales */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

          {/* ── Consultoría ── */}
          <div style={{ backgroundColor: 'white', border: '1px solid var(--border)', borderTop: `4px solid #185FA5`, borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
              <Briefcase size={18} color="#185FA5" />
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--secondary)', marginLeft: '8px' }}>Consultoría</span>
              <span style={{ backgroundColor: '#e6f1fb', color: '#185FA5', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 600, marginLeft: '8px' }}>
                {byDept('Consultoría').length}
              </span>
            </div>

            {/* Filtro zona */}
            <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['Todos', 'Baleares', 'Canarias', 'Península'].map(z => (
                <button key={z} onClick={() => setConsultZone(z)}
                  style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: consultZone === z ? '1.5px solid #185FA5' : '1px solid var(--border)', backgroundColor: consultZone === z ? '#e6f1fb' : 'transparent', color: consultZone === z ? '#185FA5' : 'var(--text-muted)' }}>
                  {z === 'Todos' ? `Todos · ${byDept('Consultoría').length}` : z === 'Baleares' ? `Baleares · ${byDept('Consultoría').filter(e => e.delegacion === 'Baleares').length}` : z === 'Canarias' ? `Canarias · ${byDept('Consultoría').filter(e => CANARIAS_DELEG.includes(e.delegacion)).length}` : `Península · ${byDept('Consultoría').filter(e => PENINSULA_DELEG.includes(e.delegacion)).length}`}
                </button>
              ))}
            </div>

            <div style={{ padding: '8px', overflowY: 'auto', maxHeight: '340px' }}>
              {consultList.map(emp => (
                <EmpRow key={emp.id} emp={emp} onClick={() => openEmployee(emp)} />
              ))}
              {consultList.length === 0 && <EmptyState icon={<Briefcase size={32} />} text="Sin resultados" />}
            </div>
          </div>

          {/* ── Derecha: Lab + Dirección + stats ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Laboratorio */}
            <div style={{ backgroundColor: 'white', border: '1px solid var(--border)', borderTop: '4px solid #534AB7', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
                <FlaskConical size={18} color="#534AB7" />
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--secondary)', marginLeft: '8px' }}>Laboratorio</span>
                <span style={{ backgroundColor: '#eeedfe', color: '#534AB7', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 600, marginLeft: '8px' }}>
                  {byDept('Laboratorio').length}
                </span>
              </div>
              <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
                {[
                  { z: 'Todos',    label: `Todos · ${byDept('Laboratorio').length}` },
                  { z: 'Baleares', label: `Baleares · ${byDept('Laboratorio').filter(e => e.delegacion === 'Baleares').length}` },
                  { z: 'Canarias', label: `Canarias · ${byDept('Laboratorio').filter(e => CANARIAS_DELEG.includes(e.delegacion)).length}` },
                ].map(({ z, label }) => (
                  <button key={z} onClick={() => setLabZone(z)}
                    style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: labZone === z ? '1.5px solid #534AB7' : '1px solid var(--border)', backgroundColor: labZone === z ? '#eeedfe' : 'transparent', color: labZone === z ? '#534AB7' : 'var(--text-muted)' }}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ padding: '8px', overflowY: 'auto', maxHeight: '260px' }}>
                {labList.map(emp => (
                  <EmpRow key={emp.id} emp={emp} onClick={() => openEmployee(emp)} />
                ))}
                {labList.length === 0 && <EmptyState icon={<FlaskConical size={32} />} text="Sin resultados" />}
              </div>
            </div>

            {/* Dirección */}
            <div style={{ backgroundColor: 'white', border: '1px solid var(--border)', borderTop: '4px solid #993C1D', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
                <Building2 size={18} color="#993C1D" />
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--secondary)', marginLeft: '8px' }}>Dirección</span>
                <span style={{ backgroundColor: '#faece7', color: '#993C1D', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 600, marginLeft: '8px' }}>
                  {dirList.length}
                </span>
              </div>
              <div style={{ padding: '8px', overflowY: 'auto', maxHeight: '200px' }}>
                {dirList.map(emp => (
                  <EmpRow key={emp.id} emp={emp} onClick={() => openEmployee(emp)} />
                ))}
                {dirList.length === 0 && <EmptyState icon={<Building2 size={32} />} text="Sin resultados" />}
              </div>
            </div>

            {/* Operaciones */}
            <div style={{ backgroundColor: 'white', border: '1px solid var(--border)', borderTop: '4px solid #0E7490', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
                <ClipboardList size={18} color="#0E7490" />
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--secondary)', marginLeft: '8px' }}>Operaciones</span>
                <span style={{ backgroundColor: '#ecfeff', color: '#0E7490', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 600, marginLeft: '8px' }}>
                  {opList.length}
                </span>
              </div>
              <div style={{ padding: '8px', overflowY: 'auto', maxHeight: '200px' }}>
                {opList.map(emp => (
                  <EmpRow key={emp.id} emp={emp} onClick={() => openEmployee(emp)} />
                ))}
                {opList.length === 0 && <EmptyState icon={<ClipboardList size={32} />} text="Sin resultados" />}
              </div>
            </div>

          </div>
        </div>

        {/* Distribución por delegación */}
        <div style={{ backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '14px' }}>
            Distribución por delegación
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px' }}>
            {delagDist.map(d => (
              <div key={d.deleg} onClick={() => goToList('Todos', 'Todos', d.deleg)}
                style={{ textAlign: 'center', padding: '12px 8px', backgroundColor: 'var(--primary-light)', borderRadius: '10px', cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
                onMouseOut={e => e.currentTarget.style.opacity = '1'}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>{d.count}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <EmployeeFormModal open={showEmployeeForm} onClose={() => setShowEmployeeForm(false)} formData={formData} setFormData={setFormData} saving={saving} onSave={saveEmployee} isEdit={!!editingEmployee} />
    </div>
  );

}

// ── Fila de empleado (dashboard) ──────────────────────────────────────────────
function EmpRow({ emp, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseOver={() => setHov(true)} onMouseOut={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', backgroundColor: hov ? 'var(--primary-light)' : 'transparent', transition: 'background 0.15s' }}>
      <Avatar name={emp.full_name} dept={emp.department} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.full_name}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{emp.position || '—'} · {emp.delegacion || '—'}</div>
      </div>
      <span style={{ backgroundColor: STATUS_COLORS[emp.status]?.bg, color: STATUS_COLORS[emp.status]?.color, borderRadius: '999px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600, flexShrink: 0 }}>
        {emp.status}
      </span>
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────
function SectionCard({ title, icon, children }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--primary)' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{children}</div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', fontSize: '0.88rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', minWidth: '120px' }}>
        <span style={{ flexShrink: 0 }}>{icon}</span>
        <span>{label}</span>
      </div>
      <span style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  );
}

function DocCard({ doc, color, onDelete, onEdit, onDragStart, onDragEnd, isDragging }) {
  const fmtSize = (b) => !b ? '' : b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
  const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
  const expiresSoon = doc.expiry_date && !isExpired && (new Date(doc.expiry_date) - new Date()) < 30 * 24 * 60 * 60 * 1000;
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart && onDragStart(); }}
      onDragEnd={() => onDragEnd && onDragEnd()}
      style={{ backgroundColor: 'white', border: '1px solid var(--border)', borderLeft: `4px solid ${color}`, borderRadius: '10px', padding: '14px 16px', opacity: isDragging ? 0.45 : 1, cursor: 'grab', transition: 'opacity 0.15s, box-shadow 0.15s', boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.18)' : 'none' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--secondary)', lineHeight: 1.3 }}>{doc.name}</div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
          {doc.file_url && <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', display: 'flex' }} title="Ver"><Eye size={15} /></a>}
          <button onClick={onEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }} title="Editar"><Pencil size={15} /></button>
          <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', padding: 0 }}><Trash2 size={15} /></button>
        </div>
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {doc.issue_date && <span>Emisión: {fmtDate(doc.issue_date)}</span>}
        {doc.expiry_date && (
          <span style={{ color: isExpired ? '#991b1b' : expiresSoon ? '#92400e' : 'inherit', fontWeight: isExpired || expiresSoon ? 600 : 400 }}>
            {isExpired ? '⚠ Vencido: ' : expiresSoon ? '⚡ Vence: ' : 'Vence: '}{fmtDate(doc.expiry_date)}
          </span>
        )}
        {doc.file_name && <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', display: 'block' }} title={doc.file_name}>{doc.file_name}{doc.file_size ? ` · ${fmtSize(doc.file_size)}` : ''}</span>}
      </div>
      {doc.notes && <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{doc.notes}</div>}
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
      <div style={{ marginBottom: '12px', opacity: 0.3 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: '0.95rem' }}>{text}</p>
    </div>
  );
}

function EmployeeFormModal({ open, onClose, formData, setFormData, saving, onSave, isEdit }) {
  const set = (field) => (e) => setFormData(p => ({ ...p, [field]: e.target.value }));
  const positions = POSITIONS_BY_DEPT[formData.department] || [];

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar empleado' : 'Nuevo empleado'} width={760}>
      <SectionHeader label="Datos personales" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
        <Field label="Nombre completo *">
          <input value={formData.full_name} onChange={set('full_name')} style={inputStyle} placeholder="Nombre y apellidos" />
        </Field>
        <Field label="DNI / NIE" half><input value={formData.dni} onChange={set('dni')} style={inputStyle} /></Field>
        <Field label="Email" half><input type="email" value={formData.email} onChange={set('email')} style={inputStyle} /></Field>
        <Field label="Teléfono" half><input value={formData.phone} onChange={set('phone')} style={inputStyle} /></Field>
        <Field label="Dirección"><input value={formData.address} onChange={set('address')} style={inputStyle} /></Field>
        <Field label="Fecha nacimiento" half><input type="date" value={formData.birth_date} onChange={set('birth_date')} style={inputStyle} /></Field>
        <Field label="Titulación">
          <input value={formData.titulacion} onChange={set('titulacion')} style={inputStyle} placeholder="Ej: Grado en Biología, Máster en Microbiología..." />
        </Field>
      </div>

      <SectionHeader label="Datos laborales" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
        <Field label="Nº empleado" half><input value={formData.employee_number} onChange={set('employee_number')} style={inputStyle} /></Field>
        <Field label="Departamento" half>
          <select value={formData.department} onChange={set('department')} style={inputStyle}>
            <option value="">— Sin departamento —</option>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Cargo / Puesto" half>
          {positions.length > 0 ? (
            <select value={formData.position} onChange={set('position')} style={inputStyle}>
              <option value="">— Seleccionar cargo —</option>
              {positions.map(p => <option key={p}>{p}</option>)}
            </select>
          ) : (
            <input value={formData.position} onChange={set('position')} style={inputStyle} placeholder="Cargo libre" />
          )}
        </Field>
        <Field label="Delegación" half>
          <select value={formData.delegacion} onChange={set('delegacion')} style={inputStyle}>
            {DELEGACIONES.map(d => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Fecha de alta" half><input type="date" value={formData.hire_date} onChange={set('hire_date')} style={inputStyle} /></Field>
        <Field label="Tipo de contrato" half>
          <select value={formData.contract_type} onChange={set('contract_type')} style={inputStyle}>
            {CONTRACT_TYPES.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Jornada" half><input value={formData.work_schedule} onChange={set('work_schedule')} style={inputStyle} placeholder="Ej: Completa, Parcial 20h..." /></Field>
        <Field label="Estado" half>
          <select value={formData.status} onChange={set('status')} style={inputStyle}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <SectionHeader label="Datos económicos" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
        <Field label="Salario bruto anual (€)" half><input type="number" value={formData.salary_gross} onChange={set('salary_gross')} style={inputStyle} placeholder="0.00" /></Field>
        <Field label="Salario neto anual (€)" half><input type="number" value={formData.salary_net} onChange={set('salary_net')} style={inputStyle} placeholder="0.00" /></Field>
        <Field label="IRPF %" half><input type="number" value={formData.irpf_pct} onChange={set('irpf_pct')} style={inputStyle} placeholder="0.00" /></Field>
        <Field label="Nº Seguridad Social" half><input value={formData.ss_number} onChange={set('ss_number')} style={inputStyle} /></Field>
        <Field label="IBAN bancario"><input value={formData.bank_iban} onChange={set('bank_iban')} style={inputStyle} placeholder="ES00 0000 0000 0000 0000 0000" /></Field>
      </div>

      <SectionHeader label="Observaciones" />
      <div style={{ marginBottom: '24px' }}>
        <textarea value={formData.notes} onChange={set('notes')} style={{ ...inputStyle, resize: 'vertical', minHeight: '80px', width: '100%' }} placeholder="Notas adicionales..." />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={onSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Save size={16} /> {saving ? 'Guardando...' : 'Guardar empleado'}
        </button>
      </div>
    </Modal>
  );
}

function SectionHeader({ label }) {
  return (
    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
      {label}
    </div>
  );
}
