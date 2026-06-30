import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, FileText, Trash2, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from './supabaseClient';

const DOC_TYPES = [
  { value: 'certificado_iso9001',  label: 'Certificado ISO 9001' },
  { value: 'certificado_iso17025', label: 'Certificado ISO 17025' },
  { value: 'acreditacion_enac',    label: 'Acreditación ENAC' },
  { value: 'contrato',             label: 'Contrato' },
  { value: 'nda',                  label: 'Acuerdo de Confidencialidad (NDA)' },
  { value: 'ficha_tecnica',        label: 'Ficha técnica / Catálogo' },
  { value: 'otro',                 label: 'Otro documento' },
];

function docStatus(expiry) {
  if (!expiry) return null;
  const today = new Date().toISOString().slice(0,10);
  const d60 = new Date(); d60.setDate(d60.getDate() + 60);
  const exp60 = d60.toISOString().slice(0,10);
  if (expiry < today) return 'caducado';
  if (expiry < exp60) return 'proximo';
  return 'vigente';
}

export default function SupplierDocsModal({ isOpen, onClose, supplier, lab }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ doc_type: 'certificado_iso9001', name: '', expiry_date: '' });
  const fileRef = useRef();

  useEffect(() => { if (isOpen && supplier) loadDocs(); }, [isOpen, supplier]);

  const loadDocs = async () => {
    const { data } = await supabase.from('supplier_documents')
      .select('*').eq('supplier_id', supplier.id).eq('lab', lab).order('uploaded_at', { ascending: false });
    setDocs(data || []);
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { alert('Selecciona un archivo primero.'); return; }
    if (!form.name.trim()) { alert('Introduce un nombre descriptivo.'); return; }
    setUploading(true);
    const filePath = `${lab}/${supplier.id}/${form.doc_type}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from('supplier-docs').upload(filePath, file);
    if (upErr) { alert('Error subiendo archivo: ' + upErr.message); setUploading(false); return; }
    await supabase.from('supplier_documents').insert([{
      supplier_id: supplier.id, lab,
      doc_type: form.doc_type,
      name: form.name.trim(),
      file_path: filePath,
      file_name: file.name,
      expiry_date: form.expiry_date || null,
    }]);
    setUploading(false);
    setForm({ doc_type: 'certificado_iso9001', name: '', expiry_date: '' });
    fileRef.current.value = '';
    loadDocs();
  };

  const handleDownload = async (doc) => {
    const { data } = await supabase.storage.from('supplier-docs').createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`¿Eliminar "${doc.name}"? Esta acción no se puede deshacer.`)) return;
    await supabase.storage.from('supplier-docs').remove([doc.file_path]);
    await supabase.from('supplier_documents').delete().eq('id', doc.id);
    loadDocs();
  };

  if (!isOpen || !supplier) return null;

  const expiredDocs = docs.filter(d => docStatus(d.expiry_date) === 'caducado');
  const soonDocs    = docs.filter(d => docStatus(d.expiry_date) === 'proximo');

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, backdropFilter:'blur(4px)' }}>
      <div className="card" style={{ width:'620px', margin:0, maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border)', paddingBottom:'14px', marginBottom:'16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <FileText size={20} color="var(--primary)" />
            <span style={{ fontWeight:700, color:'var(--secondary)', fontSize:'1.05rem' }}>Documentos — {supplier.name}</span>
          </div>
          <button className="btn btn-secondary" style={{ padding:'6px', border:'none' }} onClick={onClose}><X size={20}/></button>
        </div>

        {/* Alertas */}
        {expiredDocs.length > 0 && (
          <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:'8px', padding:'10px 14px', marginBottom:'12px', display:'flex', gap:'8px', alignItems:'center', fontSize:'0.83rem', color:'#b91c1c' }}>
            <AlertTriangle size={16} /> {expiredDocs.length} documento(s) caducado(s): {expiredDocs.map(d=>d.name).join(', ')}
          </div>
        )}
        {soonDocs.length > 0 && (
          <div style={{ background:'#fff8e1', border:'1px solid #fde68a', borderRadius:'8px', padding:'10px 14px', marginBottom:'12px', display:'flex', gap:'8px', alignItems:'center', fontSize:'0.83rem', color:'#92400e' }}>
            <AlertTriangle size={16} /> Vencen en &lt;60 días: {soonDocs.map(d=>`${d.name} (${d.expiry_date})`).join(', ')}
          </div>
        )}

        {/* Formulario subida */}
        <div style={{ background:'var(--background)', borderRadius:'8px', padding:'14px', marginBottom:'20px' }}>
          <div style={{ fontWeight:700, fontSize:'0.82rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'12px' }}>Subir documento</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            <div className="input-group" style={{ marginBottom:0 }}>
              <label className="input-label">Tipo de documento</label>
              <select className="input-field" value={form.doc_type} onChange={e => setForm(f=>({...f, doc_type:e.target.value}))}>
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom:0 }}>
              <label className="input-label">Nombre descriptivo *</label>
              <input type="text" className="input-field" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}
                placeholder="ej. Cert. ISO 9001 2025-2027" />
            </div>
            <div className="input-group" style={{ marginBottom:0 }}>
              <label className="input-label">Fecha de caducidad</label>
              <input type="date" className="input-field" value={form.expiry_date} onChange={e => setForm(f=>({...f,expiry_date:e.target.value}))} />
            </div>
            <div className="input-group" style={{ marginBottom:0 }}>
              <label className="input-label">Archivo (PDF / imagen)</label>
              <input type="file" ref={fileRef} accept=".pdf,.jpg,.jpeg,.png,.webp"
                style={{ fontSize:'0.82rem', padding:'6px', border:'1px solid var(--border)', borderRadius:'6px', width:'100%', boxSizing:'border-box' }} />
            </div>
          </div>
          <button className="btn btn-primary" style={{ width:'100%' }} onClick={handleUpload} disabled={uploading}>
            <Upload size={15} style={{ marginRight:'6px' }} /> {uploading ? 'Subiendo…' : 'Subir documento'}
          </button>
        </div>

        {/* Lista de documentos */}
        {docs.length === 0 ? (
          <div style={{ textAlign:'center', padding:'30px', color:'var(--text-muted)', fontSize:'0.9rem' }}>
            No hay documentos adjuntos aún.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {docs.map(doc => {
              const st = docStatus(doc.expiry_date);
              const stColor = st === 'caducado' ? '#dc2626' : st === 'proximo' ? '#d97706' : '#16a34a';
              const stLabel = st === 'caducado' ? 'Caducado' : st === 'proximo' ? 'Próximo a vencer' : 'Vigente';
              return (
                <div key={doc.id} style={{ background:'var(--background)', borderRadius:'8px', padding:'10px 14px', display:'flex', alignItems:'center', gap:'12px' }}>
                  <FileText size={20} color="var(--primary)" style={{ flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:'0.88rem', color:'var(--secondary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{doc.name}</div>
                    <div style={{ fontSize:'0.74rem', color:'var(--text-muted)' }}>
                      {DOC_TYPES.find(t=>t.value===doc.doc_type)?.label || doc.doc_type} · {doc.file_name}
                    </div>
                  </div>
                  {doc.expiry_date && (
                    <div style={{ fontSize:'0.74rem', fontWeight:700, color:stColor, whiteSpace:'nowrap', textAlign:'right' }}>
                      <div>{stLabel}</div>
                      <div style={{ fontWeight:400 }}>{doc.expiry_date}</div>
                    </div>
                  )}
                  {!doc.expiry_date && (
                    <div style={{ fontSize:'0.74rem', color:'var(--text-muted)' }}>Sin caducidad</div>
                  )}
                  <button className="btn btn-secondary" style={{ padding:'5px 8px', fontSize:'0.78rem', display:'flex', gap:'4px', alignItems:'center' }}
                    onClick={() => handleDownload(doc)}>
                    <Download size={13} /> Ver
                  </button>
                  <button className="btn btn-secondary" style={{ padding:'5px', border:'none', color:'var(--danger)' }}
                    onClick={() => handleDelete(doc)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
