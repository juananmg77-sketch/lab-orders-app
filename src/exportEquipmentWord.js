import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageOrientation, TabStopType, TabStopPosition,
} from 'docx';

const COLOR_AZUL = '003A70';
const COLOR_CYAN = '0076CE';
const WHITE      = 'FFFFFF';
const COLOR_HEAD = 'DDEEFF';
const COLOR_INT  = 'E8F5E9';
const COLOR_EXT  = 'E3F2FD';
const COLOR_NA   = 'F5F5F5';

const bDef = { style: BorderStyle.SINGLE, size: 1, color: 'C5D8F0' };
const bHdr = { style: BorderStyle.SINGLE, size: 2, color: COLOR_CYAN };
const borders  = { top: bDef, bottom: bDef, left: bDef, right: bDef };
const bordersH = { top: bHdr, bottom: bHdr, left: bHdr, right: bHdr };

// All possible column definitions: key → { label, width (DXA), render? }
const COL_DEFS = {
  equipment_code:   { label: 'Código',              width: 1400, bold: true, color: COLOR_CYAN },
  name:             { label: 'Descripción / Modelo', width: 2900 },
  model:            { label: 'Modelo',               width: 1400 },
  serial_number:    { label: 'S/N',                  width: 1200 },
  equipment_type:   { label: 'Tipo',                 width: 1600 },
  macro_category:   { label: 'Familia',              width: 2000 },
  measuring_range:  { label: 'Rango / Magnitud',     width: 1700 },
  tolerance:        { label: 'Tolerancia',           width: 1400 },
  calibration_type: { label: 'Calibración',          width: 1600, render: 'cal_badge' },
  cal_valid_until:  { label: 'Válido hasta',         width: 1300, render: 'date', align: AlignmentType.CENTER },
  calibration_freq: { label: 'Frecuencia',           width: 1000, align: AlignmentType.CENTER },
  ver_valid_until:  { label: 'Vál. Ver.',            width: 1200, render: 'date', align: AlignmentType.CENTER },
  verification_freq:{ label: 'Frec. Ver.',           width: 1000, align: AlignmentType.CENTER },
  cal_report_ref:   { label: 'Ref. Cert.',           width: 1600 },
  status:           { label: 'Estado',               width: 900,  render: 'status_badge', align: AlignmentType.CENTER },
  iso_17025:        { label: 'ISO 17025',            width: 900,  render: 'bool', align: AlignmentType.CENTER },
  acquisition_date: { label: 'Adquisición',          width: 1200, render: 'date', align: AlignmentType.CENTER },
  assigned_to:      { label: 'Asignado a',           width: 1400 },
  lab:              { label: 'Laboratorio',          width: 1600 },
};

const CATEGORY_ORDER = [
  'Patrones Metrológicos',
  'Materiales de Referencia (MR)',
  'Medios Isotermos (Neveras - Estufas y Baños)',
  'Termómetros - Loggers y Equipos Patrón',
  'Sondas de Medición de Temperatura - Humedad',
  'Pipetas y Balanzas',
  'Equipos Auxiliares y de Preparación',
  'Equipos Consultores Externos',
];

function txt(text, opts = {}) {
  return new TextRun({ text: String(text ?? ''), font: 'Arial', size: 18, ...opts });
}

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = String(d).split('-');
  return `${day}/${m}/${y}`;
}

function inferCalType(eq) {
  const ct = (eq.calibration_type || '').trim();
  if (ct && ct !== 'N/A') {
    if (ct.toLowerCase().includes('extern')) return 'Externa';
    if (ct.toLowerCase().includes('intern')) return 'Interna';
  }
  const ref = (eq.cal_report_ref || '').trim();
  if (!ref || ref === 'N/A') return null;
  if (ref.includes('spreadsheets')) return 'Interna';
  if (ref.startsWith('http')) return 'Externa';
  if (/^\d+$/.test(ref)) return 'Externa';
  return null;
}

function calBadge(tipo) {
  if (tipo === 'Interna') return { fill: COLOR_INT, label: 'INTERNA', color: '1B5E20' };
  if (tipo === 'Externa') return { fill: COLOR_EXT, label: 'EXTERNA', color: '0D3B6E' };
  return { fill: COLOR_NA, label: '—', color: '888888' };
}

function statusBadge(s) {
  if (s === 'BAJA')     return { fill: 'FEE2E2', color: '991B1B' };
  if (s === 'PRE-ALTA') return { fill: 'FEF3C7', color: '92400E' };
  return                       { fill: 'D1FAE5', color: '065F46' };
}

function makeCell(children, shade, width, align, margins) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: shade ? { fill: shade, type: ShadingType.CLEAR } : undefined,
    margins: margins || { top: 60, bottom: 60, left: 100, right: 80 },
    verticalAlign: VerticalAlign.TOP,
    children: [new Paragraph({
      alignment: align || AlignmentType.LEFT,
      children: Array.isArray(children) ? children : [txt(children, { size: 17 })],
    })],
  });
}

function hcell(label, width) {
  return new TableCell({
    borders: bordersH,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: COLOR_HEAD, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 100, right: 80 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [txt(label, { bold: true, size: 16, color: COLOR_AZUL })],
    })],
  });
}

function buildHeaderRow(activeCols, scaledW) {
  return new TableRow({
    tableHeader: true,
    children: [
      hcell('Nº', 700),
      ...activeCols.map(key => hcell(COL_DEFS[key].label, scaledW[key])),
    ],
  });
}

function buildEqRow(eq, idx, activeCols, scaledW) {
  const rowShade = idx % 2 === 0 ? WHITE : 'F8FAFD';
  const cells = [makeCell(String(idx), rowShade, 700, AlignmentType.CENTER)];

  for (const key of activeCols) {
    const def   = COL_DEFS[key];
    const w     = scaledW[key];
    const val   = eq[key];
    const align = def.align || AlignmentType.LEFT;

    if (key === 'name') {
      cells.push(new TableCell({
        borders,
        width: { size: w, type: WidthType.DXA },
        shading: { fill: rowShade, type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 100, right: 80 },
        children: [
          new Paragraph({ children: [txt(eq.name || '', { bold: true, size: 16 })] }),
          eq.model
            ? new Paragraph({ children: [txt(eq.model, { size: 14, color: '666666', italics: true })] })
            : new Paragraph({ children: [] }),
        ],
      }));
      continue;
    }

    if (def.render === 'cal_badge') {
      const badge = calBadge(inferCalType(eq));
      cells.push(new TableCell({
        borders,
        width: { size: w, type: WidthType.DXA },
        shading: { fill: badge.fill, type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(badge.label, { bold: true, size: 15, color: badge.color })] })],
      }));
      continue;
    }

    if (def.render === 'status_badge') {
      const sb = statusBadge(val);
      cells.push(new TableCell({
        borders,
        width: { size: w, type: WidthType.DXA },
        shading: { fill: sb.fill, type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 40, right: 40 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(val || 'ALTA', { bold: true, size: 13, color: sb.color })] })],
      }));
      continue;
    }

    if (def.render === 'date') { cells.push(makeCell(val ? formatDate(val) : '—', rowShade, w, align)); continue; }
    if (def.render === 'bool') { cells.push(makeCell(val ? 'SÍ' : 'NO', val ? COLOR_INT : COLOR_NA, w, align)); continue; }

    const display = (!val || val === 'N/A') ? '—' : String(val);
    cells.push(makeCell(
      def.bold ? [txt(display, { bold: true, color: def.color || '000000', size: 16 })] : display,
      rowShade, w, align,
    ));
  }

  return new TableRow({ children: cells });
}

function sectionHeader(title, count, totalCols) {
  return new TableRow({
    children: [new TableCell({
      columnSpan: totalCols + 1, // +1 for Nº
      borders: {
        top:    { style: BorderStyle.SINGLE, size: 4, color: COLOR_CYAN },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_CYAN },
        left:   { style: BorderStyle.NONE },
        right:  { style: BorderStyle.NONE },
      },
      shading: { fill: COLOR_AZUL, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 160, right: 160 },
      children: [new Paragraph({
        children: [
          txt(title.toUpperCase(), { bold: true, size: 19, color: WHITE }),
          txt(`  (${count} equipo${count !== 1 ? 's' : ''})`, { size: 16, color: 'AACCEE' }),
        ],
      })],
    })],
  });
}

async function loadLogo() {
  const url = new URL('./assets/logo-hsconsulting.png', import.meta.url).href;
  const res = await fetch(url);
  return new Uint8Array(await res.arrayBuffer());
}

export async function exportEquipmentWord(equipmentsToExport, options = {}) {
  const {
    lab = 'HS Lab',
    title = 'LISTADO DE EQUIPOS',
    subtitle = '',
    groupByCategory = true,
    filename = `Equipos_${new Date().toISOString().slice(0, 10)}.docx`,
    fields = Object.keys(COL_DEFS), // all by default
  } = options;

  // activeCols: ordered list of keys to show (excluding 'model' if 'name' is present, since name renders it inline)
  const activeCols = fields.filter(k => COL_DEFS[k] && k !== 'model');

  // Page: A4 landscape 16838 wide, margins 700+700 → usable 15438 DXA
  const AVAILABLE = 15438;
  const NR_WIDTH  = 700; // fixed Nº column
  const rawTotal  = activeCols.reduce((s, k) => s + COL_DEFS[k].width, 0);
  const scale     = rawTotal + NR_WIDTH > AVAILABLE
    ? (AVAILABLE - NR_WIDTH) / rawTotal
    : 1;

  // Scaled widths (integer DXA), keyed by col key
  const scaledW = {};
  activeCols.forEach(k => { scaledW[k] = Math.floor(COL_DEFS[k].width * scale); });
  // Distribute any rounding remainder to first column
  const scaledTotal = NR_WIDTH + Object.values(scaledW).reduce((s, w) => s + w, 0);
  if (scaledTotal < AVAILABLE && activeCols.length > 0) {
    scaledW[activeCols[0]] += AVAILABLE - scaledTotal;
  }

  const totalWidth = AVAILABLE;

  const logoData = await loadLogo();

  // Build rows
  const tableRows = [buildHeaderRow(activeCols, scaledW)];

  if (groupByCategory) {
    const groups = {};
    for (const eq of equipmentsToExport) {
      const cat = eq.macro_category || 'Sin categoría';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(eq);
    }
    const orderedKeys = [
      ...CATEGORY_ORDER.filter(c => groups[c]),
      ...Object.keys(groups).filter(c => !CATEGORY_ORDER.includes(c)),
    ];
    let idx = 1;
    for (const cat of orderedKeys) {
      tableRows.push(sectionHeader(cat, groups[cat].length, activeCols.length));
      for (const eq of groups[cat]) tableRows.push(buildEqRow(eq, idx++, activeCols, scaledW));
    }
  } else {
    equipmentsToExport.forEach((eq, i) => tableRows.push(buildEqRow(eq, i + 1, activeCols, scaledW)));
  }

  const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 16838, height: 11906, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 900, right: 700, bottom: 900, left: 700 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_CYAN, space: 6 } },
            spacing: { after: 40 },
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new ImageRun({ type: 'png', data: logoData, transformation: { width: 120, height: 39 }, altText: { title: 'Logo', description: 'HS', name: 'Logo' } }),
              new TextRun({ text: '\t', font: 'Arial' }),
              txt(`${lab} · Inventario de Equipos · ISO/IEC 17025:2017`, { size: 16, color: '555555' }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_CYAN, space: 4 } },
            spacing: { before: 40 },
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              txt(`HS Consulting Lab · ${today} · ${equipmentsToExport.length} equipo${equipmentsToExport.length !== 1 ? 's' : ''}`, { size: 15, color: '888888' }),
              new TextRun({ text: '\t', font: 'Arial', size: 15 }),
              txt('Página ', { size: 15, color: '888888' }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 15, color: '888888' }),
              txt(' / ', { size: 15, color: '888888' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 15, color: '888888' }),
            ],
          })],
        }),
      },
      children: [
        new Paragraph({
          spacing: { before: 160, after: 60 },
          children: [txt(title, { bold: true, size: 30, color: COLOR_AZUL })],
        }),
        ...(subtitle ? [new Paragraph({
          spacing: { before: 0, after: 60 },
          children: [txt(subtitle, { size: 18, color: '444444', italics: true })],
        })] : []),
        ...(activeCols.includes('calibration_type') ? [new Paragraph({
          spacing: { before: 40, after: 180 },
          children: [
            txt('Leyenda:  ', { bold: true, size: 15 }),
            txt('■ ', { bold: true, size: 15, color: '1B5E20' }),
            txt('INTERNA = informe generado por HS Lab (Google Sheets)   ', { size: 14, color: '555555' }),
            txt('■ ', { bold: true, size: 15, color: '0D3B6E' }),
            txt('EXTERNA = certificado de laboratorio acreditado externo   ', { size: 14, color: '555555' }),
            txt('■ ', { bold: true, size: 15, color: '888888' }),
            txt('— = sin calibración requerida', { size: 14, color: '555555' }),
          ],
        })] : []),
        new Table({
          width: { size: totalWidth, type: WidthType.DXA },
          columnWidths: [NR_WIDTH, ...activeCols.map(k => scaledW[k])],
          rows: tableRows,
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
