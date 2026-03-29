import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import Hub from './Hub';
import PurchasingModule from './PurchasingModule';

import EquipmentModule from './EquipmentModule';
import UserManagementModule from './UserManagementModule';


export default function App() {
  const [session, setSession] = useState(null);
  // Shared context for the entire application
  const [globalLab, setGlobalLab] = useState('HSLAB Baleares');
  const [activeModule, setActiveModule] = useState(null);

  const [role, setRole] = useState('operations');

  const fetchUserRole = async (user) => {
    if (!user) return;
    // 1. Try profiles table first
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role) {
      setRole(profile.role);
    } else {
      // 2. Fallback to metadata
      setRole(user.user_metadata?.role || 'operations');
    }
  };

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

  if (!session && !window.location.hostname.includes('localhost')) {
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
