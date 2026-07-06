import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Upload, Search, FileText, Download, Eye, Trash2, X, FolderOpen, ChevronRight, File, BookOpen, ClipboardList, FlaskConical, Award, Wrench } from 'lucide-react';
import { supabase } from './supabaseClient';

const CATEGORIES = [
  { id: 'PNT',                 label: 'PNT',                          sub: 'Procedimientos Normalizados de Trabajo', icon: BookOpen,      color: '#1d4ed8', bg: '#dbeafe' },
  { id: 'Instrucción Técnica', label: 'Instrucción Técnica',          sub: 'Instrucciones de trabajo específicas',  icon: ClipboardList, color: '#0f6e56', bg: '#d1fae5' },
  { id: 'Registro',            label: 'Registro',                     sub: 'Formularios y registros de datos',      icon: FileText,      color: '#92400e', bg: '#fef3c7' },
  { id: 'Informe',             label: 'Informe',                      sub: 'Informes técnicos y de resultados',     icon: FlaskConical,  color: '#6d28d9', bg: '#ede9fe' },
  { id: 'Manual de Equipo',    label: 'Manual de Equipo',             sub: 'Documentación técnica de equipos',      icon: Wrench,        color: '#be185d', bg: '#fce7f3' },
  { id: 'Certificado',         label: 'Certificado',                  sub: 'Certificados y acreditaciones',         icon: Award,         color: '#065f46', bg: '#d1fae5' },
  { id: 'Otro',                label: 'Otro',                         sub: 'Resto de documentación',                icon: File,          color: '#374151', bg: '#f3f4f6' },
];

const BUCKET = 'documents';

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

export default function DocumentsModule({ session, onBackToHub, role = 'operations' }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('todos');
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'PNT', subcategory: '', version: '', description: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const fileRef = useRef(null);

  const userEmail = session?.user?.email || 'desconocido';
  const isAdmin = ['admin', 'lab'].includes(role);

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

  const filtered = docs.filter(d => {
    const matchCat = activeCategory === 'todos' || d.category === activeCategory;
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || (d.description || '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const countByCategory = (catId) => docs.filter(d => d.category === catId).length;

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(d => d.category === cat.id);
    if (items.length) acc[cat.id] = items;
    return acc;
  }, {});

  const handleFileSelect = (file) => {
    if (!file) return;
    setSelectedFile(file);
    setForm(f => ({ ...f, name: file.name.replace(/\.[^.]+$/, '') }));
    setShowUpload(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !form.name || !form.category) return;
    setUploading(true);
    try {
      const ext = selectedFile.name.split('.').pop();
      const path = `${form.category}/${Date.now()}_${selectedFile.name}`;
      const { error: storageErr } = await supabase.storage.from(BUCKET).upload(path, selectedFile);
      if (storageErr) throw storageErr;
      const { error: dbErr } = await supabase.from('documents').insert({
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        subcategory: form.subcategory.trim() || null,
        version: form.version.trim() || null,
        file_path: path,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        uploaded_by: userEmail,
      });
      if (dbErr) throw dbErr;
      setShowUpload(false);
      setSelectedFile(null);
      setForm({ name: '', category: 'PNT', subcategory: '', version: '', description: '' });
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
      a.href = data.signedUrl;
      a.download = doc.file_name;
      a.click();
    }
  };

  const handleDelete = async (doc) => {
    await supabase.storage.from(BUCKET).remove([doc.file_path]);
    await supabase.from('documents').update({ is_active: false }).eq('id', doc.id);
    setDeleteId(null);
    await fetchDocs();
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--background)', fontFamily: 'var(--font, Arial, sans-serif)' }}>

      {/* ── SIDEBAR ── */}
      <div style={{ width: '240px', backgroundColor: 'var(--sidebar-bg, #0076CE)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '24px 20px 16px' }}>
          <button onClick={onBackToHub} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '0.82rem', marginBottom: '20px', width: '100%' }}>
            <ArrowLeft size={15} /> Portal principal
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <FolderOpen size={22} color="white" />
            <span style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>Documentos</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.75rem' }}>Gestión documental</span>
        </div>

        <nav style={{ flex: 1, padding: '0 12px', overflowY: 'auto' }}>
          <SidebarItem label="Todos los documentos" count={docs.length} active={activeCategory === 'todos'} onClick={() => setActiveCategory('todos')} />
          <div style={{ margin: '12px 0 6px 8px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Categorías</div>
          {CATEGORIES.map(cat => (
            <SidebarItem key={cat.id} label={cat.label} count={countByCategory(cat.id)} active={activeCategory === cat.id} onClick={() => setActiveCategory(cat.id)} />
          ))}
        </nav>

        <div style={{ padding: '16px 12px' }}>
          <button
            onClick={() => { setShowUpload(true); setSelectedFile(null); }}
            style={{ width: '100%', padding: '10px', background: 'white', color: 'var(--sidebar-bg, #0076CE)', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Upload size={16} /> Subir documento
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '24px 32px 16px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface, white)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o descripción…"
                className="input-field"
                style={{ paddingLeft: '38px', margin: 0, width: '100%' }}
              />
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {filtered.length} documento{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}
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
          ) : filtered.length === 0 ? (
            <EmptyState search={search} onUpload={() => setShowUpload(true)} />
          ) : activeCategory !== 'todos' ? (
            <DocGrid docs={filtered} onView={handleView} onDownload={handleDownload} onDelete={isAdmin ? setDeleteId : null} />
          ) : (
            Object.entries(grouped).map(([catId, items]) => {
              const cat = getCatMeta(catId);
              const Icon = cat.icon;
              return (
                <div key={catId} style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={16} color={cat.color} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--secondary, #000b3d)' }}>{cat.label}</span>
                    <span style={{ fontSize: '0.78rem', background: cat.bg, color: cat.color, borderRadius: '20px', padding: '1px 8px', fontWeight: 600 }}>{items.length}</span>
                  </div>
                  <DocGrid docs={items} onView={handleView} onDownload={handleDownload} onDelete={isAdmin ? setDeleteId : null} />
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* ── UPLOAD MODAL ── */}
      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Upload size={20} color="var(--primary)" />
                <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Subir documento</span>
              </div>
              <button onClick={() => setShowUpload(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${selectedFile ? 'var(--primary)' : '#cbd5e1'}`, borderRadius: '12px', padding: '28px', textAlign: 'center', cursor: 'pointer', background: selectedFile ? 'var(--primary-light, #eff6ff)' : '#f8fafc', marginBottom: '20px', transition: 'all 0.2s' }}
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

              {/* Form */}
              <div className="input-group" style={{ marginBottom: '14px' }}>
                <label className="input-label">Nombre del documento *</label>
                <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: PNT-01 Recepción de muestras" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Categoría *</label>
                  <select className="input-field" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Versión</label>
                  <input className="input-field" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="Ej: v1.0" />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '14px' }}>
                <label className="input-label">Subcategoría / Área</label>
                <input className="input-field" value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))} placeholder="Ej: Microbiología, Metrología…" />
              </div>

              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label className="input-label">Descripción</label>
                <textarea className="input-field" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descripción del contenido…" style={{ resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancelar</button>
                <button
                  className="btn btn-primary"
                  onClick={handleUpload}
                  disabled={!selectedFile || !form.name || uploading}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Upload size={16} /> {uploading ? 'Subiendo…' : 'Subir documento'}
                </button>
              </div>
            </div>
          </div>
        </div>
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

function SidebarItem({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', marginBottom: '2px', background: active ? 'rgba(255,255,255,0.2)' : 'transparent', color: active ? 'white' : 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: active ? 600 : 400, textAlign: 'left', transition: 'background 0.15s' }}
    >
      <span>{label}</span>
      {count > 0 && <span style={{ background: active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)', borderRadius: '20px', padding: '1px 7px', fontSize: '0.72rem', fontWeight: 600 }}>{count}</span>}
    </button>
  );
}

function DocGrid({ docs, onView, onDownload, onDelete }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
      {docs.map(doc => <DocCard key={doc.id} doc={doc} onView={onView} onDownload={onDownload} onDelete={onDelete} />)}
    </div>
  );
}

function DocCard({ doc, onView, onDownload, onDelete }) {
  const cat = getCatMeta(doc.category);
  const Icon = cat.icon;
  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'box-shadow 0.2s' }}
      onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
      onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={18} color={cat.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--secondary, #000b3d)', lineHeight: 1.35, wordBreak: 'break-word' }}>{doc.name}</div>
          {doc.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{doc.description}</div>}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, background: cat.bg, color: cat.color, borderRadius: '20px', padding: '2px 8px' }}>{doc.category}</span>
        {doc.subcategory && <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', borderRadius: '20px', padding: '2px 8px' }}>{doc.subcategory}</span>}
        {doc.version && <span style={{ fontSize: '0.72rem', background: '#f0fdf4', color: '#166534', borderRadius: '20px', padding: '2px 8px', fontWeight: 600 }}>{doc.version}</span>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fmtDate(doc.created_at)}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fmtSize(doc.file_size)} · {doc.uploaded_by?.split('@')[0]}</div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <ActionBtn icon={Eye} title="Ver" onClick={() => onView(doc)} color="var(--primary)" />
          <ActionBtn icon={Download} title="Descargar" onClick={() => onDownload(doc)} color="#0f6e56" />
          {onDelete && <ActionBtn icon={Trash2} title="Eliminar" onClick={() => onDelete(doc.id)} color="#e11d48" />}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, title, onClick, color }) {
  return (
    <button title={title} onClick={onClick} style={{ width: '30px', height: '30px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
      onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
      onMouseOut={e => e.currentTarget.style.background = 'white'}
    >
      <Icon size={14} color={color} />
    </button>
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
