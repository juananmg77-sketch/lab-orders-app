import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Upload, Download, FileText, AlertCircle, CheckCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
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
  'Islas Baleares':          { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8' },
  'Islas Canarias':          { bg: '#FFF7ED', border: '#F97316', text: '#C2410C' },
  'Zona Cataluña':           { bg: '#F0FDF4', border: '#22C55E', text: '#15803D' },
  'Zona Levante':            { bg: '#FEFCE8', border: '#EAB308', text: '#A16207' },
  'Zona Andalucía':          { bg: '#FDF4FF', border: '#A855F7', text: '#7E22CE' },
  'Zona Madrid (Centro/Norte)': { bg: '#FFF1F2', border: '#F43F5E', text: '#BE123C' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeName(name) {
  return String(name)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/["""'']/g, '');
}

// Build normalized lookup index once
const HISTORICO_INDEX = {};
for (const [key, val] of Object.entries(HISTORICO_LEGIONELLA)) {
  HISTORICO_INDEX[normalizeName(key)] = { originalKey: key, ...val };
}

function buscarHistorico(nombreEstablecimiento) {
  const norm = normalizeName(nombreEstablecimiento);
  // Exact normalized match
  if (HISTORICO_INDEX[norm]) return HISTORICO_INDEX[norm];
  // Partial match (establishment name contains historico key or vice-versa)
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

function calcularMuestrasEstimadas(nombreEstablecimiento, mes) {
  const hist = buscarHistorico(nombreEstablecimiento);
  if (!hist) return { muestras: null, estado: 'SIN HISTÓRICO', hist: null };

  const trimestre = MES_A_TRIMESTRE[mes.toLowerCase()] || 'Q1';
  const valorTrimestre = hist[trimestre];

  if (valorTrimestre > 0) {
    return { muestras: valorTrimestre, estado: 'OK', trimestre, hist };
  }
  // Fallback: promedio
  const promedio = calcularPromedio(hist);
  if (promedio > 0) {
    return { muestras: promedio, estado: 'OK (PROMEDIO)', trimestre, hist };
  }
  return { muestras: null, estado: 'SIN HISTÓRICO', hist };
}

function parsearCSV(texto) {
  const lineas = texto.split('\n').filter(l => l.trim());
  if (lineas.length < 2) return [];

  // Detect separator
  const sep = lineas[0].includes(';') ? ';' : ',';

  const parseRow = (line) => {
    const result = [];
    let inQuotes = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === sep && !inQuotes) { result.push(current.trim()); current = ''; }
      else current += ch;
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lineas[0]).map(h => h.toLowerCase().trim());
  const rows = [];
  for (let i = 1; i < lineas.length; i++) {
    const cols = parseRow(lineas[i]);
    if (cols.length < 7) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

function procesarActividades(rows) {
  return rows.map(row => {
    const establecimiento = row['establecimiento'] || '';
    const mes = row['mes'] || '';
    const region = (row['región'] || row['region'] || '').trim();
    const disciplina = row['disciplina'] || '';
    const auditor = row['auditor'] || '';
    const grupo = row['grupo'] || '';
    const jornada = parseFloat(row['jornada'] || 0);
    const fecha = row['fecha'] || '';

    const { muestras, estado, trimestre } = calcularMuestrasEstimadas(establecimiento, mes);
    const nodo = REGION_A_NODO[region] || 'Sin clasificar';

    return {
      establecimiento,
      grupo,
      region,
      nodo,
      disciplina,
      auditor,
      jornada,
      fecha,
      mes,
      muestras,
      estado,
      trimestre,
    };
  });
}

function agruparPorNodo(actividades) {
  const resumen = {};
  for (const nodo of NODOS_ORDEN) {
    resumen[nodo] = { nodo, count: 0, muestras: 0 };
  }
  resumen['Sin clasificar'] = { nodo: 'Sin clasificar', count: 0, muestras: 0 };

  for (const act of actividades) {
    if (!resumen[act.nodo]) resumen[act.nodo] = { nodo: act.nodo, count: 0, muestras: 0 };
    resumen[act.nodo].count++;
    resumen[act.nodo].muestras += act.muestras || 0;
  }
  return resumen;
}

function exportarExcel(d3, d3bis, mesAno) {
  const wb = XLSX.utils.book_new();

  const toSheet = (actividades, titulo) => {
    const resumen = agruparPorNodo(actividades);
    const filasSummary = [
      ['NODO LOGÍSTICO', 'Establecimientos', 'Envases Previstos'],
      ...NODOS_ORDEN.map(n => [n, resumen[n]?.count || 0, resumen[n]?.muestras || 0]),
      [],
      ['TOTAL GENERAL', actividades.length, actividades.reduce((s, a) => s + (a.muestras || 0), 0)],
    ];

    const filasDetalle = [
      ['Establecimiento', 'Grupo', 'Región', 'Nodo Logístico', 'Disciplina', 'Auditor', 'Jornada', 'Fecha', 'Muestras Estimadas', 'Estado'],
      ...actividades.map(a => [
        a.establecimiento, a.grupo, a.region, a.nodo, a.disciplina,
        a.auditor, a.jornada, a.fecha, a.muestras ?? 'REQUIERE AUDITORÍA',
        a.estado,
      ]),
    ];

    const wsData = [
      [titulo],
      [],
      ['RESUMEN POR NODO LOGÍSTICO'],
      ...filasSummary,
      [],
      ['DETALLE DE ACTIVIDADES'],
      ...filasDetalle,
    ];

    return XLSX.utils.aoa_to_sheet(wsData);
  };

  if (d3.length > 0) {
    const ws = toSheet(d3, `Previsión D3 - Muestreo Legionella - ${mesAno}`);
    XLSX.utils.book_append_sheet(wb, ws, 'D3 - Muestreo');
  }
  if (d3bis.length > 0) {
    const ws = toSheet(d3bis, `Previsión D3bis - Remuestreo Legionella - ${mesAno}`);
    XLSX.utils.book_append_sheet(wb, ws, 'D3bis - Remuestreo');
  }

  const fileName = `Prevision_Legionella_${mesAno.replace(/\s/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ResumenNodos({ actividades }) {
  const resumen = agruparPorNodo(actividades);
  const total = actividades.reduce((s, a) => s + (a.muestras || 0), 0);

  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--secondary)', marginBottom: '12px' }}>
        Resumen por Nodo Logístico
      </h3>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {NODOS_ORDEN.map(nodo => {
          const d = resumen[nodo];
          const c = NODO_COLORS[nodo] || { bg: '#f8f9fa', border: '#dee2e6', text: '#495057' };
          return (
            <div key={nodo} style={{
              backgroundColor: c.bg,
              border: `1.5px solid ${c.border}`,
              borderRadius: '10px',
              padding: '12px 18px',
              minWidth: '180px',
              flex: '1 1 180px',
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: c.text, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {nodo}
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: c.text }}>{d?.muestras || 0}</div>
              <div style={{ fontSize: '0.78rem', color: c.text, opacity: 0.75 }}>{d?.count || 0} establecimientos</div>
            </div>
          );
        })}
        {resumen['Sin clasificar']?.count > 0 && (
          <div style={{ backgroundColor: '#f8f9fa', border: '1.5px solid #dee2e6', borderRadius: '10px', padding: '12px 18px', minWidth: '180px', flex: '1 1 180px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6c757d', marginBottom: '6px' }}>SIN CLASIFICAR</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#6c757d' }}>{resumen['Sin clasificar'].muestras}</div>
            <div style={{ fontSize: '0.78rem', color: '#6c757d' }}>{resumen['Sin clasificar'].count} establecimientos</div>
          </div>
        )}
      </div>
      <div style={{
        backgroundColor: 'var(--secondary)',
        color: 'white',
        borderRadius: '10px',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontWeight: 700 }}>TOTAL GENERAL</span>
        <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{total} envases</span>
        <span style={{ opacity: 0.7 }}>{actividades.length} establecimientos</span>
      </div>
    </div>
  );
}

function TablaActividades({ actividades }) {
  const [expandedRows, setExpandedRows] = useState({});
  const [sortField, setSortField] = useState('nodo');
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = [...actividades].sort((a, b) => {
    const va = a[sortField] ?? '';
    const vb = b[sortField] ?? '';
    return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  const handleSort = (field) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
    return <span style={{ marginLeft: '4px' }}>{sortAsc ? '↑' : '↓'}</span>;
  };

  const thStyle = (field) => ({
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: '0.78rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'white',
    backgroundColor: 'var(--secondary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  });

  return (
    <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <thead>
          <tr>
            {[
              ['nodo', 'Nodo Logístico'],
              ['establecimiento', 'Establecimiento'],
              ['grupo', 'Grupo'],
              ['auditor', 'Auditor'],
              ['fecha', 'Fecha'],
              ['muestras', 'Muestras Est.'],
              ['estado', 'Estado'],
            ].map(([field, label]) => (
              <th key={field} style={thStyle(field)} onClick={() => handleSort(field)}>
                {label}<SortIcon field={field} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((act, idx) => {
            const c = NODO_COLORS[act.nodo] || { bg: '#f8f9fa', border: '#dee2e6', text: '#495057' };
            const sinHistorico = act.estado === 'SIN HISTÓRICO';
            const isEven = idx % 2 === 0;
            return (
              <tr key={idx} style={{
                backgroundColor: sinHistorico ? '#FFFBEB' : (isEven ? '#ffffff' : '#f9fafb'),
                borderBottom: '1px solid var(--border)',
              }}>
                <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                  <span style={{
                    backgroundColor: c.bg,
                    color: c.text,
                    border: `1px solid ${c.border}`,
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}>{act.nodo}</span>
                </td>
                <td style={{ padding: '9px 14px', fontWeight: 500, color: 'var(--secondary)' }}>
                  {act.establecimiento}
                </td>
                <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {act.grupo}
                </td>
                <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                  {act.auditor}
                </td>
                <td style={{ padding: '9px 14px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                  {act.fecha}
                </td>
                <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 700, fontSize: '1rem',
                  color: sinHistorico ? '#D97706' : 'var(--secondary)' }}>
                  {sinHistorico ? '—' : act.muestras}
                </td>
                <td style={{ padding: '9px 14px' }}>
                  {sinHistorico ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#D97706', fontSize: '0.78rem', fontWeight: 600 }}>
                      <AlertCircle size={13} /> SIN HISTÓRICO
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#16A34A', fontSize: '0.78rem', fontWeight: 600 }}>
                      <CheckCircle size={13} /> {act.estado}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {actividades.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          No hay actividades para esta categoría.
        </div>
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
  const fileInputRef = useRef(null);

  const processFile = useCallback((file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Por favor, sube un archivo CSV.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = parsearCSV(text);
      if (rows.length === 0) { setError('El CSV no contiene datos válidos.'); return; }

      const allActs = procesarActividades(rows);
      const d3Acts = allActs.filter(a => a.disciplina.toLowerCase().includes('d3 ') || a.disciplina.toLowerCase() === 'd3 muestreo determinación legionella');
      const d3bisActs = allActs.filter(a => a.disciplina.toLowerCase().includes('d3bis') || a.disciplina.toLowerCase().includes('remuestreo'));

      // Edge case: if no D3bis found, all rows go to D3
      const finalD3 = d3bisActs.length === 0 ? allActs : d3Acts;

      const mes = rows[0]['mes'] || '';
      const ano = rows[0]['año'] || rows[0]['ano'] || '';
      setMesAno(`${mes} ${ano}`);
      setD3(finalD3);
      setD3bis(d3bisActs);
      setCsvData(rows);
      setActiveTab('d3');
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  const handleFileChange = (e) => {
    processFile(e.target.files[0]);
  };

  const handleReset = () => {
    setCsvData(null);
    setD3([]);
    setD3bis([]);
    setMesAno('');
    setError(null);
  };

  const currentActs = activeTab === 'd3' ? d3 : d3bis;
  const sinHistorico = currentActs.filter(a => a.estado === 'SIN HISTÓRICO');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <header style={{
        height: '64px',
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 32px',
        gap: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <button
          onClick={onBackToHub}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.9rem' }}
        >
          <ArrowLeft size={18} /> Portal
        </button>
        <div style={{ width: '1px', height: '28px', backgroundColor: 'var(--border)' }} />
        <div>
          <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--secondary)' }}>
            Previsión Mensual Legionella
          </h1>
          {mesAno && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{mesAno}</span>
          )}
        </div>
        {csvData && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
            <button
              onClick={handleReset}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}
            >
              <RefreshCw size={14} /> Nuevo CSV
            </button>
            <button
              onClick={() => exportarExcel(d3, d3bis, mesAno)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700 }}
            >
              <Download size={14} /> Exportar Excel
            </button>
          </div>
        )}
      </header>

      {/* Body */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        {!csvData ? (
          /* Upload zone */
          <div style={{ maxWidth: '600px', margin: '60px auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <FileText size={36} color="var(--primary)" />
              </div>
              <h2 style={{ color: 'var(--secondary)', margin: '0 0 8px', fontSize: '1.5rem' }}>
                Previsión Mensual Legionella
              </h2>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Sube el fichero de actividades CSV para calcular automáticamente los envases previstos por nodo logístico.
              </p>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: '14px',
                padding: '48px 32px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: isDragging ? '#EFF6FF' : 'white',
                transition: 'all 0.2s ease',
              }}
            >
              <Upload size={28} color={isDragging ? 'var(--primary)' : 'var(--text-muted)'} style={{ marginBottom: '12px' }} />
              <p style={{ color: isDragging ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, margin: '0 0 6px' }}>
                Arrastra el fichero CSV aquí
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                o haz clic para seleccionar — Formato: separado por punto y coma (;)
              </p>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
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
          /* Results */
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', backgroundColor: 'white', borderRadius: '10px', padding: '4px', border: '1px solid var(--border)', width: 'fit-content' }}>
              {[
                { key: 'd3', label: `D3 – Muestreo (${d3.length})` },
                ...(d3bis.length > 0 ? [{ key: 'd3bis', label: `D3bis – Remuestreo (${d3bis.length})` }] : []),
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '7px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    backgroundColor: activeTab === tab.key ? 'var(--primary)' : 'transparent',
                    color: activeTab === tab.key ? 'white' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Alert for missing historico */}
            {sinHistorico.length > 0 && (
              <div style={{ marginBottom: '20px', padding: '12px 16px', backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertCircle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <span style={{ fontWeight: 700, color: '#92400E' }}>
                    {sinHistorico.length} establecimiento{sinHistorico.length > 1 ? 's' : ''} sin histórico:{' '}
                  </span>
                  <span style={{ color: '#92400E', fontSize: '0.88rem' }}>
                    {sinHistorico.map(a => a.establecimiento).join(', ')}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: '#B45309', marginTop: '2px' }}>
                    Requieren revisión manual para determinar el número de muestras.
                  </span>
                </div>
              </div>
            )}

            <ResumenNodos actividades={currentActs} />
            <TablaActividades actividades={currentActs} />
          </div>
        )}
      </main>
    </div>
  );
}
