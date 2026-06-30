import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, ClipboardEdit } from 'lucide-react';

export default function AmendmentReasonModal({ isOpen, onClose, onConfirm, title, recordLabel, isProcessing }) {
  const [reason, setReason]       = useState('');
  const [amendedBy, setAmendedBy] = useState('');

  useEffect(() => { if (!isOpen) { setReason(''); setAmendedBy(''); } }, [isOpen]);

  if (!isOpen) return null;

  const canConfirm = reason.trim() && amendedBy.trim() && !isProcessing;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(4px)'
    }}>
      <div className="card" style={{ width: '480px', margin: 0, padding: '24px' }}>
        <div className="flex-between" style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--secondary)' }}>
            <ClipboardEdit size={22} color="var(--warning)" />
            {title || 'Modificar registro cerrado'}
          </h3>
          <button className="btn btn-secondary" style={{ padding: '4px', border: 'none' }} onClick={onClose} disabled={isProcessing}>
            <X size={20} />
          </button>
        </div>

        <div style={{ backgroundColor: 'rgba(255,193,7,0.1)', borderLeft: '4px solid var(--warning)', padding: '10px 14px', borderRadius: '4px', marginBottom: '18px' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#856404', fontWeight: 500 }}>
            <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Este registro está cerrado. La modificación quedará registrada con trazabilidad ISO 17025.
            {recordLabel && <><br /><strong>Registro: {recordLabel}</strong></>}
          </p>
        </div>

        <div className="input-group" style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.875rem' }}>
            Nombre de quien modifica <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            className="input-field"
            placeholder="Nombre completo"
            value={amendedBy}
            onChange={e => setAmendedBy(e.target.value)}
            disabled={isProcessing}
            autoFocus
          />
        </div>

        <div className="input-group">
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.875rem' }}>
            Motivo de la modificación <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <textarea
            className="input-field"
            style={{ height: '90px', resize: 'none', padding: '10px' }}
            placeholder="Describe el motivo de la modificación..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isProcessing}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={() => onConfirm(reason.trim(), amendedBy.trim())}
            disabled={!canConfirm}
            style={{ backgroundColor: 'var(--warning)', borderColor: 'var(--warning)', color: '#000' }}
          >
            {isProcessing ? 'Guardando...' : 'Confirmar y editar'}
          </button>
        </div>
      </div>
    </div>
  );
}
