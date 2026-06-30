import React, { useState, useMemo } from 'react';
import { exportEquipmentWord } from './exportEquipmentWord';
import * as XLSX from 'xlsx';

const FIELDS = [
  { key: 'equipment_code',   label: 'Código',              always: true },
  { key: 'name',             label: 'Descripción',          always: true },
  { key: 'model',            label: 'Modelo',               default: true },
  { key: 'serial_number',    label: 'Número de Serie',      default: true },
  { key: 'equipment_type',   label: 'Tipo / Subtipo',       default: true },
  { key: 'macro_category',   label: 'Familia ISO',          default: true },
  { key: 'measuring_range',  label: 'Rango de Medición',    default: true },
  { key: 'tolerance',        label: 'Tolerancia',           default: true },
  { key: 'calibration_type', label: 'Tipo Calibración',     default: true },
  { key: 'cal_valid_until',  label: 'Válido hasta (Cal.)',  default: true },
  { key: 'calibration_freq', label: 'Frecuencia Cal.',      default: true },
  { key: 'ver_valid_until',  label: 'Válido hasta (Ver.)',  default: false },
  { key: 'verification_freq',label: 'Frecuencia Ver.',      default: false },
  { key: 'cal_report_ref',   label: 'Ref. Certificado',     default: false },
  { key: 'status',           label: 'Estado',               default: true },
  { key: 'iso_17025',        label: 'ISO 17025',            default: false },
  { key: 'acquisition_date', label: 'Fecha Adquisición',    default: false },
  { key: 'assigned_to',      label: 'Asignado a',           default: false },
  { key: 'lab',              label: 'Laboratorio',          default: false },
];

const CATEGORY_ORDER = [
  'Patrones Metrológicos',
  'Materiales de Referencia (MR)',
  'Medios Isotermos (Neveras - Estufas y Baños)',
  'Termómetros - Loggers y Equipos Patrón',
  'Sondas de Medición de Temperatura - Humedad',
  'Pipetas y Balanzas',
  'Equipos Auxiliares y de Preparación',
  'Equipos Consultores Externos',
];

export default function ExportWordModal({ equipments, globalLab, preSelected = [], onClose }) {
  // Filters
  const [onlyISO, setOnlyISO]     = useState(false);
  const [statusFilter, setStatus] = useState(['ALTA', 'PRE-ALTA']);
  const [catFilter, setCat]       = useState([]);          // empty = all
  const [expiryDays, setExpiry]   = useState(null);        // null = no filter, number = within N days
  const [calTypeFilter, setCalType] = useState([]);        // [] = all, ['Interna','Externa','—']
  const [selectedFields, setFields] = useState(
    FIELDS.filter(f => f.always || f.default).map(f => f.key)
  );
  const [groupBy, setGroupBy]     = useState(true);
  const [docTitle, setDocTitle]   = useState('LISTADO DE EQUIPOS');
  const [docSubtitle, setSubtitle]= useState('');
  const [format, setFormat]       = useState('word');      // 'word' | 'excel'

  // Available categories
  const allCats = useMemo(() => {
    const s = new Set(equipments.map(e => e.macro_category).filter(Boolean));
    return CATEGORY_ORDER.filter(c => s.has(c)).concat([...s].filter(c => !CATEGORY_ORDER.includes(c)));
  }, [equipments]);

  // Apply filters
  const filtered = useMemo(() => {
    let base = preSelected.length > 0
      ? equipments.filter(e => preSelected.includes(e.id))
      : equipments;

    if (onlyISO) base = base.filter(e => e.iso_17025);
    base = base.filter(e => statusFilter.includes(e.status || 'ALTA'));
    if (catFilter.length > 0) base = base.filter(e => catFilter.includes(e.macro_category));
    if (calTypeFilter.length > 0) {
      base = base.filter(e => {
        const ct = (e.calibration_type || '').trim();
        let inferred;
        if (ct && ct !== 'N/A') {
          inferred = ct.toLowerCase().includes('extern') ? 'Externa'
                   : ct.toLowerCase().includes('intern') ? 'Interna' : null;
        }
        if (!inferred) {
          const ref = (e.cal_report_ref || '').trim();
          if (!ref || ref === 'N/A') inferred = '—';
          else if (ref.includes('spreadsheets')) inferred = 'Interna';
          else if (ref.startsWith('http') || /^\d+$/.test(ref)) inferred = 'Externa';
          else inferred = '—';
        }
        return calTypeFilter.includes(inferred);
      });
    }
    if (expiryDays !== null) {
      const limit = new Date();
      limit.setDate(limit.getDate() + expiryDays);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      base = base.filter(e => {
        const dates = [e.cal_valid_until, e.ver_valid_until].filter(Boolean).map(d => new Date(d));
        return dates.some(d => d >= today && d <= limit);
      });
    }
    return base;
  }, [equipments, preSelected, onlyISO, statusFilter, catFilter, calTypeFilter, expiryDays]);

  function toggleStatus(s) {
    setStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }
  function toggleCat(c) {
    setCat(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }
  function toggleField(k) {
    const f = FIELDS.find(f => f.key === k);
    if (f?.always) return;
    setFields(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  }

  async function handleExport() {
    if (format === 'word') {
      await exportEquipmentWord(filtered, {
        lab: globalLab,
        title: docTitle,
        subtitle: docSubtitle || `${filtered.length} equipos · ${globalLab} · ${new Date().toLocaleDateString('es-ES')}`,
        groupByCategory: groupBy,
        fields: selectedFields,
        filename: `${docTitle.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.docx`,
      });
    } else {
      const fieldDefs = FIELDS.filter(f => selectedFields.includes(f.key));
      const rows = filtered.map(eq => {
        const row = {};
        fieldDefs.forEach(f => {
          let v = eq[f.key];
          if (f.key === 'iso_17025') v = v ? 'SÍ' : 'NO';
          row[f.label] = v ?? '';
        });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Equipos');
      XLSX.writeFile(wb, `${docTitle.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
    }
    onClose();
  }

  const pill = (label, active, onClick, color = 'var(--primary)') => (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
      border: `2px solid ${active ? color : '#d1d5db'}`,
      backgroundColor: active ? color : 'white',
      color: active ? 'white' : '#374151',
      transition: 'all .15s',
    }}>{label}</button>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1300, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px', width: '680px', maxHeight: '90vh',
        overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#003A70,#0076CE)', padding: '24px 28px', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: 'white', fontSize: '1.2rem' }}>📄 Exportar Listado de Equipos</h2>
            <p style={{ margin: '4px 0 0', color: '#93c5fd', fontSize: '0.85rem' }}>{globalLab}</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: 'white', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

          {/* Format */}
          <div>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.85rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em' }}>Formato de salida</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {pill('Word (.docx)', format === 'word', () => setFormat('word'), '#1d4ed8')}
              {pill('Excel (.xlsx)', format === 'excel', () => setFormat('excel'), '#166534')}
            </div>
          </div>

          {/* Filters */}
          <div>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.85rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em' }}>Filtros</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {pill(onlyISO ? '✓ Solo ISO 17025' : 'Solo ISO 17025', onlyISO, () => setOnlyISO(!onlyISO), '#0076CE')}
              {pill('ALTA', statusFilter.includes('ALTA'), () => toggleStatus('ALTA'), '#065F46')}
              {pill('PRE-ALTA', statusFilter.includes('PRE-ALTA'), () => toggleStatus('PRE-ALTA'), '#92400E')}
              {pill('BAJA', statusFilter.includes('BAJA'), () => toggleStatus('BAJA'), '#991B1B')}
            </div>
          </div>

          {/* Calibration type filter */}
          <div>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.85rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em' }}>Tipo de calibración</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {pill('Todas', calTypeFilter.length === 0, () => setCalType([]), '#6b7280')}
              {[
                { key: 'Interna', label: '🟢 Interna', color: '#166534', bg: '#dcfce7' },
                { key: 'Externa', label: '🔵 Externa', color: '#1d4ed8', bg: '#dbeafe' },
                { key: '—',       label: '⚪ Sin calibración', color: '#4b5563', bg: '#f3f4f6' },
              ].map(({ key, label, color, bg }) => {
                const active = calTypeFilter.includes(key);
                return (
                  <button key={key} onClick={() => setCalType(prev => active ? prev.filter(x => x !== key) : [...prev, key])} style={{
                    padding: '5px 14px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                    border: `2px solid ${active ? color : '#d1d5db'}`,
                    backgroundColor: active ? bg : 'white',
                    color: active ? color : '#374151',
                  }}>{label}</button>
                );
              })}
            </div>
          </div>

          {/* Expiry filter */}
          <div>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.85rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Próximos a caducar
              {expiryDays !== null && (
                <span style={{ marginLeft: 8, color: '#b45309', fontWeight: 400, textTransform: 'none', fontSize: '0.8rem' }}>
                  ⚠ {filtered.length} equipo{filtered.length !== 1 ? 's' : ''} caducan en ≤{expiryDays} días
                </span>
              )}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {pill('Sin filtro', expiryDays === null, () => setExpiry(null), '#6b7280')}
              {[30, 60, 90, 180].map(d => (
                <button key={d} onClick={() => setExpiry(expiryDays === d ? null : d)} style={{
                  padding: '5px 14px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                  border: `2px solid ${expiryDays === d ? '#b45309' : '#d1d5db'}`,
                  backgroundColor: expiryDays === d ? '#fef3c7' : 'white',
                  color: expiryDays === d ? '#92400e' : '#374151',
                }}>
                  ≤ {d} días
                </button>
              ))}
            </div>
          </div>

          {/* Category filter */}
          <div>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.85rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Familias {catFilter.length === 0 ? <span style={{ color: '#6b7280', fontWeight: 400, textTransform: 'none' }}>(todas)</span> : <span style={{ color: '#0076CE', fontWeight: 400, textTransform: 'none' }}>({catFilter.length} seleccionadas)</span>}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button onClick={() => setCat([])} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: `2px solid ${catFilter.length === 0 ? '#0076CE' : '#d1d5db'}`, backgroundColor: catFilter.length === 0 ? '#0076CE' : 'white', color: catFilter.length === 0 ? 'white' : '#374151' }}>Todas</button>
              {allCats.map(c => (
                <button key={c} onClick={() => toggleCat(c)} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: `2px solid ${catFilter.includes(c) ? '#0076CE' : '#d1d5db'}`, backgroundColor: catFilter.includes(c) ? '#EFF6FF' : 'white', color: catFilter.includes(c) ? '#1d4ed8' : '#374151' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.85rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em' }}>Columnas a incluir</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {FIELDS.map(f => (
                <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: f.always ? 'default' : 'pointer', fontSize: '0.85rem', color: '#374151', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(f.key)}
                    disabled={f.always}
                    onChange={() => toggleField(f.key)}
                    style={{ accentColor: '#0076CE', width: 15, height: 15 }}
                  />
                  {f.label}
                  {f.always && <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>(siempre)</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Group / title (Word only) */}
          {format === 'word' && (
            <>
              <div>
                <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.85rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em' }}>Opciones Word</p>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={groupBy} onChange={e => setGroupBy(e.target.checked)} style={{ accentColor: '#0076CE', width: 15, height: 15 }} />
                  Agrupar por familia de equipo
                </label>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input value={docTitle} onChange={e => setDocTitle(e.target.value)}
                  placeholder="Título del documento"
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem', fontWeight: 600 }}
                />
                <input value={docSubtitle} onChange={e => setSubtitle(e.target.value)}
                  placeholder="Subtítulo opcional (ej: Auditoría ENAC · Junio 2026)"
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem', color: '#555' }}
                />
              </div>
            </>
          )}

          {/* Preview count + actions */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: '#374151' }}>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0076CE' }}>{filtered.length}</span>
              {' '}equipo{filtered.length !== 1 ? 's' : ''} se incluirán en el export
              {preSelected.length > 0 && <span style={{ color: '#6b7280', marginLeft: 6 }}>(de {preSelected.length} seleccionados)</span>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
                Cancelar
              </button>
              <button
                disabled={filtered.length === 0}
                onClick={handleExport}
                style={{ padding: '10px 24px', borderRadius: 8, border: 'none', cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.95rem', backgroundColor: format === 'word' ? '#1d4ed8' : '#166534', color: 'white', opacity: filtered.length === 0 ? 0.5 : 1 }}
              >
                {format === 'word' ? '📄 Generar Word' : '📊 Generar Excel'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
