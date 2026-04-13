import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Upload, Download, FileText, AlertCircle, CheckCircle, RefreshCw, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import { HISTORICO_LEGIONELLA } from './legionellaHistorico';

// ─── Constants ───────────────────────────────────────────────────────────────

const MES_A_TRIMESTRE = {
  'enero': 'Q1', 'febrero': 'Q1', 'marzo': 'Q1',
  'abril': 'Q2', 'mayo': 'Q2', 'junio': 'Q2',
  'julio': 'Q3', 'agosto': 'Q3', 'septiembre': 'Q3',
  'octubre': 'Q4', 'noviembre': 'Q4', 'diciembre': 'Q4',
};

const REGION_A_NODO = {
  'Islas Baleares': 'Islas Baleares',
  'Islas Canarias': 'Islas Canarias',
  'Cataluña': 'Zona Cataluña',
  'Tarragona': 'Zona Cataluña',
  'Lérida': 'Zona Cataluña',
  'Girona': 'Zona Cataluña',
  'Valencia': 'Zona Levante',
  'Alicante': 'Zona Levante',
  'Murcia': 'Zona Levante',
  'Andalucía': 'Zona Andalucía',
  'Madrid': 'Zona Madrid (Centro/Norte)',
  'Navarra': 'Zona Madrid (Centro/Norte)',
  'País Vasco': 'Zona Madrid (Centro/Norte)',
  'Aragón': 'Zona Madrid (Centro/Norte)',
  'La Rioja': 'Zona Madrid (Centro/Norte)',
  'Castilla y León': 'Zona Madrid (Centro/Norte)',
  'Castilla-La Mancha': 'Zona Madrid (Centro/Norte)',
  'Extremadura': 'Zona Madrid (Centro/Norte)',
  'Asturias': 'Zona Madrid (Centro/Norte)',
  'Cantabria': 'Zona Madrid (Centro/Norte)',
  'Galicia': 'Zona Madrid (Centro/Norte)',
};

const NODOS_ORDEN = [
  'Islas Baleares',
  'Islas Canarias',
  'Zona Cataluña',
  'Zona Levante',
  'Zona Andalucía',
  'Zona Madrid (Centro/Norte)',
];

const NODO_COLORS = {
  'Islas Baleares':             { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8' },
  'Islas Canarias':             { bg: '#FFF7ED', border: '#F97316', text: '#C2410C' },
  'Zona Cataluña':              { bg: '#F0FDF4', border: '#22C55E', text: '#15803D' },
  'Zona Levante':               { bg: '#FEFCE8', border: '#EAB308', text: '#A16207' },
  'Zona Andalucía':             { bg: '#FDF4FF', border: '#A855F7', text: '#7E22CE' },
  'Zona Madrid (Centro/Norte)': { bg: '#FFF1F2', border: '#F43F5E', text: '#BE123C' },
};

// Tabla 2 Anexo V RD 487/2022 modificada por RD 614/2024
// Puntos terminales → { acs, afch } muestras mínimas por circuito
const TABLA_MUESTRAS = [
  { max: 10,  acs: 1, afch: 1 },
  { max: 20,  acs: 3, afch: 1 },
  { max: 50,  acs: 4, afch: 1 },
  { max: 100, acs: 4, afch: 2 },
  { max: 200, acs: 6, afch: 2 },
  { max: 350, acs: 8, afch: 3 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcularMuestrasPorPuntosTerminales(puntos) {
  for (const tramo of TABLA_MUESTRAS) {
    if (puntos <= tramo.max) return { acs: tramo.acs, afch: tramo.afch };
  }
  // > 350: proporcional — 1 muestra ACS extra por cada 50 puntos adicionales
  // y 1 muestra AFCH extra por cada 100 puntos adicionales (por encima de 350)
  const exceso = puntos - 350;
  const extraAcs = Math.ceil(exceso / 50);
  const extraAfch = Math.ceil(exceso / 100);
  return { acs: 8 + extraAcs, afch: 3 + extraAfch };
}

function calcularPorNormativa(habitaciones, zonasComunes = 0) {
  const hab = parseInt(habitaciones) || 0;
  const zc = parseInt(zonasComunes) || 0;
  if (hab === 0) return null;
  const puntos = hab + zc;
  const { acs, afch } = calcularMuestrasPorPuntosTerminales(puntos);
  return { puntos, acs, afch, total: acs + afch };
}

function normalizeName(name) {
  return String(name)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/["""'']/g, '');
}

const HISTORICO_INDEX = {};
for (const [key, val] of Object.entries(HISTORICO_LEGIONELLA)) {
  HISTORICO_INDEX[normalizeName(key)] = { originalKey: key, ...val };
}

function buscarHistorico(nombre) {
  const norm = normalizeName(nombre);
  if (HISTORICO_INDEX[norm]) return HISTORICO_INDEX[norm];
  for (const [k, v] of Object.entries(HISTORICO_INDEX)) {
    if (norm.includes(k) || k.includes(norm)) return v;
  }
  return null;
}

function calcularPromedio(hist) {
  const vals = [hist.Q1, hist.Q2, hist.Q3, hist.Q4].filter(v => v > 0);
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function calcularMuestrasEstimadas(nombre, mes) {
  const hist = buscarHistorico(nombre);
  if (!hist) return { muestras: null, estado: 'SIN HISTÓRICO' };
  const trimestre = MES_A_TRIMESTRE[mes.toLowerCase()] || 'Q1';
  const valorTrimestre = hist[trimestre];
  if (valorTrimestre > 0) return { muestras: valorTrimestre, estado: 'OK', trimestre };
  const promedio = calcularPromedio(hist);
  if (promedio > 0) return { muestras: promedio, estado: 'OK (PROMEDIO)', trimestre };
  return { muestras: null, estado: 'SIN HISTÓRICO' };
}

function parsearCSV(texto) {
  const lineas = texto.split('\n').filter(l => l.trim());
  if (lineas.length < 2) return [];
  const sep = lineas[0].includes(';') ? ';' : ',';
  const parseRow = (line) => {
    const result = [];
    let inQuotes = false, current = '';
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === sep && !inQuotes) { result.push(current.trim()); current = ''; }
      else current += ch;
    }
    result.push(current.trim());
    return result;
  };
  const headers = parseRow(lineas[0]).map(h => h.toLowerCase().trim());
  return lineas.slice(1).reduce((acc, linea) => {
    const cols = parseRow(linea);
    if (cols.length < 7) return acc;
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i] || ''; });
    acc.push(row);
    return acc;
  }, []);
}

function procesarActividades(rows) {
  return rows.map(row => {
    const establecimiento = row['establecimiento'] || '';
    const mes = row['mes'] || '';
    const region = (row['región'] || row['region'] || '').trim();
    const { muestras, estado, trimestre } = calcularMuestrasEstimadas(establecimiento, mes);
    return {
      establecimiento,
      grupo: row['grupo'] || '',
      region,
      nodo: REGION_A_NODO[region] || 'Sin clasificar',
      disciplina: row['disciplina'] || '',
      auditor: row['auditor'] || '',
      jornada: parseFloat(row['jornada'] || 0),
      fecha: row['fecha'] || '',
      mes,
      muestras,
      estado,
      trimestre,
    };
  });
}

// Merge manual inputs into actividades — returns new array with effective muestras
function getEffectiveActs(actividades, manualInputs) {
  return actividades.map(act => {
    if (act.estado !== 'SIN HISTÓRICO') return act;
    const inp = manualInputs[act.establecimiento];
    if (!inp?.habitaciones) return act;
    const calc = calcularPorNormativa(inp.habitaciones, inp.zonasComunes || 0);
    if (!calc) return act;
    return {
      ...act,
      muestras: calc.total,
      estado: 'RD 487/2022',
      _normativa: calc,
    };
  });
}

function agruparPorNodo(actividades) {
  const resumen = {};
  for (const nodo of NODOS_ORDEN) resumen[nodo] = { nodo, count: 0, muestras: 0 };
  resumen['Sin clasificar'] = { nodo: 'Sin clasificar', count: 0, muestras: 0 };
  for (const act of actividades) {
    if (!resumen[act.nodo]) resumen[act.nodo] = { nodo: act.nodo, count: 0, muestras: 0 };
    resumen[act.nodo].count++;
    resumen[act.nodo].muestras += act.muestras || 0;
  }
  return resumen;
}

function exportarExcel(effectiveD3, effectiveD3bis, mesAno) {
  const wb = XLSX.utils.book_new();
  const toSheet = (actividades, titulo) => {
    const resumen = agruparPorNodo(actividades);
    const wsData = [
      [titulo], [],
      ['RESUMEN POR NODO LOGÍSTICO'],
      ['Nodo Logístico', 'Establecimientos', 'Envases Previstos'],
      ...NODOS_ORDEN.map(n => [n, resumen[n]?.count || 0, resumen[n]?.muestras || 0]),
      [],
      ['TOTAL GENERAL', actividades.length, actividades.reduce((s, a) => s + (a.muestras || 0), 0)],
      [], [],
      ['DETALLE DE ACTIVIDADES'],
      ['Establecimiento', 'Grupo', 'Región', 'Nodo Logístico', 'Disciplina', 'Auditor', 'Jornada', 'Fecha', 'Muestras Estimadas', 'Fuente / Estado'],
      ...actividades.map(a => [
        a.establecimiento, a.grupo, a.region, a.nodo, a.disciplina,
        a.auditor, a.jornada, a.fecha,
        a.muestras ?? 'PENDIENTE',
        a.estado === 'RD 487/2022'
          ? `RD 487/2022 (${a._normativa?.puntos} pts: ${a._normativa?.acs} ACS + ${a._normativa?.afch} AFCH)`
          : a.estado,
      ]),
    ];
    return XLSX.utils.aoa_to_sheet(wsData);
  };
  if (effectiveD3.length > 0) XLSX.utils.book_append_sheet(wb, toSheet(effectiveD3, `Previsión D3 - Muestreo Legionella - ${mesAno}`), 'D3 - Muestreo');
  if (effectiveD3bis.length > 0) XLSX.utils.book_append_sheet(wb, toSheet(effectiveD3bis, `Previsión D3bis - Remuestreo Legionella - ${mesAno}`), 'D3bis - Remuestreo');
  XLSX.writeFile(wb, `Prevision_Legionella_${mesAno.replace(/\s/g, '_')}.xlsx`);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ResumenNodos({ actividades }) {
  const resumen = agruparPorNodo(actividades);
  const total = actividades.reduce((s, a) => s + (a.muestras || 0), 0);
  const pendientes = actividades.filter(a => a.estado === 'SIN HISTÓRICO').length;

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--secondary)', margin: 0 }}>
          Resumen por Nodo Logístico
        </h3>
        {pendientes > 0 && (
          <span style={{ fontSize: '0.78rem', backgroundColor: '#FFFBEB', color: '#D97706', border: '1px solid #FCD34D', borderRadius: '20px', padding: '2px 10px', fontWeight: 600 }}>
            {pendientes} pendiente{pendientes > 1 ? 's' : ''} de datos
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {NODOS_ORDEN.map(nodo => {
          const d = resumen[nodo];
          const c = NODO_COLORS[nodo];
          return (
            <div key={nodo} style={{ backgroundColor: c.bg, border: `1.5px solid ${c.border}`, borderRadius: '10px', padding: '12px 16px', minWidth: '160px', flex: '1 1 160px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: c.text, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{nodo}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: c.text }}>{d?.muestras || 0}</div>
              <div style={{ fontSize: '0.75rem', color: c.text, opacity: 0.7 }}>{d?.count || 0} establec.</div>
            </div>
          );
        })}
        {resumen['Sin clasificar']?.count > 0 && (
          <div style={{ backgroundColor: '#f8f9fa', border: '1.5px solid #dee2e6', borderRadius: '10px', padding: '12px 16px', minWidth: '160px', flex: '1 1 160px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6c757d', marginBottom: '4px', textTransform: 'uppercase' }}>Sin clasificar</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6c757d' }}>{resumen['Sin clasificar'].muestras}</div>
            <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>{resumen['Sin clasificar'].count} establec.</div>
          </div>
        )}
      </div>
      <div style={{ backgroundColor: 'var(--secondary)', color: 'white', borderRadius: '10px', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700 }}>TOTAL GENERAL</span>
        <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{total} envases</span>
        <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>{actividades.length} establecimientos</span>
      </div>
    </div>
  );
}

function TablaActividades({ actividades, manualInputs, onInputChange }) {
  const [sortField, setSortField] = useState('nodo');
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = [...actividades].sort((a, b) => {
    const va = a[sortField] ?? '';
    const vb = b[sortField] ?? '';
    return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  const handleSort = (field) => {
    if (sortField === field) setSortAsc(s => !s);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }) => (
    <span style={{ marginLeft: '4px', opacity: sortField === field ? 1 : 0.3 }}>
      {sortField === field ? (sortAsc ? '↑' : '↓') : '↕'}
    </span>
  );

  const th = { padding: '10px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'white', backgroundColor: 'var(--secondary)', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' };

  return (
    <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
        <thead>
          <tr>
            {[['nodo','Nodo Logístico'],['establecimiento','Establecimiento'],['grupo','Grupo'],['auditor','Auditor'],['fecha','Fecha'],['muestras','Muestras Est.'],['estado','Fuente']].map(([f, l]) => (
              <th key={f} style={th} onClick={() => handleSort(f)}>{l}<SortIcon field={f} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((act, idx) => {
            const c = NODO_COLORS[act.nodo] || { bg: '#f8f9fa', border: '#dee2e6', text: '#495057' };
            const sinHist = act.estado === 'SIN HISTÓRICO';
            const porNorm = act.estado === 'RD 487/2022';
            const inp = manualInputs[act.establecimiento] || {};
            const preview = sinHist && inp.habitaciones ? calcularPorNormativa(inp.habitaciones, inp.zonasComunes || 0) : null;

            return (
              <React.Fragment key={idx}>
                <tr style={{ backgroundColor: sinHist ? '#FFFBEB' : (idx % 2 === 0 ? '#fff' : '#f9fafb'), borderBottom: sinHist ? 'none' : '1px solid var(--border)' }}>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '6px', padding: '2px 7px', fontSize: '0.72rem', fontWeight: 600 }}>{act.nodo}</span>
                  </td>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--secondary)' }}>{act.establecimiento}</td>
                  <td style={{ padding: '9px 12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{act.grupo}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{act.auditor}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{act.fecha}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, fontSize: '1rem', color: sinHist ? '#D97706' : 'var(--secondary)' }}>
                    {sinHist ? (preview ? `${preview.total}*` : '—') : act.muestras}
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    {sinHist ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#D97706', fontSize: '0.75rem', fontWeight: 600 }}>
                        <AlertCircle size={12} /> SIN HISTÓRICO
                      </span>
                    ) : porNorm ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0891B2', fontSize: '0.75rem', fontWeight: 600 }}>
                        <Info size={12} /> RD 487/2022
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16A34A', fontSize: '0.75rem', fontWeight: 600 }}>
                        <CheckCircle size={12} /> {act.estado}
                      </span>
                    )}
                  </td>
                </tr>
                {sinHist && (
                  <tr style={{ backgroundColor: '#FFFBEB', borderBottom: '1px solid var(--border)' }}>
                    <td colSpan={7} style={{ padding: '6px 12px 12px 40px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', color: '#92400E', fontWeight: 600 }}>
                          Cálculo según RD 487/2022:
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#92400E' }}>
                          Habitaciones
                          <input
                            type="number"
                            min="0"
                            value={inp.habitaciones || ''}
                            onChange={e => onInputChange(act.establecimiento, 'habitaciones', e.target.value)}
                            placeholder="Nº hab."
                            style={{ width: '80px', padding: '4px 8px', border: '1.5px solid #FCD34D', borderRadius: '6px', fontSize: '0.82rem', backgroundColor: 'white', outline: 'none' }}
                          />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#92400E' }}>
                          Zonas comunes
                          <input
                            type="number"
                            min="0"
                            value={inp.zonasComunes || ''}
                            onChange={e => onInputChange(act.establecimiento, 'zonasComunes', e.target.value)}
                            placeholder="Puntos extra"
                            style={{ width: '100px', padding: '4px 8px', border: '1.5px solid #FCD34D', borderRadius: '6px', fontSize: '0.82rem', backgroundColor: 'white', outline: 'none' }}
                          />
                        </label>
                        {preview && (
                          <span style={{ fontSize: '0.8rem', color: '#0369A1', backgroundColor: '#E0F2FE', border: '1px solid #7DD3FC', borderRadius: '6px', padding: '3px 10px', fontWeight: 600 }}>
                            {preview.puntos} puntos terminales → {preview.acs} ACS + {preview.afch} AFCH = <strong>{preview.total} muestras</strong>
                          </span>
                        )}
                        {!preview && inp.habitaciones && (
                          <span style={{ fontSize: '0.78rem', color: '#DC2626' }}>Introduce un número válido</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {actividades.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No hay actividades para esta categoría.</div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LegionellaForecastModule({ onBackToHub }) {
  const [csvData, setCsvData] = useState(null);
  const [d3, setD3] = useState([]);
  const [d3bis, setD3bis] = useState([]);
  const [mesAno, setMesAno] = useState('');
  const [activeTab, setActiveTab] = useState('d3');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const [manualInputs, setManualInputs] = useState({});
  const fileInputRef = useRef(null);

  const handleInputChange = useCallback((establecimiento, field, value) => {
    setManualInputs(prev => ({
      ...prev,
      [establecimiento]: { ...prev[establecimiento], [field]: value },
    }));
  }, []);

  const processFile = useCallback((file) => {
    if (!file || !file.name.endsWith('.csv')) { setError('Por favor, sube un archivo CSV.'); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parsearCSV(e.target.result);
      if (rows.length === 0) { setError('El CSV no contiene datos válidos.'); return; }
      const allActs = procesarActividades(rows);
      const d3Acts = allActs.filter(a => !a.disciplina.toLowerCase().includes('d3bis') && !a.disciplina.toLowerCase().includes('remuestreo'));
      const d3bisActs = allActs.filter(a => a.disciplina.toLowerCase().includes('d3bis') || a.disciplina.toLowerCase().includes('remuestreo'));
      const mes = rows[0]['mes'] || '';
      const ano = rows[0]['año'] || rows[0]['ano'] || '';
      setMesAno(`${mes} ${ano}`);
      setD3(d3bisActs.length === 0 ? allActs : d3Acts);
      setD3bis(d3bisActs);
      setCsvData(rows);
      setManualInputs({});
      setActiveTab('d3');
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const handleReset = () => { setCsvData(null); setD3([]); setD3bis([]); setMesAno(''); setError(null); setManualInputs({}); };

  const baseActs = activeTab === 'd3' ? d3 : d3bis;
  const effectiveActs = getEffectiveActs(baseActs, manualInputs);
  const sinHistoricoPendientes = effectiveActs.filter(a => a.estado === 'SIN HISTÓRICO');
  const efectiveD3 = getEffectiveActs(d3, manualInputs);
  const efectiveD3bis = getEffectiveActs(d3bis, manualInputs);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--background)' }}>
      <header style={{ height: '64px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 32px', gap: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <button onClick={onBackToHub} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.9rem' }}>
          <ArrowLeft size={18} /> Portal
        </button>
        <div style={{ width: '1px', height: '28px', backgroundColor: 'var(--border)' }} />
        <div>
          <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--secondary)' }}>Previsión Mensual Legionella</h1>
          {mesAno && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{mesAno}</span>}
        </div>
        {csvData && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
            <button onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              <RefreshCw size={14} /> Nuevo CSV
            </button>
            <button
              onClick={() => exportarExcel(efectiveD3, efectiveD3bis, mesAno)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700 }}
            >
              <Download size={14} /> Exportar Excel
            </button>
          </div>
        )}
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        {!csvData ? (
          <div style={{ maxWidth: '600px', margin: '60px auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <FileText size={36} color="var(--primary)" />
              </div>
              <h2 style={{ color: 'var(--secondary)', margin: '0 0 8px', fontSize: '1.5rem' }}>Previsión Mensual Legionella</h2>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Sube el fichero de actividades CSV para calcular automáticamente los envases previstos por nodo logístico.
              </p>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files[0]); }}
              onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '14px', padding: '48px 32px', textAlign: 'center', cursor: 'pointer', backgroundColor: isDragging ? '#EFF6FF' : 'white', transition: 'all 0.2s ease' }}
            >
              <Upload size={28} color={isDragging ? 'var(--primary)' : 'var(--text-muted)'} style={{ marginBottom: '12px' }} />
              <p style={{ color: isDragging ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, margin: '0 0 6px' }}>Arrastra el fichero CSV aquí</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>o haz clic para seleccionar — separado por punto y coma (;)</p>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={e => processFile(e.target.files[0])} style={{ display: 'none' }} />
            </div>
            {error && (
              <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}
            <div style={{ marginTop: '24px', backgroundColor: 'white', borderRadius: '10px', border: '1px solid var(--border)', padding: '16px 20px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--secondary)' }}>Columnas requeridas en el CSV:</p>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                Mes · Año · Establecimiento · Grupo · País · Región · Disciplina · Jornada · Auditor · Fecha · Auditoría
              </p>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', backgroundColor: 'white', borderRadius: '10px', padding: '4px', border: '1px solid var(--border)', width: 'fit-content' }}>
              {[{ key: 'd3', label: `D3 – Muestreo (${d3.length})` }, ...(d3bis.length > 0 ? [{ key: 'd3bis', label: `D3bis – Remuestreo (${d3bis.length})` }] : [])].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: '8px 20px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', backgroundColor: activeTab === tab.key ? 'var(--primary)' : 'transparent', color: activeTab === tab.key ? 'white' : 'var(--text-muted)', transition: 'all 0.15s' }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {sinHistoricoPendientes.length > 0 && (
              <div style={{ marginBottom: '20px', padding: '12px 16px', backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertCircle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <span style={{ fontWeight: 700, color: '#92400E' }}>
                    {sinHistoricoPendientes.length} establecimiento{sinHistoricoPendientes.length > 1 ? 's' : ''} sin histórico —
                  </span>
                  <span style={{ color: '#92400E', fontSize: '0.86rem' }}> introduce el nº de habitaciones en la fila correspondiente para calcular según RD 487/2022.</span>
                </div>
              </div>
            )}

            <ResumenNodos actividades={effectiveActs} />
            <TablaActividades
              actividades={effectiveActs}
              manualInputs={manualInputs}
              onInputChange={handleInputChange}
            />
          </div>
        )}
      </main>
    </div>
  );
}
