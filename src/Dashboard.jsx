import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Package,
  Calendar,
  Download,
  Search,
  ArrowUpRight,
  Check,
  Clock,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  ShoppingCart,
  FlaskConical,
  Wrench
} from 'lucide-react';

const COLORS = ['#0076CE', '#34D399', '#FBBF24', '#F87171', '#818CF8', '#A78BFA'];

const STATUS_CONFIG = {
  'Completado':              { label: 'Completado',           color: '#16a34a', bg: '#D4EDDA', icon: Check        },
  'Pendiente':               { label: 'Pendiente',            color: '#0C5460', bg: '#D1ECF1', icon: ShoppingCart },
  'Incompleto':              { label: 'Incompleto',           color: '#856404', bg: '#FFF3CD', icon: AlertCircle  },
  'Pendiente de Aprobación': { label: 'Pdte. Aprobación',    color: '#5B21B6', bg: '#EDE9F6', icon: Clock        },
};

function parseOrderDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr.includes('-')) return new Date(dateStr);
  const [d, m, y] = dateStr.split('/');
  return new Date(y, m - 1, d);
}

// Para contabilización económica usa la fecha de aprobación cuando existe
function accountingDate(order) {
  return parseOrderDate(order.approval_date || order.date);
}

export default function Dashboard({ orders, articles, onTabChange, onNavigateToPedidos, onNavigateToArticles, role = 'operations', monthlyBudgets = {}, onSaveBudget }) {
  const [monthFilter, setMonthFilter]           = useState('');
  const [dateRange, setDateRange]               = useState({ start: '', end: '' });
  const [spendingSupplier, setSpendingSupplier] = useState('Todos');
  const [stockSupplier, setStockSupplier]       = useState('Todos');
  const [searchRef, setSearchRef]               = useState('');
  const [statusFilter, setStatusFilter]         = useState('Todos');
  // Local editing state: { 'YYYY-MM': string } — only active while input is focused
  const [editingBudgets, setEditingBudgets]     = useState({});
  const [analysisFilter, setAnalysisFilter]     = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('');

  // Months available derived from orders
  const availableMonths = useMemo(() => {
    const seen = new Set();
    orders.forEach(o => {
      const d = accountingDate(o);
      if (d && !isNaN(d)) {
        seen.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    });
    return [...seen].sort((a, b) => b.localeCompare(a));
  }, [orders]);

  // Base filter: month OR date range + supplier (used for status summary cards — ignores statusFilter)
  const baseFiltered = useMemo(() => {
    return orders.filter(order => {
      const d = accountingDate(order);
      if (!d) return false;

      let matchesDate = true;
      if (monthFilter) {
        const [fy, fm] = monthFilter.split('-').map(Number);
        matchesDate = d.getFullYear() === fy && d.getMonth() + 1 === fm;
      } else {
        if (dateRange.start && d < new Date(dateRange.start)) matchesDate = false;
        if (dateRange.end   && d > new Date(dateRange.end))   matchesDate = false;
      }

      const matchesSupplier = spendingSupplier === 'Todos' || order.supplier === spendingSupplier;
      return matchesDate && matchesSupplier;
    });
  }, [orders, monthFilter, dateRange, spendingSupplier]);

  // Map article id → analysis_type and account_type from the articles catalogue
  const articleAnalysisMap = useMemo(() => {
    const map = {};
    articles.forEach(a => { if (a.id) map[a.id] = a.analysis_type || null; });
    return map;
  }, [articles]);

  const articleAccountTypeMap = useMemo(() => {
    const map = {};
    articles.forEach(a => { if (a.id) map[a.id] = a.account_type || 'OPEX'; });
    return map;
  }, [articles]);

  // Full filtered (includes statusFilter + analysisFilter + accountTypeFilter) — used for charts and reference table
  const filteredData = useMemo(() => {
    let data = statusFilter === 'Todos' ? baseFiltered : baseFiltered.filter(o => o.status === statusFilter);
    if (analysisFilter) {
      data = data.filter(o =>
        o.cart && o.cart.some(item => {
          const aType = item.article?.analysis_type || articleAnalysisMap[item.article?.id] || null;
          return aType === analysisFilter;
        })
      );
    }
    if (accountTypeFilter) {
      data = data.filter(o =>
        o.cart && o.cart.some(item => {
          const aType = item.article?.account_type || articleAccountTypeMap[item.article?.id] || 'OPEX';
          return aType === accountTypeFilter;
        })
      );
    }
    return data;
  }, [baseFiltered, statusFilter, analysisFilter, accountTypeFilter, articleAnalysisMap, articleAccountTypeMap]);

  // Orders "realizados": sent to supplier (excludes Pendiente de Aprobación and Rechazado)
  // Used exclusively for the monthly budget control table
  const REALIZED_STATUSES = new Set(['Completado', 'Incompleto', 'Pendiente']);
  const realizedOrders = useMemo(() =>
    orders.filter(o => REALIZED_STATUSES.has(o.status)),
  [orders]);

  // Monthly spending computed only from realized orders (independent of all filters)
  const budgetByMonth = useMemo(() => {
    const map = {};
    realizedOrders.forEach(o => {
      const d = accountingDate(o);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + (o.total || 0);
    });
    return Object.entries(map)
      .map(([month, value]) => {
        const [y, m] = month.split('-');
        const label = new Date(Number(y), Number(m) - 1, 1)
          .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return { month, label: label.charAt(0).toUpperCase() + label.slice(1), value };
      })
      .sort((a, b) => b.month.localeCompare(a.month)); // most recent first
  }, [realizedOrders]);

  // Status summary (always all statuses, uses baseFiltered)
  const statusSummary = useMemo(() => {
    const map = {};
    Object.keys(STATUS_CONFIG).forEach(s => { map[s] = { count: 0, total: 0 }; });
    baseFiltered.forEach(o => {
      if (map[o.status]) {
        map[o.status].count++;
        map[o.status].total += o.total || 0;
      }
    });
    return map;
  }, [baseFiltered]);

  // Regex para detectar categorías de equipos/equipamiento
  const EQUIPO_RE = /equipo|equipamiento|instrument|aparato|maquina|maquinaria/i;

  // Aggregate Stats (for charts and KPIs)
  const stats = useMemo(() => {
    let totalSpent = 0;
    let totalItemsPurchased = 0;
    const refMap = new Map();
    const supplierSpending = {};
    const monthlySpending = {};
    const categorySpending = {};
    const analysisSpending = { 'Legionella': 0, 'Alimentos': 0, 'Piscinas': 0, 'Sin asignar': 0 };

    filteredData.forEach(order => {
      totalSpent += order.total || 0;
      supplierSpending[order.supplier] = (supplierSpending[order.supplier] || 0) + order.total;

      const d = accountingDate(order);
      if (d) {
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + (order.total || 0);
      }

      if (order.cart) {
        order.cart.forEach(item => {
          if (!item.article) return;
          const ref = item.article.id;
          const qty = item.quantity || 0;
          const priceStr = String(item.article.price || '0').replace('€', '').replace(',', '.').trim();
          const price = parseFloat(priceStr) || 0;
          const subtotal = price * qty;
          totalItemsPurchased += qty;

          // Acumular gasto por categoría
          const cat = (item.article.category || 'Sin categoría').trim();
          categorySpending[cat] = (categorySpending[cat] || 0) + subtotal;

          // Acumular gasto por grupo de análisis
          const rawAType = item.article.analysis_type || articleAnalysisMap[ref] || null;
          const aKey = ['Legionella', 'Alimentos', 'Piscinas'].includes(rawAType) ? rawAType : 'Sin asignar';
          analysisSpending[aKey] = (analysisSpending[aKey] || 0) + subtotal;

          if (!refMap.has(ref)) {
            refMap.set(ref, { id: ref, name: item.article.name, category: item.article.category || '', supplier: item.article.supplierName, totalQty: 0, totalCost: 0, count: 0 });
          }
          const cur = refMap.get(ref);
          cur.totalQty  += qty;
          cur.totalCost += subtotal;
          cur.count     += 1;
        });
      }
    });

    const refStats = Array.from(refMap.values())
      .map(r => ({ ...r, avgPrice: r.totalCost / r.totalQty }))
      .filter(r => !searchRef || r.name.toLowerCase().includes(searchRef.toLowerCase()) || r.id.toLowerCase().includes(searchRef.toLowerCase()))
      .sort((a, b) => b.totalCost - a.totalCost);

    const supplierChartData = Object.entries(supplierSpending)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const monthlyChartData = Object.entries(monthlySpending)
      .map(([month, value]) => {
        const [y, m] = month.split('-');
        const label = new Date(Number(y), Number(m) - 1, 1)
          .toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        return { month, label: label.charAt(0).toUpperCase() + label.slice(1), value };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    // Desglose por categoría: separar equipos del resto
    let spentEquipos = 0;
    let spentConsumo = 0;
    const categoryChartData = Object.entries(categorySpending)
      .map(([name, value]) => {
        const isEquipo = EQUIPO_RE.test(name);
        if (isEquipo) spentEquipos += value;
        else spentConsumo += value;
        return { name, value, isEquipo };
      })
      .sort((a, b) => b.value - a.value);

    const currentStockValuation = articles
      .filter(art => stockSupplier === 'Todos' || art.supplierName === stockSupplier)
      .reduce((sum, art) => {
        const priceStr = String(art.price || '0').replace('€', '').replace(',', '.').trim();
        return sum + (parseFloat(priceStr) || 0) * (art.stock || 0);
      }, 0);

    return { totalSpent, totalOrders: filteredData.length, totalItemsPurchased, refStats, supplierChartData, monthlyChartData, currentStockValuation, monthlySpendingMap: monthlySpending, categoryChartData, spentEquipos, spentConsumo, analysisSpending };
  }, [filteredData, searchRef, articles, stockSupplier, articleAnalysisMap]);

  const uniqueSuppliers = useMemo(() => {
    const names = [...new Set([
      ...orders.map(o => o.supplier),
      ...articles.filter(a => a?.supplierName).map(a => a.supplierName)
    ].filter(Boolean))];
    return ['Todos', ...names.sort((a, b) => a.localeCompare(b))];
  }, [orders, articles]);

  const monthLabel = (ym) => {
    const [y, m] = ym.split('-');
    const s = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  // KPI presupuesto: mes filtrado o mes actual
  const now = new Date();
  const kpiMonth  = monthFilter || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const kpiBudget = monthlyBudgets[kpiMonth] || 0;
  const kpiSpent  = realizedOrders
    .filter(o => { const d = accountingDate(o); return d && `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === kpiMonth; })
    .reduce((s, o) => s + (o.total || 0), 0);
  const kpiLabelStr = monthLabel(kpiMonth);
  const kpiIsOver   = kpiBudget > 0 && kpiSpent > kpiBudget;

  return (
    <div className="page-content" style={{ paddingBottom: '40px' }}>

      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '24px' }}>
        <div>
          <h2 className="page-title">Análisis y Reportes</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cuadro de mando para negociación y control de gasto</p>
        </div>
        <button className="btn btn-secondary" onClick={() => window.print()}>
          <Download size={18} style={{ marginRight: '8px' }} /> Exportar Vista
        </button>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '12px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Mes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Período</span>
            <select className="input-field" style={{ margin: 0, padding: '7px 10px', fontSize: '0.85rem', height: 'auto' }}
              value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
              <option value="">Todos los meses</option>
              {availableMonths.map(ym => <option key={ym} value={ym}>{monthLabel(ym)}</option>)}
            </select>
          </div>

          <div style={{ width: '1px', height: '36px', backgroundColor: 'var(--border)', alignSelf: 'flex-end', marginBottom: '2px' }} />

          {/* Estado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '170px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Estado</span>
            <select className="input-field" style={{ margin: 0, padding: '7px 10px', fontSize: '0.85rem', height: 'auto' }}
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="Todos">Todos los estados</option>
              <option value="Completado">Completado</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Incompleto">Incompleto</option>
              <option value="Pendiente de Aprobación">Pendiente de Aprobación</option>
              <option value="Rechazado">Rechazado</option>
            </select>
          </div>

          {/* Proveedor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '170px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Proveedor</span>
            <select className="input-field" style={{ margin: 0, padding: '7px 10px', fontSize: '0.85rem', height: 'auto' }}
              value={spendingSupplier} onChange={e => setSpendingSupplier(e.target.value)}>
              {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ width: '1px', height: '36px', backgroundColor: 'var(--border)', alignSelf: 'flex-end', marginBottom: '2px' }} />

          {/* Grupo de análisis */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Grupo análisis</span>
            <select className="input-field" style={{ margin: 0, padding: '7px 10px', fontSize: '0.85rem', height: 'auto' }}
              value={analysisFilter} onChange={e => setAnalysisFilter(e.target.value)}>
              <option value="">Todos</option>
              <option value="Legionella">Legionella</option>
              <option value="Alimentos">Alimentos</option>
              <option value="Piscinas">Piscinas</option>
            </select>
          </div>

          {/* CAPEX / OPEX */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Tipo gasto</span>
            <select className="input-field" style={{ margin: 0, padding: '7px 10px', fontSize: '0.85rem', height: 'auto' }}
              value={accountTypeFilter} onChange={e => setAccountTypeFilter(e.target.value)}>
              <option value="">CAPEX + OPEX</option>
              <option value="OPEX">Solo OPEX</option>
              <option value="CAPEX">Solo CAPEX</option>
            </select>
          </div>

          <div style={{ width: '1px', height: '36px', backgroundColor: 'var(--border)', alignSelf: 'flex-end', marginBottom: '2px' }} />

          {/* Buscar referencia */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Buscar artículo</span>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
              <input type="text" className="input-field" placeholder="Nombre o referencia…"
                style={{ margin: 0, paddingLeft: '32px', padding: '7px 10px 7px 32px', fontSize: '0.85rem', height: 'auto' }}
                value={searchRef} onChange={e => setSearchRef(e.target.value)} />
            </div>
          </div>

          {/* Reset */}
          {(monthFilter || statusFilter !== 'Todos' || spendingSupplier !== 'Todos' || analysisFilter || accountTypeFilter || searchRef) && (
            <button
              onClick={() => { setMonthFilter(''); setStatusFilter('Todos'); setSpendingSupplier('Todos'); setAnalysisFilter(''); setAccountTypeFilter(''); setSearchRef(''); }}
              style={{ alignSelf: 'flex-end', marginBottom: '2px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '7px 12px', fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(0,118,206,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Gasto total</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.totalSpent.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}
          onClick={() => onTabChange && onTabChange('pedidos')}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(251,191,36,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
            <Calendar size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Pedidos</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.totalOrders}</div>
          </div>
          <ArrowUpRight size={16} color="var(--text-muted)" />
        </div>

        {role === 'admin' ? (
          <div className="card" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Presupuesto</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{kpiLabelStr}</span>
            </div>
            {kpiBudget > 0 ? (
              <>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
                  {kpiBudget.toLocaleString('es-ES')} €
                </div>
                <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${Math.min(100, (kpiSpent / kpiBudget) * 100)}%`,
                    backgroundColor: kpiIsOver ? 'var(--danger)' : 'var(--primary)',
                    borderRadius: '4px', transition: 'width 0.4s'
                  }} />
                </div>
                <div style={{ fontSize: '0.7rem', marginTop: '6px', color: kpiIsOver ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {kpiIsOver
                    ? `Sobrecoste de ${(kpiSpent - kpiBudget).toFixed(2)} €`
                    : `${((kpiSpent / kpiBudget) * 100).toFixed(0)}% consumido · ${kpiSpent.toFixed(2)} €`}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                Sin presupuesto definido.<br/>
                <span style={{ fontSize: '0.75rem' }}>Edítalo en la tabla inferior.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}
            onClick={() => onTabChange && onTabChange('pedidos')}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(52,211,153,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
              <Check size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Pedidos Completados</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{statusSummary['Completado']?.count || 0}</div>
            </div>
            <ArrowUpRight size={16} color="var(--text-muted)" />
          </div>
        )}

        <div>
          <div className="input-group" style={{ marginBottom: '8px' }}>
            <select className="input-field" value={stockSupplier} onChange={e => setStockSupplier(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '0.85rem', height: 'auto', backgroundColor: 'var(--surface)' }}>
              <option value="Todos">Ver Valoración Global...</option>
              {uniqueSuppliers.filter(s => s !== 'Todos').map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid var(--primary)', backgroundColor: 'var(--primary-light)', margin: 0 }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <Package size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>Valor Stock en Almacén</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)' }}>
                {stats.currentStockValuation.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} €
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                {stockSupplier === 'Todos' ? 'Total Catálogo' : `Filtrado por "${stockSupplier}"`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desglose OPEX vs CAPEX — clickables como filtro */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* OPEX — Consumibles / Reactivos */}
        {[
          { key: 'OPEX', label: 'OPEX · Consumibles / Reactivos', value: stats.spentConsumo, color: '#0891B2', bg: 'rgba(8,145,178,0.08)', Icon: FlaskConical },
          { key: 'CAPEX', label: 'CAPEX · Equipos / Equipamiento', value: stats.spentEquipos, color: '#D97706', bg: 'rgba(217,119,6,0.08)', Icon: Wrench },
        ].map(({ key, label, value, color, bg, Icon }) => {
          const isActive = accountTypeFilter === key;
          return (
            <div
              key={key}
              className="card"
              onClick={() => setAccountTypeFilter(isActive ? '' : key)}
              style={{
                padding: '20px', display: 'flex', alignItems: 'center', gap: '16px',
                borderTop: `3px solid ${color}`,
                cursor: 'pointer', transition: 'all 0.2s',
                outline: isActive ? `2px solid ${color}` : '2px solid transparent',
                backgroundColor: isActive ? bg : undefined,
              }}
              title={isActive ? 'Quitar filtro' : `Filtrar por ${key}`}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
                <Icon size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
                  {isActive && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color, backgroundColor: bg, border: `1px solid ${color}`, borderRadius: '4px', padding: '1px 6px' }}>
                      Filtro activo
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>
                  {value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </div>
                {stats.totalSpent > 0 && (
                  <div style={{ marginTop: '6px' }}>
                    <div style={{ height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px' }}>
                      <div style={{ height: '5px', width: `${Math.min(100, (value / stats.totalSpent) * 100).toFixed(1)}%`, backgroundColor: color, borderRadius: '3px', transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {((value / stats.totalSpent) * 100).toFixed(1)}% del gasto total
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Gasto por Grupo de Análisis */}
      {(() => {
        const ANALYSIS_CFG = {
          'Legionella':   { color: '#92400e', bg: '#fef3c7', border: '#F59E0B' },
          'Alimentos':    { color: '#166534', bg: '#dcfce7', border: '#16a34a' },
          'Piscinas':     { color: '#1e40af', bg: '#dbeafe', border: '#3B82F6' },
          'Sin asignar':  { color: 'var(--text-muted)', bg: 'var(--surface)', border: '#cbd5e1' },
        };
        const totalAnalysis = Object.values(stats.analysisSpending).reduce((s, v) => s + v, 0);
        return (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.03em' }}>
              GASTO POR GRUPO DE ANÁLISIS{analysisFilter ? ` · Filtrado: ${analysisFilter}` : ''}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              {Object.entries(ANALYSIS_CFG).map(([key, cfg]) => {
                const val = stats.analysisSpending[key] || 0;
                const pct = totalAnalysis > 0 ? (val / totalAnalysis) * 100 : 0;
                const isActive = analysisFilter === key;
                return (
                  <div
                    key={key}
                    className="card"
                    onClick={() => {
                      if (key === 'Sin asignar' && onNavigateToArticles) {
                        onNavigateToArticles('__unassigned__');
                      } else {
                        setAnalysisFilter(isActive ? '' : key);
                      }
                    }}
                    style={{
                      padding: '16px', cursor: 'pointer', transition: 'all 0.2s',
                      borderTop: `3px solid ${cfg.border}`,
                      outline: isActive ? `2px solid ${cfg.border}` : 'none',
                      backgroundColor: isActive ? cfg.bg : undefined,
                    }}
                    title={key === 'Sin asignar' ? 'Ver artículos sin asignar' : (isActive ? 'Quitar filtro' : `Filtrar por ${key}`)}
                  >
                    {onNavigateToArticles && key !== 'Sin asignar' && (
                      <div
                        onClick={e => { e.stopPropagation(); onNavigateToArticles(key); }}
                        style={{ float: 'right', fontSize: '0.68rem', color: cfg.color, opacity: 0.7, textDecoration: 'underline dotted', cursor: 'pointer', marginTop: '2px' }}
                        title="Ver artículos de este grupo"
                      >
                        ver artículos →
                      </div>
                    )}
                    {key === 'Sin asignar' && (
                      <div style={{ float: 'right', fontSize: '0.68rem', color: cfg.color, opacity: 0.8, marginTop: '2px' }}>
                        ver artículos →
                      </div>
                    )}
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: cfg.color, marginBottom: '6px' }}>{key}</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: cfg.color }}>
                      {val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ height: '4px', backgroundColor: '#E2E8F0', borderRadius: '2px' }}>
                        <div style={{ height: '4px', width: `${Math.min(100, pct).toFixed(1)}%`, backgroundColor: cfg.border, borderRadius: '2px', transition: 'width 0.4s' }} />
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {pct.toFixed(1)}% del gasto por artículo
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem' }}>Evolución del Gasto Mensual</h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer>
              <BarChart data={stats.monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={v => `${v} €`} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(value) => [`${value.toFixed(2)} €`, 'Gasto']}
                />
                <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem' }}>Gasto por Proveedor</h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={stats.supplierChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {stats.supplierChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value.toFixed(2)} €`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '0.8rem' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Gasto por Categoría */}
      {stats.categoryChartData.length > 0 && (
        <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Gasto por Categoría</h3>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', color: 'var(--text-muted)', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#D97706', display: 'inline-block' }} />
                Equipos / Equipamiento
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: 'var(--primary)', display: 'inline-block' }} />
                Consumibles / Reactivos
              </span>
            </div>
          </div>
          <div style={{ width: '100%', height: `${Math.max(200, stats.categoryChartData.length * 44)}px` }}>
            <ResponsiveContainer>
              <BarChart data={stats.categoryChartData} layout="vertical" margin={{ left: 8, right: 60, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={v => `${v.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#334155' }}
                  width={160}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(value, name, props) => [
                    `${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
                    props.payload.isEquipo ? 'Equipos / Equipamiento' : 'Consumibles / Reactivos'
                  ]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22} label={{ position: 'right', fontSize: 10, fill: '#64748B', formatter: v => `${v.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €` }}>
                  {stats.categoryChartData.map((entry, index) => (
                    <Cell key={`cat-${index}`} fill={entry.isEquipo ? '#D97706' : 'var(--primary)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detailed Reference Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--secondary)' }}>Detalle por referencia</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>volumen acumulado · para negociación con proveedores</span>
        </div>
        <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Artículo</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Categoría</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Proveedor</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Uds.</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>P. Medio</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {stats.refStats.map((ref, i) => {
                const isEquipo = EQUIPO_RE.test(ref.category || '');
                return (
                  <tr key={ref.id} style={{ borderBottom: '1px solid var(--border)', backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--secondary)', lineHeight: 1.3 }}>{ref.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>{ref.id}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {ref.category ? (
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px', borderRadius: '4px',
                          backgroundColor: isEquipo ? 'rgba(217,119,6,0.08)' : 'rgba(8,145,178,0.06)',
                          color: isEquipo ? '#b45309' : '#0369a1',
                          whiteSpace: 'nowrap'
                        }}>
                          {ref.category}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text)', fontSize: '0.82rem' }}>{ref.supplier}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text)' }}>{ref.totalQty}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {ref.avgPrice.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                      {ref.totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </td>
                  </tr>
                );
              })}
              {stats.refStats.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No hay datos para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Budget Analysis Table */}
      {role === 'admin' && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 2px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--secondary)' }}>Control Presupuestario Mensual</h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Pedidos realizados (Completado + Incompleto + Pendiente) · Haz clic en el presupuesto para editarlo
            </p>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th style={{ textAlign: 'right' }}>Pedidos Realizados</th>
                  <th style={{ textAlign: 'right' }}>Presupuesto</th>
                  <th style={{ textAlign: 'center' }}>Desviación</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {budgetByMonth.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No hay pedidos realizados registrados.
                    </td>
                  </tr>
                )}
                {budgetByMonth.map(d => {
                  const budget    = monthlyBudgets[d.month] ?? 0;
                  const isEditing = d.month in editingBudgets;
                  const editVal   = isEditing ? editingBudgets[d.month] : budget;
                  const diff      = budget > 0 ? budget - d.value : null;
                  const isOver    = diff !== null && diff < 0;
                  const noBudget  = budget === 0;

                  const commitEdit = () => {
                    const val = Number(editingBudgets[d.month]) || 0;
                    onSaveBudget && onSaveBudget(d.month, val);
                    setEditingBudgets(prev => { const n = { ...prev }; delete n[d.month]; return n; });
                  };

                  return (
                    <tr key={d.month}>
                      <td style={{ fontWeight: 600 }}>{d.label}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {d.value.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            step="100"
                            className="input-field"
                            style={{ width: '110px', margin: 0, padding: '4px 8px', fontSize: '0.85rem', textAlign: 'right' }}
                            value={editVal}
                            onChange={e => setEditingBudgets(prev => ({ ...prev, [d.month]: e.target.value }))}
                            onBlur={commitEdit}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingBudgets(prev => { const n = { ...prev }; delete n[d.month]; return n; }); }}
                          />
                        ) : (
                          <button
                            onClick={() => setEditingBudgets(prev => ({ ...prev, [d.month]: String(budget) }))}
                            title="Haz clic para editar el presupuesto de este mes"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: noBudget ? 'var(--text-muted)' : 'inherit', textDecoration: 'underline dotted', textUnderlineOffset: '3px' }}
                          >
                            {noBudget ? '— Definir —' : `${budget.toLocaleString('es-ES')} €`}
                          </button>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', color: noBudget ? 'var(--text-muted)' : isOver ? 'var(--danger)' : '#16a34a', fontWeight: 'bold' }}>
                        {noBudget ? '—' : isOver ? `+${Math.abs(diff).toFixed(2)} €` : `-${diff.toFixed(2)} €`}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {noBudget
                          ? <span className="badge badge-info">SIN DEFINIR</span>
                          : <span className={`badge ${isOver ? 'badge-danger' : 'badge-success'}`}>
                              {isOver ? 'EXCEDIDO' : 'DENTRO'}
                            </span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
