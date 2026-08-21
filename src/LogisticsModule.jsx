import React, { useState, useEffect, useMemo } from 'react';

const API = '/.netlify/functions/hotels-api';

// Mallorca zone definitions — order matters (first match wins)
const MALLORCA_ZONES = [
  {
    id: 'palma', name: 'Palma', color: '#2a78d6',
    match: (m) => ['palma', 'playa de palma', 'platja de palma', 'el arenal', 'can pastilla', 'son ferriol', 'arenal', 's\'arenal'].some(z => m.toLowerCase().includes(z)),
  },
  {
    id: 'calvia', name: 'Calvià / Andratx', color: '#eb6834',
    match: (m) => ['calvià', 'calvia', 'peguera', 'palmanova', 'santa ponça', 'santa ponsa', 'andratx', 'magaluf', 'portals', 'camp de mar', 's\'arracó', 'torrenova', 'cala fornells', 'cala vinyes', 'illetes'].some(z => m.toLowerCase().includes(z)),
  },
  {
    id: 'nord', name: 'Nord / Alcúdia', color: '#1baf7a',
    match: (m) => ['alcúdia', 'alcudia', 'port d\'alcúdia', 'pollença', 'pollensa', 'sa pobla', 'muro', 'can picafort', 'campanet', 'búger', 'escorca', 'alcudia'].some(z => m.toLowerCase().includes(z)),
  },
  {
    id: 'llevant', name: 'Llevant / Capdepera', color: '#eda100',
    match: (m) => ['artà', 'arta', 'capdepera', 'cala ratjada', 'son servera', 'cala millor', 'cala bona', 'sant llorenç', 'son carrió', 'sa coma', 'cala ratjada'].some(z => m.toLowerCase().includes(z)),
  },
  {
    id: 'manacor', name: 'Manacor / Felanitx', color: '#0891b2',
    match: (m) => ['manacor', 'felanitx', 'porto cristo', 'cales de mallorca', 'portocolom', 'petra', 'vilafranca', 'cala murada', 's\'illot', 'cala anguila'].some(z => m.toLowerCase().includes(z)),
  },
  {
    id: 'migjorn', name: 'Migjorn / Sud', color: '#dc2626',
    match: (m) => ['santanyí', 'santanyi', 'ses salines', 'campos', 'llucmajor', 'porreres', 'colònia de sant jordi', 'cala d\'or', 'cala figuera', 'portopetro', 'cala serena', 'cala gran', 'es trenc'].some(z => m.toLowerCase().includes(z)),
  },
  {
    id: 'tramuntana', name: 'Tramuntana / Sóller', color: '#7c3aed',
    match: (m) => ['sóller', 'soller', 'valldemossa', 'deià', 'deia', 'banyalbufar', 'esporles', 'fornalutx', 'puigpunyent', 'estellencs'].some(z => m.toLowerCase().includes(z)),
  },
  {
    id: 'interior', name: 'Interior / Raiguer', color: '#64748b',
    match: (m) => ['inca', 'binissalem', 'consell', 'santa maria', 'alaró', 'lloseta', 'selva', 'mancor', 'sencelles', 'santa eugènia', 'costitx', 'lloret'].some(z => m.toLowerCase().includes(z)),
  },
];

const IBIZA_ZONES = [
  { id: 'ibiza_nord', name: 'Ibiza Nord', color: '#2a78d6', match: (m) => ['sant joan', 'santa eulària', 'santa eularia', 'siesta', 'es canar'].some(z => m.toLowerCase().includes(z)) },
  { id: 'ibiza_sur', name: 'Ibiza / Sud', color: '#eb6834', match: (m) => ['eivissa', 'ibiza', 'sant josep', 'platja d\'en bossa', 'playa d\'en bossa', 'sant francesc'].some(z => m.toLowerCase().includes(z)) },
  { id: 'ibiza_west', name: 'Ibiza Oeste', color: '#1baf7a', match: (m) => ['sant antoni', 'san antonio', 'cala de bou', 'sant rafel'].some(z => m.toLowerCase().includes(z)) },
];

const MENORCA_ZONE = { id: 'menorca', name: 'Menorca', color: '#7c3aed' };

function classifyHotel(hotel) {
  const isla = (hotel.isla || '').toLowerCase();
  const muni = (hotel.municipio || hotel.nombre_hotel || '').toLowerCase();

  if (isla.includes('ibiza') || isla.includes('eivissa') || isla.includes('formentera')) {
    for (const z of IBIZA_ZONES) if (z.match(muni)) return { ...z, isla: 'Ibiza' };
    return { ...IBIZA_ZONES[1], isla: 'Ibiza' };
  }
  if (isla.includes('menorca')) return { ...MENORCA_ZONE, isla: 'Menorca' };
  if (isla.includes('mallorca') || isla === '' || !isla) {
    for (const z of MALLORCA_ZONES) if (z.match(muni)) return { ...z, isla: 'Mallorca' };
    return { id: 'otros_mallorca', name: 'Otros – Mallorca', color: '#94a3b8', isla: 'Mallorca' };
  }
  return { id: 'otros', name: 'Otros', color: '#94a3b8', isla: hotel.isla || 'Desconocida' };
}

async function fetchAll(endpoint, filters = {}) {
  const results = [];
  let offset = 0;
  const limit = 500;
  while (true) {
    const qs = new URLSearchParams({ endpoint, limit, offset, ...filters }).toString();
    const resp = await fetch(`${API}?${qs}`);
    const data = await resp.json();
    const items = data.data || data.hoteles || data.consultores || [];
    results.push(...items);
    if (items.length < limit) break;
    offset += limit;
  }
  return results;
}

export default function LogisticsModule({ onBackToHub, globalLab }) {
  const [tab, setTab] = useState('zonas');
  const [hotels, setHotels] = useState([]);
  const [consultants, setConsultants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIsland, setSelectedIsland] = useState('Mallorca');
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedConsultant, setSelectedConsultant] = useState(null);
  const [zoneAssignments, setZoneAssignments] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hs_zone_assignments') || '{}'); } catch { return {}; }
  });
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchAll('hoteles', { pais: 'España' }),
      fetchAll('consultores'),
    ]).then(([h, c]) => {
      // Filter to Baleares only
      const baleares = h.filter(hotel => {
        const ccaa = (hotel.ccaa || '').toLowerCase();
        const isla = (hotel.isla || '').toLowerCase();
        return ccaa.includes('balear') || isla.includes('mallorca') || isla.includes('ibiza') || isla.includes('menorca') || isla.includes('eivissa') || isla.includes('formentera');
      });
      setHotels(baleares);
      const balearesCons = c.filter(con => {
        const region = (con.region || con.delegacion || '').toLowerCase();
        const isla = (con.isla || '').toLowerCase();
        return region.includes('balear') || isla.includes('mallorca') || isla.includes('ibiza') || isla.includes('menorca');
      });
      setConsultants(balearesCons);
      setLoading(false);
    }).catch(err => { setError(err.message); setLoading(false); });
  }, []);

  // Classify hotels
  const classifiedHotels = useMemo(() => hotels.map(h => ({ ...h, zone: classifyHotel(h) })), [hotels]);

  // Hotels by island
  const hotelsByIsland = useMemo(() => {
    const filtered = classifiedHotels.filter(h => h.zone.isla === selectedIsland);
    return filtered;
  }, [classifiedHotels, selectedIsland]);

  // Zones with hotel counts for selected island
  const zoneStats = useMemo(() => {
    const map = {};
    hotelsByIsland.forEach(h => {
      const zid = h.zone.id;
      if (!map[zid]) map[zid] = { ...h.zone, hotels: [] };
      map[zid].hotels.push(h);
    });
    return Object.values(map).sort((a, b) => b.hotels.length - a.hotels.length);
  }, [hotelsByIsland]);

  // Consultants for selected island
  const islandConsultants = useMemo(() => {
    return consultants.filter(c => {
      const isla = (c.isla || '').toLowerCase();
      const region = (c.region || '').toLowerCase();
      if (selectedIsland === 'Mallorca') return isla.includes('mallorca') || (region.includes('balear') && !isla.includes('ibiza') && !isla.includes('menorca'));
      if (selectedIsland === 'Ibiza') return isla.includes('ibiza') || isla.includes('eivissa');
      if (selectedIsland === 'Menorca') return isla.includes('menorca');
      return false;
    });
  }, [consultants, selectedIsland]);

  const saveAssignment = (zoneId, consultantId) => {
    const updated = { ...zoneAssignments, [`${selectedIsland}__${zoneId}`]: consultantId };
    setZoneAssignments(updated);
    localStorage.setItem('hs_zone_assignments', JSON.stringify(updated));
  };

  const getAssignedConsultant = (zoneId) => {
    const cid = zoneAssignments[`${selectedIsland}__${zoneId}`];
    return consultants.find(c => c.id === cid);
  };

  // Route planning: hotels in selected zone, grouped by municipality
  const routeHotels = useMemo(() => {
    if (!selectedZone) return [];
    const inZone = hotelsByIsland.filter(h => h.zone.id === selectedZone);
    const filtered = filterText
      ? inZone.filter(h => (h.nombre_hotel + h.municipio + h.direccion_completa).toLowerCase().includes(filterText.toLowerCase()))
      : inZone;
    // Group by municipality, sort municipalities alphabetically
    const byMuni = {};
    filtered.forEach(h => {
      const m = h.municipio || 'Sin municipio';
      if (!byMuni[m]) byMuni[m] = [];
      byMuni[m].push(h);
    });
    return Object.entries(byMuni).sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [hotelsByIsland, selectedZone, filterText]);

  const islands = ['Mallorca', 'Ibiza', 'Menorca'];
  const islandCounts = useMemo(() => {
    const m = {};
    classifiedHotels.forEach(h => { m[h.zone.isla] = (m[h.zone.isla] || 0) + 1; });
    return m;
  }, [classifiedHotels]);

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, backgroundColor: '#f4f7f9' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#0076ce', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#64748b', fontSize: 14 }}>Cargando hoteles Baleares…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, backgroundColor: '#f4f7f9' }}>
      <p style={{ color: '#dc2626' }}>Error: {error}</p>
      <button onClick={onBackToHub} style={btnStyle('#0076ce')}>← Volver</button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f7f9', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#0076ce', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBackToHub} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Logística Operaciones — Baleares</h1>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>{hotels.length} hoteles · {consultants.length} consultores</p>
        </div>
      </div>

      {/* Island selector */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 20px', display: 'flex', gap: 0 }}>
        {islands.map(isl => (
          <button
            key={isl}
            onClick={() => { setSelectedIsland(isl); setSelectedZone(null); }}
            style={{
              padding: '12px 20px', border: 'none', borderBottom: selectedIsland === isl ? '3px solid #0076ce' : '3px solid transparent',
              background: 'none', cursor: 'pointer', fontWeight: selectedIsland === isl ? 600 : 400,
              color: selectedIsland === isl ? '#0076ce' : '#64748b', fontSize: 14,
            }}
          >
            {isl} <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>({islandCounts[isl] || 0})</span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 20px', display: 'flex', gap: 0 }}>
        {[['zonas', 'Por Zona'], ['lista', 'Lista de Hoteles'], ['ruta', 'Planificador de Ruta']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '10px 16px', border: 'none', borderBottom: tab === key ? '2px solid #0076ce' : '2px solid transparent',
            background: 'none', cursor: 'pointer', fontWeight: tab === key ? 600 : 400,
            color: tab === key ? '#0076ce' : '#64748b', fontSize: 13,
          }}>{label}</button>
        ))}
      </div>

      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        {/* TAB: ZONAS */}
        {tab === 'zonas' && (
          <div>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
              Asigna un consultor a cada zona. Los cambios se guardan localmente en este dispositivo.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {zoneStats.map(zone => {
                const assigned = getAssignedConsultant(zone.id);
                const assignedId = zoneAssignments[`${selectedIsland}__${zone.id}`] || '';
                return (
                  <div key={zone.id} style={{ backgroundColor: '#fff', borderRadius: 10, border: `2px solid ${zone.color}20`, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: zone.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{zone.name}</span>
                      <span style={{ marginLeft: 'auto', backgroundColor: zone.color + '20', color: zone.color, borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                        {zone.hotels.length} hoteles
                      </span>
                    </div>

                    {/* Top municipalities */}
                    <div style={{ marginBottom: 10 }}>
                      {Object.entries(
                        zone.hotels.reduce((acc, h) => {
                          const m = h.municipio || 'Sin municipio';
                          acc[m] = (acc[m] || 0) + 1;
                          return acc;
                        }, {})
                      ).sort(([, a], [, b]) => b - a).slice(0, 4).map(([m, n]) => (
                        <div key={m} style={{ fontSize: 12, color: '#64748b', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span>{m}</span><span style={{ fontWeight: 500 }}>{n}</span>
                        </div>
                      ))}
                    </div>

                    {/* Consultant assignment */}
                    <select
                      value={assignedId}
                      onChange={e => saveAssignment(zone.id, e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, color: assignedId ? '#1e293b' : '#94a3b8', cursor: 'pointer' }}
                    >
                      <option value="">— Sin asignar —</option>
                      {(islandConsultants.length > 0 ? islandConsultants : consultants).map(c => (
                        <option key={c.id} value={c.id}>{c.nombre_completo}</option>
                      ))}
                    </select>

                    {assigned && (
                      <p style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>
                        {assigned.ciudad_base && `Base: ${assigned.ciudad_base}`}
                        {assigned.preferencia_transporte && ` · ${assigned.preferencia_transporte}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: LISTA */}
        {tab === 'lista' && (
          <div>
            <div style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                placeholder="Buscar hotel o municipio…"
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
              />
              <span style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
                {hotelsByIsland.filter(h => !filterText || (h.nombre_hotel + h.municipio).toLowerCase().includes(filterText.toLowerCase())).length} hoteles
              </span>
            </div>

            {zoneStats.map(zone => {
              const zoneHotels = zone.hotels.filter(h =>
                !filterText || (h.nombre_hotel + h.municipio + (h.direccion_completa || '')).toLowerCase().includes(filterText.toLowerCase())
              );
              if (zoneHotels.length === 0) return null;
              const assigned = getAssignedConsultant(zone.id);
              return (
                <div key={zone.id} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: zone.color }} />
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{zone.name}</span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{zoneHotels.length} hoteles</span>
                    {assigned && <span style={{ fontSize: 12, color: '#0076ce', marginLeft: 4 }}>· {assigned.nombre_completo}</span>}
                  </div>
                  <div style={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc' }}>
                          <th style={thStyle}>Hotel</th>
                          <th style={thStyle}>Municipio</th>
                          <th style={thStyle}>Habitaciones</th>
                          <th style={thStyle}>Cadena</th>
                        </tr>
                      </thead>
                      <tbody>
                        {zoneHotels.sort((a, b) => (a.municipio || '').localeCompare(b.municipio || '', 'es')).map((h, i) => (
                          <tr key={h.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                            <td style={tdStyle}>{h.nombre_hotel}</td>
                            <td style={tdStyle}>{h.municipio || '—'}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{h.num_habitaciones || '—'}</td>
                            <td style={{ ...tdStyle, color: '#64748b' }}>{h.cadena_hotelera || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: RUTA */}
        {tab === 'ruta' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Zona</label>
                <select
                  value={selectedZone || ''}
                  onChange={e => setSelectedZone(e.target.value || null)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                >
                  <option value="">Selecciona una zona…</option>
                  {zoneStats.map(z => <option key={z.id} value={z.id}>{z.name} ({z.hotels.length})</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Consultor</label>
                <select
                  value={selectedConsultant || ''}
                  onChange={e => setSelectedConsultant(e.target.value || null)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                >
                  <option value="">Selecciona consultor…</option>
                  {(islandConsultants.length > 0 ? islandConsultants : consultants).map(c => (
                    <option key={c.id} value={c.id}>{c.nombre_completo} {c.ciudad_base ? `(${c.ciudad_base})` : ''}</option>
                  ))}
                </select>
              </div>
              {selectedZone && (
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Buscar en zona</label>
                  <input
                    placeholder="Hotel o municipio…"
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              )}
            </div>

            {!selectedZone && (
              <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                <p style={{ fontSize: 16 }}>Selecciona una zona para ver la ruta de visitas</p>
              </div>
            )}

            {selectedZone && routeHotels.length === 0 && (
              <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>No hay hoteles que coincidan</p>
            )}

            {selectedZone && routeHotels.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
                    {routeHotels.reduce((s, [, h]) => s + h.length, 0)} hoteles en {routeHotels.length} municipios
                  </p>
                  <button
                    onClick={() => {
                      const lines = routeHotels.flatMap(([muni, hotels], mi) =>
                        hotels.map((h, hi) => `${mi + 1}.${hi + 1}\t${muni}\t${h.nombre_hotel}\t${h.direccion_completa || ''}\t${h.num_habitaciones || ''}`)
                      );
                      const csv = 'Parada\tMunicipio\tHotel\tDirección\tHabitaciones\n' + lines.join('\n');
                      const blob = new Blob([csv], { type: 'text/tab-separated-values' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `ruta_${selectedZone}_${selectedIsland}.tsv`; a.click();
                    }}
                    style={btnStyle('#0076ce')}
                  >
                    Exportar ruta
                  </button>
                </div>

                {routeHotels.map(([municipio, muniHotels], muniIdx) => (
                  <div key={municipio} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#0076ce', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                        {muniIdx + 1}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{municipio}</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{muniHotels.length} hotel{muniHotels.length !== 1 ? 'es' : ''}</span>
                    </div>
                    <div style={{ marginLeft: 32 }}>
                      {muniHotels.map((h, hi) => (
                        <div key={h.id} style={{ backgroundColor: '#fff', borderRadius: 6, border: '1px solid #e2e8f0', padding: '8px 12px', marginBottom: 6, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ color: '#94a3b8', fontSize: 12, minWidth: 20 }}>{hi + 1}</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontWeight: 500, fontSize: 13, color: '#1e293b' }}>{h.nombre_hotel}</p>
                            {h.direccion_completa && <p style={{ margin: 0, fontSize: 11, color: '#64748b', marginTop: 2 }}>{h.direccion_completa}</p>}
                            {h.cadena_hotelera && <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{h.cadena_hotelera}</p>}
                          </div>
                          {h.num_habitaciones && (
                            <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{h.num_habitaciones} hab.</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle = (bg) => ({
  padding: '8px 16px', backgroundColor: bg, color: '#fff', border: 'none',
  borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500,
});

const thStyle = {
  padding: '8px 12px', textAlign: 'left', fontSize: 12, color: '#64748b',
  fontWeight: 600, whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '8px 12px', fontSize: 13, color: '#1e293b',
};
