import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { ArrowLeft, Upload, Download, Trash2, AlertCircle, CheckCircle, Loader, ClipboardList, Archive } from 'lucide-react';

// ─── Configuración de hojas: headers exactos del importador HSLAB ───────────
const SHEET_CONFIG = {
  '3.1 Legionella spp': {
    label: 'Legionella spp (ACS / Red)',
    color: '#16a34a',
    headers: [
      'Código de analítica','Establecimiento','Lugar','Descripción',
      'F. Recogida','H. Recogida','F. Entrada','F. Inicio Análisis','F. Fin Análisis',
      'Resultado','Apto con parámetros a revisar','Comentarios',
      'Cloro Libre Residual in situ','Bromo en México','Temperatura in situ','pH',
      'Turbidez (*)','Hierro (*)','Índice de Langelier  (*)',
      'Recuento Aerobios mesófilos 22ºC  (*)',
      'Recuento de Legionella spp. Según UNE EN ISO 11731:2017',
      'Recuento de Legionella spp. Según UNE EN ISO 11731:2017.',
      'Identificación Legionella pneumophilla serogrupo 1',
      'Identificación de Legionella pneumophilla Serogrupo 2-14',
      'Legionella pneumophilla por qPCR','Legionella spp. por qPCR',
    ],
    toRow: (s) => {
      const r = new Array(26).fill('');
      r[0]=s.codigo; r[1]=s.establecimiento; r[2]=s.lugar||s.punto; r[3]=s.descripcion;
      r[4]=s.fecha_recogida; r[5]=s.hora_recogida; r[6]=s.fecha_entrada;
      r[7]=s.fecha_inicio; r[8]=s.fecha_fin; r[9]=s.resultado||'APTO'; r[11]=s.comentarios;
      r[12]=s.cloro_libre; r[14]=s.temperatura; r[15]=s.ph; r[17]=s.hierro; r[19]=s.aerobios_22;
      r[20]=s.legionella_spp;
      return r.map(v => v || '');
    },
  },
  '3.1.4 Legionella pneumophilla': {
    label: 'Legionella pneumophilla',
    color: '#0369a1',
    headers: [
      'Código de analítica','Establecimiento','Lugar','Descripción',
      'F. Recogida','H. Recogida','F. Entrada','F. Inicio Análisis','F. Fin Análisis',
      'Resultado','Apto con parámetros a revisar','Comentarios',
      'Cloro Libre Residual in situ','Temperatura in situ','pH','Índice de Langelier',
      'Aerobios mesófilos totales','Legionella pneumophilla','Legionella spp.',
    ],
    toRow: (s) => {
      const r = new Array(19).fill('');
      r[0]=s.codigo; r[1]=s.establecimiento; r[2]=s.lugar||s.punto; r[3]=s.descripcion;
      r[4]=s.fecha_recogida; r[5]=s.hora_recogida; r[6]=s.fecha_entrada;
      r[7]=s.fecha_inicio; r[8]=s.fecha_fin; r[9]=s.resultado||'APTO'; r[11]=s.comentarios;
      r[12]=s.cloro_libre; r[13]=s.temperatura; r[14]=s.ph; r[16]=s.aerobios_22;
      r[17]=s.legionella_pneumo; r[18]=s.legionella_spp;
      return r.map(v => v || '');
    },
  },
  '3.13 Control de Grifos': {
    label: 'Control de Grifos',
    color: '#b45309',
    headers: [
      'Código de analítica','Establecimiento','Lugar','Descripción',
      'F. Recogida','H. Recogida','F. Entrada','F. Inicio Análisis','F. Fin Análisis',
      'Resultado','Apto con parámetros a revisar','Comentarios',
      'Cloro Libre Residual','Aerobios mesófilos','Escherichia coli',
      'Coliformes fecales','Legionella spp','Legionella spp (2)',
    ],
    toRow: (s) => {
      const r = new Array(18).fill('');
      r[0]=s.codigo; r[1]=s.establecimiento; r[2]=s.lugar||s.punto; r[3]=s.descripcion;
      r[4]=s.fecha_recogida; r[5]=s.hora_recogida; r[6]=s.fecha_entrada;
      r[7]=s.fecha_inicio; r[8]=s.fecha_fin; r[9]=s.resultado||'APTO'; r[11]=s.comentarios;
      r[12]=s.cloro_libre; r[13]=s.aerobios_22; r[16]=s.legionella_spp;
      return r.map(v => v || '');
    },
  },
  '2.1 Piscina Exterior': {
    label: 'Piscina Exterior',
    color: '#0891b2',
    headers: [
      'Código de analítica','Establecimiento','Lugar','Descripción',
      'F. Recogida','H. Recogida','F. Entrada','F. Inicio Análisis','F. Fin Análisis',
      'Resultado','Apto con parámetros a revisar','Comentarios',
      'pH in situ','Cloro Libre Residual in Situ','Bromo','Cloro Combinado Residual',
      'Temperatura In Situ','Aluminio','Cobre','Amonio',
      'Diferencia Conductividad vaso ‐ agua de llenado','Oxidabilidad (vaso - agua de llenado)',
      'Nitratos','Turbidez','Tiempo de recirculación','Transparencia',
      'Ácido Isocianúrico','Dureza cálcica','Alcalinidad ','Índice Langelier',
      'Aerobios Mesófilos Totales a 22 ºC','Escherichia Coli','Coliformes totales',
      'Pseudomonas Aeruginosa','Staphylococcus aureus','Estreptococos fecales',
      'Heterótrofos a 36 ºC','Legionella spp',
    ],
    toRow: (s) => {
      const r = new Array(38).fill('');
      r[0]=s.codigo; r[1]=s.establecimiento; r[2]=s.lugar||s.punto; r[3]=s.descripcion;
      r[4]=s.fecha_recogida; r[5]=s.hora_recogida; r[6]=s.fecha_entrada;
      r[7]=s.fecha_inicio; r[8]=s.fecha_fin; r[9]=s.resultado||'APTO'; r[11]=s.comentarios;
      r[12]=s.ph; r[13]=s.cloro_libre; r[15]=s.cloro_combinado; r[16]=s.temperatura;
      r[30]=s.aerobios_22; r[37]=s.legionella_spp;
      return r.map(v => v || '');
    },
  },
  '2.1.1 Piscina Exterior con Legionella': {
    label: 'P. Exterior + Legionella',
    color: '#0284c7',
    headers: [
      'Código de analítica','Establecimiento','Lugar','Descripción',
      'F. Recogida','H. Recogida','F. Entrada','F. Inicio Análisis','F. Fin Análisis',
      'Resultado','Apto con parámetros a revisar','Comentarios',
      'pH in situ','Cloro Libre Residual in Situ','Bromo','Cloro Combinado Residual',
      'Temperatura In Situ','Aluminio','Cobre','Amonio',
      'Diferencia Conductividad vaso ‐ agua de llenado','Oxidabilidad (vaso - agua de llenado)',
      'Nitratos','Turbidez','Tiempo de recirculación','Transparencia',
      'Ácido Isocianúrico','Dureza cálcica','Alcalinidad','Índice Langelier',
      'Escherichia Coli','Coliformes totales','Pseudomonas Aeruginosa',
      'Staphylococcus aureus','Estreptococos fecales','Heterótrofos a 36 ºC',
      'Legionella spp','Hierro','Recuento de Aerobios Masófilos a 22ºC',
      'Recuento de Legionella spp. según ISO 11731:2017',
      'Recuento de Legionella spp. según ISO 11731:2017.',
      'Identificación de Legionella pneumophila Serogrupo 1',
      'Identificación de Legionella pneumophila Serogrupo 2 - 14',
    ],
    toRow: (s) => {
      const r = new Array(43).fill('');
      r[0]=s.codigo; r[1]=s.establecimiento; r[2]=s.lugar||s.punto; r[3]=s.descripcion;
      r[4]=s.fecha_recogida; r[5]=s.hora_recogida; r[6]=s.fecha_entrada;
      r[7]=s.fecha_inicio; r[8]=s.fecha_fin; r[9]=s.resultado||'APTO'; r[11]=s.comentarios;
      r[12]=s.ph; r[13]=s.cloro_libre; r[15]=s.cloro_combinado; r[16]=s.temperatura;
      r[36]=s.legionella_spp; r[37]=s.hierro; r[38]=s.aerobios_22; r[39]=s.legionella_spp; r[41]=s.legionella_pneumo;
      return r.map(v => v || '');
    },
  },
  '2.1.2 Piscina Exterior con Legionella (*)': {
    label: 'P. Exterior + Leg. (*)',
    color: '#0369a1',
    headers: [
      'Código de analítica','Establecimiento','Lugar','Descripción',
      'F. Recogida','H. Recogida','F. Entrada','F. Inicio Análisis','F. Fin Análisis',
      'Resultado','Apto con parámetros a revisar','Comentarios',
      'pH in situ (*)','Cloro Libre Residual in Situ (*)','Bromo (*)','Cloro Combinado Residual (*)',
      'Temperatura In Situ (*)','Aluminio  (*)','Cobre  (*)','Amonio  (*)',
      'Diferencia Conductividad vaso ‐ agua de llenado  (*)','Oxidabilidad (vaso - agua de llenado) (*)',
      'Nitratos  (*)','Turbidez (*)','Tiempo de recirculación  (*)','Transparencia  (*)',
      'Ácido Isocianúrico  (*)','Dureza cálcica  (*)','Alcalinidad  (*)','Índice Langelier (*)',
      'Escherichia Coli (*)','Coliformes totales (*)','Pseudomonas Aeruginosa (*)',
      'Staphylococcus aureus (*)','Estreptococos fecales  (*)','Heterótrofos a 36 ºC  (*)',
      'Legionella spp','Hierro (*)','Aerobios Mesófilos a 22ºC (*)',
      'Recuento de Legionella spp. según ISO 11731:2017',
      'Recuento de Legionella spp. según ISO 11731:2017.',
      'Identificación de Legionella pneumophila Serogrupo 1',
      'Identificación de Legionella pneumophila Serogrupo 2 - 14',
    ],
    toRow: (s) => {
      const r = new Array(43).fill('');
      r[0]=s.codigo; r[1]=s.establecimiento; r[2]=s.lugar||s.punto; r[3]=s.descripcion;
      r[4]=s.fecha_recogida; r[5]=s.hora_recogida; r[6]=s.fecha_entrada;
      r[7]=s.fecha_inicio; r[8]=s.fecha_fin; r[9]=s.resultado||'APTO'; r[11]=s.comentarios;
      r[12]=s.ph; r[13]=s.cloro_libre; r[15]=s.cloro_combinado; r[16]=s.temperatura;
      r[36]=s.legionella_spp; r[37]=s.hierro; r[38]=s.aerobios_22; r[39]=s.legionella_spp; r[41]=s.legionella_pneumo;
      return r.map(v => v || '');
    },
  },
  '2.2 Piscina tipo Spa': {
    label: 'Piscina tipo Spa / Cubierta',
    color: '#7c3aed',
    headers: [
      'Código de analítica','Establecimiento','Lugar','Descripción',
      'F. Recogida','H. Recogida','F. Entrada','F. Inicio Análisis','F. Fin Análisis',
      'Resultado','Apto con parámetros a revisar','Comentarios',
      'pH in situ','Cloro Libre Residual in situ','Cloro Combinado Residual','Bromo Total ',
      'Cobre','Amonio','Diferencia Conductividad vaso ‐ agua de llenado',
      'Oxidabilidad (vaso - agua de llenado)','Cloro Total ','Temperatura in situ',
      'Turbidez','Ácido Isocianúrico','Aluminio','Transparencia',
      'Dureza cálcica','Alcalinidad','Índice Langelier','Tiempo de recirculación',
      'Humedad Relativa Aire','Temperatura Ambiente',
      'Concentración Dióxido de Carbono (Diferencia Interior - Exterior)',
      'CO2 Interior','CO2 Exterior','Coliformes totales','Escherichia Coli',
      'Pseudomonas Aeruginosa','Staphylococcus aureus','Heterótrofos a 36 ºC',
      'Estreptococos fecales','Legionella spp','Nitratos',
      'Legionella pneumophilla','Aerobios Mesófilos Totales a 22ºC',
      'Legionella spp. ','Legionella pneumophilla',
      'Recuento de Legionella spp. según ISO 11731:2017.',
    ],
    toRow: (s) => {
      const r = new Array(48).fill('');
      r[0]=s.codigo; r[1]=s.establecimiento; r[2]=s.lugar||s.punto; r[3]=s.descripcion;
      r[4]=s.fecha_recogida; r[5]=s.hora_recogida; r[6]=s.fecha_entrada;
      r[7]=s.fecha_inicio; r[8]=s.fecha_fin; r[9]=s.resultado||'APTO'; r[11]=s.comentarios;
      r[12]=s.ph; r[13]=s.cloro_libre; r[14]=s.cloro_combinado; r[21]=s.temperatura;
      r[41]=s.legionella_spp; r[43]=s.legionella_pneumo; r[47]=s.legionella_spp;
      return r.map(v => v || '');
    },
  },
  '2.3 Vaso de hidromasaje': {
    label: 'Vaso de Hidromasaje / Jacuzzi',
    color: '#be185d',
    headers: [
      'Código de analítica','Establecimiento','Lugar','Descripción',
      'F. Recogida','H. Recogida','F. Entrada','F. Inicio Análisis','F. Fin Análisis',
      'Resultado','Apto con parámetros a revisar','Comentarios',
      'pH in situ','Cloro Libre Residual in situ','Cloro Combinado Residual in situ',
      'Bromo Total','Cobre','Amonio','Oxidabilidad (vaso - agua de llenado)',
      'Temperatura in situ','Turbidez','Ácido Isocianúrico','Aluminio','Transparencia',
      'Humedad Relativa Aire',
      'Concentración Dióxido de Carbono (Diferencia Interior - Exterior)',
      'Dureza cálcica','Alcalinidad','Índice de Langelier','Tiempo de recirculación',
      'Coliformes totales','Cloro Total (Cl2)','Escherichia Coli',
      'Pseudomonas Aeruginosa','Staphylococcus aureus','Heterótrofos a 36 ºC',
      'Estreptococos fecales','Legionella spp','Legionella pneumophilla',
      'Legionella spp.','Aerobios mesófilos totales','Legionella pneumophilla',
      'Recuento de Legionella spp. según ISO 11731:2017.',
      'Recuento de aerobios mesófilos a 22 ºC',
    ],
    toRow: (s) => {
      const r = new Array(44).fill('');
      r[0]=s.codigo; r[1]=s.establecimiento; r[2]=s.lugar||s.punto; r[3]=s.descripcion;
      r[4]=s.fecha_recogida; r[5]=s.hora_recogida; r[6]=s.fecha_entrada;
      r[7]=s.fecha_inicio; r[8]=s.fecha_fin; r[9]=s.resultado||'APTO'; r[11]=s.comentarios;
      r[12]=s.ph; r[13]=s.cloro_libre; r[14]=s.cloro_combinado; r[19]=s.temperatura;
      r[37]=s.legionella_spp; r[38]=s.legionella_pneumo; r[42]=s.legionella_spp;
      return r.map(v => v || '');
    },
  },
  '2.4 Piscina Decreto 140 2009': {
    label: 'Piscina Decreto 140/2009',
    color: '#ea580c',
    headers: [
      'Código de analítica','Establecimiento','Lugar','Descripción',
      'F. Recogida','H. Recogida','F. Entrada','F. Inicio Análisis','F. Fin Análisis',
      'Resultado','Apto con parámetros a revisar','Comentarios',
      'pH','Bromo','Turbidez','Temperatura',
      'Conductividad (Diferencia con agua de aporte)',
      'Oxidabilidad (diferencia agua de aporte)','Nitratos','Amoniaco',
      'Bacterias aerobias a 36ºC','Bacterias coliformes','Escherichia coli',
      'Enterococos intestinales','Staphylococcus aureus','Pseudomonas aeruginosa',
      'Legionella spp.',
    ],
    toRow: (s) => {
      const r = new Array(27).fill('');
      r[0]=s.codigo; r[1]=s.establecimiento; r[2]=s.lugar||s.punto; r[3]=s.descripcion;
      r[4]=s.fecha_recogida; r[5]=s.hora_recogida; r[6]=s.fecha_entrada;
      r[7]=s.fecha_inicio; r[8]=s.fecha_fin; r[9]=s.resultado||'APTO'; r[11]=s.comentarios;
      r[12]=s.ph; r[15]=s.temperatura; r[26]=s.legionella_spp;
      return r.map(v => v || '');
    },
  },
  'Legionella VALPE21': {
    label: 'Legionella VALPE21',
    color: '#64748b',
    headers: [
      'Código de analítica','Establecimiento','Lugar','Descripción',
      'F. Recogida','H. Recogida','F. Entrada','F. Inicio Análisis','F. Fin Análisis',
      'Resultado','Apto con parámetros a revisar','Comentarios',
      'Tª muestra en ºC','Cloro libre residual',
      'Detección y recuento de Legionella spp','Identificación de Legionella pneumophila',
      'Recuento de Legionella','Hierro',
      'Concentración de la muestra por filtración',
      'Concentración de la muestra por centrifugación',
      'Recuento de microorganismos aerobios a 36 ºC',
      'Recuento de microorganismos aerobios a 22 ºC',
    ],
    toRow: (s) => {
      const r = new Array(22).fill('');
      r[0]=s.codigo; r[1]=s.establecimiento; r[2]=s.lugar||s.punto; r[3]=s.descripcion;
      r[4]=s.fecha_recogida; r[5]=s.hora_recogida; r[6]=s.fecha_entrada;
      r[7]=s.fecha_inicio; r[8]=s.fecha_fin; r[9]=s.resultado||'APTO'; r[11]=s.comentarios;
      r[12]=s.temperatura; r[13]=s.cloro_libre; r[14]=s.legionella_spp;
      r[15]=s.legionella_pneumo; r[16]=s.legionella_spp; r[17]=s.hierro;
      return r.map(v => v || '');
    },
  },
};

const SHEET_TYPES = Object.keys(SHEET_CONFIG);

const EDITABLE_FIELDS = [
  { key: 'codigo', label: 'Código', width: 110 },
  { key: 'establecimiento', label: 'Establecimiento', width: 200 },
  { key: 'punto', label: 'Punto muestreo', width: 140 },
  { key: 'fecha_recogida', label: 'F. Recogida', width: 100 },
  { key: 'hora_recogida', label: 'Hora', width: 70 },
  { key: 'fecha_entrada', label: 'F. Entrada', width: 100 },
  { key: 'fecha_fin', label: 'F. Fin', width: 100 },
  { key: 'ph', label: 'pH', width: 60 },
  { key: 'cloro_libre', label: 'Cl libre', width: 70 },
  { key: 'cloro_combinado', label: 'Cl comb.', width: 70 },
  { key: 'temperatura', label: 'Tª ºC', width: 65 },
  { key: 'aerobios_22', label: 'Aerobios', width: 85 },
  { key: 'hierro', label: 'Hierro mg/L', width: 90 },
  { key: 'legionella_spp', label: 'Legionella spp', width: 115 },
  { key: 'legionella_pneumo', label: 'L.pneumo', width: 100 },
  { key: 'resultado', label: 'Resultado', width: 90 },
];

// ─── Parseo CSV con soporte a saltos de línea dentro de campos entre comillas ──
function parseCSV(text) {
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ';' && !inQuotes) {
      record.push(field.trim()); field = '';
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      record.push(field.trim()); field = '';
      if (record.some(f => f !== '')) { records.push(record); }
      record = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || record.length > 0) { record.push(field.trim()); records.push(record); }
  return records;
}

// ─── Construye mapa EC → pendiente a partir del CSV de HSLAB ──────────────────
// Columnas esperadas (separador ;): 0=Id, 1=Número(EC), 5=Grupo, 6=Establecimiento,
// 9=Analítica, 10=Fecha recogida, 11=Hora recogida, 13=Muestra
function buildPendingMap(text) {
  const records = parseCSV(text);
  const map = {};
  for (let i = 1; i < records.length; i++) {
    const c = records[i];
    const ec = c[1];
    if (!ec || !ec.startsWith('EC')) continue;
    map[ec] = {
      analitica: c[9] || '',
      grupo: c[5] || '',
      establecimiento: c[6] || '',
      muestra: c[13] || '',
      fecha_recogida: c[10] || '',
      hora_recogida: c[11] || '',
    };
  }
  return map;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ImportadorPDFModule({ onBackToHub }) {
  const [rows, setRows] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [pendingMap, setPendingMap] = useState({});   // { EC...: { analitica, establecimiento, muestra, ... } }
  const pendingMapRef = useRef({});                    // ref para acceso desde callback sin stale closure
  const filesRef = useRef({});                         // rowId → File original (para ZIP renombrado)
  const fileInput = useRef();
  const csvInput = useRef();

  // ── Carga CSV de muestras pendientes ──
  const handleLoadCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const map = buildPendingMap(ev.target.result);
      pendingMapRef.current = map;
      setPendingMap(map);
      // Re-evaluar filas ya cargadas
      setRows(prev => prev.map(r => {
        if (r.status !== 'ok' || !r.fields.codigo) return r;
        const pending = map[r.fields.codigo];
        if (!pending) return { ...r, matchStatus: 'unmatched' };
        const fields = { ...r.fields };
        if (pending.analitica && SHEET_CONFIG[pending.analitica]) fields.tipo_hoja = pending.analitica;
        if (!fields.punto && pending.muestra) fields.punto = pending.muestra;
        if (!fields.hora_recogida && pending.hora_recogida) fields.hora_recogida = pending.hora_recogida;
        if (!fields.establecimiento && pending.establecimiento) fields.establecimiento = pending.establecimiento;
        return { ...r, fields, matchStatus: 'matched', matchedPending: pending };
      }));
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  // ── Procesa PDFs (hasta 4 en paralelo) ──
  const CONCURRENCY = 4;
  const processFiles = useCallback(async (files) => {
    const arr = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (!arr.length) return;
    setProcessing(true);

    const newRows = arr.map(f => ({
      id: `${Date.now()}_${Math.random()}_${f.name}`,
      filename: f.name,
      status: 'processing',
      error: null,
      fields: {},
      matchStatus: null,
      matchedPending: null,
    }));
    setRows(prev => [...prev, ...newRows]);

    // Guarda File original para ZIP renombrado
    arr.forEach((file, i) => { filesRef.current[newRows[i].id] = file; });

    const processOne = async (file, rowId) => {
      try {
        const bytes = await file.arrayBuffer();
        // btoa no soporta ficheros grandes (>~500KB); usar base64 con chunks
        const uint8 = new Uint8Array(bytes);
        let b64 = '';
        for (let c = 0; c < uint8.length; c += 8192) {
          b64 += String.fromCharCode(...uint8.subarray(c, c + 8192));
        }
        b64 = btoa(b64);

        const resp = await fetch('/.netlify/functions/pdf-extractor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdf_base64: b64, filename: file.name }),
        });
        const data = await resp.json();
        if (!data.ok) throw new Error(data.error);

        const fields = data.fields;

        let matchStatus = Object.keys(pendingMapRef.current).length > 0 ? 'unmatched' : null;
        let matchedPending = null;
        const pending = pendingMapRef.current[fields.codigo];
        if (pending) {
          matchStatus = 'matched';
          matchedPending = pending;
          if (pending.analitica && SHEET_CONFIG[pending.analitica]) fields.tipo_hoja = pending.analitica;
          if (!fields.punto && pending.muestra) fields.punto = pending.muestra;
          if (!fields.hora_recogida && pending.hora_recogida) fields.hora_recogida = pending.hora_recogida;
          if (!fields.establecimiento && pending.establecimiento) fields.establecimiento = pending.establecimiento;
        }

        setRows(prev => prev.map(r => r.id === rowId
          ? { ...r, status: 'ok', fields, matchStatus, matchedPending }
          : r
        ));
      } catch (err) {
        setRows(prev => prev.map(r => r.id === rowId
          ? { ...r, status: 'error', error: err.message }
          : r
        ));
      }
    };

    // Procesa en lotes de CONCURRENCY
    for (let i = 0; i < arr.length; i += CONCURRENCY) {
      const batch = arr.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((file, j) => processOne(file, newRows[i + j].id)));
    }
    setProcessing(false);
  }, []);

  const onFileChange = (e) => { processFiles(e.target.files); e.target.value = ''; };
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); processFiles(e.dataTransfer.files); };
  const updateField = (id, key, value) => setRows(prev => prev.map(r => r.id === id ? { ...r, fields: { ...r.fields, [key]: value } } : r));
  const updateSheet = (id, tipo_hoja) => setRows(prev => prev.map(r => r.id === id ? { ...r, fields: { ...r.fields, tipo_hoja } } : r));
  const removeRow = (id) => { delete filesRef.current[id]; setRows(prev => prev.filter(r => r.id !== id)); };

  // ── Descarga ZIP con PDFs renombrados al código EC ──
  const [zipping, setZipping] = useState(false);
  const downloadZip = async () => {
    const target = okRows;
    if (!target.length) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      const sanitize = (s) => (s || '').replace(/[/\\:*?"<>|]/g, '-').trim();
      for (const row of target) {
        const file = filesRef.current[row.id];
        if (!file) continue;
        const codigo = sanitize(row.fields.codigo) || 'SIN_EC';
        const hotel  = sanitize(row.fields.establecimiento).substring(0, 40);
        const punto  = sanitize(row.fields.punto).substring(0, 30);
        const parts = [codigo, hotel, punto].filter(Boolean);
        const newName = parts.join(' - ') + '.pdf';
        const bytes = await file.arrayBuffer();
        zip.file(newName, bytes);
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HSLAB_PDFs_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  };

  // ── Genera XLS ──
  const generateXLS = (soloMatchadas = false) => {
    const source = rows.filter(r => {
      if (r.status !== 'ok') return false;
      if (soloMatchadas) return r.matchStatus === 'matched';
      return true;
    });
    if (!source.length) return;
    setGenerando(true);
    try {
      const wb = XLSX.utils.book_new();
      const bySheet = {};
      source.forEach(r => {
        const sheet = r.fields.tipo_hoja || '3.1 Legionella spp';
        if (!bySheet[sheet]) bySheet[sheet] = [];
        bySheet[sheet].push(r.fields);
      });
      for (const [sheetName, samples] of Object.entries(bySheet)) {
        const cfg = SHEET_CONFIG[sheetName];
        if (!cfg) continue;
        const aoa = [cfg.headers, ...samples.map(cfg.toRow)];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = cfg.headers.map(() => ({ wch: 20 }));
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
      }
      const fecha = new Date().toISOString().slice(0, 10);
      const suffix = soloMatchadas ? '_cuadradas' : '';
      XLSX.writeFile(wb, `Importador_HSLAB_${fecha}${suffix}.xlsx`);
    } finally {
      setGenerando(false);
    }
  };

  // ── Cómputos de estado ──
  const okRows = rows.filter(r => r.status === 'ok');
  const matchedRows = okRows.filter(r => r.matchStatus === 'matched');
  const unmatchedPDFs = okRows.filter(r => r.matchStatus === 'unmatched');
  const hasPending = Object.keys(pendingMap).length > 0;
  const pendingCount = Object.keys(pendingMap).length;

  // Todas las entradas del CSV, ordenadas: pendientes primero, completadas al final
  const uploadedCodes = new Set(okRows.map(r => r.fields.codigo).filter(Boolean));
  const allPendingEntries = Object.entries(pendingMap).sort(([a], [b]) => {
    const aDone = uploadedCodes.has(a);
    const bDone = uploadedCodes.has(b);
    if (aDone === bDone) return 0;
    return aDone ? 1 : -1;
  });
  const missingCount = allPendingEntries.filter(([ec]) => !uploadedCodes.has(ec)).length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Arial, sans-serif' }}>

      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #0076CE 100%)',
        padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 20,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}>
        <button onClick={onBackToHub} style={{
          background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
          color: 'white', padding: '8px 14px', cursor: 'pointer', display: 'flex',
          alignItems: 'center', gap: 6, fontSize: '0.9rem',
        }}>
          <ArrowLeft size={16} /> Volver
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ color: 'white', margin: 0, fontSize: '1.4rem' }}>Importador PDF → XLS</h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', margin: '4px 0 0', fontSize: '0.85rem' }}>
            Sube informes externos de Legionella y genera el XLS para HS Manager
          </p>
        </div>
      </header>

      <main style={{ padding: '24px 32px', maxWidth: 1700, margin: '0 auto' }}>

        {/* ── Banda de muestras pendientes ── */}
        <div style={{
          backgroundColor: hasPending ? '#f0fdf4' : 'white',
          border: `1px solid ${hasPending ? '#86efac' : '#e2e8f0'}`,
          borderRadius: 12, padding: '14px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <ClipboardList size={20} color={hasPending ? '#16a34a' : '#94a3b8'} />
          {hasPending ? (
            <>
              <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.9rem' }}>
                {pendingCount} muestras pendientes cargadas
              </span>
              <span style={{ color: '#4b7c5a', fontSize: '0.82rem' }}>
                · {matchedRows.length} cuadradas con PDF · {missingCount} sin PDF todavía
              </span>
              <button
                onClick={() => csvInput.current.click()}
                style={{ marginLeft: 'auto', background: 'none', border: '1px solid #86efac', borderRadius: 8, color: '#16a34a', padding: '5px 14px', cursor: 'pointer', fontSize: '0.82rem' }}
              >
                Cambiar CSV
              </button>
            </>
          ) : (
            <>
              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                Carga el CSV de muestras pendientes de HSLAB para cuadrar automáticamente los PDFs
              </span>
              <button
                onClick={() => csvInput.current.click()}
                style={{ marginLeft: 'auto', background: '#0076CE', border: 'none', borderRadius: 8, color: 'white', padding: '7px 18px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
              >
                Cargar CSV pendientes
              </button>
            </>
          )}
          <input ref={csvInput} type="file" accept=".csv" onChange={handleLoadCSV} style={{ display: 'none' }} />
        </div>

        {/* ── Drop zone PDFs ── */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInput.current.click()}
          style={{
            border: `2px dashed ${dragOver ? '#0076CE' : '#cbd5e1'}`,
            borderRadius: 16, padding: '40px 32px', textAlign: 'center',
            cursor: 'pointer', backgroundColor: dragOver ? '#eff6ff' : 'white',
            transition: 'all 0.2s', marginBottom: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <input ref={fileInput} type="file" multiple accept=".pdf" onChange={onFileChange} style={{ display: 'none' }} />
          <Upload size={36} color={dragOver ? '#0076CE' : '#94a3b8'} style={{ marginBottom: 10 }} />
          <p style={{ margin: 0, fontSize: '1rem', color: '#475569', fontWeight: 600 }}>
            Arrastra los PDFs aquí o haz clic para seleccionar
          </p>
          <p style={{ margin: '5px 0 0', color: '#94a3b8', fontSize: '0.82rem' }}>
            Acepta múltiples archivos PDF de Nilsson Laboratorios u otros labs externos
          </p>
          {processing && (
            <p style={{ margin: '10px 0 0', color: '#0076CE', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Procesando PDFs…
            </p>
          )}
        </div>

        {/* ── Tabla de muestras ── */}
        {rows.length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: '0.95rem', color: '#1e3a5f' }}>
                {rows.length} archivo{rows.length !== 1 ? 's' : ''} · {okRows.length} extraído{okRows.length !== 1 ? 's' : ''}
                {hasPending && ` · `}
                {hasPending && <span style={{ color: '#16a34a', fontWeight: 700 }}>{matchedRows.length} cuadrados</span>}
                {hasPending && unmatchedPDFs.length > 0 && <span style={{ color: '#f59e0b' }}> · {unmatchedPDFs.length} sin pendiente</span>}
              </h2>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => { Object.keys(filesRef.current).forEach(k => delete filesRef.current[k]); setRows([]); }}
                  style={{ background: '#fee2e2', border: 'none', borderRadius: 8, color: '#dc2626', padding: '7px 14px', cursor: 'pointer', fontSize: '0.82rem' }}
                >
                  Limpiar todo
                </button>
                {/* ZIP con PDFs renombrados */}
                <button
                  onClick={downloadZip}
                  disabled={okRows.length === 0 || zipping}
                  title="Descarga todos los PDFs renombrados con el código EC en un ZIP"
                  style={{
                    background: okRows.length > 0 ? '#f0fdf4' : '#f8fafc',
                    border: `1px solid ${okRows.length > 0 ? '#86efac' : '#e2e8f0'}`,
                    borderRadius: 8,
                    color: okRows.length > 0 ? '#15803d' : '#94a3b8',
                    padding: '7px 14px',
                    cursor: okRows.length > 0 ? 'pointer' : 'not-allowed',
                    fontSize: '0.82rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <Archive size={13} />
                  {zipping ? 'Comprimiendo…' : `ZIP PDFs (${okRows.length})`}
                </button>
                {hasPending && okRows.length > 0 && (
                  <button
                    onClick={() => generateXLS(false)}
                    disabled={generando}
                    style={{
                      background: '#e0f2fe', border: 'none', borderRadius: 8,
                      color: '#0369a1', padding: '7px 14px',
                      cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <Download size={13} />
                    Generar todo ({okRows.length})
                  </button>
                )}
                <button
                  onClick={() => generateXLS(hasPending)}
                  disabled={(hasPending ? matchedRows.length : okRows.length) === 0 || generando}
                  style={{
                    background: (hasPending ? matchedRows.length : okRows.length) > 0 ? '#0076CE' : '#e2e8f0',
                    border: 'none', borderRadius: 8,
                    color: (hasPending ? matchedRows.length : okRows.length) > 0 ? 'white' : '#94a3b8',
                    padding: '7px 18px',
                    cursor: (hasPending ? matchedRows.length : okRows.length) > 0 ? 'pointer' : 'not-allowed',
                    fontSize: '0.85rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Download size={14} />
                  {generando ? 'Generando…' : hasPending
                    ? `Generar XLS cuadradas (${matchedRows.length})`
                    : `Generar XLS (${okRows.length})`}
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <th style={thStyle}>Estado</th>
                    {hasPending && <th style={thStyle}>Cuadre</th>}
                    <th style={thStyle}>Pestaña HSLAB</th>
                    {EDITABLE_FIELDS.map(f => (
                      <th key={f.key} style={{ ...thStyle, minWidth: f.width }}>{f.label}</th>
                    ))}
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} style={{
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: row.matchStatus === 'matched' ? '#f0fdf4' : row.matchStatus === 'unmatched' ? '#fffbeb' : 'white',
                    }}>
                      {/* Estado extracción */}
                      <td style={tdStyle}>
                        {row.status === 'processing' && <Loader size={16} color="#0076CE" />}
                        {row.status === 'ok' && <CheckCircle size={16} color="#16a34a" />}
                        {row.status === 'error' && <span title={row.error}><AlertCircle size={16} color="#dc2626" /></span>}
                      </td>

                      {/* Columna cuadre (solo si hay CSV cargado) */}
                      {hasPending && (
                        <td style={tdStyle}>
                          {row.matchStatus === 'matched' && (
                            <span title={`Muestra: ${row.matchedPending?.muestra || ''}`}
                              style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                              ✓ Cuadrado
                            </span>
                          )}
                          {row.matchStatus === 'unmatched' && (
                            <span title="EC no encontrado en los pendientes del CSV"
                              style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                              ⚠ Sin pendiente
                            </span>
                          )}
                        </td>
                      )}

                      {/* Selector pestaña */}
                      <td style={{ ...tdStyle, minWidth: 200 }}>
                        {row.status === 'ok' ? (
                          <select
                            value={row.fields.tipo_hoja || '3.1 Legionella spp'}
                            onChange={(e) => updateSheet(row.id, e.target.value)}
                            style={{
                              width: '100%', border: `2px solid ${SHEET_CONFIG[row.fields.tipo_hoja]?.color || '#cbd5e1'}`,
                              borderRadius: 6, padding: '4px 6px', fontSize: '0.78rem',
                              backgroundColor: 'white', color: '#1e293b',
                            }}
                          >
                            {SHEET_TYPES.map(t => (
                              <option key={t} value={t}>{SHEET_CONFIG[t].label}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                            {row.status === 'processing' ? 'Procesando…' : row.error?.substring(0, 40)}
                          </span>
                        )}
                      </td>

                      {/* Campos editables */}
                      {EDITABLE_FIELDS.map(f => (
                        <td key={f.key} style={tdStyle}>
                          {row.status === 'ok' ? (
                            <input
                              value={row.fields[f.key] || ''}
                              onChange={(e) => updateField(row.id, f.key, e.target.value)}
                              style={{
                                width: '100%', border: '1px solid #e2e8f0', borderRadius: 4,
                                padding: '3px 6px', fontSize: '0.78rem',
                                backgroundColor: row.fields[f.key] ? 'white' : '#fafafa',
                                color: '#374151',
                              }}
                            />
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                      ))}

                      {/* Borrar */}
                      <td style={tdStyle}>
                        <button onClick={() => removeRow(row.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                          <Trash2 size={14} color="#dc2626" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Panel: seguimiento de todas las muestras pendientes ── */}
        {hasPending && allPendingEntries.length > 0 && (
          <div style={{
            backgroundColor: 'white', borderRadius: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: 24,
          }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
              <ClipboardList size={18} color="#475569" />
              <h2 style={{ margin: 0, fontSize: '0.95rem', color: '#1e3a5f' }}>
                Seguimiento muestras pendientes
              </h2>
              <span style={{ marginLeft: 8, fontSize: '0.82rem', color: '#64748b' }}>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>{allPendingEntries.length - missingCount} completadas</span>
                {' · '}
                <span style={{ color: '#d97706', fontWeight: 700 }}>{missingCount} pendientes</span>
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <th style={{ ...thStyle, width: 28 }}></th>
                    {['Código EC','Establecimiento','Muestra / Punto','Analítica (HSLAB)','F. Recogida','Hora'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allPendingEntries.map(([ec, p]) => {
                    const done = uploadedCodes.has(ec);
                    return (
                      <tr key={ec} style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: done ? '#f0fdf4' : 'white',
                      }}>
                        {/* Indicador */}
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {done
                            ? <CheckCircle size={15} color="#16a34a" />
                            : <span style={{ display: 'inline-block', width: 15, height: 15, borderRadius: '50%', border: '2px solid #d1d5db' }} />
                          }
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            fontFamily: 'monospace', fontWeight: 700,
                            color: done ? '#15803d' : '#0369a1',
                            textDecoration: done ? 'line-through' : 'none',
                            opacity: done ? 0.7 : 1,
                          }}>
                            {ec}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: done ? '#6b7280' : '#374151' }}>{p.establecimiento}</td>
                        <td style={{ ...tdStyle, color: done ? '#6b7280' : '#374151', fontWeight: done ? 400 : 600 }}>{p.muestra}</td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 6, fontSize: '0.73rem', fontWeight: 600,
                            backgroundColor: SHEET_CONFIG[p.analitica]?.color ? `${SHEET_CONFIG[p.analitica].color}22` : '#f1f5f9',
                            color: done ? '#9ca3af' : (SHEET_CONFIG[p.analitica]?.color || '#64748b'),
                            border: `1px solid ${done ? '#e5e7eb' : (SHEET_CONFIG[p.analitica]?.color || '#e2e8f0')}`,
                          }}>
                            {p.analitica}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: done ? '#9ca3af' : '#374151' }}>{p.fecha_recogida}</td>
                        <td style={{ ...tdStyle, color: done ? '#9ca3af' : '#374151' }}>{p.hora_recogida}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Leyenda hojas ── */}
        <div style={{ backgroundColor: 'white', borderRadius: 16, padding: '18px 22px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.88rem', color: '#64748b', fontWeight: 600 }}>
            Detección automática de pestaña (cuando no hay CSV cargado)
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { hoja: '3.1 Legionella spp', keywords: 'ACS, Aljibe, Retorno, Red (default)' },
              { hoja: '3.1.4 Legionella pneumophilla', keywords: 'Pneumophilla explícita' },
              { hoja: '3.13 Control de Grifos', keywords: 'Grifo, Lavabo, Ducha' },
              { hoja: '2.1 Piscina Exterior', keywords: 'Exterior (sin Legionella)' },
              { hoja: '2.1.1 Piscina Exterior con Legionella', keywords: 'Exterior, Adultos, Infantil, Cubierta, Chapoteo, Splash' },
              { hoja: '2.1.2 Piscina Exterior con Legionella (*)', keywords: 'Igual que 2.1.1 no acreditado (manual)' },
              { hoja: '2.2 Piscina tipo Spa', keywords: 'Spa, Climatizada, Mar Muerto, Kneipp' },
              { hoja: '2.3 Vaso de hidromasaje', keywords: 'Jacuzzi, Yacuzzi, Hidromasaje, Bañera' },
              { hoja: '2.4 Piscina Decreto 140 2009', keywords: 'Decreto 140, 140/2009' },
              { hoja: 'Legionella VALPE21', keywords: 'VALPE' },
            ].map(({ hoja, keywords }) => (
              <div key={hoja} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px',
                borderRadius: 7, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.77rem',
              }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: SHEET_CONFIG[hoja]?.color || '#64748b', flexShrink: 0 }} />
                <span style={{ color: '#1e293b', fontWeight: 600 }}>{SHEET_CONFIG[hoja]?.label}</span>
                <span style={{ color: '#94a3b8' }}>— {keywords}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const thStyle = {
  padding: '10px 12px', textAlign: 'left', color: '#475569', fontWeight: 600,
  fontSize: '0.78rem', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '7px 10px', verticalAlign: 'middle',
};
