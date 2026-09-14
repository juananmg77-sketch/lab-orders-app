const { zohoAPI } = require('./utils/zoho-auth');
const https = require('https');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const ZOHO_ACCOUNT_ID = process.env.ZOHO_ACCOUNT_ID;
const ZOHO_USER = process.env.ZOHO_USER;
const CC_DEFAULT = process.env.CC_ALERTAS || 'jamunoz@hsconsulting.es';

function supabaseRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const url = new URL(SUPABASE_URL);
    const req = https.request({
      hostname: url.hostname,
      path: `/rest/v1${path}`,
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: method === 'POST' ? 'return=minimal' : undefined,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve([]); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function buildEmailHtml(consultor, muestras, fecha) {
  const rows = muestras.map(m => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#1e3a5f">${m.establecimiento}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151">${m.numero}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151">${m.muestra}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151">${m.fecha_recogida}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-size:0.9em">${m.observaciones}</td>
    </tr>`).join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f7f9;margin:0;padding:20px">
  <div style="max-width:800px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
    <div style="background:#0076CE;padding:28px 36px">
      <h1 style="color:white;margin:0;font-size:1.4rem">⚠️ Resultado Preliminar con Patógeno Detectado</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0">HSLAB — Comunicación urgente de resultados en curso · ${fecha}</p>
    </div>
    <div style="padding:28px 36px">
      <p style="color:#374151;margin:0 0 20px">Estimado/a <strong>${consultor}</strong>,</p>
      <p style="color:#374151;margin:0 0 20px">
        Le comunicamos que las siguientes muestras de su zona de actuación presentan resultados
        <strong style="color:#dc2626">positivos para patógenos</strong> en análisis preliminar
        y requieren atención inmediata por parte del establecimiento.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;margin-bottom:24px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:12px 14px;text-align:left;color:#1e3a5f;font-weight:700;border-bottom:2px solid #e2e8f0">Establecimiento</th>
            <th style="padding:12px 14px;text-align:left;color:#1e3a5f;font-weight:700;border-bottom:2px solid #e2e8f0">Nº Muestra</th>
            <th style="padding:12px 14px;text-align:left;color:#1e3a5f;font-weight:700;border-bottom:2px solid #e2e8f0">Punto de muestreo</th>
            <th style="padding:12px 14px;text-align:left;color:#1e3a5f;font-weight:700;border-bottom:2px solid #e2e8f0">Fecha recogida</th>
            <th style="padding:12px 14px;text-align:left;color:#1e3a5f;font-weight:700;border-bottom:2px solid #e2e8f0">Resultado preliminar</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin-bottom:20px">
        <p style="margin:0;color:#92400e;font-size:0.9rem">
          <strong>⚡ Acción requerida:</strong> Este es un resultado preliminar. El informe oficial
          se emitirá al cierre del análisis. Por favor, notifique al responsable del establecimiento
          e inicie el protocolo de actuación según el plan de legionella/higiene correspondiente.
        </p>
      </div>
      <p style="color:#6b7280;font-size:0.85rem;margin:0">
        Este mensaje ha sido generado automáticamente por el sistema de gestión HSLAB.<br>
        Para cualquier consulta contacte con el laboratorio: <a href="mailto:lab@hsconsulting.es" style="color:#0076CE">lab@hsconsulting.es</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ ok: false, error: 'Método no permitido' }) };

  let samples;
  try {
    ({ samples } = JSON.parse(event.body || '{}'));
    if (!Array.isArray(samples) || samples.length === 0) throw new Error('samples vacío');
  } catch (e) {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ ok: false, error: 'Body inválido: ' + e.message }) };
  }

  try {
    // 1. Deduplicar contra Supabase
    const numeros = samples.map(s => s.numero).join(',');
    const existing = await supabaseRequest(
      `/lab_alertas_comunicadas?numero_muestra=in.(${numeros})&select=numero_muestra`
    );
    const existingSet = new Set(Array.isArray(existing) ? existing.map(r => r.numero_muestra) : []);
    const newSamples = samples.filter(s => !existingSet.has(s.numero));

    if (newSamples.length === 0) {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: true, enviados: 0, ya_comunicados: existingSet.size, sin_email: [] }),
      };
    }

    // 2. Obtener emails de consultores
    const consultoresUniq = [...new Set(newSamples.map(s => s.consultor).filter(Boolean))];
    const emailRows = await supabaseRequest(
      `/lab_consultor_emails?nombre_csv=in.(${consultoresUniq.map(n => `"${n}"`).join(',')})&select=nombre_csv,email&activo=eq.true`
    );
    const emailMap = {};
    if (Array.isArray(emailRows)) emailRows.forEach(r => { emailMap[r.nombre_csv] = r.email; });

    // 2b. Obtener emails de contacto de los hoteles (para CC)
    const estabsUniq = [...new Set(newSamples.map(s => s.establecimiento).filter(Boolean))];
    const hotelRows = await supabaseRequest(
      `/lab_hotel_contactos?establecimiento_nombre=in.(${estabsUniq.map(e => `"${e}"`).join(',')})&select=establecimiento_nombre,email`
    );
    const hotelEmailMap = {};
    if (Array.isArray(hotelRows)) hotelRows.forEach(r => { hotelEmailMap[r.establecimiento_nombre] = r.email; });

    // 3. Agrupar nuevas muestras por consultor
    const byConsultor = {};
    newSamples.forEach(s => {
      if (!byConsultor[s.consultor]) byConsultor[s.consultor] = [];
      byConsultor[s.consultor].push(s);
    });

    // 4. Enviar emails y registrar
    const enviados = [];
    const sinEmail = [];
    const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

    for (const [consultor, muestras] of Object.entries(byConsultor)) {
      const email = emailMap[consultor];
      if (!email) {
        sinEmail.push({ consultor, count: muestras.length });
        continue;
      }

      const html = buildEmailHtml(consultor, muestras, fechaHoy);
      const count = muestras.length;

      // CC: contacto del hotel (si existe) + CC fijo
      const hotelCCs = [...new Set(muestras.map(m => hotelEmailMap[m.establecimiento]).filter(Boolean))];
      const ccAddress = [CC_DEFAULT, ...hotelCCs].join(',');

      await zohoAPI(`/api/accounts/${ZOHO_ACCOUNT_ID}/messages`, 'POST', {
        fromAddress: ZOHO_USER,
        toAddress: email,
        ccAddress,
        subject: `⚠️ Resultado preliminar con patógeno detectado · ${fechaHoy} (${count} muestra${count !== 1 ? 's' : ''})`,
        content: html,
        mailFormat: 'html',
      });

      enviados.push(...muestras.map(m => m.numero));
    }

    // 5. Registrar en Supabase
    if (enviados.length > 0) {
      const records = newSamples
        .filter(s => enviados.includes(s.numero))
        .map(s => ({
          numero_muestra: s.numero,
          consultor: s.consultor,
          establecimiento: s.establecimiento,
          patogeno: (s.observaciones || '').substring(0, 500),
        }));
      await supabaseRequest('/lab_alertas_comunicadas', 'POST', records);
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: true,
        enviados: enviados.length,
        ya_comunicados: existingSet.size,
        sin_email: sinEmail,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
