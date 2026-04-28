import React from 'react';
import { X, FileText, PackageSearch, PackageCheck, AlertTriangle, Calendar } from 'lucide-react';

export default function ViewOrderModal({ isOpen, onClose, order }) {
  if (!isOpen || !order) return null;

  const calculateTotal = () => {
    return order.cart.reduce((total, item) => {
      const priceStr = item.article.price ? String(item.article.price) : '0';
      const priceVal = parseFloat(priceStr.replace('€', '').replace(',', '.').trim()) || 0;
      return total + (priceVal * item.quantity);
    }, 0);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
    }}>
      <div className="card" style={{ width: '900px', margin: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Header */}
        <div className="flex-between" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h3 style={{ margin: 0, color: 'var(--secondary)' }}>Detalles del Pedido: {order.id}</h3>
              <span className={`badge ${
                order.status === 'Completado' ? 'badge-success' : 
                order.status === 'Incompleto' ? 'badge-warning' :
                order.status === 'Pendiente' ? 'badge-info' : 'badge-danger'
              }`}>
                {order.status}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {order.date}</span>
              <span style={{ fontWeight: 600 }}>Proveedor: {order.supplier}</span>
            </div>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px', border: 'none' }} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Reception Info Bar (if received) */}
        {(order.deliveryNote || order.incidents) && (
          <div style={{ padding: '16px 24px', backgroundColor: 'var(--primary-light)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '24px' }}>
            {order.deliveryNote && (
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Albarán de Entrada:
                </label>
                <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{order.deliveryNote}</div>
              </div>
            )}
            {order.incidents && (
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  <AlertTriangle size={14} /> Incidencias / Observaciones:
                </label>
                <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{order.incidents}</div>
              </div>
            )}
          </div>
        )}

        {/* Table Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ margin: 0 }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface)', zIndex: 1 }}>
              <tr>
                <th>Artículo</th>
                <th style={{ textAlign: 'center' }}>Referencia</th>
                <th style={{ textAlign: 'center' }}>Formato</th>
                <th style={{ textAlign: 'center' }}>Precio Unid.</th>
                <th style={{ textAlign: 'center' }}>Solicitado</th>
                {order.status !== 'Pendiente' && <th style={{ textAlign: 'center', backgroundColor: 'rgba(212, 237, 218, 0.1)' }}>Recibido</th>}
                <th style={{ textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.cart.map((item, idx) => {
                const priceStr = item.article.price ? String(item.article.price) : '0';
                const priceVal = parseFloat(priceStr.replace('€', '').replace(',', '.').trim()) || 0;
                const subtotal = priceVal * item.quantity;
                const received = order.receivedMapping ? (order.receivedMapping[item.article.id] || 0) : 0;
                
                return (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.article.name}</div>
                      {item.article.description && <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{item.article.description}</div>}
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.article.supplierRef || item.article.id}</td>
                    <td style={{ textAlign: 'center' }}>{item.article.format || '-'}</td>
                    <td style={{ textAlign: 'center' }}>{priceVal.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                    {order.status !== 'Pendiente' && (
                      <td style={{ 
                        textAlign: 'center', 
                        fontWeight: 700, 
                        color: received >= item.quantity ? 'var(--success)' : (received > 0 ? 'var(--warning)' : 'var(--danger)'),
                        backgroundColor: 'rgba(212, 237, 218, 0.05)'
                      }}>
                        {received}
                      </td>
                    )}
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Importe Total del Pedido (sin IVA)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
              {order.total ? order.total.toLocaleString('es-ES', { minimumFractionDigits: 2 }) : calculateTotal().toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
