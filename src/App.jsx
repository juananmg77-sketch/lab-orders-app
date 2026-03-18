import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, 
  PackageSearch, 
  Box, 
  Truck, 
  Plus,
  Search,
  Bell,
  Settings,
  LogOut,
  X,
  ShoppingCart,
  PackageCheck,
  Trash2,
  Edit,
  RotateCcw,
  FileText,
  Upload,
  TrendingUp,
  FileSpreadsheet,
  CheckSquare,
  Check
} from 'lucide-react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import NewOrderModal from './NewOrderModal';
import ReceiveOrderModal from './ReceiveOrderModal';
import InventoryModal from './InventoryModal';
import SupplierModal from './SupplierModal';
import ReopenOrderModal from './ReopenOrderModal';
import InvoiceImporter from './InvoiceImporter';
import ExcelImporter from './ExcelImporter';
import Dashboard from './Dashboard';
import logo from './assets/logo.png';
import { mockArticles, mockSuppliers as initialSuppliers } from './data';

const mockOrdersInit = [
  { 
    id: 'ORD-001', 
    date: '2026-03-15', 
    status: 'Pendiente', 
    items: 2, 
    supplier: 'LabSupply Co.', 
    total: 118.70, 
    cart: [
      { article: { id: 'LAB-001', name: 'Agar R2A para recuento heterótrofo en agua', price: '55,42 €', supplierRef: '212264.1210' }, quantity: 1 },
      { article: { id: 'LAB-002', name: 'Agar Slanetz-Bartley (Enterococcus)', price: '63,28 €', supplierRef: '43011' }, quantity: 1 }
    ] 
  },
  { 
    id: 'ORD-002', 
    date: '2026-03-16', 
    status: 'Completado', 
    items: 1, 
    supplier: 'MedEquip Inc.', 
    total: 46.59, 
    cart: [
      { article: { id: 'LAB-003', name: 'Caldo Tripticasa Soya (TSB)', price: '46,59 €', supplierRef: '214046.1210' }, quantity: 1 }
    ] 
  },
];



function App() {
  const [activeTab, setActiveTab] = useState('pedidos');
  const [session, setSession] = useState(null);
  
  // Orders State
  const [orders, setOrders] = useState(mockOrdersInit);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [defaultSupplierForOrder, setDefaultSupplierForOrder] = useState('');
  
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState(null);

  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);

  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopeningOrder, setReopeningOrder] = useState(null);
  const [isExcelImporterOpen, setIsExcelImporterOpen] = useState(false);

  // Orders Filter State
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderDateStart, setOrderDateStart] = useState('');
  const [orderDateEnd, setOrderDateEnd] = useState('');

  // Articles state
  const [articles, setArticles] = useState([]);
  const [articleSearch, setArticleSearch] = useState('');
  const [articleCategory, setArticleCategory] = useState('');
  const [articleSupplier, setArticleSupplier] = useState('');
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);

  // Suppliers state
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  // Bulk Selection State
  const [selectedArticles, setSelectedArticles] = useState([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState({ category: '', supplierName: '' });

  const [isInvoiceImporterOpen, setIsInvoiceImporterOpen] = useState(false);

  const fetchArticles = async () => {
    const { data, error } = await supabase.from('articles').select('*').order('name');
    if (error) {
      console.error("Error fetching articles:", error.message);
      // Solo en caso de error total de conexión, mostrar mocks como guía
      if (!articles || articles.length === 0) setArticles(mockArticles);
    } else {
      setArticles(data || []);
    }
  };

  const fetchSuppliers = async () => {
    const { data, error } = await supabase.from('suppliers').select('*').order('name');
    if (error) {
      console.error("Error fetching suppliers:", error.message);
      if (!suppliers || suppliers.length === 0) setSuppliers(initialSuppliers);
    } else {
      setSuppliers(data || []);
    }
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase.from('orders').select('*').order('date', { ascending: false });
    if (error) {
      console.error("Error fetching orders:", error.message);
      setOrders(mockOrdersInit);
    } else {
      // Merge: DB orders + Mock orders not in DB
      const dbIds = new Set((data || []).map(o => o.id));
      const missingMocks = mockOrdersInit.filter(o => !dbIds.has(o.id));
      setOrders([...(data || []), ...missingMocks].sort((a, b) => b.date.localeCompare(a.date)));
    }
  };

  const filteredArticles = useMemo(() => {
    return articles.filter(art => {
      if (!art) return false;
      const name = art.name || '';
      const id = art.id || '';
      const category = art.category || '';
      const supplierName = art.supplierName || '';

      const matchesSearch = name.toLowerCase().includes(articleSearch.toLowerCase()) || 
                            id.toLowerCase().includes(articleSearch.toLowerCase());
      const matchesCategory = articleCategory === '' || category === articleCategory;
      const matchesSupplier = articleSupplier === '' || supplierName === articleSupplier;
      
      return matchesSearch && matchesCategory && matchesSupplier;
    });
  }, [articleSearch, articleCategory, articleSupplier, articles]);

  const uniqueCategories = useMemo(() => [...new Set(articles.filter(a => a && a.category).map(a => a.category))], [articles]);
  const uniqueSuppliers = useMemo(() => {
    const allNames = [
      ...articles.filter(a => a && a.supplierName).map(a => a.supplierName),
      ...suppliers.map(s => s.name)
    ];
    // Case-insensitive uniqueness
    const seen = new Set();
    const unique = [];
    allNames.forEach(name => {
      const lower = name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(name);
      }
    });
    return unique.sort((a, b) => a.localeCompare(b));
  }, [articles, suppliers]);

  const supplierArticleCounts = useMemo(() => {
    const counts = {};
    const supplierMap = {};
    // Map lowercase name to the preferred display name from suppliers table
    suppliers.forEach(s => supplierMap[s.name.toLowerCase()] = s.name);

    articles.forEach(a => {
      if (a.supplierName) {
        const lowerName = a.supplierName.toLowerCase();
        const displayName = supplierMap[lowerName] || a.supplierName;
        counts[displayName] = (counts[displayName] || 0) + 1;
      }
    });
    return counts;
  }, [articles, suppliers]);

  const lastGlobalInventory = useMemo(() => {
    const dates = articles.filter(a => a.last_inventory).map(a => new Date(a.last_inventory).getTime());
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates));
  }, [articles]);

  const openArticleModal = (article = null) => {
    setEditingArticle(article);
    setIsArticleModalOpen(true);
  };

  const closeArticleModal = () => {
    setEditingArticle(null);
    setIsArticleModalOpen(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      fetchArticles();
      fetchSuppliers();
      fetchOrders();
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      fetchArticles();
      fetchSuppliers();
      fetchOrders();
    });
  }, []);

  if (!session && !window.location.hostname.includes('localhost')) {
    return <Auth />;
  }

  const handleSaveArticle = async (e) => {
    e.preventDefault();
    const form = e.target;
    
    const articleData = {
      id: form.elements.id.value,
      name: form.elements.name.value,
      description: form.elements.description.value,
      format: form.elements.format.value,
      category: form.elements.category.value,
      supplierName: form.elements.supplierName.value,
      supplierRef: form.elements.supplierRef.value,
      price: form.elements.price.value,
      stock: parseInt(form.elements.stock.value, 10),
      minStock: parseInt(form.elements.minStock.value, 10),
      last_inventory: editingArticle?.last_inventory || null
    };

    const saveToSupabase = async (data) => {
      console.log("Persistence: Ejecutando upsert en artículos...", data);
      const { error } = await supabase.from('articles').upsert(data, { onConflict: 'id' });
      
      if (error) {
        console.error("Error persistiendo datos en Supabase:", error);
        alert("Error de persistencia: " + (error.message || "No se pudo guardar en la base de datos"));
        return false;
      }
      
      alert("Artículo guardado correctamente");
      return true;
    };

    const success = await saveToSupabase(articleData);

    if (success) {
      // Ensure supplier exists (case-insensitive check)
      if (articleData.supplierName) {
        const exists = suppliers.some(s => s.name.toLowerCase() === articleData.supplierName.toLowerCase());
        if (!exists) {
          const newId = `PROV-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
          await supabase.from('suppliers').insert({ id: newId, name: articleData.supplierName });
          await fetchSuppliers();
        }
      }
      await fetchArticles();
      closeArticleModal();
    }
  };

  const handleDeleteArticle = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este artículo permanentemente de la base de datos?')) {
      const { error } = await supabase.from('articles').delete().eq('id', id);
      if (error) {
        alert("Error al eliminar el artículo: " + error.message);
      } else {
        await fetchArticles();
      }
    }
  };

  const handleDeleteSupplier = async (name) => {
    const associatedArticles = articles.filter(a => (a.supplierName || '').toLowerCase() === name.toLowerCase());
    const articleCount = associatedArticles.length;

    let message = `¿Estás seguro de que deseas eliminar al proveedor "${name}"? El registro se borrará permanentemente de la base de datos.`;
    
    if (articleCount > 0) {
      const articleNames = associatedArticles.map(a => `- ${a.name}`).slice(0, 10).join('\n');
      const moreText = articleCount > 10 ? `\n...y ${articleCount - 10} artículos más.` : '';
      message = `¡ATENCIÓN! El proveedor "${name}" tiene ${articleCount} artículos asociados:\n\n${articleNames}${moreText}\n\nSi continúas, el proveedor se borrará del directorio y los artículos quedarán SIN PROVEEDOR asignado.\n\n¿Deseas proceder con la eliminación?`;
    }

    if (window.confirm(message)) {
      const { error } = await supabase.from('suppliers').delete().eq('name', name);
      if (error) {
        alert("Error al eliminar el proveedor: " + error.message);
      } else {
        // Clear supplier name from articles so they don't hold a reference to a deleted entity
        if (articleCount > 0) {
          await supabase.from('articles').update({ supplierName: '' }).eq('supplierName', name);
          await fetchArticles();
        }
        await fetchSuppliers();
      }
    }
  };

  const handleSyncSuppliers = async () => {
    // Unique names from articles (case-insensitive)
    const uniqueFromArticles = [];
    const seenArt = new Set();
    articles.forEach(a => {
      if (a.supplierName) {
        const lower = a.supplierName.toLowerCase();
        if (!seenArt.has(lower)) {
          seenArt.add(lower);
          uniqueFromArticles.push(a.supplierName);
        }
      }
    });

    const existingLower = new Set(suppliers.map(s => s.name.toLowerCase()));
    const missingSuppliers = uniqueFromArticles.filter(name => !existingLower.has(name.toLowerCase()));
    
    if (missingSuppliers.length === 0) {
      alert("El directorio de proveedores ya está sincronizado.");
      return;
    }
    
    if (window.confirm(`Se han detectado ${missingSuppliers.length} proveedores en tus artículos que no están en el directorio. ¿Deseas darlos de alta automáticamente?`)) {
      const { error } = await supabase.from('suppliers').insert(
        missingSuppliers.map(name => ({ 
          id: `PROV-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
          name: name 
        }))
      );
      
      if (error) {
        alert("Error al sincronizar proveedores: " + error.message);
      } else {
        alert("Directorio sincronizado correctamente.");
        await fetchSuppliers();
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSaveOrder = async (newOrder) => {
    const { error } = await supabase.from('orders').upsert([newOrder]);
    if (error) {
      console.error("Error saving order:", error.message);
      // Fallback for demo if table doesn't exist
      setOrders(prev => {
        const exists = prev.find(o => o.id === newOrder.id);
        if (exists) return prev.map(o => o.id === newOrder.id ? newOrder : o);
        return [newOrder, ...prev];
      });
    } else {
      await fetchOrders();
    }
  };

  const handleDeleteOrder = async (id) => {
    if (confirm('¿Estás seguro de que quieres eliminar este pedido?')) {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) {
        console.error("Error deleting order:", error.message);
        setOrders(prev => prev.filter(o => o.id !== id));
      } else {
        await fetchOrders();
      }
    }
  };

  const handleOrderReceived = async (id, receivedItems, deliveryNote) => {
    const currentOrder = orders.find(o => o.id === id);
    if (!currentOrder) return;

    // Verificar si se han recibido TODOS los artículos (comparando con las cantidades originales del pedido)
    const isFullyReceived = currentOrder.cart.every(item => 
      (receivedItems[item.article.id] || 0) >= item.quantity
    );
    
    // Verificar si se ha recibido al menos una unidad de algo en total
    const hasAnyReception = Object.values(receivedItems).some(qty => qty > 0);
    
    // Lógica de estados:
    // - Si todo está recibido -> Completado
    // - Si hay entregas parciales -> Incompleto
    // - Si no se ha recibido nada absoluto -> Pendiente (vuelve al estado original si era nuevo)
    const newStatus = isFullyReceived ? 'Completado' : (hasAnyReception ? 'Incompleto' : 'Pendiente');

    console.log(`Actualizando pedido ${id} a estado: ${newStatus}`, { isFullyReceived, hasAnyReception });

    const updatePayload = {
      status: newStatus,
      receivedMapping: receivedItems,
      deliveryNote: deliveryNote
    };

    const { error } = await supabase.from('orders').update(updatePayload).eq('id', id);

    if (error) {
      console.error("Error persistiendo estado del pedido:", error.message);
      
      // Manejo específico si falta la columna deliveryNote (error común tras actualización)
      if (error.message.includes('deliveryNote')) {
        console.warn("Reintentando actualización sin el campo 'deliveryNote'...");
        const { error: retryError } = await supabase.from('orders').update({
          status: newStatus,
          receivedMapping: receivedItems
        }).eq('id', id);
        
        if (!retryError) {
          alert("El pedido se ha guardado, pero el 'Número de Albarán' no se ha podido registrar. Por favor, solicite añadir la columna 'deliveryNote' a la tabla 'orders' en la base de datos.");
        } else {
          alert("Error crítico al actualizar el pedido: " + retryError.message);
        }
      } else {
        alert("Error al actualizar el pedido: " + error.message);
      }
    }
    
    // Refrescar siempre para asegurar sincronización UI/DB
    await fetchOrders();
    await fetchArticles(); 
  };

  const handleReopenOrder = (order) => {
    setReopeningOrder(order);
    setIsReopenModalOpen(true);
  };

  const confirmReopenOrder = async (order, reason) => {
    try {
      // 1. Revertir stock de los artículos recibidos
      if (order.receivedMapping) {
        for (const articleId in order.receivedMapping) {
          const receivedQty = order.receivedMapping[articleId];
          if (receivedQty > 0) {
            const { data: artData, error: fetchErr } = await supabase
              .from('articles')
              .select('stock')
              .eq('id', articleId)
              .single();
            
            if (!fetchErr && artData) {
              const newStock = Math.max(0, Number(artData.stock || 0) - receivedQty);
              await supabase
                .from('articles')
                .update({ stock: newStock })
                .eq('id', articleId);
            }
          }
        }
      }

      // 2. Cambiar estado del pedido y guardar motivo de la reapertura
      const { error: updateErr } = await supabase
        .from('orders')
        .update({ 
          status: 'Pendiente', 
          receivedMapping: null,
          reopen_reason: reason
        })
        .eq('id', order.id);

      if (updateErr) throw updateErr;
      
      // 3. Refrescar datos
      await fetchOrders();
      await fetchArticles();
      
      alert(`Pedido ${order.id} reabierto con éxito. Los stocks han sido actualizados.`);
    } catch (error) {
      console.error("Error al reabrir pedido:", error);
      alert("Hubo un error al intentar reabrir el pedido: " + error.message);
    }
  };

  const handleSaveSupplier = async (supplierData) => {
    const { error } = await supabase.from('suppliers').upsert([supplierData]);
    if (error) {
      console.error("Error saving supplier:", error.message);
      // Fallback
      setSuppliers(prev => {
        const exists = prev.find(s => s.id === supplierData.id);
        if (exists) return prev.map(s => s.id === supplierData.id ? supplierData : s);
        return [...prev, supplierData];
      });
    } else {
      await fetchSuppliers();
    }
  };

  const openSupplierModal = (supplier = null) => {
    setEditingSupplier(supplier);
    setIsSupplierModalOpen(true);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesStatus = orderStatusFilter === '' || order.status === orderStatusFilter;
      
      let matchesDate = true;
      if (order.date) {
        // Normalize order date for comparison (supports YYYY-MM-DD and DD/MM/YYYY)
        let orderDate;
        if (order.date.includes('-')) {
          orderDate = new Date(order.date);
        } else {
          const [d, m, y] = order.date.split('/');
          orderDate = new Date(y, m - 1, d);
        }

        if (orderDateStart) {
          const start = new Date(orderDateStart);
          start.setHours(0, 0, 0, 0);
          if (orderDate < start) matchesDate = false;
        }
        if (orderDateEnd) {
          const end = new Date(orderDateEnd);
          end.setHours(23, 59, 59, 999);
          if (orderDate > end) matchesDate = false;
        }
      }

      return matchesStatus && matchesDate;
    });
  }, [orders, orderStatusFilter, orderDateStart, orderDateEnd]);

  const totalFilteredAmount = useMemo(() => {
    return filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  }, [filteredOrders]);

  const [stockSearchQuery, setStockSearchQuery] = useState('');

  const renderContent = () => {
    switch (activeTab) {
      case 'pedidos':
        return (
          <div className="page-content">
            <div className="flex-between" style={{ marginBottom: '24px', alignItems: 'flex-start' }}>
              <div>
                <h2 className="page-title" style={{ marginBottom: '4px' }}>Gestión de Pedidos</h2>
                <div style={{ backgroundColor: 'var(--primary-light)', padding: '4px 12px', borderRadius: '4px', borderLeft: '4px solid var(--primary)', display: 'inline-block' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>
                    Total {orderStatusFilter || 'Pedidos'}: {totalFilteredAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <select 
                  className="input-field"
                  style={{ width: '180px', margin: 0 }}
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Completado">Completado</option>
                  <option value="Incompleto">Incompleto</option>
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <span>Desde:</span>
                  <input 
                    type="date" 
                    className="input-field" 
                    style={{ width: '150px', margin: 0, padding: '8px' }}
                    value={orderDateStart}
                    onChange={(e) => setOrderDateStart(e.target.value)}
                  />
                  <span>Hasta:</span>
                  <input 
                    type="date" 
                    className="input-field" 
                    style={{ width: '150px', margin: 0, padding: '8px' }}
                    value={orderDateEnd}
                    onChange={(e) => setOrderDateEnd(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary" onClick={() => {
                  setEditingOrder(null);
                  setDefaultSupplierForOrder('');
                  setIsNewOrderModalOpen(true);
                }}>
                  <Plus size={18} style={{ marginRight: '8px' }} /> Nuevo Pedido
                </button>
              </div>
            </div>
            
            <div className="card table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID Pedido</th>
                    <th>Fecha</th>
                    <th>Proveedor</th>
                    <th>Artículos</th>
                    <th>Importe Total</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(order => (
                    <tr key={order.id}>
                      <td>{order.id}</td>
                      <td>{order.date}</td>
                      <td>{order.supplier}</td>
                      <td>{order.items}</td>
                      <td style={{ fontWeight: 600 }}>{order.total ? order.total.toFixed(2) + ' €' : '-'}</td>
                      <td>
                        <span className={`badge ${
                          order.status === 'Completado' ? 'badge-success' : 
                          order.status === 'Incompleto' ? 'badge-warning' :
                          order.status === 'Pendiente' ? 'badge-info' : 'badge-danger'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-secondary" 
                            title={order.status === 'Incompleto' ? "Ver estado de recepción" : "Editar Pedido"}
                            onClick={() => {
                              if (order.status === 'Incompleto') {
                                setReceivingOrder(order);
                                setIsReceiveModalOpen(true);
                              } else {
                                setEditingOrder(order);
                                setIsNewOrderModalOpen(true);
                              }
                            }}
                            disabled={order.status === 'Completado'}
                            style={{ 
                              padding: '6px', 
                              fontSize: '0.8rem', 
                              color: order.status === 'Incompleto' ? 'var(--warning)' : 'var(--primary)',
                              display: order.status === 'Completado' ? 'none' : 'flex' 
                            }}
                          >
                            <Edit size={16} />
                          </button>

                          {(order.status === 'Completado' || order.status === 'Incompleto') && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px', fontSize: '0.8rem', color: 'var(--warning)' }}
                              title="Reabrir Pedido (Anular recepción)"
                              onClick={() => handleReopenOrder(order)}
                            >
                              <RotateCcw size={16} />
                            </button>
                          )}
                          
                          {order.status === 'Pendiente' && (
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '6px', fontSize: '0.8rem' }}
                              title="Recepcionar"
                              onClick={() => {
                                setReceivingOrder(order);
                                setIsReceiveModalOpen(true);
                              }}
                            >
                              <PackageCheck size={16} />
                            </button>
                          )}
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px', fontSize: '0.8rem', color: 'var(--danger)', border: 'none' }}
                            title="Eliminar Pedido"
                            onClick={() => handleDeleteOrder(order.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No hay pedidos registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'stocks':
        const filteredStocks = articles.filter(art => 
          art.name.toLowerCase().includes(stockSearchQuery.toLowerCase()) || 
          (art.supplierRef && art.supplierRef.toLowerCase().includes(stockSearchQuery.toLowerCase()))
        );

        return (
          <div className="page-content">
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <div>
                <h2 className="page-title">Control de Stocks</h2>
                {lastGlobalInventory && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Último inventario realizado el: <strong>{lastGlobalInventory.toLocaleDateString()}</strong> a las {lastGlobalInventory.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div className="input-group" style={{ margin: 0, width: '300px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Buscar por artículo o referencia..." 
                      style={{ paddingLeft: '40px' }} 
                      value={stockSearchQuery}
                      onChange={e => setStockSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => setIsInventoryModalOpen(true)}>
                  <ClipboardList size={18} style={{ marginRight: '8px' }} /> Hacer Inventario
                </button>
              </div>
            </div>
            
            <div className="card table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Artículo</th>
                    <th>Categoría</th>
                    <th>Stock Actual</th>
                    <th>Stock Mínimo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.map(art => {
                    const status = art.stock > art.minStock ? 'Óptimo' : 'Bajo Stock';
                    return (
                      <tr key={art.id}>
                        <td>
                          <div 
                            style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--secondary)' }} 
                            onClick={() => openArticleModal(art)}
                            onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {art.name}
                          </div>
                          {art.description && <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 500 }}>{art.description}</div>}
                        </td>
                        <td>{art.category}</td>
                        <td style={{ fontWeight: 'bold' }}>{art.stock || 0}</td>
                        <td>{art.minStock}</td>
                        <td>
                          <span className={`badge ${status === 'Óptimo' ? 'badge-success' : 'badge-danger'}`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStocks.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No se han encontrado artículos con el filtro actual.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'articulos':
        return (
          <div className="page-content">
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <h2 className="page-title">Catálogo de Artículos</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setIsExcelImporterOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={18} /> Importar Excel
                </button>
                <button className="btn btn-secondary" onClick={() => setIsInvoiceImporterOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Upload size={18} /> Importar Factura
                </button>
                <button className="btn btn-primary" onClick={() => openArticleModal()}>
                  <Plus size={18} style={{ marginRight: '8px' }} /> Nuevo Artículo
                </button>
              </div>
            </div>
            
            <div className="card" style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div className="input-group" style={{ margin: 0, flex: '1', minWidth: '250px' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Buscar por nombre o ID..." 
                    style={{ paddingLeft: '40px' }} 
                    value={articleSearch}
                    onChange={(e) => setArticleSearch(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="input-group" style={{ margin: 0, width: '200px' }}>
                <select 
                  className="input-field"
                  value={articleCategory}
                  onChange={(e) => setArticleCategory(e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ margin: 0, width: '200px' }}>
                <select 
                  className="input-field"
                  value={articleSupplier}
                  onChange={(e) => setArticleSupplier(e.target.value)}
                >
                  <option value="">Todos los proveedores</option>
                  {uniqueSuppliers.map(sup => (
                    <option key={sup} value={sup}>{sup}</option>
                  ))}
                </select>
              </div>

              {selectedArticles.length > 0 && (
                <button 
                  className="btn btn-primary" 
                  onClick={() => setIsBulkEditOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--success)' }}
                >
                  <CheckSquare size={18} /> Edición Masiva ({selectedArticles.length})
                </button>
              )}
            </div>

            <div className="card table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input 
                        type="checkbox" 
                        onChange={(e) => {
                          if (e.target.checked) setSelectedArticles(filteredArticles.map(a => a.id));
                          else setSelectedArticles([]);
                        }}
                        checked={selectedArticles.length === filteredArticles.length && filteredArticles.length > 0}
                      />
                    </th>
                    <th>Ref ID</th>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Proveedor</th>
                    <th>Ref. Prov.</th>
                    <th>Precio Est.</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArticles.length > 0 ? filteredArticles.map(art => (
                    <tr key={art.id} style={selectedArticles.includes(art.id) ? { backgroundColor: 'rgba(59, 130, 246, 0.05)' } : {}}>
                      <td>
                        <input 
                          type="checkbox" 
                          checked={selectedArticles.includes(art.id)}
                          onChange={() => {
                            setSelectedArticles(prev => 
                              prev.includes(art.id) ? prev.filter(id => id !== art.id) : [...prev, art.id]
                            );
                          }}
                        />
                      </td>
                      <td>{art.id}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{art.name}</div>
                        {art.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{art.description}</div>}
                      </td>
                      <td>{art.category}</td>
                      <td>{art.supplierName}</td>
                      <td><span style={{color: 'var(--text-muted)', fontSize: '0.9em'}}>{art.supplierRef}</span></td>
                      <td>{art.price}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px', fontSize: '0.8rem', color: 'var(--primary)' }}
                            title="Editar"
                            onClick={() => openArticleModal(art)}
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px', fontSize: '0.8rem', color: 'var(--danger)', border: 'none' }}
                            title="Eliminar"
                            onClick={() => handleDeleteArticle(art.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No se encontraron artículos que coincidan con los filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'proveedores':
        return (
          <div className="page-content">
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <h2 className="page-title">Directorio de Proveedores</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={handleSyncSuppliers} title="Busca proveedores en los artículos y los añade al directorio si faltan">
                  <RotateCcw size={18} style={{ marginRight: '8px' }} /> Sincronizar Directorio
                </button>
                <button className="btn btn-primary" onClick={() => openSupplierModal()}>
                  <Plus size={18} style={{ marginRight: '8px' }} /> Alta Proveedor
                </button>
              </div>
            </div>
            
            <div className="card table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Referencias</th>
                    <th>Contacto</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map(prov => {
                    const articleCount = supplierArticleCounts[prov.name] || 0;
                    return (
                      <tr key={prov.id}>
                        <td>{prov.id}</td>
                        <td style={{ fontWeight: '600' }}>{prov.name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${articleCount > 0 ? 'badge-info' : 'badge-secondary'}`} style={{ fontSize: '0.9rem', padding: '4px 12px' }}>
                            {articleCount}
                          </span>
                        </td>
                        <td>{prov.contact}</td>
                        <td>{prov.email}</td>
                        <td>{prov.phone}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => {
                                setDefaultSupplierForOrder(prov.name);
                                setIsNewOrderModalOpen(true);
                              }}
                            >
                              <ShoppingCart size={14} /> Nuevo Pedido
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px', fontSize: '0.8rem', color: 'var(--primary)' }}
                              title="Editar Proveedor"
                              onClick={() => openSupplierModal(prov)}
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ 
                                padding: '6px', 
                                fontSize: '0.8rem', 
                                color: 'var(--danger)',
                                border: 'none'
                              }}
                              title="Eliminar Proveedor (ver referencias asociadas)"
                              onClick={() => handleDeleteSupplier(prov.name)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'analisis':
        return (
          <Dashboard orders={orders} articles={articles} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src={logo} alt="HSLAB Logo" className="sidebar-logo" />
        </div>
        <nav className="nav-links">
          <div 
            className={`nav-item ${activeTab === 'pedidos' ? 'active' : ''}`}
            onClick={() => setActiveTab('pedidos')}
          >
            <ClipboardList size={20} style={{ marginRight: '12px' }} />
            Pedidos
          </div>
          <div 
            className={`nav-item ${activeTab === 'stocks' ? 'active' : ''}`}
            onClick={() => setActiveTab('stocks')}
          >
            <PackageSearch size={20} style={{ marginRight: '12px' }} />
            Control de Stocks
          </div>
          <div 
            className={`nav-item ${activeTab === 'articulos' ? 'active' : ''}`}
            onClick={() => setActiveTab('articulos')}
          >
            <Box size={20} style={{ marginRight: '12px' }} />
            Artículos
          </div>
          <div 
            className={`nav-item ${activeTab === 'proveedores' ? 'active' : ''}`}
            onClick={() => setActiveTab('proveedores')}
          >
            <Truck size={20} style={{ marginRight: '12px' }} />
            Proveedores
          </div>
          <div 
            className={`nav-item ${activeTab === 'analisis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analisis')}
          >
            <TrendingUp size={20} style={{ marginRight: '12px' }} />
            Análisis
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
              HSLAB / {
                activeTab === 'pedidos' ? 'Gestión de Pedidos' : 
                activeTab === 'stocks' ? 'Control de Stocks' :
                activeTab === 'articulos' ? 'Catálogo de Artículos' : 
                activeTab === 'proveedores' ? 'Directorio de Proveedores' : 
                activeTab === 'analisis' ? 'Análisis y Reportes' :
                activeTab.charAt(0).toUpperCase() + activeTab.slice(1)
              }
            </span>
          </div>
         
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)' }}>
              <Bell size={20} style={{ cursor: 'pointer' }} />
              <Settings size={20} style={{ cursor: 'pointer' }} />
            </div>
            {session && (
              <button 
                onClick={handleLogout}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Cerrar Sesión"
              >
                <LogOut size={20} />
              </button>
            )}
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1rem' }}>
              {session?.user?.email?.charAt(0).toUpperCase() || 'H'}
            </div>
          </div>
        </header>
        
        {renderContent()}
      </main>

      {/* Article Modal */}
      {isArticleModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '550px', margin: 0, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div className="flex-between" style={{ marginBottom: '32px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--secondary)' }}>
                  {editingArticle ? 'Editar Artículo' : 'Nuevo Artículo'}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Complete la información del catálogo técnico
                </p>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px', border: 'none' }} onClick={closeArticleModal}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveArticle}>
              <div className="input-group">
                <label className="input-label">Nombre del Artículo</label>
                <input type="text" name="name" className="input-field" defaultValue={editingArticle?.name || ''} required placeholder="Nombre descriptivo completo" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="input-group">
                  <label className="input-label">Descripción</label>
                  <input type="text" name="description" className="input-field" placeholder="Información técnica adicional" defaultValue={editingArticle?.description || ''} />
                </div>
                <div className="input-group">
                  <label className="input-label">Formato / Presentación</label>
                  <input type="text" name="format" className="input-field" placeholder="Ej: Bote 500g, Caja 20 placas..." defaultValue={editingArticle?.format || ''} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="input-group">
                  <label className="input-label">Categoría</label>
                  <input 
                    type="text" 
                    name="category" 
                    className="input-field" 
                    defaultValue={editingArticle?.category || ''} 
                    required 
                    list="categories-list"
                    placeholder="Escriba o elija..."
                  />
                  <datalist id="categories-list">
                    {uniqueCategories.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
                <div className="input-group">
                  <label className="input-label">Identificador (Ref ID)</label>
                  <input type="text" name="id" className="input-field" defaultValue={editingArticle?.id || ''} readOnly={!!editingArticle} required style={editingArticle ? { backgroundColor: '#F8FAFC', cursor: 'not-allowed' } : {}} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="input-group">
                  <label className="input-label">Proveedor</label>
                  <input 
                    type="text" 
                    name="supplierName" 
                    className="input-field" 
                    defaultValue={editingArticle?.supplierName || ''} 
                    required 
                    list="suppliers-list"
                    placeholder="Escriba o elija..."
                  />
                  <datalist id="suppliers-list">
                    {uniqueSuppliers.map(sup => <option key={sup} value={sup} />)}
                  </datalist>
                </div>
                <div className="input-group">
                  <label className="input-label">Ref. Proveedor</label>
                  <input type="text" name="supplierRef" className="input-field" defaultValue={editingArticle?.supplierRef || ''} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                <div className="input-group">
                  <label className="input-label">Precio Est.</label>
                  <div style={{ position: 'relative' }}>
                    <input type="text" name="price" className="input-field" defaultValue={editingArticle?.price || ''} required style={{ paddingRight: '30px' }} />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Stock Actual</label>
                  <input type="number" name="stock" className="input-field" defaultValue={editingArticle?.stock || 0} required />
                </div>
                <div className="input-group">
                  <label className="input-label">Stock Mín.</label>
                  <input type="number" name="minStock" className="input-field" defaultValue={editingArticle?.minStock || 0} required />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '40px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-secondary" onClick={closeArticleModal} style={{ padding: '10px 24px' }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 32px' }}>
                  {editingArticle ? 'Actualizar Artículo' : 'Guardar Nuevo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      <NewOrderModal 
        isOpen={isNewOrderModalOpen}
        onClose={() => {
          setIsNewOrderModalOpen(false);
          setDefaultSupplierForOrder('');
          setEditingOrder(null);
        }}
        articles={articles}
        suppliers={suppliers}
        defaultSupplier={defaultSupplierForOrder}
        onSaveOrder={handleSaveOrder}
        editingOrder={editingOrder}
      />

      <ReceiveOrderModal
        isOpen={isReceiveModalOpen}
        onClose={() => {
          setIsReceiveModalOpen(false);
          setReceivingOrder(null);
        }}
        order={receivingOrder}
        onOrderReceived={handleOrderReceived}
      />

      <ReopenOrderModal
        isOpen={isReopenModalOpen}
        onClose={() => {
          setIsReopenModalOpen(false);
          setReopeningOrder(null);
        }}
        order={reopeningOrder}
        onConfirm={confirmReopenOrder}
      />

      <ExcelImporter 
        isOpen={isExcelImporterOpen} 
        onClose={() => setIsExcelImporterOpen(false)}
        existingArticles={articles}
        onImportDone={async () => {
          await fetchArticles();
          await fetchSuppliers();
        }}
      />

      <InventoryModal
        isOpen={isInventoryModalOpen}
        onClose={() => setIsInventoryModalOpen(false)}
        articles={articles}
        onSaveInventory={() => {
          fetchArticles();
        }}
      />

      <SupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        onSave={handleSaveSupplier}
        supplier={editingSupplier}
      />

      <InvoiceImporter
        isOpen={isInvoiceImporterOpen}
        onClose={() => setIsInvoiceImporterOpen(false)}
        existingArticles={articles}
        onImportDone={fetchArticles}
      />

      {/* Bulk Edit Modal */}
      {isBulkEditOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '450px', margin: 0 }}>
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: 0 }}>Edición Masiva</h3>
              <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => setIsBulkEditOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Modificando <strong>{selectedArticles.length}</strong> artículos seleccionados.
            </p>

            <div className="input-group">
              <label className="input-label">Cambiar Categoría a:</label>
              <input 
                placeholder="Dejar vacío para no cambiar"
                className="input-field"
                list="bulk-cat-list"
                value={bulkEditFields.category}
                onChange={e => setBulkEditFields({ ...bulkEditFields, category: e.target.value })}
              />
              <datalist id="bulk-cat-list">
                {uniqueCategories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div className="input-group">
              <label className="input-label">Cambiar Proveedor a:</label>
              <input 
                placeholder="Dejar vacío para no cambiar"
                className="input-field"
                list="bulk-sup-list"
                value={bulkEditFields.supplierName}
                onChange={e => setBulkEditFields({ ...bulkEditFields, supplierName: e.target.value })}
              />
              <datalist id="bulk-sup-list">
                {uniqueSuppliers.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setIsBulkEditOpen(false)}>Cancelar</button>
              <button 
                className="btn btn-primary" 
                onClick={async () => {
                  const updates = {};
                  if (bulkEditFields.category) updates.category = bulkEditFields.category;
                  if (bulkEditFields.supplierName) updates.supplierName = bulkEditFields.supplierName;
                  
                  if (Object.keys(updates).length > 0) {
                    const { error } = await supabase.from('articles').update(updates).in('id', selectedArticles);
                    if (!error) {
                      // If supplier was changed, ensure it exists in the suppliers table
                      if (updates.supplierName) {
                        const exists = suppliers.some(s => s.name.toLowerCase() === updates.supplierName.toLowerCase());
                        if (!exists) {
                          const newId = `PROV-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
                          await supabase.from('suppliers').insert({ id: newId, name: updates.supplierName });
                          await fetchSuppliers();
                        }
                      }
                      
                      await fetchArticles();
                      setIsBulkEditOpen(false);
                      setSelectedArticles([]);
                      setBulkEditFields({ category: '', supplierName: '' });
                    }
                  }
                }}
              >
                Aplicar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
