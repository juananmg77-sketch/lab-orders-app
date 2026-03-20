import React, { useState, useMemo, useEffect } from 'react';
import { X, ShoppingCart, Send, FileText, Trash2, Plus } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from './assets/logo.png';

export default function NewOrderModal({ isOpen, onClose, onSaveOrder, suppliers, articles, editingOrder, defaultSupplierForOrder, initialCart = [] }) {
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [cart, setCart] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [articleSearch, setArticleSearch] = useState('');
  const [articleCategory, setArticleCategory] = useState('');
  const [suggestedCart, setSuggestedCart] = useState([]);
  const [logoBase64, setLogoBase64] = useState('');

  // Pre-load and convert logo to B&W Base64
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Luminance formula for grayscale
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);
      setLogoBase64(canvas.toDataURL('image/png'));
    };
    img.src = logo;
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (editingOrder) {
        setSelectedSupplierName(editingOrder.supplier);
        setCart(editingOrder.cart || []);
        setSuggestedCart([]);
      } else {
        setSelectedSupplierName(defaultSupplierForOrder || '');
        // Cuando entramos con una selección (de stocks), la dejamos como sugerencia
        // Pero no la añadimos al carrito directamente hasta que el usuario confirme
        if (initialCart.length > 0) {
          setSuggestedCart(initialCart);
          setCart([]);
        } else {
          setSuggestedCart([]);
          setCart([]);
        }
      }
      setArticleSearch('');
      setArticleCategory('');
    }
  }, [isOpen, editingOrder, defaultSupplierForOrder, initialCart]);

  // Get selected supplier object
  const supplier = useMemo(() => 
    suppliers.find(s => s.name === selectedSupplierName), 
  [selectedSupplierName, suppliers]);

  // Derive unique suppliers from both the suppliers table and articles
  const allSupplierNames = useMemo(() => {
    const fromArticles = articles.filter(a => a && a.supplierName).map(a => a.supplierName);
    const fromSuppliers = suppliers.filter(s => s && s.name).map(s => s.name);
    const combined = [...new Set([...fromArticles, ...fromSuppliers])];
    
    // Case-insensitive uniqueness
    const seen = new Set();
    const unique = [];
    combined.forEach(name => {
      const lower = name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(name);
      }
    });
    return unique.sort((a, b) => a.localeCompare(b));
  }, [articles, suppliers]);

  const uniqueCategories = useMemo(() => {
    const suppArticles = selectedSupplierName ? articles.filter(a => a.supplierName === selectedSupplierName) : articles;
    return [...new Set(suppArticles.map(a => a.category))];
  }, [selectedSupplierName, articles]);

  // Filter articles by supplier, search, and category
  const availableArticles = useMemo(() => {
    return articles.filter(a => {
      const matchSupplier = selectedSupplierName === '' || a.supplierName === selectedSupplierName;
      const matchSearch = (a.name || '').toLowerCase().includes(articleSearch.toLowerCase()) || 
                          ((a.supplierRef || a.id || '').toLowerCase().includes(articleSearch.toLowerCase()));
      const matchCategory = articleCategory === '' || a.category === articleCategory;
      return matchSupplier && matchSearch && matchCategory;
    });
  }, [selectedSupplierName, articleSearch, articleCategory, articles]);

  const addToCart = (articleId, qtyStr) => {
    const qty = parseInt(qtyStr, 10);
    if (!qty || qty <= 0) return;

    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    // Use article's supplierName if none is selected yet
    if (!selectedSupplierName && article.supplierName) {
      setSelectedSupplierName(article.supplierName);
    }

    setCart(prev => {
      const existing = prev.find(item => item.article.id === articleId);
      if (existing) {
        return prev.map(item => item.article.id === articleId ? { ...item, quantity: item.quantity + qty } : item);
      } else {
        return [...prev, { article, quantity: qty }];
      }
    });
  };

  const removeFromCart = (articleId) => {
    setCart(prev => prev.filter(item => item.article.id !== articleId));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => {
      const priceStr = item.article.price ? String(item.article.price) : '0';
      const priceVal = parseFloat(priceStr.replace('€', '').replace(',', '.').trim()) || 0;
      return total + (priceVal * item.quantity);
    }, 0);
  };

  const getOrderData = () => {
    const orderSupplierName = selectedSupplierName || (cart.length > 0 ? cart[0].article.supplierName : '');
    const orderRef = editingOrder ? editingOrder.id : `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`;
    
    return {
      id: orderRef,
      date: new Date().toLocaleDateString(),
      supplier: orderSupplierName || 'Proveedor Desconocido',
      items: cart.length,
      cart: cart,
      total: calculateTotal(),
      status: 'Pendiente'
    };
  };

  const createPDF = (orderRef, orderSupplierName) => {
    const doc = new jsPDF();
    const orderSupplier = suppliers.find(s => s.name === orderSupplierName) || supplier;
    
    // Header & Logo (SAP Style)
    // Logo on right
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 150, 15, 45, 12);
      } catch (e) {
        console.warn("No se pudo añadir el logo al PDF:", e);
      }
    }

    // Header left
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text('ORDEN DE PEDIDO', 14, 25);
    
    // Horizontal line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(14, 30, 196, 30);

    // Business info (left) vs Order info (right)
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    
    // Provider and Address Info
    doc.text('HSCONSULTING LAB', 14, 38);
    doc.text('Dirección de Entrega: Plaza San Cosme 8. 07011 Palma de Mallorca', 14, 43);
    doc.text('lab@hsconsulting.es | Tel: 871 23 16 58', 14, 48);

    // Order Info Box
    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(248, 248, 248);
    doc.rect(130, 35, 66, 25, 'FD');
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(`Referencia:`, 134, 42);
    doc.text(`Fecha:`, 134, 48);
    doc.text(`Nº Proveedor:`, 134, 54);
    
    doc.setFont("helvetica", "normal");
    doc.text(`${orderRef}`, 160, 42);
    doc.text(`${new Date().toLocaleDateString()}`, 160, 48);
    doc.text(`${orderSupplier?.id || 'Nuevo'}`, 160, 54);

    // Attention & Email Labels
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text('DATOS DEL PROVEEDOR:', 14, 65);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    doc.text(`Proveedor: ${orderSupplier?.name || orderSupplierName}`, 14, 72);
    doc.text(`Atención: ${orderSupplier?.contact || 'Dpto. Comercial'}`, 14, 78);
    doc.text(`Email: ${orderSupplier?.email || 'desconocido@proveedor.com'}`, 14, 84);

    const tableData = cart.map((item, index) => {
      const nameWithDesc = item.article.description 
        ? `${item.article.name} (${item.article.description})`
        : item.article.name;
      return [
        index + 1,
        item.article.supplierRef || item.article.id,
        item.article.format || '-',
        nameWithDesc,
        item.quantity
      ];
    });

    autoTable(doc, {
      startY: 92,
      head: [['Pos', 'Ref. Material', 'Formato', 'Descripción Detallada', 'Cantidad']],
      body: tableData,
      theme: 'striped',
      headStyles: { 
        fillColor: [60, 60, 60], 
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 35 },
        2: { cellWidth: 30 },
        4: { halign: 'center', cellWidth: 25 } // Increased width to prevent wrapping
      }
    });

    // Footer info
    const finalY = (doc).lastAutoTable.finalY || 150;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Nota: Por favor, confirmen recepción de este pedido indicando fecha estimada de entrega.', 14, finalY + 15);
    doc.text('Contacto: lab@hsconsulting.es', 14, finalY + 20);

    return doc;
  };

  const handleSaveOnly = () => {
    if (cart.length === 0) return;
    const orderData = getOrderData();

    if (orderData.supplier === 'Proveedor Desconocido') {
      alert("Error: No se ha podido determinar el proveedor del pedido. Seleccione uno de la lista superior.");
      return;
    }

    onSaveOrder(orderData);
    setCart([]);
    onClose();
  };

  const handleGeneratePDFOnly = () => {
    if (cart.length === 0) return;
    const orderData = getOrderData();

    if (orderData.supplier === 'Proveedor Desconocido') {
      alert("Error: No se ha podido determinar el proveedor del pedido.");
      return;
    }

    const doc = createPDF(orderData.id, orderData.supplier);
    const filename = `Pedido_${orderData.id}_${orderData.supplier.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
    
    // Auto-save order too as it's common sense when generating PDF
    onSaveOrder(orderData);
  };

  const handleGenerateAndSend = () => {
    if (cart.length === 0) return;
    const orderData = getOrderData();

    if (orderData.supplier === 'Proveedor Desconocido') {
      alert("Error: No se ha podido determinar el proveedor del pedido.");
      return;
    }

    const orderSupplier = suppliers.find(s => s.name === orderData.supplier);
    
    setIsProcessing(true);

    setTimeout(() => {
      try {
        const doc = createPDF(orderData.id, orderData.supplier);
        const filename = `Pedido_${orderData.id}_${orderData.supplier.replace(/\s+/g, '_')}.pdf`;

        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], filename, { type: 'application/pdf' });
        
        const subject = encodeURIComponent(`Nuevo Pedido - ${orderData.supplier} [Ref: ${orderData.id}]`);
        const body = encodeURIComponent(`Buenos días,\n\nAdjuntamos en este correo nuestro último pedido de material para el laboratorio (Ref: ${orderData.id}).\n\nPor favor, confirmen recepción y envíen acuse de recibo.\n\nPara cualquier consulta, pueden contactar con lab@hsconsulting.es\n\nUn saludo.`);
        const supplierEmail = orderSupplier?.email || '';

        const downloadAndMailto = () => {
          doc.save(filename);
          alert(`¡Hecho! El PDF se ha descargado.\nSe va a abrir ahora un borrador de email.\nPor favor, no olvides adjuntar manualmente el PDF.`);
          window.location.href = `mailto:${supplierEmail}?subject=${subject}&body=${body}`;
          
          onSaveOrder(orderData);
          setIsProcessing(false);
          setCart([]);
          onClose();
        };

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({
            title: 'Pedido Laboratorio',
            text: 'Adjuntamos el nuevo pedido para el proveedor.',
            files: [file]
          }).then(() => {
            onSaveOrder(orderData);
            setIsProcessing(false);
            setCart([]);
            onClose();
          }).catch((err) => {
            downloadAndMailto();
          });
        } else {
          downloadAndMailto();
        }

      } catch (err) {
        alert("Error al procesar el envío: " + err.message);
        setIsProcessing(false);
      }
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
    }}>
      <div className="card" style={{ width: '1000px', margin: 0, height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Modal Header */}
        <div className="flex-between" style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)' }}>
              <ShoppingCart size={22} color="var(--primary)"/> Generar Nuevo Pedido
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Gestione el pedido, descargue el documento o envíelo por email.</p>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px', border: 'none' }} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', gap: '24px' }}>
          
          {/* Left Column: Selection */}
          <div style={{ flex: 1, borderRight: '1px solid var(--border)', paddingRight: '24px' }}>
            <div className="input-group">
              <label className="input-label">1. Selecciona un Proveedor</label>
              <select 
                className="input-field" 
                value={selectedSupplierName}
                onChange={(e) => {
                  setSelectedSupplierName(e.target.value);
                  setArticleCategory('');
                  setArticleSearch('');
                  setCart([]);
                }}
                style={{ fontSize: '1rem', padding: '12px' }}
              >
                <option value="">-- Elige proveedor --</option>
                {allSupplierNames.map((name, idx) => (
                  <option key={idx} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: '24px' }}>
              <div className="flex-between" style={{ marginBottom: '12px' }}>
                <label className="input-label" style={{ margin: 0 }}>2. Artículos a Pedir</label>
              </div>
              
              {suggestedCart.length > 0 && (
                <div style={{ backgroundColor: 'var(--primary-light)', padding: '16px', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--primary)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShoppingCart size={16} /> Sugerencias de Control de Stocks
                  </h4>
                  <table style={{ margin: 0, fontSize: '0.8rem', backgroundColor: 'transparent' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--primary)' }}>
                        <th style={{ backgroundColor: 'transparent', color: 'var(--primary)' }}>Articulo</th>
                        <th style={{ backgroundColor: 'transparent', color: 'var(--primary)', width: '80px' }}>Ud. Pedir</th>
                        <th style={{ backgroundColor: 'transparent', color: 'var(--primary)', width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {suggestedCart.map((item, idx) => (
                        <tr key={item.article.id} style={{ borderBottom: '1px solid rgba(0, 118, 206, 0.1)' }}>
                          <td style={{ backgroundColor: 'transparent' }}>
                            <div style={{ fontWeight: 600 }}>{item.article.name}</div>
                            <div style={{ fontSize: '0.75rem' }}>Ref: {item.article.supplierRef || item.article.id}</div>
                          </td>
                          <td style={{ backgroundColor: 'transparent' }}>
                            <input 
                              type="number" 
                              min="1" 
                              value={item.quantity} 
                              onChange={(e) => {
                                const newQty = parseInt(e.target.value) || 1;
                                setSuggestedCart(prev => prev.map((s, i) => i === idx ? { ...s, quantity: newQty } : s));
                              }}
                              style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid var(--primary)' }}
                            />
                          </td>
                          <td style={{ backgroundColor: 'transparent' }}>
                            <button 
                              className="btn btn-secondary" 
                              onClick={() => setSuggestedCart(prev => prev.filter((_, i) => i !== idx))}
                              style={{ padding: '4px', border: 'none', color: 'var(--danger)' }}
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => {
                       setCart(prev => {
                         const currentIds = prev.map(p => p.article.id);
                         const newItems = suggestedCart.filter(s => !currentIds.includes(s.article.id));
                         // Actualizamos las cantidades de los que YA estaban por las sugeridas si el usuario lo desea?
                         // Por ahora solo añadimos los nuevos.
                         return [...prev, ...newItems];
                       });
                       setSuggestedCart([]);
                    }}
                    style={{ marginTop: '12px', width: '100%', padding: '8px', fontSize: '0.85rem' }}
                  >
                    Mover {suggestedCart.length} artículos al Carrito
                  </button>
                </div>
              )}
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label className="input-label" style={{ margin: 0, fontSize: '0.85rem' }}>3. Catálogo General / Otros Artículos</label>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Buscar por nombre o Ref..." 
                    value={articleSearch}
                    onChange={(e) => setArticleSearch(e.target.value)}
                    style={{ flex: 1, padding: '10px 14px' }}
                  />
                  <select 
                    className="input-field"
                    value={articleCategory}
                    onChange={(e) => setArticleCategory(e.target.value)}
                    style={{ width: '180px' }}
                  >
                    <option value="">Todas las categorías</option>
                    {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <table style={{ margin: 0, fontSize: '0.85rem' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface)', zIndex: 1 }}>
                      <tr>
                        <th>Artículo (Ref)</th>
                        <th>Stock / Mín</th>
                        <th style={{ width: '100px' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableArticles.map(art => {
                        const statusColor = art.stock <= art.minStock ? 'var(--danger)' : 'var(--text-muted)';
                        const suggestion = suggestedCart.find(s => s.article.id === art.id);
                        
                        return (
                          <tr key={art.id} style={suggestion ? { backgroundColor: 'var(--primary-light)' } : {}}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{art.name}</div>
                              {art.description && <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 500 }}>{art.description}</div>}
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{art.supplierRef || art.id} - {art.price}</div>
                            </td>
                            <td>
                              <span style={{ color: statusColor, fontWeight: art.stock <= art.minStock ? 700 : 400 }}>
                                {art.stock}
                              </span> / {art.minStock}
                            </td>
                            <td>
                              <form onSubmit={(e) => { e.preventDefault(); addToCart(art.id, e.target.elements.qty.value); }}>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <input name="qty" type="number" min="1" defaultValue="1" style={{ width: '60px', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--background)' }} />
                                  <button type="submit" className="btn btn-primary" style={{ padding: '6px 10px' }}><Plus size={16}/></button>
                                </div>
                              </form>
                            </td>
                          </tr>
                        )})}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>

          {/* Right Column: Cart & Actions */}
          <div style={{ width: '350px', display: 'flex', flexDirection: 'column' }}>
            <label className="input-label" style={{ marginBottom: '8px' }}>3. Resumen y Acciones</label>
            {selectedSupplierName && (
              <div style={{ marginBottom: '16px', padding: '8px 12px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, borderLeft: '4px solid var(--primary)' }}>
                Proveedor: {selectedSupplierName}
              </div>
            )}
            
            <div style={{ flex: 1, backgroundColor: 'var(--background)', borderRadius: '8px', padding: '20px', overflowY: 'auto', border: '1px solid var(--border)' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
                  <ShoppingCart size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                  <p>Añada artículos para continuar</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {cart.map(item => (
                    <div key={item.article.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface)', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.3 }}>{item.article.name}</div>
                        {item.article.description && <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{item.article.description}</div>}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{item.quantity} x {item.article.price}</div>
                      </div>
                      <button onClick={() => removeFromCart(item.article.id)} className="btn btn-secondary" style={{ padding: '6px', border: 'none', color: 'var(--danger)' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <div style={{ borderTop: '2px solid var(--border)', paddingTop: '16px', marginTop: '12px', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Estimado</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{calculateTotal().toFixed(2)} €</div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className={`btn btn-primary ${cart.length === 0 ? 'disabled' : ''}`} 
                style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
                onClick={handleSaveOnly}
                disabled={cart.length === 0 || isProcessing}
              >
                Guardar Pedido
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ gap: '6px', fontSize: '0.85rem' }}
                  onClick={handleGeneratePDFOnly}
                  disabled={cart.length === 0 || isProcessing}
                >
                  <FileText size={16} /> Generar PDF
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ gap: '6px', fontSize: '0.85rem' }}
                  onClick={handleGenerateAndSend}
                  disabled={cart.length === 0 || isProcessing}
                >
                  <Send size={16} /> PDF y Enviar
                </button>
              </div>
            </div>
            
            <p style={{ margin: '12px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              * Guardar pedido lo registrará en la lista sin descargar documentos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
