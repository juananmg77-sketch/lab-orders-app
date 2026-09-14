import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { ArrowLeft, Upload, FileText, Download, Trash2, AlertCircle, CheckCircle, Loader } from 'lucide-react';

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
      'Recuento de Legionella spp. Según UNE EN ISO 11731',
      'Recuento de Legionella spp. Según UNE EN ISO 11731 (V)',
      'Identificación Legionella pneumophilla serogrupo 1',
      'Identificación de Legionella pneumophilla Serogrupos 2-14',
      'Legionella pneumophilla por qPCR','Legionella spp. por qPCR',
    ],
    toRow: (s) => {
      const r = new Array(26).fill('');
      r[0]=s.codigo; r[1]=s.establecimiento; r[2]=s.lugar||s.punto; r[3]=s.descripcion;
      r[4]=s.fecha_recogida; r[5]=s.hora_recogida; r[6]=s.fecha_entrada;
      r[7]=s.fecha_inicio; r[8]=s.fecha_fin; r[9]=s.resultado||'APTO'; r[11]=s.comentarios;
      r[12]=s.cloro_libre; r[14]=s.temperatura; r[15]=s.ph; r[19]=s.aerobios_22;
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
    label: 'Piscina Exterior + Legionella (acred.)',
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
      'Identificación de Legionella pneumophila Serogrupo 2 - ',
    ],
    toRow: (s) => {
      const r = new Array(43).fill('');
      r[0]=s.codigo; r[1]=s.establecimiento; r[2]=s.lugar||s.punto; r[3]=s.descripcion;
      r[4]=s.fecha_recogida; r[5]=s.hora_recogida; r[6]=s.fecha_entrada;
      r[7]=s.fecha_inicio; r[8]=s.fecha_fin; r[9]=s.resultado||'APTO'; r[11]=s.comentarios;
      r[12]=s.ph; r[13]=s.cloro_libre; r[15]=s.cloro_combinado; r[16]=s.temperatura;
      r[36]=s.legionella_spp; r[38]=s.aerobios_22; r[39]=s.legionella_spp; r[41]=s.legionella_pneumo;
      return r.map(v => v || '');
    },
  },
  '2.1.2 Piscina Exterior con Legionella (*)': {
    label: 'Piscina Exterior + Legionella (no acred.)',
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
      'Identificación de Legionella pneumophila Serogrupo 2 - ',
    ],
    toRow: (s) => {
      const r = new Array(43).fill('');
      r[0]=s.codigo; r[1]=s.establecimiento; r[2]=s.lugar||s.punto; r[3]=s.descripcion;
      r[4]=s.fecha_recogida; r[5]=s.hora_recogida; r[6]=s.fecha_entrada;
      r[7]=s.fecha_inicio; r[8]=s.fecha_fin; r[9]=s.resultado||'APTO'; r[11]=s.comentarios;
      r[12]=s.ph; r[13]=s.cloro_libre; r[15]=s.cloro_combinado; r[16]=s.temperatura;
      r[36]=s.legionella_spp; r[38]=s.aerobios_22; r[39]=s.legionella_spp; r[41]=s.legionella_pneumo;
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
      'Concentración Dióxido de Carbono (Diferencia Interior-Exterior)',
      'CO2 Interior','CO2 Exterior','Coliformes totales','Escherichia Coli',
      'Pseudomonas Aeruginosa','Staphylococcus aureus','Heterótrofos a 36 ºC',
      'Estreptococos fecales','Legionella spp','Nitratos',
      'Legionella pneumophilla','Aerobios Mesófilos Totales a 22ºC',
      'Legionella spp. ','Legionella pneumophilla (AU)',
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
      'Concentración Dióxido de Carbono (Diferencia Interior-Exterior)',
      'Dureza cálcica','Alcalinidad','Índice de Langelier','Tiempo de recirculación',
      'Coliformes totales','Cloro Total (Cl2)','Escherichia Coli',
      'Pseudomonas Aeruginosa','Staphylococcus aureus','Heterótrofos a 36 ºC',
      'Estreptococos fecales','Legionella spp','Legionella pneumophilla',
      'Legionella spp.','Aerobios mesófilos totales','Legionella pneumophilla (AP)',
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
      'Turbidez','Amoniaco',
    ],
    toRow: (s) => {
      const r = new Array(22).fill('');
      r[0]=s.codigo; r[1]=s.establecimiento; r[2]=s.lugar||s.punto; r[3]=s.descripcion;
      r[4]=s.fecha_recogida; r[5]=s.hora_recogida; r[6]=s.fecha_entrada;
      r[7]=s.fecha_inicio; r[8]=s.fecha_fin; r[9]=s.resultado||'APTO'; r[11]=s.comentarios;
      r[12]=s.temperatura; r[13]=s.cloro_libre; r[14]=s.legionella_spp;
      r[15]=s.legionella_pneumo; r[16]=s.legionella_spp;
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
  { key: 'legionella_spp', label: 'Legionella spp', width: 115 },
  { key: 'legionella_pneumo', label: 'L.pneumo', width: 100 },
  { key: 'resultado', label: 'Resultado', width: 90 },
];

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ImportadorPDFModule({ onBackToHub }) {
  const [rows, setRows] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [generando, setGenerando] = useState(false);
  const fileInput = useRef();

  const processFiles = useCallback(async (files) => {
    const arr = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (!arr.length) return;
    setProcessing(true);

    const newRows = arr.map(f => ({
      id: `${Date.now()}_${f.name}`,
      filename: f.name,
      status: 'processing',
      error: null,
      fields: {},
    }));
    setRows(prev => [...prev, ...newRows]);

    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      const rowId = newRows[i].id;
      try {
        const bytes = await file.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
        const resp = await fetch('/.netlify/functions/pdf-extractor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdf_base64: b64, filename: file.name }),
        });
        const data = await resp.json();
        if (!data.ok) throw new Error(data.error);
        setRows(prev => prev.map(r => r.id === rowId
          ? { ...r, status: 'ok', fields: data.fields }
          : r
        ));
      } catch (err) {
        setRows(prev => prev.map(r => r.id === rowId
          ? { ...r, status: 'error', error: err.message }
          : r
        ));
      }
    }
    setProcessing(false);
  }, []);

  const onFileChange = (e) => processFiles(e.target.files);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  const updateField = (id, key, value) => {
    setRows(prev => prev.map(r => r.id === id
      ? { ...r, fields: { ...r.fields, [key]: value } }
      : r
    ));
  };

  const updateSheet = (id, tipo_hoja) => {
    setRows(prev => prev.map(r => r.id === id
      ? { ...r, fields: { ...r.fields, tipo_hoja } }
      : r
    ));
  };

  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));

  const generateXLS = () => {
    const okRows = rows.filter(r => r.status === 'ok');
    if (!okRows.length) return;
    setGenerando(true);

    try {
      const wb = XLSX.utils.book_new();
      const bySheet = {};
      okRows.forEach(r => {
        const sheet = r.fields.tipo_hoja || '3.1 Legionella spp';
        if (!bySheet[sheet]) bySheet[sheet] = [];
        bySheet[sheet].push(r.fields);
      });

      for (const [sheetName, samples] of Object.entries(bySheet)) {
        const cfg = SHEET_CONFIG[sheetName];
        if (!cfg) continue;
        const aoa = [cfg.headers, ...samples.map(cfg.toRow)];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        // Ancho columnas auto
        ws['!cols'] = cfg.headers.map(() => ({ wch: 20 }));
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
      }

      const fecha = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Importador_HSLAB_${fecha}.xlsx`);
    } finally {
      setGenerando(false);
    }
  };

  const okCount = rows.filter(r => r.status === 'ok').length;

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
        <div>
          <h1 style={{ color: 'white', margin: 0, fontSize: '1.4rem' }}>
            Importador PDF → XLS
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', margin: '4px 0 0', fontSize: '0.85rem' }}>
            Sube informes externos de Legionella y genera el XLS para HS Manager
          </p>
        </div>
      </header>

      <main style={{ padding: '32px', maxWidth: 1600, margin: '0 auto' }}>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInput.current.click()}
          style={{
            border: `2px dashed ${dragOver ? '#0076CE' : '#cbd5e1'}`,
            borderRadius: 16, padding: '48px 32px', textAlign: 'center',
            cursor: 'pointer', backgroundColor: dragOver ? '#eff6ff' : 'white',
            transition: 'all 0.2s', marginBottom: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <input ref={fileInput} type="file" multiple accept=".pdf" onChange={onFileChange} style={{ display: 'none' }} />
          <Upload size={40} color={dragOver ? '#0076CE' : '#94a3b8'} style={{ marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: '1.05rem', color: '#475569', fontWeight: 600 }}>
            Arrastra los PDFs aquí o haz clic para seleccionar
          </p>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
            Acepta múltiples archivos PDF de Nilsson Laboratorios u otros labs externos
          </p>
          {processing && (
            <p style={{ margin: '12px 0 0', color: '#0076CE', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Procesando PDFs…
            </p>
          )}
        </div>

        {/* Tabla de muestras */}
        {rows.length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', color: '#1e3a5f' }}>
                {rows.length} archivo{rows.length !== 1 ? 's' : ''} cargado{rows.length !== 1 ? 's' : ''} · {okCount} extraído{okCount !== 1 ? 's' : ''}
              </h2>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setRows([])}
                  style={{ background: '#fee2e2', border: 'none', borderRadius: 8, color: '#dc2626', padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Limpiar todo
                </button>
                <button
                  onClick={generateXLS}
                  disabled={okCount === 0 || generando}
                  style={{
                    background: okCount > 0 ? '#0076CE' : '#e2e8f0', border: 'none', borderRadius: 8,
                    color: okCount > 0 ? 'white' : '#94a3b8', padding: '8px 20px',
                    cursor: okCount > 0 ? 'pointer' : 'not-allowed', fontSize: '0.85rem',
                    fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Download size={14} />
                  {generando ? 'Generando…' : `Generar XLS (${okCount})`}
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9' }}>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Pestaña HSLAB</th>
                    {EDITABLE_FIELDS.map(f => (
                      <th key={f.key} style={{ ...thStyle, minWidth: f.width }}>{f.label}</th>
                    ))}
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {/* Estado */}
                      <td style={tdStyle}>
                        {row.status === 'processing' && <Loader size={16} color="#0076CE" />}
                        {row.status === 'ok' && <CheckCircle size={16} color="#16a34a" />}
                        {row.status === 'error' && (
                          <span title={row.error}><AlertCircle size={16} color="#dc2626" /></span>
                        )}
                      </td>

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

                      {/* Borrar fila */}
                      <td style={tdStyle}>
                        <button
                          onClick={() => removeRow(row.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                        >
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

        {/* Leyenda hojas */}
        <div style={{
          backgroundColor: 'white', borderRadius: 16, padding: '20px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
            Detección automática de pestaña según punto de muestreo
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[
              { hoja: '3.1 Legionella spp', keywords: 'ACS, Acumulador, Impulsión, Retorno, Red' },
              { hoja: '3.1.4 Legionella pneumophilla', keywords: 'Pneumophilla explícita' },
              { hoja: '3.13 Control de Grifos', keywords: 'Grifo, Lavabo, Ducha' },
              { hoja: '2.1 Piscina Exterior', keywords: 'Exterior (sin Legionella)' },
            { hoja: '2.1.1 Piscina Exterior con Legionella', keywords: 'Exterior, Adultos, Infantil, Familiar, Family (con Leg.)' },
            { hoja: '2.1.2 Piscina Exterior con Legionella (*)', keywords: 'Exterior no acreditado (*)' },
              { hoja: '2.2 Piscina tipo Spa', keywords: 'Spa, Cubierta, Climatizada, Interior' },
              { hoja: '2.3 Vaso de hidromasaje', keywords: 'Hidromasaje, Jacuzzi, Bañera' },
              { hoja: '2.4 Piscina Decreto 140 2009', keywords: 'Decreto 140, 140/2009' },
              { hoja: 'Legionella VALPE21', keywords: 'VALPE' },
            ].map(({ hoja, keywords }) => (
              <div key={hoja} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
                fontSize: '0.78rem',
              }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  backgroundColor: SHEET_CONFIG[hoja]?.color || '#64748b', flexShrink: 0,
                }} />
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
  padding: '8px 10px', verticalAlign: 'middle',
};
