import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  PackageSearch, 
  Box, 
  Truck, 
  Plus,
  Search,
  Bell,
  Settings,
  LogOut
} from 'lucide-react';
import { supabase } from './supabaseClient';
import Auth from './Auth';

const mockOrders = [
  { id: 'ORD-001', date: '2026-03-15', status: 'Pendiente', items: 12, supplier: 'LabSupply Co.' },
  { id: 'ORD-002', date: '2026-03-16', status: 'Completado', items: 5, supplier: 'MedEquip Inc.' },
  { id: 'ORD-003', date: '2026-03-16', status: 'En Proceso', items: 23, supplier: 'ChemCorp' },
];

import { mockArticles, mockSuppliers } from './data';

function App() {
  const [activeTab, setActiveTab] = useState('pedidos');
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  if (!session) {
    return <Auth />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'pedidos':
        return (
          <div className="page-content">
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <h2 className="page-title">Gestión de Pedidos</h2>
              <button className="btn btn-primary">
                <Plus size={18} style={{ marginRight: '8px' }} /> Nuevo Pedido
              </button>
            </div>
            
            <div className="card table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID Pedido</th>
                    <th>Fecha</th>
                    <th>Proveedor</th>
                    <th>Artículos</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {mockOrders.map(order => (
                    <tr key={order.id}>
                      <td>{order.id}</td>
                      <td>{order.date}</td>
                      <td>{order.supplier}</td>
                      <td>{order.items}</td>
                      <td>
                        <span className={`badge ${
                          order.status === 'Completado' ? 'badge-success' : 
                          order.status === 'Pendiente' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Ver</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'stocks':
        return (
          <div className="page-content">
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <h2 className="page-title">Control de Stocks</h2>
              <div className="input-group" style={{ margin: 0, width: '300px' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input type="text" className="input-field" placeholder="Buscar en inventario..." style={{ paddingLeft: '40px' }} />
                </div>
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
                  {mockArticles.map(art => {
                    const status = art.stock > art.minStock ? 'Óptimo' : 'Bajo Stock';
                    return (
                      <tr key={art.id}>
                        <td>{art.name}</td>
                        <td>{art.category}</td>
                        <td style={{ fontWeight: 'bold' }}>{art.stock}</td>
                        <td>{art.minStock}</td>
                        <td>
                          <span className={`badge ${status === 'Óptimo' ? 'badge-success' : 'badge-danger'}`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
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
              <button className="btn btn-primary">
                <Plus size={18} style={{ marginRight: '8px' }} /> Nuevo Artículo
              </button>
            </div>
            
            <div className="card table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Ref ID</th>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Precio Est.</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {mockArticles.map(art => (
                    <tr key={art.id}>
                      <td>{art.id}</td>
                      <td>{art.name}</td>
                      <td>{art.category}</td>
                      <td>{art.price}</td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Editar</button>
                      </td>
                    </tr>
                  ))}
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
              <button className="btn btn-primary">
                <Plus size={18} style={{ marginRight: '8px' }} /> Alta Proveedor
              </button>
            </div>
            
            <div className="card table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Contacto</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                  </tr>
                </thead>
                <tbody>
                  {mockSuppliers.map(prov => (
                    <tr key={prov.id}>
                      <td>{prov.id}</td>
                      <td style={{ fontWeight: '600' }}>{prov.name}</td>
                      <td>{prov.contact}</td>
                      <td>{prov.email}</td>
                      <td>{prov.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
          <Box style={{ marginRight: '12px' }} /> LabManager
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
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header flex-between">
          <div style={{ color: 'var(--text-muted)' }}>Bienvenido, Laboratorio Central</div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', color: 'var(--text-muted)' }}>
            <Bell size={20} style={{ cursor: 'pointer' }} />
            <Settings size={20} style={{ cursor: 'pointer' }} />
            <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'var(--danger)' }} onClick={handleLogout} title="Cerrar sesión">
              <LogOut size={20} />
            </div>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
              {session?.user?.email?.charAt(0).toUpperCase() || 'L'}
            </div>
          </div>
        </header>
        
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
