import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import Hub from './Hub';
import PurchasingModule from './PurchasingModule';

import EquipmentModule from './EquipmentModule';
import UserManagementModule from './UserManagementModule';
import LegionellaForecastModule from './LegionellaForecastModule';


export default function App() {
  const [session, setSession] = useState(null);
  // Shared context for the entire application
  const [globalLab, setGlobalLab] = useState('HSLAB Baleares');
  const [activeModule, setActiveModule] = useState(null);

  const [role, setRole] = useState('operations');

  const labFromDelegacion = (d) => d === 'Canarias' ? 'HSLAB Canarias' : 'HSLAB Baleares';

  const fetchUserRole = async (user) => {
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('role, delegacion').eq('id', user.id).single();
    if (profile?.role) {
      setRole(profile.role);
    } else {
      setRole(user.user_metadata?.role || 'operations');
    }
    const delegacion = profile?.delegacion || user.user_metadata?.delegacion;
    if (delegacion) {
      setGlobalLab(labFromDelegacion(delegacion));
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    if (globalLab === 'HSLAB Canarias') {
      root.style.setProperty('--primary',       '#16A34A');
      root.style.setProperty('--primary-hover', '#15803D');
      root.style.setProperty('--primary-light', '#DCFCE7');
      root.style.setProperty('--sidebar-bg',    '#16A34A');
      root.style.setProperty('--background',    '#F0FDF4');
      root.style.setProperty('--secondary',     '#14532D');
      root.style.setProperty('--surface',       '#FFFFFF');
      root.style.setProperty('--surface-hover', '#F8F9FA');
    } else {
      root.style.setProperty('--primary',       '#0076CE');
      root.style.setProperty('--primary-hover', '#005FA5');
      root.style.setProperty('--primary-light', '#EFF6FF');
      root.style.setProperty('--sidebar-bg',    '#0076CE');
      root.style.setProperty('--background',    '#F4F7F9');
      root.style.setProperty('--secondary',     '#000B3D');
    }
  }, [globalLab]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      fetchUserRole(session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      fetchUserRole(session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return <Auth />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!activeModule) {
    return (
      <Hub 
        session={session}
        globalLab={globalLab}
        setGlobalLab={setGlobalLab}
        role={role}
        onSelectModule={setActiveModule}
        onLogout={handleLogout}
      />
    );
  }

  if (activeModule === 'compras') {
    return (
      <PurchasingModule 
        session={session}
        globalLab={globalLab}
        onLogout={handleLogout}
        onBackToHub={() => setActiveModule(null)}
        role={role}
        onSelectModule={setActiveModule}
      />
    );
  }

  if (activeModule === 'equipos') {
    return (
      <EquipmentModule 
        session={session}
        globalLab={globalLab}
        role={role}
        onLogout={handleLogout}
        onBackToHub={() => setActiveModule(null)}
        onSelectModule={setActiveModule}
      />
    );
  }

  if (activeModule === 'legionella') {
    return (
      <LegionellaForecastModule
        onBackToHub={() => setActiveModule(null)}
        globalLab={globalLab}
      />
    );
  }

  if (activeModule === 'usuarios' && role === 'admin') {
    return (
      <UserManagementModule 
        onBackToHub={() => setActiveModule(null)}
      />
    );
  }

  // Fallback for modules not yet implemented
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f7f9' }}>
      <h2 style={{ color: '#000b3d' }}>Módulo "{activeModule}" en fase inicial</h2>
      <p style={{ color: '#666', marginBottom: '24px' }}>Este módulo está siendo preparado y no está operativo actualmente.</p>
      <button 
        onClick={() => setActiveModule(null)}
        style={{ padding: '10px 20px', backgroundColor: '#0076ce', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
      >
        ← Volver al Portal
      </button>
    </div>
  );
}
