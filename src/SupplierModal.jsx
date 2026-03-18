import React, { useState, useEffect } from 'react';
import { X, Save, Building2 } from 'lucide-react';

export default function SupplierModal({ isOpen, onClose, onSave, supplier }) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    contact: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    if (supplier) {
      setFormData(supplier);
    } else {
      setFormData({
        id: `PROV-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        name: '',
        contact: '',
        email: '',
        phone: ''
      });
    }
  }, [supplier, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
    }}>
      <div className="card" style={{ width: '500px', margin: 0 }}>
        <div className="flex-between" style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)' }}>
            <Building2 size={22} color="var(--primary)"/> {supplier ? 'Editar Proveedor' : 'Alta Nuevo Proveedor'}
          </h3>
          <button className="btn btn-secondary" style={{ padding: '6px', border: 'none' }} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">ID Proveedor</label>
            <input 
              type="text" 
              name="id"
              className="input-field" 
              value={formData.id} 
              readOnly 
              style={{ backgroundColor: 'var(--background)', cursor: 'not-allowed' }}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Nombre de la Empresa</label>
            <input 
              type="text" 
              name="name"
              className="input-field" 
              value={formData.name} 
              onChange={handleChange}
              required 
              placeholder="Ej: LabSupply S.L."
            />
          </div>

          <div className="input-group">
            <label className="input-label">Persona de Contacto</label>
            <input 
              type="text" 
              name="contact"
              className="input-field" 
              value={formData.contact} 
              onChange={handleChange}
              placeholder="Ej: Juan Pérez"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input 
                type="email" 
                name="email"
                className="input-field" 
                value={formData.email} 
                onChange={handleChange}
                placeholder="proveedor@ejemplo.com"
              />
            </div>
            <div className="input-group">
              <label className="input-label">Teléfono</label>
              <input 
                type="text" 
                name="phone"
                className="input-field" 
                value={formData.phone} 
                onChange={handleChange}
                placeholder="+34 000 000 000"
              />
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Save size={18} /> {supplier ? 'Guardar Cambios' : 'Registrar Proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
