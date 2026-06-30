import React, { useState, useEffect } from 'react';
import { X, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ReopenOrderModal({ isOpen, onClose, order, onConfirm }) {
  const [reason,      setReason]      = useState('');
  const [amendedBy,   setAmendedBy]   = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => { if (!isOpen) { setReason(''); setAmendedBy(''); } }, [isOpen]);

  if (!isOpen || !order) return null;

  const isCompleted = order.status === 'Completado';
  const canConfirm  = reason.trim() && (!isCompleted || amendedBy.trim()) && !isProcessing;

  const handleConfirm = async () => {
    if (!reason.trim()) { alert('Es obligatorio indicar un motivo para reabrir el pedido.'); return; }
    if (isCompleted && !amendedBy.trim()) { alert('Es obligatorio indicar el nombre de quien reabre el pedido.'); return; }
    setIsProcessing(true);
    await onConfirm(order, reason.trim(), isCompleted ? amendedBy.trim() : null);
    setIsProcessing(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
    }}>
      <div className="card" style={{ width: '500px', margin: 0, padding: '24px' }}>
        <div className="flex-between" style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--secondary)' }}>
            <RotateCcw size={24} color="var(--warning)" /> Reabrir Pedido {order.id}
          </h3>
          <button className="btn btn-secondary" style={{ padding: '4px', border: 'none' }} onClick={onClose} disabled={isProcessing}>
            <X size={24} />
          </button>
        </div>

        <div style={{ backgroundColor: 'rgba(255,193,7,0.1)', borderLeft: '4px solid var(--warning)', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#856404', fontWeight: 500 }}>
            <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            {isCompleted
              ? 'Pedido completado — la reapertura quedará registrada con trazabilidad ISO 17025.'
              : 'Esta acción es irreversible y afectará al inventario.'}
          </p>
        </div>

        <p style={{ fontSize: '0.95rem', lineHeight: '1.5', color: 'var(--text)', marginBottom: '16px' }}>
          {isCompleted
            ? "El estado pasará a 'Pendiente'. Se restarán del stock las unidades recibidas anteriormente."
            : "Se reiniciará la recepción del pedido. Las unidades recibidas parcialmente se restarán del stock."}
        </p>

        {isCompleted && (
          <div className="input-group" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.9rem' }}>
              Nombre de quien reabre <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              className="input-field"
              placeholder="Nombre completo"
              value={amendedBy}
              onChange={e => setAmendedBy(e.target.value)}
              disabled={isProcessing}
            />
          </div>
        )}

        <div className="input-group">
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
            Motivo de la reapertura <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <textarea
            className="input-field"
            style={{ height: '90px', resize: 'none', padding: '12px' }}
            placeholder="Ej: Error en el conteo de unidades, artículo dañado, etc..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isProcessing}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{ backgroundColor: 'var(--warning)', borderColor: 'var(--warning)', color: '#000', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isProcessing ? 'Procesando...' : <><CheckCircle size={18} /> Confirmar Reapertura</>}
          </button>
        </div>
      </div>
    </div>
  );
}
