import React, { useState, useEffect } from 'react';
import { X, CheckCircle, PackageCheck, AlertTriangle, Microscope, ArrowRight, Tag } from 'lucide-react';
import { supabase } from './supabaseClient';

const EQUIPO_RE = /equipo|equipamiento|instrument|aparato|maquina|maquinaria/i;

export default function ReceiveOrderModal({ isOpen, onClose, order, onOrderReceived, onRegisterEquipment, selectedLab = 'HSLAB Baleares', articles = [] }) {
  const [receivedItems, setReceivedItems] = useState({});
  const [deliveryNote, setDeliveryNote] = useState('');
  const [incidents, setIncidents] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState('receive');
  const [equipmentItems, setEquipmentItems] = useState([]);
  const [selectedForRegistration, setSelectedForRegistration] = useState({});
  const [lotInputs, setLotInputs] = useState({});

  // Mapa requires_lot derivado directamente de articles prop — sin fetch, sin async
  const lotRequired = React.useMemo(() => {
    if (!order || !articles.length) return {};
    const map = {};
    order.cart.forEach(item => {
      const art = articles.find(a => a.id === item.article.id);
      map[item.article.id] = !!(art?.requires_lot);
    });
    return map;
  }, [order, articles]);

  useEffect(() => {
    if (isOpen && order) {
      const initialReceived = {};
      const initialLots = {};
      order.cart.forEach(item => {
        const alreadyReceived = order.receivedMapping ? (order.receivedMapping[item.article.id] || 0) : 0;
        const pending = Math.max(0, item.quantity - alreadyReceived);
        initialReceived[item.article.id] = pending;
        const art = articles.find(a => a.id === item.article.id);
        if (art?.requires_lot) initialLots[item.article.id] = { lot_number: '', expiry_date: '' };
      });
      setReceivedItems(initialReceived);
      setLotInputs(initialLots);
      setIncidents(order.incidents || '');
      setStep('receive');
      setEquipmentItems([]);
      setSelectedForRegistration({});
    }
  }, [isOpen, order, articles]);

  if (!isOpen || !order) return null;

  const handleReceiveChange = (articleId, qtyStr) => {
    let qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty < 0) qty = 0;
    setReceivedItems(prev => ({ ...prev, [articleId]: qty }));
  };

  const handleLotChange = (articleId, field, value) => {
    setLotInputs(prev => ({ ...prev, [articleId]: { ...(prev[articleId] || {}), [field]: value } }));
  };

  // Artículos que se van a recepcionar ahora y requieren lote pero les falta
  const missingLots = order.cart.filter(item => {
    const qty = receivedItems[item.article.id] || 0;
    if (qty === 0 || !lotRequired[item.article.id]) return false;
    return !lotInputs[item.article.id]?.lot_number?.trim();
  });

  const canConfirm = missingLots.length === 0;

  const processReception = async () => {
    if (!canConfirm) return;
    setIsProcessing(true);
    try {
      for (const item of order.cart) {
        const receivedQty = receivedItems[item.article.id] || 0;
        if (receivedQty > 0) {
          const { data: artData, error: fetchErr } = await supabase
            .from('articles').select('stock_labs').eq('id', item.article.id).single();
          if (!fetchErr && artData) {
            const currentStock = (artData.stock_labs || {})[selectedLab] ?? 0;
            const newStock = currentStock + receivedQty;
            const newLabs = { ...(artData.stock_labs || {}), [selectedLab]: newStock };
            await supabase.from('articles').update({ stock_labs: newLabs }).eq('id', item.article.id);
          }

          // Registrar lote si aplica
          if (lotRequired[item.article.id]) {
            const lotIn = lotInputs[item.article.id] || {};
            const lotPayload = {
              article_id: item.article.id,
              order_id: order.id,
              lot_number: lotIn.lot_number || '',
              expiry_date: lotIn.expiry_date || null,
              reception_date: new Date().toISOString().slice(0, 10),
              quantity: receivedQty,
              origen: 'recepcion',
              lab: selectedLab,
            };
            const { data: lotData, error: lotErr } = await supabase
              .from('article_lots')
              .insert([lotPayload])
              .select();
            if (lotErr) {
              alert(`⚠️ Error guardando lote de ${item.article.name}: ${lotErr.message}`);
            } else {
              console.log('Lote guardado:', lotData);
            }
          }
        }
      }

      const newMapping = { ...(order.receivedMapping || {}) };
      Object.keys(receivedItems).forEach(id => {
        newMapping[id] = (newMapping[id] || 0) + receivedItems[id];
      });

      onOrderReceived(order.id, newMapping, deliveryNote, incidents);

      const eqItems = order.cart.filter(item => {
        const receivedQty = receivedItems[item.article.id] || 0;
        return receivedQty > 0 && EQUIPO_RE.test(item.article.category || '');
      });

      if (eqItems.length > 0 && onRegisterEquipment) {
        setEquipmentItems(eqItems);
        const sel = {};
        eqItems.forEach(i => { sel[i.article.id] = true; });
        setSelectedForRegistration(sel);
        setStep('equipment');
      } else {
        onClose();
        setDeliveryNote('');
        setIncidents('');
      }
    } catch (err) {
      console.error("Error al recepcionar pedido:", err);
      alert("Hubo un error al actualizar los stocks.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegisterEquipments = () => {
    const itemsToRegister = equipmentItems.filter(i => selectedForRegistration[i.article.id]);
    itemsToRegister.forEach(item => {
      onRegisterEquipment({
        name: item.article.name,
        purchase_supplier: order.supplier,
        purchase_amount: item.article.price ? parseFloat((item.article.price || '').replace(/[^0-9.,]/g, '').replace(',', '.')) || null : null,
        acquisition_date: new Date().toISOString().slice(0, 10),
        invoice_number: deliveryNote || '',
      });
    });
    onClose();
    setDeliveryNote('');
    setIncidents('');
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
    }}>
      <div className="card" style={{ width: '900px', margin: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* ── PASO 1: Recepción ── */}
        {step === 'receive' && (<>
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

          <div style={{ padding: '0 24px 20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--secondary)' }}>
                  Número de Albarán / Referencia de Entrada:
                </label>
                <input type="text" className="input-field" placeholder="Ej: ALB-2026-0045"
                  style={{ margin: 0 }} value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--secondary)' }}>
                  <AlertTriangle size={16} color="var(--danger)" /> Incidencias / No Conformidades:
                </label>
                <textarea className="input-field" placeholder="Indique si hay material dañado, falta algo, entrega incorrecta..."
                  style={{ margin: 0, height: '42px', minHeight: '42px', resize: 'vertical' }}
                  value={incidents} onChange={e => setIncidents(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Aviso si faltan lotes */}
          {missingLots.length > 0 && (
            <div style={{ margin: '0 24px 12px', padding: '10px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#9a3412' }}>
              <Tag size={16} />
              <span>
                <strong>Lote obligatorio:</strong> {missingLots.map(i => i.article.name).join(', ')} — completa el número de lote antes de confirmar.
              </span>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ margin: 0, fontSize: '0.9rem' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface)', zIndex: 1 }}>
                <tr>
                  <th>Artículo (Descripción y Formato)</th>
                  <th style={{ textAlign: 'center' }}>Pedido</th>
                  <th style={{ textAlign: 'center', color: 'var(--success)' }}>Recibido</th>
                  <th style={{ textAlign: 'center', color: 'var(--warning)' }}>Pendiente</th>
                  <th style={{ width: '100px' }}>Entrada Hoy</th>
                </tr>
              </thead>
              <tbody>
                {order.cart.map(item => {
                  const requested = item.quantity;
                  const alreadyReceived = order.receivedMapping ? (order.receivedMapping[item.article.id] || 0) : 0;
                  const pending = Math.max(0, requested - alreadyReceived);
                  const enteringNow = receivedItems[item.article.id] || 0;
                  const isEquipo = EQUIPO_RE.test(item.article.category || '');
                  const needsLot = lotRequired[item.article.id];
                  const lotIn = lotInputs[item.article.id] || {};
                  const lotMissing = needsLot && enteringNow > 0 && !lotIn.lot_number?.trim();

                  return (
                    <React.Fragment key={item.article.id}>
                      <tr style={isEquipo ? { backgroundColor: '#fefce8' } : needsLot ? { backgroundColor: '#f0fdf4' } : {}}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {item.article.name}
                            {isEquipo && <span style={{ fontSize: '0.72rem', backgroundColor: '#fef08a', color: '#854d0e', padding: '2px 7px', borderRadius: '10px', fontWeight: 700 }}>EQUIPO</span>}
                            {needsLot && <span style={{ fontSize: '0.72rem', backgroundColor: '#dcfce7', color: '#166534', padding: '2px 7px', borderRadius: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Tag size={10} />LOTE</span>}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                            {item.article.description && (
                              <span style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                                {item.article.description}
                              </span>
                            )}
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              Ref: <strong>{item.article.supplierRef || item.article.id}</strong>
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>{requested}</td>
                        <td style={{ textAlign: 'center', color: 'var(--success)', backgroundColor: 'rgba(212,237,218,0.2)', fontWeight: 600 }}>{alreadyReceived}</td>
                        <td style={{ textAlign: 'center', color: 'var(--warning)', backgroundColor: 'rgba(255,243,205,0.2)', fontWeight: 600 }}>{pending}</td>
                        <td>
                          <input type="number" min="0" className="input-field"
                            style={{ padding: '8px', textAlign: 'center', fontSize: '1rem', fontWeight: 'bold',
                              border: enteringNow > 0 ? '2px solid var(--primary)' : '1px solid var(--border)',
                              backgroundColor: enteringNow > 0 ? 'white' : 'transparent' }}
                            value={enteringNow}
                            onChange={e => handleReceiveChange(item.article.id, e.target.value)}
                            disabled={isProcessing} />
                        </td>
                      </tr>

                      {/* Fila de lote — aparece cuando se recepciona cantidad y el artículo requiere lote */}
                      {needsLot && enteringNow > 0 && (
                        <tr style={{ backgroundColor: '#f0fdf4' }}>
                          <td colSpan={5} style={{ padding: '6px 16px 14px 32px' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                              <div style={{ flex: '0 0 200px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#166534', display: 'block', marginBottom: '4px' }}>
                                  Nº Lote *
                                </label>
                                <input
                                  className="input-field"
                                  placeholder="Ej: LT-2026-001"
                                  style={{ margin: 0, fontSize: '0.88rem', border: lotMissing ? '2px solid var(--danger)' : '1px solid #86efac' }}
                                  value={lotIn.lot_number || ''}
                                  onChange={e => handleLotChange(item.article.id, 'lot_number', e.target.value)}
                                />
                              </div>
                              <div style={{ flex: '0 0 160px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#166534', display: 'block', marginBottom: '4px' }}>
                                  Fecha de Caducidad
                                </label>
                                <input
                                  type="date"
                                  className="input-field"
                                  style={{ margin: 0, fontSize: '0.88rem', border: '1px solid #86efac' }}
                                  value={lotIn.expiry_date || ''}
                                  onChange={e => handleLotChange(item.article.id, 'expiry_date', e.target.value)}
                                />
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#166534', paddingBottom: '10px' }}>
                                Se registrará automáticamente en Trazabilidad.
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={isProcessing}>Cancelar</button>
            <button
              className="btn btn-primary"
              onClick={processReception}
              disabled={isProcessing || !canConfirm}
              title={!canConfirm ? 'Completa el número de lote de los artículos marcados' : ''}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: canConfirm ? 1 : 0.5 }}
            >
              {isProcessing ? 'Procesando...' : <><CheckCircle size={18} /> Confirmar {order.status === 'Incompleto' ? 'Resto de Pedido' : 'Recepción'}</>}
            </button>
          </div>
        </>)}

        {/* ── PASO 2: Registrar Equipos ── */}
        {step === 'equipment' && (<>
          <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
            <h3 style={{ margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)' }}>
              <Microscope size={22} color="var(--primary)" /> Registrar en Gestión de Equipos
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Se han recibido artículos de tipo <strong>Equipo</strong>. ¿Deseas crear sus fichas técnicas? Los datos del pedido se pre-rellenarán automáticamente.
            </p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {equipmentItems.map(item => (
              <label key={item.article.id}
                style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px',
                  backgroundColor: selectedForRegistration[item.article.id] ? '#eff6ff' : '#f8fafc',
                  border: `2px solid ${selectedForRegistration[item.article.id] ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s' }}>
                <input type="checkbox"
                  checked={!!selectedForRegistration[item.article.id]}
                  onChange={e => setSelectedForRegistration(prev => ({ ...prev, [item.article.id]: e.target.checked }))}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '1rem' }}>{item.article.name}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Proveedor: <strong>{order.supplier}</strong> · Ud: {item.quantity} · Precio: {item.article.price || '—'}
                    {deliveryNote && <> · Albarán: <strong>{deliveryNote}</strong></>}
                  </div>
                </div>
                <ArrowRight size={18} color={selectedForRegistration[item.article.id] ? 'var(--primary)' : 'var(--text-muted)'} />
              </label>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => { onClose(); setDeliveryNote(''); setIncidents(''); }}>
              Omitir y Cerrar
            </button>
            <button className="btn btn-primary"
              disabled={!Object.values(selectedForRegistration).some(Boolean)}
              onClick={handleRegisterEquipments}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Microscope size={18} /> Crear fichas en Gestión de Equipos
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}
