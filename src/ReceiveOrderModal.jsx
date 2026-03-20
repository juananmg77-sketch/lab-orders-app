import React, { useState, useEffect } from 'react';
import { X, CheckCircle, PackageCheck, AlertTriangle } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function ReceiveOrderModal({ isOpen, onClose, order, onOrderReceived }) {
  const [receivedItems, setReceivedItems] = useState({});
  const [deliveryNote, setDeliveryNote] = useState('');
  const [incidents, setIncidents] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen && order) {
      const initialReceived = {};
      order.cart.forEach(item => {
        const alreadyReceived = order.receivedMapping ? (order.receivedMapping[item.article.id] || 0) : 0;
        const pending = Math.max(0, item.quantity - alreadyReceived);
        initialReceived[item.article.id] = pending; // Default to pending quantity
      });
      setReceivedItems(initialReceived);
      setIncidents(order.incidents || ''); // Cargar incidencias previas si existen
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const handleReceiveChange = (articleId, qtyStr) => {
    let qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty < 0) qty = 0;
    
    setReceivedItems(prev => ({
      ...prev,
      [articleId]: qty
    }));
  };

  const processReception = async () => {
    setIsProcessing(true);
    
    try {
      // For each item, update the stock in Supabase
      for (const item of order.cart) {
        const receivedQty = receivedItems[item.article.id] || 0;
        if (receivedQty > 0) {
          // Fetch current article
          const { data: artData, error: fetchErr } = await supabase
            .from('articles')
            .select('stock')
            .eq('id', item.article.id)
            .single();
            
          if (!fetchErr && artData) {
            const newStock = Number(artData.stock || 0) + receivedQty;
            await supabase
              .from('articles')
              .update({ stock: newStock })
              .eq('id', item.article.id);
          }
        }
      }

      // Calculate NEW total received mapping (old + new)
      const newMapping = { ...(order.receivedMapping || {}) };
      Object.keys(receivedItems).forEach(id => {
        newMapping[id] = (newMapping[id] || 0) + receivedItems[id];
      });

      onOrderReceived(order.id, newMapping, deliveryNote, incidents);
      onClose();
      setDeliveryNote(''); // Reset for next time
      setIncidents('');
    } catch (err) {
      console.error("Error al recepcionar pedido:", err);
      alert("Hubo un error al actualizar los stocks.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
    }}>
      <div className="card" style={{ width: '850px', margin: 0, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Modal Header */}
        <div className="flex-between" style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)' }}>
              <PackageCheck size={22} color="var(--success)"/> {order.status === 'Incompleto' ? 'Continuar Recepción' : 'Recepcionar Pedido'}: {order.id}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {order.status === 'Incompleto' 
                ? 'Este pedido fue recepcionado parcialmente. Registre las unidades faltantes.' 
                : 'Valide el albarán de entrada y actualice el stock automáticamente.'}
            </p>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px', border: 'none' }} onClick={onClose} disabled={isProcessing}>
            <X size={24} />
          </button>
        </div>

        {/* Delivery Note & Incidents */}
        <div style={{ padding: '0 24px 20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--secondary)' }}>
                Número de Albarán / Referencia de Entrada:
              </label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Ej: ALB-2026-0045"
                style={{ margin: 0 }}
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
               <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--secondary)' }}>
                <AlertTriangle size={16} color="var(--danger)" /> Incidencias / No Conformidades:
              </label>
              <textarea 
                className="input-field" 
                placeholder="Indique si hay material dañado, falta algo, entrega incorrecta..."
                style={{ margin: 0, height: '42px', minHeight: '42px', resize: 'vertical' }}
                value={incidents}
                onChange={(e) => setIncidents(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ margin: 0, fontSize: '0.9rem' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface)', zIndex: 1 }}>
              <tr>
                <th>Artículo (Descripción y Formato)</th>
                <th style={{ textAlign: 'center' }}>Pedido</th>
                <th style={{ textAlign: 'center', color: 'var(--success)' }}>Recibido</th>
                <th style={{ textAlign: 'center', color: 'var(--warning)' }}>Pendiente</th>
                <th style={{ width: '120px' }}>Entrada Hoy</th>
              </tr>
            </thead>
            <tbody>
              {order.cart.map(item => {
                const requested = item.quantity;
                const alreadyReceived = order.receivedMapping ? (order.receivedMapping[item.article.id] || 0) : 0;
                const pending = Math.max(0, requested - alreadyReceived);
                const enteringNow = receivedItems[item.article.id] || 0;
                
                return (
                  <tr key={item.article.id}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: '4px' }}>
                        {item.article.name}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        {item.article.description && (
                          <span style={{ 
                            backgroundColor: 'var(--primary-light)', 
                            color: 'var(--primary)', 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            fontSize: '0.8rem', 
                            fontWeight: 600 
                          }}>
                            {item.article.description}
                          </span>
                        )}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          Ref: <strong>{item.article.supplierRef || item.article.id}</strong>
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>{requested}</td>
                    <td style={{ textAlign: 'center', color: 'var(--success)', backgroundColor: 'rgba(212, 237, 218, 0.2)', fontWeight: 600 }}>{alreadyReceived}</td>
                    <td style={{ textAlign: 'center', color: 'var(--warning)', backgroundColor: 'rgba(255, 243, 205, 0.2)', fontWeight: 600 }}>{pending}</td>
                    <td>
                      <input 
                        type="number" 
                        min="0" 
                        className="input-field"
                        style={{ 
                          padding: '8px', 
                          textAlign: 'center', 
                          fontSize: '1rem',
                          fontWeight: 'bold',
                          border: enteringNow > 0 ? '2px solid var(--primary)' : '1px solid var(--border)',
                          backgroundColor: enteringNow > 0 ? 'white' : 'transparent'
                        }}
                        value={enteringNow}
                        onChange={(e) => handleReceiveChange(item.article.id, e.target.value)}
                        disabled={isProcessing}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isProcessing}>Cancelar</button>
          <button className="btn btn-primary" onClick={processReception} disabled={isProcessing} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isProcessing ? 'Procesando...' : <><CheckCircle size={18} /> Confirmar {order.status === 'Incompleto' ? 'Resto de Pedido' : 'Recepción'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
