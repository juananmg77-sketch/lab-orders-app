// CJS - pdf-parse marcado como external en netlify.toml (no bundled por esbuild)
// pdf-parse 2.x API: new PDFParse({ data }) → load() → getText() → { text }
const { PDFParse } = require('pdf-parse');

async function extractText(buffer) {
  const parser = new PDFParse({ data: buffer });
  await parser.load();
  const result = await parser.getText();
  return result.text;
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function norm(v) {
  if (!v) return null;
  const s = v.trim();
  const low = s.toLowerCase();
  if (low === 'no detectada' || low === 'no detectado') return '<20';
  return s.replace(',', '.');
}

function detectSheet(punto, descripcion) {
  const t = (punto + ' ' + descripcion).toUpperCase();
  if (/VALPE/.test(t)) return 'Legionella VALPE21';
  if (/DECRETO.*140|140.*2009/.test(t)) return '2.4 Piscina Decreto 140 2009';
  if (/HIDROMASAJE|JACUZZI|YACUZZI|BA[ÑN]ERA/.test(t)) return '2.3 Vaso de hidromasaje';
  // EXTERIOR antes que SPA para que "Piscina SPA Exterior" → 2.1.1
  if (/EXTERIOR|ADULTO|INFANTIL|FAMIL|OLYMPIC|FAMILY|CHAPOTEO|SPLASH|CUBIERTA/.test(t)) return '2.1.1 Piscina Exterior con Legionella';
  if (/SPA|CLIMATIZADA|MAR MUERTO|KNEIPP/.test(t)) return '2.2 Piscina tipo Spa';
  if (/GRIFO|LAVABO|DUCHA|FREGADERO/.test(t)) return '3.13 Control de Grifos';
  if (/PNEUMO/.test(t)) return '3.1.4 Legionella pneumophilla';
  return '3.1 Legionella spp';
}

function extractFields(text, filename) {
  const f = {};

  // Número informe
  const m1 = text.match(/Informe de an[aá]lisis\s+L\s*(\d+)/i);
  f.numero_informe = m1 ? `L ${m1[1]}` : null;

  // Procedencia (código + establecimiento + punto)
  const procBlock = text.match(/Procedencia\/P\.Muestreo\s+([\s\S]+?)(?=Matriz|Datos de laboratorio)/i);
  if (procBlock) {
    const chunk = procBlock[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const codeM = chunk.match(/(EC\d+)/);
    f.codigo = codeM ? codeM[1] : null;
    const puntoM = chunk.match(/\b(P\.\w+)\b/g);
    f.punto = puntoM ? puntoM[puntoM.length - 1] : '';
    f.establecimiento = chunk
      .replace(f.codigo || '', '').replace(f.punto || '', '')
      .replace(/^[-–\s]+/, '').replace(/\s+/g, ' ').trim();
  }

  // Fallback desde filename (EC2604287_H10TIMANFAYAPALACEP_CUBIERTA_...)
  if (!f.codigo && filename) {
    const parts = filename.replace(/\.pdf$/i, '').split('_');
    const ec = parts.find(p => /^EC\d+$/.test(p));
    if (ec) {
      f.codigo = ec;
      const ecIdx = parts.indexOf(ec);
      const dateIdx = parts.findIndex((p, i) => i > ecIdx && /^\d{2}$/.test(p));
      if (dateIdx > ecIdx + 1) {
        f.establecimiento = parts.slice(ecIdx + 1, dateIdx - 1).join(' ');
        f.punto = parts[dateIdx - 1] ? `P.${parts[dateIdx - 1]}` : '';
      }
    }
  }

  // Matriz / descripción
  const matM = text.match(/Matriz procedencia\s+(.+)/i);
  f.descripcion = matM
    ? `${matM[1].trim()}${f.punto ? ' - ' + f.punto : ''}`
    : (f.punto ? `Agua - ${f.punto}` : 'Agua continental tratada');

  // Fechas — Nilsson usa layout 2 columnas; hora de toma queda tras "Datos de laboratorio"
  const fTomaDate = text.match(/Fecha toma muestra\s+(\d{2}\/\d{2}\/\d{4})/i);
  const fTomaTime = text.match(/Datos de laboratorio\s*\n?\s*(\d{2}:\d{2})/i);
  f.fecha_recogida = fTomaDate ? fTomaDate[1] : null;
  f.hora_recogida  = fTomaTime ? fTomaTime[1] : null;

  const fEnt = text.match(/Fecha entrada\s+(\d{2}\/\d{2}\/\d{4})/i);
  f.fecha_entrada = fEnt ? fEnt[1] : f.fecha_recogida;

  const fIni = text.match(/Fecha inicio\s+(\d{2}\/\d{2}\/\d{4})/i);
  f.fecha_inicio = fIni ? fIni[1] : null;

  const fFin = text.match(/Fecha fin\s+(\d{2}\/\d{2}\/\d{4})/i);
  f.fecha_fin = fFin ? fFin[1] : null;

  // Parámetros
  const legM = text.match(/Recuento de Legionella\s+spp[\s\S]{0,250}?(No detectada|\d+(?:[,\.]\d+)?)\s+ufc\/L/i);
  f.legionella_spp = norm(legM ? legM[1] : null);

  const aerM = text.match(/Recuento de microorganismos[\s\S]{0,150}?(No detectado|\d+(?:[,\.]\d+)?)\s+ufc\/ml/i);
  f.aerobios_22 = norm(aerM ? aerM[1] : null);

  const phM = text.match(/pH\s+(\d+[,\.]\d+)\s+Unidades pH/i);
  f.ph = phM ? phM[1].replace(',', '.') : null;

  const clLibM = text.match(/Cloro libre residual\s+(\d+[,\.]\d+)/i);
  f.cloro_libre = clLibM ? clLibM[1].replace(',', '.') : null;

  const clCombM = text.match(/Cloro combinado\s*residual\s+(\d+[,\.]\d+)/i);
  f.cloro_combinado = clCombM ? clCombM[1].replace(',', '.') : null;

  const tempM = text.match(/Temperatura\s+(\d+(?:[,\.]\d+)?)\s+[ºo]C/i);
  f.temperatura = tempM ? tempM[1].replace(',', '.') : null;

  f.resultado = 'APTO';

  const firmM = text.match(/Firmado ele[ct]r[oó]nicamente por:\s*\n?\s*(.+?)(?:CIF|\n)/i);
  const lab = firmM ? firmM[1].trim() : 'Laboratorio externo';
  f.comentarios = `Informe ${f.numero_informe || ''} ${lab}`.trim();

  f.tipo_hoja = detectSheet(f.punto || '', f.descripcion || '');

  return f;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ ok: false, error: 'Método no permitido' }) };
  }

  try {
    const { pdf_base64, filename } = JSON.parse(event.body || '{}');
    if (!pdf_base64) throw new Error('pdf_base64 requerido');

    const buffer = Buffer.from(pdf_base64, 'base64');
    const text = await extractText(buffer);
    const fields = extractFields(text, filename || '');

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true, fields }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
