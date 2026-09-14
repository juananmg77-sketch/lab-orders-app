import React, { useState, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { ArrowLeft, Upload, AlertTriangle, CheckCircle, Send, X, FileText, Copy, Check, Mail, ClipboardCheck } from 'lucide-react';

function parseCSVRows(text) {
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ';') { current.push(field.trim()); field = ''; }
      else if (ch === '\n') {
        current.push(field.trim()); field = '';
        if (current.some(f => f)) rows.push(current);
        current = [];
      } else if (ch !== '\r') { field += ch; }
    }
  }
  if (field || current.length) { current.push(field.trim()); if (current.some(f => f)) rows.push(current); }
  return rows;
}

const PATOGENOS_DEF = [
  { nombre: 'Coliformes totales', clave: 'coliformes totales', unidad: 'UFC/100mL' },
  { nombre: 'E. coli', clave: 'escherichia coli', unidad: 'UFC/100mL' },
  { nombre: 'Pseudomonas aeruginosa', clave: 'pseudomonas aeruginosa', unidad: 'UFC/100mL' },
  { nombre: 'S. aureus', clave: 'staphylococcus aureus', unidad: 'UFC/mL' },
];

function parseCSV(text) {
  const rows = parseCSVRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.replace(/^"|"$/g, '').trim());
  const idx = (substr) => headers.findIndex(h => h.toLowerCase().includes(substr.toLowerCase()));
  const iNumero = idx('Número');
  const iEstablecimiento = idx('Establecimiento');
  const iConsultor = idx('Recogido por');
  const iMuestra = idx('Muestra');
  const iFecha = idx('Fecha de recogida');
  const iEstado = idx('Estado');
  const iGrupo = idx('Grupo');
  const patCols = PATOGENOS_DEF.map(p => ({ ...p, colIdx: idx(p.clave) }));
  const getNum = (row, i) => {
    if (i < 0 || i >= row.length) return null;
    const v = row[i].replace(',', '.').trim();
    if (!v || v === '-' || v.toLowerCase() === 'nd') return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };
  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const estado = iEstado >= 0 ? row[iEstado] : '';
    if (estado && !estado.toLowerCase().includes('en curso')) continue;
    const detected = patCols
      .map(p => ({ ...p, valor: getNum(row, p.colIdx) }))
      .filter(p => p.valor !== null && p.valor > 0);
    if (detected.length === 0) continue;
    results.push({
      numero: iNumero >= 0 ? row[iNumero] : '',
      establecimiento: iEstablecimiento >= 0 ? row[iEstablecimiento] : '',
      consultor: iConsultor >= 0 ? row[iConsultor] : '',
      muestra: iMuestra >= 0 ? row[iMuestra] : '',
      fecha_recogida: iFecha >= 0 ? row[iFecha] : '',
      observaciones: detected.map(p => `${p.nombre}: ${p.valor} ${p.unidad}`).join(' | '),
      patogenos: detected.map(p => ({ nombre: p.nombre, valor: p.valor, unidad: p.unidad })),
      grupo: iGrupo >= 0 ? row[iGrupo] : '',
    });
  }
  return results;
}

function buildCopyText(consultor, muestras) {
  const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const header = `Resultado preliminar con bacterias detectadas — ${consultor} — ${fecha}\n`;
  const sep = '─'.repeat(70);
  const cols = ['Nº Muestra', 'Hotel', 'Punto de muestreo', 'Fecha recogida', 'Resultado'];
  const rows = muestras.map(m => [
    m.numero,
    m.establecimiento,
    m.muestra,
    m.fecha_recogida,
    m.patogenos.map(p => `${p.nombre}: ${p.valor} ${p.unidad}`).join(' | '),
  ]);
  const widths = cols.map((c, ci) => Math.max(c.length, ...rows.map(r => (r[ci] || '').length)));
  const pad = (s, w) => (s || '').padEnd(w);
  const headerRow = cols.map((c, i) => pad(c, widths[i])).join('  |  ');
  const bodyRows = rows.map(r => r.map((c, i) => pad(c, widths[i])).join('  |  ')).join('\n');
  return `${header}${sep}\n${headerRow}\n${sep}\n${bodyRows}\n${sep}\n\nSe comunica de forma preventiva mientras se espera el resultado del cultivo de Legionella.\nPor favor, inicia el protocolo de actuación según el PPCL correspondiente.`;
}

// Bloque por consultor
function ConsultorBlock({ consultor, muestras, tieneEmail, onSendEmail, onConfirmManual }) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('pending'); // pending | sending | sent | confirmed | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleCopy = () => {
    navigator.clipboard.writeText(buildCopyText(consultor, muestras));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendEmail = async () => {
    setStatus('sending');
    setErrorMsg('');
    try {
      await onSendEmail(consultor, muestras);
      setStatus('sent');
    } catch (e) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  };

  const handleConfirmManual = async () => {
    setStatus('sending');
    setErrorMsg('');
    try {
      await onConfirmManual(muestras);
      setStatus('confirmed');
    } catch (e) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  };

  const done = status === 'sent' || status === 'confirmed';

  return (
    <div style={{
      background: 'white',
      borderRadius: '14px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      border: done ? '1.5px solid #16a34a' : '1.5px solid #e5e7eb',
      overflow: 'hidden',
      opacity: done ? 0.85 : 1,
      transition: 'all 0.2s',
    }}>
      {/* Cabecera del bloque */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        background: done ? '#f0fdf4' : '#f8fafc',
        borderBottom: '1px solid #e5e7eb',
        flexWrap: 'wrap', gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {done
            ? <CheckCircle size={18} color="#16a34a" />
            : <AlertTriangle size={18} color="#dc2626" />}
          <span style={{ fontWeight: 700, color: done ? '#16a34a' : '#1e3a5f', fontSize: '1rem' }}>
            {consultor}
          </span>
          <span style={{
            fontSize: '0.78rem', fontWeight: 600, padding: '2px 10px',
            borderRadius: '12px',
            background: done ? '#dcfce7' : '#fef2f2',
            color: done ? '#16a34a' : '#dc2626',
          }}>
            {muestras.length} muestra{muestras.length !== 1 ? 's' : ''}
          </span>
          {!tieneEmail && !done && (
            <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: '12px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
              sin email
            </span>
          )}
          {status === 'sent' && (
            <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>✓ Email enviado</span>
          )}
          {status === 'confirmed' && (
            <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>✓ Comunicado manualmente</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px', border: '1px solid #d1d5db',
              background: 'white', color: '#374151', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
            }}
          >
            {copied ? <><Check size={14} color="#16a34a" /> Copiado</> : <><Copy size={14} /> Copiar</>}
          </button>
          {!done && (
            <>
              {tieneEmail && (
                <button
                  onClick={handleSendEmail}
                  disabled={status === 'sending'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', borderRadius: '8px', border: 'none',
                    background: status === 'sending' ? '#93c5fd' : 'var(--primary)',
                    color: 'white', cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                    fontWeight: 600, fontSize: '0.85rem',
                  }}
                >
                  <Mail size={14} />
                  {status === 'sending' ? 'Enviando...' : 'Enviar email'}
                </button>
              )}
              <button
                onClick={handleConfirmManual}
                disabled={status === 'sending'}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '8px',
                  border: '1.5px solid #16a34a',
                  background: 'white', color: '#16a34a',
                  cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: '0.85rem',
                }}
              >
                <ClipboardCheck size={14} />
                Confirmar manual
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {status === 'error' && (
        <div style={{ padding: '10px 20px', background: '#fef2f2', borderBottom: '1px solid #fecaca', color: '#dc2626', fontSize: '0.85rem' }}>
          ⚠ {errorMsg} — puedes usar "Confirmar manual" para registrarlo igualmente.
          <button onClick={() => setStatus('pending')} style={{ marginLeft: '12px', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>Reintentar</button>
        </div>
      )}

      {/* Tabla de muestras */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Nº Muestra', 'Hotel', 'Punto de muestreo', 'Fecha recogida', 'Patógenos detectados'].map(h => (
                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {muestras.map((m, i) => (
              <tr key={m.numero || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e3a5f', whiteSpace: 'nowrap' }}>{m.numero}</td>
                <td style={{ padding: '10px 14px', color: '#374151', fontWeight: 500 }}>{m.establecimiento}</td>
                <td style={{ padding: '10px 14px', color: '#374151' }}>{m.muestra}</td>
                <td style={{ padding: '10px 14px', color: '#6b7280', whiteSpace: 'nowrap' }}>{m.fecha_recogida}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {(m.patogenos || []).map((p, pi) => (
                      <span key={pi} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: '#fef2f2', border: '1px solid #fecaca',
                        borderRadius: '6px', padding: '2px 8px',
                        fontSize: '0.8rem', color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap',
                      }}>
                        ⚠ {p.nombre}: {p.valor} {p.unidad}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AlertasPatogenosModule({ onBackToHub }) {
  const [step, setStep] = useState('upload');
  const [dragging, setDragging] = useState(false);
  const [byConsultor, setByConsultor] = useState([]); // [{consultor, muestras, tieneEmail}]
  const [alreadySent, setAlreadySent] = useState(0);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  const handleFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setError('El archivo debe ser un CSV exportado desde HS Manager.');
      return;
    }
    setError('');
    setFileName(file.name);
    const text = await file.text();
    const rawAlerts = parseCSV(text);

    if (rawAlerts.length === 0) {
      setError('No se han encontrado muestras "En curso" con recuento de patógenos > 0.');
      return;
    }

    // Resolver auditor desde legionella_actividades
    const establecimientos = [...new Set(rawAlerts.map(a => a.establecimiento).filter(Boolean))];
    const { data: actData } = await supabase
      .from('legionella_actividades')
      .select('establecimiento, auditor')
      .in('establecimiento', establecimientos)
      .not('auditor', 'is', null)
      .order('fecha_date', { ascending: false });

    const auditorMap = {};
    if (actData) actData.forEach(r => { if (r.auditor && !auditorMap[r.establecimiento]) auditorMap[r.establecimiento] = r.auditor; });

    const alerts = rawAlerts.map(a => ({
      ...a,
      consultor: auditorMap[a.establecimiento] || a.consultor,
      fuente_consultor: auditorMap[a.establecimiento] ? 'previsión' : 'csv',
    }));

    // Deduplicar: solo excluir email_enviado=true
    const numeros = alerts.map(a => a.numero).filter(Boolean);
    const { data: existingData } = await supabase
      .from('lab_alertas_comunicadas')
      .select('numero_muestra')
      .in('numero_muestra', numeros)
      .eq('email_enviado', true);

    const existingSet = new Set((existingData || []).map(r => r.numero_muestra));
    const nuevas = alerts.filter(a => !existingSet.has(a.numero));
    setAlreadySent(alerts.length - nuevas.length);

    if (nuevas.length === 0) {
      setByConsultor([]);
      setStep('preview');
      return;
    }

    // Agrupar por consultor (ordenados alfabéticamente)
    const consultoresUniq = [...new Set(nuevas.map(a => a.consultor).filter(Boolean))].sort();

    // Ver qué consultores tienen email
    const { data: emailData } = await supabase
      .from('lab_consultor_emails')
      .select('nombre_csv')
      .in('nombre_csv', consultoresUniq)
      .eq('activo', true);
    const conEmail = new Set((emailData || []).map(r => r.nombre_csv));

    const grupos = consultoresUniq.map(c => ({
      consultor: c,
      muestras: nuevas.filter(a => a.consultor === c),
      tieneEmail: conEmail.has(c),
    }));

    // Añadir muestras sin consultor al final
    const sinConsultor = nuevas.filter(a => !a.consultor);
    if (sinConsultor.length > 0) grupos.push({ consultor: '(sin consultor asignado)', muestras: sinConsultor, tieneEmail: false });

    setByConsultor(grupos);
    setStep('preview');
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const onFileInput = (e) => handleFile(e.target.files[0]);

  // Enviar email para un consultor concreto
  const handleSendEmail = async (consultor, muestras) => {
    const resp = await fetch('/.netlify/functions/alertas-patogenos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ samples: muestras }),
    });
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Error desconocido');
  };

  // Confirmar comunicación manual: insertar directamente en Supabase
  const handleConfirmManual = async (muestras) => {
    const records = muestras.map(m => ({
      numero_muestra: m.numero,
      consultor: m.consultor,
      establecimiento: m.establecimiento,
      patogeno: m.patogenos.map(p => `${p.nombre}: ${p.valor} ${p.unidad}`).join(' | ').substring(0, 500),
      email_enviado: true,
    }));
    const { error } = await supabase
      .from('lab_alertas_comunicadas')
      .upsert(records, { onConflict: 'numero_muestra' });
    if (error) throw new Error(error.message);
  };

  const reset = () => {
    setStep('upload'); setByConsultor([]); setAlreadySent(0); setError(''); setFileName('');
  };

  const card = { background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: '32px' };
  const totalNuevas = byConsultor.reduce((s, g) => s + g.muestras.length, 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '18px 32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={onBackToHub} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 600, fontSize: '0.95rem' }}>
          <ArrowLeft size={18} /> Volver al Portal
        </button>
        <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }} />
        <AlertTriangle size={22} color="#dc2626" />
        <h1 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--secondary)', fontWeight: 700 }}>Alertas Patógenos Preliminares</h1>
      </div>

      <div style={{ flex: 1, padding: '32px', maxWidth: '1100px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* UPLOAD */}
        {step === 'upload' && (
          <div style={card}>
            <h2 style={{ margin: '0 0 8px', color: 'var(--secondary)' }}>Cargar CSV de HS Manager</h2>
            <p style={{ margin: '0 0 28px', color: '#6b7280' }}>
              Descarga el CSV de analíticas en curso desde HS Manager y súbelo aquí. El sistema detectará las muestras con patógenos y las agrupará por consultor para que puedas comunicarlas.
            </p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById('csv-input').click()}
              style={{
                border: `2px dashed ${dragging ? 'var(--primary)' : '#d1d5db'}`,
                borderRadius: '12px', padding: '48px', textAlign: 'center',
                background: dragging ? 'var(--primary-light)' : '#f9fafb',
                transition: 'all 0.2s', cursor: 'pointer',
              }}
            >
              <Upload size={40} color={dragging ? 'var(--primary)' : '#9ca3af'} style={{ marginBottom: '16px' }} />
              <p style={{ margin: '0 0 8px', fontWeight: 600, color: dragging ? 'var(--primary)' : '#374151', fontSize: '1.1rem' }}>
                Arrastra el CSV aquí o haz clic para seleccionar
              </p>
              <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9rem' }}>Exportación de HS Manager · Separador: punto y coma</p>
              <input id="csv-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={onFileInput} />
            </div>
            {error && (
              <div style={{ marginTop: '16px', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', display: 'flex', gap: '10px' }}>
                <X size={16} style={{ flexShrink: 0, marginTop: '2px' }} /> {error}
              </div>
            )}
            <div style={{ marginTop: '24px', padding: '16px', background: '#f0f9ff', borderRadius: '8px', fontSize: '0.9rem', color: '#0369a1' }}>
              <strong>¿Qué hace este módulo?</strong>
              <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                <li>Detecta muestras <em>En curso</em> con recuento &gt; 0 en Coliformes, E. coli, Pseudomonas o S. aureus</li>
                <li>Las agrupa por consultor responsable, ordenadas alfabéticamente</li>
                <li>Permite enviar el email al consultor o confirmar la comunicación manualmente</li>
                <li>Registra cada comunicación para evitar duplicados futuros</li>
              </ul>
            </div>
          </div>
        )}

        {/* PREVIEW */}
        {step === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Resumen */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '160px', ...card, borderTop: '4px solid #dc2626', padding: '20px 24px' }}>
                <p style={{ margin: '0 0 4px', color: '#6b7280', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase' }}>A comunicar</p>
                <p style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: '#dc2626' }}>{totalNuevas}</p>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.82rem' }}>muestras nuevas</p>
              </div>
              <div style={{ flex: 1, minWidth: '160px', ...card, borderTop: '4px solid #f59e0b', padding: '20px 24px' }}>
                <p style={{ margin: '0 0 4px', color: '#6b7280', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase' }}>Consultores</p>
                <p style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>{byConsultor.length}</p>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.82rem' }}>bloques a gestionar</p>
              </div>
              <div style={{ flex: 1, minWidth: '160px', ...card, borderTop: '4px solid #16a34a', padding: '20px 24px' }}>
                <p style={{ margin: '0 0 4px', color: '#6b7280', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase' }}>Ya comunicadas</p>
                <p style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: '#16a34a' }}>{alreadySent}</p>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.82rem' }}>no se muestran</p>
              </div>
            </div>

            {/* Info archivo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#6b7280', fontSize: '0.88rem' }}>
              <FileText size={15} /> <span>{fileName}</span>
              <button onClick={reset} style={{ marginLeft: 'auto', padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: '7px', background: 'white', color: '#374151', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                Cargar otro CSV
              </button>
            </div>

            {/* Todo al día */}
            {byConsultor.length === 0 && (
              <div style={{ ...card, textAlign: 'center', padding: '48px' }}>
                <CheckCircle size={48} color="#16a34a" style={{ marginBottom: '16px' }} />
                <h3 style={{ margin: '0 0 8px', color: '#16a34a' }}>Todo al día</h3>
                <p style={{ margin: 0, color: '#6b7280' }}>Todas las muestras con patógenos de este CSV ya han sido comunicadas.</p>
              </div>
            )}

            {/* Bloques por consultor */}
            {byConsultor.map(({ consultor, muestras, tieneEmail }) => (
              <ConsultorBlock
                key={consultor}
                consultor={consultor}
                muestras={muestras}
                tieneEmail={tieneEmail}
                onSendEmail={handleSendEmail}
                onConfirmManual={handleConfirmManual}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
