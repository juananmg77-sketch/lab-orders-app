import React, { useState, useCallback } from 'react';
import {
  ArrowLeft, Upload, Download, AlertTriangle, CheckCircle,
  Droplets, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── Reglas de negocio ──────────────────────────────────────────────────────
// Confirmadas comparando 5 pares reales de CSV de entrada (HS Manager) contra
// los Excel de salida generados por la app original "Legionela Labaqua"
// (Lovable). No modificar sin volver a validar contra archivos reales.

// Analíticas relevantes para Legionella y su Matriz asociada (A = agua
// sanitaria, B = piscinas/spa/vaso de hidromasaje).
const ANALITICAS_LEGIONELLA = {
  '3.1 legionella spp': 'A',
  '2.1.1 piscina exterior con legionella': 'B',
  '2.2 piscina tipo spa': 'B',
  '2.3 vaso de hidromasaje': 'B',
};

// Hoteles de la isla de Lanzarote excluidos del informe (lista proporcionada
// por el cliente el 19/08/2026). Añadir aquí cualquier hotel nuevo a excluir.
const HOTELES_EXCLUIDOS_RAW = [
  'Mynd Yaiza',
  'Allsun albatros',
  'H10 Rubicon Horizons collection',
  'H10 Timanfaya palace',
  'H10 Lanzarote princess',
  'H10 suites Lanzarote Garden',
  'Hotel Fariones',
  'Plus Fariones Apartamentos',
  'plus fariones suite hotel',
  'Radisson blu Lanzarote',
  'H10 White suites boutique hotel',
  'H10 Suites Lanzarote Gardens',
];

function normalizar(str = '') {
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

const HOTELES_EXCLUIDOS = new Set(HOTELES_EXCLUIDOS_RAW.map(normalizar));

// ─── Parseo CSV robusto (separador ;, campos entre comillas, saltos de línea
// dentro de campo) ────────────────────────────────────────────────────────
function parsearCSVRobusto(texto) {
  const sep = ';';
  const rows = [];
  let fila = [], campo = '', enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i], sig = texto[i + 1];
    if (ch === '"') {
      if (enComillas && sig === '"') { campo += '"'; i++; }
      else enComillas = !enComillas;
    } else if (ch === sep && !enComillas) {
      fila.push(campo.trim()); campo = '';
    } else if ((ch === '\n' || ch === '\r') && !enComillas) {
      if (ch === '\r' && sig === '\n') i++;
      fila.push(campo.trim());
      if (fila.some(f => f !== '')) rows.push(fila);
      fila = []; campo = '';
    } else { campo += ch; }
  }
  if (campo || fila.length) { fila.push(campo.trim()); if (fila.some(f => f !== '')) rows.push(fila); }
  return rows;
}

// Aplica las 4 reglas de filtrado y devuelve incluidos + excluidos (con motivo)
function procesarCSV(texto) {
  const rows = parsearCSVRobusto(texto);
  if (rows.length < 2) return { incluidos: [], excluidos: [] };

  const headers = rows[0].map(h =>
    h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim()
  );
  const idx = (names) => {
    // 1º: coincidencia EXACTA de cabecera (evita que "Id de analítica"
    // capture accidentalmente la búsqueda de "Analítica" vía includes)
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i >= 0) return i;
    }
    // 2º: fallback por coincidencia parcial, descartando columnas "id ..."
    for (const n of names) {
      const i = headers.findIndex(h => h.includes(n) && !h.startsWith('id '));
      if (i >= 0) return i;
    }
    return -1;
  };

  const iNum       = idx(['numero', 'number']);
  const iEstab     = idx(['establecimiento']);
  const iAnalitica = idx(['analitica']);
  const iMuestra   = idx(['muestra']);
  const iCondicion = idx(['condiciones de recogida', 'condiciones']);
  const iFecha     = idx(['fecha de recogida', 'fecha recogida']);
  const iHora      = idx(['hora de recogida', 'hora recogida']);

  const incluidos = [];
  const excluidos = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (i) => (i >= 0 && i < row.length ? row[i] : '').trim();

    const numero = get(iNum);
    if (!numero) continue;

    const establecimiento = get(iEstab);
    const analitica       = get(iAnalitica);
    const muestra          = get(iMuestra);
    const condicion         = get(iCondicion);
    const fecha              = get(iFecha);
    const hora                = get(iHora);

    const registro = { numero, establecimiento, analitica, muestra, condicion, fecha, hora };

    // Regla 1: lista blanca de analíticas
    const matriz = ANALITICAS_LEGIONELLA[normalizar(analitica)];
    if (!matriz) {
      excluidos.push({ ...registro, motivo: 'Analítica no relevante para Legionella' });
      continue;
    }

    // Regla 2: método de recogida "Nilsson"
    if (normalizar(condicion).includes('nilsson')) {
      excluidos.push({ ...registro, motivo: 'Método de recogida Nilsson' });
      continue;
    }

    // Regla 3: muestra marcada para borrar
    const muestraNorm = normalizar(muestra);
    if (muestraNorm.includes('borrar') || muestraNorm.includes('eliminar')) {
      excluidos.push({ ...registro, motivo: 'Marcado para borrar' });
      continue;
    }

    // Regla 4: hotel de Lanzarote excluido
    if (HOTELES_EXCLUIDOS.has(normalizar(establecimiento))) {
      excluidos.push({ ...registro, motivo: 'Establecimiento de Lanzarote excluido' });
      continue;
    }

    incluidos.push({ ...registro, matriz, id: `${numero}-${r}` });
  }

  return { incluidos, excluidos };
}

// ─── Exportación a Excel (mismo formato plano que el original: cabecera +
// filas, sin títulos ni merges) ─────────────────────────────────────────────
function exportarExcel(registros) {
  const header = ['Número', 'Establecimiento', 'Analítica', 'Fecha de recogida', 'Hora de recogida', 'Muestra', 'Matriz'];
  const filas = registros.map(r => [r.numero, r.establecimiento, r.analitica, r.fecha, r.hora, r.muestra, r.matriz]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...filas]);
  ws['!cols'] = [
    { wch: 14 }, { wch: 34 }, { wch: 38 }, { wch: 16 }, { wch: 14 }, { wch: 34 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  XLSX.writeFile(wb, `Labaqua_Canarias_${dd}_${mm}.xlsx`);
}

// ─── Celda editable: texto (Muestra) ────────────────────────────────────────
function CeldaTexto({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onChange(draft); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--primary)', borderRadius: '4px', fontSize: '0.83rem' }}
      />
    );
  }
  return (
    <div
      onClick={() => { setDraft(value); setEditing(true); }}
      style={{ cursor: 'text', padding: '4px 6px', borderRadius: '4px' }}
      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      title="Clic para editar"
    >
      {value || <span style={{ color: '#cbd5e1' }}>—</span>}
    </div>
  );
}

// ─── Celda editable: Matriz (toggle A/B) ────────────────────────────────────
function CeldaMatriz({ value, onChange }) {
  const esB = value === 'B';
  return (
    <button
      onClick={() => onChange(esB ? 'A' : 'B')}
      style={{
        padding: '4px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
        fontWeight: 700, fontSize: '0.8rem',
        backgroundColor: esB ? '#ECFEFF' : '#F0FDF4',
        color: esB ? '#0891B2' : '#16A34A',
      }}
      title="Clic para alternar Matriz A/B"
    >
      Matriz {value}
    </button>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────
export default function LegionellaLabaquaModule({ onBackToHub }) {
  const [registros, setRegistros]       = useState([]);
  const [excluidos, setExcluidos]       = useState([]);
  const [fileName, setFileName]         = useState('');
  const [error, setError]               = useState('');
  const [isDragging, setIsDragging]     = useState(false);
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);

  const procesarArchivo = useCallback((file) => {
    if (!file) return;
    setError('');
    const nombreValido = /\.(csv|xlsx|xls)$/i.test(file.name);
    if (!nombreValido) { setError('Formato no soportado. Usa .csv, .xlsx o .xls'); return; }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        let texto;
        if (/\.csv$/i.test(file.name)) {
          texto = evt.target.result;
        } else {
          // .xlsx / .xls → convertir la primera hoja a CSV en memoria
          const wb = XLSX.read(evt.target.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          texto = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
        }
        const { incluidos, excluidos: exc } = procesarCSV(texto);
        if (!incluidos.length && !exc.length) {
          setError('No se han detectado filas válidas en el archivo.');
          return;
        }
        setRegistros(incluidos);
        setExcluidos(exc);
        setFileName(file.name);
      } catch (e) {
        setError('No se ha podido leer el archivo: ' + e.message);
      }
    };
    if (/\.csv$/i.test(file.name)) reader.readAsText(file, 'UTF-8');
    else reader.readAsBinaryString(file);
  }, []);

  const onFileInput = (e) => procesarArchivo(e.target.files[0]);
  const onDrop = (e) => { e.preventDefault(); setIsDragging(false); procesarArchivo(e.dataTransfer.files[0]); };

  const actualizarRegistro = (id, campo, valor) => {
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, [campo]: valor } : r));
  };

  const eliminarRegistro = (id) => {
    setRegistros(prev => prev.filter(r => r.id !== id));
  };

  const reiniciar = () => { setRegistros([]); setExcluidos([]); setFileName(''); setError(''); };

  const nA = registros.filter(r => r.matriz === 'A').length;
  const nB = registros.filter(r => r.matriz === 'B').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <header style={{
        height: '70px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBackToHub}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontWeight: 600 }}
          >
            <ArrowLeft size={18} /> Portal
          </button>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Droplets size={22} color="#0EA5E9" />
            <h1 style={{ fontSize: '1.15rem', color: 'var(--secondary)', margin: 0 }}>Legionela Labaqua</h1>
          </div>
        </div>
        {registros.length > 0 && (
          <button
            onClick={() => exportarExcel(registros)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#0EA5E9', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
          >
            <Download size={18} /> Descargar Excel
          </button>
        )}
      </header>

      <main style={{ flex: 1, overflow: 'auto', padding: '32px 40px' }}>
        {registros.length === 0 && excluidos.length === 0 ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            style={{
              maxWidth: '560px', margin: '60px auto', padding: '60px 40px', textAlign: 'center',
              border: `2px dashed ${isDragging ? '#0EA5E9' : 'var(--border)'}`,
              borderRadius: '20px', backgroundColor: isDragging ? '#F0F9FF' : 'var(--surface)',
              transition: 'all 0.2s ease',
            }}
          >
            <Droplets size={48} color="#0EA5E9" style={{ marginBottom: '16px' }} />
            <h2 style={{ color: 'var(--secondary)', marginBottom: '8px' }}>Sube el Excel/CSV del día</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              Exportado desde HS Manager. Se filtrarán automáticamente las muestras relevantes de Legionella.
            </p>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
              backgroundColor: '#0EA5E9', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 700,
            }}>
              <Upload size={18} /> Subir archivo
              <input type="file" accept=".csv,.xlsx,.xls" onChange={onFileInput} style={{ display: 'none' }} />
            </label>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '16px' }}>
              o arrastra y suelta el archivo aquí · .xlsx, .xls, .csv
            </p>
            {error && (
              <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', color: '#DC2626' }}>
                <AlertTriangle size={16} /> {error}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Resumen */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <CheckCircle size={16} color="#16A34A" /> {fileName}
              </div>
              <div style={{ padding: '6px 14px', borderRadius: '8px', backgroundColor: '#F0FDF4', color: '#16A34A', fontWeight: 700, fontSize: '0.85rem' }}>
                {registros.length} muestras incluidas
              </div>
              {registros.length > 0 && (
                <div style={{ padding: '6px 14px', borderRadius: '8px', backgroundColor: '#ECFEFF', color: '#0891B2', fontSize: '0.85rem', fontWeight: 600 }}>
                  Matriz A: {nA} · Matriz B: {nB}
                </div>
              )}
              {excluidos.length > 0 && (
                <button
                  onClick={() => setMostrarExcluidos(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', backgroundColor: '#FEF2F2', color: '#DC2626', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  {excluidos.length} excluidas {mostrarExcluidos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}
              <button
                onClick={reiniciar}
                style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: '8px', backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Subir otro archivo
              </button>
            </div>

            {/* Panel de excluidos (colapsable, transparencia sobre el filtro) */}
            {mostrarExcluidos && (
              <div style={{ marginBottom: '20px', backgroundColor: '#FEF2F2', borderRadius: '12px', padding: '16px 20px', maxHeight: '220px', overflow: 'auto' }}>
                {excluidos.map((r, i) => (
                  <div key={i} style={{ fontSize: '0.8rem', color: '#7F1D1D', padding: '4px 0', borderBottom: i < excluidos.length - 1 ? '1px solid #FEE2E2' : 'none' }}>
                    <strong>{r.numero}</strong> · {r.establecimiento} · {r.analitica || '(sin analítica)'} — <em>{r.motivo}</em>
                  </div>
                ))}
              </div>
            )}

            {/* Tabla de muestras incluidas */}
            {registros.length > 0 && (
              <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', textAlign: 'left' }}>
                      {['Número', 'Establecimiento', 'Analítica', 'Fecha', 'Hora', 'Muestra', 'Matriz', ''].map(h => (
                        <th key={h} style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map((r) => (
                      <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>{r.numero}</td>
                        <td style={{ padding: '10px 16px' }}>{r.establecimiento}</td>
                        <td style={{ padding: '10px 16px' }}>{r.analitica}</td>
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{r.fecha}</td>
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{r.hora}</td>
                        <td style={{ padding: '4px 8px' }}>
                          <CeldaTexto value={r.muestra} onChange={(v) => actualizarRegistro(r.id, 'muestra', v)} />
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          <CeldaMatriz value={r.matriz} onChange={(v) => actualizarRegistro(r.id, 'matriz', v)} />
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                          <button
                            onClick={() => eliminarRegistro(r.id)}
                            title="Quitar fila"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {registros.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                Ninguna fila del archivo cumple los criterios de Legionella. Revisa el panel de excluidas arriba.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
