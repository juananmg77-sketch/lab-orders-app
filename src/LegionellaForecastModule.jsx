import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Upload, Download, FileText, AlertCircle, CheckCircle,
  Info, Save, X, LayoutGrid, List, Plus, Edit2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { HISTORICO_LEGIONELLA } from './legionellaHistorico';
import { supabase } from './supabaseClient';

// ─── Constants ────────────────────────────────────────────────────────────────

const MES_A_TRIMESTRE = {
  'enero': 'Q1', 'febrero': 'Q1', 'marzo': 'Q1',
  'abril': 'Q2', 'mayo': 'Q2', 'junio': 'Q2',
  'julio': 'Q3', 'agosto': 'Q3', 'septiembre': 'Q3',
  'octubre': 'Q4', 'noviembre': 'Q4', 'diciembre': 'Q4',
};

const MES_ORDEN = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

const REGION_A_NODO = {
  'Islas Baleares': 'Islas Baleares', 'Islas Canarias': 'Islas Canarias',
  'Cataluña': 'Zona Cataluña', 'Tarragona': 'Zona Cataluña', 'Lérida': 'Zona Cataluña', 'Girona': 'Zona Cataluña',
  'Valencia': 'Zona Levante', 'Alicante': 'Zona Levante', 'Murcia': 'Zona Levante',
  'Andalucía': 'Zona Andalucía',
  'Madrid': 'Zona Madrid (Centro/Norte)', 'Navarra': 'Zona Madrid (Centro/Norte)',
  'País Vasco': 'Zona Madrid (Centro/Norte)', 'Aragón': 'Zona Madrid (Centro/Norte)',
  'La Rioja': 'Zona Madrid (Centro/Norte)', 'Castilla y León': 'Zona Madrid (Centro/Norte)',
  'Castilla-La Mancha': 'Zona Madrid (Centro/Norte)', 'Extremadura': 'Zona Madrid (Centro/Norte)',
  'Asturias': 'Zona Madrid (Centro/Norte)', 'Cantabria': 'Zona Madrid (Centro/Norte)',
  'Galicia': 'Zona Madrid (Centro/Norte)',
};

const NODOS_ORDEN = ['Islas Baleares','Islas Canarias','Zona Cataluña','Zona Levante','Zona Andalucía','Zona Madrid (Centro/Norte)'];

const NODO_COLORS = {
  'Islas Baleares':             { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8' },
  'Islas Canarias':             { bg: '#FFF7ED', border: '#F97316', text: '#C2410C' },
  'Zona Cataluña':              { bg: '#F0FDF4', border: '#22C55E', text: '#15803D' },
  'Zona Levante':               { bg: '#FEFCE8', border: '#EAB308', text: '#A16207' },
  'Zona Andalucía':             { bg: '#FDF4FF', border: '#A855F7', text: '#7E22CE' },
  'Zona Madrid (Centro/Norte)': { bg: '#FFF1F2', border: '#F43F5E', text: '#BE123C' },
};

const TABLA_MUESTRAS = [
  { max: 10, acs: 1, afch: 1 }, { max: 20, acs: 3, afch: 1 },
  { max: 50, acs: 4, afch: 1 }, { max: 100, acs: 4, afch: 2 },
  { max: 200, acs: 6, afch: 2 }, { max: 350, acs: 8, afch: 3 },
];

const DIAS_SEMANA_CORTO = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcMuestrasPorPuntos(puntos) {
  for (const t of TABLA_MUESTRAS) if (puntos <= t.max) return { acs: t.acs, afch: t.afch };
  const e = puntos - 350;
  return { acs: 8 + Math.ceil(e / 50), afch: 3 + Math.ceil(e / 100) };
}
function calcPorNormativa(hab, zc = 0) {
  const h = parseInt(hab) || 0, z = parseInt(zc) || 0;
  if (!h) return null;
  const pts = h + z;
  const { acs, afch } = calcMuestrasPorPuntos(pts);
  return { puntos: pts, acs, afch, total: acs + afch };
}
function normalizeName(n) {
  return String(n).trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').replace(/["""'']/g,'');
}

const HISTORICO_INDEX = {};
for (const [k, v] of Object.entries(HISTORICO_LEGIONELLA))
  HISTORICO_INDEX[normalizeName(k)] = { originalKey: k, ...v };

function buscarHistorico(nombre) {
  const n = normalizeName(nombre);
  if (HISTORICO_INDEX[n]) return HISTORICO_INDEX[n];
  for (const [k, v] of Object.entries(HISTORICO_INDEX))
    if (n.includes(k) || k.includes(n)) return v;
  return null;
}
function calcPromedio(h) {
  const v = [h.Q1, h.Q2, h.Q3, h.Q4].filter(x => x > 0);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
}
function estimarMuestras(nombre, mes) {
  const h = buscarHistorico(nombre);
  if (!h) return { muestras: null, estado: 'SIN HISTÓRICO' };
  const q = MES_A_TRIMESTRE[mes.toLowerCase()] || 'Q1';
  if (h[q] > 0) return { muestras: h[q], estado: 'OK', trimestre: q };
  const p = calcPromedio(h);
  return p > 0 ? { muestras: p, estado: 'OK (PROMEDIO)', trimestre: q } : { muestras: null, estado: 'SIN HISTÓRICO' };
}

function parseFecha(s) {
  if (!s) return null;
  const [d, m, y] = s.split('/').map(Number);
  if (!d || !m || !y || y < 2000) return null;
  return new Date(y, m - 1, d);
}
function semanaDelMes(d) { return Math.ceil(d.getDate() / 7); }

function parsearCSV(texto) {
  const lineas = texto.split('\n').filter(l => l.trim());
  if (lineas.length < 2) return [];
  const sep = lineas[0].includes(';') ? ';' : ',';
  const parseRow = line => {
    const r = []; let inQ = false, cur = '';
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === sep && !inQ) { r.push(cur.trim()); cur = ''; } else cur += ch;
    }
    r.push(cur.trim()); return r;
  };
  const headers = parseRow(lineas[0]).map(h => h.toLowerCase().trim());
  return lineas.slice(1).reduce((acc, linea) => {
    const cols = parseRow(linea);
    if (cols.length < 7) return acc;
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i] || ''; });
    acc.push(row); return acc;
  }, []);
}

// Convert CSV row → Supabase row shape
function csvRowToRecord(row, savedDB) {
  const establecimiento = row['establecimiento'] || '';
  const mes = (row['mes'] || '').toLowerCase();
  const año = parseInt(row['año'] || row['ano'] || 0);
  const region = (row['región'] || row['region'] || '').trim();
  const disciplina = row['disciplina'] || '';
  const fechaStr = row['fecha'] || '';
  const fechaDate = parseFecha(fechaStr);
  const { muestras, estado } = estimarMuestras(establecimiento, mes);

  // Apply normative calc if saved
  let muestrasEst = muestras;
  let estadoEst = estado;
  if (!muestrasEst) {
    const saved = savedDB[establecimiento];
    if (saved?.habitaciones) {
      const c = calcPorNormativa(saved.habitaciones, saved.zonas_comunes || 0);
      if (c) { muestrasEst = c.total; estadoEst = 'RD 487/2022 (guardado)'; }
    }
  }

  return {
    mes,
    año,
    establecimiento,
    grupo: row['grupo'] || '',
    region,
    nodo: REGION_A_NODO[region] || 'Sin clasificar',
    disciplina,
    jornada: parseFloat(row['jornada'] || 0),
    auditor: row['auditor'] || '',
    fecha: fechaStr,
    fecha_date: fechaDate ? fechaDate.toISOString().split('T')[0] : null,
    semana: fechaDate ? semanaDelMes(fechaDate) : null,
    auditoria_ref: row['auditoría'] || row['auditoria'] || null,
    muestras_estimadas: muestrasEst,
    estado_estimacion: estadoEst,
  };
}

// Enrich a DB row with derived/computed fields
function enrichRow(row) {
  const fechaDate = row.fecha_date ? new Date(row.fecha_date + 'T00:00:00') : null;
  return { ...row, fechaDate, semana: fechaDate ? semanaDelMes(fechaDate) : null };
}

function applyFilters(actividades, filters) {
  return actividades.filter(act => {
    if (filters.zones.size > 0 && !filters.zones.has(act.nodo)) return false;
    return true;
  });
}

function agruparPorNodo(actividades) {
  const r = {};
  for (const n of NODOS_ORDEN) r[n] = { count: 0, muestras: 0 };
  r['Sin clasificar'] = { count: 0, muestras: 0 };
  for (const a of actividades) {
    if (!r[a.nodo]) r[a.nodo] = { count: 0, muestras: 0 };
    r[a.nodo].count++;
    r[a.nodo].muestras += a.muestras_estimadas || 0;
  }
  return r;
}

function exportarExcel(actividades, mesLabel) {
  const wb = XLSX.utils.book_new();
  const toSheet = (acts, titulo) => {
    const res = agruparPorNodo(acts);
    const wsData = [
      [titulo], [],
      ['RESUMEN POR NODO LOGÍSTICO'],
      ['Nodo Logístico','Establecimientos','Envases Previstos','Muestras Reales'],
      ...NODOS_ORDEN.map(n => [n, res[n]?.count||0, res[n]?.muestras||0, acts.filter(a=>a.nodo===n).reduce((s,a)=>s+(a.muestras_reales||0),0)]),
      [],
      ['TOTAL GENERAL', acts.length, acts.reduce((s,a)=>s+(a.muestras_estimadas||0),0), acts.reduce((s,a)=>s+(a.muestras_reales||0),0)],
      [],[],
      ['DETALLE'],
      ['Establecimiento','Grupo','Región','Nodo','Disciplina','Auditor','Fecha','Muestras Est.','Muestras Reales','Fuente'],
      ...acts.map(a => [
        a.establecimiento, a.grupo, a.region, a.nodo, a.disciplina,
        a.auditor, a.fecha, a.muestras_estimadas??'PENDIENTE',
        a.muestras_reales??'', a.estado_estimacion,
      ]),
    ];
    return XLSX.utils.aoa_to_sheet(wsData);
  };
  const d3 = actividades.filter(a => !a.disciplina.toLowerCase().includes('d3bis') && !a.disciplina.toLowerCase().includes('remuestreo'));
  const d3bis = actividades.filter(a => a.disciplina.toLowerCase().includes('d3bis') || a.disciplina.toLowerCase().includes('remuestreo'));
  if (d3.length) XLSX.utils.book_append_sheet(wb, toSheet(d3, `D3 Muestreo - ${mesLabel}`), 'D3 - Muestreo');
  if (d3bis.length) XLSX.utils.book_append_sheet(wb, toSheet(d3bis, `D3bis Remuestreo - ${mesLabel}`), 'D3bis - Remuestreo');
  XLSX.writeFile(wb, `Prevision_Legionella_${mesLabel.replace(/\s/g,'_')}.xlsx`);
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS = { zones: new Set() };

// ─── ResumenNodos ─────────────────────────────────────────────────────────────

function ResumenNodos({ actividades, allActs, filters, onFiltersChange }) {
  const res = agruparPorNodo(allActs);
  const totalEst = actividades.reduce((s,a)=>s+(a.muestras_estimadas||0),0);
  const totalReal = actividades.reduce((s,a)=>s+(a.muestras_reales||0),0);
  const pendientes = allActs.filter(a=>!a.estado_estimacion||a.estado_estimacion==='SIN HISTÓRICO').length;
  const isFiltered = filters.zones.size > 0;

  const toggleNodo = (nodo) => {
    const s = new Set(filters.zones);
    if (s.has(nodo) && s.size === 1) { s.clear(); }
    else { s.clear(); s.add(nodo); }
    onFiltersChange({ ...filters, zones: s });
  };

  return (
    <div style={{ marginBottom:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
        <h3 style={{ fontSize:'1rem', fontWeight:700, color:'var(--secondary)', margin:0 }}>Resumen por Nodo Logístico</h3>
        {pendientes>0 && <span style={{ fontSize:'0.78rem', backgroundColor:'#FFFBEB', color:'#D97706', border:'1px solid #FCD34D', borderRadius:'20px', padding:'2px 10px', fontWeight:600 }}>{pendientes} pendiente{pendientes>1?'s':''}</span>}
        {isFiltered && <button onClick={()=>onFiltersChange(DEFAULT_FILTERS)} style={{ fontSize:'0.75rem', color:'#DC2626', background:'none', border:'1px solid #FCA5A5', borderRadius:'20px', padding:'2px 10px', cursor:'pointer', fontWeight:600 }}>✕ Quitar filtro</button>}
        {isFiltered && <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Mostrando {actividades.length} de {allActs.length}</span>}
      </div>
      <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'10px' }}>
        {NODOS_ORDEN.map(nodo => {
          const d=res[nodo], c=NODO_COLORS[nodo];
          const isActive = filters.zones.has(nodo);
          const isInactive = isFiltered && !isActive;
          const real = allActs.filter(a=>a.nodo===nodo).reduce((s,a)=>s+(a.muestras_reales||0),0);
          return (
            <div key={nodo} onClick={()=>toggleNodo(nodo)} style={{ backgroundColor:c.bg, border:`2px solid ${isActive?c.border:'transparent'}`, outline:`1px solid ${isActive?'transparent':c.border}`, borderRadius:'10px', padding:'12px 16px', minWidth:'155px', flex:'1 1 155px', cursor:'pointer', opacity:isInactive?0.4:1, transition:'all 0.15s', userSelect:'none' }}>
              <div style={{ fontSize:'0.7rem', fontWeight:700, color:c.text, marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.04em' }}>{nodo}</div>
              <div style={{ fontSize:'1.4rem', fontWeight:800, color:c.text }}>{d?.muestras||0}</div>
              {real>0 && <div style={{ fontSize:'0.72rem', color:c.text, opacity:0.8 }}>✓ {real} recogidas</div>}
              <div style={{ fontSize:'0.73rem', color:c.text, opacity:0.65 }}>{d?.count||0} establec.</div>
              {isActive && <div style={{ fontSize:'0.65rem', color:c.text, fontWeight:700, marginTop:'4px' }}>FILTRADO ▼</div>}
            </div>
          );
        })}
      </div>
      <div style={{ backgroundColor:'var(--secondary)', color:'white', borderRadius:'10px', padding:'12px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
        <span style={{ fontWeight:700 }}>TOTAL {isFiltered?'(filtrado)':'GENERAL'}</span>
        <div style={{ display:'flex', gap:'20px', alignItems:'center' }}>
          <span style={{ fontSize:'0.85rem', opacity:0.7 }}>Estimadas: <strong>{totalEst}</strong></span>
          {totalReal>0 && <span style={{ fontSize:'0.85rem', color:'#86EFAC' }}>Recogidas: <strong>{totalReal}</strong></span>}
        </div>
        <span style={{ opacity:0.7, fontSize:'0.85rem' }}>{allActs.length} establecimientos</span>
      </div>
    </div>
  );
}

// ─── TablaActividades ─────────────────────────────────────────────────────────

function TablaActividades({ actividades, savedDB, manualInputs, onInputChange, savingStates, onUpdateReal }) {
  const [sortField, setSortField] = useState('fecha_date');
  const [sortAsc, setSortAsc] = useState(true);
  const [editingReal, setEditingReal] = useState({});

  const sorted = [...actividades].sort((a,b)=>{
    const va=a[sortField]??'', vb=b[sortField]??'';
    if (va instanceof Date&&vb instanceof Date) return sortAsc?va-vb:vb-va;
    return sortAsc?String(va).localeCompare(String(vb)):String(vb).localeCompare(String(va));
  });

  const handleSort = f => { if(sortField===f) setSortAsc(s=>!s); else{setSortField(f);setSortAsc(true);} };
  const SortIcon = ({field}) => <span style={{marginLeft:'4px',opacity:sortField===field?1:0.3}}>{sortField===field?(sortAsc?'↑':'↓'):'↕'}</span>;
  const th = {padding:'10px 12px',textAlign:'left',fontSize:'0.74rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'white',backgroundColor:'var(--secondary)',cursor:'pointer',whiteSpace:'nowrap',userSelect:'none'};

  return (
    <div style={{ overflowX:'auto', borderRadius:'10px', border:'1px solid var(--border)' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.85rem' }}>
        <thead>
          <tr>
            {[['fecha_date','Fecha'],['semana','S.'],['nodo','Nodo'],['establecimiento','Establecimiento'],['auditor','Auditor'],['muestras_estimadas','Est.'],['muestras_reales','Real'],['estado_estimacion','Fuente']].map(([f,l])=>(
              <th key={f} style={th} onClick={()=>handleSort(f)}>{l}<SortIcon field={f}/></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((act, idx) => {
            const c = NODO_COLORS[act.nodo]||{bg:'#f8f9fa',border:'#dee2e6',text:'#495057'};
            const sinHist = act.estado_estimacion==='SIN HISTÓRICO';
            const porNorm = act.estado_estimacion?.startsWith('RD 487/2022');
            const inp = manualInputs[act.establecimiento]||{};
            const preview = sinHist&&inp.habitaciones ? calcPorNormativa(inp.habitaciones,inp.zonasComunes||0) : null;
            const saving = savingStates[act.establecimiento];
            const isEditingReal = editingReal[act.id] !== undefined;
            const hasReal = act.muestras_reales != null;

            return (
              <React.Fragment key={act.id||idx}>
                <tr style={{ backgroundColor:sinHist?'#FFFBEB':(idx%2===0?'#fff':'#f9fafb'), borderBottom:sinHist?'none':'1px solid var(--border)' }}>
                  <td style={{ padding:'8px 12px', whiteSpace:'nowrap', color:'var(--text-muted)', fontSize:'0.8rem' }}>{act.fecha||<span style={{color:'#ccc'}}>—</span>}</td>
                  <td style={{ padding:'8px 12px', textAlign:'center' }}>
                    {act.semana?<span style={{ backgroundColor:'#F1F5F9',color:'#475569',borderRadius:'4px',padding:'2px 6px',fontSize:'0.73rem',fontWeight:700 }}>S{act.semana}</span>:<span style={{color:'#ccc'}}>—</span>}
                  </td>
                  <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>
                    <span style={{ backgroundColor:c.bg,color:c.text,border:`1px solid ${c.border}`,borderRadius:'6px',padding:'2px 6px',fontSize:'0.7rem',fontWeight:600 }}>{act.nodo?.replace('Zona ','').replace('Islas ','')}</span>
                  </td>
                  <td style={{ padding:'8px 12px', fontWeight:600, color:'var(--secondary)', maxWidth:'220px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{act.establecimiento}</td>
                  <td style={{ padding:'8px 12px', whiteSpace:'nowrap', fontSize:'0.82rem' }}>{act.auditor}</td>
                  <td style={{ padding:'8px 12px', textAlign:'center', fontWeight:700, color:sinHist?'#D97706':'var(--secondary)' }}>
                    {sinHist?(preview?preview.total:'—'):act.muestras_estimadas}
                  </td>
                  {/* Muestras reales — inline edit */}
                  <td style={{ padding:'8px 12px', textAlign:'center' }}>
                    {isEditingReal ? (
                      <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                        <input
                          type="number" min="0"
                          defaultValue={act.muestras_reales||''}
                          autoFocus
                          onBlur={e => { setEditingReal(prev=>{const n={...prev};delete n[act.id];return n;}); onUpdateReal(act.id, parseInt(e.target.value)||null); }}
                          onKeyDown={e => { if(e.key==='Enter') e.target.blur(); if(e.key==='Escape'){setEditingReal(prev=>{const n={...prev};delete n[act.id];return n;});} }}
                          style={{ width:'58px',padding:'3px 6px',border:'1.5px solid var(--primary)',borderRadius:'5px',fontSize:'0.82rem',textAlign:'center' }}
                        />
                      </div>
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'4px' }} onClick={()=>setEditingReal(p=>({...p,[act.id]:true}))}>
                        {hasReal ? <span style={{ fontWeight:700, color:'#16A34A', cursor:'pointer' }}>{act.muestras_reales}</span> : <span style={{ color:'#CBD5E1', fontSize:'0.78rem', cursor:'pointer' }}>—</span>}
                        <Edit2 size={11} style={{ color:'#CBD5E1', cursor:'pointer', flexShrink:0 }}/>
                      </div>
                    )}
                  </td>
                  <td style={{ padding:'8px 12px' }}>
                    {sinHist?(
                      <span style={{ display:'flex',alignItems:'center',gap:'4px',color:'#D97706',fontSize:'0.73rem',fontWeight:600 }}><AlertCircle size={11}/> SIN HISTÓRICO</span>
                    ):porNorm?(
                      <span style={{ display:'flex',alignItems:'center',gap:'4px',color:act._guardado?'#16A34A':'#0891B2',fontSize:'0.73rem',fontWeight:600 }}>{act._guardado?<Save size={11}/>:<Info size={11}/>} {act._guardado?'Guardado':'RD 487/2022'}</span>
                    ):(
                      <span style={{ display:'flex',alignItems:'center',gap:'4px',color:'#16A34A',fontSize:'0.73rem',fontWeight:600 }}><CheckCircle size={11}/> {act.estado_estimacion}</span>
                    )}
                  </td>
                </tr>
                {sinHist&&(
                  <tr style={{ backgroundColor:'#FFFBEB', borderBottom:'1px solid var(--border)' }}>
                    <td colSpan={8} style={{ padding:'6px 12px 10px 40px' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:'14px',flexWrap:'wrap' }}>
                        <span style={{ fontSize:'0.78rem',color:'#92400E',fontWeight:600 }}>Cálculo RD 487/2022:</span>
                        <label style={{ display:'flex',alignItems:'center',gap:'6px',fontSize:'0.8rem',color:'#92400E' }}>
                          Habitaciones
                          <input type="number" min="0" value={inp.habitaciones||''} onChange={e=>onInputChange(act.establecimiento,'habitaciones',e.target.value)} placeholder="Nº hab." style={{ width:'80px',padding:'4px 8px',border:'1.5px solid #FCD34D',borderRadius:'6px',fontSize:'0.82rem',backgroundColor:'white',outline:'none' }}/>
                        </label>
                        <label style={{ display:'flex',alignItems:'center',gap:'6px',fontSize:'0.8rem',color:'#92400E' }}>
                          Zonas comunes
                          <input type="number" min="0" value={inp.zonasComunes||''} onChange={e=>onInputChange(act.establecimiento,'zonasComunes',e.target.value)} placeholder="Extra" style={{ width:'90px',padding:'4px 8px',border:'1.5px solid #FCD34D',borderRadius:'6px',fontSize:'0.82rem',backgroundColor:'white',outline:'none' }}/>
                        </label>
                        {preview&&<span style={{ fontSize:'0.8rem',color:'#0369A1',backgroundColor:'#E0F2FE',border:'1px solid #7DD3FC',borderRadius:'6px',padding:'3px 10px',fontWeight:600 }}>{preview.puntos} pts → {preview.acs} ACS + {preview.afch} AFCH = <strong>{preview.total}</strong></span>}
                        {saving==='saving'&&<span style={{ fontSize:'0.73rem',color:'#0891B2' }}>Guardando…</span>}
                        {saving==='saved'&&<span style={{ fontSize:'0.73rem',color:'#16A34A',display:'flex',alignItems:'center',gap:'3px' }}><Save size={10}/>Guardado</span>}
                        {saving==='error'&&<span style={{ fontSize:'0.73rem',color:'#DC2626' }}>Error</span>}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {actividades.length===0&&<div style={{ textAlign:'center',padding:'40px',color:'var(--text-muted)' }}>No hay actividades para los filtros seleccionados.</div>}
    </div>
  );
}

// ─── Calendar components ──────────────────────────────────────────────────────

function groupByDay(acts, mes, año) {
  const m = {};
  acts.forEach(a => {
    if (!a.fechaDate) return;
    if (a.fechaDate.getMonth() + 1 !== mes || a.fechaDate.getFullYear() !== año) return;
    const d = a.fechaDate.getDate();
    m[d] = m[d] || [];
    m[d].push(a);
  });
  return m;
}

function MonthlyCalendar({ actividades, año, mes }) {
  const byDay = groupByDay(actividades, mes, año);
  const firstDay = new Date(año, mes-1, 1);
  const lastDay = new Date(año, mes, 0).getDate();
  const startOffset = (firstDay.getDay()+6)%7;
  const cells = [...Array(startOffset).fill(null), ...Array.from({length:lastDay},(_,i)=>i+1)];
  while(cells.length%7!==0) cells.push(null);
  const weeks = Array.from({length:cells.length/7},(_,i)=>cells.slice(i*7,i*7+7));
  const sinFecha = actividades.filter(a=>!a.fechaDate);

  return (
    <div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px',marginBottom:'4px' }}>
        {DIAS_SEMANA_CORTO.map(d=><div key={d} style={{ textAlign:'center',fontSize:'0.73rem',fontWeight:700,color:'var(--text-muted)',padding:'6px 0' }}>{d}</div>)}
      </div>
      {weeks.map((week,wi)=>(
        <div key={wi} style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px',marginBottom:'4px' }}>
          {week.map((day,di)=>{
            const acts=day?(byDay[day]||[]):[];
            const totalEst=acts.reduce((s,a)=>s+(a.muestras_estimadas||0),0);
            const totalReal=acts.reduce((s,a)=>s+(a.muestras_reales||0),0);
            const byNodo={};
            acts.forEach(a=>{byNodo[a.nodo]=byNodo[a.nodo]||{count:0};byNodo[a.nodo].count++;});
            return (
              <div key={di} style={{ minHeight:'88px',backgroundColor:!day?'transparent':acts.length>0?'white':'#FCFCFC',border:day?`1px solid ${acts.length>0?'var(--border)':'#EBEBEB'}`:'none',borderRadius:'8px',padding:day?'7px':0 }}>
                {day&&<>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'3px' }}>
                    <span style={{ fontSize:'0.82rem',fontWeight:acts.length>0?700:400,color:acts.length>0?'var(--secondary)':'#CCC' }}>{day}</span>
                    {totalEst>0&&<span style={{ fontSize:'0.65rem',fontWeight:700,color:'var(--text-muted)',backgroundColor:'#F1F5F9',borderRadius:'4px',padding:'1px 4px' }}>{totalEst}m</span>}
                  </div>
                  {totalReal>0&&<div style={{ fontSize:'0.65rem',color:'#16A34A',fontWeight:700,marginBottom:'2px' }}>✓ {totalReal} recogidas</div>}
                  {Object.entries(byNodo).map(([nodo,{count}])=>{
                    const c=NODO_COLORS[nodo]||{bg:'#f8f9fa',border:'#dee2e6',text:'#495057'};
                    return <div key={nodo} title={`${nodo}: ${count}`} style={{ fontSize:'0.63rem',fontWeight:600,color:c.text,backgroundColor:c.bg,border:`1px solid ${c.border}`,borderRadius:'3px',padding:'1px 4px',marginBottom:'2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{count} · {nodo.replace('Zona ','').replace('Islas ','')}</div>;
                  })}
                </>}
              </div>
            );
          })}
        </div>
      ))}
      {sinFecha.length>0&&<div style={{ marginTop:'12px',padding:'10px 14px',backgroundColor:'#F8FAFC',border:'1px solid var(--border)',borderRadius:'8px',fontSize:'0.78rem',color:'var(--text-muted)' }}><strong>Sin fecha ({sinFecha.length}):</strong> {sinFecha.map(a=>a.establecimiento).join(', ')}</div>}
    </div>
  );
}

function WeeklyCalendar({ actividades, semana, año, mes }) {
  const startDay=(semana-1)*7+1, lastOfMonth=new Date(año,mes,0).getDate(), endDay=Math.min(semana*7,lastOfMonth);
  const days=Array.from({length:endDay-startDay+1},(_,i)=>{
    const d=startDay+i, date=new Date(año,mes-1,d);
    const dayName=DIAS_SEMANA_CORTO[(date.getDay()+6)%7];
    const acts=actividades.filter(a=>a.fechaDate&&a.fechaDate.getDate()===d&&a.fechaDate.getMonth()+1===mes&&a.fechaDate.getFullYear()===año);
    return {d,dayName,acts};
  });
  const sinFecha=actividades.filter(a=>!a.fechaDate);

  return (
    <div>
      <div style={{ display:'grid',gridTemplateColumns:`repeat(${days.length},1fr)`,gap:'8px' }}>
        {days.map(({d,dayName,acts})=>{
          const totalEst=acts.reduce((s,a)=>s+(a.muestras_estimadas||0),0);
          const totalReal=acts.reduce((s,a)=>s+(a.muestras_reales||0),0);
          return (
            <div key={d} style={{ backgroundColor:'white',border:`1px solid ${acts.length>0?'var(--border)':'#EBEBEB'}`,borderRadius:'10px',overflow:'hidden',opacity:acts.length>0?1:0.55 }}>
              <div style={{ padding:'10px 12px',backgroundColor:acts.length>0?'var(--secondary)':'#F1F5F9',borderBottom:`1px solid ${acts.length>0?'rgba(255,255,255,0.1)':'var(--border)'}` }}>
                <div style={{ fontSize:'0.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:acts.length>0?'rgba(255,255,255,0.6)':'var(--text-muted)' }}>{dayName}</div>
                <div style={{ fontSize:'1.25rem',fontWeight:800,color:acts.length>0?'white':'#CBD5E1',lineHeight:1.1 }}>{d}</div>
                {totalEst>0&&<div style={{ fontSize:'0.66rem',color:'rgba(255,255,255,0.65)',marginTop:'3px' }}>{acts.length} visita{acts.length>1?'s':''} · {totalEst} muestras</div>}
                {totalReal>0&&<div style={{ fontSize:'0.66rem',color:'#86EFAC' }}>✓ {totalReal} recogidas</div>}
              </div>
              <div style={{ padding:'8px',maxHeight:'450px',overflowY:'auto' }}>
                {acts.length===0?<div style={{ textAlign:'center',padding:'20px 0',color:'#D1D5DB',fontSize:'0.78rem' }}>Sin visitas</div>:
                  acts.map((act,i)=>{
                    const c=NODO_COLORS[act.nodo]||{bg:'#f8f9fa',border:'#dee2e6',text:'#495057'};
                    return (
                      <div key={i} style={{ marginBottom:'6px',padding:'8px',backgroundColor:c.bg,border:`1px solid ${c.border}`,borderRadius:'7px' }}>
                        <div style={{ fontSize:'0.76rem',fontWeight:700,color:'var(--secondary)',lineHeight:1.2,marginBottom:'2px' }}>{act.establecimiento}</div>
                        <div style={{ fontSize:'0.68rem',color:'var(--text-muted)',marginBottom:'4px' }}>{act.auditor}</div>
                        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                          <span style={{ fontSize:'0.64rem',color:c.text,fontWeight:600,border:`1px solid ${c.border}`,backgroundColor:'white',borderRadius:'4px',padding:'1px 5px' }}>{act.nodo?.replace('Zona ','').replace('Islas ','')}</span>
                          <span style={{ fontSize:'0.78rem',fontWeight:800,color:act.estado_estimacion==='SIN HISTÓRICO'?'#D97706':c.text }}>{act.muestras_estimadas??'—'}</span>
                        </div>
                        {act.muestras_reales!=null&&<div style={{ fontSize:'0.68rem',color:'#16A34A',fontWeight:700,marginTop:'3px' }}>✓ {act.muestras_reales} recogidas</div>}
                      </div>
                    );
                  })
                }
              </div>
            </div>
          );
        })}
      </div>
      {sinFecha.length>0&&<div style={{ marginTop:'12px',padding:'10px 14px',backgroundColor:'#F8FAFC',border:'1px solid var(--border)',borderRadius:'8px',fontSize:'0.78rem',color:'var(--text-muted)' }}><strong>Sin fecha ({sinFecha.length}):</strong> {sinFecha.map(a=>a.establecimiento).join(', ')}</div>}
    </div>
  );
}

// ─── Import modal ─────────────────────────────────────────────────────────────

function ImportModal({ onClose, onImported, savedDB }) {
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const processFile = async (file) => {
    if (!file?.name.endsWith('.csv')) { setError('Selecciona un archivo CSV.'); return; }
    setImporting(true); setError(null); setResult(null);
    const text = await file.text();
    const rows = parsearCSV(text);
    if (!rows.length) { setImporting(false); setError('CSV vacío o formato incorrecto.'); return; }

    const records = rows.map(r => csvRowToRecord(r, savedDB));
    const { data, error: err } = await supabase
      .from('legionella_actividades')
      .upsert(records, { onConflict: 'establecimiento,mes,año,disciplina', ignoreDuplicates: false })
      .select('id');

    setImporting(false);
    if (err) { setError(err.message); return; }
    setResult({ total: records.length, upserted: data?.length || records.length });
  };

  return (
    <div style={{ position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center' }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ backgroundColor:'white',borderRadius:'16px',padding:'32px',width:'500px',maxWidth:'90vw',boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px' }}>
          <h2 style={{ margin:0,fontSize:'1.1rem',fontWeight:700,color:'var(--secondary)' }}>Importar actividades CSV</h2>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)' }}><X size={20}/></button>
        </div>
        {result ? (
          <div>
            <div style={{ textAlign:'center',padding:'24px',backgroundColor:'#F0FDF4',borderRadius:'10px',marginBottom:'20px' }}>
              <CheckCircle size={40} color="#16A34A" style={{ marginBottom:'10px' }}/>
              <div style={{ fontSize:'1rem',fontWeight:700,color:'#15803D' }}>Importación completada</div>
              <div style={{ fontSize:'0.88rem',color:'#166534',marginTop:'6px' }}>
                {result.total} filas procesadas — solo se añadieron o actualizaron las nuevas.
              </div>
            </div>
            <button onClick={()=>{onClose();onImported();}} style={{ width:'100%',padding:'10px',backgroundColor:'var(--primary)',color:'white',border:'none',borderRadius:'8px',cursor:'pointer',fontWeight:700,fontSize:'0.95rem' }}>
              Ver resultados
            </button>
          </div>
        ) : (
          <>
            <div
              onDragOver={e=>{e.preventDefault();setIsDragging(true);}}
              onDragLeave={()=>setIsDragging(false)}
              onDrop={e=>{e.preventDefault();setIsDragging(false);processFile(e.dataTransfer.files[0]);}}
              onClick={()=>fileRef.current?.click()}
              style={{ border:`2px dashed ${isDragging?'var(--primary)':'var(--border)'}`,borderRadius:'12px',padding:'40px 24px',textAlign:'center',cursor:'pointer',backgroundColor:isDragging?'#EFF6FF':'#FAFAFA',transition:'all 0.2s' }}
            >
              <Upload size={28} color={isDragging?'var(--primary)':'#94A3B8'} style={{ marginBottom:'10px' }}/>
              <p style={{ margin:'0 0 6px',fontWeight:600,color:isDragging?'var(--primary)':'var(--text-muted)' }}>Arrastra el CSV aquí</p>
              <p style={{ margin:0,fontSize:'0.82rem',color:'var(--text-muted)' }}>Solo se importarán actividades nuevas</p>
              <input ref={fileRef} type="file" accept=".csv" onChange={e=>processFile(e.target.files[0])} style={{ display:'none' }}/>
            </div>
            {importing&&<div style={{ textAlign:'center',marginTop:'16px',color:'var(--primary)',fontWeight:600 }}>Importando…</div>}
            {error&&<div style={{ marginTop:'12px',padding:'10px 14px',backgroundColor:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:'8px',color:'#DC2626',fontSize:'0.85rem' }}>{error}</div>}
            <p style={{ marginTop:'16px',fontSize:'0.78rem',color:'var(--text-muted)',textAlign:'center' }}>
              La deduplicación se basa en establecimiento + mes + año + disciplina.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LegionellaForecastModule({ onBackToHub }) {
  const [actividades, setActividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedDB, setSavedDB] = useState({});
  const [manualInputs, setManualInputs] = useState({});
  const [savingStates, setSavingStates] = useState({});
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState('calendario');
  const [activeTab, setActiveTab] = useState('d3');
  const [selectedMes, setSelectedMes] = useState(null); // { mes, año }
  const [showImport, setShowImport] = useState(false);
  const saveTimers = useRef({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: acts }, { data: estabs }] = await Promise.all([
      supabase.from('legionella_actividades').select('*').order('fecha_date', { ascending: true }),
      supabase.from('legionella_establecimientos').select('nombre, habitaciones, zonas_comunes'),
    ]);
    if (acts) setActividades(acts.map(enrichRow));
    if (estabs) {
      const m = {};
      estabs.forEach(r => { m[r.nombre] = r; });
      setSavedDB(m);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-select latest month when data loads
  useEffect(() => {
    if (!actividades.length) return;
    const meses = getAvailableMeses(actividades);
    if (meses.length && !selectedMes) setSelectedMes(meses[meses.length - 1]);
  }, [actividades]);

  const handleInputChange = useCallback((establecimiento, field, value) => {
    setManualInputs(prev => {
      const updated = { ...prev, [establecimiento]: { ...prev[establecimiento], [field]: value } };
      const inp = updated[establecimiento];
      if (!parseInt(inp.habitaciones)) return updated;
      clearTimeout(saveTimers.current[establecimiento]);
      setSavingStates(s => ({ ...s, [establecimiento]: 'saving' }));
      saveTimers.current[establecimiento] = setTimeout(async () => {
        const { error } = await supabase.from('legionella_establecimientos').upsert(
          { nombre: establecimiento, habitaciones: parseInt(inp.habitaciones)||0, zonas_comunes: parseInt(inp.zonasComunes||0)||0 },
          { onConflict: 'nombre' }
        );
        if (error) { setSavingStates(s=>({...s,[establecimiento]:'error'})); }
        else {
          setSavedDB(prev => ({ ...prev, [establecimiento]: { habitaciones: parseInt(inp.habitaciones), zonas_comunes: parseInt(inp.zonasComunes||0) } }));
          setManualInputs(prev2=>({...prev2,[establecimiento]:{...prev2[establecimiento],_guardado:true}}));
          setSavingStates(s=>({...s,[establecimiento]:'saved'}));
          setTimeout(()=>setSavingStates(s=>({...s,[establecimiento]:null})),3000);
          // Also update the activity's estimation in DB
          await supabase.from('legionella_actividades')
            .update({ muestras_estimadas: calcPorNormativa(inp.habitaciones, inp.zonasComunes||0)?.total, estado_estimacion: 'RD 487/2022 (guardado)' })
            .eq('establecimiento', establecimiento)
            .is('muestras_estimadas', null);
        }
      }, 1000);
      return updated;
    });
  }, []);

  const handleUpdateReal = useCallback(async (id, value) => {
    await supabase.from('legionella_actividades').update({ muestras_reales: value }).eq('id', id);
    setActividades(prev => prev.map(a => a.id === id ? { ...a, muestras_reales: value } : a));
  }, []);

  // Derive available periods
  function getAvailableMeses(acts) {
    const seen = new Set();
    const meses = [];
    acts.forEach(a => {
      const key = `${a.año}-${a.mes}`;
      if (!seen.has(key)) { seen.add(key); meses.push({ mes: a.mes, año: a.año }); }
    });
    return meses.sort((a, b) => {
      if (a.año !== b.año) return a.año - b.año;
      return MES_ORDEN.indexOf(a.mes) - MES_ORDEN.indexOf(b.mes);
    });
  }

  const mesesDisponibles = useMemo(() => getAvailableMeses(actividades), [actividades]);

  // Filter by selected month first, then by active tab, then by user filters
  const baseActs = useMemo(() => {
    if (!selectedMes) return [];
    return actividades.filter(a => a.mes === selectedMes.mes && a.año === selectedMes.año);
  }, [actividades, selectedMes]);

  const tabActs = useMemo(() => {
    if (activeTab === 'd3') return baseActs.filter(a => !a.disciplina?.toLowerCase().includes('d3bis') && !a.disciplina?.toLowerCase().includes('remuestreo'));
    return baseActs.filter(a => a.disciplina?.toLowerCase().includes('d3bis') || a.disciplina?.toLowerCase().includes('remuestreo'));
  }, [baseActs, activeTab]);

  const filteredActs = useMemo(() => applyFilters(tabActs, filters), [tabActs, filters]);

  const d3Count = useMemo(() => baseActs.filter(a=>!a.disciplina?.toLowerCase().includes('d3bis')&&!a.disciplina?.toLowerCase().includes('remuestreo')).length, [baseActs]);
  const d3bisCount = useMemo(() => baseActs.filter(a=>a.disciplina?.toLowerCase().includes('d3bis')||a.disciplina?.toLowerCase().includes('remuestreo')).length, [baseActs]);

  const calMesAno = useMemo(() => {
    const a = tabActs.find(x => x.fechaDate);
    return a ? { mes: a.fechaDate.getMonth()+1, año: a.fechaDate.getFullYear() } : (selectedMes ? { mes: MES_ORDEN.indexOf(selectedMes.mes)+1, año: selectedMes.año } : null);
  }, [tabActs, selectedMes]);

  const sinHistoricoPendientes = tabActs.filter(a => !a.estado_estimacion || a.estado_estimacion === 'SIN HISTÓRICO');
  const mesLabel = selectedMes ? `${selectedMes.mes.charAt(0).toUpperCase()+selectedMes.mes.slice(1)} ${selectedMes.año}` : '';

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100vh',backgroundColor:'var(--background)' }}>
      {/* Header */}
      <header style={{ height:'64px',backgroundColor:'var(--surface)',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',padding:'0 32px',gap:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)',flexShrink:0 }}>
        <button onClick={onBackToHub} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--primary)',display:'flex',alignItems:'center',gap:'6px',fontWeight:600,fontSize:'0.9rem' }}>
          <ArrowLeft size={18}/> Portal
        </button>
        <div style={{ width:'1px',height:'28px',backgroundColor:'var(--border)' }}/>
        <div>
          <h1 style={{ margin:0,fontSize:'1.1rem',fontWeight:700,color:'var(--secondary)' }}>Previsión Mensual Legionella</h1>
          {mesLabel&&<span style={{ fontSize:'0.82rem',color:'var(--text-muted)' }}>{mesLabel}</span>}
        </div>
        <div style={{ marginLeft:'auto',display:'flex',gap:'10px' }}>
          <button onClick={()=>setShowImport(true)} style={{ display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',backgroundColor:'white',border:'1px solid var(--primary)',borderRadius:'8px',cursor:'pointer',fontSize:'0.88rem',fontWeight:600,color:'var(--primary)' }}>
            <Plus size={14}/> Importar CSV
          </button>
          {filteredActs.length>0&&<button onClick={()=>exportarExcel(filteredActs,mesLabel)} style={{ display:'flex',alignItems:'center',gap:'6px',padding:'8px 18px',backgroundColor:'var(--primary)',color:'white',border:'none',borderRadius:'8px',cursor:'pointer',fontSize:'0.88rem',fontWeight:700 }}>
            <Download size={14}/> Exportar Excel
          </button>}
        </div>
      </header>

      <main style={{ flex:1,overflowY:'auto',padding:'32px' }}>
        {loading ? (
          <div style={{ textAlign:'center',paddingTop:'80px',color:'var(--text-muted)' }}>Cargando actividades…</div>
        ) : actividades.length === 0 ? (
          /* Empty state */
          <div style={{ maxWidth:'520px',margin:'60px auto',textAlign:'center' }}>
            <div style={{ width:'72px',height:'72px',borderRadius:'50%',backgroundColor:'#EFF6FF',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px' }}>
              <FileText size={36} color="var(--primary)"/>
            </div>
            <h2 style={{ color:'var(--secondary)',margin:'0 0 8px',fontSize:'1.4rem' }}>Sin actividades registradas</h2>
            <p style={{ color:'var(--text-muted)',margin:'0 0 24px' }}>Importa el primer fichero CSV para empezar a registrar la previsión de legionella.</p>
            <button onClick={()=>setShowImport(true)} style={{ display:'inline-flex',alignItems:'center',gap:'8px',padding:'12px 24px',backgroundColor:'var(--primary)',color:'white',border:'none',borderRadius:'10px',cursor:'pointer',fontWeight:700,fontSize:'1rem' }}>
              <Upload size={18}/> Importar CSV
            </button>
          </div>
        ) : (
          <div style={{ maxWidth:'1400px',margin:'0 auto' }}>
            {/* Month selector */}
            <div style={{ display:'flex',gap:'6px',marginBottom:'20px',flexWrap:'wrap',alignItems:'center' }}>
              <span style={{ fontSize:'0.78rem',fontWeight:700,color:'var(--secondary)',marginRight:'4px' }}>Período:</span>
              {mesesDisponibles.map(m=>{
                const isActive = selectedMes?.mes===m.mes&&selectedMes?.año===m.año;
                const label = `${m.mes.charAt(0).toUpperCase()+m.mes.slice(1)} ${m.año}`;
                return <button key={`${m.mes}-${m.año}`} onClick={()=>{setSelectedMes(m);setFilters(DEFAULT_FILTERS);setActiveTab('d3');}} style={{ padding:'6px 14px',borderRadius:'20px',border:`1.5px solid ${isActive?'var(--primary)':'var(--border)'}`,cursor:'pointer',fontWeight:isActive?700:500,fontSize:'0.85rem',backgroundColor:isActive?'var(--primary)':'white',color:isActive?'white':'var(--text-muted)',transition:'all 0.15s' }}>{label}</button>;
              })}
            </div>

            {/* Tabs + View toggle */}
            <div style={{ display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px',flexWrap:'wrap' }}>
              <div style={{ display:'flex',gap:'4px',backgroundColor:'white',borderRadius:'10px',padding:'4px',border:'1px solid var(--border)' }}>
                {[{key:'d3',label:`D3 – Muestreo (${d3Count})`},...(d3bisCount>0?[{key:'d3bis',label:`D3bis – Remuestreo (${d3bisCount})`}]:[])].map(tab=>(
                  <button key={tab.key} onClick={()=>{setActiveTab(tab.key);setFilters(DEFAULT_FILTERS);}} style={{ padding:'8px 20px',borderRadius:'7px',border:'none',cursor:'pointer',fontWeight:600,fontSize:'0.9rem',backgroundColor:activeTab===tab.key?'var(--primary)':'transparent',color:activeTab===tab.key?'white':'var(--text-muted)',transition:'all 0.15s' }}>{tab.label}</button>
                ))}
              </div>
              <div style={{ display:'flex',gap:'4px',backgroundColor:'white',borderRadius:'10px',padding:'4px',border:'1px solid var(--border)',marginLeft:'auto' }}>
                {[{key:'calendario',icon:<LayoutGrid size={14}/>,label:'Calendario'},{key:'tabla',icon:<List size={14}/>,label:'Tabla'}].map(v=>(
                  <button key={v.key} onClick={()=>setViewMode(v.key)} style={{ display:'flex',alignItems:'center',gap:'5px',padding:'7px 14px',borderRadius:'7px',border:'none',cursor:'pointer',fontWeight:600,fontSize:'0.85rem',backgroundColor:viewMode===v.key?'var(--secondary)':'transparent',color:viewMode===v.key?'white':'var(--text-muted)',transition:'all 0.15s' }}>{v.icon}{v.label}</button>
                ))}
              </div>
            </div>

            {sinHistoricoPendientes.length>0&&(
              <div style={{ marginBottom:'20px',padding:'12px 16px',backgroundColor:'#FFFBEB',border:'1px solid #FCD34D',borderRadius:'8px',display:'flex',alignItems:'flex-start',gap:'10px' }}>
                <AlertCircle size={18} color="#D97706" style={{ flexShrink:0,marginTop:'1px' }}/>
                <div>
                  <span style={{ fontWeight:700,color:'#92400E' }}>{sinHistoricoPendientes.length} establecimiento{sinHistoricoPendientes.length>1?'s':''} sin histórico — </span>
                  <span style={{ color:'#92400E',fontSize:'0.86rem' }}>introduce el nº de habitaciones para calcular según RD 487/2022.</span>
                </div>
              </div>
            )}

            <ResumenNodos actividades={filteredActs} allActs={tabActs} filters={filters} onFiltersChange={setFilters}/>

            {viewMode==='tabla'?(
              <TablaActividades
                actividades={filteredActs}
                savedDB={savedDB}
                manualInputs={manualInputs}
                onInputChange={handleInputChange}
                savingStates={savingStates}
                onUpdateReal={handleUpdateReal}
              />
            ):calMesAno&&(
              <MonthlyCalendar actividades={filteredActs} año={calMesAno.año} mes={calMesAno.mes}/>
            )}
          </div>
        )}
      </main>

      {showImport&&<ImportModal onClose={()=>setShowImport(false)} onImported={loadData} savedDB={savedDB}/>}
    </div>
  );
}
