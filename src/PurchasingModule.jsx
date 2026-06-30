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
  Menu,
  ShoppingCart,
  PackageCheck,
  Trash2,
  Edit,
  RotateCcw,
  FileText,
  Upload,
  TrendingUp,
  CheckSquare,
  Check,
  ArrowUpDown,
  Minus,
  AlertTriangle,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Clock,
  MapPin,
  Phone,
  Mail,
  Globe,
  User,
  Building2,
  StickyNote,
  Layers,
  CalendarClock,
  PlusCircle,
  FilterX,
  ChevronRight,
  ChevronDown,
  History,
  ExternalLink,
  Package,
  FlaskConical,
  Link2,
  ClipboardCheck
} from 'lucide-react';

// Categorías que requieren número de lote obligatorio
const LOT_REQUIRED_CATEGORIES = ['Reactivos Químicos', 'Cepas de Referencia', 'Medios de Cultivo', 'Kits Rápidos'];

const PRODUCTION_MEDIA = [
  { code:'PCA',    name:'Plate Count Agar',           qty_g_per_l:23.5, color:'#2563eb',
    base_articles:['LAB-FFZA1Q','REF-31212'],
    supplement: null },
  { code:'MP',     name:'Mug Plus',                   qty_g_per_l:26.5, color:'#7c3aed',
    base_articles:['LAB-KOYN50'],
    supplement:{ description:'Antibiótico (Cefsulodina)', articles:['LAB-041'], qty:'5', unit:'mL' } },
  { code:'BP',     name:'Baird-Parker',               qty_g_per_l:63,   color:'#b45309',
    base_articles:['REF-94894'],
    supplement:{ description:'Egg Yolk Tellurite', articles:['CNR-5129','LAB-ZS8O8M'], qty:'50', unit:'mL' } },
  { code:'CT',     name:'Cetrimida',                  qty_g_per_l:45.3, color:'#0f766e',
    base_articles:['LAB-640T1J','REF-88036'],
    supplement:{ description:'Glicerol', articles:[], qty:'10', unit:'mL' } },
  { code:'VRBG',   name:'Violet Red Bile Glucose',    qty_g_per_l:41.5, color:'#be123c',
    base_articles:['REF-53682','LAB-A4OTMD'],
    supplement: null },
  { code:'RINGER', name:'Solución Ringer',            qty_g_per_l:null, color:'#0369a1',
    base_articles:['LAB-UHXG3O'],
    supplement: null },
  { code:'PEP',    name:'Agua de Peptona (Madre)',    qty_g_per_l:20,   color:'#4d7c0f',
    base_articles:['LAB-F0UX3M','REF-74605'],
    supplement: null },
  { code:'TSA',    name:'Tryptic Soy Agar',           qty_g_per_l:40,   color:'#6b7280',
    base_articles:[],
    supplement: null },
  { code:'SDCA',   name:'Sabouraud + Cloranfenicol',  qty_g_per_l:65,   color:'#9333ea',
    base_articles:['REF-37079','LAB-DPKPFN'],
    supplement: null },
  { code:'SB',     name:'Sabouraud base',             qty_g_per_l:41.5, color:'#c2410c',
    base_articles:['REF-37079','LAB-DPKPFN'],
    supplement: null },
  // Medios comerciales Legionella — apertura de kit, no preparación
  { code:'BCYE',      name:'BCYE con L-Cisteína',          qty_g_per_l:null, color:'#1a1a1a', commercial:true,
    base_articles:['LAB-BZOB4M'], supplement: null },
  { code:'BCYE-Cys',  name:'BCYE sin Cisteína',            qty_g_per_l:null, color:'#1a1a1a', commercial:true,
    base_articles:['LAB-076'], supplement: null },
  { code:'GVPC',      name:'GVPC Selectivo Legionella',   qty_g_per_l:null, color:'#7c3aed', commercial:true,
    base_articles:['LAB-077'], supplement: null },
  { code:'ÁCIDO',     name:'Ácido Buffer Legionella',     qty_g_per_l:null, color:'#dc2626', commercial:true,
    base_articles:['LAB-082'], supplement: null },
  { code:'SAL',       name:'Brilliance Salmonella Agar', qty_g_per_l:null, color:'#ea580c', commercial:true,
    base_articles:['LAB-075'], supplement: null },
  { code:'LIS',       name:'Brilliance Listeria Agar',   qty_g_per_l:null, color:'#16a34a', commercial:true,
    base_articles:['LAB-074'], supplement: null },
  { code:'LATEX',     name:'Legionella Latex Test KIT 3', qty_g_per_l:null, color:'#b45309', commercial:true,
    base_articles:['LAB-080'], supplement: null },
];

const emptyProdIngredient = (role='base') => ({ article_lot_id:'', article_id:'', lot_number_ref:'', description:'', quantity_used:'', unit:'g', role });
const emptyProdForm = () => ({
  lot_number:'', preparation_date: new Date().toISOString().slice(0,10),
  medium_code:'', medium_name:'', quantity_g:'', quantity_l:'',
  responsible:'', expiry_date:'',
  base_lot_id:'', base_lot_ref:'',
  supp_lot_id:'', supp_lot_ref:'', supp_qty:'',
  date_start:'', date_end:'',
});
import { supabase } from './supabaseClient';
import Auth from './Auth';
import NewOrderModal from './NewOrderModal';
import ReceiveOrderModal from './ReceiveOrderModal';
import InventoryModal from './InventoryModal';
import SupplierModal from './SupplierModal';
import SupplierEvalModal from './SupplierEvalModal';
import SupplierDocsModal from './SupplierDocsModal';
import ReopenOrderModal from './ReopenOrderModal';
import AmendmentReasonModal from './AmendmentReasonModal';
import AmendmentHistoryModal from './AmendmentHistoryModal';
import InvoiceImporter from './InvoiceImporter';
import Dashboard from './Dashboard';
import ViewOrderModal from './ViewOrderModal';
import logo from './assets/logo.png';




function PurchasingModule({ session, onLogout, globalLab, onBackToHub, role = 'operations', canApprove = true, onSelectModule, onRegisterEquipment, initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'pedidos');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const selectedLab = globalLab;
  
  // Orders State
  const [orders, setOrders] = useState([]);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [defaultSupplierForOrder, setDefaultSupplierForOrder] = useState('');
  
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [pendingEquipmentData, setPendingEquipmentData] = useState(null); // Pre-fill data for new equipment

  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);

  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopeningOrder, setReopeningOrder] = useState(null);

  // Amendment (enmienda) flow state
  const [amendmentModal, setAmendmentModal]     = useState(null); // { title, recordLabel, previousValues, tableName, recordId, pendingAction }
  const pendingAmendmentRef                     = React.useRef(null); // useRef to avoid stale closure in save functions
  const [amendmentSaving, setAmendmentSaving]   = useState(false);
  const [amendmentHistory, setAmendmentHistory] = useState(null); // { tableName, recordId, recordLabel }
  const [lotAmendBy, setLotAmendBy]             = useState('');
  const [lotAmendReason, setLotAmendReason]     = useState('');

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);

  // Orders Filter State
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderDateStart, setOrderDateStart] = useState('');
  const [orderDateEnd, setOrderDateEnd] = useState('');
  const [orderMonthFilter, setOrderMonthFilter] = useState('');

  // Articles state
  const [articles, setArticles] = useState([]);
  const [articleSearch, setArticleSearch] = useState('');
  const [articleCategory, setArticleCategory] = useState('');
  const [articleSupplier, setArticleSupplier] = useState('');
  const [articleAnalysisFilter, setArticleAnalysisFilter] = useState('');
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);

  // Suppliers state
  const [suppliers, setSuppliers] = useState([]);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [evalModalSupplier, setEvalModalSupplier] = useState(null);
  const [docsModalSupplier, setDocsModalSupplier] = useState(null);
  const [supplierLastEvals, setSupplierLastEvals] = useState({});
  const [supplierDocCounts, setSupplierDocCounts] = useState({});

  // Bulk Selection State
  const [selectedArticles, setSelectedArticles] = useState([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState({ category: '', supplierName: '', description: '' });

  const [isInvoiceImporterOpen, setIsInvoiceImporterOpen] = useState(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [stockSupplierFilter, setStockSupplierFilter] = useState('');
  const [stockCategoryFilter, setStockCategoryFilter] = useState('');
  const [stockAnalysisFilter, setStockAnalysisFilter] = useState('');
  const [selectedStockArticles, setSelectedStockArticles] = useState([]);
  const [initialCartForOrder, setInitialCartForOrder] = useState([]);
  const [generatedArticleId, setGeneratedArticleId] = useState('');
  const [articleModalSupplier, setArticleModalSupplier] = useState('');
  const [articleModalSupplierRef, setArticleModalSupplierRef] = useState('');
  const [modalRequiresLot, setModalRequiresLot] = useState(false);

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
    if (error) { console.error("Error fetching suppliers:", error.message); setSuppliers([]); }
    else { setSuppliers(data || []); }
    // Cargar última evaluación por proveedor
    const { data: evals } = await supabase
      .from('supplier_evaluations')
      .select('supplier_id, overall_score, result, evaluation_date')
      .order('evaluation_date', { ascending: false });
    if (evals) {
      const map = {};
      evals.forEach(e => { if (!map[e.supplier_id]) map[e.supplier_id] = e; });
      setSupplierLastEvals(map);
    }
    // Contar documentos por proveedor
    const { data: docs } = await supabase
      .from('supplier_documents')
      .select('supplier_id');
    if (docs) {
      const countMap = {};
      docs.forEach(d => { countMap[d.supplier_id] = (countMap[d.supplier_id] || 0) + 1; });
      setSupplierDocCounts(countMap);
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

  // Monthly budgets: { 'YYYY-MM': number }
  const [monthlyBudgets, setMonthlyBudgets] = useState({});

  const fetchBudgets = async () => {
    const { data, error } = await supabase.from('monthly_budgets').select('*').eq('lab', selectedLab);
    if (!error && data) {
      const map = {};
      data.forEach(row => { map[row.month] = row.budget; });
      setMonthlyBudgets(map);
    }
  };

  const handleSaveBudget = async (month, value) => {
    const budget = Number(value) || 0;
    const { error } = await supabase.from('monthly_budgets').upsert([{ month, lab: selectedLab, budget }]);
    if (!error) {
      setMonthlyBudgets(prev => ({ ...prev, [month]: budget }));
    } else {
      console.error('Error saving budget:', error.message);
    }
  };

  // Helper: update per-lab stock in stock_labs JSONB
  const updateLabStock = async (articleId, newStock) => {
    const art = articles.find(a => a.id === articleId);
    const currentLabs = art?.stock_labs || {};
    const newLabs = { ...currentLabs, [selectedLab]: newStock };
    return supabase.from('articles').update({
      stock_labs: newLabs,
      last_inventory: new Date().toISOString()
    }).eq('id', articleId);
  };

  // Shared catalog: all articles with lab='ALL', stock injected per-lab
  const labArticles = useMemo(() =>
    articles
      .filter(a => a.lab === 'ALL' || a.lab === selectedLab)
      .map(a => ({
        ...a,
        stock:    (a.stock_labs    || {})[selectedLab] ?? 0,
        minStock: (a.min_stock_labs || {})[selectedLab] ?? (a.minStock || 0),
      })),
  [articles, selectedLab]);
  const labOrders = useMemo(() => orders.filter(o => (o.lab || 'HSLAB Baleares') === selectedLab), [orders, selectedLab]);
  const labSuppliers = useMemo(() => suppliers.filter(s => (s.lab || 'HSLAB Baleares') === selectedLab), [suppliers, selectedLab]);

  const filteredArticles = useMemo(() => {
    return labArticles.filter(art => {
      if (!art) return false;
      if (!(selectedLab in (art.stock_labs || {}))) return false;
      const name = art.name || '';
      const id = art.id || '';
      const category = art.category || '';
      const supplierName = art.supplierName || '';

      const matchesSearch = name.toLowerCase().includes(articleSearch.toLowerCase()) ||
                            id.toLowerCase().includes(articleSearch.toLowerCase());
      const matchesCategory = articleCategory === '' || category === articleCategory;
      const matchesSupplier = articleSupplier === '' || supplierName === articleSupplier;
      const matchesAnalysis = articleAnalysisFilter === ''
        ? true
        : articleAnalysisFilter === '__unassigned__'
          ? !art.analysis_type
          : art.analysis_type === articleAnalysisFilter;

      return matchesSearch && matchesCategory && matchesSupplier && matchesAnalysis;
    });
  }, [articleSearch, articleCategory, articleSupplier, articleAnalysisFilter, labArticles]);

  const labRegisteredArticles = useMemo(() =>
    labArticles.filter(a => a && (selectedLab in (a.stock_labs || {}))),
  [labArticles, selectedLab]);

  const uniqueCategories = useMemo(() => [...new Set(labRegisteredArticles.filter(a => a.category).map(a => a.category))], [labRegisteredArticles]);
  const uniqueSuppliers = useMemo(() => {
    const allNames = [
      ...labRegisteredArticles.filter(a => a.supplierName).map(a => a.supplierName),
      ...labSuppliers.map(s => s.name)
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
  }, [labArticles, labSuppliers]);

  const supplierArticleCounts = useMemo(() => {
    const counts = {};
    const supplierMap = {};
    // Map lowercase name to the preferred display name from suppliers table
    labSuppliers.forEach(s => supplierMap[s.name.toLowerCase()] = s.name);

    labRegisteredArticles.forEach(a => {
      if (a.supplierName) {
        const lowerName = a.supplierName.toLowerCase();
        const displayName = supplierMap[lowerName] || a.supplierName;
        counts[displayName] = (counts[displayName] || 0) + 1;
      }
    });
    return counts;
  }, [labArticles, labSuppliers]);

  const lastGlobalInventory = useMemo(() => {
    const dates = labArticles.filter(a => a.last_inventory).map(a => new Date(a.last_inventory).getTime());
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates));
  }, [labArticles]);

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
      setArticleModalSupplierRef('');
      setModalRequiresLot(false);
    } else {
      setGeneratedArticleId(article.id);
      setArticleModalSupplier(article.supplierName || '');
      setArticleModalSupplierRef(article.supplierRef || '');
      setModalRequiresLot(!!article.requires_lot);
    }
    setIsArticleModalOpen(true);
  };

  const closeArticleModal = () => {
    setEditingArticle(null);
    setIsArticleModalOpen(false);
    setGeneratedArticleId('');
    setArticleModalSupplier('');
    setArticleModalSupplierRef('');
    setModalRequiresLot(false);
  };

  useEffect(() => {
    fetchArticles();
    fetchSuppliers();
    fetchOrders();
    fetchBudgets();
  }, [session, globalLab]);

  useEffect(() => {
    if (activeTab === 'trazabilidad') loadLots();
    if (activeTab === 'produccion') loadProductionLots();
  }, [activeTab, selectedLab]);



  const handleQuickCreateArticle = async (articleData) => {
    const newId = `ART-${Date.now().toString().slice(-6)}`;
    const minSt = articleData.minStock || 1;
    const data = {
      id: newId,
      name: (articleData.name || '').toUpperCase(),
      category: articleData.category,
      supplierName: articleData.supplierName || '',
      supplierRef: articleData.supplierRef || '',
      price: articleData.price || '',
      stock: 0, minStock: minSt,
      stock_labs: { [selectedLab]: 0 },
      min_stock_labs: { [selectedLab]: minSt },
      description: '', format: '',
      lab: 'ALL'
    };
    const { error } = await supabase.from('articles').insert([data]);
    if (error) { alert('Error creando artículo: ' + error.message); return null; }
    await fetchArticles();
    return data;
  };

  const handleSaveArticle = async (e) => {
    e.preventDefault();
    const form = e.target;
    
    const articleData = {
      id: form.elements.id.value,
      name: (form.elements.name.value || '').toUpperCase(),
      description: form.elements.description.value,
      format: form.elements.format.value,
      category: form.elements.category.value,
      analysis_type: form.elements.analysis_type.value || null,
      supplierName: form.elements.supplierName.value,
      supplierRef: form.elements.supplierRef.value,
      price: form.elements.price.value,
      stock: parseInt(form.elements.stock.value, 10),
      minStock: parseInt(form.elements.minStock.value, 10),
      last_inventory: editingArticle?.last_inventory || null,
      lab: 'ALL',
      stock_labs: {
        ...(editingArticle?.stock_labs || {}),
        [selectedLab]: parseInt(form.elements.stock.value, 10)
      },
      min_stock_labs: {
        ...(editingArticle?.min_stock_labs || {}),
        [selectedLab]: parseInt(form.elements.minStock.value, 10)
      },
      requires_lot: modalRequiresLot,
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
        const exists = labSuppliers.some(s => s.name.toLowerCase() === articleData.supplierName.toLowerCase());
        if (!exists) {
          const newId = `PROV-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
          await supabase.from('suppliers').insert({ id: newId, name: articleData.supplierName, lab: selectedLab });
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
    const currentStock = (article.stock_labs || {})[selectedLab] ?? 0;
    const newStock = Math.max(0, currentStock + delta);
    // Optimistic UI
    setArticles(prev => prev.map(a => a.id === articleId
      ? { ...a, stock_labs: { ...(a.stock_labs || {}), [selectedLab]: newStock } }
      : a));
    const { error } = await updateLabStock(articleId, newStock);
    if (error) { console.error("Error al actualizar stock rápido:", error); fetchArticles(); }
  };

  const handleDeleteSupplier = async (name) => {
    const associatedArticles = labArticles.filter(a => (a.supplierName || '').toLowerCase() === name.toLowerCase());
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


  const handleLogout = async () => {
    if (onLogout) onLogout();
  };

  const handleSaveOrder = async (newOrder) => {
    const orderWithLab = { ...newOrder, lab: selectedLab };
    // Optimistic unroll
    const { error } = await supabase.from('orders').upsert([orderWithLab]);
    if (error) {
      console.error("Error saving order:", error.message);
      // Fallback for demo if table doesn't exist
      setOrders(prev => {
        const exists = prev.find(o => o.id === orderWithLab.id);
        if (exists) return prev.map(o => o.id === orderWithLab.id ? orderWithLab : o);
        return [orderWithLab, ...prev];
      });
    } else {
      await fetchOrders();
    }
  };

  const handleDeleteOrder = async (id) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const wasReceived = order.receivedMapping && Object.values(order.receivedMapping).some(q => q > 0);
    const msg = wasReceived
      ? `¿Eliminar el pedido ${id}?\n\nEste pedido fue recibido. Se revertirá el stock y se eliminarán los registros de trazabilidad asociados.`
      : `¿Estás seguro de que quieres eliminar este pedido?`;

    if (!confirm(msg)) return;

    try {
      // 1. Revertir stock si el pedido fue (total o parcialmente) recibido
      if (wasReceived) {
        for (const articleId in order.receivedMapping) {
          const receivedQty = order.receivedMapping[articleId];
          if (receivedQty > 0) {
            const { data: artData, error: fetchErr } = await supabase
              .from('articles').select('stock_labs').eq('id', articleId).single();
            if (!fetchErr && artData) {
              const currentStock = (artData.stock_labs || {})[selectedLab] ?? 0;
              const newStock = Math.max(0, currentStock - receivedQty);
              const newLabs = { ...(artData.stock_labs || {}), [selectedLab]: newStock };
              await supabase.from('articles').update({ stock_labs: newLabs }).eq('id', articleId);
            }
          }
        }
      }

      // 2. Eliminar registros de trazabilidad asociados
      await supabase.from('article_lots').delete().eq('order_id', id);

      // 3. Eliminar el pedido
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;

      await fetchOrders();
      await fetchArticles();
    } catch (err) {
      console.error('Error al eliminar pedido:', err.message);
      alert('Error al eliminar el pedido: ' + err.message);
    }
  };

  const handleOrderReceived = async (id, receivedItems, deliveryNote, incidents = '') => {
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
      deliveryNote: deliveryNote,
      incidents: incidents
    };

    const { error } = await supabase.from('orders').update(updatePayload).eq('id', id);

    if (error) {
      console.error("Error persistiendo estado del pedido:", error.message);
      
      // Manejo específico si faltan columnas (error común tras actualización de la lógica sin migración de DB)
      if (error.message.includes('deliveryNote') || error.message.includes('incidents')) {
        console.warn("Reintentando actualización sin campos posiblemente faltantes...");
        
        // Intentar un guardado "seguro" con solo campos básicos si fallan los extendidos
        const safePayload = {
          status: newStatus,
          receivedMapping: receivedItems
        };
        
        const { error: retryError } = await supabase.from('orders').update(safePayload).eq('id', id);
        
        if (!retryError) {
          alert(`El pedido se ha guardado, pero algunos campos (Albarán: ${deliveryNote ? 'SI' : 'NO'}, Incidencias: ${incidents ? 'SI' : 'NO'}) no se han podido registrar en la base de datos por falta de columnas.`);
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

  const confirmReopenOrder = async (order, reason, amendedBy) => {
    try {
      // 1. Registrar enmienda ISO 17025 solo para pedidos Completados
      if (order.status === 'Completado' && amendedBy) {
        await supabase.from('record_amendments').insert([{
          table_name: 'orders',
          record_id: String(order.id),
          record_label: `Pedido ${order.id}`,
          reason,
          amended_by: amendedBy,
          previous_values: {
            status: order.status,
            approved_by: order.approved_by ?? null,
            approval_date: order.approval_date ?? null,
          },
          new_values: null,
        }]);
      }

      // 2. Revertir stock de los artículos recibidos
      if (order.receivedMapping) {
        for (const articleId in order.receivedMapping) {
          const receivedQty = order.receivedMapping[articleId];
          if (receivedQty > 0) {
            const { data: artData, error: fetchErr } = await supabase
              .from('articles').select('stock_labs').eq('id', articleId).single();
            if (!fetchErr && artData) {
              const currentStock = (artData.stock_labs || {})[selectedLab] ?? 0;
              const newStock = Math.max(0, currentStock - receivedQty);
              const newLabs = { ...(artData.stock_labs || {}), [selectedLab]: newStock };
              await supabase.from('articles').update({ stock_labs: newLabs }).eq('id', articleId);
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

  const ADMIN_EMAIL = 'jamunoz@hsconsulting.es';

  const handleApproveOrder = async (order) => {
    const approverEmail = session?.user?.email || ADMIN_EMAIL;
    const now = new Date().toLocaleDateString();
    const { error } = await supabase.from('orders').update({
      status: 'Pendiente',
      approved_by: approverEmail,
      approval_date: now
    }).eq('id', order.id);
    if (error) {
      alert('Error al aprobar el pedido: ' + error.message);
    } else {
      await fetchOrders();
    }
  };

  const handleRejectOrder = async (order) => {
    const reason = prompt(`Indique el motivo del rechazo del pedido ${order.id}:`);
    if (reason === null) return; // cancelled
    const { error } = await supabase.from('orders').update({
      status: 'Rechazado',
      rejection_reason: reason || 'Sin motivo especificado'
    }).eq('id', order.id);
    if (error) {
      alert('Error al rechazar el pedido: ' + error.message);
    } else {
      await fetchOrders();
    }
  };

  const handleSaveSupplier = async (supplierData) => {
    const dataWithLab = { ...supplierData, lab: supplierData.lab || selectedLab };
    const { error } = await supabase.from('suppliers').upsert([dataWithLab]);
    if (error) {
      console.error("Error saving supplier:", error.message);
      // Fallback
      setSuppliers(prev => {
        const exists = prev.find(s => s.id === dataWithLab.id);
        if (exists) return prev.map(s => s.id === dataWithLab.id ? dataWithLab : s);
        return [...prev, dataWithLab];
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

  // Available months derived from existing orders (for the month selector)
  const availableMonths = useMemo(() => {
    const seen = new Set();
    labOrders.forEach(order => {
      if (!order.date) return;
      let d;
      if (order.date.includes('-')) {
        d = new Date(order.date);
      } else {
        const [day, m, y] = order.date.split('/');
        d = new Date(y, m - 1, day);
      }
      if (!isNaN(d)) seen.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return [...seen].sort((a, b) => b.localeCompare(a)); // most recent first
  }, [labOrders]);

  const filteredOrders = useMemo(() => {
    return labOrders.filter(order => {
      const matchesStatus = orderStatusFilter === '' || order.status === orderStatusFilter;

      let matchesDate = true;
      if (order.date) {
        // Normalize order date (supports YYYY-MM-DD and DD/MM/YYYY)
        let orderDate;
        if (order.date.includes('-')) {
          orderDate = new Date(order.date);
        } else {
          const [d, m, y] = order.date.split('/');
          orderDate = new Date(y, m - 1, d);
        }

        if (orderMonthFilter) {
          // Month filter takes priority: match year-month
          const [fy, fm] = orderMonthFilter.split('-').map(Number);
          if (orderDate.getFullYear() !== fy || orderDate.getMonth() + 1 !== fm) {
            matchesDate = false;
          }
        } else {
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
      }

      return matchesStatus && matchesDate;
    }).sort((a, b) => {
      const parseDate = d => {
        if (!d) return 0;
        if (d.includes('-')) return new Date(d).getTime();
        const [dd, mm, yy] = d.split('/');
        return new Date(yy, mm - 1, dd).getTime();
      };
      return parseDate(a.date) - parseDate(b.date);
    });
  }, [labOrders, orderStatusFilter, orderDateStart, orderDateEnd, orderMonthFilter]);

  const totalFilteredAmount = useMemo(() => {
    return filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  }, [filteredOrders]);

  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockSort, setStockSort] = useState({ column: 'valuation', direction: 'desc' });

  // ── Trazabilidad de Lotes ──────────────────────────────────────────────────
  const [lots, setLots] = useState([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [lotFilterSearch, setLotFilterSearch] = useState('');
  const [lotFilterCategory, setLotFilterCategory] = useState('');
  const [lotFilterLot, setLotFilterLot] = useState('');
  const [lotFilterSupplier, setLotFilterSupplier] = useState('Thermo Fisher');
  const [lotFilterFrom, setLotFilterFrom] = useState('');
  const [lotFilterTo, setLotFilterTo] = useState('');
  const [expandedArticles, setExpandedArticles] = useState(new Set());
  const [inlineEdit, setInlineEdit] = useState(null); // { id, lot_number, expiry_date }
  const [savingInline, setSavingInline] = useState(false);
  const [viewOrderFromLot, setViewOrderFromLot] = useState(null); // order object
  const [loadingOrderModal, setLoadingOrderModal] = useState(false);

  // Producción de medios
  const [productionLots, setProductionLots] = useState([]);
  const [productionLoading, setProductionLoading] = useState(false);
  const [prodView, setProdView] = useState('list'); // 'list' | 'form'
  const [editingProd, setEditingProd] = useState(null);
  const [prodForm, setProdForm] = useState(emptyProdForm());
  const [savingProd, setSavingProd] = useState(false);
  const [recentArticleLots, setRecentArticleLots] = useState([]);
  const [commercialLots, setCommercialLots] = useState([]);
  const [prodFilterSearch, setProdFilterSearch] = useState('');
  const [prodFilterMedium, setProdFilterMedium] = useState('');
  const [prodFilterFrom, setProdFilterFrom] = useState('');
  const [prodFilterTo, setProdFilterTo] = useState('');
  const [prodHideInactive, setProdHideInactive] = useState(true);
  const [inlineProdDate, setInlineProdDate] = useState(null); // { id, date_start, date_end }
  const [savingProdDate, setSavingProdDate] = useState(false);
  const [showLotForm, setShowLotForm] = useState(false);
  const [editingLot, setEditingLot] = useState(null);
  const [lotForm, setLotForm] = useState({
    article_id: '', lot_number: '', expiry_date: '',
    reception_date: new Date().toISOString().slice(0, 10),
    quantity: '', received_by: '', notes: '', orden_ref: ''
  });
  const [savingLot, setSavingLot] = useState(false);

  const loadLots = async () => {
    setLotsLoading(true);
    const { data } = await supabase
      .from('article_lots')
      .select('*, articles(name, category, requires_lot, supplierName)')
      .eq('lab', selectedLab)
      .order('reception_date', { ascending: false });
    setLots(data || []);
    setLotsLoading(false);
  };

  const saveLot = async () => {
    if (!lotForm.article_id || !lotForm.lot_number || !lotForm.reception_date) {
      alert('Referencia, Nº Lote y Fecha de Entrada son obligatorios.');
      return;
    }
    const expiryChanged = editingLot && (lotForm.expiry_date || null) !== (editingLot.expiry_date || null);
    if (expiryChanged && (!lotAmendBy.trim() || !lotAmendReason.trim())) {
      alert('La fecha de caducidad ha cambiado. Debes indicar el nombre y el motivo de la modificación.');
      return;
    }
    setSavingLot(true);
    const payload = {
      article_id: lotForm.article_id,
      lot_number: lotForm.lot_number,
      expiry_date: lotForm.expiry_date || null,
      reception_date: lotForm.reception_date,
      quantity: lotForm.quantity ? Number(lotForm.quantity) : null,
      received_by: lotForm.received_by || null,
      notes: lotForm.notes || null,
      origen: 'manual',
      lab: selectedLab,
    };
    if (editingLot) {
      const { error } = await supabase.from('article_lots').update(payload).eq('id', editingLot.id);
      if (error) { alert(`Error: ${error.message}`); setSavingLot(false); return; }
      if (expiryChanged) {
        await supabase.from('record_amendments').insert([{
          table_name:      'article_lots',
          record_id:       String(editingLot.id),
          record_label:    editingLot.lot_number,
          reason:          lotAmendReason.trim(),
          amended_by:      lotAmendBy.trim(),
          previous_values: { expiry_date: editingLot.expiry_date ?? null },
          new_values:      { expiry_date: payload.expiry_date ?? null },
        }]);
      }
    } else {
      const { error } = await supabase.from('article_lots').insert([payload]);
      if (error) { alert(`Error: ${error.message}`); setSavingLot(false); return; }
    }
    setSavingLot(false);
    setShowLotForm(false);
    setEditingLot(null);
    setLotAmendBy('');
    setLotAmendReason('');
    setLotForm({ article_id: '', lot_number: '', expiry_date: '', reception_date: new Date().toISOString().slice(0, 10), quantity: '', received_by: '', notes: '', orden_ref: '' });
    loadLots();
  };

  const deleteLot = async (id) => {
    if (!confirm('¿Eliminar este registro de lote?')) return;
    await supabase.from('article_lots').delete().eq('id', id);
    loadLots();
  };

  const saveInlineLot = async () => {
    if (!inlineEdit?.lot_number?.trim()) {
      alert('El número de lote es obligatorio.');
      return;
    }
    setSavingInline(true);
    const { error } = await supabase.from('article_lots')
      .update({ lot_number: inlineEdit.lot_number.trim(), expiry_date: inlineEdit.expiry_date || null })
      .eq('id', inlineEdit.id);
    setSavingInline(false);
    if (error) { alert('Error al guardar: ' + error.message); return; }
    setInlineEdit(null);
    loadLots();
  };

  // ── Producción de medios ────────────────────────────────────────
  const loadProductionLots = async () => {
    setProductionLoading(true);
    const { data } = await supabase
      .from('production_lots')
      .select('*, production_lot_ingredients(*, article_lots(lot_number, reception_date, articles(name, category)))')
      .eq('lab', selectedLab)
      .order('preparation_date', { ascending: false });
    setProductionLots(data || []);
    setProductionLoading(false);
  };

  const loadRecentArticleLots = async () => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 180);
    const { data } = await supabase
      .from('article_lots')
      .select('id, lot_number, reception_date, article_id, articles(name, category)')
      .eq('lab', selectedLab)
      .neq('lot_number', 'PENDIENTE')
      .gte('reception_date', cutoff.toISOString().slice(0, 10))
      .order('reception_date', { ascending: false });
    setRecentArticleLots(data || []);
  };

  const autoLotNumber = (date) => {
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const prefix = `${dd}${mm}`;
    const existing = productionLots.filter(p => p.lot_number.startsWith(prefix));
    return `${prefix}-${existing.length + 1}`;
  };

  const loadCommercialLots = async (articleIds) => {
    if (!articleIds?.length) { setCommercialLots([]); return; }
    const { data } = await supabase
      .from('article_lots')
      .select('id, lot_number, reception_date, expiry_date, article_id, articles(name)')
      .eq('lab', selectedLab)
      .in('article_id', articleIds)
      .neq('lot_number', 'PENDIENTE')
      .order('reception_date', { ascending: false })
      .limit(3);
    setCommercialLots(data || []);
  };

  // ── Amendment helpers ────────────────────────────────────────────
  const startAmendment = async (reason, amendedBy) => {
    if (!amendmentModal) return;
    setAmendmentSaving(true);
    const { data, error } = await supabase.from('record_amendments').insert([{
      table_name:      amendmentModal.tableName,
      record_id:       String(amendmentModal.recordId),
      record_label:    amendmentModal.recordLabel,
      reason,
      amended_by:      amendedBy,
      previous_values: amendmentModal.previousValues,
      new_values:      null,
    }]).select().single();
    if (error) { console.error('Amendment insert error:', error); }
    pendingAmendmentRef.current = data?.id || null;
    setAmendmentSaving(false);
    const action = amendmentModal.pendingAction;
    setAmendmentModal(null);
    action && action();
  };

  const closeAmendmentWithNewValues = async (newValues) => {
    const amendId = pendingAmendmentRef.current;
    pendingAmendmentRef.current = null;
    if (!amendId || !newValues) return;
    await supabase.from('record_amendments').update({ new_values: newValues }).eq('id', amendId);
  };
  // ────────────────────────────────────────────────────────────────

  const openProdForm = async (prod = null) => {
    // Intercept if the lot is finalized (has date_end) and not already bypassed
    if (prod?.id && prod.date_end && !prod._amendmentBypassed) {
      setAmendmentModal({
        title: 'Modificar lote de producción finalizado',
        recordLabel: prod.lot_number,
        tableName: 'production_lots',
        recordId: prod.id,
        previousValues: (() => {
          const ingrs = prod.production_lot_ingredients || [];
          const base  = ingrs.find(i => i.role === 'base') || {};
          const supp  = ingrs.find(i => i.role === 'suplemento') || {};
          return {
            lot_number:       prod.lot_number,
            medium_name:      prod.medium_name ?? null,
            base_lot_ref:     base.lot_number_ref ?? null,
            supp_lot_ref:     supp.lot_number_ref ?? null,
            preparation_date: prod.preparation_date,
            expiry_date:      prod.expiry_date ?? null,
            quantity_g:       prod.quantity_g ?? null,
            quantity_l:       prod.quantity_l ?? null,
            responsible:      prod.responsible ?? null,
            date_start:       prod.date_start ?? null,
            date_end:         prod.date_end,
          };
        })(),
        pendingAction: () => openProdForm({ ...prod, _amendmentBypassed: true }),
      });
      return;
    }
    await loadRecentArticleLots();
    if (prod?.id) {
      setEditingProd(prod);
      const ingrs = prod.production_lot_ingredients || [];
      const base = ingrs.find(i => i.role === 'base') || {};
      const supp = ingrs.find(i => i.role === 'suplemento') || {};
      const def = PRODUCTION_MEDIA.find(m => m.code === prod.medium_code);
      if (def?.commercial) await loadCommercialLots(def.base_articles);
      setProdForm({
        lot_number: prod.lot_number,
        preparation_date: prod.preparation_date,
        medium_code: prod.medium_code,
        medium_name: prod.medium_name,
        quantity_g: prod.quantity_g ?? '',
        quantity_l: prod.quantity_l ?? '',
        responsible: prod.responsible ?? '',
        expiry_date: prod.expiry_date ?? '',
        base_lot_id: base.article_lot_id ?? '',
        base_lot_ref: base.lot_number_ref ?? '',
        supp_lot_id: supp.article_lot_id ?? '',
        supp_lot_ref: supp.lot_number_ref ?? '',
        supp_qty: supp.quantity_used ?? (def?.supplement?.qty ?? ''),
        date_start: prod.date_start ?? '',
        date_end: prod.date_end ?? '',
      });
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setEditingProd(null);
      setProdForm({ ...emptyProdForm(), lot_number: autoLotNumber(today), expiry_date: addOneMonth(today) });
      if (prod?.preselectedMedium) {
        await handleProdMediumChange(prod.preselectedMedium);
      }
    }
    setProdView('form');
  };

  const handleProdMediumChange = async (code) => {
    const def = PRODUCTION_MEDIA.find(m => m.code === code);
    if (!def) return;
    if (def.commercial) {
      await loadCommercialLots(def.base_articles);
      setProdForm(f => ({
        ...f,
        medium_code: code, medium_name: def.name,
        quantity_g: '', quantity_l: '',
        base_lot_id: '', base_lot_ref: '',
        supp_lot_id: '', supp_lot_ref: '', supp_qty: '',
      }));
      return;
    }
    const baseLot = recentArticleLots.find(al => def.base_articles.includes(al.article_id));
    const suppLot = def.supplement?.articles?.length
      ? recentArticleLots.find(al => def.supplement.articles.includes(al.article_id))
      : null;
    setProdForm(f => ({
      ...f,
      medium_code: code, medium_name: def.name,
      quantity_g: def.qty_g_per_l !== null ? String(def.qty_g_per_l) : '',
      base_lot_id: baseLot?.id ?? '',
      base_lot_ref: baseLot?.lot_number ?? '',
      supp_lot_id: suppLot?.id ?? '',
      supp_lot_ref: suppLot?.lot_number ?? '',
      supp_qty: def.supplement?.qty ?? '',
    }));
  };

  const addOneMonth = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  };

  const handleProdDateChange = (date) => {
    const ln = autoLotNumber(date);
    setProdForm(f => ({ ...f, preparation_date: date, lot_number: ln, expiry_date: addOneMonth(date) }));
  };

  const saveProd = async () => {
    const def = PRODUCTION_MEDIA.find(m => m.code === prodForm.medium_code);
    const effectiveLotNumber = def?.commercial
      ? (prodForm.base_lot_ref || prodForm.lot_number)
      : prodForm.lot_number;
    if (!prodForm.medium_code || !prodForm.preparation_date || !effectiveLotNumber) {
      alert('Completa: Tipo de Medio, Fecha y Lote.');
      return;
    }
    setSavingProd(true);
    const payload = {
      lot_number: effectiveLotNumber,
      preparation_date: prodForm.preparation_date,
      medium_code: prodForm.medium_code,
      medium_name: prodForm.medium_name,
      quantity_g: prodForm.quantity_g ? Number(prodForm.quantity_g) : null,
      quantity_l: prodForm.quantity_l || null,
      responsible: prodForm.responsible || null,
      expiry_date: prodForm.expiry_date || null,
      lab: selectedLab,
      date_start: prodForm.date_start || null,
      date_end: prodForm.date_end || null,
    };
    let prodId;
    if (editingProd) {
      const { error: updErr } = await supabase.from('production_lots').update(payload).eq('id', editingProd.id);
      if (updErr) { alert(`Error al guardar: ${updErr.message}`); setSavingProd(false); return; }
      prodId = editingProd.id;
      await closeAmendmentWithNewValues({
        lot_number:       payload.lot_number,
        medium_name:      payload.medium_name ?? null,
        base_lot_ref:     prodForm.base_lot_ref || null,
        supp_lot_ref:     prodForm.supp_lot_ref || null,
        preparation_date: payload.preparation_date,
        expiry_date:      payload.expiry_date ?? null,
        quantity_g:       payload.quantity_g ?? null,
        quantity_l:       payload.quantity_l ?? null,
        responsible:      payload.responsible ?? null,
        date_start:       payload.date_start ?? null,
        date_end:         payload.date_end ?? null,
      });
      await supabase.from('production_lot_ingredients').delete().eq('production_lot_id', prodId);
    } else {
      const { data, error: insErr } = await supabase.from('production_lots').insert([payload]).select().single();
      if (insErr) { alert(`Error al guardar: ${insErr.message}`); setSavingProd(false); return; }
      prodId = data?.id;
    }
    if (prodId) {
      const ingrs = [];
      // Normalize sentinel value from manual-entry selector
      const baseLotId = (prodForm.base_lot_id && prodForm.base_lot_id !== '__manual__') ? prodForm.base_lot_id : null;
      const suppLotId = (prodForm.supp_lot_id && prodForm.supp_lot_id !== '__manual__') ? prodForm.supp_lot_id : null;
      // Base ingredient
      const baseLot = baseLotId ? recentArticleLots.find(al => al.id === baseLotId) : null;
      if (baseLotId || prodForm.base_lot_ref) {
        ingrs.push({
          production_lot_id: prodId,
          article_lot_id: baseLotId || null,
          article_id: baseLot?.article_id || null,
          lot_number_ref: prodForm.base_lot_ref || baseLot?.lot_number || null,
          description: baseLot?.articles?.name || def?.name || null,
          quantity_used: prodForm.quantity_g || null,
          unit: 'g',
          role: 'base',
        });
      }
      // Supplement ingredient (only MP, BP, CT)
      if (def?.supplement && (suppLotId || prodForm.supp_lot_ref)) {
        const suppLot = suppLotId ? recentArticleLots.find(al => al.id === suppLotId) : null;
        ingrs.push({
          production_lot_id: prodId,
          article_lot_id: suppLotId || null,
          article_id: suppLot?.article_id || null,
          lot_number_ref: prodForm.supp_lot_ref || suppLot?.lot_number || null,
          description: def.supplement.description,
          quantity_used: prodForm.supp_qty || def.supplement.qty || null,
          unit: def.supplement.unit || 'mL',
          role: 'suplemento',
        });
      }
      if (ingrs.length) {
        await supabase.from('production_lot_ingredients').insert(ingrs);
      }
    }
    setSavingProd(false);
    setProdView('list');
    loadProductionLots();
  };

  const deleteProd = async (id) => {
    if (!confirm('¿Eliminar este lote de producción?')) return;
    await supabase.from('production_lots').delete().eq('id', id);
    loadProductionLots();
  };
  // ────────────────────────────────────────────────────────────────

  const openLotForm = (lot = null) => {
    const today = new Date().toISOString().slice(0, 10);
    if (lot && lot.id) {
      // editar lote existente
      setEditingLot(lot);
      setLotForm({
        article_id: lot.article_id,
        lot_number: lot.lot_number,
        expiry_date: lot.expiry_date || '',
        reception_date: lot.reception_date,
        quantity: lot.quantity ?? '',
        received_by: lot.received_by || '',
        notes: lot.notes || '',
        orden_ref: ''
      });
    } else {
      // nuevo lote, con artículo pre-seleccionado opcional
      setEditingLot(null);
      setLotForm({ article_id: lot?.article_id || '', lot_number: '', expiry_date: '', reception_date: today, quantity: '', received_by: '', notes: '', orden_ref: '' });
    }
    setShowLotForm(true);
  };

  const filteredLots = useMemo(() => {
    return lots.filter(l => {
      const artName = (l.articles?.name || l.article_id || '').toLowerCase();
      const artId   = (l.article_id || '').toLowerCase();
      const artCat  = l.articles?.category || '';
      const artSupplier = (l.articles?.supplierName || '').toLowerCase();
      const search  = lotFilterSearch.toLowerCase();
      if (search && !artName.includes(search) && !artId.includes(search)) return false;
      if (lotFilterCategory && artCat !== lotFilterCategory) return false;
      if (lotFilterSupplier && artSupplier !== lotFilterSupplier.toLowerCase()) return false;
      if (lotFilterLot && !l.lot_number.toLowerCase().includes(lotFilterLot.toLowerCase())) return false;
      if (lotFilterFrom && l.reception_date < lotFilterFrom) return false;
      if (lotFilterTo && l.reception_date > lotFilterTo) return false;
      return true;
    });
  }, [lots, lotFilterSearch, lotFilterCategory, lotFilterSupplier, lotFilterLot, lotFilterFrom, lotFilterTo]);

  const groupedLots = useMemo(() => {
    const map = {};
    filteredLots.forEach(lot => {
      if (!map[lot.article_id]) {
        map[lot.article_id] = {
          article_id: lot.article_id,
          name: lot.articles?.name || lot.article_id,
          category: lot.articles?.category || '—',
          entries: [],
        };
      }
      map[lot.article_id].entries.push(lot);
    });
    return Object.values(map).map(g => {
      const sorted = [...g.entries].sort((a, b) => b.reception_date.localeCompare(a.reception_date));
      return { ...g, entries: sorted, last: sorted[0] };
    }).sort((a, b) => b.last.reception_date.localeCompare(a.last.reception_date));
  }, [filteredLots]);

  const expiringLots = useMemo(() => {
    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    const limitStr = limit.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return lots.filter(l => l.expiry_date && l.expiry_date >= today && l.expiry_date <= limitStr);
  }, [lots]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
      case 'analisis': {
        return (
          <Dashboard
            orders={labOrders}
            articles={labArticles}
            suppliers={labSuppliers}
            onTabChange={setActiveTab}
            onNavigateToArticles={(analysisType) => {
              setArticleAnalysisFilter(analysisType);
              setArticleSearch('');
              setArticleCategory('');
              setArticleSupplier('');
              setActiveTab('articulos');
            }}
            onNavigateToPedidos={(status) => {
              setOrderStatusFilter(status || '');
              setOrderMonthFilter('');
              setOrderDateStart('');
              setOrderDateEnd('');
              setActiveTab('pedidos');
            }}
            role={role}
            monthlyBudgets={monthlyBudgets}
            onSaveBudget={handleSaveBudget}
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
                  <option value="Pendiente Aprobación CEO">Pendiente Aprobación CEO</option>
                  <option value="Pendiente de Aprobación">Pendiente de Aprobación</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Completado">Completado</option>
                  <option value="Incompleto">Incompleto</option>
                  <option value="Rechazado">Rechazado</option>
                </select>
                {/* Selector por mes */}
                <select
                  className="input-field"
                  style={{ width: '160px', margin: 0 }}
                  value={orderMonthFilter}
                  onChange={(e) => {
                    setOrderMonthFilter(e.target.value);
                    if (e.target.value) { setOrderDateStart(''); setOrderDateEnd(''); }
                  }}
                >
                  <option value="">Todos los meses</option>
                  {availableMonths.map(ym => {
                    const [y, m] = ym.split('-');
                    const label = new Date(Number(y), Number(m) - 1, 1)
                      .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                    return <option key={ym} value={ym}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>;
                  })}
                </select>

                {/* Rango de fechas */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <span>Desde:</span>
                  <input
                    type="date"
                    className="input-field"
                    style={{ width: '150px', margin: 0, padding: '8px' }}
                    value={orderDateStart}
                    onChange={(e) => { setOrderDateStart(e.target.value); setOrderMonthFilter(''); }}
                  />
                  <span>Hasta:</span>
                  <input
                    type="date"
                    className="input-field"
                    style={{ width: '150px', margin: 0, padding: '8px' }}
                    value={orderDateEnd}
                    onChange={(e) => { setOrderDateEnd(e.target.value); setOrderMonthFilter(''); }}
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
                    <th>Incidencias</th>
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
                          order.status === 'Completado'                ? 'badge-success'  :
                          order.status === 'Incompleto'                ? 'badge-warning'  :
                          order.status === 'Pendiente'                 ? 'badge-info'     :
                          order.status === 'Pendiente de Aprobación'   ? 'badge-approval' :
                          order.status === 'Pendiente Aprobación CEO'  ? 'badge-approval' :
                          order.status === 'Rechazado'                 ? 'badge-rejected' : 'badge-info'
                        }`} style={order.status === 'Pendiente Aprobación CEO' ? { backgroundColor: '#ede9fe', color: '#5b21b6', borderColor: '#c4b5fd' } : {}}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {order.rejection_reason ? (
                          <div title={`Rechazado: ${order.rejection_reason}`} style={{ color: '#dc2626', cursor: 'help', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ThumbsDown size={18} />
                          </div>
                        ) : order.approved_by ? (
                          <div title={`Aprobado por ${order.approved_by} el ${order.approval_date}`} style={{ color: '#16a34a', cursor: 'help', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ThumbsUp size={18} />
                          </div>
                        ) : order.incidents ? (
                          <div title={order.incidents} style={{ color: 'var(--danger)', cursor: 'help', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlertTriangle size={18} />
                          </div>
                        ) : order.status === 'Pendiente de Aprobación' ? (
                          <div title="Esperando aprobación del administrador" style={{ color: '#f59e0b', cursor: 'help', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Clock size={18} />
                          </div>
                        ) : '-'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px', fontSize: '0.75rem', color: 'var(--primary)' }}
                            title="Consultar Detalle"
                            onClick={() => {
                              setViewingOrder(order);
                              setIsViewModalOpen(true);
                            }}
                          >
                            <Eye size={16} />
                          </button>
                          
                          {/* Botones Aprobar / Rechazar — solo admin con permiso de aprobación */}
                          {role === 'admin' && canApprove && (order.status === 'Pendiente de Aprobación' || order.status === 'Pendiente Aprobación CEO') && (
                            <>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px', fontSize: '0.75rem', color: '#16a34a', borderColor: '#16a34a' }}
                                title="Aprobar pedido"
                                onClick={() => handleApproveOrder(order)}
                              >
                                <ThumbsUp size={16} />
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px', fontSize: '0.75rem', color: '#dc2626', borderColor: '#dc2626' }}
                                title="Rechazar pedido"
                                onClick={() => handleRejectOrder(order)}
                              >
                                <ThumbsDown size={16} />
                              </button>
                            </>
                          )}

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
                            disabled={order.status === 'Completado' || order.status === 'Rechazado'}
                            style={{
                              padding: '6px',
                              fontSize: '0.75rem',
                              color: order.status === 'Incompleto' ? 'var(--warning)' : 'var(--primary)',
                              display: (order.status === 'Completado' || order.status === 'Rechazado') ? 'none' : 'flex'
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
        const filteredStocks = labArticles.filter(art => {
          // Solo mostrar artículos que tienen una entrada de stock para este lab
          const hasLabEntry = selectedLab in (art.stock_labs || {});
          if (!hasLabEntry) return false;

          const name = (art.name || '').toLowerCase();
          const ref = (art.supplierRef || '').toLowerCase();
          const supplierName = (art.supplierName || '').toLowerCase();
          const q = stockSearchQuery.toLowerCase();

          const matchesSearch = name.includes(q) || ref.includes(q) || supplierName.includes(q);
          const matchesSupplier = stockSupplierFilter === '' || art.supplierName === stockSupplierFilter;
          const matchesCategory = stockCategoryFilter === '' || art.category === stockCategoryFilter;
          const matchesAnalysis = stockAnalysisFilter === '' || art.analysis_type === stockAnalysisFilter;
          const isLowStock = art.stock <= art.minStock;

          let matches = matchesSearch && matchesSupplier && matchesCategory && matchesAnalysis;
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

        const lowStockCount = labArticles.filter(a =>
          (selectedLab in (a.stock_labs || {})) && a.stock <= a.minStock
        ).length;

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
                
                <div className="input-group" style={{ margin: 0, width: '180px' }}>
                  <select
                    className="input-field"
                    value={stockAnalysisFilter}
                    onChange={e => setStockAnalysisFilter(e.target.value)}
                  >
                    <option value="">Todos los análisis</option>
                    <option value="Legionella">Legionella</option>
                    <option value="Alimentos">Alimentos</option>
                    <option value="Piscinas">Piscinas</option>
                  </select>
                </div>
                <div className="input-group" style={{ margin: 0, width: '200px' }}>
                  <select
                    className="input-field"
                    value={stockCategoryFilter}
                    onChange={e => setStockCategoryFilter(e.target.value)}
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
                    value={stockSupplierFilter}
                    onChange={(e) => setStockSupplierFilter(e.target.value)}
                  >
                    <option value="">Todos los proveedores</option>
                    {uniqueSuppliers.map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group" style={{ margin: 0, width: '230px' }}>
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
                      <td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
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

              <div className="input-group" style={{ margin: 0, width: '180px' }}>
                <select
                  className="input-field"
                  value={articleAnalysisFilter}
                  onChange={e => setArticleAnalysisFilter(e.target.value)}
                >
                  <option value="">Todos los grupos</option>
                  <option value="Legionella">Legionella</option>
                  <option value="Alimentos">Alimentos</option>
                  <option value="Piscinas">Piscinas</option>
                  <option value="__unassigned__">Sin asignar</option>
                </select>
              </div>

              {articleAnalysisFilter && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', backgroundColor: 'var(--primary-light)', border: '1px solid var(--primary)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary)' }}>
                  {articleAnalysisFilter === '__unassigned__' ? 'Sin asignar' : articleAnalysisFilter}
                  <button onClick={() => setArticleAnalysisFilter('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 0, lineHeight: 1, fontSize: '1rem' }}>×</button>
                </div>
              )}

              {selectedArticles.length > 0 && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => setIsBulkEditOpen(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--success)' }}
                  >
                    <CheckSquare size={18} /> Edición Masiva ({selectedArticles.length})
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={async () => {
                      if (window.confirm(`¿Seguro que deseas ELIMINAR PERMANENTEMENTE los ${selectedArticles.length} artículos seleccionados?`)) {
                        const { error } = await supabase.from('articles').delete().in('id', selectedArticles);
                        if (!error) {
                          await fetchArticles();
                          setSelectedArticles([]);
                        } else {
                          alert("Error al eliminar: " + error.message);
                        }
                      }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  >
                    <Trash2 size={18} /> Eliminar ({selectedArticles.length})
                  </button>
                </div>
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
                    <th>Grupo Análisis</th>
                    <th>Tipo Gasto</th>
                    <th>Proveedor</th>
                    <th>Ref. Prov.</th>
                    <th>Precio Est. (sin IVA)</th>
                    <th>Tipo</th>
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
                      <td>
                        <select
                          value={art.analysis_type || ''}
                          onChange={async e => {
                            const val = e.target.value || null;
                            await supabase.from('articles').update({ analysis_type: val }).eq('id', art.id);
                            await fetchArticles();
                          }}
                          style={{
                            border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 6px',
                            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', backgroundColor: 'transparent',
                            color: !art.analysis_type ? 'var(--text-muted)'
                              : art.analysis_type === 'Legionella' ? '#92400e'
                              : art.analysis_type === 'Alimentos' ? '#166534' : '#1e40af',
                          }}
                        >
                          <option value="">— Sin asignar —</option>
                          <option value="Legionella">Legionella</option>
                          <option value="Alimentos">Alimentos</option>
                          <option value="Piscinas">Piscinas</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={art.account_type || 'OPEX'}
                          onChange={async e => {
                            await supabase.from('articles').update({ account_type: e.target.value }).eq('id', art.id);
                            await fetchArticles();
                          }}
                          style={{
                            border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 6px',
                            fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', backgroundColor: 'transparent',
                            color: art.account_type === 'CAPEX' ? '#5b21b6' : '#166534',
                          }}
                        >
                          <option value="OPEX">OPEX</option>
                          <option value="CAPEX">CAPEX</option>
                        </select>
                      </td>
                      <td>{art.supplierName}</td>
                      <td><span style={{color: 'var(--text-muted)', fontSize: '0.9em'}}>{art.supplierRef}</span></td>
                      <td style={{ fontWeight: 600 }}>{formatInEuros(art.price)}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700,
                          backgroundColor: art.account_type === 'CAPEX' ? '#ede9fe' : '#f0fdf4',
                          color: art.account_type === 'CAPEX' ? '#5b21b6' : '#166534',
                          border: `1px solid ${art.account_type === 'CAPEX' ? '#c4b5fd' : '#86efac'}`,
                          whiteSpace: 'nowrap'
                        }}>
                          {art.account_type || 'OPEX'}
                        </span>
                      </td>
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
                      <td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
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
                <button className="btn btn-primary" onClick={() => openSupplierModal()}>
                  <Plus size={18} style={{ marginRight: '8px' }} /> Alta Proveedor
                </button>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
              {labSuppliers.map(prov => {
                const articleCount = supplierArticleCounts[prov.name] || 0;
                const lastEval = supplierLastEvals[prov.id];
                const docCount = supplierDocCounts[prov.id] || 0;
                const scoreColor = !lastEval ? '#94a3b8'
                  : lastEval.result === 'APROBADO' ? '#16a34a'
                  : lastEval.result === 'APROBADO CON RESERVAS' ? '#d97706' : '#dc2626';
                const typeLabel = prov.supplier_type === 'laboratorio_subcontratado' ? 'Lab ISO 17025'
                  : prov.supplier_type === 'servicio' ? 'Servicio' : 'Producto';
                const typeColor = prov.supplier_type === 'laboratorio_subcontratado' ? '#0891b2'
                  : prov.supplier_type === 'servicio' ? '#7c3aed' : 'var(--primary)';
                return (
                  <div key={prov.id} className="card" style={{ margin: 0, padding: '20px', display: 'flex', flexDirection: 'column', gap: '0', borderTop: `4px solid ${typeColor}` }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Building2 size={20} color={typeColor} />
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--secondary)', cursor: 'pointer', lineHeight: 1.2 }}
                            onClick={() => { setArticleSupplier(prov.name); setActiveTab('articulos'); }}
                            title={`Ver artículos de ${prov.name}`}>
                            {prov.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{prov.id}</div>
                        </div>
                      </div>
                      {/* Puntuación última evaluación */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: scoreColor }}>
                          {lastEval ? lastEval.overall_score : '—'}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: scoreColor, fontWeight: 600 }}>
                          {lastEval ? lastEval.result : 'Sin evaluar'}
                        </div>
                      </div>
                    </div>

                    {/* Badges tipo + crítico */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, background: `${typeColor}18`, color: typeColor, borderRadius: '4px', padding: '2px 7px' }}>
                        {typeLabel}
                      </span>
                      {prov.is_critical && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#fee2e2', color: '#dc2626', borderRadius: '4px', padding: '2px 7px' }}>
                          ⚠ Crítico
                        </span>
                      )}
                      {prov.supplier_type === 'laboratorio_subcontratado' && prov.accreditation_number && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, background: '#f0f9ff', color: '#0369a1', borderRadius: '4px', padding: '2px 7px' }}>
                          {prov.accreditation_body || 'ENAC'} {prov.accreditation_number}
                        </span>
                      )}
                      {docCount > 0 && (
                        <span
                          onClick={() => setDocsModalSupplier(prov)}
                          style={{ fontSize: '0.7rem', fontWeight: 700, background: '#f0fdf4', color: '#16a34a', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <FileText size={10} /> {docCount} doc{docCount > 1 ? 's' : ''}
                        </span>
                      )}
                      <span className={`badge ${articleCount > 0 ? 'badge-info' : ''}`}
                        style={{ fontSize: '0.7rem', padding: '2px 7px', cursor: 'pointer' }}
                        onClick={() => { setArticleSupplier(prov.name); setActiveTab('articulos'); }}>
                        {articleCount} ref.
                      </span>
                    </div>

                    {/* Contact details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', marginBottom: '12px' }}>
                      {prov.contact && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)' }}><User size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} /><span>{prov.contact}</span></div>}
                      {prov.address && <div style={{ display: 'flex', gap: '8px', color: 'var(--text)' }}><MapPin size={13} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} /><span style={{ lineHeight: 1.4 }}>{prov.address}</span></div>}
                      {prov.phone && <div style={{ display: 'flex', gap: '8px', color: 'var(--text)' }}><Phone size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} /><a href={`tel:${prov.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{prov.phone}</a></div>}
                      {prov.email && <div style={{ display: 'flex', gap: '8px', color: 'var(--text)' }}><Mail size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} /><a href={`mailto:${prov.email}`} style={{ color: 'var(--primary)', textDecoration: 'none', wordBreak: 'break-all' }}>{prov.email}</a></div>}
                      {prov.website && <div style={{ display: 'flex', gap: '8px', color: 'var(--text)' }}><Globe size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} /><span style={{ color: 'var(--primary)', wordBreak: 'break-all' }}>{prov.website}</span></div>}
                      {prov.notes && <div style={{ display: 'flex', gap: '8px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '7px', marginTop: '2px' }}><StickyNote size={13} style={{ flexShrink: 0, marginTop: '2px' }} /><span style={{ fontSize: '0.8rem', fontStyle: 'italic', lineHeight: 1.4 }}>{prov.notes}</span></div>}
                      {!prov.contact && !prov.address && !prov.phone && !prov.email && !prov.website && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Sin datos de contacto — haz clic en Editar para completar</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                      <button className="btn btn-primary"
                        style={{ flex: 1, padding: '6px 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', minWidth: '90px' }}
                        onClick={() => { setDefaultSupplierForOrder(prov.name); setIsNewOrderModalOpen(true); }}>
                        <ShoppingCart size={13} /> Pedido
                      </button>
                      <button className="btn btn-secondary"
                        style={{ padding: '6px 8px', fontSize: '0.78rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Evaluar proveedor"
                        onClick={() => setEvalModalSupplier(prov)}>
                        <ClipboardCheck size={13} /> Evaluar
                      </button>
                      <button className="btn btn-secondary"
                        style={{ padding: '6px 8px', fontSize: '0.78rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}
                        title="Documentos del proveedor"
                        onClick={() => setDocsModalSupplier(prov)}>
                        <FileText size={13} /> Docs
                        {docCount > 0 && (
                          <span style={{ background: '#16a34a', color: '#fff', borderRadius: '999px', fontSize: '0.62rem', fontWeight: 800, padding: '0 5px', lineHeight: '16px', minWidth: '16px', textAlign: 'center' }}>
                            {docCount}
                          </span>
                        )}
                      </button>
                      <button className="btn btn-secondary"
                        style={{ padding: '6px 8px', fontSize: '0.78rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Editar Proveedor"
                        onClick={() => openSupplierModal(prov)}>
                        <Edit size={13} /> Editar
                      </button>
                      <button className="btn btn-secondary"
                        style={{ padding: '6px', fontSize: '0.78rem', color: 'var(--danger)', border: 'none' }}
                        title="Eliminar Proveedor"
                        onClick={() => handleDeleteSupplier(prov.name)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {labSuppliers.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  <Building2 size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                  <p>No hay proveedores registrados para este laboratorio.</p>
                  <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => openSupplierModal()}>
                    <Plus size={16} style={{ marginRight: '8px' }} /> Añadir primer proveedor
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      }
      case 'produccion': {
        const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES') : '—';
        const todayProd = new Date().toISOString().slice(0, 10);
        const isExpiredProd  = d => d && d < todayProd;
        const isExpiringProd = d => { if (!d) return false; const lim = new Date(); lim.setDate(lim.getDate() + 7); return d >= todayProd && d <= lim.toISOString().slice(0,10); };

        // ── FORM VIEW ────────────────────────────────────────────────────
        if (prodView === 'form') {
          const ingredientOptions = (idx) => {
            const used = prodForm.ingredients.map((ig, i) => i !== idx ? ig.article_lot_id : null).filter(Boolean);
            return recentArticleLots.filter(al => !used.includes(al.id));
          };
          const selectedDef = PRODUCTION_MEDIA.find(m => m.code === prodForm.medium_code);

          return (
            <div className="content-area">
              {/* Header barra volver */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px' }}
                  onClick={() => { setProdView('list'); setEditingProd(null); setProdForm(emptyProdForm()); }}>
                  ← Volver
                </button>
                <div>
                  <h1 className="page-title" style={{ marginBottom: '2px' }}>
                    {editingProd ? 'Editar lote de producción / uso' : 'Nuevo lote de producción / uso'}
                  </h1>
                  <p className="page-subtitle">Selecciona el tipo de medio y completa los datos</p>
                </div>
              </div>

              {/* Catálogo de medios — tarjetas con info */}
              <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Selecciona el tipo de medio</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                  {PRODUCTION_MEDIA.map(m => {
                    const selected = prodForm.medium_code === m.code;
                    return (
                      <button key={m.code}
                        onClick={() => handleProdMediumChange(m.code)}
                        style={{
                          border: `2px solid ${selected ? m.color : 'var(--border)'}`,
                          background: selected ? `${m.color}18` : 'var(--bg-secondary)',
                          borderRadius: '10px', padding: '10px 12px',
                          cursor: 'pointer', textAlign: 'left',
                          outline: 'none', transition: 'all 0.12s',
                        }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1rem', color: m.color, marginBottom: '3px' }}>{m.code}</div>
                        <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', lineHeight: 1.3, marginBottom: '4px' }}>{m.name}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {m.qty_g_per_l && (
                            <span style={{ fontSize: '0.68rem', color: m.color, fontWeight: 600 }}>{m.qty_g_per_l} g/L</span>
                          )}
                          {m.commercial && (
                            <span style={{ fontSize: '0.65rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '3px', padding: '0px 4px' }}>Comercial</span>
                          )}
                          {m.supplement && (
                            <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#92400e', borderRadius: '3px', padding: '0px 4px' }}>+ Supl.</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Formulario — solo visible si se seleccionó un medio */}
              {prodForm.medium_code && (
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ background: selectedDef?.color, color: '#fff', borderRadius: '6px', padding: '3px 10px', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem' }}>{prodForm.medium_code}</span>
                    <span style={{ fontWeight: 600, fontSize: '1rem' }}>{prodForm.medium_name}</span>
                    {selectedDef?.commercial && (
                      <span style={{ fontSize: '0.72rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '2px 8px', fontWeight: 600 }}>Medio comercial</span>
                    )}
                  </div>

                  {/* ── FORMULARIO COMERCIAL (BCYE, BCYE-Cys, GVPC, ÁCIDO) ── */}
                  {selectedDef?.commercial ? (
                    <div style={{ display: 'grid', gap: '14px' }}>
                      {/* Lote de trazabilidad */}
                      <div className="input-group">
                        <label className="input-label">Lote (últimas 3 entradas en trazabilidad)
                          {prodForm.base_lot_id && prodForm.base_lot_id !== '__manual__' && (
                            <span style={{ marginLeft: '8px', fontSize: '0.72rem', background: '#dcfce7', color: '#166534', borderRadius: '3px', padding: '1px 6px' }}>✓ Trazado</span>
                          )}
                        </label>
                        {commercialLots.length > 0 ? (
                          <select className="input-field" value={prodForm.base_lot_id}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '__manual__') {
                                setProdForm(f => ({ ...f, base_lot_id: '__manual__', base_lot_ref: '', lot_number: '', expiry_date: '' }));
                              } else {
                                const al = commercialLots.find(x => x.id === val);
                                setProdForm(f => ({ ...f, base_lot_id: val, base_lot_ref: al?.lot_number || '', lot_number: al?.lot_number || '', expiry_date: al?.expiry_date || '' }));
                              }
                            }}>
                            <option value="" disabled>— Selecciona lote —</option>
                            {commercialLots.map(al => (
                              <option key={al.id} value={al.id}>
                                {al.lot_number}  ·  {al.articles?.name || al.article_id}  ·  Recibido: {fmtD(al.reception_date)}{al.expiry_date ? `  ·  Cad: ${fmtD(al.expiry_date)}` : ''}
                              </option>
                            ))}
                            <option value="__manual__">✏ Introducir lote manualmente</option>
                          </select>
                        ) : (
                          <div style={{ fontSize: '0.82rem', color: '#92400e', background: '#fef3c7', borderRadius: '6px', padding: '8px 12px' }}>
                            Sin lotes recibidos para este artículo. Introduce el número manualmente.
                          </div>
                        )}
                        {(commercialLots.length === 0 || prodForm.base_lot_id === '__manual__') && (
                          <input className="input-field" style={{ marginTop: '6px' }}
                            placeholder="Nº lote del kit comercial"
                            value={prodForm.base_lot_ref}
                            onChange={e => setProdForm(f => ({ ...f, base_lot_ref: e.target.value }))} />
                        )}
                      </div>

                      {/* Caducidad del kit */}
                      <div className="input-group">
                        <label className="input-label">Fecha caducidad del kit
                          {prodForm.expiry_date && (
                            <span style={{ marginLeft: '8px', fontSize: '0.72rem', background: '#dbeafe', color: '#1d4ed8', borderRadius: '3px', padding: '1px 6px' }}>Auto del lote</span>
                          )}
                        </label>
                        <input type="date" className="input-field" value={prodForm.expiry_date}
                          onChange={e => setProdForm(f => ({ ...f, expiry_date: e.target.value }))} />
                      </div>

                      {/* Fecha inicio + fin uso */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="input-group">
                          <label className="input-label">Fecha inicio uso *</label>
                          <input type="date" className="input-field" value={prodForm.date_start}
                            onChange={e => setProdForm(f => ({ ...f, date_start: e.target.value }))} />
                        </div>
                        <div className="input-group">
                          <label className="input-label">Fecha fin uso</label>
                          <input type="date" className="input-field" value={prodForm.date_end}
                            onChange={e => setProdForm(f => ({ ...f, date_end: e.target.value }))} />
                        </div>
                      </div>

                      {/* Responsable */}
                      <div className="input-group">
                        <label className="input-label">Responsable apertura</label>
                        <input className="input-field" value={prodForm.responsible}
                          onChange={e => setProdForm(f => ({ ...f, responsible: e.target.value }))}
                          placeholder="Nombre del responsable" />
                      </div>
                    </div>

                  ) : (
                  <div style={{ display: 'grid', gap: '14px' }}>

                    {/* Lote + Fecha preparación + Caducidad */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div className="input-group">
                        <label className="input-label">Lote de preparación *</label>
                        <input className="input-field" value={prodForm.lot_number} onChange={e => setProdForm(f => ({ ...f, lot_number: e.target.value }))} placeholder="ej. 2306-1" />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Fecha de preparación *</label>
                        <input type="date" className="input-field" value={prodForm.preparation_date} onChange={e => handleProdDateChange(e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Fecha caducidad</label>
                        <input type="date" className="input-field" value={prodForm.expiry_date} onChange={e => setProdForm(f => ({ ...f, expiry_date: e.target.value }))} />
                      </div>
                    </div>

                    {/* Lote de Medio (reactivo padre) */}
                    {(() => {
                      const baseLots = selectedDef?.base_articles?.length
                        ? recentArticleLots.filter(al => selectedDef.base_articles.includes(al.article_id))
                        : [];
                      const hasSystem = baseLots.length > 0;
                      const isManual = prodForm.base_lot_id === '__manual__';
                      return (
                        <div className="input-group">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <label className="input-label" style={{ margin: 0 }}>Lote de Medio</label>
                            {prodForm.base_lot_id && !isManual && (
                              <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#166534', borderRadius: '3px', padding: '1px 6px' }}>✓ Trazado</span>
                            )}
                            {!hasSystem && selectedDef?.base_articles?.length > 0 && (
                              <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#92400e', borderRadius: '3px', padding: '1px 6px' }}>Sin lotes recibidos (últimos 6 meses)</span>
                            )}
                            {!selectedDef?.base_articles?.length && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Entrada manual</span>
                            )}
                          </div>

                          {/* Caso: hay lotes en sistema */}
                          {hasSystem && (
                            <select className="input-field" value={prodForm.base_lot_id}
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '__manual__') {
                                  setProdForm(f => ({ ...f, base_lot_id: '__manual__', base_lot_ref: '' }));
                                } else {
                                  const al = recentArticleLots.find(x => x.id === val);
                                  setProdForm(f => ({ ...f, base_lot_id: val, base_lot_ref: al?.lot_number || '' }));
                                }
                              }}>
                              <option value="" disabled>— Selecciona lote —</option>
                              {baseLots.map(al => (
                                <option key={al.id} value={al.id}>
                                  {al.lot_number}  ·  {al.articles?.name || al.article_id}  ·  {fmtD(al.reception_date)}
                                </option>
                              ))}
                              <option value="__manual__">✏ Introducir lote manualmente</option>
                            </select>
                          )}

                          {/* Entrada manual: sin artículos mapeados, o usuario eligió manual */}
                          {(!hasSystem || isManual) && (
                            <input className="input-field" style={{ marginTop: hasSystem ? '6px' : '0' }}
                              placeholder="Nº lote del reactivo" value={prodForm.base_lot_ref}
                              onChange={e => setProdForm(f => ({ ...f, base_lot_ref: e.target.value }))} />
                          )}
                        </div>
                      );
                    })()}

                    {/* Peso + Volumen */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="input-group">
                        <label className="input-label">Peso (g)</label>
                        <input type="number" className="input-field" value={prodForm.quantity_g} onChange={e => setProdForm(f => ({ ...f, quantity_g: e.target.value }))} placeholder="ej. 23.5" />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Cantidad preparada (L)</label>
                        <input className="input-field" value={prodForm.quantity_l} onChange={e => setProdForm(f => ({ ...f, quantity_l: e.target.value }))} placeholder="ej. 2" />
                      </div>
                    </div>

                    {/* Suplemento — solo MP, BP, CT */}
                    {selectedDef?.supplement && (() => {
                      const suppLots = selectedDef.supplement.articles?.length
                        ? recentArticleLots.filter(al => selectedDef.supplement.articles.includes(al.article_id))
                        : [];
                      const hasSuppSystem = suppLots.length > 0;
                      const isSuppManual = prodForm.supp_lot_id === '__manual__';
                      return (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px' }}>
                          <p style={{ fontWeight: 600, fontSize: '0.85rem', margin: '0 0 10px', color: '#92400e' }}>
                            Suplemento: {selectedDef.supplement.description}
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '10px' }}>
                            <div className="input-group" style={{ margin: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <label className="input-label" style={{ margin: 0 }}>Lote suplemento</label>
                                {prodForm.supp_lot_id && !isSuppManual && (
                                  <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#166534', borderRadius: '3px', padding: '1px 6px' }}>✓ Trazado</span>
                                )}
                                {!hasSuppSystem && selectedDef.supplement.articles?.length > 0 && (
                                  <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#92400e', borderRadius: '3px', padding: '1px 6px' }}>Sin lotes en sistema</span>
                                )}
                              </div>
                              {hasSuppSystem && (
                                <select className="input-field" value={prodForm.supp_lot_id}
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (val === '__manual__') {
                                      setProdForm(f => ({ ...f, supp_lot_id: '__manual__', supp_lot_ref: '' }));
                                    } else {
                                      const al = recentArticleLots.find(x => x.id === val);
                                      setProdForm(f => ({ ...f, supp_lot_id: val, supp_lot_ref: al?.lot_number || '' }));
                                    }
                                  }}>
                                  <option value="" disabled>— Selecciona lote —</option>
                                  {suppLots.map(al => (
                                    <option key={al.id} value={al.id}>
                                      {al.lot_number}  ·  {al.articles?.name || al.article_id}  ·  {fmtD(al.reception_date)}
                                    </option>
                                  ))}
                                  <option value="__manual__">✏ Introducir lote manualmente</option>
                                </select>
                              )}
                              {(!hasSuppSystem || isSuppManual) && (
                                <input className="input-field" style={{ marginTop: hasSuppSystem ? '6px' : '0' }}
                                  placeholder="Nº lote del suplemento" value={prodForm.supp_lot_ref}
                                  onChange={e => setProdForm(f => ({ ...f, supp_lot_ref: e.target.value }))} />
                              )}
                            </div>
                            <div className="input-group" style={{ margin: 0 }}>
                              <label className="input-label">Cantidad ({selectedDef.supplement.unit})</label>
                              <input className="input-field" value={prodForm.supp_qty}
                                onChange={e => setProdForm(f => ({ ...f, supp_qty: e.target.value }))}
                                placeholder={selectedDef.supplement.qty} />
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Responsable */}
                    <div className="input-group">
                      <label className="input-label">Responsable</label>
                      <input className="input-field" value={prodForm.responsible} onChange={e => setProdForm(f => ({ ...f, responsible: e.target.value }))} placeholder="Nombre o iniciales" />
                    </div>

                    {/* Botones acción */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '6px' }}>
                      <button className="btn btn-secondary"
                        onClick={() => { setProdView('list'); setEditingProd(null); setProdForm(emptyProdForm()); }}>
                        Cancelar
                      </button>
                      <button className="btn btn-primary" onClick={saveProd} disabled={savingProd}>
                        {savingProd ? 'Guardando…' : editingProd ? 'Guardar cambios' : 'Registrar lote'}
                      </button>
                    </div>
                  </div>
                  )} {/* fin ternario commercial/normal */}

                  {/* Botones acción para medio comercial */}
                  {selectedDef?.commercial && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '14px', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
                      <button className="btn btn-secondary"
                        onClick={() => { setProdView('list'); setEditingProd(null); setProdForm(emptyProdForm()); }}>
                        Cancelar
                      </button>
                      <button className="btn btn-primary" onClick={saveProd} disabled={savingProd}>
                        {savingProd ? 'Guardando…' : editingProd ? 'Guardar cambios' : 'Registrar apertura'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }

        // ── SAVE INLINE DATES ────────────────────────────────────────────
        const saveProdDates = async () => {
          if (!inlineProdDate) return;
          setSavingProdDate(true);
          await supabase.from('production_lots')
            .update({ date_start: inlineProdDate.date_start || null, date_end: inlineProdDate.date_end || null })
            .eq('id', inlineProdDate.id);
          setSavingProdDate(false);
          setInlineProdDate(null);
          loadProductionLots();
        };

        // ── LIST VIEW ────────────────────────────────────────────────────
        const today = new Date().toISOString().slice(0, 10);
        const isInactive = (p) => !!p.date_end;

        const filteredProd = productionLots.filter(p => {
          if (prodFilterMedium && p.medium_code !== prodFilterMedium) return false;
          if (prodHideInactive && isInactive(p)) return false;   // vista activos: ocultar finalizados
          if (!prodHideInactive && !isInactive(p)) return false; // vista finalizados: ocultar activos
          // Filtro por rango de fechas activas: el lote debe solapar con [filterFrom, filterTo]
          if (prodFilterFrom || prodFilterTo) {
            const ds = p.date_start || null;
            const de = p.date_end || null;
            if (prodFilterFrom && de && de < prodFilterFrom) return false;
            if (prodFilterTo && ds && ds > prodFilterTo) return false;
            if (!ds) return false;
          }
          return true;
        });

        const inactiveCount = productionLots.filter(isInactive).length;
        const hasDateFilter = prodFilterFrom || prodFilterTo;

        return (
          <div className="content-area">
            <div className="page-header">
              <div>
                <h1 className="page-title">Producción / Uso de Lotes</h1>
                <p className="page-subtitle">Registro de lotes preparados internamente</p>
              </div>
            </div>

            {/* Filtros */}
            <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
              {/* Fila 1 — fechas */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Activos desde</label>
                  <input type="date" className="input-field" style={{ fontSize: '0.85rem', padding: '6px 10px', width: '150px' }}
                    value={prodFilterFrom} onChange={e => setProdFilterFrom(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Hasta</label>
                  <input type="date" className="input-field" style={{ fontSize: '0.85rem', padding: '6px 10px', width: '150px' }}
                    value={prodFilterTo} onChange={e => setProdFilterTo(e.target.value)} />
                </div>
                {hasDateFilter && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '2px' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
                      {filteredProd.length} lote{filteredProd.length !== 1 ? 's' : ''} activo{filteredProd.length !== 1 ? 's' : ''}
                    </span>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px', fontSize: '0.8rem' }}
                      title="Limpiar fechas" onClick={() => { setProdFilterFrom(''); setProdFilterTo(''); }}>✕</button>
                  </div>
                )}
                {inactiveCount > 0 && (
                  <button onClick={() => setProdHideInactive(h => !h)}
                    style={{
                      border: `1.5px solid ${!prodHideInactive ? 'var(--primary)' : 'var(--border)'}`,
                      background: !prodHideInactive ? 'var(--primary)' : 'transparent',
                      color: !prodHideInactive ? '#fff' : 'var(--text-muted)',
                      borderRadius: '20px', padding: '5px 14px',
                      fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', outline: 'none',
                      whiteSpace: 'nowrap',
                    }}>
                    {prodHideInactive ? `Ver finalizados (${inactiveCount})` : `Ocultar finalizados (${inactiveCount})`}
                  </button>
                )}
                {/* Botón Nuevo lote — anclado a la derecha */}
                <button className="btn btn-primary" onClick={() => openProdForm(prodFilterMedium ? { preselectedMedium: prodFilterMedium } : null)}
                  style={{ marginLeft: 'auto', padding: '8px 20px', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={18} /> Nuevo lote
                </button>
              </div>

              {/* Fila 2 — chips tipo de medio */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Medio:</span>
                <button onClick={() => setProdFilterMedium('')}
                  style={{
                    border: `1.5px solid ${!prodFilterMedium ? 'var(--primary)' : 'var(--border)'}`,
                    background: !prodFilterMedium ? 'var(--primary)' : 'transparent',
                    color: !prodFilterMedium ? '#fff' : 'var(--text-muted)',
                    borderRadius: '20px', padding: '4px 12px',
                    fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', outline: 'none',
                  }}>Todos</button>
                {PRODUCTION_MEDIA.map(m => {
                  const active = prodFilterMedium === m.code;
                  return (
                    <button key={m.code} onClick={() => setProdFilterMedium(active ? '' : m.code)} title={m.name}
                      style={{
                        border: `1.5px solid ${active ? m.color : 'var(--border)'}`,
                        background: active ? m.color : 'transparent',
                        color: active ? '#fff' : m.color,
                        borderRadius: '20px', padding: '4px 12px',
                        fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem',
                        cursor: 'pointer', outline: 'none', transition: 'all 0.12s',
                      }}>{m.code}</button>
                  );
                })}
              </div>
            </div>

            {/* Tabla */}
            <div className="card table-wrapper">
              {productionLoading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Cargando…</div>
              ) : filteredProd.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                  <FlaskConical size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                  <p>No hay lotes de producción registrados.</p>
                  <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => openProdForm(prodFilterMedium ? { preselectedMedium: prodFilterMedium } : null)}>
                    <Plus size={14} style={{ marginRight: '6px' }} /> Registrar primer lote
                  </button>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Nº Lote</th>
                      <th>Fecha Prep.</th>
                      <th>Caducidad</th>
                      <th>Medio</th>
                      <th>Lote Medio</th>
                      <th>Peso (g)</th>
                      <th>Vol. (L)</th>
                      <th>Suplemento</th>
                      <th>Inicio uso</th>
                      <th>Fin uso</th>
                      <th>Responsable</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProd.map(p => {
                      const ingrs = p.production_lot_ingredients || [];
                      const mDef = PRODUCTION_MEDIA.find(m => m.code === p.medium_code);
                      const baseIngr = ingrs.find(i => i.role === 'base');
                      const suppIngr = ingrs.find(i => i.role === 'suplemento');
                      const isEditingDates = inlineProdDate?.id === p.id;
                      const inactive = isInactive(p);
                      return (
                        <tr key={p.id} style={inactive ? { background: '#f3f4f6', opacity: 0.65 } : {}}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, color: inactive ? 'var(--text-muted)' : 'inherit', whiteSpace: 'nowrap' }}>
                            {p.lot_number}
                            {inactive && (
                              <span style={{ marginLeft: '6px', fontSize: '0.68rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '3px', padding: '1px 5px', fontFamily: 'sans-serif', fontWeight: 600 }}>Fin de uso</span>
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', color: inactive ? 'var(--text-muted)' : 'inherit' }}>{fmtD(p.preparation_date)}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {p.expiry_date ? (() => {
                              const today2 = new Date().toISOString().slice(0,10);
                              const soon = new Date(); soon.setDate(soon.getDate() + 14);
                              const soonStr = soon.toISOString().slice(0,10);
                              const expired = p.expiry_date < today2;
                              const expiring = !expired && p.expiry_date <= soonStr;
                              return (
                                <span style={{
                                  fontSize: '0.8rem', fontWeight: expired || expiring ? 700 : 'inherit',
                                  color: expired ? '#b91c1c' : expiring ? '#d97706' : 'inherit',
                                  background: expired ? '#fee2e2' : expiring ? '#fef3c7' : 'transparent',
                                  borderRadius: '4px', padding: expired || expiring ? '1px 6px' : '0',
                                }}>
                                  {fmtD(p.expiry_date)}{expired ? ' ⚠' : expiring ? ' !' : ''}
                                </span>
                              );
                            })() : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>}
                          </td>
                          <td>
                            <span style={{ background: mDef ? `${mDef.color}${inactive ? '11' : '22'}` : '#eff6ff', color: inactive ? 'var(--text-muted)' : (mDef?.color || 'var(--primary)'), borderRadius: '4px', padding: '2px 8px', fontSize: '0.8rem', fontWeight: 700 }}>{p.medium_code}</span>
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {baseIngr ? (
                              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{baseIngr.lot_number_ref || baseIngr.article_lots?.lot_number || '—'}</span>
                            ) : '—'}
                          </td>
                          <td>{p.quantity_g ?? '—'}</td>
                          <td>{p.quantity_l ?? '—'}</td>
                          <td style={{ fontSize: '0.78rem' }}>
                            {suppIngr ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{suppIngr.lot_number_ref || suppIngr.article_lots?.lot_number || '—'}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{suppIngr.quantity_used} {suppIngr.unit}</span>
                              </div>
                            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>

                          {/* Fecha inicio uso — inline edit */}
                          <td style={{ whiteSpace: 'nowrap', minWidth: '110px' }}>
                            {isEditingDates ? (
                              <input type="date" className="input-field" style={{ fontSize: '0.78rem', padding: '3px 6px' }}
                                value={inlineProdDate.date_start || ''}
                                onChange={e => setInlineProdDate(d => ({ ...d, date_start: e.target.value }))} />
                            ) : (
                              <span style={{ cursor: 'pointer', color: p.date_start ? 'inherit' : 'var(--text-muted)', fontSize: '0.82rem' }}
                                onClick={() => setInlineProdDate({ id: p.id, date_start: p.date_start || '', date_end: p.date_end || '' })}>
                                {p.date_start ? fmtD(p.date_start) : <span style={{ fontSize: '0.75rem' }}>— Editar</span>}
                              </span>
                            )}
                          </td>

                          {/* Fecha fin uso — inline edit */}
                          <td style={{ whiteSpace: 'nowrap', minWidth: '110px' }}>
                            {isEditingDates ? (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <input type="date" className="input-field" style={{ fontSize: '0.78rem', padding: '3px 6px' }}
                                  value={inlineProdDate.date_end || ''}
                                  onChange={e => setInlineProdDate(d => ({ ...d, date_end: e.target.value }))} />
                                <button className="btn btn-primary" style={{ padding: '3px 8px', fontSize: '0.75rem' }} onClick={saveProdDates} disabled={savingProdDate}>
                                  {savingProdDate ? '…' : '✓'}
                                </button>
                                <button className="btn btn-secondary" style={{ padding: '3px 6px' }} onClick={() => setInlineProdDate(null)}>
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <span style={{ cursor: 'pointer', fontSize: '0.82rem', color: inactive ? '#b91c1c' : (p.date_end ? 'inherit' : 'var(--text-muted)'), fontWeight: inactive ? 600 : 'inherit' }}
                                onClick={() => setInlineProdDate({ id: p.id, date_start: p.date_start || '', date_end: p.date_end || '' })}>
                                {p.date_end ? fmtD(p.date_end) : <span style={{ fontSize: '0.75rem' }}>— Editar</span>}
                              </span>
                            )}
                          </td>

                          <td style={{ fontSize: '0.82rem' }}>{p.responsible ?? '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => openProdForm(p)}><Edit size={14} /></button>
                              <button className="btn btn-secondary" style={{ padding: '4px 8px', color: 'var(--primary)' }} title="Historial de modificaciones" onClick={() => setAmendmentHistory({ tableName: 'production_lots', recordId: p.id, recordLabel: p.lot_number })}><History size={14} /></button>
                              <button className="btn btn-secondary" style={{ padding: '4px 8px', color: 'var(--danger)', border: 'none' }} onClick={() => deleteProd(p.id)}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      }

      case 'trazabilidad': {
        const lotArticles = labRegisteredArticles.filter(a => a.requires_lot);
        const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES') : '—';
        const today = new Date().toISOString().slice(0, 10);
        const isExpired = d => d && d < today;
        const isExpiring = d => expiringLots.some(l => l.expiry_date === d);
        return (
          <div className="page-content">
            {/* Cabecera */}
            <div className="flex-between" style={{ marginBottom: '20px' }}>
              <div>
                <h2 className="page-title">Trazabilidad de Lotes</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
                  Historial de entradas por lote — {lots.length} registros
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={() => openLotForm()}>
                  <PlusCircle size={16} style={{ marginRight: '6px' }} /> Añadir entrada
                </button>
              </div>
            </div>

            {/* Filtros */}
            {(() => {
              const supplierOptions = [...new Set(lots.map(l => l.articles?.supplierName).filter(Boolean))].sort();
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 1fr 1fr auto', gap: '10px', marginBottom: '16px', background: 'var(--card-bg)', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Buscar referencia</label>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: '8px', top: '9px', color: 'var(--text-muted)' }} />
                      <input className="input-field" style={{ fontSize: '0.85rem', padding: '6px 10px 6px 28px' }} placeholder="Nombre o ID…"
                        value={lotFilterSearch} onChange={e => setLotFilterSearch(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Proveedor</label>
                    <select className="input-field" style={{ fontSize: '0.85rem', padding: '6px 10px' }} value={lotFilterSupplier} onChange={e => setLotFilterSupplier(e.target.value)}>
                      <option value="">Todos</option>
                      {supplierOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Categoría</label>
                    <select className="input-field" style={{ fontSize: '0.85rem', padding: '6px 10px' }} value={lotFilterCategory} onChange={e => setLotFilterCategory(e.target.value)}>
                      <option value="">Todas</option>
                      {LOT_REQUIRED_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Nº Lote</label>
                    <input className="input-field" style={{ fontSize: '0.85rem', padding: '6px 10px' }} placeholder="Buscar lote…" value={lotFilterLot} onChange={e => setLotFilterLot(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Desde</label>
                    <input type="date" className="input-field" style={{ fontSize: '0.85rem', padding: '6px 10px' }} value={lotFilterFrom} onChange={e => setLotFilterFrom(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Hasta</label>
                    <input type="date" className="input-field" style={{ fontSize: '0.85rem', padding: '6px 10px' }} value={lotFilterTo} onChange={e => setLotFilterTo(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button className="btn btn-secondary" title="Limpiar filtros"
                      onClick={() => { setLotFilterSearch(''); setLotFilterSupplier(''); setLotFilterCategory(''); setLotFilterLot(''); setLotFilterFrom(''); setLotFilterTo(''); }}>
                      <FilterX size={16} />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Tabla agrupada por referencia */}
            <div className="card table-wrapper">
              {lotsLoading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Cargando lotes…</div>
              ) : groupedLots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                  <Layers size={40} style={{ opacity: 0.25, marginBottom: '12px' }} />
                  <p>No hay registros de lotes.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '32px' }}></th>
                      <th>Referencia</th>
                      <th>Categoría</th>
                      <th>Último Lote</th>
                      <th>Última Entrada</th>
                      <th>Caducidad (último)</th>
                      <th style={{ textAlign: 'center' }}>Entradas</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedLots.map(group => {
                      const isOpen = expandedArticles.has(group.article_id);
                      const last = group.last;
                      const expiredLast  = isExpired(last.expiry_date);
                      const expiringLast = !expiredLast && isExpiring(last.expiry_date);
                      const toggle = () => setExpandedArticles(prev => {
                        const next = new Set(prev);
                        if (next.has(group.article_id)) next.delete(group.article_id);
                        else next.add(group.article_id);
                        return next;
                      });
                      return (
                        <React.Fragment key={group.article_id}>
                          {/* Fila resumen */}
                          <tr
                            onClick={toggle}
                            style={{ cursor: 'pointer', background: isOpen ? '#f0f7ff' : undefined, borderLeft: isOpen ? '3px solid var(--primary)' : '3px solid transparent' }}
                          >
                            <td style={{ textAlign: 'center', color: 'var(--primary)' }}>
                              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </td>
                            <td style={{ fontWeight: 600 }}>{group.name}</td>
                            <td><span style={{ background: 'var(--primary-light,#eff6ff)', color: 'var(--primary)', borderRadius: '4px', padding: '2px 7px', fontSize: '0.78rem' }}>{group.category}</span></td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{last.lot_number}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(last.reception_date)}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {last.expiry_date ? (
                                <span style={{ color: expiredLast ? '#dc2626' : expiringLast ? '#d97706' : 'inherit', fontWeight: (expiredLast || expiringLast) ? 600 : 400 }}>
                                  {fmtDate(last.expiry_date)}
                                  {expiredLast && ' ⚠'}
                                  {expiringLast && ' ⚠'}
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: '10px', padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700 }}>
                                {group.entries.length}
                              </span>
                            </td>
                            <td>
                              <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => { e.stopPropagation(); openLotForm({ article_id: group.article_id }); }}>
                                <PlusCircle size={13} /> Añadir
                              </button>
                            </td>
                          </tr>

                          {/* Filas historial expandidas */}
                          {isOpen && group.entries.map((lot, idx) => {
                            const expired   = isExpired(lot.expiry_date);
                            const expiring  = !expired && isExpiring(lot.expiry_date);
                            const isPending = lot.lot_number === 'PENDIENTE';
                            const isEditing = inlineEdit?.id === lot.id;

                            return (
                              <tr key={lot.id} style={{ background: isEditing ? '#f0f9ff' : isPending ? '#fefce8' : expired ? '#fff5f5' : expiring ? '#fffbeb' : '#f8fafc', fontSize: '0.85rem' }}>
                                <td style={{ borderLeft: `3px solid ${isEditing ? 'var(--primary)' : isPending ? '#eab308' : 'var(--primary)'}` }}></td>
                                <td style={{ paddingLeft: '28px', color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                  {idx === 0 ? '↳ Más reciente' : `↳ Entrada ${group.entries.length - idx}`}
                                </td>
                                <td></td>

                                {/* Nº Lote */}
                                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                  {isEditing ? (
                                    <input
                                      autoFocus
                                      className="input-field"
                                      style={{ fontSize: '0.82rem', padding: '3px 8px', fontFamily: 'monospace', minWidth: '130px' }}
                                      value={inlineEdit.lot_number}
                                      onChange={e => setInlineEdit(v => ({ ...v, lot_number: e.target.value }))}
                                      onKeyDown={e => { if (e.key === 'Enter') saveInlineLot(); if (e.key === 'Escape') setInlineEdit(null); }}
                                      placeholder="Nº de lote"
                                    />
                                  ) : isPending ? (
                                    <span
                                      style={{ color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '4px', padding: '2px 8px', fontSize: '0.78rem', cursor: 'pointer' }}
                                      title="Haz clic para introducir el número de lote"
                                      onClick={() => setInlineEdit({ id: lot.id, lot_number: '', expiry_date: lot.expiry_date || '' })}
                                    >✏ Introducir lote</span>
                                  ) : lot.lot_number}
                                </td>

                                {/* F. Recepción */}
                                <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{fmtDate(lot.reception_date)}</td>

                                {/* Caducidad */}
                                <td style={{ whiteSpace: 'nowrap' }}>
                                  {isEditing ? (
                                    <input
                                      type="date"
                                      className="input-field"
                                      style={{ fontSize: '0.82rem', padding: '3px 8px' }}
                                      value={inlineEdit.expiry_date}
                                      onChange={e => setInlineEdit(v => ({ ...v, expiry_date: e.target.value }))}
                                      onKeyDown={e => { if (e.key === 'Enter') saveInlineLot(); if (e.key === 'Escape') setInlineEdit(null); }}
                                    />
                                  ) : lot.expiry_date ? (
                                    <span style={{ color: expired ? '#dc2626' : expiring ? '#d97706' : 'inherit', fontWeight: (expired || expiring) ? 600 : 400 }}>
                                      {fmtDate(lot.expiry_date)}{expired && ' ⚠ Caducado'}{expiring && ' ⚠ Próximo'}
                                    </span>
                                  ) : <span style={{ color: '#92400e' }}>— sin caducidad</span>}
                                </td>

                                <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{lot.quantity ?? '—'} ud</td>

                                {/* Acciones */}
                                <td>
                                  {isEditing ? (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      <button className="btn btn-primary" style={{ padding: '3px 10px', fontSize: '0.78rem' }} onClick={saveInlineLot} disabled={savingInline}>
                                        {savingInline ? '…' : 'Guardar'}
                                      </button>
                                      <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '0.78rem' }} onClick={() => setInlineEdit(null)}>Cancelar</button>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      {lot.order_id && (
                                        <button
                                          className="btn btn-secondary"
                                          style={{ padding: '3px 7px', color: 'var(--primary)' }}
                                          title="Ver pedido original"
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            setLoadingOrderModal(true);
                                            setViewOrderFromLot({ id: lot.order_id, _loading: true });
                                            const { data, error } = await supabase
                                              .from('orders')
                                              .select('*')
                                              .eq('id', lot.order_id)
                                              .single();
                                            setLoadingOrderModal(false);
                                            setViewOrderFromLot(error || !data ? { id: lot.order_id, _notFound: true } : data);
                                          }}
                                        ><ExternalLink size={13} /></button>
                                      )}
                                      <button className="btn btn-secondary" style={{ padding: '3px 7px' }} title="Editar" onClick={() => setInlineEdit({ id: lot.id, lot_number: lot.lot_number === 'PENDIENTE' ? '' : lot.lot_number, expiry_date: lot.expiry_date || '' })}><Edit size={13} /></button>
                                      <button className="btn btn-secondary" style={{ padding: '3px 7px', color: 'var(--danger)', border: 'none' }} title="Eliminar" onClick={() => deleteLot(lot.id)}><Trash2 size={13} /></button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal detalle pedido desde trazabilidad */}
            {viewOrderFromLot && (
              <div className="modal-overlay" onClick={() => setViewOrderFromLot(null)}>
                <div className="modal" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Package size={18} /> Pedido {viewOrderFromLot.id}
                    </h2>
                    <button className="modal-close" onClick={() => setViewOrderFromLot(null)}><X size={20} /></button>
                  </div>

                  {viewOrderFromLot._loading ? (
                    <div className="modal-body" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      Cargando pedido…
                    </div>
                  ) : viewOrderFromLot._notFound ? (
                    <div className="modal-body" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      Pedido no encontrado en el sistema.
                    </div>
                  ) : (
                    <div className="modal-body" style={{ display: 'grid', gap: '16px' }}>
                      {/* Cabecera del pedido */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Fecha</div>
                          <div style={{ fontWeight: 600 }}>{viewOrderFromLot.date}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Proveedor</div>
                          <div style={{ fontWeight: 600 }}>{viewOrderFromLot.supplier}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Estado</div>
                          <div><span style={{ background: viewOrderFromLot.status === 'Completado' ? '#dcfce7' : '#fef9c3', color: viewOrderFromLot.status === 'Completado' ? '#166534' : '#854d0e', borderRadius: '4px', padding: '2px 8px', fontSize: '0.8rem', fontWeight: 600 }}>{viewOrderFromLot.status}</span></div>
                        </div>
                      </div>

                      {/* Albarán */}
                      {viewOrderFromLot.deliveryNote && (
                        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '10px 14px' }}>
                          <div style={{ fontSize: '0.72rem', color: '#0369a1', textTransform: 'uppercase', marginBottom: '4px' }}>Albarán / Nº Entrega</div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0c4a6e' }}>{viewOrderFromLot.deliveryNote}</div>
                        </div>
                      )}

                      {/* Incidencias */}
                      {viewOrderFromLot.incidents && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem' }}>
                          <div style={{ fontSize: '0.72rem', color: '#92400e', textTransform: 'uppercase', marginBottom: '4px' }}>Incidencias</div>
                          <div>{viewOrderFromLot.incidents}</div>
                        </div>
                      )}

                      {/* Artículos recibidos */}
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Artículos recibidos</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Referencia</th>
                              <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600 }}>Pedido</th>
                              <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600 }}>Recibido</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(viewOrderFromLot.cart || []).map((item, i) => {
                              const recibido = viewOrderFromLot.receivedMapping?.[item.article?.id] ?? '—';
                              const esCompleto = typeof recibido === 'number' && recibido >= item.quantity;
                              return (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : '#f8fafc' }}>
                                  <td style={{ padding: '7px 8px' }}>{item.article?.name || item.article?.id}</td>
                                  <td style={{ textAlign: 'center', padding: '7px 8px' }}>{item.quantity}</td>
                                  <td style={{ textAlign: 'center', padding: '7px 8px' }}>
                                    <span style={{ fontWeight: 600, color: esCompleto ? '#16a34a' : typeof recibido === 'number' ? '#d97706' : 'var(--text-muted)' }}>
                                      {recibido}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setViewOrderFromLot(null)}>Cerrar</button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal añadir / editar lote */}
            {showLotForm && (
              <div className="modal-overlay" onClick={() => setShowLotForm(false)}>
                <div className="modal" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h2 className="modal-title">{editingLot ? 'Editar registro de lote' : 'Registrar entrada de lote'}</h2>
                    <button className="modal-close" onClick={() => setShowLotForm(false)}><X size={20} /></button>
                  </div>
                  <div className="modal-body" style={{ display: 'grid', gap: '14px' }}>
                    {!editingLot && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '0.82rem', color: '#1d4ed8' }}>
                        <CalendarClock size={15} />
                        Puedes seleccionar una fecha de entrada pasada para registrar lotes con carácter retroactivo.
                      </div>
                    )}
                    <div className="input-group">
                      <label className="input-label">Referencia *</label>
                      <select className="input-field" value={lotForm.article_id} onChange={e => setLotForm(f => ({ ...f, article_id: e.target.value }))}>
                        <option value="">— Selecciona referencia —</option>
                        {labRegisteredArticles.filter(a => a.requires_lot).map(a => (
                          <option key={a.id} value={a.id}>{a.name} ({a.category})</option>
                        ))}
                        <optgroup label="Otras referencias">
                          {labRegisteredArticles.filter(a => !a.requires_lot).map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="input-group">
                        <label className="input-label">Nº Lote *</label>
                        <input className="input-field" placeholder="Ej: LT-2025-001" value={lotForm.lot_number} onChange={e => setLotForm(f => ({ ...f, lot_number: e.target.value }))} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Cantidad</label>
                        <input type="number" className="input-field" placeholder="Unidades" value={lotForm.quantity} onChange={e => setLotForm(f => ({ ...f, quantity: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="input-group">
                        <label className="input-label">Fecha de Entrada *</label>
                        <input type="date" className="input-field" value={lotForm.reception_date} onChange={e => setLotForm(f => ({ ...f, reception_date: e.target.value }))} />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Fecha de Caducidad</label>
                        <input type="date" className="input-field" value={lotForm.expiry_date} onChange={e => setLotForm(f => ({ ...f, expiry_date: e.target.value }))} />
                      </div>
                    </div>
                    <div className="input-group">
                      <label className="input-label">Recibido por</label>
                      <input className="input-field" placeholder="Nombre del responsable" value={lotForm.received_by} onChange={e => setLotForm(f => ({ ...f, received_by: e.target.value }))} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Notas</label>
                      <textarea className="input-field" rows={2} placeholder="Observaciones opcionales…" value={lotForm.notes} onChange={e => setLotForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>

                    {editingLot && (lotForm.expiry_date || null) !== (editingLot.expiry_date || null) && (
                      <div style={{ borderTop: '2px solid var(--warning)', paddingTop: '14px', display: 'grid', gap: '10px' }}>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#856404', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={14} /> La fecha de caducidad ha cambiado — registro ISO 17025 obligatorio
                        </p>
                        <div className="input-group">
                          <label className="input-label">Nombre de quien modifica <span style={{ color: 'var(--danger)' }}>*</span></label>
                          <input className="input-field" placeholder="Nombre completo" value={lotAmendBy} onChange={e => setLotAmendBy(e.target.value)} />
                        </div>
                        <div className="input-group">
                          <label className="input-label">Motivo de la modificación <span style={{ color: 'var(--danger)' }}>*</span></label>
                          <input className="input-field" placeholder="Motivo del cambio de caducidad" value={lotAmendReason} onChange={e => setLotAmendReason(e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setShowLotForm(false)}>Cancelar</button>
                    {editingLot && (
                      <button className="btn btn-secondary"
                        style={{ color: 'var(--danger)', marginRight: 'auto' }}
                        onClick={() => {
                          if (window.confirm('¿Eliminar este lote? Esta acción no se puede deshacer.')) {
                            deleteLot(editingLot.id);
                            setShowLotForm(false);
                          }
                        }}>
                        <Trash2 size={14} style={{ marginRight: '4px' }} /> Eliminar lote
                      </button>
                    )}
                    {editingLot && (
                      <button className="btn btn-secondary" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => { setShowLotForm(false); setAmendmentHistory({ tableName: 'article_lots', recordId: editingLot.id, recordLabel: editingLot.lot_number }); }}>
                        <History size={14} /> Ver historial de cambios
                      </button>
                    )}
                    <button className="btn btn-primary" onClick={saveLot} disabled={savingLot}>
                      {savingLot ? 'Guardando…' : editingLot ? 'Guardar cambios' : 'Registrar entrada'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="layout">
      {/* Overlay móvil */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ padding: '0 10px', height: '180px', position: 'relative' }}>
          <img src={logo} alt="HSLAB Logo" className="sidebar-logo" />
          <button
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'none' }}
            className="sidebar-close"
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <button 
            className="btn btn-secondary" 
            onClick={onBackToHub}
            style={{ 
              width: '100%', 
              backgroundColor: 'rgba(0,0,0,0.2)', 
              color: 'white', 
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            ← Volver al Hub
          </button>
        </div>
        <nav className="nav-links" style={{ marginTop: '12px' }}>
          <div
            className={`nav-item ${activeTab === 'pedidos' ? 'active' : ''}`}
            onClick={() => { setActiveTab('pedidos'); setSidebarOpen(false); }}
          >
            <ClipboardList size={20} style={{ marginRight: '12px' }} />
            Pedidos
          </div>
          <div
            className={`nav-item ${activeTab === 'stocks' ? 'active' : ''}`}
            onClick={() => { setActiveTab('stocks'); setSidebarOpen(false); }}
          >
            <PackageSearch size={20} style={{ marginRight: '12px' }} />
            Control de Stocks
          </div>
          <div
            className={`nav-item ${activeTab === 'articulos' ? 'active' : ''}`}
            onClick={() => { setActiveTab('articulos'); setSidebarOpen(false); }}
          >
            <Box size={20} style={{ marginRight: '12px' }} />
            Artículos
          </div>
          <div
            className={`nav-item ${activeTab === 'proveedores' ? 'active' : ''}`}
            onClick={() => { setActiveTab('proveedores'); setSidebarOpen(false); }}
          >
            <Truck size={20} style={{ marginRight: '12px' }} />
            Proveedores
          </div>
          <div
            className={`nav-item ${activeTab === 'trazabilidad' ? 'active' : ''}`}
            onClick={() => { setActiveTab('trazabilidad'); setSidebarOpen(false); }}
            style={{ position: 'relative' }}
          >
            <Layers size={20} style={{ marginRight: '12px' }} />
            Trazabilidad
            {expiringLots.length > 0 && (
              <span style={{ position: 'absolute', right: '12px', background: '#f59e0b', color: '#fff', borderRadius: '10px', fontSize: '0.7rem', padding: '1px 6px', fontWeight: 700 }}>
                {expiringLots.length}
              </span>
            )}
          </div>
          <div
            className={`nav-item ${activeTab === 'produccion' ? 'active' : ''}`}
            onClick={() => { setActiveTab('produccion'); setSidebarOpen(false); }}
          >
            <FlaskConical size={20} style={{ marginRight: '12px' }} />
            Producción / Uso de Lotes
          </div>
          <div
            className={`nav-item ${activeTab === 'analisis' ? 'active' : ''}`}
            onClick={() => { setActiveTab('analisis'); setSidebarOpen(false); }}
          >
            <TrendingUp size={20} style={{ marginRight: '12px' }} />
            Análisis
          </div>

          {role === 'admin' && (
            <div 
              className="nav-item"
              onClick={() => onSelectModule('usuarios')}
              style={{ color: 'rgba(255,255,255,0.6)', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}
            >
              <Settings size={20} style={{ marginRight: '12px' }} />
              Accesos y Roles
            </div>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="hamburger" onClick={() => setSidebarOpen(true)} title="Menú">
              <Menu size={22} />
            </button>
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
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
              backgroundColor: selectedLab === 'HSLAB Canarias' ? '#16A34A' : '#0076CE',
              color: 'white', letterSpacing: '0.03em'
            }}>
              {selectedLab === 'HSLAB Canarias' ? 'Canarias' : 'Baleares'}
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
                  <select
                    name="category"
                    className="input-field"
                    defaultValue={editingArticle?.category || ''}
                    required
                  >
                    <option value="" disabled>— Selecciona categoría —</option>
                    {/* Categorías estándar fijas */}
                    {[
                      'Medios de Cultivo',
                      'Cepas de Referencia',
                      'Reactivos Químicos',
                      'Consumibles',
                      'Filtración',
                      'Material de Vidrio/PP',
                      'Kits Rápidos',
                      'Desinfección',
                      'EPI',
                      'Equipos',
                      'Fungibles Equipos',
                      'Otros',
                    ].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    {/* Categorías adicionales ya existentes en el lab que no estén en la lista fija */}
                    {uniqueCategories
                      .filter(c => !['Medios de Cultivo','Cepas de Referencia','Reactivos Químicos','Consumibles','Filtración','Material de Vidrio/PP','Kits Rápidos','Desinfección','EPI','Equipos','Fungibles Equipos','Otros'].includes(c))
                      .map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))
                    }
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: modalRequiresLot ? '#f0fdf4' : '#f8fafc', border: `1px solid ${modalRequiresLot ? '#86efac' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s' }}
                  onClick={() => setModalRequiresLot(v => !v)}
                >
                  <div style={{ width: '40px', height: '22px', borderRadius: '11px', flexShrink: 0, background: modalRequiresLot ? '#22c55e' : '#cbd5e1', position: 'relative', transition: 'background 0.2s' }}>
                    <div style={{ position: 'absolute', top: '3px', left: modalRequiresLot ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: modalRequiresLot ? '#166534' : 'var(--secondary)' }}>Requiere número de lote</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '1px' }}>Al recepcionar este artículo se exigirá lote y fecha de caducidad</div>
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Tipo de Análisis</label>
                  <select
                    name="analysis_type"
                    className="input-field"
                    defaultValue={editingArticle?.analysis_type || ''}
                  >
                    <option value="">— Sin asignar —</option>
                    <option value="Legionella">Legionella</option>
                    <option value="Alimentos">Alimentos</option>
                    <option value="Piscinas">Piscinas</option>
                  </select>
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
                  <label className="input-label">Precio Est. (sin IVA)</label>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
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
        articles={labArticles}
        suppliers={labSuppliers}
        defaultSupplierForOrder={defaultSupplierForOrder}
        initialCart={initialCartForOrder}
        onSaveOrder={handleSaveOrder}
        editingOrder={editingOrder}
        selectedLab={selectedLab}
        onQuickCreateArticle={handleQuickCreateArticle}
      />

      <ReceiveOrderModal
        isOpen={isReceiveModalOpen}
        onClose={() => {
          setIsReceiveModalOpen(false);
          setReceivingOrder(null);
        }}
        order={receivingOrder}
        onOrderReceived={handleOrderReceived}
        onRegisterEquipment={onRegisterEquipment}
        selectedLab={selectedLab}
        articles={articles}
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

      <AmendmentReasonModal
        isOpen={!!amendmentModal}
        onClose={() => setAmendmentModal(null)}
        onConfirm={startAmendment}
        title={amendmentModal?.title}
        recordLabel={amendmentModal?.recordLabel}
        isProcessing={amendmentSaving}
      />

      <AmendmentHistoryModal
        isOpen={!!amendmentHistory}
        onClose={() => setAmendmentHistory(null)}
        tableName={amendmentHistory?.tableName}
        recordId={amendmentHistory?.recordId}
        recordLabel={amendmentHistory?.recordLabel}
      />

      <ViewOrderModal 
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setViewingOrder(null);
        }}
        order={viewingOrder}
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

      <SupplierEvalModal
        isOpen={!!evalModalSupplier}
        onClose={() => setEvalModalSupplier(null)}
        supplier={evalModalSupplier}
        lab={selectedLab}
        onSaved={fetchSuppliers}
      />

      <SupplierDocsModal
        isOpen={!!docsModalSupplier}
        onClose={() => setDocsModalSupplier(null)}
        supplier={docsModalSupplier}
        lab={selectedLab}
      />

      <InvoiceImporter
        isOpen={isInvoiceImporterOpen}
        onClose={() => setIsInvoiceImporterOpen(false)}
        existingArticles={articles}
        onImportDone={fetchArticles}
        selectedLab={selectedLab}
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
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={async () => {
                  if (window.confirm(`¿Estás seguro de que deseas eliminar los ${selectedArticles.length} artículos seleccionados de forma permanente?`)) {
                    setIsProcessing(true);
                    const { error } = await supabase.from('articles').delete().in('id', selectedArticles);
                    setIsProcessing(false);
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
                <Trash2 size={18} /> Eliminar Selección
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
                          const exists = labSuppliers.some(s => s.name.toLowerCase() === updates.supplierName.toLowerCase());
                          if (!exists) {
                            const newId = `PROV-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
                            await supabase.from('suppliers').insert({ id: newId, name: updates.supplierName, lab: selectedLab });
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

export default PurchasingModule;

