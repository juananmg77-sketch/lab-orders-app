import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Mail, Key, User, ArrowLeft, CheckCircle } from 'lucide-react';
import logo from './assets/logo.png';

// ── Pantalla de nueva contraseña (tras clic en el email de recuperación) ──────
function NewPasswordForm() {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (password !== confirm)  { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); }
    else      { setDone(true); }
  };

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <CheckCircle size={56} color="var(--success)" style={{ marginBottom: '20px' }} />
        <h3 style={{ color: 'var(--secondary)', marginBottom: '10px' }}>Contraseña actualizada</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '28px' }}>Ya puedes acceder con tu nueva contraseña.</p>
        <button className="btn btn-primary" style={{ width: '100%', padding: '14px' }}
          onClick={() => window.location.replace(window.location.origin)}>
          Ir al inicio de sesión
        </button>
      </div>
    );
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Key size={48} style={{ color: 'var(--primary)', marginBottom: '14px' }} strokeWidth={1.5} />
        <h3 style={{ color: 'var(--secondary)', margin: '0 0 8px' }}>Establece tu nueva contraseña</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Elige una contraseña segura de al menos 6 caracteres.</p>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label">Nueva contraseña</label>
          <input type="password" className="input-field" placeholder="••••••••" required
            value={password} onChange={e => setPassword(e.target.value)}
            style={{ border: 'none', borderBottom: '1px solid #ddd', borderRadius: 0, padding: '12px 0' }} />
        </div>
        <div className="input-group" style={{ marginBottom: '28px' }}>
          <label className="input-label">Confirmar contraseña</label>
          <input type="password" className="input-field" placeholder="••••••••" required
            value={confirm} onChange={e => setConfirm(e.target.value)}
            style={{ border: 'none', borderBottom: '1px solid #ddd', borderRadius: 0, padding: '12px 0' }} />
        </div>
        {error && (
          <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fda4af', borderRadius: '8px',
            padding: '10px 14px', marginBottom: '20px', color: '#e11d48', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        <button type="submit" className="btn btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: '1rem' }} disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
        </button>
      </form>
    </>
  );
}

// ── Pantalla de solicitud de recuperación ─────────────────────────────────────
function RecoveryForm({ onBack }) {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://lab-orders.netlify.app',
    });
    setLoading(false);
    if (error) { alert(error.message); }
    else        { setSent(true); }
  };

  if (sent) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <CheckCircle size={56} color="var(--success)" style={{ marginBottom: '20px' }} />
        <h3 style={{ color: 'var(--secondary)', marginBottom: '10px' }}>Email enviado</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
          Hemos enviado un enlace de recuperación a:
        </p>
        <p style={{ fontWeight: 700, color: 'var(--secondary)', marginBottom: '28px' }}>{email}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '28px' }}>
          Revisa también la carpeta de spam. El enlace expira en 1 hora.
        </p>
        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onBack}>
          Volver al inicio de sesión
        </button>
      </div>
    );
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Mail size={48} style={{ color: 'var(--primary)', marginBottom: '14px' }} strokeWidth={1.5} />
        <h3 style={{ color: 'var(--secondary)', margin: '0 0 8px' }}>Recuperar contraseña</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="input-group" style={{ marginBottom: '28px' }}>
          <label className="input-label">Email de acceso</label>
          <div style={{ position: 'relative' }}>
            <Mail size={18} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <input type="email" className="input-field" placeholder="nombre@empresa.com" required
              value={email} onChange={e => setEmail(e.target.value)}
              style={{ border: 'none', borderBottom: '1px solid #ddd', borderRadius: 0, padding: '12px 0', paddingRight: '40px' }} />
          </div>
        </div>
        <button type="submit" className="btn btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: '1rem', marginBottom: '12px' }} disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
        </button>
        <button type="button" className="btn btn-secondary"
          style={{ width: '100%', padding: '12px', color: 'var(--text-muted)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          onClick={onBack}>
          <ArrowLeft size={16} /> Volver al inicio de sesión
        </button>
      </form>
    </>
  );
}

// ── Componente principal Auth ─────────────────────────────────────────────────
export default function Auth() {
  const [loading, setLoading]         = useState(false);
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  // Detectar si venimos del enlace de recuperación de contraseña
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.error_description || error.message);
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  const rightContent = isRecoveryMode
    ? <NewPasswordForm />
    : showRecovery
      ? <RecoveryForm onBack={() => setShowRecovery(false)} />
      : (
        <>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', justifyContent: 'flex-end', fontSize: '0.9rem' }}>ES ▾</div>
            <User size={64} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} strokeWidth={1} />
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Introduce tus datos de acceso de cliente</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label className="input-label" style={{ color: 'var(--text-muted)' }}>Usuario</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input type="email" className="input-field" placeholder="name@company.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  style={{ border: 'none', borderBottom: '1px solid #ddd', borderRadius: 0, padding: '12px 0', paddingRight: '40px' }}
                  required />
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: '32px' }}>
              <label className="input-label" style={{ color: 'var(--text-muted)' }}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Key size={18} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input type="password" className="input-field" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  style={{ border: 'none', borderBottom: '1px solid #ddd', borderRadius: 0, padding: '12px 0', paddingRight: '40px' }}
                  required />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', fontSize: '0.9rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <input type="checkbox" style={{ width: '18px', height: '18px' }} /> Recordarme
              </label>
              <button type="button"
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
                onClick={() => setShowRecovery(true)}>
                Recuperar contraseña
              </button>
            </div>

            <button type="submit" className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '1rem', textTransform: 'uppercase', marginBottom: '12px' }}
              disabled={loading}>
              {loading ? 'Accediendo...' : 'ACCEDER'}
            </button>

            <button type="button" className="btn btn-secondary"
              style={{ width: '100%', padding: '14px', fontSize: '0.9rem', color: 'var(--text-muted)', border: 'none', backgroundColor: '#f8f9fa' }}>
              <Key size={16} style={{ marginRight: '8px' }} /> ACCEDER CON SSO
            </button>
          </form>
        </>
      );

  return (
    <div className="auth-container">
      {/* Panel izquierdo — decorativo, oculto en móvil */}
      <div className="auth-left">
        <div style={{ marginBottom: '40px' }}>
          <div style={{ backgroundColor: 'white', padding: '12px 20px', borderRadius: '12px',
            display: 'inline-block', marginBottom: '32px', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
            <img src={logo} alt="HSLAB logo" style={{ width: '260px', height: 'auto', display: 'block' }} />
          </div>
          <h2 style={{ fontSize: '1.8rem', margin: '0 0 10px 0', fontWeight: 700, letterSpacing: '-0.5px' }}>
            Módulo Gestión de Compras
          </h2>
          <div style={{ width: '40px', height: '4px', backgroundColor: 'rgba(255,255,255,0.3)', margin: '20px auto', borderRadius: '2px' }} />
        </div>
        <p style={{ maxWidth: '500px', fontSize: '1.1rem', lineHeight: 1.5, fontWeight: 300, opacity: 0.9 }}>
          Sistema centralizado para el control de inventario, pedidos a proveedores y análisis de consumos de laboratorio.
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="auth-right">
        <div className="auth-right-inner">
          {rightContent}
        </div>
      </div>
    </div>
  );
}
