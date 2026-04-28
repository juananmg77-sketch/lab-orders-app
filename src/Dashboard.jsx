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
  ShoppingCart
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

export default function Dashboard({ orders, articles, onTabChange, onNavigateToPedidos, role = 'operations', monthlyBudgets = {}, onSaveBudget }) {
  const [monthFilter, setMonthFilter]           = useState('');
  const [dateRange, setDateRange]               = useState({ start: '', end: '' });
  const [spendingSupplier, setSpendingSupplier] = useState('Todos');
  const [stockSupplier, setStockSupplier]       = useState('Todos');
  const [searchRef, setSearchRef]               = useState('');
  const [statusFilter, setStatusFilter]         = useState('Todos');
  // Local editing state: { 'YYYY-MM': string } — only active while input is focused
  const [editingBudgets, setEditingBudgets]     = useState({});

  // Months available derived from orders
  const availableMonths = useMemo(() => {
    const seen = new Set();
    orders.forEach(o => {
      const d = parseOrderDate(o.date);
      if (d && !isNaN(d)) {
        seen.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    });
    return [...seen].sort((a, b) => b.localeCompare(a));
  }, [orders]);

  // Base filter: month OR date range + supplier (used for status summary cards — ignores statusFilter)
  const baseFiltered = useMemo(() => {
    return orders.filter(order => {
      const d = parseOrderDate(order.date);
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

  // Full filtered (includes statusFilter) — used for charts and reference table
  const filteredData = useMemo(() => {
    if (statusFilter === 'Todos') return baseFiltered;
    return baseFiltered.filter(o => o.status === statusFilter);
  }, [baseFiltered, statusFilter]);

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
      const d = parseOrderDate(o.date);
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

  // Aggregate Stats (for charts and KPIs)
  const stats = useMemo(() => {
    let totalSpent = 0;
    let totalItemsPurchased = 0;
    const refMap = new Map();
    const supplierSpending = {};
    const monthlySpending = {};

    filteredData.forEach(order => {
      totalSpent += order.total || 0;
      supplierSpending[order.supplier] = (supplierSpending[order.supplier] || 0) + order.total;

      const d = parseOrderDate(order.date);
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

          if (!refMap.has(ref)) {
            refMap.set(ref, { id: ref, name: item.article.name, supplier: item.article.supplierName, totalQty: 0, totalCost: 0, count: 0 });
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

    const currentStockValuation = articles
      .filter(art => stockSupplier === 'Todos' || art.supplierName === stockSupplier)
      .reduce((sum, art) => {
        const priceStr = String(art.price || '0').replace('€', '').replace(',', '.').trim();
        return sum + (parseFloat(priceStr) || 0) * (art.stock || 0);
      }, 0);

    return { totalSpent, totalOrders: filteredData.length, totalItemsPurchased, refStats, supplierChartData, monthlyChartData, currentStockValuation, monthlySpendingMap: monthlySpending };
  }, [filteredData, searchRef, articles, stockSupplier]);

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
    .filter(o => { const d = parseOrderDate(o.date); return d && `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === kpiMonth; })
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
      <div className="card" style={{ marginBottom: '24px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {/* Estado */}
        <div className="input-group" style={{ margin: 0, minWidth: '180px' }}>
          <label className="input-label" style={{ fontSize: '0.8rem' }}>Estado</label>
          <select className="input-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="Todos">Todos los estados</option>
            <option value="Completado">Completado</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Incompleto">Incompleto</option>
            <option value="Pendiente de Aprobación">Pendiente de Aprobación</option>
            <option value="Rechazado">Rechazado</option>
          </select>
        </div>

        {/* Proveedor */}
        <div className="input-group" style={{ margin: 0, minWidth: '180px' }}>
          <label className="input-label" style={{ fontSize: '0.8rem' }}>Proveedor</label>
          <select className="input-field" value={spendingSupplier} onChange={e => setSpendingSupplier(e.target.value)}>
            {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Mes */}
        <div className="input-group" style={{ margin: 0, minWidth: '160px' }}>
          <label className="input-label" style={{ fontSize: '0.8rem' }}>Mes</label>
          <select
            className="input-field"
            value={monthFilter}
            onChange={e => {
              setMonthFilter(e.target.value);
              if (e.target.value) setDateRange({ start: '', end: '' });
            }}
          >
            <option value="">Todos los meses</option>
            {availableMonths.map(ym => (
              <option key={ym} value={ym}>{monthLabel(ym)}</option>
            ))}
          </select>
        </div>

        {/* Desde / Hasta */}
        <div className="input-group" style={{ margin: 0 }}>
          <label className="input-label" style={{ fontSize: '0.8rem' }}>Desde</label>
          <input type="date" className="input-field" value={dateRange.start}
            onChange={e => { setDateRange({ ...dateRange, start: e.target.value }); setMonthFilter(''); }} />
        </div>
        <div className="input-group" style={{ margin: 0 }}>
          <label className="input-label" style={{ fontSize: '0.8rem' }}>Hasta</label>
          <input type="date" className="input-field" value={dateRange.end}
            onChange={e => { setDateRange({ ...dateRange, end: e.target.value }); setMonthFilter(''); }} />
        </div>

        {/* Buscar referencia */}
        <div className="input-group" style={{ margin: 0, flex: 1, minWidth: '220px' }}>
          <label className="input-label" style={{ fontSize: '0.8rem' }}>Buscar Referencia</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <input type="text" className="input-field" placeholder="Nombre o Ref..."
              style={{ paddingLeft: '36px' }} value={searchRef} onChange={e => setSearchRef(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Status Summary Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {/* 4 status cards */}
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const Icon = cfg.icon;
          const data = statusSummary[status] || { count: 0, total: 0 };
          return (
            <div
              key={status}
              className="card"
              style={{ padding: '16px', cursor: data.count > 0 ? 'pointer' : 'default', transition: 'box-shadow 0.2s', borderTop: `3px solid ${cfg.color}`, opacity: data.count === 0 ? 0.55 : 1 }}
              onClick={() => { if (data.count > 0 && onNavigateToPedidos) onNavigateToPedidos(status); }}
              title={data.count > 0 ? `Ver ${data.count} pedido(s) "${cfg.label}" en Gestión de Pedidos` : `Sin pedidos "${cfg.label}"`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0 }}>
                  <Icon size={16} />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.2 }}>{cfg.label}</span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{data.count}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {data.total > 0 ? data.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '—'}
              </div>
            </div>
          );
        })}

        {/* Importe total card */}
        {(() => {
          const totalImporte = baseFiltered.reduce((s, o) => s + (o.total || 0), 0);
          const totalPedidos = baseFiltered.length;
          return (
            <div className="card" style={{ padding: '16px', borderTop: '3px solid var(--primary)', backgroundColor: 'var(--primary-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(0,118,206,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                  <TrendingUp size={16} />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', lineHeight: 1.2 }}>Importe Total</span>
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
                {totalImporte.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--primary)', marginTop: '4px', opacity: 0.75 }}>
                {totalPedidos} pedido{totalPedidos !== 1 ? 's' : ''}
              </div>
            </div>
          );
        })()}
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

      {/* Admin Budget Analysis Table */}
      {role === 'admin' && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 2px 0', fontSize: '1.1rem' }}>Control Presupuestario Mensual</h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Suma de pedidos realizados (Completado + Incompleto + Pendiente) · Haz clic en el presupuesto de cada mes para editarlo
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
                  const budget  = monthlyBudgets[d.month] ?? 0;
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

      {/* Detailed Reference Table */}
      <div className="card">
        <div className="flex-between" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Detalle por Referencia para Negociación</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Muestra el volumen acumulado e importes pagados</span>
        </div>
        <div className="table-wrapper" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          <table>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface)', zIndex: 1 }}>
              <tr>
                <th>Referencia</th>
                <th>Nombre Artículo</th>
                <th>Proveedor</th>
                <th style={{ textAlign: 'center' }}>Cant. Total</th>
                <th style={{ textAlign: 'right' }}>Precio Medio</th>
                <th style={{ textAlign: 'right' }}>Gasto total</th>
              </tr>
            </thead>
            <tbody>
              {stats.refStats.map(ref => (
                <tr key={ref.id}>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{ref.id}</td>
                  <td style={{ fontWeight: 600 }}>{ref.name}</td>
                  <td style={{ fontSize: '0.85rem' }}>{ref.supplier}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-info" style={{ minWidth: '40px' }}>{ref.totalQty}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{ref.avgPrice.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                    {ref.totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </td>
                </tr>
              ))}
              {stats.refStats.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No hay datos disponibles para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
