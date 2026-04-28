import React from 'react';
import { ShoppingCart, LogOut, Settings, Bell, Microscope, Users, FlaskConical } from 'lucide-react';
import logo from './assets/logo.png';

export default function Hub({ session, globalLab, setGlobalLab, onSelectModule, onLogout, role = 'operations' }) {
  const userEmail = session?.user?.email;
  
  // Regla específica: lab@hsconsulting.es solo accede a Baleares
  const allowedLabs = (userEmail === 'lab@hsconsulting.es') 
    ? ['HSLAB Baleares'] 
    : ['HSLAB Baleares', 'HSLAB Canarias'];

  const showPurchasing = ['admin', 'lab'].includes(role);
  const showEquipment = ['admin', 'lab', 'operations'].includes(role);
  const showUsers = role === 'admin';
  const showRRHH = role === 'admin';

  // Si el lab actual no está permitido para este usuario, forzar a Baleares
  React.useEffect(() => {
    if (!allowedLabs.includes(globalLab)) {
      setGlobalLab('HSLAB Baleares');
    }
  }, [globalLab, allowedLabs, setGlobalLab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <header style={{ 
        height: '70px', 
        backgroundColor: 'var(--surface)', 
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        <img src={logo} alt="HSLAB Logo" style={{ height: '40px', objectFit: 'contain' }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          {/* Lab Selector */}
          <div style={{ position: 'relative' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '10px' }}>
              Centro Operativo:
            </span>
            <select 
              value={globalLab} 
              onChange={(e) => setGlobalLab(e.target.value)}
              style={{
                padding: '8px 16px',
                paddingRight: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                border: '1px solid var(--primary)',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none', 
                WebkitAppearance: 'none'
              }}
            >
              {allowedLabs.map(lab => (
                <option key={lab} value={lab}>{lab}</option>
              ))}
            </select>
            <div style={{ position: 'absolute', right: '12px', top: '10px', pointerEvents: 'none', color: 'var(--primary)' }}>▼</div>
          </div>
          
          {/* Action icons */}
          <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)' }}>
            <Bell size={20} style={{ cursor: 'pointer' }} />
            <Settings size={20} style={{ cursor: 'pointer' }} />
          </div>
          <button 
            onClick={onLogout}
            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
            title="Cerrar Sesión"
          >
            <LogOut size={18} /> Salir
          </button>
        </div>
      </header>

      {/* Main Area */}
      <main style={{ flex: 1, padding: '60px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1 style={{ color: 'var(--secondary)', fontSize: '2.5rem', marginBottom: '10px' }}>
            Bienvenido al Portal HSLAB
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
            Selecciona el entorno de trabajo al que deseas acceder bajo el contexto de <strong>{globalLab}</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '40px', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '1200px' }}>
          
          {/* Module 1: Compras */}
          {showPurchasing && (
            <div 
              onClick={() => onSelectModule('compras')}
              style={{ 
                width: '320px', 
                backgroundColor: 'white', 
                borderRadius: '20px', 
                padding: '40px 30px', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                borderTop: '6px solid var(--primary)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease'
               }}
               onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-10px)'}
               onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ width: '80px', height: '80px', borderRadius: '40px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                <ShoppingCart size={40} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: '1.5rem', color: 'var(--secondary)', margin: '0 0 12px 0' }}>Pedidos y Compras</h2>
              <p style={{ color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Gestión de inventarios, creación de órdenes de pedido y recepción de mercancías.
              </p>
            </div>
          )}

          {/* Module 2: Equipos */}
          <div 
            onClick={() => onSelectModule('equipos')}
            style={{ 
              width: '320px', 
              backgroundColor: 'white', 
              borderRadius: '20px', 
              padding: '40px 30px', 
              boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              borderTop: '6px solid var(--primary)',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease'
             }}
             onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-10px)'}
             onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ width: '80px', height: '80px', borderRadius: '40px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <Microscope size={40} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--secondary)', margin: '0 0 12px 0' }}>Gestión de Equipos</h2>
            <p style={{ color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
              Control de mantenimientos, calibraciones y averías del Inventario Equipos.
            </p>
          </div>

          {/* Module 3: RRHH (Coming Soon) */}
          {showRRHH && (
            <div 
              style={{ 
                width: '320px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '20px', 
                padding: '40px 30px', 
                boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                cursor: 'not-allowed',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                borderTop: '6px solid #cbd5e1',
                position: 'relative',
                opacity: 0.8
               }}
            >
              <div style={{ position: 'absolute', top: '16px', right: '16px', backgroundColor: 'var(--warning)', color: '#856404', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                EN DESARROLLO
              </div>
              <div style={{ width: '80px', height: '80px', borderRadius: '40px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                <Users size={40} color="#64748b" />
              </div>
              <h2 style={{ fontSize: '1.5rem', color: '#475569', margin: '0 0 12px 0' }}>Gestión de RRHH</h2>
              <p style={{ color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                Control de turnos, vacaciones, formación técnica y prevención de riesgos.
              </p>
            </div>
          )}

          {/* Module 3b: Previsión Legionella (Admin + Lab) */}
          {['admin', 'lab'].includes(role) && (
            <div
              onClick={() => onSelectModule('legionella')}
              style={{
                width: '320px',
                backgroundColor: 'white',
                borderRadius: '20px',
                padding: '40px 30px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                borderTop: '6px solid #0891B2',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-10px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ width: '80px', height: '80px', borderRadius: '40px', backgroundColor: '#ECFEFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                <FlaskConical size={40} color="#0891B2" />
              </div>
              <h2 style={{ fontSize: '1.5rem', color: 'var(--secondary)', margin: '0 0 12px 0' }}>Previsión Legionella</h2>
              <p style={{ color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Cálculo mensual de envases previstos por nodo logístico a partir del fichero de actividades.
              </p>
            </div>
          )}

          {/* Module 4: Usuarios (Admin Only) */}
          {showUsers && (
            <div 
              onClick={() => onSelectModule('usuarios')}
              style={{ 
                width: '320px', 
                backgroundColor: 'white', 
                borderRadius: '20px', 
                padding: '40px 30px', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                borderTop: '6px solid #6366f1',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease'
               }}
               onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-10px)'}
               onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ width: '80px', height: '80px', borderRadius: '40px', backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                <Settings size={40} color="#6366f1" />
              </div>
              <h2 style={{ fontSize: '1.5rem', color: 'var(--secondary)', margin: '0 0 12px 0' }}>Accesos y Roles</h2>
              <p style={{ color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Administración de usuarios, asignación de permisos y niveles de acceso.
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
