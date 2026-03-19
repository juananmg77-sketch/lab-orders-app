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
  Check,
  ArrowUpDown,
  Minus
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




function App() {
  const [activeTab, setActiveTab] = useState('pedidos');
  const [session, setSession] = useState(null);
  
  // Orders State
  const [orders, setOrders] = useState([]);
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
  const [suppliers, setSuppliers] = useState([]);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  // Bulk Selection State
  const [selectedArticles, setSelectedArticles] = useState([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState({ category: '', supplierName: '', description: '' });

  const [isInvoiceImporterOpen, setIsInvoiceImporterOpen] = useState(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [stockSupplierFilter, setStockSupplierFilter] = useState('');
  const [selectedStockArticles, setSelectedStockArticles] = useState([]);
  const [initialCartForOrder, setInitialCartForOrder] = useState([]);
  const [generatedArticleId, setGeneratedArticleId] = useState('');
  const [articleModalSupplier, setArticleModalSupplier] = useState('');
  const [articleModalSupplierRef, setArticleModalSupplierRef] = useState('');

  const fetchArticles = async () => {
    const { data, error } = await supabase.from('articles').select('*').order('name');
    if (error) {
      console.error("Error fetching articles:", error.message);
      setArticles([]);
    } else {
      setArticles(data || []);
    }
  };

  const fetchSuppliers = async () => {
    const { data, error } = await supabase.from('suppliers').select('*').order('name');
    if (error) {
      console.error("Error fetching suppliers:", error.message);
      setSuppliers([]);
    } else {
      setSuppliers(data || []);
    }
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase.from('orders').select('*').order('date', { ascending: false });
    if (error) {
      console.error("Error fetching orders:", error.message);
      setOrders([]);
    } else {
      setOrders(data || []);
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

  const formatInEuros = (value) => {
    if (value === undefined || value === null || value === '') return '-';
    // Clean string and convert to number
    const cleanStr = String(value).replace('€', '').replace(',', '.').trim();
    const num = parseFloat(cleanStr);
    if (isNaN(num)) return value;
    return num.toLocaleString('es-ES', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }) + ' €';
  };

  const openArticleModal = (article = null) => {
    setEditingArticle(article);
    if (!article) {
      const newId = 'REF-' + Math.floor(Math.random() * 90000 + 10000);
      setGeneratedArticleId(newId);
      setArticleModalSupplier('');
      setArticleModalSupplierRef(''); // Empty until supplier is confirmed/selected
    } else {
      setGeneratedArticleId(article.id);
      setArticleModalSupplier(article.supplierName || '');
      setArticleModalSupplierRef(article.supplierRef || '');
    }
    setIsArticleModalOpen(true);
  };

  const closeArticleModal = () => {
    setEditingArticle(null);
    setIsArticleModalOpen(false);
    setGeneratedArticleId('');
    setArticleModalSupplier('');
    setArticleModalSupplierRef('');
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

  const handleQuickStockChange = async (articleId, delta) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;
    
    const newStock = Math.max(0, (article.stock || 0) + delta);
    // Optimistic UI
    setArticles(prev => prev.map(a => a.id === articleId ? { ...a, stock: newStock } : a));
    
    const { error } = await supabase.from('articles').update({ 
      stock: newStock,
      last_inventory: new Date().toISOString() 
    }).eq('id', articleId);
    
    if (error) {
       console.error("Error al actualizar stock rápido:", articleId, error);
       fetchArticles(); // Rollback
    }
  };

  const handleDeleteSupplier = async (name) => {
    const associatedArticles = articles.filter(a => (a.supplierName || '').toLowerCase() === name.toLowerCase());
    const articleCount = associatedArticles.length;

    if (articleCount > 0) {
      const articleNames = associatedArticles.map(a => `- ${a.name}`).slice(0, 5).join('\n');
      const moreText = articleCount > 5 ? `\n...y ${articleCount - 5} artículos más.` : '';
      alert(`No se puede eliminar al proveedor "${name}" porque tiene ${articleCount} artículos asociados:\n\n${articleNames}${moreText}\n\nPor favor, reasigne estos artículos a otro proveedor o elimínelos antes de borrar este proveedor.`);
      return;
    }

    if (window.confirm(`¿Estás seguro de que deseas eliminar al proveedor "${name}"? El registro se borrará permanentemente de la base de datos.`)) {
      const { error } = await supabase.from('suppliers').delete().eq('name', name);
      if (error) {
        alert("Error al eliminar el proveedor: " + error.message);
      } else {
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
      // If we are in the middle of creating an article, populate the ref once the supplier is saved
      if (isArticleModalOpen && generatedArticleId && !articleModalSupplierRef) {
        setArticleModalSupplierRef(generatedArticleId);
      }
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
  const [stockSort, setStockSort] = useState({ column: 'valuation', direction: 'desc' });

  if (!session && !window.location.hostname.includes('localhost')) {
    return <Auth />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
      case 'analisis': {
        return (
          <Dashboard 
            orders={orders} 
            articles={articles} 
            suppliers={suppliers} 
            onTabChange={setActiveTab}
            onNewOrder={() => {
              setEditingOrder(null);
              setDefaultSupplierForOrder('');
              setInitialCartForOrder([]);
              setIsNewOrderModalOpen(true);
            }}
          />
        );
      }
      case 'pedidos': {
        const totalFilteredAmount = filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0);
        return (
          <div className="page-content">
            <div className="flex-between" style={{ marginBottom: '24px', alignItems: 'flex-start' }}>
              <div>
                <h2 className="page-title" style={{ marginBottom: '4px' }}>Gestión de Pedidos</h2>
                <div style={{ backgroundColor: 'var(--primary-light)', padding: '4px 12px', borderRadius: '4px', borderLeft: '4px solid var(--primary)', display: 'inline-block' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
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
                  setInitialCartForOrder([]);
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
                      <td style={order.supplier === 'Proveedor Desconocido' ? { color: 'var(--danger)', fontWeight: 'bold' } : {}}>
                        {order.supplier}
                      </td>
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
                              fontSize: '0.75rem', 
                              color: order.status === 'Incompleto' ? 'var(--warning)' : 'var(--primary)',
                              display: order.status === 'Completado' ? 'none' : 'flex' 
                            }}
                          >
                            <Edit size={16} />
                          </button>

                          {(order.status === 'Completado' || order.status === 'Incompleto') && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px', fontSize: '0.75rem', color: 'var(--warning)' }}
                              title="Reabrir Pedido (Anular recepción)"
                              onClick={() => handleReopenOrder(order)}
                            >
                              <RotateCcw size={16} />
                            </button>
                          )}
                          
                          {order.status === 'Pendiente' && (
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '6px', fontSize: '0.75rem' }}
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
                            style={{ padding: '6px', fontSize: '0.75rem', color: 'var(--danger)', border: 'none' }}
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
      }
      case 'stocks': {
        const filteredStocks = articles.filter(art => {
          const name = (art.name || '').toLowerCase();
          const ref = (art.supplierRef || '').toLowerCase();
          const supplierName = (art.supplierName || '').toLowerCase();
          const q = stockSearchQuery.toLowerCase();
          
          const matchesSearch = name.includes(q) || ref.includes(q) || supplierName.includes(q);
          const matchesSupplier = stockSupplierFilter === '' || art.supplierName === stockSupplierFilter;
          const isLowStock = art.stock <= art.minStock;
          
          let matches = matchesSearch && matchesSupplier;
          if (showLowStockOnly) matches = matches && isLowStock;
          
          return matches;
        });

        // Sorting
        if (stockSort.column) {
          filteredStocks.sort((a, b) => {
            let valA, valB;
            if (stockSort.column === 'valuation') {
              const priceA = parseFloat(String(a.price || '0').replace('€', '').replace(',', '.').trim()) || 0;
              const priceB = parseFloat(String(b.price || '0').replace('€', '').replace(',', '.').trim()) || 0;
              valA = priceA * (a.stock || 0);
              valB = priceB * (b.stock || 0);
            } else if (stockSort.column === 'stock') {
              valA = a.stock || 0;
              valB = b.stock || 0;
            } else if (stockSort.column === 'name') {
              valA = (a.name || '').toLowerCase();
              valB = (b.name || '').toLowerCase();
            }

            if (valA < valB) return stockSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return stockSort.direction === 'asc' ? 1 : -1;
            return 0;
          });
        }

        const lowStockCount = articles.filter(a => a.stock <= a.minStock).length;

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
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', backgroundColor: showLowStockOnly ? 'var(--danger-light)' : 'rgba(0,0,0,0.03)', padding: '6px 12px', borderRadius: '8px', border: '1px solid', borderColor: showLowStockOnly ? 'var(--danger)' : 'var(--border)', transition: 'all 0.2s' }}>
                  <input 
                    type="checkbox" 
                    checked={showLowStockOnly} 
                    onChange={e => setShowLowStockOnly(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: showLowStockOnly ? 'var(--danger)' : 'var(--text)' }}>
                    {showLowStockOnly ? `Bajo Stock (${lowStockCount})` : 'Bajo Stock'}
                  </span>
                </label>
                
                <div className="input-group" style={{ margin: 0, width: '220px' }}>
                  <select 
                    className="input-field"
                    value={stockSupplierFilter}
                    onChange={(e) => setStockSupplierFilter(e.target.value)}
                  >
                    <option value="">Todos los proveedores</option>
                    {uniqueSuppliers.map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group" style={{ margin: 0, width: '250px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Buscar por nombre o ref..." 
                      style={{ paddingLeft: '40px' }} 
                      value={stockSearchQuery}
                      onChange={e => setStockSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                
                {selectedStockArticles.length > 0 && (
                  <button 
                    className="btn btn-primary" 
                    style={{ position: 'relative' }}
                    onClick={() => {
                      const selectedData = articles.filter(a => selectedStockArticles.includes(a.id));
                      const suppliers = [...new Set(selectedData.map(a => a.supplierName))];
                      
                      if (suppliers.length > 1) {
                        alert("Error: Debe realizar el pedido con un único proveedor. Por favor, seleccione artículos del mismo proveedor.");
                        return;
                      }
                      
                      const initialCart = selectedData.map(a => ({
                        article: a,
                        quantity: Math.max(1, (a.minStock || 0) - (a.stock || 0) + 5) // Sugerencia inteligente de reposición
                      }));
                      
                      setInitialCartForOrder(initialCart);
                      setDefaultSupplierForOrder(suppliers[0] || '');
                      setEditingOrder(null); // Asegurar que no estamos editando otro
                      setIsNewOrderModalOpen(true);
                      setSelectedStockArticles([]);
                      setActiveTab('pedidos'); // Ir a pedidos al abrir el modal
                    }}
                  >
                    <ShoppingCart size={18} style={{ marginRight: '8px' }} /> 
                    Crear Pedido ({selectedStockArticles.length})
                  </button>
                )}

                <button className="btn btn-primary" onClick={() => setIsInventoryModalOpen(true)}>
                  <ClipboardList size={18} style={{ marginRight: '8px' }} /> Hacer Inventario
                </button>
              </div>
            </div>
            
            <div className="card table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={filteredStocks.length > 0 && selectedStockArticles.length === filteredStocks.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStockArticles(filteredStocks.map(a => a.id));
                          } else {
                            setSelectedStockArticles([]);
                          }
                        }}
                      />
                    </th>
                    <th 
                      onClick={() => setStockSort(prev => ({ column: 'name', direction: prev.column === 'name' && prev.direction === 'desc' ? 'asc' : 'desc' }))}
                      style={{ cursor: 'pointer' }}
                    >
                      Artículo <ArrowUpDown size={12} style={{ marginLeft: '4px', opacity: stockSort.column === 'name' ? 1 : 0.3 }} />
                    </th>
                    <th>Proveedor</th>
                    <th>Ref. Prov.</th>
                    <th 
                      onClick={() => setStockSort(prev => ({ column: 'stock', direction: prev.column === 'stock' && prev.direction === 'desc' ? 'asc' : 'desc' }))}
                      style={{ cursor: 'pointer' }}
                    >
                      Stock Actual <ArrowUpDown size={12} style={{ marginLeft: '4px', opacity: stockSort.column === 'stock' ? 1 : 0.3 }} />
                    </th>
                    <th 
                      onClick={() => setStockSort(prev => ({ column: 'valuation', direction: prev.column === 'valuation' && prev.direction === 'desc' ? 'asc' : 'desc' }))}
                      style={{ cursor: 'pointer', color: 'var(--primary)' }}
                    >
                      Valoración <ArrowUpDown size={12} style={{ marginLeft: '4px', opacity: stockSort.column === 'valuation' ? 1 : 0.3 }} />
                    </th>
                    <th>Stock Mínimo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.map(art => {
                    const status = art.stock > art.minStock ? 'Óptimo' : 'Bajo Stock';
                    const isSelected = selectedStockArticles.includes(art.id);
                    return (
                      <tr key={art.id} style={{ backgroundColor: isSelected ? 'rgba(0,118,206,0.05)' : 'transparent' }}>
                        <td>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStockArticles([...selectedStockArticles, art.id]);
                              } else {
                                setSelectedStockArticles(selectedStockArticles.filter(id => id !== art.id));
                              }
                            }}
                          />
                        </td>
                        <td>
                          <div 
                            style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--secondary)' }} 
                            onClick={() => openArticleModal(art)}
                          >
                            {art.name}
                          </div>
                          {art.description && <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 500 }}>{art.description}</div>}
                        </td>
                        <td>{art.supplierName}</td>
                        <td><span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{art.supplierRef}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="number"
                            min="0"
                            className="input-field"
                            style={{ 
                              width: '65px', 
                              textAlign: 'center', 
                              padding: '4px', 
                              margin: '0 auto',
                              fontWeight: '700',
                              color: 'var(--primary)',
                              fontSize: '1rem',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              backgroundColor: 'transparent'
                            }}
                            defaultValue={art.stock || 0}
                            key={`${art.id}-${art.stock}`}
                            onBlur={(e) => {
                              const newVal = parseInt(e.target.value, 10);
                              if (!isNaN(newVal) && newVal !== (art.stock || 0)) {
                                handleQuickStockChange(art.id, newVal - (art.stock || 0));
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur();
                              }
                            }}
                          />
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                          {(() => {
                            const priceStr = art.price ? String(art.price) : '0';
                            const priceVal = parseFloat(priceStr.replace('€', '').replace(',', '.').trim()) || 0;
                            return (priceVal * (art.stock || 0)).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' €';
                          })()}
                        </td>
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
                      <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No se han encontrado artículos con el filtro actual.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      }
      case 'articulos': {
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
                        {art.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{art.description}</div>}
                      </td>
                      <td>{art.category}</td>
                      <td>{art.supplierName}</td>
                      <td><span style={{color: 'var(--text-muted)', fontSize: '0.9em'}}>{art.supplierRef}</span></td>
                      <td style={{ fontWeight: 600 }}>{formatInEuros(art.price)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px', fontSize: '0.75rem', color: 'var(--primary)' }}
                            title="Editar"
                            onClick={() => openArticleModal(art)}
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px', fontSize: '0.75rem', color: 'var(--danger)', border: 'none' }}
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
      }
      case 'proveedores': {
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
                        <td 
                          style={{ fontWeight: '600', cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline' }}
                          onClick={() => {
                            setArticleSupplier(prov.name);
                            setActiveTab('articulos');
                          }}
                          title={`Ver catálogo de ${prov.name}`}
                        >
                          {prov.name}
                        </td>
                        <td 
                          style={{ textAlign: 'center', cursor: 'pointer' }}
                          onClick={() => {
                            setArticleSupplier(prov.name);
                            setActiveTab('articulos');
                          }}
                          title={`Ver artículos de ${prov.name}`}
                        >
                          <span className={`badge ${articleCount > 0 ? 'badge-info' : 'badge-secondary'}`} style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
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
                              style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => {
                                setDefaultSupplierForOrder(prov.name);
                                setIsNewOrderModalOpen(true);
                              }}
                            >
                              <ShoppingCart size={14} /> Nuevo Pedido
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px', fontSize: '0.75rem', color: 'var(--primary)' }}
                              title="Editar Proveedor"
                              onClick={() => openSupplierModal(prov)}
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ 
                                padding: '6px', 
                                fontSize: '0.75rem', 
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
      }
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
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
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
                  <input 
                    type="text" 
                    name="id" 
                    className="input-field" 
                    defaultValue={editingArticle?.id || generatedArticleId} 
                    readOnly 
                    required 
                    style={{ backgroundColor: '#F8FAFC', cursor: 'pointer' }} 
                    onClick={() => {
                        if (!editingArticle) {
                            const newId = 'REF-' + Math.floor(Math.random() * 90000 + 10000);
                            setGeneratedArticleId(newId);
                            // We don't auto-set supplierRef here yet, wait for supplier confirmation if it's new
                        }
                    }}
                    title={!editingArticle ? "Haga clic para regenerar" : ""}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="input-group">
                  <label className="input-label">Proveedor</label>
                  <input 
                    type="text" 
                    name="supplierName" 
                    className="input-field" 
                    value={articleModalSupplier} 
                    onChange={e => setArticleModalSupplier(e.target.value)}
                    required 
                    list="suppliers-list"
                    placeholder="Escriba o elija..."
                    style={!uniqueSuppliers.some(s => s.toLowerCase() === articleModalSupplier.toLowerCase()) && articleModalSupplier.length > 2 ? { borderColor: '#EAB308', backgroundColor: 'rgba(234, 179, 8, 0.05)' } : {}}
                  />
                  <datalist id="suppliers-list">
                    {uniqueSuppliers.map(sup => <option key={sup} value={sup} />)}
                  </datalist>
                  {!uniqueSuppliers.some(s => s.toLowerCase() === articleModalSupplier.toLowerCase()) && articleModalSupplier.length > 2 && (
                    <div style={{ marginTop: '8px', padding: '10px', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid #EAB308', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: '#854d0e', fontWeight: 600 }}>
                        ¿Proveedor no dado de alta?
                      </span>
                      <button 
                        type="button" 
                        className="btn" 
                        style={{ padding: '6px 12px', fontSize: '0.75rem', backgroundColor: '#EAB308', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                        onClick={() => openSupplierModal({ name: articleModalSupplier, id: `PROV-${Math.floor(Math.random()*10000)}` })}
                      >
                        Sí, dar de alta nuevo
                      </button>
                    </div>
                  )}
                </div>
                <div className="input-group">
                  <label className="input-label">Ref. Proveedor</label>
                  <input 
                    type="text" 
                    name="supplierRef" 
                    className="input-field" 
                    value={articleModalSupplierRef} 
                    onChange={e => setArticleModalSupplierRef(e.target.value)}
                    required 
                    placeholder="Auto-completado con ID si es nuevo..."
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                <div className="input-group">
                  <label className="input-label">Precio Est.</label>
                   <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      name="price" 
                      className="input-field" 
                      defaultValue={editingArticle?.price || ''} 
                      required 
                      style={{ paddingRight: '30px' }} 
                      placeholder="0,00"
                      onBlur={(e) => {
                        const val = e.target.value.replace('€', '').replace(',', '.').trim();
                        const num = parseFloat(val);
                        if (!isNaN(num)) {
                          e.target.value = num.toLocaleString('es-ES', { minimumFractionDigits: 2 });
                        }
                      }}
                    />
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
          setInitialCartForOrder([]);
          setEditingOrder(null);
        }}
        articles={articles}
        suppliers={suppliers}
        defaultSupplierForOrder={defaultSupplierForOrder}
        initialCart={initialCartForOrder}
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
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
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
              <label className="input-label">Cambiar Descripción a:</label>
              <input 
                placeholder="Dejar vacío para no cambiar"
                className="input-field"
                value={bulkEditFields.description}
                onChange={e => setBulkEditFields({ ...bulkEditFields, description: e.target.value })}
              />
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

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '20px' }}>
              * Tip: Usa un asterisco <strong>(*)</strong> en cualquier campo para borrar su contenido actual en todos los artículos.
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '24px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={async () => {
                  if (window.confirm(`¿Estás seguro de que deseas eliminar los ${selectedArticles.length} artículos seleccionados de forma permanente?`)) {
                    const { error } = await supabase.from('articles').delete().in('id', selectedArticles);
                    if (!error) {
                      await fetchArticles();
                      setIsBulkEditOpen(false);
                      setSelectedArticles([]);
                    } else {
                      alert("Error al eliminar artículos: " + error.message);
                    }
                  }
                }}
              >
                Eliminar Selección
              </button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => {
                   setIsBulkEditOpen(false);
                   setBulkEditFields({ category: '', supplierName: '', description: '' });
                }}>Cancelar</button>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    const resolveValue = (val) => val === '*' ? '' : val;
                    const updates = {};
                    if (bulkEditFields.category) updates.category = resolveValue(bulkEditFields.category);
                    if (bulkEditFields.supplierName) updates.supplierName = resolveValue(bulkEditFields.supplierName);
                    if (bulkEditFields.description) updates.description = resolveValue(bulkEditFields.description);

                    if (Object.keys(updates).length > 0) {
                      const { error } = await supabase.from('articles').update(updates).in('id', selectedArticles);
                      if (!error) {
                        // If supplier was changed and not cleared, ensure it exists in the suppliers table
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
                        setBulkEditFields({ category: '', supplierName: '', description: '' });
                      }
                    }
                  }}
                >
                  Aplicar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
