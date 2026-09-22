const HS_BASE = 'https://ltuukumhzmbyvtvicuze.supabase.co/functions/v1/api-hoteles';

exports.handler = async (event) => {
  const apiKey = process.env.HOTELS_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'HOTELS_API_KEY not configured' }) };
  }

  const { q, limit = '80' } = event.queryStringParameters || {};

  const url = q && q.trim()
    ? `${HS_BASE}/buscar?q=${encodeURIComponent(q.trim())}&limit=${limit}`
    : `${HS_BASE}/hoteles?activo=true&limit=300`;

  try {
    const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
    const json = await res.json();

    // Normaliza ambos endpoints a [{id, nombre_hotel, cadena_hotelera, municipio, isla}]
    const raw = Array.isArray(json) ? json : (json.data || json.hoteles || []);
    const hoteles = raw.map(h => ({
      id:             h.id    || h.value,
      nombre_hotel:   h.nombre_hotel || (h.label ? h.label.replace(/\s*\(.*\)$/, '') : ''),
      cadena_hotelera: h.cadena_hotelera || null,
      municipio:      h.municipio || null,
      isla:           h.isla || null,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(hoteles),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: e.message }) };
  }
};
