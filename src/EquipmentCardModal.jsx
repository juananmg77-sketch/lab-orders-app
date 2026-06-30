import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Edit3, Microscope, Calendar, CheckCircle, AlertCircle, Link, FileText, ExternalLink, Trash2, ShoppingCart, Upload, Eye, Package, Wrench, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from './supabaseClient';

const MACRO_CATEGORIES = [
  'Patrones Metrológicos',
  'Termómetros - Loggers y Equipos Patrón',
  'Sondas de Medición de Temperatura - Humedad',
  'Materiales de Referencia (MR)',
  'Medios Isotermos (Neveras - Estufas y Baños)',
  'Instrumentación Analítica y Fisicoquímica',
  'Pipetas y Balanzas',
  'Equipos Consultores Externos',
  'Equipos Auxiliares y de Preparación'
];

const SUBCATEGORIES = {
  'Patrones Metrológicos': [
    'Patrón de Masa (Pesas)',
    'Patrón de Volumen (Probetas/Pipetas)',
    'Patrón Eléctrico',
    'Otros Patrones (No Térmicos)'
  ],
  'Termómetros - Loggers y Equipos Patrón': [
    'Termómetro Patrón',
    'Datalogger Patrón',
    'Sonda Patrón (Temperatura)'
  ],
  'Sondas de Medición de Temperatura - Humedad': [
    'Sonda PT100',
    'Termopar Tipo K',
    'Higrómetro Ambiental',
    'Sonda de Contacto'
  ],
  'Materiales de Referencia (MR)': [
    'Material de Referencia Certificado (MRC)',
    'Cepas de Referencia / Cultivos',
    'Patrones Analíticos / Buffer'
  ],
  'Medios Isotermos (Neveras - Estufas y Baños)': [
    'Neveras de Muestras y Reactivos',
    'Congeladores',
    'Estufas / Muflas',
    'Baños Termostáticos',
    'Incubadores Digitales'
  ],
  'Instrumentación Analítica y Fisicoquímica': [
    'Ph-metros',
    'Conductímetros',
    'Turbidímetros',
    'Espectrofotómetros',
    'Fotómetros',
    'Analizadores Específicos',
    'Oxímetros'
  ],
  'Pipetas y Balanzas': [
    'Balanzas Analíticas',
    'Balanzas de Precisión',
    'Pipetas Monocanal',
    'Pipetas Multicanal',
    'Dispensadores Automáticos',
    'Buretas / Tituladores'
  ],
  'Equipos Consultores Externos': [
    'Fotómetro (Cloro/pH)',
    'Termómetro de Sonda / Láser',
    'Higrómetro Ambiental',
    'Medidor Compuestos Polares (Aceites)',
    'Datalogger de Transporte',
    'Medidor de Cocina BT',
    'Luz Ultravioleta'
  ],
  'Equipos Auxiliares y de Preparación': [
    'Centrífugas',
    'Autoclaves / Esterilizadores',
    'Campanas de Flujo Laminar / Cabinas de Bioseguridad',
    'Agitadores / Vórtex',
    'Homogeneizadores / Stomacher',
    'Equipos de Filtración',
    'Baños de Ultrasonidos'
  ]
};

const mode = (arr) => {
  const vals = arr.filter(Boolean);
  if (!vals.length) return null;
  const freq = {};
  vals.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
};

const parseRange = (r = '') => {
  if (r.includes('+/-')) {
    const [left, diff] = r.split('+/-');
    const parts = left.trim().split(' ');
    const unit = parts.length > 1 ? parts.pop() : '';
    return { rangeVal: parts.join(' '), rangeUnit: unit, rangeDiff: diff.trim() };
  }
  const parts = r.trim().split(' ');
  const unit = parts.length > 1 ? parts.pop() : '';
  return { rangeVal: parts.join(' '), rangeUnit: unit, rangeDiff: '' };
};

const parseTol = (t = '') => {
  const parts = t.trim().split(' ');
  const unit = parts.length > 1 ? parts.pop() : '';
  return { tolVal: parts.join(' '), tolUnit: unit };
};

const emptyIncident = () => ({ incident_date: '', description: '', corrective_action: '', resolved_date: '', attachment_url: '', attachment_name: '' });

const getIncidentMode = (eq) => {
  const cat = eq?.macro_category || '';
  const type = (eq?.equipment_type || '').toLowerCase();
  const FULL = [
    'Medios Isotermos (Neveras - Estufas y Baños)',
    'Instrumentación Analítica y Fisicoquímica',
    'Equipos Auxiliares y de Preparación',
  ];
  const OPTIONAL = [
    'Sondas de Medición de Temperatura - Humedad',
    'Equipos Consultores Externos',
  ];
  if (FULL.includes(cat)) return 'full';
  if (cat === 'Pipetas y Balanzas') return (type.includes('balanza') || type.includes('báscula') || type.includes('bascula')) ? 'full' : 'optional';
  if (OPTIONAL.includes(cat)) return 'optional';
  return 'none';
};

export default function EquipmentCardModal({ isOpen, onClose, equipment, onSave, existingEquipments = [], suppliers = [] }) {
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [requiresCalibration, setRequiresCalibration] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const pdfInputRef = useRef(null);

  // Averías
  const [incidents, setIncidents] = useState([]);
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [editingIncident, setEditingIncident] = useState(null);
  const [incidentForm, setIncidentForm] = useState(emptyIncident());
  const [savingIncident, setSavingIncident] = useState(false);
  const [incidentFile, setIncidentFile] = useState(null);
  const incidentFileRef = useRef(null);
  const [incidentSectionOpen, setIncidentSectionOpen] = useState(false);
  const [incidentOptionalOpen, setIncidentOptionalOpen] = useState(false);

  // Helper functions to manage combined string fields for Rango and Tolerancia
  const [rangeVal, setRangeVal] = useState('');
  const [rangeUnit, setRangeUnit] = useState('');
  const [rangeDiff, setRangeDiff] = useState('');

  const [tolVal, setTolVal] = useState('');
  const [tolUnit, setTolUnit] = useState('');

const inferCategory = (eq) => {
  if (eq.macro_category) return eq.macro_category;
  const type = (eq.equipment_type || '').toLowerCase();
  const name = (eq.name || '').toLowerCase();
  
  const isPatron = type.includes('patrón') || type.includes('patron') || name.includes('patron');
  const isThermal = type.includes('termómetro') || type.includes('termometro') || type.includes('logger');
  
  if (isPatron && isThermal) return 'Termómetros - Loggers y Equipos Patrón';
  if (isPatron) return 'Patrones Metrológicos';
  if (type.includes('sonda') || name.includes('sonda') || type.includes('pt100') || type.includes('termopar')) return 'Sondas de Medición de Temperatura - Humedad';
  if (type.includes('buffer') || name.includes('buffer') || type.includes('mr') || name.includes('referencia')) return 'Materiales de Referencia (MR)';
  if (isThermal || type.includes('incubador') || type.includes('estufa') || type.includes('nevera') || type.includes('clima') || type.includes('baño')) return 'Medios Isotermos (Neveras - Estufas y Baños)';
  if (type.includes('conductímetro') || name.includes('conductimetro') || type.includes('ph') || name.includes('analític')) return 'Instrumentación Analítica y Fisicoquímica';
  if (type.includes('pipeta') || type.includes('balanza') || type.includes('masa') || type.includes('bascula')) return 'Pipetas y Balanzas';
  
  return 'Equipos Auxiliares y de Preparación';
};

  useEffect(() => {
    if (equipment?.id && isOpen) {
      supabase.from('equipment_incidents').select('*').eq('equipment_id', equipment.id).order('incident_date', { ascending: false }).then(({ data }) => setIncidents(data || []));
      const mode = getIncidentMode(equipment);
      setIncidentSectionOpen(mode === 'full');
      setIncidentOptionalOpen(false);
    } else {
      setIncidents([]);
      setIncidentSectionOpen(false);
      setIncidentOptionalOpen(false);
    }
    setShowIncidentForm(false);
    setEditingIncident(null);
    setIncidentForm(emptyIncident());
    setIncidentFile(null);
  }, [equipment?.id, isOpen]);

  const saveIncident = async () => {
    if (!incidentForm.incident_date) { alert('La fecha es obligatoria.'); return; }
    setSavingIncident(true);
    let att_url = incidentForm.attachment_url || null;
    let att_name = incidentForm.attachment_name || null;
    if (incidentFile) {
      const path = `equipment-incidents/${equipment.id}/${Date.now()}_${incidentFile.name.replace(/\s+/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('employee-documents').upload(path, incidentFile, { upsert: true, contentType: incidentFile.type || 'application/pdf' });
      if (upErr) { alert('Error subiendo archivo: ' + upErr.message); setSavingIncident(false); return; }
      att_url = supabase.storage.from('employee-documents').getPublicUrl(path).data.publicUrl;
      att_name = incidentFile.name;
    }
    const payload = {
      equipment_id: equipment.id,
      incident_date: incidentForm.incident_date,
      description: incidentForm.description || null,
      corrective_action: incidentForm.corrective_action || null,
      resolved_date: incidentForm.resolved_date || null,
      attachment_url: att_url,
      attachment_name: att_name,
    };
    let error;
    if (editingIncident) {
      ({ error } = await supabase.from('equipment_incidents').update(payload).eq('id', editingIncident.id));
    } else {
      ({ error } = await supabase.from('equipment_incidents').insert([payload]));
    }
    setSavingIncident(false);
    if (error) { alert('Error: ' + error.message); return; }
    const { data } = await supabase.from('equipment_incidents').select('*').eq('equipment_id', equipment.id).order('incident_date', { ascending: false });
    setIncidents(data || []);
    setShowIncidentForm(false);
    setEditingIncident(null);
    setIncidentForm(emptyIncident());
    setIncidentFile(null);
    if (incidentFileRef.current) incidentFileRef.current.value = '';
  };

  const deleteIncident = async (id) => {
    if (!confirm('¿Eliminar esta avería?')) return;
    await supabase.from('equipment_incidents').delete().eq('id', id);
    setIncidents(prev => prev.filter(i => i.id !== id));
  };

  const openEditIncident = (inc) => {
    setEditingIncident(inc);
    setIncidentForm({ incident_date: inc.incident_date || '', description: inc.description || '', corrective_action: inc.corrective_action || '', resolved_date: inc.resolved_date || '', attachment_url: inc.attachment_url || '', attachment_name: inc.attachment_name || '' });
    setIncidentFile(null);
    setShowIncidentForm(true);
  };

  useEffect(() => {
    if (equipment && isOpen) {
      setFormData({
        ...equipment,
        macro_category: inferCategory(equipment),
        lab: equipment.lab || 'HSLAB Baleares',
        status: equipment.status || 'ALTA',
        purchase_supplier: equipment.purchase_supplier || '',
        invoice_number:    equipment.invoice_number    || '',
        purchase_amount:   equipment.purchase_amount   || '',
        invoice_pdf_url:   equipment.invoice_pdf_url   || '',
      });
      
      const requiresCal = !!(equipment.calibration_freq || equipment.cal_valid_until || equipment.calibration_type);
      const requiresVer = !!(equipment.verification_freq || equipment.ver_valid_until);
      
      setRequiresCalibration(requiresCal);
      setRequiresVerification(requiresVer);

      // Reset Range/Tol fields if new
      if (!equipment.id) {
        setRangeVal(''); setRangeUnit(''); setRangeDiff('');
        setTolVal(''); setTolUnit('');
        return;
      }

      const r = equipment.measuring_range || '';
      if (r.includes('+/-')) {
        const parts = r.split('+/-');
        setRangeDiff(parts[1].trim());
        const left = parts[0].trim().split(' ');
        if (left.length > 1) {
          setRangeUnit(left.pop());
          setRangeVal(left.join(' '));
        } else {
          setRangeVal(left[0] || '');
          setRangeUnit('');
        }
      } else {
        const left = r.trim().split(' ');
        if (left.length > 1) {
          setRangeUnit(left.pop());
          setRangeVal(left.join(' '));
        } else {
          setRangeVal(r);
          setRangeUnit('');
        }
        setRangeDiff('');
      }

      const t = equipment.tolerance || '';
      const tParts = t.trim().split(' ');
      if (tParts.length > 1) {
        setTolUnit(tParts.pop());
        setTolVal(tParts.join(' '));
      } else {
        setTolVal(t);
        setTolUnit('');
      }
    }
  }, [equipment, isOpen]);

  // Auto-fill defaults from existing Baleares equipment when category/subtype changes (new equipment only)
  useEffect(() => {
    if (!equipment?.new || !formData.macro_category) return;

    const baseEquips = existingEquipments.filter(eq =>
      (eq.lab || '').includes('HSLAB Baleares') &&
      !(eq.lab || '').includes('Consultores') &&
      eq.macro_category === formData.macro_category
    );

    const matches = formData.equipment_type
      ? baseEquips.filter(eq => eq.equipment_type === formData.equipment_type)
      : baseEquips;

    const pool = matches.length > 0 ? matches : baseEquips;
    if (!pool.length) return;

    const defIntendedUse = mode(pool.map(e => e.intended_use));
    const defRange = mode(pool.map(e => e.measuring_range));
    const defTol = mode(pool.map(e => e.tolerance));
    const defCalFreq = mode(pool.map(e => e.calibration_freq));
    const defCalType = mode(pool.map(e => e.calibration_type));
    const defVerFreq = mode(pool.map(e => e.verification_freq));
    const hasCal = pool.filter(e => e.calibration_freq || e.cal_valid_until).length > pool.length / 2;
    const hasVer = pool.filter(e => e.verification_freq || e.ver_valid_until).length > pool.length / 2;

    setFormData(prev => ({
      ...prev,
      intended_use: prev.intended_use || defIntendedUse || '',
      calibration_freq: prev.calibration_freq || defCalFreq || '',
      calibration_type: prev.calibration_type || defCalType || '',
      verification_freq: prev.verification_freq || defVerFreq || '',
    }));

    if (!requiresCalibration && hasCal) setRequiresCalibration(true);
    if (!requiresVerification && hasVer) setRequiresVerification(true);

    if (defRange && !rangeVal) {
      const { rangeVal: rv, rangeUnit: ru, rangeDiff: rd } = parseRange(defRange);
      setRangeVal(rv); setRangeUnit(ru); setRangeDiff(rd);
    }
    if (defTol && !tolVal) {
      const { tolVal: tv, tolUnit: tu } = parseTol(defTol);
      setTolVal(tv); setTolUnit(tu);
    }
  }, [formData.macro_category, formData.equipment_type]);

  // ── Defaults EBRO: termómetros de consultores ────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const nameModel = ((formData.name || '') + ' ' + (formData.model || '')).toLowerCase();
    const isEbro = nameModel.includes('ebro');
    const isConsultorEq = (formData.lab || '').includes('Consultores');
    if (!isEbro || !isConsultorEq) return;

    // Rango por defecto solo si no hay valor guardado aún
    if (!equipment?.measuring_range && !rangeVal) {
      setRangeVal('-30 a 220');
      setRangeUnit('°C');
      setRangeDiff('1');
    }
    // Tolerancia por defecto solo si no hay valor guardado
    if (!equipment?.tolerance && !tolVal) {
      setTolVal('1');
      setTolUnit('°C');
    }
    // Calibración interna anual por defecto
    if (!requiresCalibration) setRequiresCalibration(true);
    setFormData(prev => ({
      ...prev,
      calibration_type: prev.calibration_type || 'Interna',
      calibration_freq: prev.calibration_freq || 'Anual',
    }));
  }, [formData.name, formData.model, formData.lab, isOpen]);

  if (!isOpen || !equipment) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Construct compounded fields
    const finalRange = rangeDiff ? `${rangeVal} ${rangeUnit} +/- ${rangeDiff}`.trim() : `${rangeVal} ${rangeUnit}`.trim();
    const finalTol = `${tolVal} ${tolUnit}`.trim();

    const payload = {
      name: (formData.name || '').toUpperCase(),
      equipment_code: formData.equipment_code,
      equipment_type: formData.equipment_type,
      status: formData.status,
      model: formData.model,
      serial_number: formData.serial_number,
      acquisition_date: formData.acquisition_date || null,
      assigned_to: formData.assigned_to || null,
      iso_17025: formData.iso_17025,
      macro_category: formData.macro_category || null,
      manual_ref: formData.manual_ref || null,
      
      intended_use: formData.intended_use,
      measuring_range: finalRange,
      tolerance: finalTol,

      calibration_freq: requiresCalibration ? formData.calibration_freq : null,
      calibration_type: requiresCalibration ? formData.calibration_type : null,
      cal_report_ref: requiresCalibration ? formData.cal_report_ref : null,
      standard_complies: requiresCalibration ? formData.standard_complies : null,
      standard_complies_note: requiresCalibration && formData.standard_complies === 'Limitado' ? formData.standard_complies_note || null : null,
      cal_valid_until: requiresCalibration ? formData.cal_valid_until || null : null,
      
      verification_freq: requiresVerification ? formData.verification_freq : null,
      ver_report_ref: requiresVerification ? formData.ver_report_ref : null,
      ver_valid_until: requiresVerification ? formData.ver_valid_until || null : null,
      lab: formData.lab || 'HSLAB Baleares',
      delegacion: formData.macro_category === 'Equipos Consultores Externos' ? (formData.delegacion || 'Baleares') : null,

      // Adquisición
      purchase_supplier: formData.purchase_supplier || null,
      invoice_number:    formData.invoice_number    || null,
      purchase_amount:   formData.purchase_amount   ? parseFloat(formData.purchase_amount) : null,
      invoice_pdf_url:   formData.invoice_pdf_url   || null,
    };

    let result;
    if (equipment.id) {
       result = await supabase
        .from('equipments')
        .update(payload)
        .eq('id', equipment.id);
    } else {
       result = await supabase
        .from('equipments')
        .insert([payload]);
    }
    const { error } = result;

    setIsSaving(false);
    
    if (error) {
      console.error(error);
      alert('Error guardando la ficha: ' + error.message);
    } else {
      onSave();
      onClose();
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      alert('Solo se aceptan archivos PDF o imagen.');
      return;
    }
    setIsUploadingPdf(true);
    const eqCode = formData.equipment_code || `eq_${Date.now()}`;
    const fileName = `${eqCode}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { data, error } = await supabase.storage
      .from('invoices')
      .upload(fileName, file, { upsert: true });
    if (error) {
      alert('Error subiendo el archivo: ' + error.message);
    } else {
      const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(data.path);
      // If bucket is private, use signed URL approach; store the path and generate signed URL on view
      setFormData(prev => ({ ...prev, invoice_pdf_url: data.path }));
    }
    setIsUploadingPdf(false);
    e.target.value = '';
  };

  const handleViewInvoicePdf = async () => {
    if (!formData.invoice_pdf_url) return;
    // If it's already a full URL, open directly
    if (formData.invoice_pdf_url.startsWith('http')) {
      window.open(formData.invoice_pdf_url, '_blank');
      return;
    }
    // Otherwise generate a signed URL (bucket is private)
    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(formData.invoice_pdf_url, 3600);
    if (error) { alert('Error generando enlace: ' + error.message); return; }
    window.open(data.signedUrl, '_blank');
  };

  const isBaja    = formData.status === 'BAJA';
  const isPreAlta = formData.status === 'PRE-ALTA';
  const isConsultor = (formData.lab || '').includes('Consultores');

  const isCalExpired = formData.cal_valid_until && new Date(formData.cal_valid_until) < new Date().setHours(0,0,0,0);
  const isVerExpired = formData.ver_valid_until && new Date(formData.ver_valid_until) < new Date().setHours(0,0,0,0);

  const getStatusColor = () => {
    if (isBaja) return { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' };
    return { bg: '#f0fdf4', text: '#15803d', border: '#86efac' };
  };
  const statusColors = getStatusColor();

  const ensureAbsoluteUrl = (url) => {
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) {
      return `https://${url}`;
    }
    return url;
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)'
    }}>
      <div 
        className="card" 
        style={{ 
          width: '950px', 
          maxHeight: '90vh', 
          overflowY: 'auto', 
          padding: 0,
          filter: isBaja ? 'grayscale(100%) opacity(0.85)' : 'none',
          transition: 'all 0.3s ease'
        }}
      >
        
        {/* Superior Header */}
        <div style={{ 
          padding: '24px 32px', 
          backgroundColor: isBaja ? '#64748b' : 'var(--primary)', 
          color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
        }}>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Microscope size={28} /> {equipment.id ? 'FICHA DEL EQUIPO' : 'ALTA DE NUEVO EQUIPO'} {isBaja && '(DADO DE BAJA)'}{isPreAlta && '(PRE-ALTA · EN TRÁMITE)'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '8px 0 0 0' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                {formData.name || (equipment.id ? 'Sin Nombre' : 'Nuevo Instrumento')}
              </span>
              {formData.equipment_code && (
                <span style={{ 
                  backgroundColor: 'rgba(255,255,255,0.2)', 
                  color: 'white', 
                  padding: '4px 12px', 
                  borderRadius: '20px', 
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  border: '1px solid rgba(255,255,255,0.4)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  {formData.equipment_code}
                </span>
              )}
            </div>
          </div>
          <button style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '32px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
            
            {/* Columna Izquierda: Identificación */}
            <div>
              <h3 style={{ borderBottom: '2px solid var(--border)', paddingBottom: '8px', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} /> 1. Datos Generales
              </h3>

              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label className="input-label" style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--secondary)' }}>Nombre / Descripción del Equipo</label>
                <input 
                  required 
                  type="text" 
                  className="input-field" 
                  name="name" 
                  value={formData.name || ''} 
                  onChange={handleChange} 
                  style={{ 
                    fontSize: '1.15rem', 
                    fontWeight: 600, 
                    padding: '12px', 
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
                    borderColor: '#94a3b8',
                    backgroundColor: '#f8fafc',
                    color: 'var(--secondary)'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label" style={{ fontWeight: 'bold' }}>Estado Operativo</label>
                  <select 
                    className="input-field" 
                    name="status" 
                    value={formData.status || 'ALTA'} 
                    onChange={handleChange}
                    style={{ 
                      fontWeight: 'bold', 
                      backgroundColor: statusColors.bg,
                      color: statusColors.text,
                      borderColor: statusColors.border,
                      borderWidth: '2px',
                      fontSize: '1.1rem',
                      height: '48px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <option value="ALTA">ALTA</option>
                    <option value="PRE-ALTA">PRE-ALTA</option>
                    <option value="BAJA">BAJA</option>
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label" style={{ fontWeight: 'bold' }}>Código Interno</label>
                  <input 
                    required 
                    type="text" 
                    className="input-field" 
                    name="equipment_code" 
                    value={formData.equipment_code || ''} 
                    onChange={handleChange} 
                    style={{
                      fontWeight: '800',
                      fontSize: '1.1rem',
                      color: 'var(--primary)',
                      backgroundColor: '#eff6ff',
                      borderColor: '#93c5fd',
                      borderWidth: '2px',
                      letterSpacing: '0.5px',
                      height: '48px'
                    }}
                  />
                </div>
              </div>
              
              <div className="input-group">
                <label className="input-label" style={{ fontWeight: 'bold' }}>Sede / Destino del Equipo</label>
                <select 
                  className="input-field" 
                  name="lab" 
                  value={formData.lab || ''} 
                  onChange={handleChange}
                  style={{ backgroundColor: '#f0f9ff', borderColor: '#bae6fd', fontWeight: 600 }}
                >
                  <option value="HSLAB Baleares">Sede Central (Baleares)</option>
                  <option value="HSLAB Baleares - Consultores">Consultor Externo — Baleares</option>
                  <option value="HSLAB Canarias">Laboratorio Gran Canaria</option>
                  <option value="HSLAB Canarias - Consultores">Consultor Externo — Canarias</option>
                </select>
              </div>

              {!isConsultor && (
                <div className="input-group">
                  <label className="input-label">Familia ISO (Agrupador Visual)</label>
                  <select className="input-field" name="macro_category" value={formData.macro_category || ''} onChange={handleChange}>
                    {MACRO_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Subtipo de Equipo Específico</label>
                <input type="text" className="input-field" name="equipment_type" value={formData.equipment_type || ''} onChange={handleChange} list="subtype-list" placeholder="Selecciona o escribe el subtipo..." />
                <datalist id="subtype-list">
                  {(() => {
                    // Subtypes from real Baleares data first, then fallback to static list
                    const realSubtypes = formData.macro_category
                      ? [...new Set(existingEquipments
                          .filter(eq => eq.macro_category === formData.macro_category && (eq.lab||'').includes('HSLAB Baleares') && !(eq.lab||'').includes('Consultores') && eq.equipment_type)
                          .map(eq => eq.equipment_type))]
                          .sort()
                      : [];
                    const staticSubtypes = (formData.macro_category && SUBCATEGORIES[formData.macro_category]) || Object.values(SUBCATEGORIES).flat();
                    const merged = [...new Set([...realSubtypes, ...staticSubtypes])];
                    return merged.map(sub => <option key={sub} value={sub} />);
                  })()}
                </datalist>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label className="input-label">Marca / Modelo</label>
                  <input type="text" className="input-field" name="model" value={formData.model || ''} onChange={handleChange} />
                </div>
                <div className="input-group">
                  <label className="input-label">Número de Serie (S/N)</label>
                  <input type="text" className="input-field" name="serial_number" value={formData.serial_number || ''} onChange={handleChange} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label className="input-label">Fecha de Adquisición</label>
                  <input type="date" className="input-field" name="acquisition_date" value={formData.acquisition_date || ''} onChange={handleChange} />
                </div>
                <div className="input-group">
                  <label className="input-label">{isConsultor ? 'Asignado a (Nombre del Consultor)' : 'Asignado a (Responsable / Sección)'}</label>
                  <input type="text" className="input-field" name="assigned_to" value={formData.assigned_to || ''} onChange={handleChange} />
                </div>
              </div>

              {isConsultor && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '4px' }}>
                  <div className="input-group">
                    <label className="input-label">Delegación del Consultor</label>
                    <select className="input-field" name="delegacion" value={formData.delegacion || 'Baleares'} onChange={handleChange}>
                      {['Baleares', 'Cataluña', 'Madrid', 'Valencia', 'Andalucía', 'Canarias'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Laboratorio Asignado</label>
                    <input
                      type="text"
                      className="input-field"
                      readOnly
                      value={(formData.delegacion || 'Baleares') === 'Canarias' ? 'HSLAB Canarias' : 'HSLAB Baleares'}
                      style={{ backgroundColor: '#f8fafc', color: 'var(--text-muted)', cursor: 'default' }}
                    />
                  </div>
                </div>
              )}

              {!isConsultor && (
                <>
                  <div className="input-group" style={{ marginTop: '16px' }}>
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={14} /> Manual de Instrucciones del Equipo
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" className="input-field" name="manual_ref" value={formData.manual_ref || ''} onChange={handleChange} placeholder="Link de Drive al Manual PDF / Instrucciones" style={{ margin: 0 }} />
                      {formData.manual_ref && (
                        <a href={ensureAbsoluteUrl(formData.manual_ref)} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center' }} title="Abrir Manual">
                          <ExternalLink size={18} />
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: formData.iso_17025 ? '#e0e7ff' : '#f1f5f9', borderRadius: '8px', border: '1px solid', borderColor: formData.iso_17025 ? '#a5b4fc' : '#e2e8f0', marginTop: '16px' }}>
                    <input type="checkbox" id="isoCheck" name="iso_17025" checked={formData.iso_17025 || false} onChange={handleChange} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                    <label htmlFor="isoCheck" style={{ fontWeight: 600, color: formData.iso_17025 ? '#4338ca' : 'var(--text)', cursor: 'pointer' }}>
                      Aplica ISO 17025 (Alcance de acreditación)
                    </label>
                  </div>
                </>
              )}
            </div>

             {/* Columna Derecha: Metrología */}
             <div>
              <h3 style={{ borderBottom: '2px solid var(--border)', paddingBottom: '8px', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} /> 2. Control Metrológico
              </h3>

              <div className="input-group">
                <label className="input-label">Uso previsto en el Laboratorio</label>
                <input type="text" className="input-field" name="intended_use" value={formData.intended_use || ''} onChange={handleChange} placeholder="Ej. Medición temperatura estufas" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label className="input-label" style={{ fontSize: '0.85rem' }}>Rango de Medición / Uso</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" className="input-field" placeholder="Valor (ej. 0-100)" value={rangeVal} onChange={e => setRangeVal(e.target.value)} style={{ flex: 2, margin: 0 }} />
                    <input type="text" className="input-field" placeholder="Unidad (ej. °C)" value={rangeUnit} onChange={e => setRangeUnit(e.target.value)} style={{ flex: 1, margin: 0 }} />
                    <div style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', color: 'var(--text-muted)' }}>+/-</div>
                    <input type="text" className="input-field" placeholder="Dif. (ej. 2)" value={rangeDiff} onChange={e => setRangeDiff(e.target.value)} style={{ flex: 1, margin: 0 }} />
                  </div>
                </div>

                <div>
                  <label className="input-label" style={{ fontSize: '0.85rem' }}>Tolerancia Permitida HSLAB (Valor Absoluto)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" className="input-field" placeholder="Valor (ej. 0.5)" value={tolVal} onChange={e => setTolVal(e.target.value)} style={{ flex: 2, margin: 0 }} />
                    <input type="text" className="input-field" placeholder="Unidad (ej. °C)" value={tolUnit} onChange={e => setTolUnit(e.target.value)} style={{ flex: 1, margin: 0 }} />
                  </div>
                </div>
              </div>

              {/* CALIBRACIÓN */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px', marginBottom: '8px' }}>
                <input type="checkbox" id="reqCal" checked={requiresCalibration} onChange={(e) => setRequiresCalibration(e.target.checked)} style={{ transform: 'scale(1.2)', cursor: 'pointer' }} />
                <label htmlFor="reqCal" style={{ fontWeight: 'bold', color: '#0f766e', cursor: 'pointer' }}>Requiere Calibración</label>
              </div>

              {requiresCalibration && (
                <div style={{ backgroundColor: '#f0fdfa', padding: '16px', borderRadius: '8px', border: '1px solid #ccfbf1', marginBottom: '16px' }}>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                    {!isConsultor && (
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label">Interna / Externa</label>
                        <select className="input-field" name="calibration_type" value={formData.calibration_type || ''} onChange={handleChange}>
                          <option value="">- Selecciona -</option>
                          <option value="Interna">Propia (Interna)</option>
                          <option value="Externa">Certificada (Externa)</option>
                        </select>
                      </div>
                    )}
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label">Frecuencia</label>
                      <select className="input-field" name="calibration_freq" value={formData.calibration_freq || ''} onChange={handleChange}>
                        <option value="">- Selecciona -</option>
                        <option value="Semestral">Semestral</option>
                        <option value="Anual">Anual</option>
                        <option value="Bianual">Bianual (2 Años)</option>
                        <option value="5 años">Cada 5 años</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label" style={{ color: isCalExpired ? '#e11d48' : 'inherit', fontWeight: isCalExpired ? 'bold' : 'normal' }}>
                         {isCalExpired ? 'Vencido el (dd/mm/aaaa)' : 'Válido Hasta (dd/mm/aaaa)'}
                      </label>
                      <input 
                        type="date" 
                        className="input-field" 
                        name="cal_valid_until" 
                        value={formData.cal_valid_until || ''} 
                        onChange={handleChange} 
                        style={{ 
                          backgroundColor: isCalExpired ? '#fff1f2' : 'white',
                          borderColor: isCalExpired ? '#fda4af' : 'var(--border)',
                          color: isCalExpired ? '#e11d48' : 'inherit'
                        }}
                      />
                    </div>
                    {!isConsultor && (
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label">Restricción Patrón 1/4</label>
                        <select className="input-field" name="standard_complies" value={formData.standard_complies || ''} onChange={handleChange}>
                          <option value="">- Selecciona -</option>
                          <option value="Si">Sí cumple 1/4 de Tolerancia</option>
                          <option value="No">No cumple 1/4</option>
                          <option value="Limitado">Limitado (Anotaciones en informe)</option>
                        </select>
                      </div>
                    )}
                    {!isConsultor && formData.standard_complies === 'Limitado' && (
                      <div className="input-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                        <label className="input-label" style={{ color: '#d97706', fontWeight: 600 }}>
                          ⚠ Limitaciones de uso (obligatorio)
                        </label>
                        <textarea
                          className="input-field"
                          name="standard_complies_note"
                          value={formData.standard_complies_note || ''}
                          onChange={handleChange}
                          rows={3}
                          placeholder="Especifica las limitaciones de uso de este equipo patrón..."
                          style={{ resize: 'vertical', borderColor: '#f59e0b', backgroundColor: '#fffbeb' }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Link size={14} /> Link Informe de Calibración
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" className="input-field" name="cal_report_ref" value={formData.cal_report_ref || ''} onChange={handleChange} placeholder="https://drive.google.com/..." style={{ margin: 0 }} />
                      {formData.cal_report_ref && (
                        <a href={ensureAbsoluteUrl(formData.cal_report_ref)} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center' }} title="Ver Certificado">
                          <ExternalLink size={18} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', marginBottom: '8px' }}>
                <input type="checkbox" id="reqVer" checked={requiresVerification} onChange={(e) => setRequiresVerification(e.target.checked)} style={{ transform: 'scale(1.2)', cursor: 'pointer' }} />
                <label htmlFor="reqVer" style={{ fontWeight: 'bold', color: 'var(--secondary)', cursor: 'pointer' }}>Requiere Verificación Intermedia</label>
              </div>

              {requiresVerification && (
                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                    {!isConsultor && (
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label">Frecuencia</label>
                        <input type="text" className="input-field" name="verification_freq" value={formData.verification_freq || ''} onChange={handleChange} placeholder="Ej. Diaria, Mensual, Uso..." />
                      </div>
                    )}
                    <div className="input-group" style={{ marginBottom: 0, gridColumn: isConsultor ? '1 / -1' : 'auto' }}>
                      <label className="input-label" style={{ color: isVerExpired ? '#e11d48' : 'inherit', fontWeight: isVerExpired ? 'bold' : 'normal' }}>
                        {isVerExpired ? 'Vencido el' : 'Válido Hasta'}
                      </label>
                      <input 
                        type="date" 
                        className="input-field" 
                        name="ver_valid_until" 
                        value={formData.ver_valid_until || ''} 
                        onChange={handleChange} 
                        style={{ 
                          backgroundColor: isVerExpired ? '#fff1f2' : 'white',
                          borderColor: isVerExpired ? '#fda4af' : 'var(--border)',
                          color: isVerExpired ? '#e11d48' : 'inherit'
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Link size={14} /> Link Informe de Verificación
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" className="input-field" name="ver_report_ref" value={formData.ver_report_ref || ''} onChange={handleChange} placeholder="https://drive.google.com/..." style={{ margin: 0 }} />
                      {formData.ver_report_ref && (
                        <a href={ensureAbsoluteUrl(formData.ver_report_ref)} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center' }} title="Ver Informe">
                          <ExternalLink size={18} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ── Sección 3: Adquisición ─────────────────────────────── */}
          <div style={{ marginTop: '32px', borderTop: '2px solid var(--border)', paddingTop: '24px' }}>
            <h3 style={{ paddingBottom: '8px', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Package size={18} /> 3. Adquisición
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {/* Proveedor */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Proveedor de Compra</label>
                <input
                  type="text"
                  className="input-field"
                  name="purchase_supplier"
                  value={formData.purchase_supplier || ''}
                  onChange={handleChange}
                  list="acq-suppliers-list"
                  placeholder="Selecciona o escribe el proveedor..."
                  style={{ margin: 0 }}
                />
                <datalist id="acq-suppliers-list">
                  {suppliers.map(s => <option key={s.id} value={s.name} />)}
                </datalist>
              </div>

              {/* Nº Factura */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Nº Factura</label>
                <input
                  type="text"
                  className="input-field"
                  name="invoice_number"
                  value={formData.invoice_number || ''}
                  onChange={handleChange}
                  placeholder="Ej: F-2025/0123"
                  style={{ margin: 0 }}
                />
              </div>

              {/* Importe */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Importe (€ sin IVA)</label>
                <input
                  type="number"
                  className="input-field"
                  name="purchase_amount"
                  value={formData.purchase_amount || ''}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  style={{ margin: 0 }}
                />
              </div>
            </div>

            {/* PDF de factura */}
            <div>
              <label className="input-label">Factura PDF</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {formData.invoice_pdf_url ? (
                  <>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px' }}>
                      <FileText size={16} color="#16a34a" />
                      <span style={{ fontSize: '0.875rem', color: '#15803d', fontWeight: 600 }}>
                        {formData.invoice_pdf_url.split('/').pop()?.split('_').slice(2).join('_') || 'Factura adjunta'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', color: 'var(--primary)' }}
                      onClick={handleViewInvoicePdf}
                      title="Ver factura"
                    >
                      <Eye size={16} /> Ver
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', color: 'var(--danger)', border: 'none' }}
                      onClick={() => setFormData(prev => ({ ...prev, invoice_pdf_url: '' }))}
                      title="Quitar factura"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={isUploadingPdf}
                  >
                    <Upload size={16} />
                    {isUploadingPdf ? 'Subiendo...' : 'Adjuntar Factura PDF'}
                  </button>
                )}
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  style={{ display: 'none' }}
                  onChange={handlePdfUpload}
                />
              </div>
            </div>
          </div>

          {/* ── Historial de Averías y Reparaciones ── */}
          {equipment?.id && (() => {
            const incidentMode = getIncidentMode(formData);
            if (incidentMode === 'none') return null;

            const fmtD = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES') : null;

            const incidentInner = (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => { setEditingIncident(null); setIncidentForm(emptyIncident()); setIncidentFile(null); setShowIncidentForm(p => !p); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '7px', border: '1px solid #dc2626', background: '#fff1f2', color: '#dc2626', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                    <Plus size={13} /> Registrar avería
                  </button>
                </div>
                {showIncidentForm && (
                  <div style={{ background: '#fafafa', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fecha avería *</label>
                        <input type="date" value={incidentForm.incident_date} onChange={e => setIncidentForm(p => ({ ...p, incident_date: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '0.88rem', marginTop: '4px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fecha resolución</label>
                        <input type="date" value={incidentForm.resolved_date} onChange={e => setIncidentForm(p => ({ ...p, resolved_date: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '0.88rem', marginTop: '4px', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Descripción de la avería</label>
                      <textarea value={incidentForm.description} onChange={e => setIncidentForm(p => ({ ...p, description: e.target.value }))} rows={3} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '0.88rem', resize: 'vertical', marginTop: '4px', boxSizing: 'border-box' }} placeholder="Describe la avería o incidencia..." />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Acciones correctivas</label>
                      <textarea value={incidentForm.corrective_action} onChange={e => setIncidentForm(p => ({ ...p, corrective_action: e.target.value }))} rows={2} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '0.88rem', resize: 'vertical', marginTop: '4px', boxSizing: 'border-box' }} placeholder="Reparación realizada, proveedor, referencia..." />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Factura / Albarán</label>
                      <div onClick={() => incidentFileRef.current?.click()} style={{ marginTop: '4px', border: `2px dashed ${incidentFile ? '#dc2626' : 'var(--border)'}`, borderRadius: '8px', padding: '12px 16px', cursor: 'pointer', background: incidentFile ? '#fff1f2' : '#fafafa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Upload size={15} color={incidentFile ? '#dc2626' : '#94a3b8'} />
                        {incidentFile ? <span style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 600 }}>{incidentFile.name}</span>
                          : incidentForm.attachment_name ? <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{incidentForm.attachment_name} · <span style={{ color: 'var(--primary)' }}>Cambiar</span></span>
                          : <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Adjuntar factura o albarán (PDF / imagen)</span>}
                        {incidentForm.attachment_url && !incidentFile && <a href={incidentForm.attachment_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ marginLeft: 'auto', color: 'var(--primary)' }}><Eye size={15} /></a>}
                      </div>
                      <input ref={incidentFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) setIncidentFile(e.target.files[0]); }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button type="button" onClick={() => { setShowIncidentForm(false); setEditingIncident(null); setIncidentFile(null); }} style={{ padding: '7px 16px', borderRadius: '7px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
                      <button type="button" onClick={saveIncident} disabled={savingIncident} style={{ padding: '7px 16px', borderRadius: '7px', border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Save size={14} />{savingIncident ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                )}
                {incidents.length === 0 && !showIncidentForm && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>Sin averías registradas</div>
                )}
                {incidents.length > 0 && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '100px 100px 1fr 1fr 28px 28px 28px', gap: '8px', padding: '7px 14px', background: '#f8fafc', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>
                      <span>Fecha</span><span>Resolución</span><span>Descripción</span><span>Acción correctiva</span><span></span><span></span><span></span>
                    </div>
                    {incidents.map(inc => (
                      <div key={inc.id} style={{ display: 'grid', gridTemplateColumns: '100px 100px 1fr 1fr 28px 28px 28px', gap: '8px', padding: '10px 14px', alignItems: 'center', borderBottom: '1px solid #f1f5f9', fontSize: '0.82rem' }}>
                        <span style={{ fontWeight: 600, color: '#dc2626' }}>{fmtD(inc.incident_date) || '—'}</span>
                        <span style={{ color: inc.resolved_date ? '#16a34a' : '#94a3b8', fontWeight: inc.resolved_date ? 600 : 400 }}>{fmtD(inc.resolved_date) || 'Pendiente'}</span>
                        <span style={{ color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inc.description}>{inc.description || '—'}</span>
                        <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inc.corrective_action}>{inc.corrective_action || '—'}</span>
                        {inc.attachment_url ? <a href={inc.attachment_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', display: 'flex' }} title={inc.attachment_name || 'Ver'}><Eye size={14} /></a> : <span />}
                        <button type="button" onClick={() => openEditIncident(inc)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex' }}><Edit3 size={13} /></button>
                        <button type="button" onClick={() => deleteIncident(inc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px', display: 'flex' }}><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );

            if (incidentMode === 'optional') return (
              <div style={{ marginTop: '20px' }}>
                {!incidentOptionalOpen ? (
                  <button type="button" onClick={() => setIncidentOptionalOpen(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', textDecoration: 'underline' }}>
                    <Wrench size={13} />
                    {incidents.length > 0 ? `Historial de averías (${incidents.length})` : 'Registrar avería ocasional'}
                  </button>
                ) : (
                  <div style={{ border: '1px solid #fecaca', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ background: '#fff1f2', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Wrench size={14} color="#dc2626" />
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#dc2626', flex: 1 }}>Averías / Reparaciones</span>
                      {incidents.length > 0 && <span style={{ fontSize: '0.72rem', background: '#fee2e2', color: '#dc2626', borderRadius: '999px', padding: '2px 8px', fontWeight: 700 }}>{incidents.length}</span>}
                      <button type="button" onClick={() => setIncidentOptionalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><ChevronUp size={14} /></button>
                    </div>
                    <div style={{ padding: '14px 20px' }}>{incidentInner}</div>
                  </div>
                )}
              </div>
            );

            return (
              <div style={{ marginTop: '32px', border: '1px solid #fecaca', borderRadius: '12px', overflow: 'hidden' }}>
                <button type="button" onClick={() => setIncidentSectionOpen(p => !p)}
                  style={{ width: '100%', background: '#fff1f2', border: 'none', cursor: 'pointer', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
                  <Wrench size={16} color="#dc2626" />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#dc2626', flex: 1 }}>Historial de Averías y Reparaciones</span>
                  {incidents.length > 0 && <span style={{ fontSize: '0.75rem', background: '#fee2e2', color: '#dc2626', borderRadius: '999px', padding: '2px 8px', fontWeight: 700 }}>{incidents.length}</span>}
                  {incidentSectionOpen ? <ChevronUp size={15} color="#dc2626" /> : <ChevronDown size={15} color="#dc2626" />}
                </button>
                {incidentSectionOpen && <div style={{ padding: '16px 20px' }}>{incidentInner}</div>}
              </div>
            );
          })()}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', marginTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <div>
              {equipment?.id && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`¿Eliminar el equipo ${formData.equipment_code} — ${formData.name}? Esta acción no se puede deshacer.`)) return;
                    const { error } = await supabase.from('equipments').delete().eq('id', equipment.id);
                    if (error) { alert('Error eliminando: ' + error.message); }
                    else { onSave(); onClose(); }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #fda4af', backgroundColor: '#fff1f2', color: '#e11d48', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
                >
                  <Trash2 size={16} /> Eliminar Equipo
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} disabled={isSaving}>
                <Save size={18} /> {isSaving ? 'Guardando...' : 'Guardar Ficha Técnica'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
