import React, { useState, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  UserPlus, Upload, Phone, Mail, MapPin, GraduationCap, Briefcase,
  CheckCircle2, Circle, Trash2, Eye, FileText, Sparkles, X, Save,
  Clock, ChevronDown, Edit, Layers, CheckCheck, AlertCircle, Loader2,
} from 'lucide-react';

const CANDIDATE_STATUSES = ['Nuevo', 'Contactado', 'En proceso', 'Descartado', 'Contratado'];

const DELEGACIONES = ['Baleares', 'Canarias (Tenerife)', 'Canarias (Gran Canaria)', 'Madrid', 'Barcelona', 'Andalucía', 'Valencia'];

const PUESTOS = [
  'Consultor Junior', 'Consultor Senior', 'Jefe de Consultores',
  'Analista Junior', 'Analista Senior', 'Jefe de Laboratorio',
];

const STATUS_STYLE = {
  'Nuevo':       { bg: '#e0e7ff', color: '#3730a3' },
  'Contactado':  { bg: '#dbeafe', color: '#1d4ed8' },
  'En proceso':  { bg: '#fef3c7', color: '#92400e' },
  'Descartado':  { bg: '#fee2e2', color: '#991b1b' },
  'Contratado':  { bg: '#dcfce7', color: '#166534' },
};

const inputStyle = {
  padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)',
  fontSize: '0.95rem', color: 'var(--text)', outline: 'none', width: '100%', backgroundColor: 'white',
};

async function extractCVWithClaude(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  const { data, error } = await supabase.functions.invoke('extract-cv', {
    body: { pdfBase64: base64 },
  });

  if (error) throw new Error(error.message || 'Error en la edge function');
  if (data?.error) throw new Error(data.error);
  return data;
}

const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtSize = (b) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

export default function CandidatesView({ candidates, onReload }) {
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterDeleg, setFilterDeleg] = useState('Todos');
  const [filterPuesto, setFilterPuesto] = useState('Todos');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showBulk, setShowBulk] = useState(false);

  const filtered = candidates.filter(c => {
    const matchStatus = filterStatus === 'Todos' || c.status === filterStatus;
    const matchDeleg = filterDeleg === 'Todos' || c.delegacion === filterDeleg;
    const matchPuesto = filterPuesto === 'Todos' || c.position_interest === filterPuesto;
    const matchSearch = !search || (c.full_name || '').toLowerCase().includes(search.toLowerCase()) || (c.email || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchDeleg && matchPuesto && matchSearch;
  });

  const counts = CANDIDATE_STATUSES.reduce((acc, s) => {
    acc[s] = candidates.filter(c => c.status === s).length;
    return acc;
  }, {});

  const toggleContacted = async (candidate) => {
    const now = new Date().toISOString();
    const newVal = !candidate.contacted;
    await supabase.from('candidates').update({
      contacted: newVal,
      contacted_at: newVal ? now : null,
      status: newVal && candidate.status === 'Nuevo' ? 'Contactado' : candidate.status,
    }).eq('id', candidate.id);
    onReload();
  };

  const deleteCandidate = async (c) => {
    if (!confirm(`¿Eliminar a ${c.full_name || 'este candidato'}?`)) return;
    if (c.cv_url) {
      const path = c.cv_url.split('/candidate-cvs/')[1];
      if (path) await supabase.storage.from('candidate-cvs').remove([decodeURIComponent(path)]);
    }
    await supabase.from('candidates').delete().eq('id', c.id);
    onReload();
  };

  const changeStatus = async (id, status, motivo = null) => {
    const update = { status };
    if (status === 'Descartado') update.motivo_descarte = motivo || null;
    else update.motivo_descarte = null;
    await supabase.from('candidates').update(update).eq('id', id);
    onReload();
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: 'var(--secondary)', fontSize: '1.4rem', fontWeight: 700 }}>Candidatos</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{candidates.length} candidatos registrados</p>
        </div>
        <button onClick={() => { setEditingId(null); setShowForm(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
          <UserPlus size={16} /> Añadir candidato
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[{ label: 'Todos', count: candidates.length }, ...CANDIDATE_STATUSES.map(s => ({ label: s, count: counts[s] }))].map(({ label, count }) => (
          <button key={label} onClick={() => setFilterStatus(label)}
            style={{
              padding: '6px 14px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
              border: filterStatus === label ? '1.5px solid var(--primary)' : '1px solid var(--border)',
              backgroundColor: filterStatus === label ? 'var(--primary-light)' : 'white',
              color: filterStatus === label ? 'var(--primary)' : 'var(--text-muted)',
            }}>
            {label} · {count}
          </button>
        ))}
      </div>

      {/* Filtro delegación */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', minWidth: '80px' }}>Delegación</span>
        {['Todos', ...DELEGACIONES].map(d => (
          <button key={d} onClick={() => setFilterDeleg(d)}
            style={{
              padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              border: filterDeleg === d ? '1.5px solid var(--primary)' : '1px solid var(--border)',
              backgroundColor: filterDeleg === d ? 'var(--primary-light)' : 'white',
              color: filterDeleg === d ? 'var(--primary)' : 'var(--text-muted)',
            }}>{d}</button>
        ))}
      </div>

      {/* Filtro puesto */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', minWidth: '80px' }}>Puesto</span>
        {['Todos', ...PUESTOS].map(p => (
          <button key={p} onClick={() => setFilterPuesto(p)}
            style={{
              padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              border: filterPuesto === p ? '1.5px solid var(--primary)' : '1px solid var(--border)',
              backgroundColor: filterPuesto === p ? 'var(--primary-light)' : 'white',
              color: filterPuesto === p ? 'var(--primary)' : 'var(--text-muted)',
            }}>{p}</button>
        ))}
      </div>

      {/* Buscador */}
      <div style={{ marginBottom: '18px' }}>
        <input type="text" placeholder="Buscar por nombre o email..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, maxWidth: '360px' }} />
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <UserPlus size={48} style={{ opacity: 0.2, marginBottom: '12px' }} />
          <p style={{ margin: 0 }}>No hay candidatos con estos filtros</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(c => (
            <CandidateCard key={c.id}
              candidate={c}
              onToggleContacted={() => toggleContacted(c)}
              onDelete={() => deleteCandidate(c)}
              onStatusChange={(s, motivo) => changeStatus(c.id, s, motivo)}
              onEdit={() => { setEditingId(c.id); setShowForm(true); }}
            />
          ))}
        </div>
      )}

      {showForm && (
        <CandidateFormModal
          editingId={editingId}
          candidates={candidates}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); onReload(); }}
        />
      )}
    </div>
  );
}

// ── Modal motivo descarte ─────────────────────────────────────────────────────
function MotivoDescarteModal({ onConfirm, onCancel }) {
  const [motivo, setMotivo] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '14px', width: '100%', maxWidth: '440px', padding: '28px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 8px', color: '#991b1b', fontWeight: 700, fontSize: '1.05rem' }}>Motivo de descarte</h3>
        <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>Indica el motivo por el que se descarta a este candidato.</p>
        <textarea
          autoFocus
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Ej: Experiencia insuficiente, salario no ajustado, perfil no encaja..."
          style={{ ...inputStyle, resize: 'vertical', minHeight: '90px', marginBottom: '18px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onCancel}
            style={{ padding: '9px 18px', borderRadius: '9px', border: '1px solid var(--border)', backgroundColor: 'white', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={() => onConfirm(motivo)} disabled={!motivo.trim()}
            style={{ padding: '9px 18px', borderRadius: '9px', border: 'none', backgroundColor: motivo.trim() ? '#991b1b' : '#fca5a5', color: 'white', fontWeight: 600, cursor: motivo.trim() ? 'pointer' : 'default' }}>
            Confirmar descarte
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta candidato ─────────────────────────────────────────────────────────
function CandidateCard({ candidate: c, onToggleContacted, onDelete, onStatusChange, onEdit }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [showMotivoModal, setShowMotivoModal] = useState(false);
  const st = STATUS_STYLE[c.status] || STATUS_STYLE['Nuevo'];

  return (
    <div style={{ backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>

        {/* Avatar */}
        <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '1rem', flexShrink: 0 }}>
          {(c.full_name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--secondary)' }}>{c.full_name || '—'}</span>

            {/* Status dropdown */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setStatusOpen(p => !p)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: st.bg, color: st.color, border: 'none', borderRadius: '999px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                {c.status} <ChevronDown size={12} />
              </button>
              {statusOpen && (
                <div style={{ position: 'absolute', top: '28px', left: 0, backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: '150px', overflow: 'hidden' }}>
                  {CANDIDATE_STATUSES.map(s => (
                    <div key={s} onClick={() => {
                      setStatusOpen(false);
                      if (s === 'Descartado') { setShowMotivoModal(true); }
                      else { onStatusChange(s, null); }
                    }}
                      style={{ padding: '9px 14px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: STATUS_STYLE[s].color, backgroundColor: c.status === s ? STATUS_STYLE[s].bg : 'white' }}
                      onMouseOver={e => e.currentTarget.style.backgroundColor = STATUS_STYLE[s].bg}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = c.status === s ? STATUS_STYLE[s].bg : 'white'}>
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {c.position_interest && (
              <span style={{ fontSize: '0.78rem', backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '999px' }}>
                {c.position_interest}
              </span>
            )}
            {c.delegacion && (
              <span style={{ fontSize: '0.78rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '999px' }}>
                {c.delegacion}
              </span>
            )}
          </div>

          {/* Datos */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
            {c.email    && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={13} />{c.email}</span>}
            {c.phone    && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={13} />{c.phone}</span>}
            {c.address  && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={13} />{c.address}</span>}
          </div>
          {c.titulacion && (
            <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '4px', marginBottom: '4px' }}>
              <GraduationCap size={13} style={{ marginTop: 2, flexShrink: 0 }} /><span>{c.titulacion}</span>
            </div>
          )}
          {c.experiencia && (
            <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'flex-start', gap: '4px', lineHeight: 1.4 }}>
              <Briefcase size={13} style={{ marginTop: 2, flexShrink: 0 }} /><span>{c.experiencia}</span>
            </div>
          )}
          {c.status === 'Descartado' && c.motivo_descarte && (
            <div style={{ marginTop: '6px', padding: '6px 10px', backgroundColor: '#fee2e2', borderRadius: '8px', fontSize: '0.8rem', color: '#991b1b', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 700, flexShrink: 0 }}>Motivo:</span>
              <span>{c.motivo_descarte}</span>
            </div>
          )}
          {c.notes && (
            <div style={{ marginTop: '6px', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>{c.notes}</div>
          )}
          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
            Recibido: {fmtDate(c.created_at)}
            {c.contacted_at && <span style={{ marginLeft: '12px', color: '#166534' }}>✓ Contactado: {fmtDate(c.contacted_at)}</span>}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Toggle contactado */}
          <button onClick={onToggleContacted} title={c.contacted ? 'Marcar como no contactado' : 'Marcar como contactado'}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: `1.5px solid ${c.contacted ? '#166534' : 'var(--border)'}`, backgroundColor: c.contacted ? '#dcfce7' : 'white', color: c.contacted ? '#166534' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
            {c.contacted ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            {c.contacted ? 'Contactado' : 'Sin contactar'}
          </button>

          {c.cv_url && (
            <a href={c.cv_url} target="_blank" rel="noreferrer" title="Ver CV"
              style={{ padding: '7px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'white', color: 'var(--primary)', display: 'flex', cursor: 'pointer' }}>
              <Eye size={15} />
            </a>
          )}

          <button onClick={onEdit} title="Editar"
            style={{ padding: '7px', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex' }}>
            <Edit size={15} />
          </button>

          <button onClick={onDelete} title="Eliminar"
            style={{ padding: '7px', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex' }}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {showMotivoModal && (
        <MotivoDescarteModal
          onConfirm={(motivo) => { setShowMotivoModal(false); onStatusChange('Descartado', motivo); }}
          onCancel={() => setShowMotivoModal(false)}
        />
      )}
    </div>
  );
}

// ── Modal nuevo/editar candidato ──────────────────────────────────────────────
function CandidateFormModal({ editingId, candidates, onClose, onSaved }) {
  const existing = editingId ? candidates.find(c => c.id === editingId) : null;

  const [form, setForm] = useState({
    full_name: existing?.full_name || '',
    email: existing?.email || '',
    phone: existing?.phone || '',
    address: existing?.address || '',
    titulacion: existing?.titulacion || '',
    experiencia: existing?.experiencia || '',
    position_interest: existing?.position_interest || '',
    delegacion: existing?.delegacion || '',
    notes: existing?.notes || '',
    status: existing?.status || 'Nuevo',
  });

  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setExtractError('');

    if (f.type !== 'application/pdf') {
      setExtractError('Solo se admiten PDFs para extracción automática. Rellena los datos manualmente.');
      return;
    }

    setExtracting(true);
    try {
      const data = await extractCVWithClaude(f);
      setForm(p => ({
        ...p,
        full_name: data.full_name || p.full_name,
        email: data.email || p.email,
        phone: data.phone || p.phone,
        address: data.address || p.address,
        titulacion: data.titulacion || p.titulacion,
        experiencia: data.experiencia || p.experiencia,
      }));
    } catch (err) {
      setExtractError(`Error al extraer datos: ${err.message}`);
    } finally {
      setExtracting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      let cv_url = existing?.cv_url || null;
      let cv_file_name = existing?.cv_file_name || null;
      let cv_file_size = existing?.cv_file_size || null;

      if (file) {
        const path = `${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('candidate-cvs').upload(path, file, { upsert: false });
        if (!error) {
          const { data: urlData } = supabase.storage.from('candidate-cvs').getPublicUrl(path);
          cv_url = urlData.publicUrl;
          cv_file_name = file.name;
          cv_file_size = file.size;
        }
      }

      const payload = { ...form, cv_url, cv_file_name, cv_file_size };
      if (editingId) {
        await supabase.from('candidates').update(payload).eq('id', editingId);
      } else {
        await supabase.from('candidates').insert([payload]);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '660px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
          <h3 style={{ margin: 0, color: 'var(--secondary)', fontWeight: 700 }}>{editingId ? 'Editar candidato' : 'Nuevo candidato'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={22} /></button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Drop zone CV */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Currículum (PDF)
            </div>
            <div onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', backgroundColor: file ? 'var(--primary-light)' : '#fafafa', transition: 'background 0.15s' }}>
              {extracting ? (
                <div style={{ color: 'var(--primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <Clock size={28} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Extrayendo datos con IA...</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Esto tarda unos segundos</span>
                </div>
              ) : file ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--primary)' }}>
                  <FileText size={22} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{file.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtSize(file.size)}</div>
                  </div>
                  <Sparkles size={16} style={{ marginLeft: '4px' }} />
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>
                  <Upload size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>Sube el CV en PDF</div>
                  <div style={{ fontSize: '0.8rem' }}>Claude extraerá automáticamente nombre, email, teléfono, dirección, titulación y experiencia</div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />

            {extractError && (
              <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: '#fef3c7', borderRadius: '8px', fontSize: '0.82rem', color: '#92400e', display: 'flex', gap: '8px' }}>
                ⚠ {extractError}
              </div>
            )}

            {file && !extracting && !extractError && (
              <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: '#dcfce7', borderRadius: '8px', fontSize: '0.82rem', color: '#166534' }}>
                ✓ Datos extraídos automáticamente — revisa y corrige si es necesario
              </div>
            )}
          </div>

          {/* Campos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <FormField label="Nombre completo" colSpan={2}>
              <input value={form.full_name} onChange={set('full_name')} style={inputStyle} placeholder="Nombre y apellidos" />
            </FormField>
            <FormField label="Email">
              <input type="email" value={form.email} onChange={set('email')} style={inputStyle} placeholder="email@ejemplo.com" />
            </FormField>
            <FormField label="Teléfono">
              <input value={form.phone} onChange={set('phone')} style={inputStyle} placeholder="+34 600 000 000" />
            </FormField>
            <FormField label="Dirección / Ciudad" colSpan={2}>
              <input value={form.address} onChange={set('address')} style={inputStyle} placeholder="Ciudad, provincia..." />
            </FormField>
            <FormField label="Titulación" colSpan={2}>
              <input value={form.titulacion} onChange={set('titulacion')} style={inputStyle} placeholder="Grado en..., Máster en..., FP en..." />
            </FormField>
            <FormField label="Experiencia" colSpan={2}>
              <textarea value={form.experiencia} onChange={set('experiencia')} style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} placeholder="Resumen de experiencia laboral relevante..." />
            </FormField>
            <FormField label="Puesto de interés">
              <select value={form.position_interest} onChange={set('position_interest')} style={inputStyle}>
                <option value="">— Sin especificar —</option>
                {PUESTOS.map(p => <option key={p}>{p}</option>)}
              </select>
            </FormField>
            <FormField label="Delegación">
              <select value={form.delegacion} onChange={set('delegacion')} style={inputStyle}>
                <option value="">— Sin especificar —</option>
                {DELEGACIONES.map(d => <option key={d}>{d}</option>)}
              </select>
            </FormField>
            <FormField label="Estado">
              <select value={form.status} onChange={set('status')} style={inputStyle}>
                {CANDIDATE_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Notas" colSpan={2}>
              <textarea value={form.notes} onChange={set('notes')} style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} placeholder="Observaciones internas..." />
            </FormField>
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '4px' }}>
            <button onClick={onClose}
              style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'white', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={save} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
              <Save size={16} />{saving ? 'Guardando...' : 'Guardar candidato'}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function FormField({ label, children, colSpan = 1 }) {
  return (
    <div style={{ gridColumn: `span ${colSpan}`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      {children}
    </div>
  );
}
