import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Mail, Key, User } from 'lucide-react';
import logo from './assets/logo.png';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        alert(error.error_description || error.message);
      }
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Left Panel: Brand & Mission */}
      <div style={{ 
        flex: 1, 
        backgroundColor: 'var(--primary)', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '40px',
        color: 'white',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '40px' }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '24px', 
            borderRadius: '16px', 
            display: 'inline-block',
            marginBottom: '32px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            <img src={logo} alt="HSLAB logo" style={{ width: '280px', height: 'auto' }} />
          </div>
          <h2 style={{ fontSize: '1.8rem', margin: '0 0 10px 0', fontWeight: 700, letterSpacing: '-0.5px' }}>
            Módulo Gestión de Compras
          </h2>
          <div style={{ width: '40px', height: '4px', backgroundColor: 'rgba(255,255,255,0.3)', margin: '20px auto', borderRadius: '2px' }}></div>
        </div>
        
        <p style={{ maxWidth: '500px', fontSize: '1.1rem', lineHeight: 1.5, fontWeight: 300, opacity: 0.9 }}>
          Sistema centralizado para el control de inventario, pedidos a proveedores y análisis de consumos de laboratorio.
        </p>
      </div>

      {/* Right Panel: Login Form */}
      <div style={{ 
        flex: 1, 
        backgroundColor: 'white', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '40px'
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', justifyContent: 'flex-end', fontSize: '0.9rem' }}>
              ES ▾
            </div>
            <User size={64} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} strokeWidth={1} />
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
              Introduce tus datos de acceso de cliente
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label className="input-label" style={{ color: 'var(--text-muted)' }}>Usuario</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  className="input-field"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ border: 'none', borderBottom: '1px solid #ddd', borderRadius: 0, padding: '12px 0', paddingRight: '40px' }}
                  required
                />
              </div>
            </div>
            
            <div className="input-group" style={{ marginBottom: '32px' }}>
              <label className="input-label" style={{ color: 'var(--text-muted)' }}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Key size={18} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ border: 'none', borderBottom: '1px solid #ddd', borderRadius: 0, padding: '12px 0', paddingRight: '40px' }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', fontSize: '0.9rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <input type="checkbox" style={{ width: '18px', height: '18px' }} /> Recordarme
              </label>
              <a href="#" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>Recuperar contraseña</a>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '14px', fontSize: '1rem', textTransform: 'uppercase', marginBottom: '12px' }}
              disabled={loading}
            >
              {loading ? 'Accediendo...' : 'ACCEDER'}
            </button>
            
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: '100%', padding: '14px', fontSize: '0.9rem', color: 'var(--text-muted)', border: 'none', backgroundColor: '#f8f9fa' }}
            >
              <Key size={16} style={{ marginRight: '8px' }} /> ACCEDER CON SSO
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
