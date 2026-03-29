import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Users, UserPlus, Trash2, Shield, Mail, Key, ShieldAlert, ArrowLeft, RefreshCw, Save } from 'lucide-react';
import logo from './assets/logo.png';

export default function UserManagementModule({ onBackToHub }) {
  const [users, setUsers] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'operations' });
  const [lastCreatedUser, setLastCreatedUser] = useState(null);


  const fetchUsers = async () => {
    setLoading(true);
    // Since we can't fetch auth.users directly without service role key,
    // we fetch from public.profiles table.
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) {
      if (error.message.includes('not found')) {
         setError('⚠️ La tabla "profiles" no existe en Supabase. Debes crearla en el SQL Editor para gestionar roles.');
      } else {
         setError(error.message);
      }
    } else {
      setUsers(data || []);
      setError(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Sign up user
    const { data, error: signupError } = await supabase.auth.signUp({
      email: newUser.email,
      password: newUser.password,
      options: {
        data: { role: newUser.role }
      }
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    // 2. Create profile entry (Manual fall back if trigger not set)
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: newUser.email,
        role: newUser.role,
        created_at: new Date()
      });

      if (profileError) {
        setError("Usuario creado en Auth, pero fallo la creación del perfil: " + profileError.message);
      } else {
        setLastCreatedUser({...newUser}); // Store to show success message
        setIsAdding(false);
        setNewUser({ email: '', password: '', role: 'operations' });
        fetchUsers();
      }
    }
    setLoading(false);
  };

  const handleUpdateRole = async (userId, newRole) => {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (updateError) {
      alert("Error actualizando rol: " + updateError.message);
    } else {
      fetchUsers();
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("¿Seguro que deseas eliminar este perfil? (Nota: Esto no elimina el usuario de Supabase Auth, solo su rol en la aplicación)")) return;
    
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      alert("Error eliminando: " + deleteError.message);
    } else {
      fetchUsers();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f4f7f9' }}>
      {/* Header */}
      <header style={{ 
        height: '70px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button onClick={onBackToHub} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
             <ArrowLeft size={18} />
          </button>
          <img src={logo} alt="Logo" style={{ height: '32px' }} />
          <h2 style={{ fontSize: '1.25rem', color: '#0f172a', margin: 0, fontWeight: 700 }}>Gestión de Usuarios y Roles</h2>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
          <UserPlus size={18} /> <span>Invitar Usuario</span>
        </button>
      </header>

      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        {lastCreatedUser && (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '24px', borderRadius: '12px', marginBottom: '30px', color: '#166534' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save size={20} /> ¡Usuario Invitado con Éxito!
                </h3>
                <p style={{ fontSize: '0.95rem', margin: 0 }}>
                  Se ha registrado a <b>{lastCreatedUser.email}</b>. Copia la invitación debajo para enviársela.
                </p>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={() => setLastCreatedUser(null)}
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Cerrar Aviso
              </button>
            </div>
            
            <div style={{ 
              marginTop: '16px', backgroundColor: 'white', padding: '16px', 
              borderRadius: '8px', border: '1px dotted #166534', fontSize: '0.9rem',
              whiteSpace: 'pre-wrap', lineHeight: 1.6
            }}>
              {`Hola! Te invito a unirte al Portal de Gestión de HSLAB.
Tus credenciales de acceso son:
- Web: ${window.location.origin}
- Usuario: ${lastCreatedUser.email}
- Password: ${lastCreatedUser.password}

Por seguridad, te recomendamos cambiar tu contraseña tras el primer acceso.`}
            </div>
            
            <button 
              className="btn btn-primary" 
              style={{ marginTop: '12px' }}
              onClick={() => {
                const text = `Hola! Te invito a unirte al Portal de Gestión de HSLAB.\n\nTus credenciales de acceso son:\n- Web: ${window.location.origin}\n- Usuario: ${lastCreatedUser.email}\n- Password: ${lastCreatedUser.password}\n\nPor seguridad, te recomendamos cambiar tu contraseña tras el primer acceso.`;
                navigator.clipboard.writeText(text);
                alert("Invitación copiada al portapapeles");
              }}
            >
              Copiar Invitación para Enviar
            </button>
          </div>
        )}

        {error && (
          <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fda4af', padding: '20px', borderRadius: '12px', marginBottom: '30px', color: '#991b1b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
              <ShieldAlert size={20} /> ATENCIÓN: TABLA DE PERFILES FALTANTE
            </div>
            <p>{error}</p>
            <div style={{ marginTop: '16px', backgroundColor: '#0f172a', color: '#94a3b8', padding: '16px', borderRadius: '8px', fontSize: '0.85rem' }}>
              <code>
                CREATE TABLE profiles (<br/>
                &nbsp;&nbsp;id uuid references auth.users not null primary key,<br/>
                &nbsp;&nbsp;email text,<br/>
                &nbsp;&nbsp;role text DEFAULT 'operations',<br/>
                &nbsp;&nbsp;created_at timestamp with time zone DEFAULT now()<br/>
                );
              </code>
            </div>
            <button className="btn btn-secondary" style={{ marginTop: '16px' }} onClick={fetchUsers}>
               <RefreshCw size={16} /> Reintentar
            </button>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Usuario / Email</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Rol Asignado</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: 600, color: '#64748b' }}>Fecha Registro</th>
                <th style={{ padding: '16px 24px', textAlign: 'center', fontWeight: 600, color: '#64748b' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '18px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={18} color="#64748b" />
                      </div>
                      <span style={{ fontWeight: 600 }}>{u.email}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <select 
                      value={u.role || 'operations'} 
                      onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                      style={{ 
                        padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                        backgroundColor: u.role === 'admin' ? '#eff6ff' : 'white',
                        fontWeight: u.role === 'admin' ? 'bold' : 'normal',
                        color: u.role === 'admin' ? 'var(--primary)' : 'inherit'
                      }}
                    >
                      <option value="admin">👑 Administrador</option>
                      <option value="lab">🧪 Laboratorio</option>
                      <option value="operations">👥 Operaciones</option>
                    </select>
                  </td>
                  <td style={{ padding: '16px 24px', color: '#64748b' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                    <button 
                      onClick={() => handleDeleteUser(u.id)}
                      className="btn btn-secondary" 
                      style={{ color: '#e11d48', borderColor: '#fda4af', padding: '6px 10px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && !error && (
                <tr>
                  <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                     No hay usuarios registrados en el sistema. pulsa "Invitar Usuario" para empezar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal Invitar */}
      {isAdding && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="card" style={{ width: '400px', padding: '32px' }}>
            <h2 style={{ marginTop: 0, marginBottom: '24px' }}>Invitar Colaborador</h2>
            <form onSubmit={handleCreateUser}>
              <div className="input-group">
                <label className="input-label">Email del Colaborador</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94a3b8' }} />
                  <input required type="email" className="input-field" style={{ paddingLeft: '40px' }} value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Asigna un Password Temporal</label>
                <div style={{ position: 'relative' }}>
                  <Key size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94a3b8' }} />
                  <input required type="password" className="input-field" style={{ paddingLeft: '40px' }} value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Nivel de Acceso</label>
                <select className="input-field" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                  <option value="admin">Administrador de Sistemas</option>
                  <option value="lab">Analista de Laboratorio</option>
                  <option value="operations">Operaciones / Consultoría</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsAdding(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
