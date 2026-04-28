import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Upload, Download, FileText, AlertCircle, CheckCircle,
  Info, Save, X, LayoutGrid, List, Plus, Edit2, Trash2,
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

// Normaliza abreviaturas y nombres alternativos al nombre completo en español
const MES_NORM = {
  'ene':'enero','feb':'febrero','mar':'marzo','abr':'abril','may':'mayo','jun':'junio',
  'jul':'julio','ago':'agosto','sep':'septiembre','oct':'octubre','nov':'noviembre','dic':'diciembre',
  'jan':'enero','apr':'abril','aug':'agosto','sep':'septiembre',
};

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

const TABS_CONFIG = {
  d3:    { key: 'd3',    label: 'D3 – Legionella',    color: 'var(--primary)', muestrasFija: null },
  d3bis: { key: 'd3bis', label: 'D3bis – Remuestreo',  color: '#7C3AED',       muestrasFija: null },
  d01:   { key: 'd01',   label: 'D01 – Alimentos',     color: '#D97706',       muestrasFija: 2 },
  d02:   { key: 'd02',   label: 'D02 – Piscinas',      color: '#0891B2',       muestrasFija: null },
  d04:   { key: 'd04',   label: 'D04 – Agua Potable',  color: '#16A34A',       muestrasFija: 1 },
};
const TABS_ORDER = ['d3', 'd3bis', 'd01', 'd02', 'd04'];

function getDisciplinaCategoria(disciplina) {
  const d = (disciplina || '').trim();
  const dl = d.toLowerCase();
  // Order matters: check most specific first
  if (/^d3bis/i.test(d) || dl.includes('remuestreo')) return 'd3bis';
  if (/^d0?3\b/i.test(d) || dl.includes('legionella')) return 'd3';
  if (/^d0?2\b/i.test(d)) return 'd02';                           // D2 / D02 — pool sampling only
  if (/^d0?4\b/i.test(d) || dl.includes('agua de red') || dl.includes('potable')) return 'd04';
  if (dl.includes('a01')) return 'd01';                           // A01 / A01h / A01h10 / etc.
  return 'other';
}

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
  if (!d || !m || !y) return null;
  // Año de 2 dígitos: 0-49 → 20xx válido, 50-99 → placeholder (ej. 1/1/70 = sin fecha)
  let fullYear = y;
  if (y < 50)  fullYear = 2000 + y;   // 26 → 2026
  else if (y < 100) return null;       // 70 → sin fecha asignada
  if (fullYear < 2000) return null;
  return new Date(fullYear, m - 1, d);
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
  const mesRaw = (row['mes'] || '').toLowerCase().trim();
  const mes = MES_NORM[mesRaw] || mesRaw;
  const año = parseInt(row['año'] || row['ano'] || 0);
  const region = (row['región'] || row['region'] || '').trim();
  const disciplina = row['disciplina'] || '';
  const fechaStr = row['fecha'] || '';
  const fechaDate = parseFecha(fechaStr);
  const cat = getDisciplinaCategoria(disciplina);

  // Detección por nombre (aplica también a establecimientos nuevos no registrados en DB)
  const nombreL = establecimiento.toLowerCase();
  const esSoloAuditoria = savedDB[establecimiento]?.solo_auditoria || /iberostar/i.test(establecimiento);
  const esExcluirD02 = savedDB[establecimiento]?.excluir_d02 || /restaurante|restaurant|\bbar\b/i.test(nombreL);

  // solo_auditoria: skip D01 y D02
  if ((cat === 'd01' || cat === 'd02') && esSoloAuditoria) return null;
  // excluir_d02: skip D02
  if (cat === 'd02' && esExcluirD02) return null;

  let muestrasEst, estadoEst;
  if (cat === 'd01') {
    muestrasEst = 2; estadoEst = 'Fijo (2 alimentos)';
  } else if (cat === 'd04') {
    muestrasEst = 1; estadoEst = 'Fijo (1 agua potable)';
  } else if (cat === 'd02') {
    const savedPisc = savedDB[establecimiento]?.piscinas;
    if (savedPisc) {
      muestrasEst = savedPisc; estadoEst = `Piscinas (histórico: ${savedPisc})`;
    } else {
      muestrasEst = null; estadoEst = 'SIN DATOS PISCINAS';
    }
  } else {
    // D3 / D3bis — histórico + normativa
    const { muestras, estado } = estimarMuestras(establecimiento, mes);
    muestrasEst = muestras; estadoEst = estado;
    if (!muestrasEst) {
      const saved = savedDB[establecimiento];
      if (saved?.habitaciones) {
        const c = calcPorNormativa(saved.habitaciones, saved.zonas_comunes || 0);
        if (c) { muestrasEst = c.total; estadoEst = 'RD 487/2022 (guardado)'; }
      }
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
    fecha_date: fechaDate ? `${fechaDate.getFullYear()}-${String(fechaDate.getMonth()+1).padStart(2,'0')}-${String(fechaDate.getDate()).padStart(2,'0')}` : null,
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

// ─── PendientesModal ──────────────────────────────────────────────────────────

function PendientesModal({ actividades, savedDB, onSave, onClose }) {
  const pendientes = actividades.filter(a => !a.estado_estimacion || a.estado_estimacion === 'SIN HISTÓRICO');
  const [rows, setRows] = useState(() =>
    pendientes.map(a => ({
      establecimiento: a.establecimiento,
      auditor: a.auditor || '',
      nodo: a.nodo || '',
      habitaciones: savedDB[a.establecimiento]?.habitaciones || '',
      zonasComunes: savedDB[a.establecimiento]?.zonas_comunes || '',
      saving: null,
    }))
  );

  const updateRow = (i, field, value) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const handleSaveRow = async (i) => {
    const row = rows[i];
    if (!row.habitaciones) return;
    updateRow(i, 'saving', 'saving');
    await onSave(row.establecimiento, row.habitaciones, row.zonasComunes);
    updateRow(i, 'saving', 'saved');
  };

  const handleSaveAll = async () => {
    const toSave = rows.filter(r => r.habitaciones && r.saving !== 'saved');
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].habitaciones && rows[i].saving !== 'saved') await handleSaveRow(i);
    }
  };

  const pendingCount = rows.filter(r => r.habitaciones && r.saving !== 'saved').length;

  return (
    <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ backgroundColor:'white', borderRadius:'16px', width:'700px', maxWidth:'95vw', maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div style={{ padding:'24px 28px 16px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <h2 style={{ margin:'0 0 4px', fontSize:'1.1rem', fontWeight:700, color:'var(--secondary)', display:'flex', alignItems:'center', gap:'8px' }}>
              <AlertCircle size={18} color="#D97706" /> Establecimientos sin histórico
            </h2>
            <p style={{ margin:0, fontSize:'0.82rem', color:'#92400E' }}>Introduce el nº de habitaciones para calcular las muestras según RD 487/2022</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', padding:'4px' }}><X size={20}/></button>
        </div>

        {/* Lista */}
        <div style={{ overflowY:'auto', flex:1, padding:'12px 28px' }}>
          {rows.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px', color:'#94A3B8' }}>
              <CheckCircle size={32} color="#16A34A" style={{ marginBottom:'8px' }}/><br/>
              Todos los establecimientos tienen histórico o ya han sido configurados.
            </div>
          )}
          {rows.map((row, i) => {
            const preview = row.habitaciones ? calcPorNormativa(row.habitaciones, row.zonasComunes || 0) : null;
            const c = NODO_COLORS[row.nodo] || { bg:'#f8f9fa', border:'#dee2e6', text:'#495057' };
            const isSaved = row.saving === 'saved';
            return (
              <div key={i} style={{ padding:'14px 0', borderBottom:'1px solid #F1F5F9', display:'flex', flexDirection:'column', gap:'8px', opacity: isSaved ? 0.6 : 1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
                  <div style={{ flex:'1 1 200px', minWidth:0 }}>
                    <div style={{ fontWeight:700, color:'var(--secondary)', fontSize:'0.9rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.establecimiento}</div>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center', marginTop:'3px' }}>
                      {row.auditor && <span style={{ fontSize:'0.73rem', color:'#64748B' }}>{row.auditor}</span>}
                      <span style={{ fontSize:'0.67rem', color:c.text, fontWeight:600, border:`1px solid ${c.border}`, backgroundColor:c.bg, borderRadius:'4px', padding:'1px 6px' }}>{row.nodo?.replace('Zona ','').replace('Islas ','')}</span>
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
                    <label style={{ display:'flex', flexDirection:'column', gap:'2px', fontSize:'0.75rem', color:'#64748B' }}>
                      Habitaciones *
                      <input
                        type="number" min="0" value={row.habitaciones}
                        onChange={e => updateRow(i, 'habitaciones', e.target.value)}
                        placeholder="Nº hab."
                        disabled={isSaved}
                        style={{ width:'90px', padding:'6px 8px', border:`1.5px solid ${row.habitaciones ? '#FCD34D' : '#E2E8F0'}`, borderRadius:'6px', fontSize:'0.85rem', outline:'none' }}
                      />
                    </label>
                    <label style={{ display:'flex', flexDirection:'column', gap:'2px', fontSize:'0.75rem', color:'#64748B' }}>
                      Zonas comunes
                      <input
                        type="number" min="0" value={row.zonasComunes}
                        onChange={e => updateRow(i, 'zonasComunes', e.target.value)}
                        placeholder="Extra"
                        disabled={isSaved}
                        style={{ width:'90px', padding:'6px 8px', border:'1.5px solid #E2E8F0', borderRadius:'6px', fontSize:'0.85rem', outline:'none' }}
                      />
                    </label>

                    {preview && !isSaved && (
                      <div style={{ fontSize:'0.78rem', color:'#0369A1', backgroundColor:'#E0F2FE', border:'1px solid #7DD3FC', borderRadius:'6px', padding:'4px 10px', fontWeight:600, whiteSpace:'nowrap' }}>
                        {preview.total} muestras
                      </div>
                    )}

                    {isSaved ? (
                      <span style={{ fontSize:'0.78rem', color:'#16A34A', display:'flex', alignItems:'center', gap:'4px', fontWeight:600 }}><CheckCircle size={14}/>Guardado</span>
                    ) : (
                      <button
                        onClick={() => handleSaveRow(i)}
                        disabled={!row.habitaciones || row.saving === 'saving'}
                        style={{ padding:'7px 14px', backgroundColor: row.habitaciones ? 'var(--primary)' : '#E2E8F0', color: row.habitaciones ? 'white' : '#94A3B8', border:'none', borderRadius:'7px', cursor: row.habitaciones ? 'pointer' : 'not-allowed', fontWeight:700, fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'5px', whiteSpace:'nowrap' }}
                      >
                        <Save size={13}/> {row.saving === 'saving' ? 'Guardando…' : 'Guardar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 28px', borderTop:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0, backgroundColor:'#F8FAFC', borderRadius:'0 0 16px 16px' }}>
          <span style={{ fontSize:'0.82rem', color:'#64748B' }}>{rows.filter(r => r.saving === 'saved').length} de {rows.length} guardados</span>
          <div style={{ display:'flex', gap:'10px' }}>
            <button onClick={onClose} style={{ padding:'8px 18px', border:'1px solid #CBD5E1', borderRadius:'8px', background:'white', cursor:'pointer', fontWeight:600, fontSize:'0.88rem', color:'#64748B' }}>Cerrar</button>
            {pendingCount > 0 && (
              <button onClick={handleSaveAll} style={{ padding:'8px 20px', backgroundColor:'var(--primary)', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:700, fontSize:'0.88rem', display:'flex', alignItems:'center', gap:'6px' }}>
                <Save size={14}/> Guardar todos ({pendingCount})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ResumenNodos ─────────────────────────────────────────────────────────────

function ResumenNodos({ actividades, allActs, sinFechaData, filters, onFiltersChange, onPendientesClick, nodosVisibles = NODOS_ORDEN }) {
  const res = agruparPorNodo(allActs);
  const totalEst = actividades.reduce((s,a)=>s+(a.muestras_estimadas||0),0);
  const totalReal = actividades.reduce((s,a)=>s+(a.muestras_reales||0),0);
  const pendientes = allActs.filter(a => ['d3','d3bis'].includes(getDisciplinaCategoria(a.disciplina)) && (!a.estado_estimacion||a.estado_estimacion==='SIN HISTÓRICO')).length;
  const isFiltered = filters.zones.size > 0;

  const sinFechaCount = sinFechaData?.count || 0;
  const sinFechaMuestras = sinFechaData?.muestras || 0;

  const toggleNodo = (nodo) => {
    const s = new Set(filters.zones);
    if (s.has(nodo)) { s.delete(nodo); } else { s.add(nodo); }
    onFiltersChange({ ...filters, zones: s });
  };

  const totalCols = nodosVisibles.length + (sinFechaCount > 0 ? 1 : 0);

  return (
    <div style={{ marginBottom:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
        <h3 style={{ fontSize:'1rem', fontWeight:700, color:'var(--secondary)', margin:0 }}>Resumen por Nodo Logístico</h3>
        {pendientes>0 && <button onClick={onPendientesClick} style={{ fontSize:'0.78rem', backgroundColor:'#FFFBEB', color:'#D97706', border:'1px solid #FCD34D', borderRadius:'20px', padding:'2px 10px', fontWeight:600, cursor:'pointer' }}>{pendientes} pendiente{pendientes>1?'s':''} ▸</button>}
        {isFiltered && <button onClick={()=>onFiltersChange(DEFAULT_FILTERS)} style={{ fontSize:'0.75rem', color:'#DC2626', background:'none', border:'1px solid #FCA5A5', borderRadius:'20px', padding:'2px 10px', cursor:'pointer', fontWeight:600 }}>✕ Quitar filtro{filters.zones.size>1?` (${filters.zones.size})`:''}</button>}
        {isFiltered && <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>Mostrando {actividades.length} de {allActs.length}</span>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${totalCols},1fr)`, gap:'10px', marginBottom:'10px' }}>
        {nodosVisibles.map(nodo => {
          const d=res[nodo], c=NODO_COLORS[nodo];
          const isActive = filters.zones.has(nodo);
          const isInactive = isFiltered && !isActive;
          const real = allActs.filter(a=>a.nodo===nodo).reduce((s,a)=>s+(a.muestras_reales||0),0);
          return (
            <div key={nodo} onClick={()=>toggleNodo(nodo)} style={{ backgroundColor:c.bg, border:`2px solid ${c.border}`, borderRadius:'10px', padding:'12px 16px', cursor:'pointer', opacity:isInactive?0.35:1, transition:'all 0.15s', userSelect:'none', boxShadow:isActive?`0 0 0 2px ${c.border}`:'none' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ fontSize:'0.7rem', fontWeight:700, color:c.text, marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.04em' }}>{nodo}</div>
                {isActive && <span style={{ fontSize:'0.75rem', color:c.text, fontWeight:800 }}>✓</span>}
              </div>
              <div style={{ fontSize:'1.4rem', fontWeight:800, color:c.text }}>{d?.muestras||0}</div>
              {real>0 && <div style={{ fontSize:'0.72rem', color:c.text, opacity:0.8 }}>✓ {real} recogidas</div>}
              <div style={{ fontSize:'0.73rem', color:c.text, opacity:0.65 }}>{d?.count||0} establec.</div>
            </div>
          );
        })}
        {sinFechaCount > 0 && (
          <div style={{ backgroundColor:'#FFFBEB', border:'2px dashed #FCD34D', borderRadius:'10px', padding:'12px 16px', opacity: isFiltered ? 0.5 : 1 }}>
            <div style={{ fontSize:'0.7rem', fontWeight:700, color:'#92400E', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.04em' }}>Sin fecha</div>
            <div style={{ fontSize:'1.4rem', fontWeight:800, color:'#D97706' }}>{sinFechaMuestras}</div>
            <div style={{ fontSize:'0.72rem', color:'#92400E', opacity:0.8 }}>sin programar</div>
            <div style={{ fontSize:'0.73rem', color:'#92400E', opacity:0.65 }}>{sinFechaCount} activid.</div>
          </div>
        )}
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
    if (!a.fechaDate || a.fechaDate.getFullYear() < 2000) return;
    if (a.fechaDate.getMonth() + 1 !== mes || a.fechaDate.getFullYear() !== año) return;
    const d = a.fechaDate.getDate();
    m[d] = m[d] || [];
    m[d].push(a);
  });
  return m;
}

function MonthlyCalendar({ actividades, año, mes, savedDB = {}, onSaveHabitaciones, onSavePiscinas, savingStates = {} }) {
  const [expandedDay, setExpandedDay] = useState(null);
  const [editingEstab, setEditingEstab] = useState(null);
  const [localInputs, setLocalInputs] = useState({ habitaciones: '', zonasComunes: '' });
  const [showPendientes, setShowPendientes] = useState(false);
  const byDay = groupByDay(actividades, mes, año);

  const openEdit = (act) => {
    const saved = savedDB[act.establecimiento];
    setLocalInputs({ habitaciones: saved?.habitaciones || '', zonasComunes: saved?.zonas_comunes || '' });
    setEditingEstab(act.establecimiento);
  };

  const SinHistoricoCard = ({ act }) => {
    const c = NODO_COLORS[act.nodo] || { bg: '#f8f9fa', border: '#dee2e6', text: '#495057' };
    const isEditing = editingEstab === act.establecimiento;
    const saving = savingStates[act.establecimiento];
    const preview = isEditing && localInputs.habitaciones ? calcPorNormativa(localInputs.habitaciones, localInputs.zonasComunes || 0) : null;

    if (isEditing) {
      return (
        <div style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FCD34D', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '0.85rem' }}>{act.establecimiento}</div>
          <div style={{ fontSize: '0.78rem', color: '#92400E', fontWeight: 600 }}>Cálculo RD 487/2022</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.78rem', color: '#92400E', flex: 1, minWidth: '90px' }}>
              Habitaciones
              <input type="number" min="0" value={localInputs.habitaciones} onChange={e => setLocalInputs(p => ({ ...p, habitaciones: e.target.value }))} placeholder="Nº hab." style={{ padding: '5px 8px', border: '1.5px solid #FCD34D', borderRadius: '6px', fontSize: '0.82rem', outline: 'none' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.78rem', color: '#92400E', flex: 1, minWidth: '90px' }}>
              Zonas comunes
              <input type="number" min="0" value={localInputs.zonasComunes} onChange={e => setLocalInputs(p => ({ ...p, zonasComunes: e.target.value }))} placeholder="Extra" style={{ padding: '5px 8px', border: '1.5px solid #FCD34D', borderRadius: '6px', fontSize: '0.82rem', outline: 'none' }} />
            </label>
          </div>
          {preview && <div style={{ fontSize: '0.8rem', color: '#0369A1', backgroundColor: '#E0F2FE', border: '1px solid #7DD3FC', borderRadius: '6px', padding: '4px 10px', fontWeight: 600 }}>{preview.puntos} pts → {preview.acs} ACS + {preview.afch} AFCH = <strong>{preview.total}</strong> muestras</div>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setEditingEstab(null)} style={{ flex: 1, padding: '6px', border: '1px solid #CBD5E1', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Cancelar</button>
            <button
              disabled={!localInputs.habitaciones || saving === 'saving'}
              onClick={async () => { await onSaveHabitaciones(act.establecimiento, localInputs.habitaciones, localInputs.zonasComunes); setEditingEstab(null); }}
              style={{ flex: 2, padding: '6px 12px', border: 'none', borderRadius: '6px', background: !localInputs.habitaciones ? '#CBD5E1' : '#0369A1', cursor: !localInputs.habitaciones ? 'not-allowed' : 'pointer', color: 'white', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
            >
              <Save size={13} /> {saving === 'saving' ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
          {saving === 'saved' && <span style={{ fontSize: '0.73rem', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '3px' }}><CheckCircle size={11} /> Guardado correctamente</span>}
          {saving === 'error' && <span style={{ fontSize: '0.73rem', color: '#DC2626' }}>Error al guardar</span>}
        </div>
      );
    }

    return (
      <div onClick={() => openEdit(act)} style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'border-color 0.15s' }} title="Clic para introducir habitaciones">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '0.85rem', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.establecimiento}</div>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{act.auditor || '—'}</div>
          <span style={{ fontSize: '0.67rem', color: c.text, fontWeight: 600, border: `1px solid ${c.border}`, backgroundColor: 'white', borderRadius: '4px', padding: '1px 6px' }}>{act.nodo?.replace('Zona ', '').replace('Islas ', '')}</span>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.68rem', color: '#D97706', fontWeight: 700, backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '4px', padding: '2px 6px', marginBottom: '4px' }}>SIN HISTÓRICO</div>
          <div style={{ fontSize: '0.72rem', color: '#0369A1', fontWeight: 600 }}>→ Introducir hab.</div>
        </div>
      </div>
    );
  };

  const [editingPiscEstab, setEditingPiscEstab] = useState(null);
  const [piscInput, setPiscInput] = useState('');

  const SinPiscinasCard = ({ act }) => {
    const isEditing = editingPiscEstab === act.establecimiento;
    const saving = savingStates[act.establecimiento];
    const current = savedDB[act.establecimiento]?.piscinas;
    if (isEditing) {
      return (
        <div style={{ backgroundColor:'#EFF6FF',border:'1.5px solid #7DD3FC',borderRadius:'10px',padding:'14px',display:'flex',flexDirection:'column',gap:'10px' }}>
          <div style={{ fontWeight:700,color:'var(--secondary)',fontSize:'0.85rem' }}>{act.establecimiento}</div>
          <div style={{ fontSize:'0.78rem',color:'#0369A1',fontWeight:600 }}>Nº de piscinas muestreadas</div>
          <input type="number" min="1" value={piscInput} onChange={e=>setPiscInput(e.target.value)} placeholder="Ej: 3" style={{ padding:'6px 10px',border:'1.5px solid #7DD3FC',borderRadius:'6px',fontSize:'0.9rem',outline:'none',width:'100px' }} />
          <div style={{ display:'flex',gap:'8px' }}>
            <button onClick={()=>setEditingPiscEstab(null)} style={{ flex:1,padding:'6px',border:'1px solid #CBD5E1',borderRadius:'6px',background:'white',cursor:'pointer',fontSize:'0.8rem',color:'#64748B',fontWeight:600 }}>Cancelar</button>
            <button
              disabled={!piscInput||saving==='saving'}
              onClick={async()=>{ await onSavePiscinas(act.establecimiento,parseInt(piscInput)); setEditingPiscEstab(null); }}
              style={{ flex:2,padding:'6px 12px',border:'none',borderRadius:'6px',background:!piscInput?'#CBD5E1':'#0891B2',cursor:!piscInput?'not-allowed':'pointer',color:'white',fontSize:'0.82rem',fontWeight:700 }}
            >
              {saving==='saving'?'Guardando…':'Guardar'}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div onClick={()=>{ setEditingPiscEstab(act.establecimiento); setPiscInput(current||''); }}
        style={{ backgroundColor:'#EFF6FF',border:'1px solid #7DD3FC',borderRadius:'8px',padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px',cursor:'pointer' }}>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontWeight:700,color:'var(--secondary)',fontSize:'0.85rem',marginBottom:'2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{act.establecimiento}</div>
          <div style={{ fontSize:'0.73rem',color:'var(--text-muted)',marginBottom:'4px' }}>{act.auditor||'—'}</div>
        </div>
        <div style={{ textAlign:'right',flexShrink:0 }}>
          <div style={{ fontSize:'0.68rem',color:'#0891B2',fontWeight:700,backgroundColor:'#E0F2FE',border:'1px solid #7DD3FC',borderRadius:'4px',padding:'2px 6px',marginBottom:'4px' }}>SIN DATOS PISCINAS</div>
          <div style={{ fontSize:'0.72rem',color:'#0369A1',fontWeight:600 }}>→ Introducir nº piscinas</div>
        </div>
      </div>
    );
  };

  const firstDay = new Date(año, mes-1, 1);
  const lastDay = new Date(año, mes, 0).getDate();
  const startOffset = (firstDay.getDay()+6)%7;
  const cells = [...Array(startOffset).fill(null), ...Array.from({length:lastDay},(_,i)=>i+1)];
  while(cells.length%7!==0) cells.push(null);
  const weeks = Array.from({length:cells.length/7},(_,i)=>cells.slice(i*7,i*7+7));
  const sinFecha = actividades.filter(a=>!a.fechaDate || a.fechaDate.getFullYear()<2000 || a.fechaDate.getMonth()+1!==mes || a.fechaDate.getFullYear()!==año);
  const mesNombre = MES_ORDEN[mes-1];
  const expandedActs = expandedDay ? (byDay[expandedDay]||[]) : [];

  return (
    <div>
      {/* Cabecera días semana */}
      <div style={{ display:'grid',gridTemplateColumns:'1.4fr 1.4fr 1.4fr 1.4fr 1.4fr 0.45fr 0.45fr',gap:'4px',marginBottom:'4px' }}>
        {DIAS_SEMANA_CORTO.map((d,i)=>(
          <div key={d} style={{ textAlign:'center',fontSize:'0.73rem',fontWeight:700,padding:'6px 0',color:i>=5?'#CBD5E1':'var(--text-muted)' }}>{d}</div>
        ))}
      </div>

      {/* Semanas */}
      {weeks.map((week,wi)=>(
        <div key={wi} style={{ display:'grid',gridTemplateColumns:'1.4fr 1.4fr 1.4fr 1.4fr 1.4fr 0.45fr 0.45fr',gap:'4px',marginBottom:'4px' }}>
          {week.map((day,di)=>{
            const isWeekend = di>=5;
            const acts=day?(byDay[day]||[]):[];
            const totalEst=acts.reduce((s,a)=>s+(a.muestras_estimadas||0),0);
            const totalReal=acts.reduce((s,a)=>s+(a.muestras_reales||0),0);
            const sinEstimar=acts.length>0&&totalEst===0;
            const isExpanded=expandedDay===day;
            const today=new Date(); const isToday=day&&año===today.getFullYear()&&mes===today.getMonth()+1&&day===today.getDate();
            // Breakdown by discipline category
            const byCat={};
            acts.forEach(a=>{
              const cat=getDisciplinaCategoria(a.disciplina);
              if(!byCat[cat]) byCat[cat]={count:0,muestras:0};
              byCat[cat].count++;
              byCat[cat].muestras+=a.muestras_estimadas||0;
            });
            // Weekend: compact, muted, no-click
            if (isWeekend) return (
              <div key={di} style={{ minHeight:'48px',backgroundColor:!day?'transparent':'#F8FAFC',border:day?'1px solid #EBEBEB':'none',borderRadius:'6px',padding:day?'5px 4px':0,opacity:0.55,display:'flex',alignItems:'flex-start',justifyContent:'center' }}>
                {day&&<span style={{ fontSize:'0.72rem',fontWeight:400,color:'#CBD5E1' }}>{day}</span>}
              </div>
            );
            return (
              <div key={di}
                onClick={()=>acts.length>0&&setExpandedDay(isExpanded?null:day)}
                style={{ minHeight:'100px',backgroundColor:!day?'transparent':isToday?'#EFF6FF':acts.length>0?'white':'#FCFCFC',border:day?`1.5px solid ${isExpanded?'var(--primary)':isToday?'var(--primary)':acts.length>0?'var(--border)':'#EBEBEB'}`:'none',borderRadius:'8px',padding:day?'7px':0,cursor:acts.length>0?'pointer':'default',transition:'border-color 0.15s',boxShadow:isToday?'0 0 0 3px rgba(0,118,206,0.2)':isExpanded?'0 0 0 3px rgba(14,165,233,0.15)':'none' }}>
                {day&&<>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'4px' }}>
                    <span style={{ fontSize:'0.85rem',fontWeight:700,color:isToday?'var(--primary)':acts.length>0?'var(--secondary)':'#CCC',display:'flex',alignItems:'center',gap:'4px' }}>
                      {day}{isToday&&<span style={{ fontSize:'0.6rem',fontWeight:800,color:'white',backgroundColor:'var(--primary)',borderRadius:'4px',padding:'1px 4px',lineHeight:1.4 }}>HOY</span>}
                    </span>
                    {totalEst>0&&<span style={{ fontSize:'0.75rem',fontWeight:800,color:'white',backgroundColor:'var(--primary)',borderRadius:'5px',padding:'2px 7px',letterSpacing:'-0.01em' }}>{totalEst}m</span>}
                    {sinEstimar&&<span style={{ fontSize:'0.68rem',fontWeight:700,color:'#D97706',backgroundColor:'#FFFBEB',border:'1px solid #FCD34D',borderRadius:'5px',padding:'2px 6px' }}>{acts.length}est</span>}
                  </div>
                  {totalReal>0&&<div style={{ fontSize:'0.65rem',color:'#16A34A',fontWeight:700,marginBottom:'3px' }}>✓ {totalReal} rec.</div>}
                  {TABS_ORDER.filter(cat=>byCat[cat]).map(cat=>{
                    const cfg=TABS_CONFIG[cat];
                    const {count,muestras}=byCat[cat];
                    const label=muestras>0?`${muestras}m`:`${count}est`;
                    const shortLabel=cfg.label.split('–')[0].trim();
                    return (
                      <div key={cat} title={`${cfg.label}: ${count} establec. · ${muestras} muestras`}
                        style={{ fontSize:'0.63rem',fontWeight:700,color:'white',backgroundColor:cfg.color,borderRadius:'3px',padding:'2px 5px',marginBottom:'2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',justifyContent:'space-between',gap:'4px' }}>
                        <span style={{ opacity:0.85,flexShrink:0 }}>{shortLabel}</span>
                        <span>{label}</span>
                      </div>
                    );
                  })}
                  {byCat['other']&&(
                    <div style={{ fontSize:'0.63rem',fontWeight:700,color:'#64748B',backgroundColor:'#F1F5F9',borderRadius:'3px',padding:'2px 5px',marginBottom:'2px' }}>
                      Otros {byCat['other'].muestras>0?`${byCat['other'].muestras}m`:`${byCat['other'].count}est`}
                    </div>
                  )}
                </>}
              </div>
            );
          })}
        </div>
      ))}

      {/* Panel detalle día */}
      {expandedDay&&expandedActs.length>0&&(
        <div style={{ marginTop:'10px',backgroundColor:'white',border:'1.5px solid var(--primary)',borderRadius:'12px',overflow:'hidden',boxShadow:'0 4px 24px rgba(0,0,0,0.10)' }}>
          <div style={{ padding:'14px 20px',backgroundColor:'var(--secondary)',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <div>
              <div style={{ color:'rgba(255,255,255,0.65)',fontSize:'0.75rem',fontWeight:600,marginBottom:'2px' }}>
                {DIAS_SEMANA_CORTO[(new Date(año,mes-1,expandedDay).getDay()+6)%7]} {expandedDay} de {mesNombre} {año}
              </div>
              <div style={{ color:'white',fontWeight:800,fontSize:'1.05rem' }}>
                {expandedActs.reduce((s,a)=>s+(a.muestras_estimadas||0),0)} muestras estimadas &nbsp;·&nbsp; {expandedActs.length} establecimiento{expandedActs.length>1?'s':''}
              </div>
            </div>
            <button onClick={e=>{e.stopPropagation();setExpandedDay(null);}} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:'1.3rem',lineHeight:1,padding:'4px 8px' }}>✕</button>
          </div>
          <div style={{ padding:'14px', display:'flex', flexDirection:'column', gap:'12px' }}>
            {TABS_ORDER.map(cat=>{
              const cfg=TABS_CONFIG[cat];
              const catActs=expandedActs.filter(a=>getDisciplinaCategoria(a.disciplina)===cat);
              if(!catActs.length) return null;
              const catTotal=catActs.reduce((s,a)=>s+(a.muestras_estimadas||0),0);
              return (
                <div key={cat}>
                  <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px' }}>
                    <span style={{ fontSize:'0.72rem',fontWeight:800,color:'white',backgroundColor:cfg.color,borderRadius:'5px',padding:'2px 10px' }}>{cfg.label}</span>
                    <span style={{ fontSize:'0.72rem',color:'var(--text-muted)',fontWeight:600 }}>{catTotal>0?`${catTotal} muestras`:''} · {catActs.length} establec.</span>
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'6px' }}>
                    {catActs.sort((a,b)=>(b.muestras_estimadas||0)-(a.muestras_estimadas||0)).map((act,i)=>{
                      const sinHist=act.estado_estimacion==='SIN HISTÓRICO';
                      if(sinHist) return <SinHistoricoCard key={i} act={act}/>;
                      const sinPisc=act.estado_estimacion==='SIN DATOS PISCINAS';
                      if(sinPisc) return <SinPiscinasCard key={i} act={act}/>;
                      const c=NODO_COLORS[act.nodo]||{bg:'#f8f9fa',border:'#dee2e6',text:'#495057'};
                      return (
                        <div key={i} style={{ backgroundColor:c.bg,border:`1px solid ${c.border}`,borderRadius:'8px',padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px' }}>
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontWeight:700,color:'var(--secondary)',fontSize:'0.85rem',marginBottom:'2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{act.establecimiento}</div>
                            <div style={{ fontSize:'0.73rem',color:'var(--text-muted)',marginBottom:'4px' }}>{act.auditor||'—'}</div>
                            <span style={{ fontSize:'0.67rem',color:c.text,fontWeight:600,border:`1px solid ${c.border}`,backgroundColor:'white',borderRadius:'4px',padding:'1px 6px' }}>{act.nodo?.replace('Zona ','').replace('Islas ','')}</span>
                          </div>
                          <div style={{ textAlign:'right',flexShrink:0 }}>
                            <div style={{ fontSize:'1.5rem',fontWeight:800,color:cfg.color,lineHeight:1 }}>{act.muestras_estimadas??'?'}</div>
                            <div style={{ fontSize:'0.63rem',color:'var(--text-muted)' }}>muestras</div>
                            {act.muestras_reales!=null&&<div style={{ fontSize:'0.7rem',color:'#16A34A',fontWeight:700,marginTop:'2px' }}>✓ {act.muestras_reales}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {/* Otras disciplinas no clasificadas */}
            {expandedActs.filter(a=>getDisciplinaCategoria(a.disciplina)==='other').length>0&&(
              <div>
                <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px' }}>
                  <span style={{ fontSize:'0.72rem',fontWeight:800,color:'white',backgroundColor:'#64748B',borderRadius:'5px',padding:'2px 10px' }}>Otras</span>
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'6px' }}>
                  {expandedActs.filter(a=>getDisciplinaCategoria(a.disciplina)==='other').map((act,i)=>{
                    const c=NODO_COLORS[act.nodo]||{bg:'#f8f9fa',border:'#dee2e6',text:'#495057'};
                    return (
                      <div key={i} style={{ backgroundColor:c.bg,border:`1px solid ${c.border}`,borderRadius:'8px',padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px' }}>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontWeight:700,color:'var(--secondary)',fontSize:'0.85rem',marginBottom:'2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{act.establecimiento}</div>
                          <div style={{ fontSize:'0.73rem',color:'var(--text-muted)',marginBottom:'4px' }}>{act.auditor||'—'}</div>
                          <span style={{ fontSize:'0.67rem',color:c.text,fontWeight:600,border:`1px solid ${c.border}`,backgroundColor:'white',borderRadius:'4px',padding:'1px 6px' }}>{act.nodo?.replace('Zona ','').replace('Islas ','')}</span>
                        </div>
                        <div style={{ textAlign:'right',flexShrink:0 }}>
                          <div style={{ fontSize:'1.5rem',fontWeight:800,color:c.text,lineHeight:1 }}>{act.muestras_estimadas??'?'}</div>
                          <div style={{ fontSize:'0.63rem',color:'var(--text-muted)' }}>muestras</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {sinFecha.length>0&&(
        <div style={{ marginTop:'12px', backgroundColor:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'10px', overflow:'hidden' }}>
          <button
            onClick={() => setShowPendientes(v => !v)}
            style={{ width:'100%', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}
          >
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ fontSize:'0.8rem', fontWeight:700, color:'#64748B' }}>Pendiente de programar</span>
              <span style={{ fontSize:'0.72rem', backgroundColor:'#E2E8F0', color:'#64748B', borderRadius:'20px', padding:'1px 8px', fontWeight:600 }}>{sinFecha.length}</span>
            </div>
            <span style={{ fontSize:'0.8rem', color:'#94A3B8' }}>{showPendientes ? '▲' : '▼'}</span>
          </button>
          {showPendientes && (
            <div style={{ borderTop:'1px solid #E2E8F0', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'8px', padding:'10px' }}>
              {sinFecha.map((act, i) => {
                if (act.estado_estimacion === 'SIN HISTÓRICO') return <SinHistoricoCard key={i} act={act} />;
                if (act.estado_estimacion === 'SIN DATOS PISCINAS') return <SinPiscinasCard key={i} act={act} />;
                const c = NODO_COLORS[act.nodo] || { bg:'#f8f9fa', border:'#dee2e6', text:'#495057' };
                return (
                  <div key={i} style={{ fontSize:'0.82rem', color:'var(--secondary)', padding:'8px 12px', backgroundColor:'white', border:`1px solid ${c.border}`, borderRadius:'6px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:600, marginBottom:'2px' }}>{act.establecimiento}</div>
                      <div style={{ fontSize:'0.72rem', color:'#94A3B8' }}>{act.auditor || '—'}</div>
                    </div>
                    <span style={{ fontSize:'0.65rem', color:c.text, fontWeight:600, border:`1px solid ${c.border}`, backgroundColor:c.bg, borderRadius:'4px', padding:'1px 5px', flexShrink:0 }}>{act.nodo?.replace('Zona ','').replace('Islas ','')}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
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
  const sinFecha=actividades.filter(a=>!a.fechaDate||a.fechaDate.getFullYear()<2000);

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

    const records = rows.map(r => csvRowToRecord(r, savedDB)).filter(Boolean);

    // Regla: A01 y A02 siempre implican un D02 el mismo día (si no viene ya explícito)
    // Deduplicación por (establecimiento + fecha). Si sin fecha, por (establecimiento + mes + año).
    const d02Auto = [];
    const d02Keys = new Set();
    const d02Key = r => r.fecha && r.fecha !== '1/1/70'
      ? `${r.establecimiento}|${r.fecha}`
      : `${r.establecimiento}|${r.mes}|${r.año}`;

    // Marcar D02 explícitos que ya vienen en el CSV
    records.forEach(r => {
      if (getDisciplinaCategoria(r.disciplina) === 'd02') d02Keys.add(d02Key(r));
    });

    records.forEach(rec => {
      const cat = getDisciplinaCategoria(rec.disciplina);
      const isA01 = cat === 'd01';
      const isA02 = /^a02\b/i.test(rec.disciplina || '');
      if (!isA01 && !isA02) return;
      const nomL = (rec.establecimiento || '').toLowerCase();
      if (savedDB[rec.establecimiento]?.solo_auditoria || /iberostar/i.test(rec.establecimiento)) return;
      if (savedDB[rec.establecimiento]?.excluir_d02 || /restaurante|restaurant|\bbar\b/i.test(nomL)) return;

      // A02: siempre implica D02 (cualquier zona y mes)
      // A01 en Canarias: siempre D02
      // A01 en Baleares/Península: solo Mayo–Octubre (índices 4–9)
      if (isA01 && rec.nodo !== 'Islas Canarias') {
        const mesIdx = MES_ORDEN.indexOf(rec.mes);
        if (mesIdx < 4 || mesIdx > 9) return;
      }

      const key = d02Key(rec);
      if (d02Keys.has(key)) return;
      d02Keys.add(key);
      const pisc = savedDB[rec.establecimiento]?.piscinas || null;
      d02Auto.push({
        ...rec,
        disciplina: 'D02 - Piscinas',
        muestras_estimadas: pisc,
        estado_estimacion: pisc ? `Piscinas (histórico: ${pisc})` : 'SIN DATOS PISCINAS',
      });
    });

    // Deduplicar d02Auto por clave Supabase (establecimiento+mes+año+disciplina) — un D02 por mes
    const d02MonthSeen = new Set();
    const d02AutoFinal = d02Auto.filter(r => {
      const k = `${r.establecimiento}|${r.mes}|${r.año}`;
      if (d02MonthSeen.has(k)) return false;
      d02MonthSeen.add(k);
      return true;
    });

    const allRecords = [...records, ...d02AutoFinal];
    const { data, error: err } = await supabase
      .from('legionella_actividades')
      .upsert(allRecords, { onConflict: 'establecimiento,mes,año,disciplina', ignoreDuplicates: false })
      .select('id');

    setImporting(false);
    if (err) { setError(err.message); return; }
    setResult({ total: records.length, d02Auto: d02Auto.length, upserted: data?.length || allRecords.length });
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
                {result.total} actividades procesadas.
                {result.d02Auto > 0 && (
                  <div style={{ marginTop:'8px',padding:'8px 12px',backgroundColor:'#E0F2FE',border:'1px solid #7DD3FC',borderRadius:'8px',color:'#0369A1',fontWeight:600 }}>
                    + {result.d02Auto} D02 (piscinas) generados automáticamente para A01 en Baleares ≥ Mayo y Canarias
                  </div>
                )}
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

export default function LegionellaForecastModule({ onBackToHub, globalLab }) {
  const isCanariasMode = globalLab === 'HSLAB Canarias';
  const [actividades, setActividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedDB, setSavedDB] = useState({});
  const [manualInputs, setManualInputs] = useState({});
  const [savingStates, setSavingStates] = useState({});
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState('calendario');
  const [activeCategories, setActiveCategories] = useState(new Set(['d3']));

  const toggleCategory = (cat) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
    setFilters(DEFAULT_FILTERS);
  };
  const [selectedMes, setSelectedMes] = useState(null); // { mes, año }
  const [showImport, setShowImport] = useState(false);
  const [showPendientes, setShowPendientes] = useState(false);
  const saveTimers = useRef({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: acts }, { data: estabs }] = await Promise.all([
      supabase.from('legionella_actividades').select('*').order('fecha_date', { ascending: true }),
      supabase.from('legionella_establecimientos').select('nombre, habitaciones, zonas_comunes, piscinas, solo_auditoria, excluir_d02'),
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

  const handleSaveHabitacionesManual = useCallback(async (establecimiento, habitaciones, zonasComunes) => {
    setSavingStates(s => ({ ...s, [establecimiento]: 'saving' }));
    const { error } = await supabase.from('legionella_establecimientos').upsert(
      { nombre: establecimiento, habitaciones: parseInt(habitaciones) || 0, zonas_comunes: parseInt(zonasComunes || 0) || 0 },
      { onConflict: 'nombre' }
    );
    if (error) {
      setSavingStates(s => ({ ...s, [establecimiento]: 'error' }));
    } else {
      const calc = calcPorNormativa(habitaciones, zonasComunes || 0);
      setSavedDB(prev => ({ ...prev, [establecimiento]: { habitaciones: parseInt(habitaciones), zonas_comunes: parseInt(zonasComunes || 0) } }));
      if (calc) {
        await supabase.from('legionella_actividades')
          .update({ muestras_estimadas: calc.total, estado_estimacion: 'RD 487/2022 (guardado)' })
          .eq('establecimiento', establecimiento)
          .is('muestras_estimadas', null);
        setActividades(prev => prev.map(a =>
          a.establecimiento === establecimiento && !a.muestras_estimadas
            ? { ...a, muestras_estimadas: calc.total, estado_estimacion: 'RD 487/2022 (guardado)' }
            : a
        ));
      }
      setSavingStates(s => ({ ...s, [establecimiento]: 'saved' }));
      setTimeout(() => setSavingStates(s => ({ ...s, [establecimiento]: null })), 3000);
    }
  }, []);

  const handleSavePiscinas = useCallback(async (establecimiento, piscinas) => {
    setSavingStates(s => ({ ...s, [establecimiento]: 'saving' }));
    const { error } = await supabase.from('legionella_establecimientos').upsert(
      { nombre: establecimiento, piscinas },
      { onConflict: 'nombre' }
    );
    if (error) {
      setSavingStates(s => ({ ...s, [establecimiento]: 'error' }));
    } else {
      setSavedDB(prev => ({ ...prev, [establecimiento]: { ...(prev[establecimiento] || {}), piscinas } }));
      await supabase.from('legionella_actividades')
        .update({ muestras_estimadas: piscinas, estado_estimacion: `Piscinas (histórico: ${piscinas})` })
        .eq('establecimiento', establecimiento)
        .eq('estado_estimacion', 'SIN DATOS PISCINAS');
      setActividades(prev => prev.map(a =>
        a.establecimiento === establecimiento && a.estado_estimacion === 'SIN DATOS PISCINAS'
          ? { ...a, muestras_estimadas: piscinas, estado_estimacion: `Piscinas (histórico: ${piscinas})` }
          : a
      ));
      setSavingStates(s => ({ ...s, [establecimiento]: 'saved' }));
      setTimeout(() => setSavingStates(s => ({ ...s, [establecimiento]: null })), 3000);
    }
  }, []);

  const handleBorrarProgramacion = useCallback(async () => {
    if (!selectedMes) return;
    const label = `${selectedMes.mes.charAt(0).toUpperCase() + selectedMes.mes.slice(1)} ${selectedMes.año}`;
    if (!confirm(`¿Eliminar TODA la programación de ${label}?\n\nEsta acción borrará todas las actividades del mes y no se puede deshacer.`)) return;
    const { error } = await supabase
      .from('legionella_actividades')
      .delete()
      .eq('mes', selectedMes.mes)
      .eq('año', selectedMes.año);
    if (error) { alert('Error al borrar: ' + error.message); return; }
    setSelectedMes(null);
    setActiveCategories(new Set(['d3']));
    setFilters(DEFAULT_FILTERS);
    loadData();
  }, [selectedMes, loadData]);

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

  // Filter by selected month first (+ nodo scope for Canarias mode), then by active tab, then by user filters
  const baseActs = useMemo(() => {
    if (!selectedMes) return [];
    let acts = actividades.filter(a => a.mes === selectedMes.mes && a.año === selectedMes.año);
    if (isCanariasMode) acts = acts.filter(a => a.nodo === 'Islas Canarias');
    return acts;
  }, [actividades, selectedMes, isCanariasMode]);

  const tabActs = useMemo(() =>
    baseActs.filter(a => activeCategories.has(getDisciplinaCategoria(a.disciplina))),
    [baseActs, activeCategories]
  );

  const filteredActs = useMemo(() => applyFilters(tabActs, filters), [tabActs, filters]);

  const sinFechaData = useMemo(() => {
    const acts = baseActs.filter(a => !a.fechaDate || a.fechaDate.getFullYear() < 2000);
    return { count: acts.length, muestras: acts.reduce((s,a) => s + (a.muestras_estimadas||0), 0) };
  }, [baseActs]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    TABS_ORDER.forEach(k => { counts[k] = 0; });
    baseActs.forEach(a => { const c = getDisciplinaCategoria(a.disciplina); counts[c] = (counts[c] || 0) + 1; });
    return counts;
  }, [baseActs]);

  const calMesAno = useMemo(() => {
    if (selectedMes) return { mes: MES_ORDEN.indexOf(selectedMes.mes) + 1, año: selectedMes.año };
    const a = tabActs.find(x => x.fechaDate);
    return a ? { mes: a.fechaDate.getMonth()+1, año: a.fechaDate.getFullYear() } : null;
  }, [tabActs, selectedMes]);

  const sinHistoricoPendientes = tabActs.filter(a =>
    ['d3','d3bis'].includes(getDisciplinaCategoria(a.disciplina)) &&
    (!a.estado_estimacion || a.estado_estimacion === 'SIN HISTÓRICO')
  );
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
          {selectedMes && (
            <button onClick={handleBorrarProgramacion} style={{ display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',backgroundColor:'white',border:'1px solid #FCA5A5',borderRadius:'8px',cursor:'pointer',fontSize:'0.88rem',fontWeight:600,color:'#DC2626' }}>
              <Trash2 size={14}/> Borrar programación
            </button>
          )}
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
                return <button key={`${m.mes}-${m.año}`} onClick={()=>{setSelectedMes(m);setFilters(DEFAULT_FILTERS);setActiveCategories(new Set(['d3']));}} style={{ padding:'6px 14px',borderRadius:'20px',border:`1.5px solid ${isActive?'var(--primary)':'var(--border)'}`,cursor:'pointer',fontWeight:isActive?700:500,fontSize:'0.85rem',backgroundColor:isActive?'var(--primary)':'white',color:isActive?'white':'var(--text-muted)',transition:'all 0.15s' }}>{label}</button>;
              })}
            </div>

            {/* Tabs + View toggle */}
            <div style={{ display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px',flexWrap:'wrap' }}>
              <div style={{ display:'flex',gap:'6px',alignItems:'center',flexWrap:'wrap' }}>
                {TABS_ORDER.filter(k => categoryCounts[k] > 0).map(k => {
                  const cfg = TABS_CONFIG[k];
                  const active = activeCategories.has(k);
                  return (
                    <button key={k} onClick={() => toggleCategory(k)} style={{ display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',borderRadius:'8px',border:`2px solid ${active?cfg.color:'var(--border)'}`,cursor:'pointer',fontWeight:600,fontSize:'0.88rem',backgroundColor:active?cfg.color:'white',color:active?'white':'var(--text-muted)',transition:'all 0.15s',boxShadow:active?`0 2px 8px ${cfg.color}33`:'none' }}>
                      {active && <span style={{fontSize:'0.8rem'}}>✓</span>}
                      {cfg.label} <span style={{ fontSize:'0.78rem',opacity:0.75,fontWeight:500 }}>({categoryCounts[k]})</span>
                    </button>
                  );
                })}
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

            <ResumenNodos actividades={filteredActs} allActs={tabActs} sinFechaData={sinFechaData} filters={filters} onFiltersChange={setFilters} onPendientesClick={() => setShowPendientes(true)} nodosVisibles={isCanariasMode ? ['Islas Canarias'] : NODOS_ORDEN}/>

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
              <MonthlyCalendar actividades={filteredActs} año={calMesAno.año} mes={calMesAno.mes} savedDB={savedDB} onSaveHabitaciones={handleSaveHabitacionesManual} onSavePiscinas={handleSavePiscinas} savingStates={savingStates}/>
            )}
          </div>
        )}
      </main>

      {showImport&&<ImportModal onClose={()=>setShowImport(false)} onImported={loadData} savedDB={savedDB}/>}
      {showPendientes&&<PendientesModal actividades={tabActs} savedDB={savedDB} onSave={handleSaveHabitacionesManual} onClose={()=>{ setShowPendientes(false); loadData(); }}/>}
    </div>
  );
}
