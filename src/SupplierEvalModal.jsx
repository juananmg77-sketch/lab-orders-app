import React, { useState, useEffect } from 'react';
import { X, Save, ClipboardCheck, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from './supabaseClient';

const RESULT_COLOR = { 'APROBADO': '#16a34a', 'APROBADO CON RESERVAS': '#d97706', 'NO APROBADO': '#dc2626' };

function ScoreInput({ label, name, value, onChange }) {
  return (
    <div className="input-group" style={{ marginBottom: 0 }}>
      <label className="input-label">{label}</label>
      <div style={{ display: 'flex', gap: '6px' }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button"
            onClick={() => onChange(name, n)}
            style={{
              width: '36px', height: '36px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.9rem',
              background: value === n ? (n >= 4 ? '#16a34a' : n === 3 ? '#d97706' : '#dc2626') : 'var(--background)',
              color: value === n ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.12s',
            }}>{n}</button>
        ))}
      </div>
    </div>
  );
}

function calcScore(form, supplier) {
  const { punctuality, quality_price, service, incidents_count,
          accreditations_ok, scope_covers_tests } = form;
  if (!punctuality || !quality_price || !service) return null;
  const base = (punctuality + quality_price + service) / 3;
  const penalty = Math.min((incidents_count || 0) * 0.2, base - 1);
  let score = Math.max(1, base - penalty);

  const isCritical = supplier?.is_critical;
  const isLab = supplier?.supplier_type === 'laboratorio_subcontratado';

  if (isCritical && accreditations_ok === false) return { score: parseFloat(score.toFixed(2)), result: 'NO APROBADO' };
  if (isLab && scope_covers_tests === false) return { score: parseFloat(score.toFixed(2)), result: 'NO APROBADO' };

  const result = score >= 4 ? 'APROBADO' : score >= 3 ? 'APROBADO CON RESERVAS' : 'NO APROBADO';
  return { score: parseFloat(score.toFixed(2)), result };
}

function periodToDateRange(period) {
  // Soporta: '2026', '2026-S1', '2026-S2', '2026-Q1'…'2026-Q4'
  if (!period) return { from: null, to: null };
  const yearMatch = period.match(/^(\d{4})$/);
  if (yearMatch) return { from: `${yearMatch[1]}-01-01`, to: `${yearMatch[1]}-12-31` };
  const s1 = period.match(/^(\d{4})-S1$/);
  if (s1) return { from: `${s1[1]}-01-01`, to: `${s1[1]}-06-30` };
  const s2 = period.match(/^(\d{4})-S2$/);
  if (s2) return { from: `${s2[1]}-07-01`, to: `${s2[1]}-12-31` };
  const q = period.match(/^(\d{4})-Q([1-4])$/);
  if (q) {
    const starts = ['01-01','04-01','07-01','10-01'];
    const ends   = ['03-31','06-30','09-30','12-31'];
    const qi = parseInt(q[2]) - 1;
    return { from: `${q[1]}-${starts[qi]}`, to: `${q[1]}-${ends[qi]}` };
  }
  return { from: null, to: null };
}

export default function SupplierEvalModal({ isOpen, onClose, supplier, lab, onSaved }) {
  const [form, setForm] = useState({
    evaluation_date: new Date().toISOString().slice(0,10),
    period: `${new Date().getFullYear()}`,
    evaluator: '',
    punctuality: null, quality_price: null, service: null,
    incidents_count: 0,
    accreditations_ok: null, quality_controls_ok: null,
    scope_covers_tests: null, proficiency_ok: null,
    notes: '',
  });
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [foundIncidents, setFoundIncidents] = useState([]);
  const [showIncidentList, setShowIncidentList] = useState(false);
  const [loadingIncidents, setLoadingIncidents] = useState(false);

  const isCritical = supplier?.is_critical;
  const isLab = supplier?.supplier_type === 'laboratorio_subcontratado';

  useEffect(() => {
    if (isOpen && supplier) { loadHistory(); }
  }, [isOpen, supplier]);

  // Buscar incidencias cuando cambia el período o el proveedor
  useEffect(() => {
    if (isOpen && supplier) fetchIncidents(form.period);
  }, [isOpen, supplier, form.period]);

  const loadHistory = async () => {
    const { data } = await supabase.from('supplier_evaluations')
      .select('*').eq('supplier_id', supplier.id).order('evaluation_date', { ascending: false }).limit(10);
    setHistory(data || []);
  };

  const deleteEvaluation = async (id) => {
    if (!confirm('¿Eliminar esta evaluación? Esta acción no se puede deshacer.')) return;
    await supabase.from('supplier_evaluations').delete().eq('id', id);
    setHistory(prev => prev.filter(e => e.id !== id));
  };

  const fetchIncidents = async (period) => {
    setLoadingIncidents(true);
    const { from, to } = periodToDateRange(period);
    let query = supabase.from('orders')
      .select('id, date, incidents, status')
      .eq('lab', lab)
      .eq('supplier', supplier.name)
      .not('incidents', 'is', null)
      .neq('incidents', '');

    if (from && to) {
      query = query.gte('date', from).lte('date', to);
    }

    const { data } = await query.order('date', { ascending: false });
    const found = data || [];
    setFoundIncidents(found);
    // Pre-rellenar el contador con el nº de pedidos con incidencia
    setForm(f => ({ ...f, incidents_count: found.length }));
    setLoadingIncidents(false);
  };

  const setScore = (name, val) => setForm(f => ({ ...f, [name]: f[name] === val ? null : val }));
  const setCheck = (name, val) => setForm(f => ({ ...f, [name]: f[name] === val ? null : val }));

  const computed = calcScore(form, supplier);

  const handleSave = async () => {
    if (!computed) { alert('Puntúa al menos puntualidad, calidad-precio y atención al cliente.'); return; }
    setSaving(true);
    await supabase.from('supplier_evaluations').insert([{
      supplier_id: supplier.id, lab,
      evaluation_date: form.evaluation_date,
      period: form.period,
      evaluator: form.evaluator || null,
      punctuality: form.punctuality,
      quality_price: form.quality_price,
      incidents_count: form.incidents_count,
      service: form.service,
      accreditations_ok: (isCritical || isLab) ? form.accreditations_ok : null,
      quality_controls_ok: (isCritical || isLab) ? form.quality_controls_ok : null,
      scope_covers_tests: isLab ? form.scope_covers_tests : null,
      proficiency_ok: isLab ? form.proficiency_ok : null,
      overall_score: computed.score,
      result: computed.result,
      notes: form.notes || null,
    }]);
    setSaving(false);
    onSaved?.();
    loadHistory();
    setForm(f => ({ ...f, punctuality: null, quality_price: null, service: null,
      accreditations_ok: null, quality_controls_ok: null, scope_covers_tests: null, proficiency_ok: null, notes: '' }));
  };

  if (!isOpen || !supplier) return null;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, backdropFilter:'blur(4px)' }}>
      <div className="card" style={{ width:'660px', margin:0, maxHeight:'90vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:0 }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border)', paddingBottom:'14px', marginBottom:'16px' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <ClipboardCheck size={20} color="var(--primary)" />
              <span style={{ fontWeight:700, color:'var(--secondary)', fontSize:'1.05rem' }}>Evaluación — {supplier.name}</span>
            </div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:'2px' }}>
              {supplier.supplier_type === 'laboratorio_subcontratado' ? 'Laboratorio Subcontratado ISO 17025' : supplier.is_critical ? 'Proveedor Crítico' : 'Proveedor estándar'}
            </div>
          </div>
          <button className="btn btn-secondary" style={{ padding:'6px', border:'none' }} onClick={onClose}><X size={20}/></button>
        </div>

        {/* Nueva evaluación */}
        <div style={{ background:'var(--background)', borderRadius:'8px', padding:'16px', marginBottom:'20px' }}>
          <div style={{ fontWeight:700, fontSize:'0.85rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'14px' }}>Nueva evaluación</div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'14px' }}>
            <div className="input-group" style={{ marginBottom:0 }}>
              <label className="input-label">Fecha evaluación</label>
              <input type="date" className="input-field" value={form.evaluation_date} onChange={e => setForm(f=>({...f,evaluation_date:e.target.value}))} />
            </div>
            <div className="input-group" style={{ marginBottom:0 }}>
              <label className="input-label">Período</label>
              <input type="text" className="input-field" value={form.period}
                onChange={e => setForm(f=>({...f,period:e.target.value}))}
                onBlur={e => fetchIncidents(e.target.value)}
                placeholder="ej. 2026 / 2026-S1 / 2026-Q2" />
            </div>
            <div className="input-group" style={{ marginBottom:0 }}>
              <label className="input-label">Evaluador</label>
              <input type="text" className="input-field" value={form.evaluator} onChange={e => setForm(f=>({...f,evaluator:e.target.value}))} placeholder="Nombre" />
            </div>

            {/* Incidencias — con datos de pedidos */}
            <div className="input-group" style={{ marginBottom:0 }}>
              <label className="input-label" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>Nº incidencias</span>
                {loadingIncidents && <span style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>Buscando…</span>}
                {!loadingIncidents && foundIncidents.length > 0 && (
                  <button type="button"
                    onClick={() => setShowIncidentList(v => !v)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--primary)', fontSize:'0.72rem', fontWeight:700, display:'flex', alignItems:'center', gap:'3px', padding:0 }}>
                    Ver {foundIncidents.length} en pedidos {showIncidentList ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                  </button>
                )}
              </label>
              <input type="number" className="input-field" value={form.incidents_count} min={0}
                onChange={e => setForm(f=>({...f,incidents_count:parseInt(e.target.value)||0}))} />
              {!loadingIncidents && foundIncidents.length === 0 && (
                <div style={{ fontSize:'0.72rem', color:'#16a34a', marginTop:'4px' }}>Sin incidencias registradas en pedidos del período</div>
              )}
            </div>
          </div>

          {/* Lista de incidencias de pedidos */}
          {showIncidentList && foundIncidents.length > 0 && (
            <div style={{ border:'1px solid #fde68a', borderRadius:'8px', background:'#fffbeb', padding:'10px 12px', marginBottom:'12px' }}>
              <div style={{ fontWeight:700, fontSize:'0.75rem', color:'#92400e', marginBottom:'8px', display:'flex', alignItems:'center', gap:'6px' }}>
                <AlertTriangle size={13} /> Incidencias en pedidos del período
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {foundIncidents.map(o => (
                  <div key={o.id} style={{ fontSize:'0.78rem', borderBottom:'1px solid #fde68a', paddingBottom:'5px' }}>
                    <span style={{ fontWeight:700, color:'var(--secondary)' }}>{o.date}</span>
                    <span style={{ color:'#92400e', marginLeft:'8px' }}>{o.incidents}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Puntuaciones */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'14px' }}>
            <ScoreInput label="Puntualidad *" name="punctuality" value={form.punctuality} onChange={setScore} />
            <ScoreInput label="Calidad-Precio *" name="quality_price" value={form.quality_price} onChange={setScore} />
            <ScoreInput label="Atención cliente *" name="service" value={form.service} onChange={setScore} />
          </div>

          {/* Checks críticos / lab */}
          {(isCritical || isLab) && (
            <div style={{ background:'#fef9ee', border:'1px solid #fde68a', borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
              <div style={{ fontWeight:700, fontSize:'0.78rem', color:'#92400e', marginBottom:'10px' }}>Criterios adicionales {isLab ? '(Lab ISO 17025)' : '(Proveedor Crítico)'}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                {[
                  { key:'accreditations_ok', label:'Acreditaciones vigentes disponibles' },
                  { key:'quality_controls_ok', label:'Controles de calidad adecuados' },
                  ...(isLab ? [
                    { key:'scope_covers_tests', label:'Alcance cubre los ensayos encargados' },
                    { key:'proficiency_ok', label:'Participa en ensayos de aptitud / intercomp.' },
                  ] : []),
                ].map(({ key, label }) => (
                  <div key={key} style={{ fontSize:'0.82rem' }}>
                    <div style={{ color:'var(--text-muted)', marginBottom:'4px' }}>{label}</div>
                    <div style={{ display:'flex', gap:'6px' }}>
                      {[{ v: true, l:'Sí' }, { v: false, l:'No' }].map(({ v, l }) => (
                        <button key={l} type="button" onClick={() => setCheck(key, v)}
                          style={{ padding:'4px 14px', borderRadius:'6px', border:'1px solid var(--border)', cursor:'pointer', fontWeight:600, fontSize:'0.8rem',
                            background: form[key] === v ? (v ? '#dcfce7' : '#fee2e2') : 'white',
                            color: form[key] === v ? (v ? '#16a34a' : '#dc2626') : 'var(--text-muted)' }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="input-group" style={{ marginBottom:'12px' }}>
            <label className="input-label">Observaciones</label>
            <textarea className="input-field" rows={2} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))}
              placeholder="Incidencias relevantes, acciones de mejora, etc." style={{ resize:'vertical', fontFamily:'inherit' }} />
          </div>

          {/* Preview resultado */}
          {computed && (
            <div style={{ display:'flex', alignItems:'center', gap:'12px', background:'#f8fafc', borderRadius:'8px', padding:'10px 14px', marginBottom:'12px' }}>
              <div style={{ fontSize:'1.4rem', fontWeight:800, color: RESULT_COLOR[computed.result] }}>{computed.score.toFixed(2)}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color: RESULT_COLOR[computed.result], fontSize:'0.9rem' }}>{computed.result}</div>
                <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Puntuación calculada · -0.2 por incidencia</div>
              </div>
            </div>
          )}

          <button className="btn btn-primary" style={{ width:'100%' }} disabled={saving || !computed} onClick={handleSave}>
            <Save size={15} style={{ marginRight:'6px' }} /> {saving ? 'Guardando…' : 'Registrar evaluación'}
          </button>
        </div>

        {/* Historial */}
        {history.length > 0 && (
          <div>
            <div style={{ fontWeight:700, fontSize:'0.85rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'10px' }}>Historial de evaluaciones</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {history.map(ev => (
                <div key={ev.id} style={{ background:'var(--background)', borderRadius:'8px', padding:'10px 14px', display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ fontWeight:800, fontSize:'1.1rem', color: RESULT_COLOR[ev.result], minWidth:'36px' }}>{ev.overall_score}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, color: RESULT_COLOR[ev.result], fontSize:'0.82rem' }}>{ev.result}</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                      {ev.period} · {ev.evaluation_date} {ev.evaluator ? `· ${ev.evaluator}` : ''}
                    </div>
                    {ev.notes && <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontStyle:'italic', marginTop:'2px' }}>{ev.notes}</div>}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'4px', fontSize:'0.72rem', textAlign:'center' }}>
                    {[['Puntualidad',ev.punctuality],['Cal-Precio',ev.quality_price],['Atención',ev.service]].map(([l,v]) => (
                      <div key={l} style={{ background:'white', borderRadius:'4px', padding:'2px 6px' }}>
                        <div style={{ color:'var(--text-muted)' }}>{l}</div>
                        <div style={{ fontWeight:700, color: v>=4?'#16a34a':v>=3?'#d97706':'#dc2626' }}>{v}/5</div>
                      </div>
                    ))}
                  </div>
                  <button
                    title="Eliminar evaluación"
                    onClick={() => deleteEvaluation(ev.id)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', padding:'4px', flexShrink:0 }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
