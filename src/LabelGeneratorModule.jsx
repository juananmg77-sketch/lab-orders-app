import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Download, ArrowLeft, FileSpreadsheet, Tag, X, ChevronDown, ChevronUp, Save, Clock, CheckCircle, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabaseClient';

// ── Constantes ──────────────────────────────────────────────────────────────

const LABEL_TIPOS = ['TAB', 'TAG', 'TTB', 'TTG', 'STB', 'STG', null, '-', '-'];
// null en posición 6 → se reemplaza por "Matriz A" o "Matriz B"

const MATRIZ_B_KEYWORDS = [
  'piscina', 'spa', 'jacuzzi', 'hidromasaje',
  'torre', 'refrigeración', 'refrigeracion', 'condensador',
  'riego', 'incendio', 'contraincendio', 'bie',
  'ornamental', 'fuente ornamental', 'humidificador',
];

const MES_NOMBRES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── Lógica de negocio ────────────────────────────────────────────────────────

function determinarMatriz(muestra = '', analitica = '') {
  const texto = (muestra + ' ' + analitica).toLowerCase();
  if (/^2\.[23]\./.test(analitica.trim())) return 'B';
  if (MATRIZ_B_KEYWORDS.some(kw => texto.includes(kw))) return 'B';
  return 'A';
}

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

function parseCSV(texto) {
  const rows = parsearCSVRobusto(texto);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim());
  const idx = (names) => { for (const n of names) { const i = headers.findIndex(h => h.includes(n)); if (i >= 0) return i; } return -1; };
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
    const numero  = get(iNum);
    const muestra = get(iMuestra);
    if (!numero) continue;
    if (muestra.toUpperCase().includes('ELIMINAR')) continue;
    const analitica = get(iAnalitica);
    registros.push({
      numero,
      establecimiento: get(iEstab),
      grupo:           get(iGrupo),
      region:          get(iRegion),
      analitica,
      muestra,
      condicion:       get(iCondicion),
      fecha:           get(iFecha),
      hora:            get(iHora),
      estado:          get(iEstado),
      matriz:          determinarMatriz(muestra, analitica),
    });
  }
  return registros;
}

function normalizarFecha(fechaStr) {
  if (!fechaStr) return '';
  const parts = fechaStr.split('/');
  if (parts.length !== 3) return fechaStr;
  const [d, m, y] = parts.map(s => s.padStart(2, '0'));
  return `${d}/${m}/${y}`;
}

// Convierte "11/05/2026" → objeto Date local (medianoche)
function fechaStrToDate(fechaStr) {
  if (!fechaStr) return null;
  const parts = fechaStr.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  return new Date(y, m - 1, d);
}

// Formatea fecha de DB (ISO) para mostrar
function formatFechaLabel(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr + 'T12:00:00');
  return `${d.getDate()} ${MES_NOMBRES[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Exportaciones ─────────────────────────────────────────────────────────────

function exportarResumen(registros, fecha) {
  const fechaLabel = normalizarFecha(fecha) || '—';
  const nA = registros.filter(r => r.matriz === 'A').length;
  const nB = registros.filter(r => r.matriz === 'B').length;

  // Filas de cabecera
  const cabecera = [
    [`HSLAB — Registro de Muestras`, '', '', '', '', ''],
    [`Fecha de recogida: ${fechaLabel}`, '', `Total muestras: ${registros.length}`, '', `Matriz A: ${nA}   Matriz B: ${nB}`, ''],
    [],  // Fila vacía separadora
    ['Número', 'Establecimiento', 'Región', 'Analítica', 'Muestra', 'Matriz'],
  ];

  // Ordenar por Establecimiento, luego por Número
  const sorted = [...registros].sort((a, b) =>
    (a.establecimiento || '').localeCompare(b.establecimiento || '', 'es') ||
    (a.numero || '').localeCompare(b.numero || '', 'es', { numeric: true })
  );

  const filasDatos = sorted.map(r => [
    r.numero,
    r.establecimiento,
    r.region,
    r.analitica,
    r.muestra,
    (r.matriz || 'A').toLowerCase() === 'b' ? 'Matriz B' : 'Matriz A',
  ]);

  const todasLasFilas = [...cabecera, ...filasDatos];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(todasLasFilas);

  // Anchos de columna
  ws['!cols'] = [
    { wch: 14 },  // Número
    { wch: 42 },  // Establecimiento
    { wch: 22 },  // Región
    { wch: 40 },  // Analítica
    { wch: 38 },  // Muestra
    { wch: 12 },  // Matriz
  ];

  // Combinar celdas del título principal
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },  // Título
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
  XLSX.writeFile(wb, `resumen_${(fecha || '').replace(/\//g, '')}.xlsx`);
}

function exportarEtiquetas(registros, fecha) {
  const header  = ['Date', 'Number', 'Region', 'Tipo de análisis'];
  const fechaTxt = normalizarFecha(fecha);
  const filas   = [header];
  for (const r of registros) {
    const tiposCopia = LABEL_TIPOS.map(t => t === null ? `Matriz ${r.matriz || 'A'}` : t);
    for (const tipo of tiposCopia) filas.push([fechaTxt, r.numero, r.region, tipo ?? '']);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Labels');
  XLSX.writeFile(wb, `labels_${(fecha || '').replace(/\//g, '')}.xlsx`);
}

function exportarPDFLab(registros, fecha) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW  = 297;
  const pageH  = 210;
  const margin = 14;

  const fechaLabel = normalizarFecha(fecha) || '—';
  const now = new Date();
  const fechaGen = now.toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }) + ' ' + now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  // ─── CABECERA ────────────────────────────────────────────────
  // Barra azul oscura
  doc.setFillColor(0, 11, 61);
  doc.rect(0, 0, pageW, 27, 'F');

  // Franja azul viva de acento
  doc.setFillColor(0, 118, 206);
  doc.rect(0, 27, pageW, 2.5, 'F');

  // Título
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('HSLAB  ·  Registro de Recepción de Muestras', margin, 11);

  // Subtítulo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(180, 200, 230);
  doc.text(`Fecha de recogida:`, margin, 20);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(fechaLabel, margin + 31, 20);

  // Derecha: generado
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(160, 190, 220);
  doc.text(`Generado: ${fechaGen}`, pageW - margin, 20, { align: 'right' });

  // ─── TARJETAS DE ESTADÍSTICAS ────────────────────────────────
  const nA = registros.filter(r => r.matriz === 'A').length;
  const nB = registros.filter(r => r.matriz === 'B').length;
  const regiones = [...new Set(registros.map(r => r.region).filter(Boolean))];
  const establecimientos = [...new Set(registros.map(r => r.establecimiento).filter(Boolean))];

  const stats = [
    { label: 'MUESTRAS',      value: String(registros.length),          rgb: [0, 118, 206] },
    { label: 'MATRIZ A',      value: String(nA),                         rgb: [22, 163, 74] },
    { label: 'MATRIZ B',      value: String(nB),                         rgb: [8, 145, 178] },
    { label: 'ETIQUETAS',     value: String(registros.length * 9),        rgb: [109, 40, 217] },
    { label: 'REGIONES',      value: String(regiones.length),             rgb: [217, 119, 6] },
    { label: 'ESTABLEC.',     value: String(establecimientos.length),     rgb: [15, 118, 110] },
  ];

  const boxW   = 40;
  const boxH   = 16;
  const totalBoxW = stats.length * boxW;
  const totalGap  = (pageW - 2 * margin) - totalBoxW;
  const gap    = totalGap / (stats.length - 1);

  stats.forEach((s, i) => {
    const x = margin + i * (boxW + gap);
    const y = 31.5;
    doc.setFillColor(...s.rgb);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, 'F');

    // Valor grande
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(s.value, x + boxW / 2, y + 7.5, { align: 'center' });

    // Etiqueta pequeña
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(220, 235, 255);
    doc.text(s.label, x + boxW / 2, y + 13.5, { align: 'center' });
  });

  // ─── TABLA PRINCIPAL ─────────────────────────────────────────
  const sorted = [...registros].sort((a, b) =>
    (a.establecimiento || '').localeCompare(b.establecimiento || '', 'es') ||
    (a.region || '').localeCompare(b.region || '', 'es') ||
    (a.numero || '').localeCompare(b.numero || '', 'es', { numeric: true })
  );

  // Construir filas con cabeceras de grupo por Establecimiento
  const bodyData = [];
  let lastEstab = null;
  for (const r of sorted) {
    if (r.establecimiento !== lastEstab) {
      bodyData.push([
        {
          content: `  ${r.establecimiento || '—'}`,
          colSpan: 7,
          styles: {
            fillColor: [15, 23, 42],
            textColor: [203, 213, 225],
            fontStyle: 'bold',
            fontSize: 7,
            cellPadding: { top: 3, bottom: 3, left: 8, right: 8 },
          },
        },
      ]);
      lastEstab = r.establecimiento;
    }
    bodyData.push([
      r.numero        || '',
      r.region        || '',
      r.analitica     || '',
      r.muestra       || '',
      r.condicion     || '',
      r.hora          || '',
      r.matriz === 'B' ? 'Matriz B' : 'Matriz A',
    ]);
  }

  autoTable(doc, {
    startY: 51,
    head: [['Número', 'Región', 'Analítica', 'Muestra / Punto', 'Condición de recogida', 'Hora', 'Matriz']],
    body: bodyData,
    styles: {
      fontSize: 6.8,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3.5, right: 3.5 },
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      overflow: 'linebreak',
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [0, 118, 206],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3.5, right: 3.5 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 24,  fontStyle: 'bold', textColor: [0, 118, 206] },
      1: { cellWidth: 28 },
      2: { cellWidth: 52 },
      3: { cellWidth: 50 },
      4: { cellWidth: 50 },
      5: { cellWidth: 13,  halign: 'center' },
      6: { cellWidth: 22,  halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const v = data.cell.raw;
        if (v === 'Matriz B') {
          data.cell.styles.textColor    = [8, 145, 178];
          data.cell.styles.fillColor    = [236, 254, 255];
        } else if (v === 'Matriz A') {
          data.cell.styles.textColor    = [22, 163, 74];
          data.cell.styles.fillColor    = [240, 253, 244];
        }
      }
    },
    didDrawPage: (data) => {
      // Línea divisoria superior al pie
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, pageH - 9, pageW - margin, pageH - 9);

      // Pie izquierdo
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`HSLAB · Registro de Muestras · ${fechaLabel}`, margin, pageH - 5.5);

      // Pie derecho
      doc.text(
        `Pág. ${data.pageNumber}   ·   Generado: ${fechaGen}`,
        pageW - margin,
        pageH - 5.5,
        { align: 'right' }
      );
    },
    margin: { top: 51, left: margin, right: margin, bottom: 13 },
  });

  doc.save(`lab_registro_${(fecha || '').replace(/\//g, '')}.pdf`);
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function guardarImport(registros, fecha, filename) {
  if (!registros.length || !fecha) return { error: 'Sin datos' };

  // Convertir fecha DD/MM/YYYY → YYYY-MM-DD para Postgres
  const parts = fecha.split('/');
  const fechaISO = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;

  // Borrar registros existentes para esa fecha
  await supabase.from('label_muestras').delete().eq('fecha', fechaISO);

  // Insertar nuevos
  const rows = registros.map(r => ({
    fecha:           fechaISO,
    filename:        filename || '',
    numero:          r.numero,
    establecimiento: r.establecimiento,
    grupo:           r.grupo,
    region:          r.region,
    analitica:       r.analitica,
    muestra:         r.muestra,
    condicion:       r.condicion,
    hora:            r.hora,
    estado:          r.estado,
    matriz:          r.matriz || 'A',
  }));

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from('label_muestras').insert(rows.slice(i, i + BATCH));
    if (error) return { error: error.message };
  }
  return { ok: true };
}

async function cargarFechasDisponibles() {
  const { data } = await supabase
    .from('label_muestras')
    .select('fecha, filename')
    .order('fecha', { ascending: false })
    .limit(5000);
  if (!data) return [];
  // Deduplicar por fecha
  const seen = new Set();
  return data.filter(r => { if (seen.has(r.fecha)) return false; seen.add(r.fecha); return true; });
}

async function cargarRegistrosDeFecha(fechaISO) {
  const { data } = await supabase
    .from('label_muestras')
    .select('*')
    .eq('fecha', fechaISO)
    .order('created_at', { ascending: true })
    .limit(5000);
  return (data || []).map(r => ({
    id:              r.id,
    numero:          r.numero,
    establecimiento: r.establecimiento,
    grupo:           r.grupo,
    region:          r.region,
    analitica:       r.analitica,
    muestra:         r.muestra,
    condicion:       r.condicion,
    hora:            r.hora,
    estado:          r.estado,
    fecha:           r.fecha.split('-').reverse().join('/'), // YYYY-MM-DD → DD/MM/YYYY
    matriz:          r.matriz || 'A',
  }));
}

async function actualizarRegistro(id, campo, valor) {
  return supabase.from('label_muestras').update({ [campo]: valor }).eq('id', id);
}

// ── Componentes UI ────────────────────────────────────────────────────────────

function Badge({ color, bg, border, children }) {
  return (
    <span style={{ fontSize: '0.7rem', fontWeight: 700, color, backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '5px', padding: '2px 8px', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

function StatCard({ label, value, color = 'var(--primary)' }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center', minWidth: '110px' }}>
      <div style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>{label}</div>
    </div>
  );
}

const PTOUCH_STEPS = [
  { n: 1, title: 'Abrir plantilla en P-touch Editor 5.4', desc: 'Abre la plantilla configurada para la QL-810WC. Los campos de texto deben llamarse: Date · Number · Region · Tipo de análisis.' },
  { n: 2, title: 'Conectar base de datos', desc: 'Menú Archivo → Base de datos → Conectar. Selecciona el XLS de etiquetas. Marca "La primera fila contiene nombres de campo".' },
  { n: 3, title: 'Verificar mapeo de campos', desc: 'P-touch Editor detectará los 4 campos automáticamente. Comprueba que Date→Fecha, Number→Número, Region→Región, Tipo de análisis→Tipo.' },
  { n: 4, title: 'Imprimir todo', desc: 'Archivo → Imprimir → Imprimir todo (Ctrl+Shift+P). Selecciona QL-810WC. Se imprimen 9 etiquetas × N muestras en secuencia.' },
];

function PtouchGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: '20px', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'white' }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: '100%', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.1rem' }}>🖨️</span>
          <span style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '0.9rem' }}>Guía de uso — Brother QL-810WC · P-touch Editor 5.4</span>
          <span style={{ fontSize: '0.72rem', backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: '5px', padding: '1px 8px', fontWeight: 700 }}>Compatible ✓</span>
        </div>
        <span style={{ color: '#94A3B8', fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid #F1F5F9', padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px', marginBottom: '14px' }}>
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
            <strong>⚠️ Nombres de campo críticos</strong> — Los objetos en la plantilla deben llamarse exactamente:{' '}
            {['Date','Number','Region','Tipo de análisis'].map(f => <code key={f} style={{ backgroundColor: '#FEF3C7', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace', marginRight: '4px' }}>{f}</code>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Selector de imports históricos ────────────────────────────────────────────

function HistoricoPanel({ fechas, fechaActiva, onSelect }) {
  const [open, setOpen] = useState(false);
  if (!fechas.length) return null;
  return (
    <div style={{ marginBottom: '20px', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'white' }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: '100%', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Clock size={16} color="#7C3AED" />
          <span style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '0.9rem' }}>Imports anteriores guardados</span>
          <span style={{ fontSize: '0.72rem', backgroundColor: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', borderRadius: '5px', padding: '1px 8px', fontWeight: 700 }}>{fechas.length} día{fechas.length !== 1 ? 's' : ''}</span>
        </div>
        <span style={{ color: '#94A3B8', fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid #F1F5F9', padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {fechas.map(f => {
            const isActive = f.fecha === fechaActiva;
            return (
              <button
                key={f.fecha}
                onClick={() => onSelect(f.fecha)}
                style={{
                  padding: '6px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                  border: isActive ? '2px solid #7C3AED' : '1px solid #E2E8F0',
                  backgroundColor: isActive ? '#F5F3FF' : 'white',
                  color: isActive ? '#7C3AED' : 'var(--secondary)',
                }}
              >
                {formatFechaLabel(f.fecha)}
                {f.filename && <span style={{ fontWeight: 400, fontSize: '0.73rem', color: '#94A3B8', marginLeft: '6px' }}>{f.filename}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Módulo principal ──────────────────────────────────────────────────────────

export default function LabelGeneratorModule({ onBackToHub }) {
  const [registros, setRegistros]         = useState([]);
  const [fileName, setFileName]           = useState('');
  const [fechaCSV, setFechaCSV]           = useState('');
  const [fechaActivaISO, setFechaActivaISO] = useState('');
  const [error, setError]                 = useState('');
  const [isDragging, setIsDragging]       = useState(false);
  const [expandedRow, setExpandedRow]     = useState(null);
  const [filterRegion, setFilterRegion]   = useState('');
  const [filterMatriz, setFilterMatriz]   = useState('');
  const [saving, setSaving]               = useState(false);
  const [savedOk, setSavedOk]             = useState(false);
  const [fechasDisp, setFechasDisp]       = useState([]);
  const [savingCell, setSavingCell]       = useState(null);

  // Cargar fechas disponibles al montar
  useEffect(() => {
    cargarFechasDisponibles().then(setFechasDisp);
  }, []);

  // Actualizar un campo de un registro (local + DB si tiene id)
  const updateField = useCallback(async (index, campo, valor) => {
    setRegistros(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [campo]: valor };
      return next;
    });
    const reg = registros[index];
    if (reg?.id) {
      setSavingCell(reg.id);
      await actualizarRegistro(reg.id, campo, valor);
      setSavingCell(null);
    }
  }, [registros]);

  const procesarArchivo = useCallback((file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) { setError('El archivo debe ser un CSV (.csv)'); return; }
    setError(''); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = parseCSV(e.target.result);
        if (!parsed.length) { setError('No se encontraron registros válidos en el CSV.'); return; }
        const primerFecha = parsed.find(r => r.fecha)?.fecha || '';
        setRegistros(parsed);
        setFechaCSV(primerFecha);
        setFechaActivaISO('');
        setExpandedRow(null); setFilterRegion(''); setFilterMatriz('');

        setSaving(true); setSavedOk(false);
        const res = await guardarImport(parsed, primerFecha, file.name);
        setSaving(false);
        if (!res.error) {
          setSavedOk(true);
          setTimeout(() => setSavedOk(false), 3000);
          const fechas = await cargarFechasDisponibles();
          setFechasDisp(fechas);
          if (primerFecha) {
            const parts = primerFecha.split('/');
            const iso = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
            const cargados = await cargarRegistrosDeFecha(iso);
            setRegistros(cargados);
            setFechaActivaISO(iso);
          }
        } else { setError('Error al guardar: ' + res.error); }
      } catch (err) { setError('Error al parsear el CSV: ' + err.message); }
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const cargarHistorico = useCallback(async (fechaISO) => {
    setError(''); setExpandedRow(null); setFilterRegion(''); setFilterMatriz('');
    const recs = await cargarRegistrosDeFecha(fechaISO);
    if (!recs.length) { setError('No se encontraron registros para esa fecha.'); return; }
    setRegistros(recs);
    setFechaCSV(recs[0]?.fecha || '');
    setFechaActivaISO(fechaISO);
    setFileName('');
  }, []);

  const onFileInput = (e) => procesarArchivo(e.target.files[0]);
  const onDrop = (e) => { e.preventDefault(); setIsDragging(false); procesarArchivo(e.dataTransfer.files[0]); };

  // Stats
  const nA = registros.filter(r => r.matriz === 'A').length;
  const nB = registros.filter(r => r.matriz === 'B').length;
  const regiones = [...new Set(registros.map(r => r.region).filter(Boolean))].sort();
  const filtrados = registros.filter(r => (!filterRegion || r.region === filterRegion) && (!filterMatriz || r.matriz === filterMatriz));
  const fechaLabel = fechaCSV ? normalizarFecha(fechaCSV) : '';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <header style={{ backgroundColor: 'var(--secondary)', color: 'white', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={onBackToHub} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
            <ArrowLeft size={16} /> Hub
          </button>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
          <Tag size={18} style={{ color: '#7DD3FC' }} />
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>Generador de Etiquetas</span>
          {fechaLabel && <span style={{ fontSize: '0.78rem', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '6px', padding: '2px 10px', color: 'rgba(255,255,255,0.8)' }}>{fechaLabel}</span>}
          {saving && <span style={{ fontSize: '0.78rem', color: '#7DD3FC', display: 'flex', alignItems: 'center', gap: '4px' }}><Save size={13} /> Guardando…</span>}
          {savedOk && <span style={{ fontSize: '0.78rem', color: '#86EFAC', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={13} /> Guardado</span>}
        </div>
        {registros.length > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => exportarPDFLab(registros, fechaCSV)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: '#DC2626', color: 'white', fontWeight: 700, fontSize: '0.82rem' }}>
              <FileText size={15} /> PDF LAB
            </button>
            <button onClick={() => exportarResumen(registros, fechaCSV)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: '#0891B2', color: 'white', fontWeight: 700, fontSize: '0.82rem' }}>
              <FileSpreadsheet size={15} /> XLS Resumen
            </button>
            <button onClick={() => exportarEtiquetas(registros, fechaCSV)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: '#16A34A', color: 'white', fontWeight: 700, fontSize: '0.82rem' }}>
              <Download size={15} /> XLS Etiquetas
            </button>
          </div>
        )}
      </header>

      <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '28px 24px' }}>

        <PtouchGuide />
        <HistoricoPanel fechas={fechasDisp} fechaActiva={fechaActivaISO} onSelect={cargarHistorico} />

        {/* ── Zona de carga ── */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          style={{ border: `2px dashed ${isDragging ? 'var(--primary)' : '#CBD5E1'}`, borderRadius: '14px', padding: '32px', backgroundColor: isDragging ? 'var(--primary-light)' : 'white', textAlign: 'center', transition: 'all 0.15s', marginBottom: '24px', cursor: 'pointer' }}
          onClick={() => document.getElementById('csv-input').click()}
        >
          <input id="csv-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={onFileInput} />
          <Upload size={32} color={isDragging ? 'var(--primary)' : '#94A3B8'} style={{ marginBottom: '8px' }} />
          {fileName
            ? <div><div style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '1rem' }}>{fileName}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Haz clic o arrastra un nuevo CSV para reemplazar</div></div>
            : <div><div style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '1rem' }}>Arrastra el CSV de HS Manager aquí</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>o haz clic para seleccionar · Se guardará automáticamente</div></div>
          }
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
              <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6, textAlign: 'right' }}>
                <div>✏️ <strong>Haz clic en A/B</strong> para cambiar la Matriz</div>
                <div>✏️ <strong>Haz clic en la muestra</strong> para editar la descripción</div>
              </div>
            </div>

            {/* ── Filtros ── */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
              <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--secondary)', backgroundColor: 'white' }}>
                <option value="">Todas las regiones</option>
                {regiones.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={filterMatriz} onChange={e => setFilterMatriz(e.target.value)} style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--secondary)', backgroundColor: 'white' }}>
                <option value="">Todas las matrices</option>
                <option value="A">Matriz A</option>
                <option value="B">Matriz B</option>
              </select>
              {(filterRegion || filterMatriz) && (
                <button onClick={() => { setFilterRegion(''); setFilterMatriz(''); }} style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.82rem', backgroundColor: 'white', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>
                  <X size={13} style={{ verticalAlign: 'middle' }} /> Limpiar
                </button>
              )}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{filtrados.length} registros</span>
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
                  {filtrados.map((r, idx) => {
                    const realIdx = registros.findIndex(x => x === r || (x.id && x.id === r.id) || (!x.id && x.numero === r.numero && x.muestra === r.muestra));
                    const isExp    = expandedRow === idx;
                    const rowBg    = idx % 2 === 0 ? 'white' : '#F8FAFC';
                    const mColor   = r.matriz === 'B' ? '#0891B2' : '#16A34A';
                    const mBg      = r.matriz === 'B' ? '#ECFEFF' : '#F0FDF4';
                    const mBorder  = r.matriz === 'B' ? '#A5F3FC' : '#BBF7D0';
                    const isSavingThis = savingCell === r.id;

                    return (
                      <React.Fragment key={r.id || idx}>
                        <tr style={{ backgroundColor: isExp ? '#EFF6FF' : rowBg, borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => setExpandedRow(isExp ? null : idx)}>
                            {r.numero}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => setExpandedRow(isExp ? null : idx)}>
                            {r.establecimiento}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setExpandedRow(isExp ? null : idx)}>
                            {r.region}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => setExpandedRow(isExp ? null : idx)}>
                            {r.analitica}
                          </td>
                          <td style={{ padding: '6px 10px', maxWidth: '200px' }}>
                            <EditableText
                              value={r.muestra}
                              onChange={val => updateField(realIdx, 'muestra', val)}
                              saving={isSavingThis}
                            />
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <MatrizToggle
                              value={r.matriz}
                              onChange={val => updateField(realIdx, 'matriz', val)}
                              saving={isSavingThis}
                            />
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94A3B8', cursor: 'pointer' }} onClick={() => setExpandedRow(isExp ? null : idx)}>
                            {isExp ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </td>
                        </tr>

                        {isExp && (
                          <tr style={{ backgroundColor: '#F0F9FF', borderBottom: '2px solid var(--primary)' }}>
                            <td colSpan={7} style={{ padding: '14px 20px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                                {[['Grupo', r.grupo], ['Condiciones', r.condicion], ['Fecha recogida', r.fecha], ['Hora', r.hora], ['Estado', r.estado]].map(([lbl, val]) => (
                                  <div key={lbl}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{lbl}</span>
                                    <div style={{ fontWeight: 600, color: 'var(--secondary)', fontSize: '0.85rem' }}>{val || '—'}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview 9 etiquetas</div>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {LABEL_TIPOS.map((t, li) => {
                                  const tipo = t === null ? `Matriz ${r.matriz}` : (t || '—');
                                  const isMatriz = t === null;
                                  return (
                                    <div key={li} style={{ backgroundColor: isMatriz ? mBg : '#F8FAFC', border: `1px solid ${isMatriz ? mBorder : '#E2E8F0'}`, borderRadius: '6px', padding: '5px 10px', fontSize: '0.75rem', fontWeight: isMatriz ? 800 : 600, color: isMatriz ? mColor : '#475569', minWidth: '52px', textAlign: 'center' }}>
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
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>No hay registros con los filtros seleccionados.</div>
              )}
            </div>

            {/* ── Botones exportar abajo ── */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px', flexWrap: 'wrap' }}>
              <button
                onClick={() => exportarPDFLab(registros, fechaCSV)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 22px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: '#DC2626', color: 'white', fontWeight: 700, fontSize: '0.9rem', boxShadow: '0 2px 8px rgba(220,38,38,0.3)' }}
              >
                <FileText size={17} /> Generar PDF LAB
              </button>
              <button
                onClick={() => exportarResumen(registros, fechaCSV)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 22px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: '#0891B2', color: 'white', fontWeight: 700, fontSize: '0.9rem', boxShadow: '0 2px 8px rgba(8,145,178,0.3)' }}
              >
                <FileSpreadsheet size={17} /> Exportar XLS Resumen
              </button>
              <button
                onClick={() => exportarEtiquetas(registros, fechaCSV)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 22px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: '#16A34A', color: 'white', fontWeight: 700, fontSize: '0.9rem', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}
              >
                <Download size={17} /> XLS Etiquetas ({registros.length * 9} filas)
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

// ── Celda editable: Muestra (texto) ──────────────────────────────────────────

function EditableText({ value, onChange, saving }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        style={{ width: '100%', padding: '4px 8px', border: '1.5px solid var(--primary)', borderRadius: '6px', fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit' }}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title="Clic para editar la descripción"
      style={{ padding: '4px 8px', borderRadius: '6px', border: '1px dashed transparent', cursor: 'text', color: saving ? '#94A3B8' : 'var(--secondary)', fontSize: '0.82rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'border-color 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#CBD5E1'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
    >
      {value || <span style={{ color: '#CBD5E1', fontStyle: 'italic' }}>—</span>}
    </div>
  );
}

// ── Celda editable: Matriz (toggle A/B) ──────────────────────────────────────

function MatrizToggle({ value, onChange, saving }) {
  const isB   = value === 'B';
  const color  = isB ? '#0891B2' : '#16A34A';
  const bg     = isB ? '#ECFEFF' : '#F0FDF4';
  const border = isB ? '#A5F3FC' : '#BBF7D0';

  return (
    <button
      onClick={() => onChange(isB ? 'A' : 'B')}
      title={`Clic para cambiar a Matriz ${isB ? 'A' : 'B'}`}
      disabled={saving}
      style={{
        fontSize: '0.72rem', fontWeight: 800, color, backgroundColor: bg,
        border: `1.5px solid ${border}`, borderRadius: '6px', padding: '3px 10px',
        cursor: saving ? 'wait' : 'pointer', transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: '5px',
      }}
    >
      Matriz {value}
      <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>⇄</span>
    </button>
  );
}
