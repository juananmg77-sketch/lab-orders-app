import React, { useState, useCallback } from 'react';
import { Upload, Download, ArrowLeft, FileSpreadsheet, Tag, X, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';

// ── Constantes ──────────────────────────────────────────────────────────────

const LABEL_TIPOS = ['TAB', 'TAG', 'TTB', 'TTG', 'STB', 'STG', null, '-', '-'];
// null en posición 6 → se reemplaza por "Matriz A" o "Matriz B"

// Keywords que determinan Matriz B (en Muestra o Analítica)
const MATRIZ_B_KEYWORDS = [
  'piscina', 'spa', 'jacuzzi', 'hidromasaje',
  'torre', 'refrigeración', 'refrigeracion', 'condensador',
  'riego', 'incendio', 'contraincendio', 'bie',
  'ornamental', 'fuente ornamental', 'humidificador',
];

// ── Lógica de negocio ────────────────────────────────────────────────────────

function determinarMatriz(muestra = '', analitica = '') {
  const texto = (muestra + ' ' + analitica).toLowerCase();
  // Por código analítica: 2.2.x Piscinas, 2.3.x Hidromasaje
  if (/^2\.[23]\./.test(analitica.trim())) return 'B';
  if (MATRIZ_B_KEYWORDS.some(kw => texto.includes(kw))) return 'B';
  // 3.1.1 Legionella y similares → A por defecto
  if (/3\.1\./.test(analitica)) return 'A';
  return 'A'; // default
}

// Parsear CSV con separador ; y comillas dobles, tolerante a saltos de línea dentro de campos
function parsearCSVRobusto(texto) {
  const sep = ';';
  const rows = [];
  let fila = [];
  let campo = '';
  let enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    const sig = texto[i + 1];

    if (ch === '"') {
      if (enComillas && sig === '"') { campo += '"'; i++; } // escape ""
      else enComillas = !enComillas;
    } else if (ch === sep && !enComillas) {
      fila.push(campo.trim());
      campo = '';
    } else if ((ch === '\n' || ch === '\r') && !enComillas) {
      if (ch === '\r' && sig === '\n') i++;
      fila.push(campo.trim());
      if (fila.some(f => f !== '')) rows.push(fila);
      fila = []; campo = '';
    } else {
      campo += ch;
    }
  }
  if (campo || fila.length) { fila.push(campo.trim()); if (fila.some(f => f !== '')) rows.push(fila); }
  return rows;
}

function parseCSV(texto) {
  const rows = parsearCSVRobusto(texto);
  if (rows.length < 2) return [];

  // Normalizar cabeceras
  const headers = rows[0].map(h => h.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar tildes
    .replace(/[^a-z0-9 ]/g, '').trim()
  );

  const idx = (names) => {
    for (const n of names) {
      const i = headers.findIndex(h => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };

  const iId        = idx(['id de analitica', 'id analitica']);
  const iNum       = idx(['numero', 'number']);
  const iEstab     = idx(['establecimiento']);
  const iRegion    = idx(['region']);
  const iAnalitica = idx(['analitica']);
  const iMuestra   = idx(['muestra']);
  const iCondicion = idx(['condiciones de recogida', 'condiciones']);
  const iFecha     = idx(['fecha de recogida', 'fecha recogida']);
  const iHora      = idx(['hora de recogida', 'hora recogida']);
  const iEstado    = idx(['estado']);
  const iGrupo     = idx(['grupo']);

  const registros = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (i) => (i >= 0 && i < row.length ? row[i] : '').trim();

    const numero    = get(iNum);
    const muestra   = get(iMuestra);
    const estado    = get(iEstado);

    // Filtrar: sin número, marcadas ELIMINAR, o sin estado de recogida
    if (!numero) continue;
    if (muestra.toUpperCase().includes('ELIMINAR')) continue;

    const analitica = get(iAnalitica);
    const region    = get(iRegion);
    const estab     = get(iEstab);
    const condicion = get(iCondicion);
    const fecha     = get(iFecha);
    const hora      = get(iHora);
    const grupo     = get(iGrupo);
    const matriz    = determinarMatriz(muestra, analitica);

    registros.push({ numero, establecimiento: estab, grupo, region, analitica, muestra, condicion, fecha, hora, estado, matriz });
  }
  return registros;
}

// Normalizar fecha a texto DD/MM/YYYY para P-touch Editor 5.4
// (el Editor lee el valor de texto directamente; el nº serie de Excel puede mostrarse como 46153)
function normalizarFecha(fechaStr) {
  if (!fechaStr) return '';
  const parts = fechaStr.split('/');
  if (parts.length !== 3) return fechaStr;
  const [d, m, y] = parts.map(s => s.padStart(2, '0'));
  return `${d}/${m}/${y}`;
}

// ── Exportación XLS Resumen ──────────────────────────────────────────────────

function exportarResumen(registros, fecha) {
  const filas = registros.map(r => [
    r.numero,
    r.establecimiento,
    r.region,
    r.analitica,
    r.muestra,
    r.matriz.toLowerCase(), // 'a' o 'b'
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(filas);

  // Anchos de columna aproximados
  ws['!cols'] = [
    { wch: 14 }, { wch: 40 }, { wch: 20 },
    { wch: 38 }, { wch: 35 }, { wch: 10 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
  const fechaStr = fecha.replace(/\//g, '');
  XLSX.writeFile(wb, `resumen_${fechaStr}.xlsx`);
}

// ── Exportación XLS Etiquetas ────────────────────────────────────────────────

function exportarEtiquetas(registros, fecha) {
  const header  = ['Date', 'Number', 'Region', 'Tipo de análisis'];
  // P-touch Editor 5.4 lee el texto directamente — guardamos como string DD/MM/YYYY
  const fechaTxt = normalizarFecha(fecha);
  const filas   = [header];

  for (const r of registros) {
    const tiposCopia = LABEL_TIPOS.map(t =>
      t === null ? `Matriz ${r.matriz}` : t
    );
    for (const tipo of tiposCopia) {
      filas.push([fechaTxt, r.numero, r.region, tipo ?? '']);
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 18 }];

  const ts = fecha.replace(/\//g, '');
  XLSX.utils.book_append_sheet(wb, ws, 'Labels');
  XLSX.writeFile(wb, `labels_${ts}.xlsx`);
}

// ── Componentes UI ───────────────────────────────────────────────────────────

function Badge({ color, bg, border, children }) {
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 700, color,
      backgroundColor: bg, border: `1px solid ${border}`,
      borderRadius: '5px', padding: '2px 8px', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function StatCard({ label, value, color = 'var(--primary)' }) {
  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '12px', padding: '16px 24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center', minWidth: '110px',
    }}>
      <div style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// ── Guía P-touch Editor 5.4 ─────────────────────────────────────────────────

const PTOUCH_STEPS = [
  {
    n: 1,
    title: 'Abrir plantilla en P-touch Editor 5.4',
    desc: 'Abre la plantilla de etiqueta configurada para la QL-810WC. Los campos de texto deben llamarse exactamente: Date · Number · Region · Tipo de análisis.',
  },
  {
    n: 2,
    title: 'Conectar base de datos',
    desc: 'Menú Archivo → Base de datos → Conectar. Selecciona el XLS de etiquetas generado. Marca "La primera fila contiene nombres de campo".',
  },
  {
    n: 3,
    title: 'Verificar mapeo de campos',
    desc: 'P-touch Editor detectará automáticamente los 4 campos. Comprueba que Date → Fecha, Number → Número, Region → Región, Tipo de análisis → Tipo.',
  },
  {
    n: 4,
    title: 'Imprimir todo',
    desc: 'Archivo → Imprimir → Imprimir todo (o Ctrl+Shift+P). Selecciona Brother QL-810WC y confirma. Se imprimirán 9 etiquetas × N muestras en secuencia.',
  },
];

function PtouchGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: '20px', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'white' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.1rem' }}>🖨️</span>
          <span style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '0.9rem' }}>
            Guía de uso — Brother QL-810WC · P-touch Editor 5.4
          </span>
          <span style={{ fontSize: '0.72rem', backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: '5px', padding: '1px 8px', fontWeight: 700 }}>
            Compatible ✓
          </span>
        </div>
        <span style={{ color: '#94A3B8', fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid #F1F5F9', padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            {PTOUCH_STEPS.map(s => (
              <div key={s.n} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>{s.n}</div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '0.85rem', marginBottom: '3px' }}>{s.title}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#92400E' }}>
            <strong>⚠️ Nombres de campo críticos</strong> — Los objetos de texto en la plantilla de P-touch deben llamarse exactamente igual que las columnas del XLS:
            {' '}<code style={{ backgroundColor: '#FEF3C7', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace' }}>Date</code>,
            {' '}<code style={{ backgroundColor: '#FEF3C7', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace' }}>Number</code>,
            {' '}<code style={{ backgroundColor: '#FEF3C7', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace' }}>Region</code>,
            {' '}<code style={{ backgroundColor: '#FEF3C7', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace' }}>Tipo de análisis</code>.
            {' '}Si el mapeo falla, renombra los objetos en P-touch Editor haciendo doble clic sobre cada campo de texto.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Módulo principal ─────────────────────────────────────────────────────────

export default function LabelGeneratorModule({ onBackToHub }) {
  const [registros, setRegistros]       = useState([]);
  const [fileName, setFileName]         = useState('');
  const [fechaCSV, setFechaCSV]         = useState('');
  const [error, setError]               = useState('');
  const [isDragging, setIsDragging]     = useState(false);
  const [expandedRow, setExpandedRow]   = useState(null);
  const [filterRegion, setFilterRegion] = useState('');
  const [filterMatriz, setFilterMatriz] = useState('');

  const procesarArchivo = useCallback((file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setError('El archivo debe ser un CSV (.csv)');
      return;
    }
    setError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const texto = e.target.result;
        const parsed = parseCSV(texto);
        if (!parsed.length) {
          setError('No se encontraron registros válidos en el CSV.');
          return;
        }
        setRegistros(parsed);
        // Detectar fecha del primer registro con fecha
        const primero = parsed.find(r => r.fecha);
        setFechaCSV(primero?.fecha || '');
        setExpandedRow(null);
        setFilterRegion('');
        setFilterMatriz('');
      } catch (err) {
        setError('Error al parsear el CSV: ' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const onFileInput = (e) => procesarArchivo(e.target.files[0]);
  const onDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    procesarArchivo(e.dataTransfer.files[0]);
  };

  // Stats
  const nA = registros.filter(r => r.matriz === 'A').length;
  const nB = registros.filter(r => r.matriz === 'B').length;
  const regiones = [...new Set(registros.map(r => r.region).filter(Boolean))].sort();

  // Filtros
  const filtrados = registros.filter(r =>
    (!filterRegion || r.region === filterRegion) &&
    (!filterMatriz || r.matriz === filterMatriz)
  );

  const fechaLabel = fechaCSV
    ? `${fechaCSV.split('/')[0]}/${fechaCSV.split('/')[1]}/${fechaCSV.split('/')[2]}`
    : '';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <header style={{
        backgroundColor: 'var(--secondary)', color: 'white',
        padding: '0 32px', height: '60px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onBackToHub}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600 }}
          >
            <ArrowLeft size={16} /> Hub
          </button>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
          <Tag size={18} style={{ color: '#7DD3FC' }} />
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>Generador de Etiquetas</span>
          {fechaCSV && (
            <span style={{ fontSize: '0.78rem', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '6px', padding: '2px 10px', color: 'rgba(255,255,255,0.8)' }}>
              {fechaLabel}
            </span>
          )}
        </div>
        {registros.length > 0 && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => exportarResumen(registros, fechaCSV)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                backgroundColor: '#0891B2', color: 'white', fontWeight: 700, fontSize: '0.82rem',
              }}
            >
              <FileSpreadsheet size={15} /> Exportar Resumen
            </button>
            <button
              onClick={() => exportarEtiquetas(registros, fechaCSV)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                backgroundColor: '#16A34A', color: 'white', fontWeight: 700, fontSize: '0.82rem',
              }}
            >
              <Download size={15} /> Exportar Etiquetas
            </button>
          </div>
        )}
      </header>

      <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '28px 24px' }}>

        {/* ── Guía Brother P-touch ── */}
        <PtouchGuide />

        {/* ── Zona de carga ── */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${isDragging ? 'var(--primary)' : '#CBD5E1'}`,
            borderRadius: '14px', padding: '36px',
            backgroundColor: isDragging ? 'var(--primary-light)' : 'white',
            textAlign: 'center', transition: 'all 0.15s',
            marginBottom: '24px', cursor: 'pointer',
          }}
          onClick={() => document.getElementById('csv-input').click()}
        >
          <input id="csv-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={onFileInput} />
          <Upload size={36} color={isDragging ? 'var(--primary)' : '#94A3B8'} style={{ marginBottom: '10px' }} />
          {fileName ? (
            <div>
              <div style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '1rem' }}>{fileName}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Haz clic o arrastra un nuevo CSV para reemplazar
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '1rem' }}>
                Arrastra el CSV de HS Manager aquí
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                o haz clic para seleccionar el archivo
              </div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '12px 16px', color: '#DC2626', fontWeight: 600, fontSize: '0.88rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <X size={15} /> {error}
          </div>
        )}

        {registros.length > 0 && (
          <>
            {/* ── Stats ── */}
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
              <StatCard label="Muestras" value={registros.length} color="var(--primary)" />
              <StatCard label="Matriz A" value={nA} color="#16A34A" />
              <StatCard label="Matriz B" value={nB} color="#0891B2" />
              <StatCard label="Etiquetas" value={registros.length * 9} color="#7C3AED" />
              <StatCard label="Regiones" value={regiones.length} color="#D97706" />
            </div>

            {/* ── Filtros ── */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
              <select
                value={filterRegion}
                onChange={e => setFilterRegion(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--secondary)', backgroundColor: 'white' }}
              >
                <option value="">Todas las regiones</option>
                {regiones.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={filterMatriz}
                onChange={e => setFilterMatriz(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--secondary)', backgroundColor: 'white' }}
              >
                <option value="">Todas las matrices</option>
                <option value="A">Matriz A</option>
                <option value="B">Matriz B</option>
              </select>
              {(filterRegion || filterMatriz) && (
                <button
                  onClick={() => { setFilterRegion(''); setFilterMatriz(''); }}
                  style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.82rem', backgroundColor: 'white', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}
                >
                  <X size={13} style={{ verticalAlign: 'middle' }} /> Limpiar
                </button>
              )}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {filtrados.length} registros mostrados
              </span>
            </div>

            {/* ── Tabla ── */}
            <div style={{ backgroundColor: 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--secondary)', color: 'white' }}>
                    {['Número', 'Establecimiento', 'Región', 'Analítica', 'Muestra', 'Matriz'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.03em' }}>{h}</th>
                    ))}
                    <th style={{ padding: '11px 14px', width: '36px' }} />
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((r, i) => {
                    const isExp = expandedRow === i;
                    const rowBg = i % 2 === 0 ? 'white' : '#F8FAFC';
                    const mColor = r.matriz === 'B' ? '#0891B2' : '#16A34A';
                    const mBg    = r.matriz === 'B' ? '#ECFEFF' : '#F0FDF4';
                    const mBorder= r.matriz === 'B' ? '#A5F3FC' : '#BBF7D0';
                    return (
                      <React.Fragment key={i}>
                        <tr
                          style={{ backgroundColor: isExp ? '#EFF6FF' : rowBg, borderBottom: '1px solid #F1F5F9', cursor: 'pointer', transition: 'background 0.1s' }}
                          onClick={() => setExpandedRow(isExp ? null : i)}
                        >
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.numero}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.establecimiento}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{r.region}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.analitica}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.muestra}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <Badge color={mColor} bg={mBg} border={mBorder}>Matriz {r.matriz}</Badge>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94A3B8' }}>
                            {isExp ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </td>
                        </tr>
                        {isExp && (
                          <tr style={{ backgroundColor: '#F0F9FF', borderBottom: '2px solid var(--primary)' }}>
                            <td colSpan={7} style={{ padding: '14px 20px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                                <div><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Grupo</span><div style={{ fontWeight: 600, color: 'var(--secondary)', fontSize: '0.85rem' }}>{r.grupo || '—'}</div></div>
                                <div><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Condiciones</span><div style={{ fontWeight: 600, color: 'var(--secondary)', fontSize: '0.85rem' }}>{r.condicion || '—'}</div></div>
                                <div><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Fecha recogida</span><div style={{ fontWeight: 600, color: 'var(--secondary)', fontSize: '0.85rem' }}>{r.fecha || '—'}</div></div>
                                <div><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Hora</span><div style={{ fontWeight: 600, color: 'var(--secondary)', fontSize: '0.85rem' }}>{r.hora || '—'}</div></div>
                                <div><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Estado</span><div style={{ fontWeight: 600, color: 'var(--secondary)', fontSize: '0.85rem' }}>{r.estado || '—'}</div></div>
                              </div>
                              {/* Preview etiquetas */}
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Preview 9 etiquetas
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {LABEL_TIPOS.map((t, li) => {
                                  const tipo = t === null ? `Matriz ${r.matriz}` : (t || '—');
                                  const isMatriz = t === null;
                                  return (
                                    <div key={li} style={{
                                      backgroundColor: isMatriz ? (r.matriz === 'B' ? '#ECFEFF' : '#F0FDF4') : '#F8FAFC',
                                      border: `1px solid ${isMatriz ? (r.matriz === 'B' ? '#A5F3FC' : '#BBF7D0') : '#E2E8F0'}`,
                                      borderRadius: '6px', padding: '5px 10px', fontSize: '0.75rem',
                                      fontWeight: isMatriz ? 800 : 600,
                                      color: isMatriz ? (r.matriz === 'B' ? '#0891B2' : '#16A34A') : '#475569',
                                      minWidth: '52px', textAlign: 'center',
                                    }}>
                                      <div style={{ fontSize: '0.6rem', color: '#94A3B8', marginBottom: '1px' }}>{li + 1}</div>
                                      {tipo}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              {filtrados.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                  No hay registros con los filtros seleccionados.
                </div>
              )}
            </div>

            {/* ── Botones exportar abajo ── */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => exportarResumen(registros, fechaCSV)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '11px 22px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  backgroundColor: '#0891B2', color: 'white', fontWeight: 700, fontSize: '0.9rem',
                  boxShadow: '0 2px 8px rgba(8,145,178,0.3)',
                }}
              >
                <FileSpreadsheet size={17} /> Exportar XLS Resumen
              </button>
              <button
                onClick={() => exportarEtiquetas(registros, fechaCSV)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '11px 22px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  backgroundColor: '#16A34A', color: 'white', fontWeight: 700, fontSize: '0.9rem',
                  boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
                }}
              >
                <Download size={17} /> Exportar XLS Etiquetas ({registros.length * 9} filas)
              </button>
            </div>
          </>
        )}

        {registros.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Tag size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '6px' }}>Ningún CSV cargado</div>
            <div style={{ fontSize: '0.85rem' }}>Sube el export diario de HS Manager para generar los XLS de resumen y etiquetas.</div>
          </div>
        )}
      </div>
    </div>
  );
}
