import React, { useState, useRef, useMemo, useCallback } from 'react';
import { ArrowLeft, Upload, AlertTriangle, CheckCircle, Clock, BarChart2, XCircle } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseCSVText(text) {
  const records = []; let record = [], field = '', inQuotes = false;
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
      if (record.some(f => f !== '')) records.push(record);
      record = [];
    } else { field += c; }
  }
  if (field !== '' || record.length > 0) { record.push(field.trim()); records.push(record); }
  return records;
}

function getSLA(analitica) {
  const a = analitica.toLowerCase();
  if (a.includes('legionella') || /^3\.1/.test(a)) return { days: 14, cat: 'Legionella' };
  if (/^2\./.test(a)) return { days: 5, cat: 'Agua/Piscina' };
  if (/^1\.6|^5\./.test(a)) return { days: 4, cat: 'Superficie' };
  if (/^1\./.test(a)) return { days: 4, cat: 'Alimento' };
  return { days: 4, cat: 'Agua/Red' };
}

function buildRows(text) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rows = parseCSVText(text);
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 23) continue;
    const estado = r[22].trim(); if (!estado) continue;
    const fs = r[10].trim(); if (!fs) continue;
    const p = fs.split('/'); if (p.length < 3) continue;
    const rec = new Date(+p[2], +p[1] - 1, +p[0]);
    if (isNaN(rec.getTime())) continue;
    const dias = Math.floor((today - rec) / 86400000);
    const analitica = r[9].trim();
    const sla = getSLA(analitica);
    const lim = new Date(rec); lim.setDate(lim.getDate() + sla.days);
    const fl = lim.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    data.push({
      id: r[0].trim(), numero: r[1].trim(), lab: r[2].trim(),
      grupo: r[5].trim(), hotel: r[6].trim(), region: r[7].trim(),
      analitica, fecha_rec: fs, muestra: r[13]?.trim() || '',
      estado, dias, sla: sla.days, cat: sla.cat, fecha_limite: fl,
      retraso: dias - sla.days,
    });
  }
  return data;
}

function severity(r) {
  if (r.dias > r.sla) return 'crit';
  if (r.dias === r.sla) return 'warn';
  return 'ok';
}

function sinIniciar(r) { return r.estado.startsWith('1') && r.dias > 2; }

// ── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: { minHeight: '100vh', background: '#EAF0F8', fontFamily: "'Inter', system-ui, sans-serif" },
  header: { background: '#0E2340', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16, height: 52, position: 'sticky', top: 0, zIndex: 100 },
  backBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '.82rem', padding: '4px 0' },
  hTitle: { color: '#fff', fontWeight: 700, fontSize: '.9rem' },
  hSub: { color: 'rgba(255,255,255,.4)', fontSize: '.7rem' },
  spacer: { flex: 1 },
  uploadBtn: { background: 'rgba(255,255,255,.9)', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: '.75rem', fontWeight: 600, color: '#0E2340', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  main: { padding: '18px 24px 48px', maxWidth: 1600, margin: '0 auto' },
  card: { background: '#fff', border: '1px solid #D1DCE9', borderRadius: 10, padding: '14px 18px', marginBottom: 12 },
  slaRow: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  slaTitle: { fontSize: '.67rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#7A96B0', marginRight: 4 },
  slaChip: (color) => ({ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #D1DCE9', borderRadius: 8, padding: '5px 12px', fontSize: '.72rem', background: '#F2F6FB' }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 12 },
  tile: (color) => ({ background: '#fff', border: '1px solid #D1DCE9', borderRadius: 10, padding: '12px 16px', borderTop: `3px solid ${color}` }),
  tileLabel: { fontSize: '.66rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#7A96B0', marginBottom: 6 },
  tileVal: (color) => ({ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.9rem', fontWeight: 700, color }),
  tileSub: { fontSize: '.66rem', color: '#7A96B0', marginTop: 4 },
  filters: { background: '#fff', border: '1px solid #D1DCE9', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  input: { fontFamily: 'inherit', fontSize: '.77rem', padding: '6px 10px', border: '1px solid #D1DCE9', borderRadius: 7, background: '#F2F6FB', color: '#0E2340', width: 200, outline: 'none' },
  select: { fontFamily: 'inherit', fontSize: '.76rem', padding: '6px 10px', border: '1px solid #D1DCE9', borderRadius: 7, background: '#F2F6FB', color: '#0E2340', cursor: 'pointer', outline: 'none' },
  chip: (active, color) => ({ fontSize: '.7rem', fontWeight: 600, padding: '4px 11px', borderRadius: 20, border: `1.5px solid ${active ? color : '#D1DCE9'}`, cursor: 'pointer', background: active ? color + '18' : 'transparent', color: active ? color : '#4A6A8A', fontFamily: 'inherit' }),
  tblWrap: { background: '#fff', border: '1px solid #D1DCE9', borderRadius: 10, overflow: 'hidden' },
  th: (sorted) => ({ padding: '8px 12px', textAlign: 'left', fontSize: '.66rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: sorted ? '#0076CE' : '#7A96B0', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', background: '#F2F6FB', borderBottom: '2px solid #D1DCE9' }),
  td: { padding: '7px 12px', fontSize: '.77rem', verticalAlign: 'middle' },
  badge: (bg, color, border) => ({ display: 'inline-flex', alignItems: 'center', fontSize: '.63rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap', letterSpacing: '.03em', background: bg, color, border: `1px solid ${border}` }),
  pag: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderTop: '1px solid #D1DCE9', background: '#F2F6FB', fontSize: '.73rem', color: '#4A6A8A', flexWrap: 'wrap', gap: 6 },
  pgBtn: (active) => ({ fontFamily: 'inherit', fontSize: '.72rem', padding: '4px 8px', border: '1px solid #D1DCE9', borderRadius: 6, background: active ? '#0076CE' : '#fff', color: active ? '#fff' : '#0E2340', cursor: 'pointer' }),
  emptyWrap: { minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#7A96B0' },
  dropZone: { border: '2px dashed #D1DCE9', borderRadius: 14, padding: '48px 64px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'border-color .15s, background .15s' },
};

const SEV_COLORS = { ok: '#059669', warn: '#D97706', crit: '#DC2626', sini: '#F59E0B', total: '#0076CE' };
const BADGES = {
  ok: { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', label: 'En plazo' },
  warn: { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', label: 'Último día' },
  crit: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Fuera plazo' },
};
const CAT_BADGES = {
  'Legionella': { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
  'Agua/Piscina': { bg: '#EFF6FF', color: '#0369A1', border: '#BAE6FD' },
  'Alimento': { bg: '#FDF2F8', color: '#BE185D', border: '#FBCFE8' },
  'Superficie': { bg: '#ECFEFF', color: '#0E7490', border: '#A5F3FC' },
  'Agua/Red': { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
};
const PER_PAGE = 75;

// ── Component ─────────────────────────────────────────────────────────────────

export default function KPIModule({ onBackToHub }) {
  const [data, setData] = useState([]);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [catF, setCatF] = useState('');
  const [estadoF, setEstadoF] = useState('');
  const [regionF, setRegionF] = useState('');
  const [sevF, setSevF] = useState('crit');
  const [sortCol, setSortCol] = useState('retraso');
  const [sortDir, setSortDir] = useState(-1);
  const [page, setPage] = useState(1);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const showToast = useCallback((msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadText = useCallback((text, enc) => {
    const hasReplacement = text.indexOf('�') !== -1;
    if (enc === 'UTF-8' && hasReplacement) return false; // signal: retry with latin-1
    const rows = buildRows(text);
    if (rows.length === 0) {
      showToast('No se encontraron filas válidas — revisa el formato del CSV', false);
      return true;
    }
    setData(rows);
    setPage(1);
    setSevF('crit');
    showToast(`✓ ${rows.length.toLocaleString()} muestras cargadas`);
    return true;
  }, [showToast]);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const tryEnc = (enc) => {
      const reader = new FileReader();
      reader.onerror = () => showToast('Error leyendo el archivo', false);
      reader.onload = (ev) => {
        const ok = loadText(ev.target.result, enc);
        if (!ok) tryEnc('ISO-8859-1');
      };
      reader.readAsText(file, enc);
    };
    tryEnc('UTF-8');
  }, [loadText, showToast]);

  const onInputChange = (e) => { handleFile(e.target.files[0]); e.target.value = ''; };
  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };

  // ── Computed ──────────────────────────────────────────────────────────────
  const regions = useMemo(() => [...new Set(data.map(r => r.region).filter(Boolean))].sort(), [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(r => {
      if (catF && r.cat !== catF) return false;
      if (estadoF && !r.estado.startsWith(estadoF)) return false;
      if (regionF && r.region !== regionF) return false;
      if (q && !r.hotel.toLowerCase().includes(q) && !r.numero.toLowerCase().includes(q) && !r.analitica.toLowerCase().includes(q)) return false;
      if (sevF === 'crit') return severity(r) === 'crit';
      if (sevF === 'warn') return severity(r) === 'warn';
      if (sevF === 'ok') return severity(r) === 'ok';
      if (sevF === 'sini') return sinIniciar(r);
      return true;
    });
  }, [data, search, catF, estadoF, regionF, sevF]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av, bv;
      if (sortCol === 'retraso') { av = a.retraso; bv = b.retraso; }
      else if (sortCol === 'dias') { av = a.dias; bv = b.dias; }
      else if (sortCol === 'sev') { const o = { crit: 3, warn: 2, ok: 1 }; av = o[severity(a)] || 0; bv = o[severity(b)] || 0; }
      else { av = (a[sortCol] || '').toLowerCase(); bv = (b[sortCol] || '').toLowerCase(); }
      return av < bv ? -sortDir : av > bv ? sortDir : 0;
    });
  }, [filtered, sortCol, sortDir]);

  const pages = Math.ceil(sorted.length / PER_PAGE) || 1;
  const safeP = Math.min(page, pages);
  const slice = sorted.slice((safeP - 1) * PER_PAGE, safeP * PER_PAGE);

  const counts = useMemo(() => ({
    ok: data.filter(r => severity(r) === 'ok').length,
    warn: data.filter(r => severity(r) === 'warn').length,
    crit: data.filter(r => severity(r) === 'crit').length,
    sini: data.filter(sinIniciar).length,
  }), [data]);

  const sort = (col) => {
    if (sortCol === col) setSortDir(d => -d);
    else { setSortCol(col); setSortDir(-1); }
    setPage(1);
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const SevBadge = ({ sev }) => <span style={S.badge(BADGES[sev].bg, BADGES[sev].color, BADGES[sev].border)}>{BADGES[sev].label}</span>;
  const CatBadge = ({ cat }) => { const b = CAT_BADGES[cat] || CAT_BADGES['Agua/Red']; return <span style={S.badge(b.bg, b.color, b.border)}>{cat}</span>; };
  const EstadoBadge = ({ estado }) => estado.startsWith('1')
    ? <span style={S.badge('#EFF6FF', '#1D4ED8', '#BFDBFE')}>Recogida</span>
    : <span style={S.badge('#F5F3FF', '#6D28D9', '#DDD6FE')}>En curso</span>;

  const PctBar = ({ r }) => {
    const pct = Math.min(r.dias / r.sla * 100, 200);
    const sev = severity(r);
    const color = SEV_COLORS[sev];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 90 }}>
        <div style={{ flex: 1, height: 5, background: '#D1DCE9', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 3 }} />
        </div>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.68rem', color, minWidth: 36, textAlign: 'right' }}>{Math.round(r.dias / r.sla * 100)}%</span>
      </div>
    );
  };

  const Th = ({ col, children, align }) => (
    <th style={{ ...S.th(sortCol === col), textAlign: align || 'left' }} onClick={() => sort(col)}>
      {children} <span style={{ opacity: sortCol === col ? 1 : .4 }}>{sortCol === col ? (sortDir === -1 ? '↓' : '↑') : '↕'}</span>
    </th>
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div style={S.page}>
        <header style={S.header}>
          <button style={S.backBtn} onClick={onBackToHub}><ArrowLeft size={16} /> Volver</button>
          <div style={{ marginLeft: 8 }}>
            <div style={S.hTitle}>KPI Analíticas</div>
            <div style={S.hSub}>Monitor de plazos · HS Lab</div>
          </div>
        </header>
        <div style={S.main}>
          <div style={S.emptyWrap}>
            <div
              style={{ ...S.dropZone, borderColor: dragging ? '#0076CE' : '#D1DCE9', background: dragging ? '#EFF6FF' : '#fff' }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <BarChart2 size={48} color="#D1DCE9" />
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0E2340' }}>Cargar CSV de analíticas</div>
              <div style={{ fontSize: '.8rem', color: '#7A96B0', textAlign: 'center', maxWidth: 320 }}>
                Arrastra aquí el fichero exportado desde HSLAB, o haz clic para seleccionarlo.<br />
                Formato semicolón, columnas estándar de analíticas.
              </div>
              <div style={{ fontSize: '.73rem', color: '#7A96B0', fontStyle: 'italic' }}>SLA: Legionella 14d · Piscina 5d · Alimento/Superficie/Agua 4d</div>
            </div>
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={onInputChange} />
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const total = data.length;
  const pO = counts.ok / total * 100, pW = counts.warn / total * 100, pC = counts.crit / total * 100;

  return (
    <div style={S.page}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', padding: '10px 22px', borderRadius: 8, fontSize: '.82rem', fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,.18)', background: toast.ok ? '#059669' : '#DC2626', color: '#fff' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header style={S.header}>
        <button style={S.backBtn} onClick={onBackToHub}><ArrowLeft size={16} /> Volver</button>
        <div style={{ marginLeft: 8 }}>
          <div style={S.hTitle}>KPI Analíticas</div>
          <div style={S.hSub}>Monitor de plazos · HS Lab</div>
        </div>
        <div style={S.spacer} />
        <span style={{ color: 'rgba(255,255,255,.35)', fontFamily: "'JetBrains Mono',monospace", fontSize: '.72rem', marginRight: 10 }}>
          {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
        <button style={S.uploadBtn} onClick={() => fileRef.current?.click()}><Upload size={13} /> Actualizar CSV</button>
      </header>

      <div style={S.main}>

        {/* SLA info */}
        <div style={S.card}>
          <div style={S.slaRow}>
            <span style={S.slaTitle}>SLA por tipo</span>
            {[
              { name: 'Legionella', detail: '1d transporte + 12d análisis + 1d informe', days: 14, color: '#6D28D9' },
              { name: 'Piscina / Spa', detail: '1d transporte + 3d análisis + 1d informe', days: 5, color: '#0369A1' },
              { name: 'Alimento · Superficie · Agua red', detail: '1d transporte + 2d análisis + 1d informe', days: 4, color: '#059669' },
            ].map(s => (
              <div key={s.name} style={S.slaChip(s.color)}>
                <span style={{ fontWeight: 600, color: '#0E2340', fontSize: '.72rem' }}>{s.name}</span>
                <span style={{ color: '#7A96B0', fontSize: '.67rem' }}>{s.detail}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: '.85rem', color: s.color, marginLeft: 4 }}>{s.days}d</span>
              </div>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '.7rem', color: '#7A96B0', fontStyle: 'italic' }}>Fuera de plazo si días desde recogida &gt; SLA</span>
          </div>
        </div>

        {/* Severity bar */}
        <div style={S.card}>
          <div style={{ fontSize: '.67rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#7A96B0', marginBottom: 10 }}>
            Distribución SLA — {total.toLocaleString()} muestras activas
          </div>
          <div style={{ height: 14, borderRadius: 7, overflow: 'hidden', display: 'flex', background: '#F2F6FB' }}>
            <div style={{ width: `${pO}%`, background: SEV_COLORS.ok, height: '100%', borderRadius: '7px 0 0 7px' }} />
            <div style={{ width: `${pW}%`, background: SEV_COLORS.warn, height: '100%' }} />
            <div style={{ width: `${pC}%`, background: SEV_COLORS.crit, height: '100%', borderRadius: '0 7px 7px 0' }} />
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'En plazo', color: SEV_COLORS.ok, pct: pO, n: counts.ok },
              { label: 'Último día', color: SEV_COLORS.warn, pct: pW, n: counts.warn },
              { label: 'Fuera de plazo', color: SEV_COLORS.crit, pct: pC, n: counts.crit },
            ].map(it => (
              <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '.74rem', color: '#4A6A8A' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: it.color, flexShrink: 0 }} />
                <span>{it.label}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: it.color }}>{it.pct.toFixed(1)}%</span>
                <span style={{ color: '#7A96B0' }}>({it.n})</span>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, fontSize: '.74rem', color: '#4A6A8A' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: SEV_COLORS.sini, flexShrink: 0 }} />
              <span>Sin iniciar <span style={{ fontSize: '.64rem', opacity: .7 }}>(Recogida &gt;2d)</span></span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: SEV_COLORS.sini }}>{counts.sini}</span>
            </div>
          </div>
        </div>

        {/* KPI tiles */}
        <div style={S.grid}>
          {[
            { label: 'Total activas', val: total, color: SEV_COLORS.total, sub: 'muestras en seguimiento' },
            { label: '✓ En plazo', val: counts.ok, color: SEV_COLORS.ok, sub: 'días activos < SLA' },
            { label: '⚠ Último día', val: counts.warn, color: SEV_COLORS.warn, sub: 'hoy = fecha límite' },
            { label: '✕ Fuera de plazo', val: counts.crit, color: SEV_COLORS.crit, sub: 'días activos > SLA' },
            { label: '⏳ Sin iniciar', val: counts.sini, color: SEV_COLORS.sini, sub: 'Recogida pendiente >2d' },
          ].map(t => (
            <div key={t.label} style={S.tile(t.color)}>
              <div style={S.tileLabel}>{t.label}</div>
              <div style={S.tileVal(t.color)}>{t.val.toLocaleString()}</div>
              <div style={S.tileSub}>{t.sub}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={S.filters}>
          <span style={{ fontSize: '.69rem', fontWeight: 600, color: '#7A96B0', whiteSpace: 'nowrap' }}>Filtrar:</span>
          <input style={S.input} type="text" placeholder="Establecimiento o código…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          <select style={S.select} value={catF} onChange={e => { setCatF(e.target.value); setPage(1); }}>
            <option value="">Todas las categorías</option>
            {['Legionella', 'Agua/Piscina', 'Alimento', 'Superficie', 'Agua/Red'].map(c => <option key={c}>{c}</option>)}
          </select>
          <select style={S.select} value={estadoF} onChange={e => { setEstadoF(e.target.value); setPage(1); }}>
            <option value="">Todos los estados</option>
            <option value="1">1 Recogida</option>
            <option value="2">2 En curso</option>
          </select>
          <select style={S.select} value={regionF} onChange={e => { setRegionF(e.target.value); setPage(1); }}>
            <option value="">Todas las regiones</option>
            {regions.map(r => <option key={r}>{r}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {[
              { key: '', label: 'Todos', color: '#0076CE' },
              { key: 'crit', label: 'Fuera plazo', color: SEV_COLORS.crit },
              { key: 'warn', label: 'Último día', color: SEV_COLORS.warn },
              { key: 'ok', label: 'En plazo', color: SEV_COLORS.ok },
              { key: 'sini', label: 'Sin iniciar', color: SEV_COLORS.sini },
            ].map(ch => (
              <button key={ch.key} style={S.chip(sevF === ch.key, ch.color)} onClick={() => { setSevF(ch.key); setPage(1); }}>{ch.label}</button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.7rem', color: '#7A96B0', whiteSpace: 'nowrap' }}>
            {filtered.length.toLocaleString()} resultados
          </span>
        </div>

        {/* Table */}
        <div style={S.tblWrap}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.77rem' }}>
              <thead>
                <tr>
                  <Th col="sev">SLA</Th>
                  <Th col="numero">Código</Th>
                  <Th col="hotel">Establecimiento</Th>
                  <Th col="cat">Categoría</Th>
                  <Th col="estado">Estado</Th>
                  <Th col="fecha_rec">F. Recogida</Th>
                  <Th col="fecha_limite">F. Límite</Th>
                  <Th col="dias" align="right">Días</Th>
                  <th style={{ ...S.th(false), textAlign: 'right' }}>SLA</th>
                  <Th col="retraso" align="right">Retraso</Th>
                  <th style={S.th(false)}>Progreso</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((r, i) => {
                  const sev = severity(r);
                  const borderColor = SEV_COLORS[sev];
                  return (
                    <tr key={r.id + i} style={{ borderBottom: '1px solid #D1DCE9', borderLeft: `4px solid ${borderColor}`, background: i % 2 === 0 ? '#fff' : '#FAFCFF' }}>
                      <td style={S.td}><SevBadge sev={sev} /></td>
                      <td style={{ ...S.td, fontFamily: "'JetBrains Mono',monospace", fontSize: '.7rem', whiteSpace: 'nowrap' }}>{r.numero}</td>
                      <td style={{ ...S.td, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.hotel}>{r.hotel}</td>
                      <td style={S.td}><CatBadge cat={r.cat} /></td>
                      <td style={S.td}><EstadoBadge estado={r.estado} /></td>
                      <td style={{ ...S.td, fontFamily: "'JetBrains Mono',monospace", fontSize: '.7rem' }}>{r.fecha_rec}</td>
                      <td style={{ ...S.td, fontFamily: "'JetBrains Mono',monospace", fontSize: '.7rem', color: sev === 'crit' ? '#DC2626' : sev === 'warn' ? '#D97706' : '#7A96B0', fontWeight: sev === 'crit' ? 700 : 400 }}>{r.fecha_limite}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", color: borderColor, fontWeight: 600 }}>{r.dias}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: '.7rem', color: '#7A96B0' }}>{r.sla}d</td>
                      <td style={{ ...S.td, textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: r.retraso > 0 ? '#DC2626' : r.retraso === 0 ? '#D97706' : '#059669' }}>
                        {r.retraso > 0 ? `+${r.retraso}d` : r.retraso === 0 ? 'hoy' : `${r.retraso}d`}
                      </td>
                      <td style={S.td}><PctBar r={r} /></td>
                    </tr>
                  );
                })}
                {slice.length === 0 && (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: '#7A96B0' }}>Sin resultados</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div style={S.pag}>
            <span>Mostrando <b>{(safeP - 1) * PER_PAGE + 1}–{Math.min(safeP * PER_PAGE, sorted.length)}</b> de <b>{sorted.length}</b></span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={S.pgBtn(false)} disabled={safeP <= 1} onClick={() => setPage(p => p - 1)}>← Ant</button>
              {Array.from({ length: Math.min(5, pages) }, (_, k) => {
                const p = Math.max(1, Math.min(safeP - 2, pages - 4)) + k;
                return <button key={p} style={S.pgBtn(p === safeP)} onClick={() => setPage(p)}>{p}</button>;
              })}
              <button style={S.pgBtn(false)} disabled={safeP >= pages} onClick={() => setPage(p => p + 1)}>Sig →</button>
            </div>
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={onInputChange} />
    </div>
  );
}
