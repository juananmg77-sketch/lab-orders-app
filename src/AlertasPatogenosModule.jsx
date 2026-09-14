import React, { useState, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { ArrowLeft, Upload, AlertTriangle, CheckCircle, Send, X, FileText, Clock } from 'lucide-react';

// Parser CSV correcto: maneja campos entrecomillados con saltos de línea y punto y coma internos
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

  // Localizar columnas de patógenos por nombre de cabecera
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
    // Solo muestras "En curso" (resultado no cerrado)
    if (estado && !estado.toLowerCase().includes('en curso')) continue;

    // Detectar patógenos con recuento > 0
    const detected = patCols
      .map(p => ({ ...p, valor: getNum(row, p.colIdx) }))
      .filter(p => p.valor !== null && p.valor > 0);

    if (detected.length === 0) continue;

    const resumen = detected.map(p => `${p.nombre}: ${p.valor} ${p.unidad}`).join(' | ');

    results.push({
      numero: iNumero >= 0 ? row[iNumero] : '',
      establecimiento: iEstablecimiento >= 0 ? row[iEstablecimiento] : '',
      consultor: iConsultor >= 0 ? row[iConsultor] : '',
      muestra: iMuestra >= 0 ? row[iMuestra] : '',
      fecha_recogida: iFecha >= 0 ? row[iFecha] : '',
      observaciones: resumen,
      patogenos: detected.map(p => ({ nombre: p.nombre, valor: p.valor, unidad: p.unidad })),
      grupo: iGrupo >= 0 ? row[iGrupo] : '',
    });
  }
  return results;
}

export default function AlertasPatogenosModule({ onBackToHub }) {
  const [step, setStep] = useState('upload'); // upload | preview | sending | result
  const [dragging, setDragging] = useState(false);
  const [allAlerts, setAllAlerts] = useState([]);
  const [newAlerts, setNewAlerts] = useState([]);
  const [alreadySent, setAlreadySent] = useState(0);
  const [sinEmail, setSinEmail] = useState([]);
  const [result, setResult] = useState(null);
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
      setError('No se han encontrado muestras con patógenos en el CSV. Asegúrate de que el campo Observaciones contiene texto.');
      return;
    }

    // Resolver auditor desde legionella_actividades (fuente primaria)
    const establecimientos = [...new Set(rawAlerts.map(a => a.establecimiento).filter(Boolean))];
    const { data: actData } = await supabase
      .from('legionella_actividades')
      .select('establecimiento, auditor')
      .in('establecimiento', establecimientos)
      .not('auditor', 'is', null)
      .order('fecha_date', { ascending: false });

    const auditorMap = {};
    if (actData) {
      actData.forEach(r => {
        if (r.auditor && !auditorMap[r.establecimiento]) auditorMap[r.establecimiento] = r.auditor;
      });
    }

    const alerts = rawAlerts.map(a => ({
      ...a,
      consultor: auditorMap[a.establecimiento] || a.consultor,
      fuente_consultor: auditorMap[a.establecimiento] ? 'previsión' : 'csv',
    }));

    // Consultar Supabase para ver cuáles ya fueron comunicadas
    const numeros = alerts.map(a => a.numero).filter(Boolean);
    const { data: existingData } = await supabase
      .from('lab_alertas_comunicadas')
      .select('numero_muestra')
      .in('numero_muestra', numeros);

    const existingSet = new Set((existingData || []).map(r => r.numero_muestra));
    const nuevas = alerts.filter(a => !existingSet.has(a.numero));
    const yaEnviadas = alerts.length - nuevas.length;

    // Detectar consultores sin email en BD
    const consultoresUniq = [...new Set(nuevas.map(a => a.consultor).filter(Boolean))];
    let sinEmailList = [];
    if (consultoresUniq.length > 0) {
      const { data: emailData } = await supabase
        .from('lab_consultor_emails')
        .select('nombre_csv')
        .in('nombre_csv', consultoresUniq)
        .eq('activo', true);
      const withEmail = new Set((emailData || []).map(r => r.nombre_csv));
      sinEmailList = consultoresUniq.filter(c => !withEmail.has(c));
    }

    setAllAlerts(alerts);
    setNewAlerts(nuevas);
    setAlreadySent(yaEnviadas);
    setSinEmail(sinEmailList);
    setStep('preview');
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const onFileInput = (e) => handleFile(e.target.files[0]);

  const handleSend = async () => {
    const toSend = newAlerts.filter(a => !sinEmail.includes(a.consultor));
    if (toSend.length === 0) {
      setError('No hay muestras con email de consultor conocido para enviar.');
      return;
    }
    setStep('sending');
    setError('');

    try {
      const resp = await fetch('/.netlify/functions/alertas-patogenos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ samples: toSend }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'Error desconocido');
      setResult(data);
      setStep('result');
    } catch (err) {
      setError('Error al enviar: ' + err.message);
      setStep('preview');
    }
  };

  const reset = () => {
    setStep('upload');
    setAllAlerts([]);
    setNewAlerts([]);
    setAlreadySent(0);
    setSinEmail([]);
    setResult(null);
    setError('');
    setFileName('');
  };

  const card = { background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: '32px' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '18px 32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={onBackToHub} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 600, fontSize: '0.95rem' }}>
          <ArrowLeft size={18} /> Volver al Portal
        </button>
        <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={22} color="#dc2626" />
          <h1 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--secondary)', fontWeight: 700 }}>Alertas Patógenos Preliminares</h1>
        </div>
      </div>

      <div style={{ flex: 1, padding: '40px', maxWidth: '900px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* STEP: UPLOAD */}
        {step === 'upload' && (
          <div style={card}>
            <h2 style={{ margin: '0 0 8px', color: 'var(--secondary)' }}>Cargar CSV de HS Manager</h2>
            <p style={{ margin: '0 0 28px', color: '#6b7280' }}>
              Descarga el CSV de analíticas en curso desde HS Manager y súbelo aquí. El sistema detectará automáticamente las muestras con patógenos y enviará un comunicado a cada consultor.
            </p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              style={{
                border: `2px dashed ${dragging ? 'var(--primary)' : '#d1d5db'}`,
                borderRadius: '12px',
                padding: '48px',
                textAlign: 'center',
                background: dragging ? 'var(--primary-light)' : '#f9fafb',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('csv-input').click()}
            >
              <Upload size={40} color={dragging ? 'var(--primary)' : '#9ca3af'} style={{ marginBottom: '16px' }} />
              <p style={{ margin: '0 0 8px', fontWeight: 600, color: dragging ? 'var(--primary)' : '#374151', fontSize: '1.1rem' }}>
                Arrastra el CSV aquí o haz clic para seleccionar
              </p>
              <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9rem' }}>Exportación de HS Manager · Separador: punto y coma</p>
              <input id="csv-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={onFileInput} />
            </div>

            {error && (
              <div style={{ marginTop: '16px', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <X size={16} style={{ flexShrink: 0, marginTop: '2px' }} /> {error}
              </div>
            )}

            <div style={{ marginTop: '24px', padding: '16px', background: '#f0f9ff', borderRadius: '8px', fontSize: '0.9rem', color: '#0369a1' }}>
              <strong>¿Qué hace este módulo?</strong>
              <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                <li>Detecta muestras con texto en la columna <em>Observaciones</em> (= patógeno detectado)</li>
                <li>Excluye las muestras ya comunicadas en días anteriores</li>
                <li>Envía un email por consultor con el listado de sus muestras</li>
                <li>Registra los envíos para evitar duplicados futuros</li>
              </ul>
            </div>
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Summary */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '180px', ...card, borderTop: '4px solid #dc2626', padding: '20px 24px' }}>
                <p style={{ margin: '0 0 4px', color: '#6b7280', fontSize: '0.85rem', fontWeight: 600 }}>NUEVAS ALERTAS</p>
                <p style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: '#dc2626' }}>{newAlerts.length}</p>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.82rem' }}>muestras a comunicar</p>
              </div>
              <div style={{ flex: 1, minWidth: '180px', ...card, borderTop: '4px solid #16a34a', padding: '20px 24px' }}>
                <p style={{ margin: '0 0 4px', color: '#6b7280', fontSize: '0.85rem', fontWeight: 600 }}>YA COMUNICADAS</p>
                <p style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: '#16a34a' }}>{alreadySent}</p>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.82rem' }}>no se reenviarán</p>
              </div>
              <div style={{ flex: 1, minWidth: '180px', ...card, borderTop: '4px solid #f59e0b', padding: '20px 24px' }}>
                <p style={{ margin: '0 0 4px', color: '#6b7280', fontSize: '0.85rem', fontWeight: 600 }}>CONSULTORES</p>
                <p style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>{[...new Set(newAlerts.map(a => a.consultor))].length}</p>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.82rem' }}>recibirán el email</p>
              </div>
            </div>

            {/* Sin email warning */}
            {sinEmail.length > 0 && (
              <div style={{ ...card, border: '1px solid #fbbf24', background: '#fffbeb', padding: '20px 24px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#92400e' }}>Consultores sin email registrado — sus muestras NO se enviarán:</p>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: '#92400e' }}>
                      {sinEmail.map(c => <li key={c}>{c}</li>)}
                    </ul>
                    <p style={{ margin: '8px 0 0', color: '#92400e', fontSize: '0.85rem' }}>Pide a un administrador que añada el email en la tabla <code>lab_consultor_emails</code>.</p>
                  </div>
                </div>
              </div>
            )}

            {/* File info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#6b7280', fontSize: '0.9rem' }}>
              <FileText size={16} /> <span>{fileName}</span>
            </div>

            {/* Table */}
            {newAlerts.length > 0 && (
              <div style={card}>
                <h3 style={{ margin: '0 0 16px', color: 'var(--secondary)' }}>Muestras a comunicar ({newAlerts.length})</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        {['Nº Muestra', 'Establecimiento', 'Punto', 'Consultor responsable', 'Fecha recogida', 'Resultado preliminar'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#1e3a5f', fontWeight: 700, borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {newAlerts.map((a, i) => (
                        <tr key={a.numero || i} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e3a5f', whiteSpace: 'nowrap' }}>{a.numero}</td>
                          <td style={{ padding: '10px 12px', color: '#374151' }}>{a.establecimiento}</td>
                          <td style={{ padding: '10px 12px', color: '#374151' }}>{a.muestra}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ color: sinEmail.includes(a.consultor) ? '#f59e0b' : '#374151', fontWeight: sinEmail.includes(a.consultor) ? 600 : 400 }}>
                                {a.consultor || '—'}{sinEmail.includes(a.consultor) && ' ⚠️'}
                              </span>
                              <span style={{
                                fontSize: '0.72rem', padding: '1px 6px', borderRadius: '10px', fontWeight: 600,
                                background: a.fuente_consultor === 'previsión' ? '#dbeafe' : '#fef3c7',
                                color: a.fuente_consultor === 'previsión' ? '#1d4ed8' : '#92400e',
                              }}>
                                {a.fuente_consultor === 'previsión' ? 'previsión' : 'CSV'}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{a.fecha_recogida}</td>
                          <td style={{ padding: '10px 12px', color: '#dc2626', fontSize: '0.85em', maxWidth: '280px' }}>{a.observaciones}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {newAlerts.length === 0 && (
              <div style={{ ...card, textAlign: 'center', padding: '48px' }}>
                <CheckCircle size={48} color="#16a34a" style={{ marginBottom: '16px' }} />
                <h3 style={{ margin: '0 0 8px', color: '#16a34a' }}>Todo al día</h3>
                <p style={{ margin: 0, color: '#6b7280' }}>Todas las muestras con patógenos de este CSV ya han sido comunicadas anteriormente.</p>
              </div>
            )}

            {error && (
              <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626' }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={reset} style={{ padding: '12px 24px', border: '1px solid #d1d5db', borderRadius: '8px', background: 'white', color: '#374151', cursor: 'pointer', fontWeight: 600 }}>
                Cargar otro CSV
              </button>
              {newAlerts.length > 0 && (
                <button
                  onClick={handleSend}
                  disabled={newAlerts.filter(a => !sinEmail.includes(a.consultor)).length === 0}
                  style={{
                    padding: '12px 28px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem',
                    background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px',
                    opacity: newAlerts.filter(a => !sinEmail.includes(a.consultor)).length === 0 ? 0.5 : 1,
                  }}
                >
                  <Send size={18} /> Enviar alertas ({newAlerts.filter(a => !sinEmail.includes(a.consultor)).length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP: SENDING */}
        {step === 'sending' && (
          <div style={{ ...card, textAlign: 'center', padding: '64px' }}>
            <div style={{ display: 'inline-block', width: '48px', height: '48px', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '24px' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <h3 style={{ margin: '0 0 8px', color: 'var(--secondary)' }}>Enviando alertas...</h3>
            <p style={{ margin: 0, color: '#6b7280' }}>Procesando muestras y enviando emails a los consultores. Por favor, espera.</p>
          </div>
        )}

        {/* STEP: RESULT */}
        {step === 'result' && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ ...card, textAlign: 'center', padding: '48px', borderTop: '4px solid #16a34a' }}>
              <CheckCircle size={56} color="#16a34a" style={{ marginBottom: '20px' }} />
              <h2 style={{ margin: '0 0 8px', color: '#16a34a' }}>Alertas enviadas correctamente</h2>
              <p style={{ margin: '0 0 24px', color: '#6b7280' }}>Los consultores han recibido el comunicado de resultados preliminares.</p>
              <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '2rem', fontWeight: 700, color: '#16a34a' }}>{result.enviados}</p>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>muestras comunicadas</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '2rem', fontWeight: 700, color: '#94a3b8' }}>{result.ya_comunicados}</p>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>ya estaban enviadas</p>
                </div>
              </div>
            </div>

            {result.sin_email && result.sin_email.length > 0 && (
              <div style={{ ...card, border: '1px solid #fbbf24', background: '#fffbeb' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <AlertTriangle size={18} color="#f59e0b" />
                  <div>
                    <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#92400e' }}>No se pudieron enviar por falta de email:</p>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: '#92400e' }}>
                      {result.sin_email.map(({ consultor, count }) => <li key={consultor}>{consultor} ({count} muestra{count !== 1 ? 's' : ''})</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={reset} style={{ padding: '12px 28px', borderRadius: '8px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>
                Procesar otro CSV
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
