import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Upload, Search, FileText, Download, Eye, Trash2, X, FolderOpen, ChevronRight, File, BookOpen, ClipboardList, FlaskConical, Award, History, GitBranch, Pencil, Globe, ListPlus, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from './supabaseClient';

const CATEGORIES = [
  { id: 'PNT',         label: 'PNT',         sub: 'Procedimientos Normalizados de Trabajo', icon: BookOpen,      color: '#1d4ed8', bg: '#dbeafe' },
  { id: 'Proceso',     label: 'Proceso',     sub: 'Procedimientos del sistema de gestión',  icon: ClipboardList, color: '#0f6e56', bg: '#d1fae5' },
  { id: 'Registro',    label: 'Registro',    sub: 'Formularios y registros de datos',       icon: FileText,      color: '#92400e', bg: '#fef3c7' },
  { id: 'Informe',     label: 'Informe',     sub: 'Informes técnicos y de resultados',      icon: FlaskConical,  color: '#6d28d9', bg: '#ede9fe' },
  { id: 'Certificado', label: 'Certificado',          sub: 'Certificados y acreditaciones',                       icon: Award,  color: '#065f46', bg: '#d1fae5' },
  { id: 'Normativa',   label: 'Normativa / Doc. Externa', sub: 'R.D., Normas UNE, Guías ENAC y doc. externa',      icon: Globe,  color: '#0369a1', bg: '#e0f2fe' },
  { id: 'Otro',        label: 'Otro',                 sub: 'Resto de documentación',                              icon: File,   color: '#374151', bg: '#f3f4f6' },
];

const BUCKET = 'documents';
const PC14_SUBCAT = 'PC-14 GESTION DE LA INFORMACIÓN DOCUMENTADA';
const PC13_FICHAS_SUBCAT = 'PC-13 Fichas de Seguridad Química';

// ── PROCESS MAP ─────────────────────────────────────────────────────────────
const NOTCH = 14; // px – chevron arrow depth

const PROCESS_MAP = [
  {
    id: 'estrategicos',
    label: 'PROCESOS\nESTRATÉGICOS',
    color: '#1e3a5f',
    lightBg: '#e8f0fe',
    processes: [
      { code: 'PC-01',   label: 'Análisis Contexto\nPlanificación y Mejora', subcat: 'PC-01 ANÁLISIS CONTEXTO PLANIFICACIÓN Y MEJORA' },
      { code: 'PC-02',   label: 'Gestión de Riesgos\ny Oportunidades',       subcat: 'PC-02 GESTIÓN DE RIESGOS Y OPORTUNIDADES' },
      { code: 'PC-03',   label: 'Auditorías e\nIntercomparativos',           subcat: 'PC-03 AUDITORÍAS e INTERCOMPARATIVOS' },
      { code: 'PC-04',   label: 'Satisfacción\ndel Cliente',                 subcat: 'PC-04 SATISFACCIÓN DEL CLIENTE' },
      { code: 'PC-05',   label: 'Plan de\nComunicación',                    subcat: null },
      { code: 'PC-06',   label: 'Análisis de\nCumplimiento',                subcat: null },
    ],
  },
  {
    id: 'operativos',
    label: 'PROCESOS\nOPERATIVOS',
    color: '#1a56c8',
    lightBg: '#f0f6ff',
    processes: [
      { code: 'PC-LAB-07',   label: 'Planificación\nMuestreo',              subcat: null },
      { code: 'PC-LAB-08',   label: 'Compras y\nSubcontratación',           subcat: 'PC-LAB-08 COMPRAS y SUBCONTRATACIÓN' },
      { code: 'PC-LAB-09',   label: 'Muestreo, Transporte\ny Recepción',    subcat: 'PC-LAB-09 MUESTREO- TRANSPORTE Y RECEPCIÓN' },
      { code: 'PC-LAB-09-A', label: 'Análisis\nde Muestras',                subcat: 'PC-LAB-09-A ANÁLISIS' },
      { code: 'PC-LAB-10',   label: 'Verificación y\nCalibración Equipos',  subcat: 'PC-10 MANTENIMIENTO Y VERIFICACIÓN DE EQUIPOS' },
      { code: 'PC-11',       label: 'NC / AC y Riesgos\na la Imparcialidad',subcat: 'PC-11 GESTION DE NC' },
    ],
  },
  {
    id: 'soporte',
    label: 'PROCESOS\nDE SOPORTE',
    color: '#0f766e',
    lightBg: '#f0fdf9',
    processes: [
      { code: 'PC-12', label: 'RRHH, Formación y\nGestión del Conocimiento', subcat: 'PC-12 RRHH FORMACION Y GESTIÓN DEL CONOCIMIENTO' },
      { code: 'PC-13', label: 'Infraestructura y\nAmbiente de Trabajo',       subcat: 'PC-13 INFRAESTRUCTURA y L+D' },
      { code: 'PC-14', label: 'Gestión Información\nDocumentada',             subcat: 'PC-14 GESTION DE LA INFORMACIÓN DOCUMENTADA' },
    ],
  },
];

function darkenHex(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const d = Math.round(255 * pct);
  const clamp = v => Math.min(255, Math.max(0, v));
  const r = clamp((n >> 16) - d).toString(16).padStart(2, '0');
  const g = clamp(((n >> 8) & 0xff) - d).toString(16).padStart(2, '0');
  const b = clamp((n & 0xff) - d).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

const PROCESS_LABELS = {
  'PC-01 ANÁLISIS CONTEXTO PLANIFICACIÓN Y MEJORA': 'PC-01 · Análisis de Contexto y Planificación',
  'PC-02 GESTIÓN DE RIESGOS Y OPORTUNIDADES':       'PC-02 · Gestión de Riesgos y Oportunidades',
  'PC-03 AUDITORÍAS e INTERCOMPARATIVOS':            'PC-03 · Auditorías e Intercomparativos',
  'PC-04 SATISFACCIÓN DEL CLIENTE':                  'PC-04 · Satisfacción del Cliente',
  'PC-10 MANTENIMIENTO Y VERIFICACIÓN DE EQUIPOS':   'PC-LAB-10 · Mantenimiento y Verificación de Equipos',
  'PC-11 GESTION DE NC':                             'PC-11 · Gestión de No Conformidades',
  'PC-12 RRHH FORMACION Y GESTIÓN DEL CONOCIMIENTO': 'PC-12 · RRHH, Formación y Gestión del Conocimiento',
  'PC-13 INFRAESTRUCTURA y L+D':                     'PC-13 · Infraestructura y Ambiente de Trabajo',
  'PC-14 GESTION DE LA INFORMACIÓN DOCUMENTADA':     'PC-14 · Gestión de la Información Documentada',
  'PC-LAB-08 COMPRAS y SUBCONTRATACIÓN':             'PC-LAB-08 · Compras y Subcontratación',
  'PC-LAB-09 MUESTREO- TRANSPORTE Y RECEPCIÓN':      'PC-LAB-09 · Muestreo, Transporte y Recepción',
  'PC-LAB-09-A ANÁLISIS':                            'PC-LAB-09-A · Análisis de Muestras',
  '0.Manual de Calidad y Competencia':               'Manual de Calidad y Competencia',
};

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getCatMeta(catId) {
  return CATEGORIES.find(c => c.id === catId) || CATEGORIES[CATEGORIES.length - 1];
}

const EMPTY_FORM = { name: '', category: 'PNT', subcategory: '', version: '', document_date: '', description: '' };

export default function DocumentsModule({ session, onBackToHub, role = 'operations' }) {
  const [docs, setDocs]                   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [activeCategory, setActiveCategory] = useState('mapa');
  const [showUpload, setShowUpload]       = useState(false);
  const [dragOver, setDragOver]           = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [selectedFile, setSelectedFile]   = useState(null);
  const [deleteId, setDeleteId]           = useState(null);
  const [collapsed, setCollapsed]         = useState({});
  const [expandedHistory, setExpandedHistory] = useState(new Set());
  const [newVersionOf, setNewVersionOf]   = useState(null);
  const [editDoc, setEditDoc]             = useState(null);
  const [editForm, setEditForm]           = useState({ name: '', version: '', document_date: '' });
  const [editSaving, setEditSaving]       = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkFiles, setBulkFiles]           = useState([]);
  const [bulkUploading, setBulkUploading]   = useState(false);
  const [showFichasUpload, setShowFichasUpload] = useState(false);
  const [fichasFiles, setFichasFiles]           = useState([]);
  const [fichasUploading, setFichasUploading]   = useState(false);
  const fileRef = useRef(null);

  const toggleGroup   = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleHistory = (id)  => setExpandedHistory(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const userEmail    = session?.user?.email || 'desconocido';
  const isAdmin      = role === 'admin';
  const isLabOrAdmin = isAdmin || role === 'lab';

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setDocs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // Only non-obsolete docs for the main list
  const activeDocs = useMemo(() => docs.filter(d => !d.is_obsolete), [docs]);

  // Map: currentDocId → [previousVersion, olderVersion, ...]
  const historyMap = useMemo(() => {
    const map = {};
    activeDocs.forEach(doc => {
      const chain = [];
      let cur = doc;
      while (cur?.previous_version_id) {
        const prev = docs.find(d => d.id === cur.previous_version_id);
        if (!prev) break;
        chain.push(prev);
        cur = prev;
      }
      if (chain.length) map[doc.id] = chain;
    });
    return map;
  }, [docs, activeDocs]);

  const filtered = activeDocs.filter(d => {
    const matchCat    = activeCategory === 'todos' || d.category === activeCategory;
    const matchSearch = !search
      || d.name.toLowerCase().includes(search.toLowerCase())
      || (d.description || '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const countByCategory = (catId) => activeDocs.filter(d => d.category === catId).length;

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(d => d.category === cat.id);
    if (items.length) acc[cat.id] = items;
    return acc;
  }, {});

  const handleUploadForProcess = (subcatKey) => {
    setNewVersionOf(null);
    setForm({ ...EMPTY_FORM, subcategory: subcatKey });
    setSelectedFile(null);
    setShowUpload(true);
  };

  const closeUpload = () => {
    setShowUpload(false);
    setSelectedFile(null);
    setNewVersionOf(null);
    setForm(EMPTY_FORM);
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    setSelectedFile(file);
    if (!newVersionOf) setForm(f => ({ ...f, name: file.name.replace(/\.[^.]+$/, '') }));
    setShowUpload(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleNewVersion = (doc) => {
    setNewVersionOf(doc);
    setForm({
      name:          doc.name,
      category:      doc.category,
      subcategory:   doc.subcategory || '',
      version:       '',
      document_date: '',
      description:   doc.description || '',
    });
    setSelectedFile(null);
    setShowUpload(true);
  };

  const sanitizeFileName = (name) =>
    name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._\-]/g, '_');

  const handleUpload = async () => {
    if (!selectedFile || !form.name || !form.category) return;
    setUploading(true);
    try {
      const path = `${form.category}/${Date.now()}_${sanitizeFileName(selectedFile.name)}`;
      const { error: storageErr } = await supabase.storage.from(BUCKET).upload(path, selectedFile);
      if (storageErr) throw storageErr;

      if (newVersionOf) {
        const { error: obsErr } = await supabase
          .from('documents')
          .update({ is_obsolete: true })
          .eq('id', newVersionOf.id);
        if (obsErr) throw obsErr;
      }

      const { error: dbErr } = await supabase.from('documents').insert({
        name:                form.name.trim(),
        description:         form.description.trim() || null,
        category:            form.category,
        subcategory:         form.subcategory.trim() || null,
        version:             form.version.trim() || null,
        document_date:       form.document_date || null,
        file_path:           path,
        file_name:           selectedFile.name,
        file_size:           selectedFile.size,
        uploaded_by:         userEmail,
        previous_version_id: newVersionOf?.id || null,
      });
      if (dbErr) throw dbErr;

      closeUpload();
      await fetchDocs();
    } catch (err) {
      alert('Error subiendo documento: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (doc) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleDownload = async (doc) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 300);
    if (data?.signedUrl) {
      const a = document.createElement('a');
      a.href     = data.signedUrl;
      a.download = doc.file_name;
      a.click();
    }
  };

  const openEdit = (doc) => {
    setEditDoc(doc);
    setEditForm({
      name:          doc.name,
      version:       doc.version || '',
      document_date: doc.document_date || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editDoc || !editForm.name.trim()) return;
    setEditSaving(true);
    try {
      const { error } = await supabase.from('documents').update({
        name:          editForm.name.trim(),
        version:       editForm.version.trim() || null,
        document_date: editForm.document_date || null,
      }).eq('id', editDoc.id);
      if (error) throw error;
      setEditDoc(null);
      await fetchDocs();
    } catch (err) {
      alert('Error guardando cambios: ' + err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (doc) => {
    await supabase.storage.from(BUCKET).remove([doc.file_path]);
    await supabase.from('documents').update({ is_active: false }).eq('id', doc.id);
    setDeleteId(null);
    await fetchDocs();
  };

  const addBulkFiles = (fileList) => {
    const toAdd = Array.from(fileList)
      .filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      .map(f => ({
        id: `${f.name}_${f.size}_${Date.now()}_${Math.random()}`,
        file: f,
        name: f.name.replace(/\.pdf$/i, '').replace(/_/g, ' '),
        version: '',
        date: '',
        status: 'pending',
        error: null,
      }));
    setBulkFiles(prev => [...prev, ...toAdd]);
  };

  const handleBulkUpload = async () => {
    setBulkUploading(true);
    const pending = bulkFiles.filter(f => f.status === 'pending');
    for (const bf of pending) {
      setBulkFiles(prev => prev.map(f => f.id === bf.id ? { ...f, status: 'uploading' } : f));
      try {
        const path = `Normativa/${Date.now()}_${sanitizeFileName(bf.file.name)}`;
        const { error: storageErr } = await supabase.storage.from(BUCKET).upload(path, bf.file);
        if (storageErr) throw storageErr;
        const { error: dbErr } = await supabase.from('documents').insert({
          name:          bf.name.trim() || bf.file.name,
          category:      'Normativa',
          subcategory:   PC14_SUBCAT,
          version:       bf.version.trim() || null,
          document_date: bf.date || null,
          file_path:     path,
          file_name:     bf.file.name,
          file_size:     bf.file.size,
          uploaded_by:   userEmail,
        });
        if (dbErr) throw dbErr;
        setBulkFiles(prev => prev.map(f => f.id === bf.id ? { ...f, status: 'done' } : f));
      } catch (err) {
        setBulkFiles(prev => prev.map(f => f.id === bf.id ? { ...f, status: 'error', error: err.message } : f));
      }
    }
    setBulkUploading(false);
    await fetchDocs();
  };

  const addFichasFiles = (fileList) => {
    const toAdd = Array.from(fileList)
      .filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      .map(f => ({
        id: `${f.name}_${f.size}_${Date.now()}_${Math.random()}`,
        file: f,
        name: f.name.replace(/\.pdf$/i, '').replace(/_/g, ' '),
        cas: '',
        fabricante: '',
        status: 'pending',
        error: null,
      }));
    setFichasFiles(prev => [...prev, ...toAdd]);
  };

  const handleFichasUpload = async () => {
    setFichasUploading(true);
    const pending = fichasFiles.filter(f => f.status === 'pending');
    for (const bf of pending) {
      setFichasFiles(prev => prev.map(f => f.id === bf.id ? { ...f, status: 'uploading' } : f));
      try {
        const path = `Normativa/fichas-seguridad/${Date.now()}_${sanitizeFileName(bf.file.name)}`;
        const { error: storageErr } = await supabase.storage.from(BUCKET).upload(path, bf.file);
        if (storageErr) throw storageErr;
        const desc = [bf.cas && `CAS: ${bf.cas}`, bf.fabricante && `Fabricante: ${bf.fabricante}`].filter(Boolean).join(' · ') || null;
        const { error: dbErr } = await supabase.from('documents').insert({
          name:        bf.name.trim() || bf.file.name,
          description: desc,
          category:    'Normativa',
          subcategory: PC13_FICHAS_SUBCAT,
          file_path:   path,
          file_name:   bf.file.name,
          file_size:   bf.file.size,
          uploaded_by: userEmail,
        });
        if (dbErr) throw dbErr;
        setFichasFiles(prev => prev.map(f => f.id === bf.id ? { ...f, status: 'done' } : f));
      } catch (err) {
        setFichasFiles(prev => prev.map(f => f.id === bf.id ? { ...f, status: 'error', error: err.message } : f));
      }
    }
    setFichasUploading(false);
    await fetchDocs();
  };

  const gridProps = {
    onView:          handleView,
    onViewObsolete:  isAdmin ? handleView : null,
    onDownload:      isAdmin ? handleDownload : null,
    onDelete:        isAdmin ? setDeleteId : null,
    onNewVersion:    isAdmin ? handleNewVersion : null,
    onEdit:          isAdmin ? openEdit : null,
    historyMap,
    expandedHistory,
    onToggleHistory: isAdmin ? toggleHistory : null,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--background)', fontFamily: 'var(--font, Arial, sans-serif)' }}>

      {/* ── TOP BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 52, backgroundColor: 'var(--sidebar-bg, #0076CE)', flexShrink: 0 }}>
        <button onClick={onBackToHub} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 7, padding: '6px 11px', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
          <ArrowLeft size={14} /> Portal principal
        </button>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.25)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FolderOpen size={18} color="white" />
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>Gestión Documental</span>
        </div>
        <div style={{ flex: 1 }} />
        {isAdmin && (
          <button
            onClick={() => { setNewVersionOf(null); setShowUpload(true); setSelectedFile(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'white', color: 'var(--sidebar-bg, #0076CE)', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
          >
            <Upload size={14} /> Subir documento
          </button>
        )}
      </div>

      {/* ── MAIN ── */}
      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div
          style={{ flex: 1, overflowY: 'auto', padding: 0 }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {dragOver && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,118,206,0.12)', border: '3px dashed var(--primary)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ background: 'white', borderRadius: '16px', padding: '32px 48px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                <Upload size={40} color="var(--primary)" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>Suelta para subir</div>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Cargando documentos…</div>
          ) : (
            <ProcessMapView
              activeDocs={activeDocs}
              gridProps={gridProps}
              isAdmin={isAdmin}
              onUploadForProcess={isAdmin ? handleUploadForProcess : null}
              onBulkUpload={isAdmin ? () => { setBulkFiles([]); setShowBulkUpload(true); } : null}
              onFichasBulkUpload={isLabOrAdmin ? () => { setFichasFiles([]); setShowFichasUpload(true); } : null}
            />
          )}

          {/* dead-code block kept for reference — never rendered */}
          {false && filtered.length === 0 ? (
            <EmptyState search={search} onUpload={() => setShowUpload(true)} />
          ) : false && ['PNT', 'Proceso', 'Registro'].includes(activeCategory) ? (
            (() => {
              const bySubcat = filtered.reduce((acc, doc) => {
                const key = doc.subcategory || 'Sin proceso';
                if (!acc[key]) acc[key] = [];
                acc[key].push(doc);
                return acc;
              }, {});
              const cat = getCatMeta(activeCategory);
              return Object.entries(bySubcat)
                .sort(([a], [b]) => a.localeCompare(b, 'es'))
                .map(([subcat, items]) => {
                  const key  = `sub_${subcat}`;
                  const open = !collapsed[key];
                  const isRootProc = activeCategory === 'Proceso' && items.length === 1;
                  const rootDoc    = isRootProc ? items[0] : null;

                  return (
                    <div key={subcat} style={{ marginBottom: '16px' }}>
                      {isRootProc ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', background: cat.bg, border: `1px solid ${cat.color}33`, borderRadius: '10px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--secondary)', flex: 1 }}>
                            {PROCESS_LABELS[subcat] || subcat}
                          </span>
                          {rootDoc.version && (
                            <span style={{ fontSize: '0.72rem', background: '#f0fdf4', color: '#166534', borderRadius: '6px', padding: '2px 8px', fontWeight: 700, flexShrink: 0 }}>
                              {rootDoc.version}
                            </span>
                          )}
                          {rootDoc.document_date && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                              {fmtDate(rootDoc.document_date)}
                            </span>
                          )}
                          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                            <ActionBtn icon={Eye}      title="Ver"       onClick={() => handleView(rootDoc)}     color="var(--primary)" />
                            <ActionBtn icon={Download} title="Descargar" onClick={() => handleDownload(rootDoc)} color="#0f6e56" />
                            {isAdmin && <ActionBtn icon={Pencil}    title="Editar"         onClick={() => openEdit(rootDoc)}       color="#f59e0b" />}
                            {isAdmin && <ActionBtn icon={GitBranch} title="Nueva versión"  onClick={() => handleNewVersion(rootDoc)} color="#7c3aed" />}
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => toggleGroup(key)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', background: open ? cat.bg : '#f8fafc', border: `1px solid ${open ? cat.color + '33' : 'var(--border)'}`, borderRadius: open ? '10px 10px 0 0' : '10px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                          >
                            <ChevronRight size={14} color={cat.color} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--secondary)', flex: 1 }}>
                              {PROCESS_LABELS[subcat] || subcat}
                            </span>
                            <span style={{ fontSize: '0.75rem', background: cat.color + '22', color: cat.color, borderRadius: '20px', padding: '1px 8px', fontWeight: 600 }}>
                              {items.length}
                            </span>
                          </button>
                          {open && (
                            <div style={{ border: `1px solid ${cat.color + '33'}`, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                              <DocGrid docs={items} {...gridProps} />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                });
            })()
          ) : activeCategory !== 'todos' ? (
            <DocGrid docs={filtered} {...gridProps} />
          ) : (
            Object.entries(grouped).map(([catId, items]) => {
              const cat  = getCatMeta(catId);
              const Icon = cat.icon;
              const key  = `cat_${catId}`;
              const open = !collapsed[key];
              return (
                <div key={catId} style={{ marginBottom: '16px' }}>
                  <button
                    onClick={() => toggleGroup(key)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: open ? cat.bg : '#f8fafc', border: `1px solid ${open ? cat.color + '33' : 'var(--border)'}`, borderRadius: open ? '10px 10px 0 0' : '10px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                  >
                    <ChevronRight size={14} color={cat.color} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: cat.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={13} color={cat.color} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--secondary)', flex: 1 }}>{cat.label}</span>
                    <span style={{ fontSize: '0.75rem', background: cat.color + '22', color: cat.color, borderRadius: '20px', padding: '1px 8px', fontWeight: 600 }}>{items.length}</span>
                  </button>
                  {open && (
                    <div style={{ border: `1px solid ${cat.color + '33'}`, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                      <DocGrid docs={items} {...gridProps} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* ── UPLOAD / NEW VERSION MODAL ── */}
      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {newVersionOf
                  ? <GitBranch size={20} color="#7c3aed" />
                  : <Upload size={20} color="var(--primary)" />}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                    {newVersionOf ? 'Nueva versión' : 'Subir documento'}
                  </div>
                  {newVersionOf && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                      Reemplaza: <strong>{newVersionOf.name}</strong>
                      {newVersionOf.version ? ` (${newVersionOf.version})` : ''}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={closeUpload} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${selectedFile ? 'var(--primary)' : '#cbd5e1'}`, borderRadius: '12px', padding: '28px', textAlign: 'center', cursor: 'pointer', background: selectedFile ? '#eff6ff' : '#f8fafc', marginBottom: '20px', transition: 'all 0.2s' }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFileSelect(e.dataTransfer.files[0]); }}
              >
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files[0])} />
                {selectedFile ? (
                  <>
                    <FileText size={28} color="var(--primary)" style={{ marginBottom: '8px' }} />
                    <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{selectedFile.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{fmtSize(selectedFile.size)}</div>
                  </>
                ) : (
                  <>
                    <Upload size={28} color="#94a3b8" style={{ marginBottom: '8px' }} />
                    <div style={{ fontWeight: 600, color: '#475569' }}>Arrastra un archivo o haz clic</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>PDF, Word o Excel · máx. 50 MB</div>
                  </>
                )}
              </div>

              {/* Nombre */}
              <div className="input-group" style={{ marginBottom: '14px' }}>
                <label className="input-label">Nombre del documento *</label>
                <input
                  className="input-field"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: PNT-01 Recepción de muestras"
                  disabled={!!newVersionOf}
                  style={newVersionOf ? { background: '#f1f5f9', color: 'var(--text-muted)' } : {}}
                />
              </div>

              {/* Categoría + Versión */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Categoría *</label>
                  <select
                    className="input-field"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    disabled={!!newVersionOf}
                    style={newVersionOf ? { background: '#f1f5f9', color: 'var(--text-muted)' } : {}}
                  >
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Versión</label>
                  <input className="input-field" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="Ej: v2.0, Rev. 3" />
                </div>
              </div>

              {/* Fecha del documento */}
              <div className="input-group" style={{ marginBottom: '14px' }}>
                <label className="input-label">Fecha del documento</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.document_date}
                  onChange={e => setForm(f => ({ ...f, document_date: e.target.value }))}
                />
              </div>

              {/* Subcategoría (solo en subida nueva) */}
              {!newVersionOf && (
                <div className="input-group" style={{ marginBottom: '14px' }}>
                  <label className="input-label">Subcategoría / Proceso</label>
                  <input className="input-field" value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))} placeholder="Ej: Microbiología, Metrología…" />
                </div>
              )}

              {/* Descripción */}
              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label className="input-label">Descripción</label>
                <textarea className="input-field" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descripción del contenido…" style={{ resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={closeUpload}>Cancelar</button>
                <button
                  className="btn btn-primary"
                  onClick={handleUpload}
                  disabled={!selectedFile || !form.name || uploading}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', ...(newVersionOf ? { background: '#7c3aed' } : {}) }}
                >
                  {newVersionOf ? <GitBranch size={16} /> : <Upload size={16} />}
                  {uploading ? 'Subiendo…' : newVersionOf ? 'Publicar nueva versión' : 'Subir documento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '460px', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Pencil size={18} color="#f59e0b" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>Editar documento</div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '1px' }}>Corrige nombre, versión o fecha</div>
                </div>
              </div>
              <button onClick={() => setEditDoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div className="input-group" style={{ marginBottom: '14px' }}>
                <label className="input-label">Nombre del documento *</label>
                <input className="input-field" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Versión</label>
                  <input className="input-field" value={editForm.version} onChange={e => setEditForm(f => ({ ...f, version: e.target.value }))} placeholder="Ej: v3.0, Rev. 5" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Fecha del documento</label>
                  <input type="date" className="input-field" value={editForm.document_date} onChange={e => setEditForm(f => ({ ...f, document_date: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setEditDoc(null)}>Cancelar</button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveEdit}
                  disabled={!editForm.name.trim() || editSaving}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f59e0b' }}
                >
                  <Pencil size={15} /> {editSaving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK UPLOAD MODAL ── */}
      {showBulkUpload && (
        <BulkUploadModal
          bulkFiles={bulkFiles}
          setBulkFiles={setBulkFiles}
          bulkUploading={bulkUploading}
          onAddFiles={addBulkFiles}
          onUpload={handleBulkUpload}
          onClose={() => { if (!bulkUploading) { setShowBulkUpload(false); setBulkFiles([]); } }}
        />
      )}

      {/* ── FICHAS DE SEGURIDAD MODAL ── */}
      {showFichasUpload && (
        <FichasBulkUploadModal
          fichasFiles={fichasFiles}
          setFichasFiles={setFichasFiles}
          fichasUploading={fichasUploading}
          onAddFiles={addFichasFiles}
          onUpload={handleFichasUpload}
          onClose={() => { if (!fichasUploading) { setShowFichasUpload(false); setFichasFiles([]); } }}
        />
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteId && (() => {
        const doc = docs.find(d => d.id === deleteId);
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '380px', width: '90%', textAlign: 'center' }}>
              <Trash2 size={32} color="#e11d48" style={{ marginBottom: '12px' }} />
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '8px' }}>¿Eliminar documento?</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px' }}>{doc?.name}</div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancelar</button>
                <button onClick={() => handleDelete(doc)} style={{ padding: '8px 20px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function SidebarItem({ label, count, active, onClick, icon }) {
  return (
    <button
      onClick={onClick}
      style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', marginBottom: '2px', background: active ? 'rgba(255,255,255,0.2)' : 'transparent', color: active ? 'white' : 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: active ? 600 : 400, textAlign: 'left', transition: 'background 0.15s' }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{icon && <span style={{ fontSize: '0.8rem' }}>{icon}</span>}{label}</span>
      {count > 0 && <span style={{ background: active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)', borderRadius: '20px', padding: '1px 7px', fontSize: '0.72rem', fontWeight: 600 }}>{count}</span>}
    </button>
  );
}

const ANÁLISIS_CODE = 'PC-LAB-09-A';
const ANÁLISIS_COLOR = '#c2680a';
const ANÁLISIS_BG    = '#fff8ee';

function ProcessMapView({ activeDocs, gridProps, isAdmin, onUploadForProcess, onBulkUpload, onFichasBulkUpload }) {
  const [expandedProc, setExpandedProc] = useState(null);

  const docsBySubcat = useMemo(() => {
    const map = {};
    activeDocs.forEach(doc => {
      if (!doc.subcategory) return;
      const key = doc.subcategory.normalize('NFC');
      if (!map[key]) map[key] = [];
      map[key].push(doc);
    });
    Object.values(map).forEach(arr =>
      arr.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' }))
    );
    return map;
  }, [activeDocs]);

  const SGC_SUBCAT  = '0.Manual de Calidad y Competencia';
  const SGC_COLOR   = '#5b21b6';
  const SGC_BG      = '#f5f3ff';
  const SGC_BORDER  = '#ddd6fe';

  const toggle = (row, proc) =>
    setExpandedProc(prev => prev?.code === proc.code ? null : { ...proc, rowId: row.id, rowColor: row.color, rowLightBg: row.lightBg });

  const sgcDocs  = docsBySubcat[SGC_SUBCAT] || [];
  const sgcOpen  = expandedProc?.code === 'SGC';

  return (
    <div style={{ padding: '16px 16px 40px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 16, paddingLeft: 4 }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Mapa de Procesos
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
          ISO 9001:2015 · ISO/IEC 17025:2017
        </div>
      </div>

      {/* ── SGC banner ── */}
      <div style={{ marginBottom: 10 }}>
        <div
          onClick={() => setExpandedProc(prev => prev?.code === 'SGC' ? null : { code: 'SGC', label: 'Documentación del Sistema de Calidad', subcat: SGC_SUBCAT, rowId: '__sgc__', rowColor: SGC_COLOR, rowLightBg: SGC_BG })}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: sgcOpen ? SGC_COLOR : 'white',
            border: `1px solid ${sgcOpen ? SGC_COLOR : SGC_BORDER}`,
            borderLeft: `4px solid ${SGC_COLOR}`,
            borderRadius: sgcOpen ? '10px 10px 0 0' : 10,
            padding: '11px 16px', cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            transition: 'background 0.15s',
          }}
          onMouseOver={e => { if (!sgcOpen) e.currentTarget.style.background = SGC_BG; }}
          onMouseOut={e => { if (!sgcOpen) e.currentTarget.style.background = 'white'; }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: sgcOpen ? 'rgba(255,255,255,0.7)' : SGC_COLOR, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>
              SGC · Documentación Base del Sistema
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: sgcOpen ? 'white' : '#2d3748' }}>
              Manual de Calidad · Políticas · Contratos · Anexos Técnicos
            </div>
          </div>
          <span style={{ fontSize: '0.7rem', background: sgcOpen ? 'rgba(255,255,255,0.2)' : SGC_COLOR + '18', color: sgcOpen ? 'white' : SGC_COLOR, borderRadius: 20, padding: '2px 10px', fontWeight: 700, flexShrink: 0 }}>
            {sgcDocs.length} docs
          </span>
          {onUploadForProcess && (
            <button
              onClick={e => { e.stopPropagation(); onUploadForProcess(SGC_SUBCAT); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: sgcOpen ? 'rgba(255,255,255,0.2)' : SGC_COLOR, color: 'white', border: 'none', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
            >
              <Upload size={11} /> Añadir
            </button>
          )}
        </div>
        {sgcOpen && (
          <div style={{ background: 'white', border: `1px solid ${SGC_BORDER}`, borderTop: `2px solid ${SGC_COLOR}`, borderRadius: '0 0 10px 10px', overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.07)', marginBottom: 2 }}>
            {sgcDocs.length > 0
              ? <DocGrid docs={sgcDocs} {...gridProps} />
              : <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hay documentos del sistema todavía</div>
            }
          </div>
        )}
      </div>

      {/* ── Outer wrapper with left/right labels ── */}
      <div style={{ display: 'flex', gap: 0 }}>

        {/* Left bar */}
        <div style={{ width: 22, flexShrink: 0, background: '#253858', borderRadius: '8px 0 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', color: 'rgba(255,255,255,0.85)', fontSize: '0.48rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            REQUISITOS NORMATIVA Y CLIENTES
          </span>
        </div>

        {/* Swim-lanes */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 10px', background: '#f1f5f9', border: '1px solid #dde3ed', borderLeft: 'none', borderRight: 'none' }}>

          {PROCESS_MAP.map(row => {
            const labelParts = row.label.split('\n');
            const panelOpen  = expandedProc?.rowId === row.id;

            return (
              <div key={row.id}>
                {/* Lane card */}
                <div style={{ display: 'flex', background: 'white', borderRadius: 10, border: '1px solid #dde3ed', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

                  {/* Row label */}
                  <div style={{ width: 124, flexShrink: 0, background: row.color, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '14px 12px 14px 14px', gap: 4 }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {labelParts[0]}
                    </div>
                    <div style={{ color: 'white', fontSize: '0.7rem', fontWeight: 800, lineHeight: 1.3, textTransform: 'uppercase', letterSpacing: 0, wordBreak: 'break-word' }}>
                      {labelParts[1]}
                    </div>
                  </div>

                  {/* Process cards */}
                  <div style={{ flex: 1, display: 'flex', gap: 8, padding: '10px 12px', background: row.lightBg, alignItems: 'stretch' }}>
                    {row.processes.map(proc => {
                      const isHL       = proc.code === ANÁLISIS_CODE;
                      const cardColor  = isHL ? ANÁLISIS_COLOR : row.color;
                      const cardBg     = isHL ? ANÁLISIS_BG : 'white';
                      const docCount   = proc.subcat ? (docsBySubcat[proc.subcat] || []).length : 0;
                      const isSelected = expandedProc?.code === proc.code;

                      return (
                        <div
                          key={proc.code}
                          onClick={() => toggle(row, proc)}
                          style={{
                            flex: 1,
                            background: cardBg,
                            border: `1px solid ${isSelected ? cardColor : isHL ? '#f6c87a' : '#e2e8f0'}`,
                            borderTop: `3px solid ${cardColor}`,
                            borderRadius: 8,
                            padding: '9px 10px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                            minHeight: 88,
                            position: 'relative',
                            boxShadow: isSelected
                              ? `0 0 0 2px ${cardColor}30, 0 3px 10px rgba(0,0,0,0.1)`
                              : isHL
                                ? '0 2px 8px rgba(194,104,10,0.13)'
                                : '0 1px 3px rgba(0,0,0,0.04)',
                            transition: 'box-shadow 0.15s, transform 0.12s',
                          }}
                          onMouseOver={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 5px 14px rgba(0,0,0,0.11)';
                          }}
                          onMouseOut={e => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = isSelected
                              ? `0 0 0 2px ${cardColor}30, 0 3px 10px rgba(0,0,0,0.1)`
                              : isHL ? '0 2px 8px rgba(194,104,10,0.13)' : '0 1px 3px rgba(0,0,0,0.04)';
                          }}
                        >
                          {/* Code */}
                          <div style={{ fontSize: '0.57rem', fontWeight: 800, color: cardColor, letterSpacing: '0.04em', lineHeight: 1 }}>
                            {proc.code}
                          </div>
                          {/* Name */}
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#2d3748', lineHeight: 1.3, flex: 1, whiteSpace: 'pre-line' }}>
                            {proc.label}
                          </div>
                          {/* Footer */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            {docCount > 0 ? (
                              <span style={{ fontSize: '0.58rem', background: cardColor + '18', color: cardColor, borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>
                                {docCount} doc{docCount !== 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.57rem', color: '#c0cad8', fontStyle: 'italic' }}>sin docs</span>
                            )}
                            {isHL && (
                              <span style={{ fontSize: '0.53rem', background: '#fde68a', color: '#92400e', borderRadius: 8, padding: '1px 5px', fontWeight: 800, letterSpacing: '0.02em' }}>
                                ENSAYO
                              </span>
                            )}
                          </div>
                          {/* Caret when selected */}
                          {isSelected && (
                            <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: `8px solid ${cardColor}`, zIndex: 5 }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Expansion panel */}
                {panelOpen && (() => {
                  const isHL       = expandedProc.code === ANÁLISIS_CODE;
                  const panelColor = isHL ? ANÁLISIS_COLOR : row.color;
                  const panelBg    = isHL ? ANÁLISIS_BG : row.lightBg;
                  const procDocs   = expandedProc.subcat ? (docsBySubcat[expandedProc.subcat] || []) : [];
                  return (
                    <div style={{ marginTop: 2, background: 'white', border: `1px solid ${panelColor}33`, borderTop: `2px solid ${panelColor}`, borderRadius: '0 0 10px 10px', overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.07)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', background: panelBg, borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: panelColor, flex: 1 }}>
                          {expandedProc.code} · {expandedProc.label.replace('\n', ' ')}
                        </span>
                        {expandedProc.subcat && (
                          <span style={{ fontSize: '0.75rem', background: panelColor + '1a', color: panelColor, borderRadius: 20, padding: '1px 9px', fontWeight: 600 }}>
                            {procDocs.length} doc{procDocs.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {onBulkUpload && expandedProc.code === 'PC-14' && (
                          <button
                            onClick={onBulkUpload}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 11px', background: '#0369a1', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            <ListPlus size={12} /> Carga masiva normativa
                          </button>
                        )}
                        {onFichasBulkUpload && expandedProc.code === 'PC-13' && (
                          <button
                            onClick={onFichasBulkUpload}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 11px', background: '#0f766e', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            <ShieldCheck size={12} /> Fichas de Seguridad
                          </button>
                        )}
                        {onUploadForProcess && expandedProc.subcat && (
                          <button
                            onClick={() => onUploadForProcess(expandedProc.subcat)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 11px', background: panelColor, color: 'white', border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            <Upload size={11} /> Añadir doc
                          </button>
                        )}
                        <button onClick={() => setExpandedProc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: panelColor, display: 'flex', alignItems: 'center' }}>
                          <X size={15} />
                        </button>
                      </div>
                      {procDocs.length > 0
                        ? <DocGrid docs={procDocs} {...gridProps} />
                        : (
                          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {expandedProc.subcat ? 'No hay documentos vinculados a este proceso todavía' : 'Proceso pendiente de incorporar al sistema documental'}
                          </div>
                        )}
                      {expandedProc.code === 'PC-13' && (() => {
                        const fichasDocs = docsBySubcat['PC-13 Fichas de Seguridad Química'] || [];
                        return (
                          <div style={{ borderTop: '2px solid #0f766e33' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: '#f0fdf9', borderBottom: fichasDocs.length > 0 ? '1px solid #d1fae5' : 'none' }}>
                              <ShieldCheck size={14} color="#0f766e" />
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
                                Fichas de Seguridad Química
                              </span>
                              <span style={{ fontSize: '0.72rem', background: '#0f766e1a', color: '#0f766e', borderRadius: 20, padding: '1px 9px', fontWeight: 700 }}>
                                {fichasDocs.length} ficha{fichasDocs.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {fichasDocs.length > 0
                              ? <DocGrid docs={fichasDocs} {...gridProps} />
                              : (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                  Sin fichas de seguridad subidas todavía · usa el botón <strong>Fichas de Seguridad</strong> para cargar
                                </div>
                              )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* Right bar */}
        <div style={{ width: 22, flexShrink: 0, background: '#253858', borderRadius: '0 8px 8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ writingMode: 'vertical-lr', color: 'rgba(255,255,255,0.85)', fontSize: '0.48rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            CLIENTES Y PARTES INTERESADAS
          </span>
        </div>
      </div>
    </div>
  );
}

const GRID_COLS = '1fr 80px 110px 60px 216px';

function DocGrid({ docs, onView, onViewObsolete, onDownload, onDelete, onNewVersion, onEdit, historyMap, expandedHistory, onToggleHistory }) {
  // Group by category preserving CATEGORIES order
  const groups = CATEGORIES
    .map(cat => ({ cat, items: docs.filter(d => d.category === cat.id) }))
    .filter(g => g.items.length > 0);
  // Catch docs with unknown/null category
  const knownIds = new Set(CATEGORIES.map(c => c.id));
  const others = docs.filter(d => !knownIds.has(d.category));
  if (others.length > 0) groups.push({ cat: getCatMeta(null), items: others });

  const multiGroup = groups.length > 1;

  return (
    <div style={{ background: 'white', overflow: 'hidden' }}>
      {/* Column header */}
      <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS, padding: '7px 14px', background: '#f8fafc', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <span>Documento</span>
        <span style={{ textAlign: 'center' }}>Versión</span>
        <span style={{ textAlign: 'center' }}>Fecha versión</span>
        <span style={{ textAlign: 'center' }}>Tamaño</span>
        <span />
      </div>
      {groups.map(({ cat, items }) => (
        <React.Fragment key={cat.id}>
          {multiGroup && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 14px', background: cat.bg, borderBottom: `1px solid ${cat.color}22`, borderTop: '1px solid var(--border)' }}>
              <cat.icon size={12} color={cat.color} />
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat.label}</span>
              <span style={{ fontSize: '0.68rem', color: cat.color, opacity: 0.7 }}>· {items.length}</span>
            </div>
          )}
          {items.map((doc, i) => (
            <DocRow
              key={doc.id}
              doc={doc}
              onView={onView}
              onViewObsolete={onViewObsolete}
              onDownload={onDownload}
              onDelete={onDelete}
              onNewVersion={onNewVersion}
              onEdit={onEdit}
              history={historyMap?.[doc.id] || []}
              isHistoryOpen={expandedHistory?.has(doc.id)}
              onToggleHistory={onToggleHistory}
              last={i === items.length - 1 && !multiGroup}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

function DocRow({ doc, onView, onViewObsolete, onDownload, onDelete, onNewVersion, onEdit, history, isHistoryOpen, onToggleHistory, last }) {
  const cat        = getCatMeta(doc.category);
  const Icon       = cat.icon;
  const hasHistory = history.length > 0;

  return (
    <>
      <div
        style={{ display: 'grid', gridTemplateColumns: GRID_COLS, padding: '9px 14px', alignItems: 'center', borderBottom: (last && !isHistoryOpen) ? 'none' : '1px solid #f1f5f9', background: 'white', transition: 'background 0.12s' }}
        onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
        onMouseOut={e => e.currentTarget.style.background = 'white'}
      >
        {/* Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={14} color={cat.color} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
            {doc.description && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.description}</div>}
          </div>
        </div>
        {/* Version */}
        <div style={{ textAlign: 'center' }}>
          {doc.version
            ? <span style={{ fontSize: '0.75rem', background: '#f0fdf4', color: '#166534', borderRadius: '6px', padding: '2px 8px', fontWeight: 700 }}>{doc.version}</span>
            : <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>—</span>}
        </div>
        {/* Date */}
        <div style={{ textAlign: 'center' }}>
          {doc.document_date
            ? <span style={{ fontSize: '0.78rem', color: 'var(--secondary)' }}>{fmtDate(doc.document_date)}</span>
            : <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }} title={`Subido: ${fmtDate(doc.created_at)}`}>—</span>}
        </div>
        {/* Size */}
        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {fmtSize(doc.file_size)}
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', paddingLeft: '8px' }}>
          {hasHistory && onToggleHistory && (
            <ActionBtn
              icon={History}
              title={`Historial · ${history.length} versión${history.length > 1 ? 'es' : ''} anterior${history.length > 1 ? 'es' : ''}`}
              onClick={() => onToggleHistory(doc.id)}
              color={isHistoryOpen ? '#7c3aed' : '#94a3b8'}
              active={isHistoryOpen}
            />
          )}
          <ActionBtn icon={Eye}      title="Ver"           onClick={() => onView(doc)}     color="var(--primary)" />
          {onDownload && <ActionBtn icon={Download} title="Descargar" onClick={() => onDownload(doc)} color="#0f6e56" />}
          {onEdit && (
            <ActionBtn icon={Pencil} title="Editar nombre / versión / fecha" onClick={() => onEdit(doc)} color="#f59e0b" />
          )}
          {onNewVersion && (
            <ActionBtn icon={GitBranch} title="Nueva versión" onClick={() => onNewVersion(doc)} color="#7c3aed" />
          )}
          {onDelete && <ActionBtn icon={Trash2} title="Eliminar" onClick={() => onDelete(doc.id)} color="#e11d48" />}
        </div>
      </div>

      {/* Historial de versiones anteriores */}
      {isHistoryOpen && history.map((h, i) => (
        <HistoryRow
          key={h.id}
          doc={h}
          onView={onViewObsolete}
          onDownload={onDownload}
          last={last && i === history.length - 1}
        />
      ))}
    </>
  );
}

function HistoryRow({ doc, onView, onDownload, last }) {
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: GRID_COLS, padding: '7px 14px 7px 26px', alignItems: 'center', borderBottom: last ? 'none' : '1px solid #f1f5f9', background: '#faf5ff', borderLeft: '3px solid #ddd6fe' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <span style={{ fontSize: '0.63rem', background: '#ede9fe', color: '#7c3aed', borderRadius: '4px', padding: '1px 5px', fontWeight: 700, flexShrink: 0 }}>OBSOLETO</span>
        <span style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</span>
      </div>
      <div style={{ textAlign: 'center' }}>
        {doc.version
          ? <span style={{ fontSize: '0.72rem', background: '#f3f4f6', color: '#6b7280', borderRadius: '6px', padding: '2px 7px', fontWeight: 600 }}>{doc.version}</span>
          : <span style={{ fontSize: '0.72rem', color: '#d1d5db' }}>—</span>}
      </div>
      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af' }}>
        {fmtDate(doc.document_date || doc.created_at)}
      </div>
      <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#9ca3af' }}>
        {fmtSize(doc.file_size)}
      </div>
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', paddingLeft: '8px' }}>
        {onView && <ActionBtn icon={Eye}      title="Ver versión obsoleta"       onClick={() => onView(doc)}     color="#9ca3af" />}
        {onDownload && <ActionBtn icon={Download} title="Descargar versión obsoleta" onClick={() => onDownload(doc)} color="#9ca3af" />}
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, title, onClick, color, active }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{ width: '30px', height: '30px', borderRadius: '6px', border: `1px solid ${active ? color + '44' : 'var(--border)'}`, background: active ? color + '11' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
      onMouseOver={e => { e.currentTarget.style.background = '#f0f0f0'; }}
      onMouseOut={e => { e.currentTarget.style.background = active ? color + '11' : 'white'; }}
    >
      <Icon size={14} color={color} />
    </button>
  );
}

function FichasBulkUploadModal({ fichasFiles, setFichasFiles, fichasUploading, onAddFiles, onUpload, onClose }) {
  const dropRef  = useRef(null);
  const inputRef = useRef(null);
  const pending  = fichasFiles.filter(f => f.status === 'pending').length;
  const done     = fichasFiles.filter(f => f.status === 'done').length;
  const errors   = fichasFiles.filter(f => f.status === 'error').length;
  const allDone  = fichasFiles.length > 0 && done + errors === fichasFiles.length;

  const onDrop = (e) => { e.preventDefault(); onAddFiles(e.dataTransfer.files); };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 740, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <ShieldCheck size={20} color="#0f766e" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f766e' }}>Fichas de Seguridad — Carga masiva</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Productos químicos usados en laboratorio · PC-13 Infraestructura</div>
          </div>
          {!fichasUploading && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>}
        </div>

        {/* Drop zone */}
        <div
          ref={dropRef}
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{ margin: '16px 20px 0', border: '2px dashed #6ee7d1', borderRadius: 10, padding: '18px', textAlign: 'center', cursor: 'pointer', background: '#f0fdf9', transition: 'background 0.15s' }}
          onMouseOver={e => e.currentTarget.style.background = '#ccfbf1'}
          onMouseOut={e => e.currentTarget.style.background = '#f0fdf9'}
        >
          <Upload size={22} color="#0f766e" style={{ marginBottom: 6 }} />
          <div style={{ fontSize: '0.85rem', color: '#0f766e', fontWeight: 600 }}>Arrastra las Fichas de Seguridad (PDF) aquí o haz clic</div>
          <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: 3 }}>Solo archivos PDF · Puedes seleccionar varias a la vez</div>
          <input ref={inputRef} type="file" multiple accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={e => { onAddFiles(e.target.files); e.target.value = ''; }} />
        </div>

        {/* File list */}
        {fichasFiles.length > 0 && (
          <div style={{ flex: 1, overflowY: 'auto', margin: '12px 20px 0', border: '1px solid var(--border)', borderRadius: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 150px 64px', padding: '6px 12px', background: '#f8fafc', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              <span>NOMBRE DEL PRODUCTO</span>
              <span style={{ textAlign: 'center' }}>Nº CAS</span>
              <span style={{ textAlign: 'center' }}>FABRICANTE</span>
              <span style={{ textAlign: 'center' }}>ESTADO</span>
            </div>
            {fichasFiles.map((bf) => (
              <div key={bf.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 150px 64px', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid #f1f5f9', background: bf.status === 'done' ? '#f0fdf4' : bf.status === 'error' ? '#fff1f2' : 'white' }}>
                <input
                  value={bf.name}
                  disabled={bf.status !== 'pending'}
                  onChange={e => setFichasFiles(prev => prev.map(f => f.id === bf.id ? { ...f, name: e.target.value } : f))}
                  style={{ fontSize: '0.82rem', border: bf.status === 'pending' ? '1px solid #e2e8f0' : 'none', borderRadius: 5, padding: '3px 6px', background: bf.status === 'pending' ? 'white' : 'transparent', color: bf.status === 'error' ? '#9f1239' : 'var(--text)', width: '100%', outline: 'none' }}
                />
                <input
                  value={bf.cas}
                  disabled={bf.status !== 'pending'}
                  onChange={e => setFichasFiles(prev => prev.map(f => f.id === bf.id ? { ...f, cas: e.target.value } : f))}
                  placeholder="ej. 7732-18-5"
                  style={{ fontSize: '0.78rem', border: bf.status === 'pending' ? '1px solid #e2e8f0' : 'none', borderRadius: 5, padding: '3px 6px', background: bf.status === 'pending' ? 'white' : 'transparent', width: '100%', outline: 'none', textAlign: 'center' }}
                />
                <input
                  value={bf.fabricante}
                  disabled={bf.status !== 'pending'}
                  onChange={e => setFichasFiles(prev => prev.map(f => f.id === bf.id ? { ...f, fabricante: e.target.value } : f))}
                  placeholder="Fabricante"
                  style={{ fontSize: '0.78rem', border: bf.status === 'pending' ? '1px solid #e2e8f0' : 'none', borderRadius: 5, padding: '3px 6px', background: bf.status === 'pending' ? 'white' : 'transparent', width: '100%', outline: 'none' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {bf.status === 'pending'   && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Pendiente</span>}
                  {bf.status === 'uploading' && <Loader2 size={15} color="#0f766e" style={{ animation: 'spin 1s linear infinite' }} />}
                  {bf.status === 'done'      && <CheckCircle2 size={16} color="#16a34a" />}
                  {bf.status === 'error'     && <span title={bf.error}><AlertCircle size={16} color="#dc2626" /></span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderTop: fichasFiles.length > 0 ? '1px solid var(--border)' : 'none', marginTop: fichasFiles.length === 0 ? 16 : 0 }}>
          <div style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {fichasFiles.length === 0 && 'Ningún archivo seleccionado'}
            {fichasFiles.length > 0 && !allDone && `${fichasFiles.length} ficha${fichasFiles.length > 1 ? 's' : ''} · ${pending} pendiente${pending !== 1 ? 's' : ''}`}
            {allDone && <span style={{ color: errors > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{done} subida{done !== 1 ? 's' : ''}{errors > 0 ? ` · ${errors} con error` : ' correctamente ✓'}</span>}
          </div>
          {!fichasUploading && !allDone && <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>}
          {allDone
            ? <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
            : (
              <button
                onClick={onUpload}
                disabled={fichasUploading || pending === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: pending > 0 ? '#0f766e' : '#94a3b8', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: pending > 0 ? 'pointer' : 'not-allowed' }}
              >
                {fichasUploading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Subiendo…</> : <><Upload size={14} /> Subir {pending > 0 ? `${pending} ficha${pending > 1 ? 's' : ''}` : 'fichas'}</>}
              </button>
            )
          }
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function BulkUploadModal({ bulkFiles, setBulkFiles, bulkUploading, onAddFiles, onUpload, onClose }) {
  const dropRef = useRef(null);
  const inputRef = useRef(null);
  const pending  = bulkFiles.filter(f => f.status === 'pending').length;
  const done     = bulkFiles.filter(f => f.status === 'done').length;
  const errors   = bulkFiles.filter(f => f.status === 'error').length;
  const allDone  = bulkFiles.length > 0 && done + errors === bulkFiles.length;

  const onDrop = (e) => {
    e.preventDefault();
    onAddFiles(e.dataTransfer.files);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <Globe size={20} color="#0369a1" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0369a1' }}>Carga masiva — Normativa / Documentación Externa</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>R.D., Normas UNE, Guías ENAC… → se asignarán a PC-14</div>
          </div>
          {!bulkUploading && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>}
        </div>

        {/* Drop zone */}
        <div
          ref={dropRef}
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{ margin: '16px 20px 0', border: '2px dashed #93c5fd', borderRadius: 10, padding: '18px', textAlign: 'center', cursor: 'pointer', background: '#f0f9ff', transition: 'background 0.15s' }}
          onMouseOver={e => e.currentTarget.style.background = '#dbeafe'}
          onMouseOut={e => e.currentTarget.style.background = '#f0f9ff'}
        >
          <Upload size={22} color="#0369a1" style={{ marginBottom: 6 }} />
          <div style={{ fontSize: '0.85rem', color: '#0369a1', fontWeight: 600 }}>Arrastra PDFs aquí o haz clic para seleccionar</div>
          <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: 3 }}>Solo archivos PDF · Puedes seleccionar varios a la vez</div>
          <input ref={inputRef} type="file" multiple accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={e => { onAddFiles(e.target.files); e.target.value = ''; }} />
        </div>

        {/* File list */}
        {bulkFiles.length > 0 && (
          <div style={{ flex: 1, overflowY: 'auto', margin: '12px 20px 0', border: '1px solid var(--border)', borderRadius: 8 }}>
            {/* Counter row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 120px 64px', padding: '6px 12px', background: '#f8fafc', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              <span>NOMBRE DEL DOCUMENTO</span>
              <span style={{ textAlign: 'center' }}>VERSIÓN</span>
              <span style={{ textAlign: 'center' }}>FECHA</span>
              <span style={{ textAlign: 'center' }}>ESTADO</span>
            </div>
            {bulkFiles.map((bf) => (
              <div key={bf.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 120px 64px', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid #f1f5f9', background: bf.status === 'done' ? '#f0fdf4' : bf.status === 'error' ? '#fff1f2' : 'white' }}>
                <input
                  value={bf.name}
                  disabled={bf.status !== 'pending'}
                  onChange={e => setBulkFiles(prev => prev.map(f => f.id === bf.id ? { ...f, name: e.target.value } : f))}
                  style={{ fontSize: '0.82rem', border: bf.status === 'pending' ? '1px solid #e2e8f0' : 'none', borderRadius: 5, padding: '3px 6px', background: bf.status === 'pending' ? 'white' : 'transparent', color: bf.status === 'error' ? '#9f1239' : 'var(--text)', width: '100%', outline: 'none' }}
                />
                <input
                  value={bf.version}
                  disabled={bf.status !== 'pending'}
                  onChange={e => setBulkFiles(prev => prev.map(f => f.id === bf.id ? { ...f, version: e.target.value } : f))}
                  placeholder="v1.0"
                  style={{ fontSize: '0.8rem', border: bf.status === 'pending' ? '1px solid #e2e8f0' : 'none', borderRadius: 5, padding: '3px 6px', background: bf.status === 'pending' ? 'white' : 'transparent', width: '100%', outline: 'none', textAlign: 'center' }}
                />
                <input
                  type="date"
                  value={bf.date}
                  disabled={bf.status !== 'pending'}
                  onChange={e => setBulkFiles(prev => prev.map(f => f.id === bf.id ? { ...f, date: e.target.value } : f))}
                  style={{ fontSize: '0.78rem', border: bf.status === 'pending' ? '1px solid #e2e8f0' : 'none', borderRadius: 5, padding: '3px 4px', background: bf.status === 'pending' ? 'white' : 'transparent', width: '100%', outline: 'none' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {bf.status === 'pending'   && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Pendiente</span>}
                  {bf.status === 'uploading' && <Loader2 size={15} color="#0369a1" style={{ animation: 'spin 1s linear infinite' }} />}
                  {bf.status === 'done'      && <CheckCircle2 size={16} color="#16a34a" />}
                  {bf.status === 'error'     && <span title={bf.error}><AlertCircle size={16} color="#dc2626" /></span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderTop: bulkFiles.length > 0 ? '1px solid var(--border)' : 'none', marginTop: bulkFiles.length === 0 ? 16 : 0 }}>
          <div style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {bulkFiles.length === 0 && 'Ningún archivo seleccionado'}
            {bulkFiles.length > 0 && !allDone && `${bulkFiles.length} archivo${bulkFiles.length > 1 ? 's' : ''} · ${pending} pendiente${pending !== 1 ? 's' : ''}`}
            {allDone && <span style={{ color: errors > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{done} subido{done !== 1 ? 's' : ''}{errors > 0 ? ` · ${errors} con error` : ' correctamente ✓'}</span>}
          </div>
          {!bulkUploading && !allDone && <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>}
          {allDone
            ? <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
            : (
              <button
                onClick={onUpload}
                disabled={bulkUploading || pending === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: pending > 0 ? '#0369a1' : '#94a3b8', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: pending > 0 ? 'pointer' : 'not-allowed' }}
              >
                {bulkUploading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Subiendo…</> : <><Upload size={14} /> Subir {pending > 0 ? `${pending} archivo${pending > 1 ? 's' : ''}` : 'archivos'}</>}
              </button>
            )
          }
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function EmptyState({ search, onUpload }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <FolderOpen size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
      <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--secondary)', marginBottom: '8px' }}>
        {search ? 'Sin resultados' : 'Aún no hay documentos'}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px' }}>
        {search ? `No se encontró ningún documento con "${search}"` : 'Sube el primer PNT o documento arrastrándolo aquí'}
      </div>
      {!search && <button className="btn btn-primary" onClick={onUpload} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Upload size={16} /> Subir documento</button>}
    </div>
  );
}
