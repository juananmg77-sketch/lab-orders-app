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
  LineChart,
  Line,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  Calendar,
  Filter,
  Download,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Check
} from 'lucide-react';

const COLORS = ['#0076CE', '#34D399', '#FBBF24', '#F87171', '#818CF8', '#A78BFA'];

export default function Dashboard({ orders, articles, onTabChange, role = 'operations' }) {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [spendingSupplier, setSpendingSupplier] = useState('Todos');
  const [stockSupplier, setStockSupplier] = useState('Todos');
  const [searchRef, setSearchRef] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');

  // Hardcoded for now, but editable via UI for admins
  const [monthlyBudget, setMonthlyBudget] = useState(2500); 
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  // 1. Process and Filter Data
  const filteredData = useMemo(() => {
    return orders.filter(order => {
      // Manage status filter
      if (statusFilter !== 'Todos' && order.status !== statusFilter) {
        return false;
      }

      const dateStr = order.date || '';
      if (!dateStr) return false;

      const orderDate = dateStr.includes('-') 
        ? new Date(dateStr) 
        : new Date(dateStr.split('/').reverse().join('-'));

      const matchesDate = (!dateRange.start || orderDate >= new Date(dateRange.start)) &&
                         (!dateRange.end || orderDate <= new Date(dateRange.end));
      
      const matchesSupplier = spendingSupplier === 'Todos' || order.supplier === spendingSupplier;

      return matchesDate && matchesSupplier;
    });
  }, [orders, dateRange, spendingSupplier, statusFilter]);

  // 2. Aggregate Stats
  const stats = useMemo(() => {
    let totalSpent = 0;
    let totalItemsPurchased = 0;
    const refMap = new Map();
    const supplierSpending = {};
    const monthlySpending = {};

    filteredData.forEach(order => {
      totalSpent += order.total || 0;
      
      // Supplier aggregate
      supplierSpending[order.supplier] = (supplierSpending[order.supplier] || 0) + order.total;

      // Monthly aggregate
      const dateStr = order.date || '';
      if (!dateStr) return;
      
      const date = dateStr.includes('-') 
        ? new Date(dateStr) 
        : new Date(dateStr.split('/').reverse().join('-'));
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + (order.total || 0);

      // Reference aggregate
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
            refMap.set(ref, {
              id: ref,
              name: item.article.name,
              supplier: item.article.supplierName,
              totalQty: 0,
              totalCost: 0,
              avgPrice: 0,
              count: 0
            });
          }
          const current = refMap.get(ref);
          current.totalQty += qty;
          current.totalCost += subtotal;
          current.count += 1;
          current.avgPrice = current.totalCost / current.totalQty;
        });
      }
    });

    const refStats = Array.from(refMap.values())
      .filter(ref => !searchRef || 
              ref.name.toLowerCase().includes(searchRef.toLowerCase()) || 
              ref.id.toLowerCase().includes(searchRef.toLowerCase()))
      .sort((a, b) => b.totalCost - a.totalCost);

    const supplierChartData = Object.entries(supplierSpending)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const monthlyChartData = Object.entries(monthlySpending)
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Calculo de valoración de stock actual (según el proveedor seleccionado para STOCK)
    const currentStockValuation = articles
      .filter(art => stockSupplier === 'Todos' || art.supplierName === stockSupplier)
      .reduce((sum, art) => {
        const priceStr = String(art.price || '0').replace('€', '').replace(',', '.').trim();
        const priceVal = parseFloat(priceStr) || 0;
        return sum + (priceVal * (art.stock || 0));
      }, 0);

    const pendingOrdersCount = orders.filter(o => o.status === 'Pendiente').length;
    const finishedOrdersCount = orders.filter(o => o.status !== 'Pendiente').length;

    return {
      totalSpent,
      totalOrders: filteredData.length,
      totalItemsPurchased,
      uniqueRefs: refMap.size,
      refStats,
      supplierChartData,
      monthlyChartData,
      currentStockValuation,
      pendingOrdersCount,
      finishedOrdersCount,
      monthlySpendingMap: monthlySpending
    };
  }, [filteredData, searchRef, articles, stockSupplier, orders]);


  const uniqueSuppliers = useMemo(() => {
    const fromOrders = orders.map(o => o.supplier);
    const fromArticles = articles.filter(a => a && a.supplierName).map(a => a.supplierName);
    const combined = [...new Set([...fromOrders, ...fromArticles].filter(Boolean))];
    return ['Todos', ...combined.sort((a, b) => a.localeCompare(b))];
  }, [orders, articles]);

  return (
    <div className="page-content" style={{ paddingBottom: '40px' }}>
      <div className="flex-between" style={{ marginBottom: '24px' }}>
        <div>
          <h2 className="page-title">Análisis y Reportes</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cuadro de mando para negociación y control de gasto</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
           <button className="btn btn-secondary" onClick={() => window.print()}>
             <Download size={18} style={{ marginRight: '8px' }} /> Exportar Vista
           </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px', display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="input-group" style={{ margin: 0, minWidth: '160px' }}>
          <label className="input-label" style={{ fontSize: '0.8rem' }}>Estado Pedidos</label>
          <select className="input-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="Todos">Todos</option>
            <option value="Completado">Completados</option>
            <option value="Incompleto">Incompletos</option>
            <option value="Pendiente">Pendientes</option>
          </select>
        </div>
        <div className="input-group" style={{ margin: 0, minWidth: '180px' }}>
          <label className="input-label" style={{ fontSize: '0.8rem' }}>Proveedor</label>
          <select className="input-field" value={spendingSupplier} onChange={e => setSpendingSupplier(e.target.value)}>
            {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="input-group" style={{ margin: 0 }}>
          <label className="input-label" style={{ fontSize: '0.8rem' }}>Desde</label>
          <input type="date" className="input-field" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
        </div>
        <div className="input-group" style={{ margin: 0 }}>
          <label className="input-label" style={{ fontSize: '0.8rem' }}>Hasta</label>
          <input type="date" className="input-field" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
        </div>
        <div className="input-group" style={{ margin: 0, flex: 1, minWidth: '250px' }}>
          <label className="input-label" style={{ fontSize: '0.8rem' }}>Buscar Referencia (En histórico)</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Nombre o Ref..." 
              style={{ paddingLeft: '36px' }} 
              value={searchRef}
              onChange={e => setSearchRef(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(0, 118, 206, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Gasto total</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.totalSpent.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
          </div>
        </div>

        <div 
          className="card" 
          style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}
          onClick={() => onTabChange && onTabChange('pedidos')}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(251, 191, 36, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
            <Calendar size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Pedidos Pendientes</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.pendingOrdersCount}</div>
          </div>
          <ArrowUpRight size={16} color="var(--text-muted)" />
        </div>

        {/* Admin Budget KPI */}
        {role === 'admin' ? (
          <div className="card" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
               <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Presupuesto Mensual</span>
               {isEditingBudget ? (
                 <input 
                    autoFocus 
                    type="number" 
                    className="input-field" 
                    style={{ width: '80px', margin: 0, padding: '4px 8px', fontSize: '0.8rem' }}
                    value={monthlyBudget}
                    onBlur={() => setIsEditingBudget(false)}
                    onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                 />
               ) : (
                 <button onClick={() => setIsEditingBudget(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>EDITAR</button>
               )}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
              {monthlyBudget.toLocaleString('es-ES')} €
            </div>
            <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', position: 'relative' }}>
               <div style={{ 
                 position: 'absolute', left: 0, top: 0, bottom: 0, 
                 width: `${Math.min(100, (stats.totalSpent / monthlyBudget) * 100)}%`, 
                 backgroundColor: (stats.totalSpent > monthlyBudget) ? 'var(--danger)' : 'var(--primary)', 
                 borderRadius: '4px' 
               }} />
            </div>
            <div style={{ fontSize: '0.7rem', marginTop: '6px', color: (stats.totalSpent > monthlyBudget) ? 'var(--danger)' : 'var(--text-muted)' }}>
               {stats.totalSpent > monthlyBudget 
                 ? `Sobrecoste de ${(stats.totalSpent - monthlyBudget).toFixed(2)} €` 
                 : `${((stats.totalSpent / monthlyBudget) * 100).toFixed(0)}% del presupuesto consumido`}
            </div>
          </div>
        ) : (
          <div 
            className="card" 
            style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}
            onClick={() => onTabChange && onTabChange('pedidos')}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(52, 211, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
              <Check size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Pedidos Finalizados</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.finishedOrdersCount}</div>
            </div>
            <ArrowUpRight size={16} color="var(--text-muted)" />
          </div>
        )}


        <div>
          <div className="input-group" style={{ marginBottom: '8px' }}>
            <select 
              className="input-field" 
              value={stockSupplier} 
              onChange={e => setStockSupplier(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '0.85rem', height: 'auto', backgroundColor: 'var(--surface)' }}
            >
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
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)' }}>{stats.currentStockValuation.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} €</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{stockSupplier === 'Todos' ? 'Total Catálogo' : `Filtrado por "${stockSupplier}"`}</div>
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
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
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
                <Pie
                  data={stats.supplierChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.supplierChartData.map((entry, index) => (
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
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Control Presupuestario Mensual</h3>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th style={{ textAlign: 'right' }}>Gasto Real</th>
                  <th style={{ textAlign: 'right' }}>Presupuesto</th>
                  <th style={{ textAlign: 'center' }}>Desviación</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {stats.monthlyChartData.map(d => {
                  const diff = monthlyBudget - d.value;
                  const isOver = diff < 0;
                  return (
                    <tr key={d.month}>
                      <td style={{ fontWeight: 600 }}>{d.month}</td>
                      <td style={{ textAlign: 'right' }}>{d.value.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{monthlyBudget.toLocaleString('es-ES')} €</td>
                      <td style={{ textAlign: 'center', color: isOver ? 'var(--danger)' : '#16a34a', fontWeight: 'bold' }}>
                        {isOver ? `+${Math.abs(diff).toFixed(2)} €` : `-${diff.toFixed(2)} €`}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${isOver ? 'badge-danger' : 'badge-success'}`}>
                          {isOver ? 'EXCEDIDO' : 'DENTRO'}
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

      {/* Detailed Analysis Table */}

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
