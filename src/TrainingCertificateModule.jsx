import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import {
  GraduationCap, Upload, FileSpreadsheet, Plus, Edit, Trash2,
  Save, X, Eye, Download, ChevronLeft, BookOpen, Settings,
  CheckCircle, AlertTriangle, Users, Clock, Calendar, Building2,
  FileText, Image as ImageIcon
} from 'lucide-react';
import logoHS from './assets/logo-hsconsulting.png';
import selloHS from './assets/sello-hsconsulting.png';
import watermarkHS from './assets/watermark-hs.png';

// ── Helpers ──────────────────────────────────────────────────────────────────

// Formatea fecha ISO (2026-06-04) a español (04/06/2026)
const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// Detecta el formato de imagen desde base64 data URL
const imgFormat = (b64) => {
  if (!b64) return 'PNG';
  if (b64.startsWith('data:image/jpeg') || b64.startsWith('data:image/jpg')) return 'JPEG';
  if (b64.startsWith('data:image/png')) return 'PNG';
  if (b64.startsWith('data:image/gif')) return 'GIF';
  if (b64.startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
};

const toBase64 = (url) =>
  fetch(url)
    .then(r => r.blob())
    .then(b => new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.onerror = rej;
      reader.readAsDataURL(b);
    }));

// Obtiene dimensiones reales de una imagen base64
const getImgDims = (b64) => new Promise((res) => {
  const img = new Image();
  img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
  img.onerror  = () => res({ w: 200, h: 100 });
  img.src = b64;
});

const readFileAsBase64 = (file) =>
  new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

// ── PDF Generator ────────────────────────────────────────────────────────────

async function generateDiplomasPDF(attendees, courseData, logoHSBase64, selloBase64, clientLogoBase64, watermarkBase64) {
  let clientLogoDims = null;
  if (clientLogoBase64) clientLogoDims = await getImgDims(clientLogoBase64);

  // ── A4 LANDSCAPE ──────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, H = 210;
  const BLUE  = [79, 129, 189];
  const DARK  = [28, 40, 65];
  const GRAY  = [94, 94, 94];
  const LGRAY = [180, 180, 180];

  const safeImg = (b64, fmt, x, y, w, h) => {
    try { doc.addImage(b64, fmt, x, y, w, h); } catch (e) { console.warn('img skip', e.message); }
  };

  for (let i = 0; i < attendees.length; i++) {
    const att = attendees[i];
    if (i > 0) doc.addPage();

    // ══════════════════════ ANVERSO ══════════════════════════════════════════

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, H, 'F');

    // ── Cabecera: logos primero ────────────────────────────────────────────
    // Logo HS — izquierda (455×159px → ratio 2.86 → 60×21mm)
    if (logoHSBase64) safeImg(logoHSBase64, 'PNG', 14, 8, 60, 21);

    // Logo cliente — derecha, sin deformar
    if (clientLogoBase64 && clientLogoDims) {
      const maxW = 65, maxH = 25;
      const ratio = clientLogoDims.w / clientLogoDims.h;
      let lw = maxW, lh = maxW / ratio;
      if (lh > maxH) { lh = maxH; lw = maxH * ratio; }
      const lx = W - 14 - lw;
      const ly = (34 - lh) / 2;
      safeImg(clientLogoBase64, imgFormat(clientLogoBase64), lx, ly, lw, lh);
    }

    // Marca de agua DESPUÉS de los logos — el canal alfa del PNG permite que
    // se composite encima del fondo blanco del logo cliente sin taparlo
    if (watermarkBase64) safeImg(watermarkBase64, 'PNG', 170, 8, 124, 190);

    // Línea separadora bajo logos
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.3);
    doc.line(14, 34, W - 14, 34);

    // ── Título ─────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(...BLUE);
    doc.text('Diploma Acreditativo', W / 2, 52, { align: 'center' });

    // ── "HS Consulting Group certifica que" — más espacio bajo el título ───
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...GRAY);
    doc.text('HS Consulting Group certifica que', W / 2, 72, { align: 'center' });

    // ── Nombre ─────────────────────────────────────────────────────────────
    const fullName = `${att.nombre} ${att.apellido1}${att.apellido2 ? ' ' + att.apellido2 : ''}`.trim();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...DARK);
    doc.text(fullName.toUpperCase(), W / 2, 82, { align: 'center' });

    // ── DNI ────────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    if (att.dni) doc.text(`DNI / NIE: ${att.dni}`, W / 2, 89, { align: 'center' });
    const dniOffset = att.dni ? 6 : 0;

    // ── Empresa con CIF — texto remarcado ─────────────────────────────────
    const etY = 91 + dniOffset;
    let etEndY = etY;

    if (att.sociedad || att.cif) {
      // Primera parte: texto introductorio en gris normal
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...GRAY);
      doc.text('que presta sus servicios en la empresa', W / 2, etY, { align: 'center' });

      // Segunda parte: nombre empresa en bold oscuro + CIF
      const empresaDestacada = `${att.sociedad || ''}${att.cif ? '  ·  CIF ' + att.cif : ''}`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...DARK);
      const etLines2 = doc.splitTextToSize(empresaDestacada, 240);
      doc.text(etLines2, W / 2, etY + 7, { align: 'center' });
      etEndY = etY + 7 + (etLines2.length - 1) * 6;
    }

    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.3);
    doc.line(25, etEndY + 5, W - 25, etEndY + 5);

    // ── "Ha superado…" ─────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text('Ha superado con evaluación positiva la Acción Formativa', W / 2, etEndY + 14, { align: 'center' });

    // ── Nombre del curso — espacio amplio arriba y abajo ───────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...BLUE);
    const courseLines = doc.splitTextToSize(courseData.denominacion.toUpperCase(), 240);
    doc.text(courseLines, W / 2, etEndY + 28, { align: 'center' }); // +6mm más de espacio arriba
    const courseEndY = etEndY + 28 + (courseLines.length - 1) * 10;

    // ── Código AF / Grupo — espacio amplio bajo el curso ───────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    const afParts = [];
    if (courseData.af_code) afParts.push(`Código AF ${courseData.af_code}`);
    if (courseData.grupo)   afParts.push(`Grupo ${courseData.grupo}`);
    if (afParts.length) doc.text(afParts.join('  /  '), W / 2, courseEndY + 14, { align: 'center' }); // +5mm más de espacio abajo

    // ── Fechas y duración ──────────────────────────────────────────────────
    const fi = fmtDate(courseData.fecha_inicio);
    const ff = fmtDate(courseData.fecha_fin);
    const dateText = (!ff || fi === ff) ? `durante el día ${fi}` : `durante los días ${fi} al ${ff}`;

    doc.text(dateText, W / 2, courseEndY + 22, { align: 'center' });
    doc.text(
      `con una duración total de ${courseData.hours} hora${courseData.hours !== 1 ? 's' : ''} en modalidad ${courseData.modality}`,
      W / 2, courseEndY + 30, { align: 'center' }
    );

    doc.setFontSize(9);
    doc.setTextColor(...LGRAY);
    doc.text('Contenidos impartidos (ver dorso)', W / 2, courseEndY + 38, { align: 'center' });

    // ── Firmas ─────────────────────────────────────────────────────────────
    const firmaLineY  = H - 30;
    const firmaLabelY = H - 22;
    const firmaSelY   = firmaLineY - 22;

    // Línea Entidad Formadora — primer tercio
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.4);
    doc.line(20, firmaLineY, 100, firmaLineY);
    // Línea Participante — último tercio
    doc.line(W - 100, firmaLineY, W - 20, firmaLineY);

    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text('Firma y Sello Entidad Formadora', 60, firmaLabelY, { align: 'center' });
    doc.text('Firma del Participante', W - 60, firmaLabelY, { align: 'center' });

    // Sello centrado bajo "Firma y Sello" (centro = 60mm → x = 60-27 = 33)
    if (selloBase64) safeImg(selloBase64, 'PNG', 33, firmaSelY, 54, 32);

    doc.setFontSize(7);
    doc.setTextColor(...LGRAY);
    doc.text('HS Consulting Group · Health & Safety · www.hsconsulting.es', W / 2, H - 5, { align: 'center' });

    // ══════════════════════ REVERSO ══════════════════════════════════════════
    doc.addPage();

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, H, 'F');

    if (logoHSBase64) safeImg(logoHSBase64, 'PNG', 14, 8, 60, 21);
    if (watermarkBase64) safeImg(watermarkBase64, 'PNG', 170, 8, 124, 190);

    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.3);
    doc.line(14, 34, W - 14, 34);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...DARK);
    doc.text('Contenido de la Formación', W / 2, 46, { align: 'center' });

    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(14);
    doc.setTextColor(...BLUE);
    const courseLinesBack = doc.splitTextToSize(courseData.denominacion.toUpperCase(), 240);
    doc.text(courseLinesBack, W / 2, 56, { align: 'center' });

    // ── Contenidos en 2 columnas — centradas horizontal y verticalmente
    const contentLines = (courseData.content || '').split('\n').filter(l => l.trim());
    const lineH = 5.5;
    const colW  = 128;
    const gap   = 18;
    const half  = Math.ceil(contentLines.length / 2);
    const col1Lines = contentLines.slice(0, half);
    const col2Lines = contentLines.slice(half);

    // Calcular altura de cada columna para centrar el bloque verticalmente
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const col1H = col1Lines.reduce((acc, l) => acc + doc.splitTextToSize(l.trim(), colW).length * lineH + 0.8, 0);
    const col2H = col2Lines.reduce((acc, l) => acc + doc.splitTextToSize(l.trim(), colW).length * lineH + 0.8, 0);
    const blockH = Math.max(col1H, col2H);

    // Espacio disponible: desde 16mm bajo el nombre del curso hasta el pie (H-14)
    const titleEndY  = 54 + (courseLinesBack.length - 1) * 5;
    const topPad     = 16; // espacio entre título/curso y el bloque de contenidos
    const areaTop    = titleEndY + topPad;
    const areaBottom = H - 14;
    const availH     = areaBottom - areaTop;

    // Centrar el bloque verticalmente en el área disponible
    const contentStartY = areaTop + (availH - blockH) / 2;

    // Centrar las dos columnas horizontalmente
    const totalColsW = colW * 2 + gap;
    const colMargin  = (W - totalColsW) / 2;
    const col1X = colMargin;
    const col2X = colMargin + colW + gap;

    doc.setTextColor(...DARK);

    let cy1 = contentStartY;
    col1Lines.forEach(line => {
      const wrapped = doc.splitTextToSize(line.trim(), colW);
      doc.text(wrapped, col1X, cy1);
      cy1 += wrapped.length * lineH + 0.8;
    });

    let cy2 = contentStartY;
    col2Lines.forEach(line => {
      const wrapped = doc.splitTextToSize(line.trim(), colW);
      doc.text(wrapped, col2X, cy2);
      cy2 += wrapped.length * lineH + 0.8;
    });

    doc.setFontSize(7);
    doc.setTextColor(...LGRAY);
    doc.text('HS Consulting Group · Health & Safety · www.hsconsulting.es', W / 2, H - 5, { align: 'center' });
  }

  return doc;
}

// ── Template Modal ────────────────────────────────────────────────────────────

function TemplateModal({ template, onClose, onSave }) {
  const [form, setForm] = useState(
    template || { name: '', content: '', hours: 2, modality: 'presencial' }
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { name: form.name, content: form.content, hours: parseInt(form.hours), modality: form.modality };
    if (template?.id) {
      await supabase.from('training_templates').update(data).eq('id', template.id);
    } else {
      await supabase.from('training_templates').insert([data]);
    }
    onSave();
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(4px)' }}>
      <div className="card" style={{ width: '640px', maxHeight: '90vh', overflowY: 'auto', margin: 0 }}>
        <div className="flex-between" style={{ marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)' }}>
            <BookOpen size={20} color="var(--primary)" />
            {template?.id ? 'Editar Plantilla' : 'Nueva Plantilla de Curso'}
          </h3>
          <button className="btn btn-secondary" style={{ padding: '6px', border: 'none' }} onClick={onClose}>
            <X size={22} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Nombre de la Tipología de Curso *</label>
            <input className="input-field" name="name" required value={form.name} onChange={handleChange} placeholder="Ej: Higiene Alimentaria — Nuevas Incorporaciones" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label className="input-label">Duración (horas)</label>
              <input className="input-field" name="hours" type="number" min="1" value={form.hours} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label className="input-label">Modalidad</label>
              <select className="input-field" name="modality" value={form.modality} onChange={handleChange}>
                <option value="presencial">Presencial</option>
                <option value="online">Online</option>
                <option value="mixta">Mixta (presencial + online)</option>
                <option value="teleformación">Teleformación</option>
              </select>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Contenidos del Programa (uno por línea, con guión)</label>
            <textarea
              className="input-field"
              name="content"
              required
              rows={14}
              value={form.content}
              onChange={handleChange}
              placeholder="- Introducción a la manipulación de alimentos&#10;- Seguridad e higiene..."
              style={{ fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Save size={16} /> Guardar Plantilla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Module ───────────────────────────────────────────────────────────────

export default function TrainingCertificateModule({ onBackToHub }) {
  const [activeTab, setActiveTab] = useState('generar');
  const [templates, setTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Generation state
  const [step, setStep] = useState(1); // 1:upload 2:configure 3:preview/generate
  const [attendees, setAttendees] = useState([]);
  const [courseData, setCourseData] = useState({
    denominacion: '', af_code: '', grupo: '',
    fecha_inicio: '', fecha_fin: '',
    hours: 2, modality: 'presencial',
    content: '', templateId: ''
  });
  const [clientLogo, setClientLogo] = useState(null); // base64
  const [clientLogoName, setClientLogoName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [logoHSBase64, setLogoHSBase64] = useState(null);
  const [selloBase64, setSelloBase64] = useState(null);
  const [watermarkBase64, setWatermarkBase64] = useState(null);
  const xlsRef = useRef(null);
  const logoRef = useRef(null);

  useEffect(() => {
    fetchTemplates();
    // Pre-load HS logos
    toBase64(logoHS).then(setLogoHSBase64).catch(() => {});
    toBase64(selloHS).then(setSelloBase64).catch(() => {});
    toBase64(watermarkHS).then(b64 => setWatermarkBase64(b64)).catch(() => {});
  }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase.from('training_templates').select('*').order('name');
    setTemplates(data || []);
  };

  // ── XLS parsing ──
  const handleXLSUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // Rows 0-2: metadata (Acción Formativa, Grupo, Denominación)
      const afCode   = rows[0]?.[1] ?? '';
      const grupo    = rows[1]?.[1] ?? '';
      const denom    = rows[2]?.[1] ?? '';

      // Row 3: headers, Row 4+: data
      const dataRows = rows.slice(4).filter(r => r[0] || r[1]);
      const parsed = dataRows.map(r => ({
        nombre:    String(r[0] || '').trim(),
        apellido1: String(r[1] || '').trim(),
        apellido2: String(r[2] || '').trim(),
        dni:       String(r[3] || '').trim(),
        sociedad:  String(r[4] || '').trim(),
        cif:       String(r[5] || '').trim(),
      })).filter(a => a.nombre || a.apellido1);

      setAttendees(parsed);

      // Auto-match template by denominación
      const matchedTemplate = templates.find(t =>
        t.name.toLowerCase().includes(denom.toLowerCase().substring(0, 15)) ||
        denom.toLowerCase().includes(t.name.toLowerCase().substring(0, 15))
      );

      setCourseData(prev => ({
        ...prev,
        denominacion: denom,
        af_code: String(afCode),
        grupo: String(grupo),
        content:  matchedTemplate?.content  || prev.content,
        hours:    matchedTemplate?.hours    || prev.hours,
        modality: matchedTemplate?.modality || prev.modality,
        templateId: matchedTemplate?.id    || '',
      }));

      setStep(2);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleClientLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await readFileAsBase64(file);
    setClientLogo(b64);
    setClientLogoName(file.name);
    e.target.value = '';
  };

  const handleTemplateSelect = (tid) => {
    const t = templates.find(t => t.id === tid);
    if (t) {
      setCourseData(prev => ({ ...prev, content: t.content, hours: t.hours, modality: t.modality, templateId: tid }));
    } else {
      setCourseData(prev => ({ ...prev, templateId: tid }));
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const doc = await generateDiplomasPDF(attendees, courseData, logoHSBase64, selloBase64, clientLogo, watermarkBase64);
      const safeName = courseData.denominacion.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      doc.save(`diplomas_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      alert('Error generando PDF: ' + err.message);
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const resetGeneration = () => {
    setStep(1);
    setAttendees([]);
    setCourseData({ denominacion: '', af_code: '', grupo: '', fecha_inicio: '', fecha_fin: '', hours: 2, modality: 'presencial', content: '', templateId: '' });
    setClientLogo(null);
    setClientLogoName('');
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--background)' }}>

      {/* Header */}
      <header style={{ height: '64px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={onBackToHub}>
            <ChevronLeft size={18} /> Hub
          </button>
          <div style={{ width: '1px', height: '28px', backgroundColor: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={20} color="#6366f1" />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '1rem' }}>Certificados de Formación</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Generación de diplomas desde Excel</div>
            </div>
          </div>
        </div>
      </header>

      {/* Nav tabs */}
      <div style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 32px', display: 'flex', gap: '4px' }}>
        {[
          { id: 'generar', label: 'Generar Diplomas', icon: <GraduationCap size={16} /> },
          { id: 'plantillas', label: 'Plantillas de Curso', icon: <BookOpen size={16} /> },
        ].map(tab => (
          <button key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>

        {/* ── GENERAR ── */}
        {activeTab === 'generar' && (
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>

            {/* Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '32px' }}>
              {[
                { n: 1, label: 'Subir Excel' },
                { n: 2, label: 'Configurar Curso' },
                { n: 3, label: 'Generar PDF' },
              ].map((s, idx) => (
                <React.Fragment key={s.n}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem',
                      backgroundColor: step > s.n ? 'var(--success)' : step === s.n ? 'var(--primary)' : 'var(--border)',
                      color: step >= s.n ? 'white' : 'var(--text-muted)'
                    }}>
                      {step > s.n ? <CheckCircle size={16} /> : s.n}
                    </div>
                    <span style={{ fontWeight: step === s.n ? 700 : 400, color: step === s.n ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {s.label}
                    </span>
                  </div>
                  {idx < 2 && <div style={{ flex: 1, height: '2px', backgroundColor: step > s.n ? 'var(--success)' : 'var(--border)', margin: '0 12px' }} />}
                </React.Fragment>
              ))}
            </div>

            {/* STEP 1: Upload */}
            {step === 1 && (
              <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '20px', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <FileSpreadsheet size={40} color="#6366f1" />
                </div>
                <h2 style={{ color: 'var(--secondary)', marginBottom: '8px' }}>Sube el Excel de asistentes</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '420px', margin: '0 auto 32px' }}>
                  Formato esperado: Acción Formativa, Grupo, Denominación en las 3 primeras filas. Asistentes desde la fila 5.
                </p>
                <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '1rem', padding: '12px 28px' }}
                  onClick={() => xlsRef.current?.click()}>
                  <Upload size={20} /> Seleccionar archivo Excel
                </button>
                <input ref={xlsRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleXLSUpload} />
                <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Acepta .xlsx y .xls</p>
              </div>
            )}

            {/* STEP 2: Configure */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Resumen asistentes */}
                <div className="card" style={{ padding: '20px', borderTop: '4px solid #6366f1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <Users size={20} color="#6366f1" />
                    <span style={{ fontWeight: 700, color: 'var(--secondary)' }}>{attendees.length} asistentes detectados</span>
                    <button className="btn btn-secondary" style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '4px 10px' }} onClick={resetGeneration}>
                      <X size={14} style={{ marginRight: '4px' }} /> Cambiar Excel
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {attendees.slice(0, 8).map((a, i) => (
                      <span key={i} style={{ backgroundColor: '#EEF2FF', color: '#6366f1', padding: '3px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                        {a.nombre} {a.apellido1}
                      </span>
                    ))}
                    {attendees.length > 8 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '3px 0' }}>+{attendees.length - 8} más</span>}
                  </div>
                </div>

                {/* Datos del curso */}
                <div className="card" style={{ padding: '24px' }}>
                  <h3 style={{ margin: '0 0 20px', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BookOpen size={18} color="var(--primary)" /> Datos del Curso
                  </h3>

                  <div className="input-group">
                    <label className="input-label">Denominación del Curso *</label>
                    <input className="input-field" value={courseData.denominacion}
                      onChange={e => setCourseData(p => ({ ...p, denominacion: e.target.value }))}
                      placeholder="Nombre completo del curso" />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="input-group">
                      <label className="input-label">Código Acción Formativa</label>
                      <input className="input-field" value={courseData.af_code}
                        onChange={e => setCourseData(p => ({ ...p, af_code: e.target.value }))} placeholder="389" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Nº de Grupo</label>
                      <input className="input-field" value={courseData.grupo}
                        onChange={e => setCourseData(p => ({ ...p, grupo: e.target.value }))} placeholder="11" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="input-group">
                      <label className="input-label"><Calendar size={13} style={{ marginRight: '4px' }} />Fecha Inicio *</label>
                      <input className="input-field" type="date" value={courseData.fecha_inicio}
                        onChange={e => setCourseData(p => ({ ...p, fecha_inicio: e.target.value }))} />
                    </div>
                    <div className="input-group">
                      <label className="input-label"><Calendar size={13} style={{ marginRight: '4px' }} />Fecha Fin *</label>
                      <input className="input-field" type="date" value={courseData.fecha_fin}
                        onChange={e => setCourseData(p => ({ ...p, fecha_fin: e.target.value }))} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="input-group">
                      <label className="input-label"><Clock size={13} style={{ marginRight: '4px' }} />Duración (horas)</label>
                      <input className="input-field" type="number" min="1" value={courseData.hours}
                        onChange={e => setCourseData(p => ({ ...p, hours: parseInt(e.target.value) || 1 }))} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Modalidad</label>
                      <select className="input-field" value={courseData.modality}
                        onChange={e => setCourseData(p => ({ ...p, modality: e.target.value }))}>
                        <option value="presencial">Presencial</option>
                        <option value="online">Online</option>
                        <option value="mixta">Mixta</option>
                        <option value="teleformación">Teleformación</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Plantilla de contenidos */}
                <div className="card" style={{ padding: '24px' }}>
                  <h3 style={{ margin: '0 0 16px', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={18} color="var(--primary)" /> Contenido del Dorso
                  </h3>

                  <div className="input-group">
                    <label className="input-label">Plantilla de Curso</label>
                    <select className="input-field" value={courseData.templateId}
                      onChange={e => handleTemplateSelect(e.target.value)}>
                      <option value="">— Selecciona una plantilla o escribe manualmente —</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.hours}h {t.modality})</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Contenidos (editable)</label>
                    <textarea className="input-field" rows={10}
                      value={courseData.content}
                      onChange={e => setCourseData(p => ({ ...p, content: e.target.value }))}
                      placeholder="- Introducción al curso&#10;- Módulo 1..."
                      style={{ fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }} />
                  </div>
                </div>

                {/* Logo cliente */}
                <div className="card" style={{ padding: '24px' }}>
                  <h3 style={{ margin: '0 0 16px', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ImageIcon size={18} color="var(--primary)" /> Logo del Cliente (opcional)
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                    Se mostrará en la cabecera del diploma junto al logo de HS Consulting.
                  </p>
                  {clientLogo ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px' }}>
                      <img src={clientLogo} alt="Logo cliente" style={{ height: '40px', objectFit: 'contain' }} />
                      <span style={{ color: '#15803d', fontWeight: 600, fontSize: '0.875rem', flex: 1 }}>{clientLogoName}</span>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px', color: 'var(--danger)', border: 'none' }}
                        onClick={() => { setClientLogo(null); setClientLogoName(''); }}>
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                      onClick={() => logoRef.current?.click()}>
                      <Upload size={16} /> Subir logo cliente (PNG/JPG)
                    </button>
                  )}
                  <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleClientLogoUpload} />
                </div>

                {/* Validación visual */}
                {(!courseData.denominacion || !courseData.fecha_inicio) && (
                  <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div style={{ fontSize: '0.875rem', color: '#92400e' }}>
                      <strong>Campos requeridos: </strong>
                      {[!courseData.denominacion && 'Denominación del Curso', !courseData.fecha_inicio && 'Fecha de inicio'].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={resetGeneration}>Cancelar</button>
                  <button className="btn btn-primary"
                    disabled={!courseData.denominacion || !courseData.fecha_inicio}
                    onClick={() => setStep(3)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px',
                      opacity: (!courseData.denominacion || !courseData.fecha_inicio) ? 0.5 : 1,
                      cursor: (!courseData.denominacion || !courseData.fecha_inicio) ? 'not-allowed' : 'pointer'
                    }}>
                    Continuar → Vista previa
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Preview & Generate */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="card" style={{ padding: '24px', borderTop: '4px solid #6366f1' }}>
                  <h3 style={{ margin: '0 0 20px', color: 'var(--secondary)' }}>Resumen del lote</h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                    {[
                      { icon: <Users size={18} />, label: 'Asistentes', value: attendees.length },
                      { icon: <FileText size={18} />, label: 'Páginas totales', value: attendees.length * 2 },
                      { icon: <Clock size={18} />, label: 'Horas', value: courseData.hours },
                      { icon: <Calendar size={18} />, label: 'Fecha', value: courseData.fecha_inicio === courseData.fecha_fin ? courseData.fecha_inicio : `${courseData.fecha_inicio} – ${courseData.fecha_fin}` },
                    ].map((item, i) => (
                      <div key={i} style={{ padding: '14px', backgroundColor: 'var(--background)', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ color: '#6366f1' }}>{item.icon}</div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.label}</div>
                          <div style={{ fontWeight: 700, color: 'var(--secondary)' }}>{item.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ backgroundColor: '#f8f9fa', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--secondary)', marginBottom: '8px', fontSize: '0.95rem' }}>
                      {courseData.denominacion}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      AF {courseData.af_code} / Grupo {courseData.grupo} · {courseData.modality}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => setStep(2)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ← Volver
                    </button>
                    <button className="btn btn-primary"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', fontSize: '1rem' }}>
                      {isGenerating
                        ? <><div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Generando {attendees.length} diplomas...</>
                        : <><Download size={20} /> Generar y Descargar PDF ({attendees.length} diplomas)</>}
                    </button>
                  </div>
                </div>

                {/* Lista asistentes */}
                <div className="card" style={{ padding: '0' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--secondary)' }}>
                    Asistentes incluidos
                  </div>
                  <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    <table style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Nombre completo</th>
                          <th>DNI</th>
                          <th>Sociedad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendees.map((a, i) => (
                          <tr key={i}>
                            <td style={{ color: 'var(--text-muted)', width: '40px' }}>{i + 1}</td>
                            <td style={{ fontWeight: 600 }}>{a.nombre} {a.apellido1} {a.apellido2}</td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{a.dni}</td>
                            <td style={{ fontSize: '0.85rem' }}>{a.sociedad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PLANTILLAS ── */}
        {activeTab === 'plantillas' && (
          <div>
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <h2 className="page-title">Plantillas de Contenidos por Tipología</h2>
              <button className="btn btn-primary" onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }}>
                <Plus size={18} style={{ marginRight: '8px' }} /> Nueva Plantilla
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
              {templates.map(t => (
                <div key={t.id} className="card" style={{ margin: 0, borderTop: '4px solid #6366f1', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '1rem', marginBottom: '4px' }}>{t.name}</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ backgroundColor: '#EEF2FF', color: '#6366f1', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
                          <Clock size={11} style={{ marginRight: '3px' }} />{t.hours}h
                        </span>
                        <span style={{ backgroundColor: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {t.modality}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 8px', color: 'var(--primary)' }}
                        onClick={() => { setEditingTemplate(t); setShowTemplateModal(true); }}>
                        <Edit size={15} />
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '6px 8px', color: 'var(--danger)', border: 'none' }}
                        onClick={async () => {
                          if (confirm(`¿Eliminar la plantilla "${t.name}"?`)) {
                            await supabase.from('training_templates').delete().eq('id', t.id);
                            fetchTemplates();
                          }
                        }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxHeight: '80px', overflowY: 'hidden', lineHeight: 1.6 }}>
                    {t.content.split('\n').slice(0, 4).join(' · ')}
                    {t.content.split('\n').length > 4 && ' …'}
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                  <BookOpen size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                  <p>No hay plantillas aún. Crea la primera.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Template Modal */}
      {showTemplateModal && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => setShowTemplateModal(false)}
          onSave={fetchTemplates}
        />
      )}

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
