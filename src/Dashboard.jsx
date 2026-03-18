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
  ArrowDownRight
} from 'lucide-react';

const COLORS = ['#0076CE', '#34D399', '#FBBF24', '#F87171', '#818CF8', '#A78BFA'];

export default function Dashboard({ orders, articles }) {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedSupplier, setSelectedSupplier] = useState('Todos');
  const [searchRef, setSearchRef] = useState('');

  // 1. Process and Filter Data
  const filteredData = useMemo(() => {
    return orders.filter(order => {
      // Only completed or incomplete orders (those with actual purchases)
      if (order.status === 'Pendiente') return false;

      const orderDate = order.date.includes('-') 
        ? new Date(order.date) 
        : new Date(order.date.split('/').reverse().join('-'));

      const matchesDate = (!dateRange.start || orderDate >= new Date(dateRange.start)) &&
                         (!dateRange.end || orderDate <= new Date(dateRange.end));
      
      const matchesSupplier = selectedSupplier === 'Todos' || order.supplier === selectedSupplier;

      return matchesDate && matchesSupplier;
    });
  }, [orders, dateRange, selectedSupplier]);

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
      const date = order.date.includes('-') 
        ? new Date(order.date) 
        : new Date(order.date.split('/').reverse().join('-'));
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + order.total;

      // Reference aggregate
      if (order.cart) {
        order.cart.forEach(item => {
          const ref = item.article.id;
          const qty = item.quantity || 0;
          const priceStr = String(item.article.price).replace('€', '').replace(',', '.').trim();
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

    return {
      totalSpent,
      totalOrders: filteredData.length,
      totalItemsPurchased,
      uniqueRefs: refMap.size,
      refStats,
      supplierChartData,
      monthlyChartData
    };
  }, [filteredData, searchRef]);

  const uniqueSuppliers = useMemo(() => {
    return ['Todos', ...new Set(orders.map(o => o.supplier))];
  }, [orders]);

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
        <div className="input-group" style={{ margin: 0, minWidth: '200px' }}>
          <label className="input-label" style={{ fontSize: '0.8rem' }}>Proveedor</label>
          <select className="input-field" value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
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
          <label className="input-label" style={{ fontSize: '0.8rem' }}>Buscar Referencia</label>
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
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Inversión Total</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.totalSpent.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(52, 211, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Items Comprados</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.totalItemsPurchased}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(251, 191, 36, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Pedidos Finalizados</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.totalOrders}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(129, 140, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1' }}>
            <Calendar size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Ref. Únicas</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.uniqueRefs}</div>
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
                <th style={{ textAlign: 'right' }}>Inversión Total</th>
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
                  <td style={{ textAlign: 'right' }}>{ref.avgPrice.toFixed(2)} €</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                    {ref.totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
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
