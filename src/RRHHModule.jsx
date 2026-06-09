import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Users, UserPlus, ChevronLeft, Edit, Trash2, Save, X,
  FileText, Upload, Download, Calendar, AlertCircle,
  CheckCircle, Clock, Building2, Phone, Mail, CreditCard,
  Briefcase, MapPin, BookOpen, Shield, GraduationCap,
  FileBadge, FileSignature, Plus, Eye, ChevronDown, ChevronUp,
  Banknote, Hash
} from 'lucide-react';
import logo from './assets/logo.png';

// ── Constantes ───────────────────────────────────────────────────────────────
const DELEGACIONES = ['Baleares', 'Canarias', 'Ambas'];
const CONTRACT_TYPES = ['Indefinido', 'Temporal', 'Prácticas', 'Obra y servicio', 'Otro'];
const STATUSES = ['Activo', 'Baja', 'Excedencia', 'Pendiente'];
const ABSENCE_TYPES = ['Vacaciones', 'Baja médica', 'Permiso', 'Asuntos propios', 'Otro'];
const ABSENCE_STATUSES = ['Pendiente', 'Aprobado', 'Denegado'];

const DOC_CATEGORIES = [
  { key: 'Contrato',                  label: 'Contratos',                    icon: <FileSignature size={16} />, color: '#0076CE' },
  { key: 'Nómina',                    label: 'Nóminas',                      icon: <Banknote size={16} />,      color: '#16A34A' },
  { key: 'Titulación',                label: 'Titulaciones',                 icon: <GraduationCap size={16} />, color: '#7C3AED' },
  { key: 'Confidencialidad',          label: 'Confidencialidad',             icon: <Shield size={16} />,        color: '#DC2626' },
  { key: 'Política ISO',              label: 'Políticas ISO',                icon: <BookOpen size={16} />,      color: '#D97706' },
  { key: 'Certificado de capacitación', label: 'Certificados de capacitación', icon: <FileBadge size={16} />,  color: '#0891B2' },
  { key: 'Otro',                      label: 'Otros documentos',             icon: <FileText size={16} />,      color: '#6B7280' },
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

const emptyEmployee = () => ({
  full_name: '', dni: '', email: '', phone: '', address: '', birth_date: '',
  employee_number: '', position: '', department: '', delegacion: 'Baleares',
  hire_date: '', contract_type: 'Indefinido', work_schedule: '', status: 'Activo',
  salary_gross: '', salary_net: '', irpf_pct: '', ss_number: '', bank_iban: '', notes: '',
});

const emptyAbsence = (employeeId = '') => ({
  employee_id: employeeId, type: 'Vacaciones', start_date: '', end_date: '',
  status: 'Aprobado', notes: '',
});

// ── Componente Badge ─────────────────────────────────────────────────────────
const Badge = ({ label, bg, color }) => (
  <span style={{ backgroundColor: bg, color, borderRadius: '999px', padding: '2px 10px', fontSize: '0.78rem', fontWeight: 600 }}>
    {label}
  </span>
);

// ── Modal genérico ───────────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, children, width = 700 }) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
          <h3 style={{ margin: 0, color: 'var(--secondary)', fontSize: '1.1rem', fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={22} />
          </button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  );
};

// ── FormField ────────────────────────────────────────────────────────────────
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

// ── MÓDULO PRINCIPAL ─────────────────────────────────────────────────────────
export default function RRHHModule({ onBackToHub }) {
  const [activeTab, setActiveTab] = useState('plantilla');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDelegacion, setFilterDelegacion] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Activo');
  const [search, setSearch] = useState('');

  // Ficha empleado seleccionado
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [fichaTab, setFichaTab] = useState('datos');

  // Modales
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState(emptyEmployee());
  const [saving, setSaving] = useState(false);

  // Ausencias
  const [absences, setAbsences] = useState([]);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [absenceForm, setAbsenceForm] = useState(emptyAbsence());
  const [editingAbsence, setEditingAbsence] = useState(null);

  // Documentos
  const [documents, setDocuments] = useState([]);
  const [showDocForm, setShowDocForm] = useState(false);
  const [docForm, setDocForm] = useState({ category: 'Contrato', name: '', issue_date: '', expiry_date: '', notes: '' });
  const [docFile, setDocFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef(null);

  // ── Carga de datos ─────────────────────────────────────────────────────────
  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    setLoading(true);
    const { data } = await supabase.from('employees').select('*').order('full_name');
    setEmployees(data || []);
    setLoading(false);
  };

  const loadAbsences = async (employeeId) => {
    const { data } = await supabase.from('absences').select('*').eq('employee_id', employeeId).order('start_date', { ascending: false });
    setAbsences(data || []);
  };

  const loadDocuments = async (employeeId) => {
    const { data } = await supabase.from('employee_documents').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false });
    setDocuments(data || []);
  };

  const openEmployee = (emp) => {
    setSelectedEmployee(emp);
    setFichaTab('datos');
    loadAbsences(emp.id);
    loadDocuments(emp.id);
  };

  // ── CRUD Empleados ─────────────────────────────────────────────────────────
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
    // limpiar campos numéricos vacíos
    ['salary_gross', 'salary_net', 'irpf_pct'].forEach(k => {
      if (payload[k] === '') payload[k] = null;
    });
    ['birth_date', 'hire_date'].forEach(k => {
      if (payload[k] === '') payload[k] = null;
    });

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

  // ── CRUD Ausencias ─────────────────────────────────────────────────────────
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

  // ── Documentos (Supabase Storage) ─────────────────────────────────────────
  const uploadDocument = async () => {
    if (!docForm.name.trim()) return;
    setUploadingDoc(true);
    try {
      let file_url = null, file_name = null, file_size = null;

      if (docFile) {
        const ext = docFile.name.split('.').pop();
        const path = `${selectedEmployee.id}/${Date.now()}_${docFile.name}`;
        const { error } = await supabase.storage.from('employee-documents').upload(path, docFile);
        if (!error) {
          const { data: urlData } = supabase.storage.from('employee-documents').getPublicUrl(path);
          file_url = urlData.publicUrl;
          file_name = docFile.name;
          file_size = docFile.size;
        }
      }

      const payload = {
        employee_id: selectedEmployee.id,
        category: docForm.category,
        name: docForm.name,
        file_url,
        file_name,
        file_size,
        issue_date: docForm.issue_date || null,
        expiry_date: docForm.expiry_date || null,
        notes: docForm.notes,
      };

      await supabase.from('employee_documents').insert([payload]);
      setShowDocForm(false);
      setDocForm({ category: 'Contrato', name: '', issue_date: '', expiry_date: '', notes: '' });
      setDocFile(null);
      loadDocuments(selectedEmployee.id);
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

  // ── Filtrado listado ───────────────────────────────────────────────────────
  const filteredEmployees = employees.filter(e => {
    const matchDel = filterDelegacion === 'Todos' || e.delegacion === filterDelegacion || e.delegacion === 'Ambas';
    const matchStatus = filterStatus === 'Todos' || e.status === filterStatus;
    const matchSearch = !search || e.full_name.toLowerCase().includes(search.toLowerCase()) || (e.position || '').toLowerCase().includes(search.toLowerCase());
    return matchDel && matchStatus && matchSearch;
  });

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const activos = employees.filter(e => e.status === 'Activo').length;
  const bajas = employees.filter(e => e.status === 'Baja').length;
  const baleares = employees.filter(e => e.delegacion === 'Baleares' || e.delegacion === 'Ambas').length;
  const canarias = employees.filter(e => e.delegacion === 'Canarias' || e.delegacion === 'Ambas').length;

  // ── Render: Ficha de empleado ──────────────────────────────────────────────
  if (selectedEmployee) {
    const docsGrouped = DOC_CATEGORIES.map(cat => ({
      ...cat,
      docs: documents.filter(d => d.category === cat.key),
    }));

    const vacDays = absences.filter(a => a.type === 'Vacaciones' && a.status === 'Aprobado')
      .reduce((sum, a) => sum + (a.days || 0), 0);

    return (
      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar" style={{ backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
          <div className="sidebar-header" style={{ padding: '0 10px', height: '180px' }}>
            <img src={logo} alt="HSLAB Logo" className="sidebar-logo" />
          </div>
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setSelectedEmployee(null)}
              style={{ width: '100%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)', display: 'flex', justifyContent: 'center', fontWeight: 'bold' }}
            >
              ← Volver a Plantilla
            </button>
          </div>
          <nav className="nav-links" style={{ marginTop: '12px' }}>
            {[
              { key: 'datos',      label: 'Datos personales',   icon: <Users size={18} /> },
              { key: 'ausencias',  label: 'Vacaciones / Ausencias', icon: <Calendar size={18} /> },
              { key: 'documentos', label: 'Documentos',         icon: <FileText size={18} /> },
            ].map(t => (
              <div
                key={t.key}
                className={`nav-item ${fichaTab === t.key ? 'active' : ''}`}
                onClick={() => setFichaTab(t.key)}
                style={{ color: fichaTab === t.key ? 'white' : 'var(--text-muted)' }}
              >
                {t.icon}<span>{t.label}</span>
              </div>
            ))}
          </nav>
          {/* Mini resumen */}
          <div style={{ margin: '16px', padding: '14px', backgroundColor: 'var(--primary-light)', borderRadius: '10px', fontSize: '0.82rem', color: 'var(--primary)' }}>
            <div style={{ fontWeight: 700, marginBottom: '6px', fontSize: '0.85rem' }}>Resumen</div>
            <div>📅 Vacaciones: <strong>{vacDays} días</strong></div>
            <div>📎 Documentos: <strong>{documents.length}</strong></div>
          </div>
        </aside>

        {/* Main */}
        <main className="main-content" style={{ padding: '32px', overflowY: 'auto' }}>
          {/* Cabecera ficha */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 700, color: 'var(--primary)' }}>
                {selectedEmployee.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--secondary)' }}>{selectedEmployee.full_name}</h2>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{selectedEmployee.position || 'Sin cargo asignado'}</span>
                  {selectedEmployee.delegacion && (
                    <span style={{ fontSize: '0.8rem', backgroundColor: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
                      {selectedEmployee.delegacion}
                    </span>
                  )}
                  <Badge label={selectedEmployee.status} {...(STATUS_COLORS[selectedEmployee.status] || {})} />
                </div>
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => openEditEmployee(selectedEmployee)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Edit size={16} /> Editar ficha
            </button>
          </div>

          {/* ── TAB: Datos ── */}
          {fichaTab === 'datos' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Datos personales */}
              <SectionCard title="Datos personales" icon={<Users size={18} />}>
                <InfoRow icon={<Hash size={14} />}       label="DNI/NIE"      value={selectedEmployee.dni} />
                <InfoRow icon={<Mail size={14} />}       label="Email"        value={selectedEmployee.email} />
                <InfoRow icon={<Phone size={14} />}      label="Teléfono"     value={selectedEmployee.phone} />
                <InfoRow icon={<MapPin size={14} />}     label="Dirección"    value={selectedEmployee.address} />
                <InfoRow icon={<Calendar size={14} />}   label="F. nacimiento" value={fmtDate(selectedEmployee.birth_date)} />
              </SectionCard>

              {/* Datos laborales */}
              <SectionCard title="Datos laborales" icon={<Briefcase size={18} />}>
                <InfoRow icon={<Hash size={14} />}       label="Nº empleado"  value={selectedEmployee.employee_number} />
                <InfoRow icon={<Briefcase size={14} />}  label="Cargo"        value={selectedEmployee.position} />
                <InfoRow icon={<Building2 size={14} />}  label="Departamento" value={selectedEmployee.department} />
                <InfoRow icon={<MapPin size={14} />}     label="Delegación"   value={selectedEmployee.delegacion} />
                <InfoRow icon={<Calendar size={14} />}   label="Fecha alta"   value={fmtDate(selectedEmployee.hire_date)} />
                <InfoRow icon={<FileText size={14} />}   label="Contrato"     value={selectedEmployee.contract_type} />
                <InfoRow icon={<Clock size={14} />}      label="Jornada"      value={selectedEmployee.work_schedule} />
              </SectionCard>

              {/* Datos económicos */}
              <SectionCard title="Datos económicos" icon={<Banknote size={18} />}>
                <InfoRow icon={<Banknote size={14} />}   label="Salario bruto" value={fmtCurrency(selectedEmployee.salary_gross)} />
                <InfoRow icon={<Banknote size={14} />}   label="Salario neto"  value={fmtCurrency(selectedEmployee.salary_net)} />
                <InfoRow icon={<CreditCard size={14} />} label="IRPF %"        value={selectedEmployee.irpf_pct ? `${selectedEmployee.irpf_pct}%` : '—'} />
                <InfoRow icon={<Hash size={14} />}       label="Nº SS"         value={selectedEmployee.ss_number} />
                <InfoRow icon={<CreditCard size={14} />} label="IBAN"          value={selectedEmployee.bank_iban} />
              </SectionCard>

              {/* Notas */}
              {selectedEmployee.notes && (
                <SectionCard title="Observaciones" icon={<FileText size={18} />}>
                  <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '0.9rem' }}>{selectedEmployee.notes}</p>
                </SectionCard>
              )}
            </div>
          )}

          {/* ── TAB: Ausencias ── */}
          {fichaTab === 'ausencias' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: 'var(--secondary)' }}>Vacaciones y Ausencias</h3>
                <button
                  className="btn btn-primary"
                  onClick={() => { setEditingAbsence(null); setAbsenceForm(emptyAbsence(selectedEmployee.id)); setShowAbsenceForm(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Plus size={16} /> Nueva ausencia
                </button>
              </div>

              {/* Resumen vacaciones año actual */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                {ABSENCE_TYPES.map(type => {
                  const days = absences.filter(a => a.type === type && a.status === 'Aprobado').reduce((s, a) => s + (a.days || 0), 0);
                  if (!days) return null;
                  return (
                    <div key={type} style={{ backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 18px', minWidth: '120px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{type}</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>{days}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>días</div>
                    </div>
                  );
                })}
              </div>

              {absences.length === 0 ? (
                <EmptyState icon={<Calendar size={40} />} text="Sin ausencias registradas" />
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      {['Tipo', 'Inicio', 'Fin', 'Días', 'Estado', 'Notas', ''].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {absences.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{a.type}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{fmtDate(a.start_date)}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{fmtDate(a.end_date)}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)' }}>{a.days}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge label={a.status} {...(ABSENCE_STATUS_COLORS[a.status] || {})} />
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{a.notes || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => { setEditingAbsence(a); setAbsenceForm({ ...a }); setShowAbsenceForm(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}><Edit size={15} /></button>
                            <button onClick={() => deleteAbsence(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── TAB: Documentos ── */}
          {fichaTab === 'documentos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, color: 'var(--secondary)' }}>Documentación del empleado</h3>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowDocForm(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Plus size={16} /> Subir documento
                </button>
              </div>

              {documents.length === 0 ? (
                <EmptyState icon={<FileText size={40} />} text="Sin documentos subidos" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {docsGrouped.filter(g => g.docs.length > 0).map(group => (
                    <div key={group.key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ color: group.color }}>{group.icon}</span>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--secondary)' }}>{group.label}</span>
                        <span style={{ fontSize: '0.8rem', backgroundColor: '#f1f5f9', color: 'var(--text-muted)', borderRadius: '999px', padding: '1px 8px' }}>{group.docs.length}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                        {group.docs.map(doc => (
                          <DocCard key={doc.id} doc={doc} color={group.color} onDelete={() => deleteDocument(doc)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── Modal ausencia ── */}
        <Modal open={showAbsenceForm} onClose={() => setShowAbsenceForm(false)} title={editingAbsence ? 'Editar ausencia' : 'Nueva ausencia'} width={520}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Tipo" half>
              <select value={absenceForm.type} onChange={e => setAbsenceForm(p => ({ ...p, type: e.target.value }))} style={inputStyle}>
                {ABSENCE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Estado" half>
              <select value={absenceForm.status} onChange={e => setAbsenceForm(p => ({ ...p, status: e.target.value }))} style={inputStyle}>
                {ABSENCE_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Fecha inicio" half>
              <input type="date" value={absenceForm.start_date} onChange={e => setAbsenceForm(p => ({ ...p, start_date: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Fecha fin" half>
              <input type="date" value={absenceForm.end_date} onChange={e => setAbsenceForm(p => ({ ...p, end_date: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Observaciones">
              <textarea value={absenceForm.notes} onChange={e => setAbsenceForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }} />
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button className="btn btn-secondary" onClick={() => setShowAbsenceForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={saveAbsence} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={16} /> Guardar
            </button>
          </div>
        </Modal>

        {/* ── Modal subir documento ── */}
        <Modal open={showDocForm} onClose={() => setShowDocForm(false)} title="Subir documento" width={540}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Field label="Categoría">
              <select value={docForm.category} onChange={e => setDocForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                {DOC_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Nombre del documento" half>
              <input value={docForm.name} onChange={e => setDocForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="Ej: Contrato indefinido 2024" />
            </Field>
            <Field label="Fecha emisión" half>
              <input type="date" value={docForm.issue_date} onChange={e => setDocForm(p => ({ ...p, issue_date: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Fecha vencimiento" half>
              <input type="date" value={docForm.expiry_date} onChange={e => setDocForm(p => ({ ...p, expiry_date: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Observaciones">
              <textarea value={docForm.notes} onChange={e => setDocForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} />
            </Field>
            <Field label="Fichero (PDF / imagen)">
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '20px', textAlign: 'center', cursor: 'pointer', backgroundColor: '#fafafa' }}
              >
                <Upload size={24} color="var(--primary)" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {docFile ? docFile.name : 'Haz clic para seleccionar fichero'}
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={e => setDocFile(e.target.files[0])} />
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button className="btn btn-secondary" onClick={() => setShowDocForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={uploadDocument} disabled={uploadingDoc} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {uploadingDoc ? <Clock size={16} /> : <Upload size={16} />}
              {uploadingDoc ? 'Subiendo...' : 'Subir documento'}
            </button>
          </div>
        </Modal>

        {/* Modal editar empleado (reutiliza el mismo que en la lista) */}
        <EmployeeFormModal
          open={showEmployeeForm}
          onClose={() => setShowEmployeeForm(false)}
          formData={formData}
          setFormData={setFormData}
          saving={saving}
          onSave={saveEmployee}
          isEdit={!!editingEmployee}
        />
      </div>
    );
  }

  // ── Render: Listado de plantilla ───────────────────────────────────────────
  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar" style={{ backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
        <div className="sidebar-header" style={{ padding: '0 10px', height: '180px' }}>
          <img src={logo} alt="HSLAB Logo" className="sidebar-logo" />
        </div>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
          <button
            className="btn btn-secondary"
            onClick={onBackToHub}
            style={{ width: '100%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)', display: 'flex', justifyContent: 'center', fontWeight: 'bold' }}
          >
            ← Volver al Hub
          </button>
        </div>
        <nav className="nav-links" style={{ marginTop: '12px' }}>
          <div className="nav-item active" style={{ color: 'white' }}>
            <Users size={18} /><span>Plantilla</span>
          </div>
        </nav>

        {/* Filtros */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: 'auto' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Filtros</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
      </aside>

      {/* Main */}
      <main className="main-content" style={{ padding: '32px', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h2 className="page-title" style={{ margin: '0 0 4px 0' }}>Recursos Humanos</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Gestión de plantilla, ausencias y documentación</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={openNewEmployee}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <UserPlus size={18} /> Nuevo empleado
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'Total plantilla',  value: employees.length,  color: 'var(--primary)',  bg: 'var(--primary-light)' },
            { label: 'Activos',          value: activos,           color: '#166534',         bg: '#dcfce7' },
            { label: 'De baja',          value: bajas,             color: '#991b1b',         bg: '#fee2e2' },
            { label: 'Baleares / Canarias', value: `${baleares} / ${canarias}`, color: '#3730a3', bg: '#e0e7ff' },
          ].map(k => (
            <div key={k.label} style={{ backgroundColor: k.bg, borderRadius: '12px', padding: '18px 20px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: k.color, textTransform: 'uppercase', marginBottom: '6px' }}>{k.label}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Buscador */}
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Buscar por nombre o cargo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, maxWidth: '380px' }}
          />
        </div>

        {/* Tabla */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Cargando plantilla...</div>
        ) : filteredEmployees.length === 0 ? (
          <EmptyState icon={<Users size={48} />} text="No hay empleados con estos filtros" />
        ) : (
          <div style={{ backgroundColor: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Empleado', 'Cargo', 'Delegación', 'Contrato', 'Alta', 'Estado', ''].map(h => (
                    <th key={h} style={{ padding: '13px 16px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => (
                  <tr
                    key={emp.id}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = ''}
                    onClick={() => openEmployee(emp)}
                  >
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem', flexShrink: 0 }}>
                          {emp.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--secondary)' }}>{emp.full_name}</div>
                          {emp.email && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{emp.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{emp.position || '—'}</td>
                    <td style={{ padding: '13px 16px', fontSize: '0.9rem' }}>{emp.delegacion || '—'}</td>
                    <td style={{ padding: '13px 16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{emp.contract_type || '—'}</td>
                    <td style={{ padding: '13px 16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{fmtDate(emp.hire_date)}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <Badge label={emp.status} {...(STATUS_COLORS[emp.status] || {})} />
                    </td>
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

      {/* Modal nuevo/editar empleado */}
      <EmployeeFormModal
        open={showEmployeeForm}
        onClose={() => setShowEmployeeForm(false)}
        formData={formData}
        setFormData={setFormData}
        saving={saving}
        onSave={saveEmployee}
        isEdit={!!editingEmployee}
      />
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

function DocCard({ doc, color, onDelete }) {
  const fmtSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
  const expiresSoon = doc.expiry_date && !isExpired && (new Date(doc.expiry_date) - new Date()) < 30 * 24 * 60 * 60 * 1000;

  return (
    <div style={{ backgroundColor: 'white', border: `1px solid var(--border)`, borderLeft: `4px solid ${color}`, borderRadius: '10px', padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--secondary)', lineHeight: 1.3 }}>{doc.name}</div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
          {doc.file_url && (
            <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', display: 'flex' }} title="Ver / descargar">
              <Eye size={15} />
            </a>
          )}
          <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', padding: 0 }} title="Eliminar">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {doc.issue_date && <span>Emisión: {fmtDate(doc.issue_date)}</span>}
        {doc.expiry_date && (
          <span style={{ color: isExpired ? '#991b1b' : expiresSoon ? '#92400e' : 'inherit', fontWeight: isExpired || expiresSoon ? 600 : 400 }}>
            {isExpired ? '⚠ Vencido: ' : expiresSoon ? '⚡ Vence: ' : 'Vence: '}{fmtDate(doc.expiry_date)}
          </span>
        )}
        {doc.file_name && <span style={{ color: '#94a3b8' }}>{doc.file_name}{doc.file_size ? ` · ${fmtSize(doc.file_size)}` : ''}</span>}
      </div>
      {doc.notes && <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{doc.notes}</div>}
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
      <div style={{ marginBottom: '12px', opacity: 0.3 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: '0.95rem' }}>{text}</p>
    </div>
  );
}

function EmployeeFormModal({ open, onClose, formData, setFormData, saving, onSave, isEdit }) {
  const set = (field) => (e) => setFormData(p => ({ ...p, [field]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar empleado' : 'Nuevo empleado'} width={760}>
      {/* Sección: Datos personales */}
      <SectionHeader label="Datos personales" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
        <Field label="Nombre completo *">
          <input value={formData.full_name} onChange={set('full_name')} style={inputStyle} placeholder="Nombre y apellidos" />
        </Field>
        <Field label="DNI / NIE" half>
          <input value={formData.dni} onChange={set('dni')} style={inputStyle} />
        </Field>
        <Field label="Email" half>
          <input type="email" value={formData.email} onChange={set('email')} style={inputStyle} />
        </Field>
        <Field label="Teléfono" half>
          <input value={formData.phone} onChange={set('phone')} style={inputStyle} />
        </Field>
        <Field label="Dirección">
          <input value={formData.address} onChange={set('address')} style={inputStyle} />
        </Field>
        <Field label="Fecha nacimiento" half>
          <input type="date" value={formData.birth_date} onChange={set('birth_date')} style={inputStyle} />
        </Field>
      </div>

      {/* Sección: Datos laborales */}
      <SectionHeader label="Datos laborales" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
        <Field label="Nº empleado" half>
          <input value={formData.employee_number} onChange={set('employee_number')} style={inputStyle} />
        </Field>
        <Field label="Cargo / Puesto" half>
          <input value={formData.position} onChange={set('position')} style={inputStyle} />
        </Field>
        <Field label="Departamento" half>
          <input value={formData.department} onChange={set('department')} style={inputStyle} />
        </Field>
        <Field label="Delegación" half>
          <select value={formData.delegacion} onChange={set('delegacion')} style={inputStyle}>
            {DELEGACIONES.map(d => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Fecha de alta" half>
          <input type="date" value={formData.hire_date} onChange={set('hire_date')} style={inputStyle} />
        </Field>
        <Field label="Tipo de contrato" half>
          <select value={formData.contract_type} onChange={set('contract_type')} style={inputStyle}>
            {CONTRACT_TYPES.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Jornada" half>
          <input value={formData.work_schedule} onChange={set('work_schedule')} style={inputStyle} placeholder="Ej: Completa, Parcial 20h..." />
        </Field>
        <Field label="Estado" half>
          <select value={formData.status} onChange={set('status')} style={inputStyle}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      {/* Sección: Datos económicos */}
      <SectionHeader label="Datos económicos" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
        <Field label="Salario bruto anual (€)" half>
          <input type="number" value={formData.salary_gross} onChange={set('salary_gross')} style={inputStyle} placeholder="0.00" />
        </Field>
        <Field label="Salario neto anual (€)" half>
          <input type="number" value={formData.salary_net} onChange={set('salary_net')} style={inputStyle} placeholder="0.00" />
        </Field>
        <Field label="IRPF %" half>
          <input type="number" value={formData.irpf_pct} onChange={set('irpf_pct')} style={inputStyle} placeholder="0.00" />
        </Field>
        <Field label="Nº Seguridad Social" half>
          <input value={formData.ss_number} onChange={set('ss_number')} style={inputStyle} />
        </Field>
        <Field label="IBAN bancario">
          <input value={formData.bank_iban} onChange={set('bank_iban')} style={inputStyle} placeholder="ES00 0000 0000 0000 0000 0000" />
        </Field>
      </div>

      {/* Notas */}
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
