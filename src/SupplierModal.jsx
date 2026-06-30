import React, { useState, useEffect } from 'react';
import { X, Save, Building2, MapPin, Globe, FileText, FlaskConical, AlertTriangle, Award } from 'lucide-react';

const SUPPLIER_TYPES = [
  { value: 'producto',                label: 'Proveedor de Producto' },
  { value: 'servicio',                label: 'Proveedor de Servicio' },
  { value: 'laboratorio_subcontratado', label: 'Laboratorio Subcontratado (ISO 17025)' },
];

export default function SupplierModal({ isOpen, onClose, onSave, supplier }) {
  const [formData, setFormData] = useState({
    id: '', name: '', contact: '', email: '', phone: '',
    address: '', website: '', notes: '',
    supplier_type: 'producto', is_critical: false,
    accreditation_body: '', accreditation_number: '',
    accreditation_scope: '', accreditation_expiry: '',
  });

  useEffect(() => {
    if (supplier) {
      setFormData({
        id:                    supplier.id || '',
        name:                  supplier.name || '',
        contact:               supplier.contact || '',
        email:                 supplier.email || '',
        phone:                 supplier.phone || '',
        address:               supplier.address || '',
        website:               supplier.website || '',
        notes:                 supplier.notes || '',
        supplier_type:         supplier.supplier_type || 'producto',
        is_critical:           supplier.is_critical || false,
        accreditation_body:    supplier.accreditation_body || '',
        accreditation_number:  supplier.accreditation_number || '',
        accreditation_scope:   supplier.accreditation_scope || '',
        accreditation_expiry:  supplier.accreditation_expiry || '',
      });
    } else {
      setFormData({
        id: `PROV-${Math.floor(Math.random() * 9000 + 1000)}`,
        name: '', contact: '', email: '', phone: '',
        address: '', website: '', notes: '',
        supplier_type: 'producto', is_critical: false,
        accreditation_body: '', accreditation_number: '',
        accreditation_scope: '', accreditation_expiry: '',
      });
    }
  }, [supplier, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (payload.supplier_type !== 'laboratorio_subcontratado') {
      payload.accreditation_body = null;
      payload.accreditation_number = null;
      payload.accreditation_scope = null;
      payload.accreditation_expiry = null;
    }
    onSave(payload);
    onClose();
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const isLab = formData.supplier_type === 'laboratorio_subcontratado';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
    }}>
      <div className="card" style={{ width: '580px', margin: 0, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex-between" style={{ marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)' }}>
            <Building2 size={22} color="var(--primary)" />
            {supplier ? 'Editar Proveedor' : 'Alta Nuevo Proveedor'}
          </h3>
          <button className="btn btn-secondary" style={{ padding: '6px', border: 'none' }} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ID */}
          <div className="input-group">
            <label className="input-label">ID Proveedor</label>
            <input type="text" name="id" className="input-field" value={formData.id} readOnly
              style={{ backgroundColor: 'var(--background)', cursor: 'not-allowed' }} />
          </div>

          {/* Tipo + Crítico */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'end' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Tipo de proveedor *</label>
              <select name="supplier_type" className="input-field" value={formData.supplier_type} onChange={handleChange}>
                {SUPPLIER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', paddingBottom: '8px', whiteSpace: 'nowrap', fontSize: '0.875rem', fontWeight: 600, color: formData.is_critical ? '#dc2626' : 'var(--text-muted)' }}>
              <input type="checkbox" name="is_critical" checked={formData.is_critical} onChange={handleChange} style={{ width: '16px', height: '16px' }} />
              <AlertTriangle size={14} /> Crítico
            </label>
          </div>

          {/* Nombre */}
          <div className="input-group">
            <label className="input-label">Nombre de la Empresa *</label>
            <input type="text" name="name" className="input-field" value={formData.name} onChange={handleChange}
              required placeholder="Ej: Thermo Fisher Diagnostics S.L.U." />
          </div>

          {/* Dirección */}
          <div className="input-group">
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={14} color="var(--text-muted)" /> Dirección
            </label>
            <input type="text" name="address" className="input-field" value={formData.address} onChange={handleChange}
              placeholder="Ej: Calle Mayor 12, 28001 Madrid" />
          </div>

          {/* Contacto */}
          <div className="input-group">
            <label className="input-label">Persona de Contacto</label>
            <input type="text" name="contact" className="input-field" value={formData.contact} onChange={handleChange}
              placeholder="Ej: Juan Pérez" />
          </div>

          {/* Email + Teléfono */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input type="email" name="email" className="input-field" value={formData.email} onChange={handleChange}
                placeholder="proveedor@ejemplo.com" />
            </div>
            <div className="input-group">
              <label className="input-label">Teléfono</label>
              <input type="text" name="phone" className="input-field" value={formData.phone} onChange={handleChange}
                placeholder="+34 000 000 000" />
            </div>
          </div>

          {/* Web */}
          <div className="input-group">
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={14} color="var(--text-muted)" /> Sitio Web
            </label>
            <input type="text" name="website" className="input-field" value={formData.website} onChange={handleChange}
              placeholder="www.proveedor.com" />
          </div>

          {/* Acreditación — solo laboratorios subcontratados */}
          {isLab && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontWeight: 700, color: '#0369a1', fontSize: '0.85rem' }}>
                <Award size={15} /> Acreditación ISO 17025
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Organismo acreditador</label>
                  <input type="text" name="accreditation_body" className="input-field" value={formData.accreditation_body} onChange={handleChange}
                    placeholder="ej. ENAC" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Nº de acreditación</label>
                  <input type="text" name="accreditation_number" className="input-field" value={formData.accreditation_number} onChange={handleChange}
                    placeholder="ej. LE-1234" />
                </div>
              </div>
              <div className="input-group" style={{ marginTop: '10px', marginBottom: 0 }}>
                <label className="input-label">Alcance de la acreditación</label>
                <textarea name="accreditation_scope" className="input-field" value={formData.accreditation_scope} onChange={handleChange}
                  rows={2} placeholder="Ensayos/técnicas cubiertas por la acreditación"
                  style={{ resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div className="input-group" style={{ marginTop: '10px', marginBottom: 0 }}>
                <label className="input-label">Fecha de vencimiento de la acreditación</label>
                <input type="date" name="accreditation_expiry" className="input-field" value={formData.accreditation_expiry} onChange={handleChange} />
              </div>
            </div>
          )}

          {/* Notas */}
          <div className="input-group">
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} color="var(--text-muted)" /> Notas / Observaciones
            </label>
            <textarea name="notes" className="input-field" value={formData.notes} onChange={handleChange}
              placeholder="Condiciones especiales, plazos de entrega habituales, etc."
              rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Save size={18} /> {supplier ? 'Guardar Cambios' : 'Registrar Proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
