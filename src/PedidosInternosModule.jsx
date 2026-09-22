import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import {
  ArrowLeft, Plus, Package, Search, X, Clock, Truck, Ban,
  ChevronRight, Warehouse, Calendar, Trash2,
} from 'lucide-react';

// ── Constants ───────────────────────────────────────────────────────────────

const ALMACENES_PENINSULA = [
  'Almacén Madrid (Getafe)',
  'Almacén Barcelona (Gavà)',
  'Almacén Valencia',
  'Almacén Sevilla',
  'Almacén Bilbao',
];

const ESTADOS = {
  pendiente:      { label: 'Pendiente',      color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  en_preparacion: { label: 'En preparación', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  enviado:        { label: 'Enviado',         color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  cancelado:      { label: 'Cancelado',       color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
};

// ── Shared styles ────────────────────────────────────────────────────────────

const labelS = {
  display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
};
const inputS = {
  width: '100%', padding: '9px 12px', border: '1px solid #D1D5DB',
  borderRadius: 8, fontSize: '0.9rem', color: '#111827', boxSizing: 'border-box',
  outline: 'none', background: 'white',
};
const btnPri = {
  padding: '9px 18px', background: 'var(--primary)', color: 'white',
  border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
  fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6,
};
const btnSec = {
  padding: '9px 16px', background: 'white', color: '#374151',
  border: '1px solid #D1D5DB', borderRadius: 8, cursor: 'pointer',
  fontWeight: 600, fontSize: '0.875rem',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function EstadoBadge({ estado }) {
  const c = ESTADOS[estado] || ESTADOS.pendiente;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.03em',
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
    }}>{c.label}</span>
  );
}

// ── Nuevo Pedido Modal ────────────────────────────────────────────────────────

function NuevoPedidoModal({ onClose, onCreated }) {
  const [tipo, setTipo] = useState('almacen');
  const [almacen, setAlmacen] = useState(ALMACENES_PENINSULA[0]);
  const [hotelQ, setHotelQ] = useState('');
  const [hotels, setHotels] = useState([]);
  const [hotelSel, setHotelSel] = useState(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [artQ, setArtQ] = useState('');
  const [arts, setArts] = useState([]);
  const [artLoading, setArtLoading] = useState(false);
  const [lineas, setLineas] = useState([]);
  const [fechaNec, setFechaNec] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.from('hoteles_destino')
      .select('id,nombre_hotel,cadena_hotelera,ccaa')
      .order('nombre_hotel')
      .then(({ data }) => setHotels(data || []));
  }, []);

  useEffect(() => {
    if (!artQ.trim()) { setArts([]); return; }
    setArtLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('articles')
        .select('id,name,category,"supplierRef",format')
        .or(`name.ilike.%${artQ}%,"supplierRef".ilike.%${artQ}%`)
        .order('name').limit(30);
      setArts(data || []);
      setArtLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [artQ]);

  const addLinea = (a) => {
    if (lineas.find(l => l.articulo_id === a.id)) return;
    setLineas(p => [...p, { articulo_id: a.id, articulo_nombre: a.name, articulo_ref: a.supplierRef || '', articulo_formato: a.format || '', cantidad: 1, observacion: '' }]);
    setArtQ(''); setArts([]);
  };
  const updLinea = (i, k, v) => setLineas(p => p.map((l, j) => j === i ? { ...l, [k]: v } : l));
  const delLinea = (i) => setLineas(p => p.filter((_, j) => j !== i));

  const filtH = hotels.filter(h =>
    !hotelQ || h.nombre_hotel.toLowerCase().includes(hotelQ.toLowerCase()) ||
    (h.cadena_hotelera || '').toLowerCase().includes(hotelQ.toLowerCase())
  ).slice(0, 60);

  const handleSubmit = async () => {
    if (lineas.length === 0) { setErr('Añade al menos un artículo.'); return; }
    if (tipo === 'hotel' && !hotelSel) { setErr('Selecciona un hotel destino.'); return; }
    setSaving(true); setErr('');
    const { data: { user } } = await supabase.auth.getUser();
    const { data: pedido, error: pe } = await supabase.from('pedidos_internos').insert({
      consultor_id: user.id,
      consultor_nombre: user.email,
      destino_tipo: tipo,
      destino_almacen: tipo === 'almacen' ? almacen : null,
      destino_hotel_id: tipo === 'hotel' ? hotelSel.id : null,
      destino_hotel_nombre: tipo === 'hotel' ? hotelSel.nombre_hotel : null,
      notas_consultor: notas || null,
      fecha_necesaria: fechaNec || null,
      estado: 'pendiente',
    }).select().single();
    if (pe) { setErr(pe.message); setSaving(false); return; }
    const { error: le } = await supabase.from('pedidos_internos_lineas').insert(lineas.map(l => ({ ...l, pedido_id: pedido.id })));
    if (le) { setErr(le.message); setSaving(false); return; }
    onCreated(pedido);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 620, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>Nuevo pedido de material</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Destino tipo */}
          <div>
            <label style={labelS}>Destino del envío</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              {[['almacen', 'Almacén peninsular'], ['hotel', 'Hotel cliente']].map(([v, lbl]) => (
                <button key={v} onClick={() => { setTipo(v); setHotelSel(null); setHotelQ(''); }} style={{
                  flex: 1, padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                  border: `2px solid ${tipo === v ? 'var(--primary)' : '#E5E7EB'}`,
                  background: tipo === v ? 'var(--primary-light)' : 'white',
                  color: tipo === v ? 'var(--primary)' : '#374151', transition: 'all 0.12s',
                }}>{lbl}</button>
              ))}
            </div>

            {tipo === 'almacen' ? (
              <select value={almacen} onChange={e => setAlmacen(e.target.value)} style={inputS}>
                {ALMACENES_PENINSULA.map(a => <option key={a}>{a}</option>)}
              </select>
            ) : (
              <div style={{ position: 'relative' }}>
                <input placeholder="Buscar hotel..." value={hotelQ}
                  onChange={e => { setHotelQ(e.target.value); setHotelSel(null); setDropOpen(true); }}
                  onFocus={() => setDropOpen(true)} style={inputS} />
                {hotelSel && (
                  <div style={{ marginTop: 6, padding: '7px 12px', background: '#EFF6FF', borderRadius: 6, fontSize: '0.85rem', color: '#1D4ED8', fontWeight: 600 }}>
                    {hotelSel.nombre_hotel} — <span style={{ fontWeight: 400 }}>{hotelSel.cadena_hotelera}</span>
                  </div>
                )}
                {dropOpen && !hotelSel && filtH.length > 0 && (
                  <div style={{ position: 'absolute', zIndex: 200, top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.1)', maxHeight: 210, overflowY: 'auto', marginTop: 4 }}>
                    {filtH.map(h => (
                      <div key={h.id} onClick={() => { setHotelSel(h); setHotelQ(h.nombre_hotel); setDropOpen(false); }}
                        style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }}
                        onMouseOver={e => e.currentTarget.style.background = '#F9FAFB'}
                        onMouseOut={e => e.currentTarget.style.background = 'white'}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>{h.nombre_hotel}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{h.cadena_hotelera} · {h.ccaa}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Artículos */}
          <div>
            <label style={labelS}>Artículos solicitados</label>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input placeholder="Buscar por nombre o referencia..." value={artQ}
                onChange={e => setArtQ(e.target.value)} style={{ ...inputS, paddingLeft: 34 }} />
              {(artLoading || arts.length > 0) && (
                <div style={{ position: 'absolute', zIndex: 200, top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.1)', maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
                  {artLoading ? (
                    <div style={{ padding: 12, textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>Buscando...</div>
                  ) : arts.map(a => {
                    const added = !!lineas.find(l => l.articulo_id === a.id);
                    return (
                      <div key={a.id} onClick={() => !added && addLinea(a)}
                        style={{ padding: '8px 14px', cursor: added ? 'default' : 'pointer', borderBottom: '1px solid #F3F4F6', opacity: added ? 0.45 : 1 }}
                        onMouseOver={e => { if (!added) e.currentTarget.style.background = '#F9FAFB'; }}
                        onMouseOut={e => e.currentTarget.style.background = 'white'}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>{a.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{a.category} · Ref: {a.supplierRef || '—'}{a.format ? ` · ${a.format}` : ''}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {lineas.length === 0 ? (
              <div style={{ marginTop: 10, padding: '14px', background: '#F9FAFB', borderRadius: 8, textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem', border: '1px dashed #D1D5DB' }}>
                Busca y añade artículos
              </div>
            ) : (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lineas.map((l, i) => (
                  <div key={i} style={{ padding: '10px 14px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.articulo_nombre}</div>
                        <div style={{ fontSize: '0.73rem', color: '#6B7280' }}>{l.articulo_ref}{l.articulo_formato ? ` · ${l.articulo_formato}` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Cant.</span>
                          <input type="number" min="1" value={l.cantidad}
                            onChange={e => updLinea(i, 'cantidad', Math.max(1, parseInt(e.target.value) || 1))}
                            style={{ width: 54, padding: '4px 6px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: '0.85rem', textAlign: 'center' }}
                          />
                        </div>
                        <button onClick={() => delLinea(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2 }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <input placeholder="Observación (opcional)" value={l.observacion}
                      onChange={e => updLinea(i, 'observacion', e.target.value)}
                      style={{ marginTop: 6, width: '100%', padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: '0.8rem', color: '#374151', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Extras */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelS}>Fecha necesaria (opcional)</label>
              <input type="date" value={fechaNec} onChange={e => setFechaNec(e.target.value)} style={inputS} />
            </div>
          </div>

          <div>
            <label style={labelS}>Notas para operaciones</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Urgencia, instrucciones especiales..."
              style={{ ...inputS, resize: 'vertical' }}
            />
          </div>

          {err && (
            <div style={{ padding: '9px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: '0.85rem' }}>{err}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 2 }}>
            <button onClick={onClose} style={btnSec}>Cancelar</button>
            <button onClick={handleSubmit} disabled={saving} style={{ ...btnPri, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Enviando...' : <><Plus size={15} /> Enviar pedido</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detalle Pedido Modal ──────────────────────────────────────────────────────

function DetallePedidoModal({ pedido, lineas, isOps, onClose, onUpdated }) {
  const [estado, setEstado] = useState(pedido.estado);
  const [notasOps, setNotasOps] = useState(pedido.notas_operaciones || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const upd = { estado, notas_operaciones: notasOps };
    if (estado === 'enviado' && pedido.estado !== 'enviado') upd.fecha_envio = new Date().toISOString();
    await supabase.from('pedidos_internos').update(upd).eq('id', pedido.id);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onUpdated({ ...pedido, ...upd });
  };

  const destino = pedido.destino_tipo === 'hotel' ? pedido.destino_hotel_nombre : pedido.destino_almacen;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, color: '#111827', fontSize: '1rem' }}>Pedido</span>
              <code style={{ fontSize: '0.75rem', color: '#6B7280', background: '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>#{pedido.id.slice(0,8)}</code>
              <EstadoBadge estado={estado} />
            </div>
            <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: 4 }}>{pedido.consultor_nombre} · {fmt(pedido.created_at)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Destino */}
          <div style={{ padding: '11px 14px', background: '#F9FAFB', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
            <Warehouse size={17} color="var(--primary)" />
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {pedido.destino_tipo === 'hotel' ? 'Hotel destino' : 'Almacén destino'}
              </div>
              <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>{destino}</div>
            </div>
          </div>

          {/* Lineas */}
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Artículos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lineas.map(l => (
                <div key={l.id} style={{ padding: '9px 14px', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>{l.articulo_nombre}</div>
                      <div style={{ fontSize: '0.73rem', color: '#6B7280' }}>{l.articulo_ref}{l.articulo_formato ? ` · ${l.articulo_formato}` : ''}</div>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem', marginLeft: 12 }}>×{l.cantidad}</span>
                  </div>
                  {l.observacion && <div style={{ marginTop: 5, fontSize: '0.8rem', color: '#6B7280', fontStyle: 'italic' }}>{l.observacion}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Info adicional */}
          {pedido.fecha_necesaria && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.85rem', color: '#374151' }}>
              <Calendar size={14} color="#6B7280" />
              <span>Necesario para: <strong>{fmt(pedido.fecha_necesaria)}</strong></span>
            </div>
          )}
          {pedido.notas_consultor && (
            <div style={{ padding: '9px 14px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A', fontSize: '0.85rem', color: '#92400E' }}>
              <strong>Nota del consultor:</strong> {pedido.notas_consultor}
            </div>
          )}

          {/* Controles ops */}
          {isOps ? (
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={labelS}>Estado</label>
                <select value={estado} onChange={e => setEstado(e.target.value)} style={inputS}>
                  {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelS}>Notas de operaciones</label>
                <textarea value={notasOps} onChange={e => setNotasOps(e.target.value)} rows={2}
                  placeholder="Comentarios para el consultor..."
                  style={{ ...inputS, resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={onClose} style={btnSec}>Cerrar</button>
                <button onClick={handleSave} disabled={saving} style={{ ...btnPri, opacity: saving ? 0.7 : 1 }}>
                  {saved ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {pedido.notas_operaciones && (
                <div style={{ padding: '9px 14px', background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE', fontSize: '0.85rem', color: '#1E40AF', marginBottom: 14 }}>
                  <strong>Operaciones:</strong> {pedido.notas_operaciones}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={btnSec}>Cerrar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Consultor View ────────────────────────────────────────────────────────────

function ConsultorView({ onBack }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [sel, setSel] = useState(null);
  const [selLineas, setSelLineas] = useState([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('pedidos_internos').select('*').order('created_at', { ascending: false });
    setPedidos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = async (p) => {
    const { data } = await supabase.from('pedidos_internos_lineas').select('*').eq('pedido_id', p.id);
    setSelLineas(data || []);
    setSel(p);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <header style={{ height: 60, background: 'white', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ArrowLeft size={17} /> <span style={{ fontSize: '0.83rem' }}>Portal</span>
        </button>
        <span style={{ color: '#D1D5DB' }}>|</span>
        <Package size={17} color="var(--primary)" />
        <h1 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Mis pedidos de material</h1>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowNew(true)} style={{ ...btnPri, padding: '7px 14px', fontSize: '0.83rem' }}>
          <Plus size={15} /> Nuevo pedido
        </button>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>Cargando...</div>
        ) : pedidos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 56 }}>
            <Package size={44} color="#D1D5DB" style={{ marginBottom: 12 }} />
            <p style={{ color: '#9CA3AF', margin: '0 0 16px', fontSize: '0.95rem' }}>Aún no has hecho ningún pedido.</p>
            <button onClick={() => setShowNew(true)} style={btnPri}>Crear primer pedido</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pedidos.map(p => (
              <div key={p.id} onClick={() => open(p)}
                style={{ background: 'white', borderRadius: 10, padding: '14px 18px', border: '1px solid #E5E7EB', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseOver={e => e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.07)'}
                onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <EstadoBadge estado={p.estado} />
                    <code style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>#{p.id.slice(0,8)}</code>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>
                    {p.destino_tipo === 'hotel' ? p.destino_hotel_nombre : p.destino_almacen}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: 2 }}>
                    {fmt(p.created_at)}{p.fecha_necesaria ? ` · Necesario: ${fmt(p.fecha_necesaria)}` : ''}
                  </div>
                </div>
                <ChevronRight size={17} color="#9CA3AF" />
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <NuevoPedidoModal
          onClose={() => setShowNew(false)}
          onCreated={(p) => { setPedidos(prev => [p, ...prev]); setShowNew(false); }}
        />
      )}
      {sel && (
        <DetallePedidoModal pedido={sel} lineas={selLineas} isOps={false}
          onClose={() => setSel(null)}
          onUpdated={(u) => { setPedidos(prev => prev.map(p => p.id === u.id ? u : p)); setSel(u); }}
        />
      )}
    </div>
  );
}

// ── Operaciones View ──────────────────────────────────────────────────────────

function OperacionesView({ onBack }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [sel, setSel] = useState(null);
  const [selLineas, setSelLineas] = useState([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('pedidos_internos').select('*').order('created_at', { ascending: false });
    setPedidos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = async (p) => {
    const { data } = await supabase.from('pedidos_internos_lineas').select('*').eq('pedido_id', p.id);
    setSelLineas(data || []);
    setSel(p);
  };

  const filtered = filtro === 'todos' ? pedidos : pedidos.filter(p => p.estado === filtro);
  const cnt = { todos: pedidos.length };
  Object.keys(ESTADOS).forEach(k => { cnt[k] = pedidos.filter(p => p.estado === k).length; });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <header style={{ height: 60, background: 'white', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ArrowLeft size={17} /> <span style={{ fontSize: '0.83rem' }}>Portal</span>
        </button>
        <span style={{ color: '#D1D5DB' }}>|</span>
        <Package size={17} color="var(--primary)" />
        <h1 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Gestión de pedidos internos</h1>
      </header>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 16px' }}>
        {/* Tiles resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[['pendiente','Pendientes',Clock],['en_preparacion','En preparación',Package],['enviado','Enviados',Truck]].map(([k, lbl, Icon]) => {
            const c = ESTADOS[k];
            return (
              <div key={k} onClick={() => setFiltro(filtro === k ? 'todos' : k)}
                style={{ background: filtro === k ? c.bg : 'white', borderRadius: 10, padding: '14px 16px', border: `2px solid ${filtro === k ? c.border : '#E5E7EB'}`, cursor: 'pointer', textAlign: 'center' }}
              >
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: c.color, lineHeight: 1 }}>{cnt[k]}</div>
                <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, marginTop: 4 }}>{lbl}</div>
              </div>
            );
          })}
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {[['todos','Todos'], ...Object.entries(ESTADOS).map(([k,v]) => [k, v.label])].map(([k, lbl]) => (
            <button key={k} onClick={() => setFiltro(k)} style={{
              padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
              border: `1px solid ${filtro === k ? 'var(--primary)' : '#E5E7EB'}`,
              background: filtro === k ? 'var(--primary-light)' : 'white',
              color: filtro === k ? 'var(--primary)' : '#374151',
            }}>{lbl} ({cnt[k] ?? 0})</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF', fontSize: '0.9rem' }}>
            No hay pedidos{filtro !== 'todos' ? ` con estado "${ESTADOS[filtro]?.label}"` : ''}.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {filtered.map(p => (
              <div key={p.id} onClick={() => open(p)}
                style={{ background: 'white', borderRadius: 10, padding: '13px 18px', border: '1px solid #E5E7EB', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseOver={e => e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.07)'}
                onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                    <EstadoBadge estado={p.estado} />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.destino_tipo === 'hotel' ? p.destino_hotel_nombre : p.destino_almacen}
                    </span>
                    {p.fecha_necesaria && (
                      <span style={{ fontSize: '0.72rem', color: '#D97706', background: '#FFFBEB', padding: '2px 8px', borderRadius: 10, border: '1px solid #FDE68A', whiteSpace: 'nowrap' }}>
                        Nec. {fmt(p.fecha_necesaria)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>
                    {p.consultor_nombre} · {fmt(p.created_at)}
                    {p.notas_consultor && <span style={{ color: '#D97706', marginLeft: 8 }}>· Tiene nota</span>}
                  </div>
                </div>
                <ChevronRight size={16} color="#9CA3AF" style={{ flexShrink: 0, marginLeft: 10 }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {sel && (
        <DetallePedidoModal pedido={sel} lineas={selLineas} isOps={true}
          onClose={() => setSel(null)}
          onUpdated={(u) => { setPedidos(prev => prev.map(p => p.id === u.id ? u : p)); setSel(u); }}
        />
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function PedidosInternosModule({ onBackToHub, role }) {
  if (role === 'consultor') return <ConsultorView onBack={onBackToHub} />;
  return <OperacionesView onBack={onBackToHub} />;
}
