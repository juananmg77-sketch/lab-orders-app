import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, ClipboardList, Search } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function InventoryModal({ isOpen, onClose, articles, onSaveInventory }) {
  const [inventoryItems, setInventoryItems] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const today = new Date().toLocaleDateString();

  useEffect(() => {
    if (isOpen && articles) {
      const initial = {};
      articles.forEach(art => {
        initial[art.id] = art.stock || 0;
      });
      setInventoryItems(initial);
      setSearchQuery('');
    }
  }, [isOpen, articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter(art => 
      art.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (art.supplierRef && art.supplierRef.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [articles, searchQuery]);

  if (!isOpen) return null;

  const handleStockChange = (articleId, val) => {
    let qty = parseInt(val, 10);
    if (isNaN(qty) || qty < 0) qty = 0;
    
    setInventoryItems(prev => ({
      ...prev,
      [articleId]: qty
    }));
  };

  const processInventory = async () => {
    setIsProcessing(true);
    
    try {
      // Find which items actually changed to avoid unnecessary updates
      const updates = [];
      articles.forEach(art => {
        const newStock = inventoryItems[art.id];
        if (newStock !== undefined && newStock !== art.stock) {
          updates.push({ id: art.id, stock: newStock });
        }
      });

      if (updates.length > 0) {
        // Since Supabase doesn't easily support bulk update of arbitrary rows with different values without a function,
        // we will process them sequentially or use upsert. Upsert requires all columns if we don't want to lose them,
        // but since we just want to update stock, we'll do sequential updates or Promise.all for simplicity.
        // It's a small app, Promise.all is perfectly fine.
        
        const attemptUpsert = async (itemUpdate) => {
          const fullArticle = articles.find(a => a.id === itemUpdate.id);
          if (!fullArticle) return;

          const updatedArticle = {
            ...fullArticle,
            stock: itemUpdate.stock,
            last_inventory: new Date().toISOString()
          };

          const { error } = await supabase.from('articles').upsert(updatedArticle);
          
          if (error) {
            console.error(`Error al persistir artículo ${itemUpdate.id}:`, error);
          }
        };

        await Promise.all(updates.map(update => attemptUpsert(update)));
      }

      onSaveInventory();
      onClose();
    } catch (err) {
      console.error("Error al actualizar inventario:", err);
      alert("Hubo un error al guardar el inventario.");
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
      <div className="card" style={{ width: '800px', margin: 0, height: '85vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Modal Header */}
        <div className="flex-between" style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)' }}>
              <ClipboardList size={22} color="var(--primary)"/> Ajuste de Inventario Manual
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Fecha de Inventario: <strong>{today}</strong>
            </p>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px', border: 'none' }} onClick={onClose} disabled={isProcessing}>
            <X size={24} />
          </button>
        </div>

        {/* Modal Toolbar */}
        <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
           <div className="input-group" style={{ margin: 0, flex: 1 }}>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Buscar referencia o nombre para ajustar rápido..." 
                  style={{ paddingLeft: '40px' }} 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
          <table style={{ margin: 0, fontSize: '0.9rem' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface)', zIndex: 1 }}>
              <tr>
                <th>Referencia (Proveedor)</th>
                <th>Nombre del Artículo</th>
                <th style={{ textAlign: 'center' }}>Stock BBDD</th>
                <th style={{ width: '150px', textAlign: 'center' }}>Stock Físico Real</th>
              </tr>
            </thead>
            <tbody>
              {filteredArticles.map(art => {
                const currentStock = art.stock || 0;
                const manualStock = inventoryItems[art.id] !== undefined ? inventoryItems[art.id] : currentStock;
                const isChanged = manualStock !== currentStock;

                return (
                  <tr key={art.id} style={{ backgroundColor: isChanged ? 'rgba(79, 70, 229, 0.05)' : 'transparent' }}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{art.supplierRef || '-'}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{art.name}</div>
                      {art.description && <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 500 }}>{art.description}</div>}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{currentStock}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="number" 
                        min="0" 
                        className="input-field"
                        style={{ 
                          padding: '6px', 
                          textAlign: 'center', 
                          borderColor: isChanged ? 'var(--primary)' : 'var(--border)',
                          fontWeight: isChanged ? 'bold' : 'normal'
                        }}
                        value={manualStock}
                        onChange={(e) => handleStockChange(art.id, e.target.value)}
                        disabled={isProcessing}
                      />
                    </td>
                  </tr>
                );
              })}
              {filteredArticles.length === 0 && (
                <tr>
                   <td colSpan="4" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No se encontraron artículos con esa búsqueda.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>* Los elementos resaltados en color azul indican modificaciones no guardadas.</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={isProcessing}>Descartar Cambios</button>
            <button className="btn btn-primary" onClick={processInventory} disabled={isProcessing} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isProcessing ? 'Guardando...' : <><Save size={18} /> Guardar Inventario</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
