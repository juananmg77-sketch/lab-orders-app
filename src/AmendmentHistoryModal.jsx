import React, { useState, useEffect } from 'react';
import { X, History, User, Clock, FileText } from 'lucide-react';
import { supabase } from './supabaseClient';

const FIELD_LABELS = {
  lot_number:       'Nº Lote',
  expiry_date:      'Fecha caducidad',
  preparation_date: 'Fecha preparación',
  quantity_g:       'Cantidad (g)',
  quantity_l:       'Cantidad (L)',
  responsible:      'Responsable',
  analyst:          'Analista',
  date_start:       'Fecha inicio uso',
  date_end:         'Fecha fin uso',
  medium_name:      'Medio',
  base_lot_ref:     'Lote del medio',
  supp_lot_ref:     'Lote suplemento',
  status:           'Estado',
  approved_by:      'Aprobado por',
  approval_date:    'Fecha aprobación',
  quantity:         'Cantidad',
  received_by:      'Recibido por',
  reception_date:   'Fecha recepción',
  notes:            'Notas',
};

function fmt(val) {
  if (val === null || val === undefined || val === '') return null;
  return String(val);
}

function DiffRow({ field, prev, next, newValuesKnown }) {
  const label   = FIELD_LABELS[field] || field;
  const fPrev   = fmt(prev);
  const fNext   = fmt(next);
  const changed = newValuesKnown && fPrev !== fNext;

  const renderVal = (val, isNext) => {
    if (val === null) {
      if (isNext && newValuesKnown) return <span style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '0.78rem' }}>(vacío)</span>;
      return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    }
    return val;
  };

  return (
    <tr style={{ background: changed ? 'rgba(251,191,36,0.08)' : 'transparent' }}>
      <td style={{ padding: '5px 10px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ padding: '5px 10px', fontSize: '0.82rem', color: changed ? '#b45309' : 'var(--text)', textDecoration: changed ? 'line-through' : 'none' }}>{renderVal(fPrev, false)}</td>
      <td style={{ padding: '5px 10px', fontSize: '0.82rem', color: changed ? '#15803d' : 'var(--text)' }}>{renderVal(fNext, true)}</td>
    </tr>
  );
}

export default function AmendmentHistoryModal({ isOpen, onClose, tableName, recordId, recordLabel }) {
  const [amendments, setAmendments] = useState([]);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    if (!isOpen || !tableName || !recordId) return;
    setLoading(true);
    supabase
      .from('record_amendments')
      .select('*')
      .eq('table_name', tableName)
      .eq('record_id', recordId)
      .order('amended_at', { ascending: false })
      .then(({ data }) => { setAmendments(data || []); setLoading(false); });
  }, [isOpen, tableName, recordId]);

  if (!isOpen) return null;

  const allFields = amendments.length > 0
    ? [...new Set(amendments.flatMap(a => [
        ...Object.keys(a.previous_values || {}),
        ...Object.keys(a.new_values || {}),
      ]))]
    : [];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(4px)'
    }}>
      <div className="card" style={{ width: '680px', maxHeight: '80vh', margin: 0, padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <div className="flex-between" style={{ marginBottom: '18px', flexShrink: 0 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--secondary)' }}>
            <History size={22} color="var(--primary)" />
            Historial de modificaciones
            {recordLabel && <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>· {recordLabel}</span>}
          </h3>
          <button className="btn btn-secondary" style={{ padding: '4px', border: 'none' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>Cargando historial...</p>}

          {!loading && amendments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <History size={36} style={{ marginBottom: '10px', opacity: 0.4 }} />
              <p style={{ margin: 0 }}>Sin modificaciones registradas</p>
            </div>
          )}

          {amendments.map((a, i) => {
            const fields = [...new Set([...Object.keys(a.previous_values || {}), ...Object.keys(a.new_values || {})])];
            return (
              <div key={a.id} style={{
                border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden'
              }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ fontSize: '0.78rem', background: 'var(--primary)', color: '#fff', borderRadius: '999px', padding: '2px 10px', fontWeight: 700 }}>
                      #{amendments.length - i}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', fontWeight: 600 }}>
                      <User size={13} /> {a.amended_by}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      <Clock size={12} /> {new Date(a.amended_at).toLocaleString('es-ES')}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'rgba(251,191,36,0.05)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                    <FileText size={13} color="var(--text-muted)" />
                    <strong>Motivo:</strong> {a.reason}
                  </span>
                </div>

                {fields.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                          <th style={{ padding: '5px 10px', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 600 }}>Campo</th>
                          <th style={{ padding: '5px 10px', fontSize: '0.78rem', color: '#b45309', textAlign: 'left', fontWeight: 600 }}>Valor anterior</th>
                          <th style={{ padding: '5px 10px', fontSize: '0.78rem', color: '#15803d', textAlign: 'left', fontWeight: 600 }}>Valor nuevo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map(f => (
                          <DiffRow
                            key={f}
                            field={f}
                            prev={(a.previous_values || {})[f]}
                            next={(a.new_values || {})[f]}
                            newValuesKnown={!!a.new_values}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!a.new_values && (
                  <p style={{ margin: 0, padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    ⚠ El formulario fue abierto pero los cambios no se guardaron — valores nuevos no disponibles.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
