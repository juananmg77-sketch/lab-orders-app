import React, { useState, useEffect, useMemo } from 'react';

const API = '/.netlify/functions/hotels-api';

// Mallorca zone definitions — order matters (first match wins)
const MALLORCA_ZONES = [
  {
    id: 'palma', name: 'Palma', color: '#2a78d6',
    match: (m) => {
      const ml = m.toLowerCase();
      if (ml.includes('palma nova') || ml.includes('palmanova')) return false;
      return ['palma', 'playa de palma', 'platja de palma', 'el arenal', 'can pastilla', 'son ferriol', 'arenal', "s'arenal"].some(z => ml.includes(z));
    },
  },
  {
    id: 'calvia', name: 'Calvià / Andratx', color: '#eb6834',
    match: (m) => ['calvià', 'calvia', 'peguera', 'palma nova', 'palmanova', 'santa ponça', 'santa ponsa', 'andratx', 'magaluf', 'portals', 'camp de mar', "s'arracó", 'torrenova', 'cala fornells', 'cala vinyes', 'illetes', 'bendinat'].some(z => m.toLowerCase().includes(z)),
  },
  {
    id: 'nord', name: 'Nord / Alcúdia', color: '#1baf7a',
    match: (m) => ['alcúdia', 'alcudia', "port d'alcúdia", 'pollença', 'pollensa', 'sa pobla', 'muro', 'can picafort', 'campanet', 'búger', 'escorca'].some(z => m.toLowerCase().includes(z)),
  },
  {
    id: 'llevant', name: 'Llevant / Capdepera', color: '#eda100',
    match: (m) => ['artà', 'arta', 'capdepera', 'cala ratjada', 'son servera', 'cala millor', 'cala bona', 'sant llorenç', 'son carrió', 'sa coma'].some(z => m.toLowerCase().includes(z)),
  },
  {
    id: 'manacor', name: 'Manacor / Felanitx', color: '#0891b2',
    match: (m) => ['manacor', 'felanitx', 'porto cristo', 'cales de mallorca', 'portocolom', 'petra', 'vilafranca', 'cala murada', "s'illot", 'cala anguila'].some(z => m.toLowerCase().includes(z)),
  },
  {
    id: 'migjorn', name: 'Migjorn / Sud', color: '#dc2626',
    match: (m) => ['santanyí', 'santanyi', 'ses salines', 'campos', 'llucmajor', 'porreres', 'colònia de sant jordi', "cala d'or", 'cala figuera', 'portopetro', 'cala serena', 'cala gran', 'es trenc'].some(z => m.toLowerCase().includes(z)),
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
  { id: 'ibiza_nord', name: 'Ibiza Nord / Santa Eulària', color: '#2a78d6', match: (m) => ['sant joan', 'santa eulària', 'santa eularia', 'siesta', 'es canar'].some(z => m.toLowerCase().includes(z)) },
  { id: 'ibiza_sur', name: 'Eivissa / Sant Josep', color: '#eb6834', match: (m) => ['eivissa', 'ibiza', 'sant josep', "platja d'en bossa", "playa d'en bossa", 'sant francesc'].some(z => m.toLowerCase().includes(z)) },
  { id: 'ibiza_west', name: 'Sant Antoni / Oeste', color: '#1baf7a', match: (m) => ['sant antoni', 'san antonio', 'cala de bou', 'sant rafel'].some(z => m.toLowerCase().includes(z)) },
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

export default function LogisticsModule({ onBackToHub }) {
  const [tab, setTab] = useState('zonas');
  const [hotels, setHotels] = useState([]);
  const [consultants, setConsultants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIsland, setSelectedIsland] = useState('Mallorca');
  const [zoneAssignments, setZoneAssignments] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hs_zone_assignments') || '{}'); } catch { return {}; }
  });
  const [filterText, setFilterText] = useState('');
  const [expandedZone, setExpandedZone] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchAll('hoteles', { pais: 'España' }),
      fetchAll('consultores'),
    ]).then(([h, c]) => {
      const baleares = h.filter(hotel => {
        const ccaa = (hotel.ccaa || '').toLowerCase();
        const isla = (hotel.isla || '').toLowerCase();
        return ccaa.includes('balear') || ['mallorca', 'ibiza', 'menorca', 'eivissa', 'formentera'].some(i => isla.includes(i));
      });
      setHotels(baleares);
      const balearesCons = c.filter(con => {
        const region = (con.region || con.delegacion || '').toLowerCase();
        const isla = (con.isla || '').toLowerCase();
        return region.includes('balear') || ['mallorca', 'ibiza', 'menorca'].some(i => isla.includes(i));
      });
      setConsultants(balearesCons);
      setLoading(false);
    }).catch(err => { setError(err.message); setLoading(false); });
  }, []);

  const classifiedHotels = useMemo(() => hotels.map(h => ({ ...h, zone: classifyHotel(h) })), [hotels]);

  const hotelsByIsland = useMemo(
    () => classifiedHotels.filter(h => h.zone.isla === selectedIsland),
    [classifiedHotels, selectedIsland]
  );

  const zoneStats = useMemo(() => {
    const map = {};
    hotelsByIsland.forEach(h => {
      const zid = h.zone.id;
      if (!map[zid]) map[zid] = { ...h.zone, hotels: [] };
      map[zid].hotels.push(h);
    });
    return Object.values(map).sort((a, b) => b.hotels.length - a.hotels.length);
  }, [hotelsByIsland]);

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

  const allConsultants = islandConsultants.length > 0 ? islandConsultants : consultants;

  const saveAssignment = (zoneId, consultantId) => {
    const updated = { ...zoneAssignments, [`${selectedIsland}__${zoneId}`]: consultantId };
    setZoneAssignments(updated);
    localStorage.setItem('hs_zone_assignments', JSON.stringify(updated));
  };

  const getAssignedConsultant = (zoneId) => {
    const cid = zoneAssignments[`${selectedIsland}__${zoneId}`];
    return consultants.find(c => c.id === cid);
  };

  const islands = ['Mallorca', 'Ibiza', 'Menorca'];
  const islandCounts = useMemo(() => {
    const m = {};
    classifiedHotels.forEach(h => { m[h.zone.isla] = (m[h.zone.isla] || 0) + 1; });
    return m;
  }, [classifiedHotels]);

  // Filtered hotels for the list tab
  const filteredZoneStats = useMemo(() => {
    if (!filterText) return zoneStats;
    const q = filterText.toLowerCase();
    return zoneStats.map(z => ({
      ...z,
      hotels: z.hotels.filter(h => (h.nombre_hotel + (h.municipio || '') + (h.cadena_hotelera || '')).toLowerCase().includes(q)),
    })).filter(z => z.hotels.length > 0);
  }, [zoneStats, filterText]);

  if (loading) return (
    <div style={centeredStyle}>
      <div style={spinnerStyle} />
      <p style={{ color: '#64748b', fontSize: 14 }}>Cargando hoteles Baleares…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={centeredStyle}>
      <p style={{ color: '#dc2626' }}>Error: {error}</p>
      <button onClick={onBackToHub} style={btn('#0076ce')}>← Volver</button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f7f9', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#0076ce', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBackToHub} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Logística Operaciones — Baleares</h1>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>{hotels.length} hoteles · {consultants.length} consultores</p>
        </div>
      </div>

      {/* Island tabs */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 20px', display: 'flex' }}>
        {islands.map(isl => (
          <button key={isl} onClick={() => { setSelectedIsland(isl); setExpandedZone(null); }} style={{
            padding: '12px 20px', border: 'none',
            borderBottom: selectedIsland === isl ? '3px solid #0076ce' : '3px solid transparent',
            background: 'none', cursor: 'pointer',
            fontWeight: selectedIsland === isl ? 600 : 400,
            color: selectedIsland === isl ? '#0076ce' : '#64748b', fontSize: 14,
          }}>
            {isl} <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>({islandCounts[isl] || 0})</span>
          </button>
        ))}
      </div>

      {/* View tabs */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 20px', display: 'flex' }}>
        {[['zonas', 'Zonas'], ['lista', 'Hoteles por zona']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '10px 16px', border: 'none',
            borderBottom: tab === key ? '2px solid #0076ce' : '2px solid transparent',
            background: 'none', cursor: 'pointer',
            fontWeight: tab === key ? 600 : 400,
            color: tab === key ? '#0076ce' : '#64748b', fontSize: 13,
          }}>{label}</button>
        ))}
      </div>

      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>

        {/* TAB: ZONAS */}
        {tab === 'zonas' && (
          <div>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
              Hoteles agrupados por proximidad geográfica. Asigna un consultor a cada zona para guiar la planificación de visitas.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {zoneStats.map(zone => {
                const assigned = getAssignedConsultant(zone.id);
                const assignedId = zoneAssignments[`${selectedIsland}__${zone.id}`] || '';
                const byMuni = {};
                zone.hotels.forEach(h => {
                  const m = h.municipio || 'Sin municipio';
                  byMuni[m] = (byMuni[m] || 0) + 1;
                });
                const muniList = Object.entries(byMuni).sort(([, a], [, b]) => b - a);
                const isExpanded = expandedZone === zone.id;

                return (
                  <div key={zone.id} style={{
                    backgroundColor: '#fff', borderRadius: 10,
                    border: `2px solid ${zone.color}30`, padding: 16,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}>
                    {/* Zone header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: zone.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', flex: 1 }}>{zone.name}</span>
                      <span style={{ backgroundColor: zone.color + '20', color: zone.color, borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                        {zone.hotels.length}
                      </span>
                    </div>

                    {/* Municipality breakdown */}
                    <div style={{ marginBottom: 10 }}>
                      {(isExpanded ? muniList : muniList.slice(0, 5)).map(([m, n]) => (
                        <div key={m} style={{ fontSize: 12, color: '#64748b', display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{m}</span>
                          <span style={{ fontWeight: 500, color: '#374151', flexShrink: 0 }}>{n}</span>
                        </div>
                      ))}
                      {muniList.length > 5 && (
                        <button
                          onClick={() => setExpandedZone(isExpanded ? null : zone.id)}
                          style={{ background: 'none', border: 'none', color: '#0076ce', fontSize: 11, cursor: 'pointer', padding: '4px 0', width: '100%', textAlign: 'left' }}
                        >
                          {isExpanded ? '▲ Ver menos' : `▼ +${muniList.length - 5} municipios más`}
                        </button>
                      )}
                    </div>

                    {/* Consultant assignment */}
                    <select
                      value={assignedId}
                      onChange={e => saveAssignment(zone.id, e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, color: assignedId ? '#1e293b' : '#94a3b8', cursor: 'pointer', boxSizing: 'border-box' }}
                    >
                      <option value="">— Sin asignar —</option>
                      {allConsultants.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre_completo}</option>
                      ))}
                    </select>

                    {assigned && (
                      <p style={{ marginTop: 5, marginBottom: 0, fontSize: 11, color: '#64748b' }}>
                        {[assigned.ciudad_base, assigned.preferencia_transporte].filter(Boolean).join(' · ')}
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
                placeholder="Buscar hotel, municipio o cadena…"
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
              />
              <span style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
                {filteredZoneStats.reduce((s, z) => s + z.hotels.length, 0)} hoteles
              </span>
            </div>

            {filteredZoneStats.map(zone => {
              const assigned = getAssignedConsultant(zone.id);
              // Group by municipality within zone
              const byMuni = {};
              zone.hotels.forEach(h => {
                const m = h.municipio || 'Sin municipio';
                if (!byMuni[m]) byMuni[m] = [];
                byMuni[m].push(h);
              });
              const muniEntries = Object.entries(byMuni).sort(([a], [b]) => a.localeCompare(b, 'es'));

              return (
                <div key={zone.id} style={{ marginBottom: 24 }}>
                  {/* Zone header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 12px', backgroundColor: zone.color + '15', borderRadius: 8, borderLeft: `4px solid ${zone.color}` }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{zone.name}</span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{zone.hotels.length} hoteles</span>
                    {assigned && (
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: zone.color, fontWeight: 500 }}>
                        {assigned.nombre_completo}
                      </span>
                    )}
                  </div>

                  {/* Municipalities as collapsible groups */}
                  {muniEntries.map(([municipio, muniHotels]) => (
                    <div key={municipio} style={{ marginBottom: 8, marginLeft: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: zone.color, flexShrink: 0, display: 'inline-block' }} />
                        {municipio}
                        <span style={{ color: '#94a3b8', fontWeight: 400 }}>({muniHotels.length})</span>
                      </div>
                      <div style={{ backgroundColor: '#fff', borderRadius: 6, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        {muniHotels.sort((a, b) => (a.nombre_hotel || '').localeCompare(b.nombre_hotel || '', 'es')).map((h, i) => (
                          <div key={h.id} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '7px 12px',
                            borderTop: i > 0 ? '1px solid #f1f5f9' : 'none',
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.nombre_hotel}</p>
                              {h.cadena_hotelera && <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{h.cadena_hotelera}</p>}
                            </div>
                            {h.num_habitaciones && (
                              <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>{h.num_habitaciones} hab.</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const centeredStyle = { display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, backgroundColor: '#f4f7f9' };
const spinnerStyle = { width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#0076ce', borderRadius: '50%', animation: 'spin 0.8s linear infinite' };
const btn = (bg) => ({ padding: '8px 16px', backgroundColor: bg, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 });
