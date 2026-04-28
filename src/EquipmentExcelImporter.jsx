import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight,
  Database,
  ArrowRight,
  RefreshCcw,
  Microscope
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';

export default function EquipmentExcelImporter({ isOpen, onClose, globalLab, onImportDone }) {
  const [fileData, setFileData] = useState([]);
  const [step, setStep] = useState(1); 
  const [sheetsData, setSheetsData] = useState({ wb: null, names: [] });
  const [selectedSheet, setSelectedSheet] = useState('');
  const [targetSubLab, setTargetSubLab] = useState('');
  const [mappings, setMappings] = useState({
    name: '',
    equipment_type: '',
    status: '',
    equipment_code: '',
    iso_17025: '',
    model: '',
    serial_number: '',
    acquisition_date: '',
    assigned_to: '',
    calibration_freq: '',
    calibration_type: '',
    tolerance: '',
    intended_use: '',
    measuring_range: '',
    cal_report_ref: '',
    standard_complies: '',
    cal_valid_until: '',
    verification_freq: '',
    ver_report_ref: '',
    ver_valid_until: '',
    manual_ref: ''
  });
  const [headers, setHeaders] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState({ new: 0, updated: 0 });
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
      setSheetsData({ wb, names: wb.SheetNames });
      if (wb.SheetNames.length > 0) setSelectedSheet(wb.SheetNames[0]);
      setStep(1.5);
    };
    reader.readAsBinaryString(file);
  };

  const processSheet = () => {
    if (!sheetsData.wb || !selectedSheet) return;
    const ws = sheetsData.wb.Sheets[selectedSheet];
    const dataRaw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
    
    const data = dataRaw.map((row, rIdx) => {
      return row.map((val, cIdx) => {
        const cell = ws[XLSX.utils.encode_cell({ r: rIdx, c: cIdx })];
        if (cell && cell.l && cell.l.Target) return cell.l.Target; 
        if (cell && cell.f && cell.f.toUpperCase().startsWith('HYPERLINK(')) {
          const match = cell.f.match(/HYPERLINK\("([^"]+)"/i);
          if (match && match[1]) return match[1]; 
        }
        return val;
      });
    });

    if (data.length > 0) {
      setHeaders(data[0]);
      setFileData(data.slice(1));
      
      const newMappings = { ...mappings };
      const headerMap = {
        name: ['equipo', 'nombre', 'articulo', 'máquina'],
        equipment_type: ['tipo', 'categoría', 'familia'],
        status: ['alta o baja', 'estado', 'status'],
        equipment_code: ['código del equipo', 'codigo', 'referencia', 'id'],
        iso_17025: ['iso', '17025', 'iso 17025', 'afecta acreditación'],
        model: ['modelo', 'model'],
        serial_number: ['nº serie', 'serie', 'batch no', 's/n'],
        acquisition_date: ['fecha de adquisición', 'adquisicion', 'compra'],
        assigned_to: ['asignado a', 'responsable', 'ubicación', 'laboratorio', 'técnico asignado'],
        calibration_freq: ['frecuencia calibracion', 'freq. cal'],
        calibration_type: ['calibración interna / externa', 'tipo calibracion'],
        tolerance: ['tolerancia permitida', 'tolerancia', '+/-'],
        intended_use: ['uso previsto', 'aplicación', 'uso'],
        measuring_range: ['rango medición', 'rango'],
        cal_report_ref: ['ref. informe cal', 'informe calibracion'],
        standard_complies: ['patron cumple', 'cumple', '1/4'],
        cal_valid_until: ['válido hasta', 'caducidad cal', 'caducidad informe cal'],
        verification_freq: ['frecuencia de verificación', 'freq verif'],
        ver_report_ref: ['ref informe ver', 'informe verif'],
        ver_valid_until: ['válido hasta ver', 'caducidad ver', 'caducidad informe verif', 'caducidad informe ver'],
        manual_ref: ['manual', 'enlace manual', 'instrucciones', 'link manual', 'documento']
      };

      const seenValidos = [];

      data[0].forEach((header, index) => {
        if (!header) return;
        const h = String(header).toLowerCase().trim();
        
        Object.keys(headerMap).forEach(key => {
          if (headerMap[key].some(alias => h.includes(alias))) {
            if (h.includes('válido hasta') || h.includes('valido hasta')) {
               if (seenValidos.length === 0) {
                  newMappings['cal_valid_until'] = index;
                  seenValidos.push(index);
               } else if (seenValidos.length === 1) {
                  newMappings['ver_valid_until'] = index;
               }
            } else if (newMappings[key] === '') {
               newMappings[key] = index;
            }
          }
        });
      });
      
      setMappings(newMappings);
      setStep(2);
    } else {
      alert("La pestaña seleccionada está vacía o no tiene formato de tabla.");
    }
  };

  const parseDate = (val) => {
    if (!val) return null;
    let str = String(val).trim();
    if (!str || str === 'undefined' || str === 'null') return null;

    // 1. Direct match for YYYY-MM-DD (ISO)
    if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str.substring(0, 10);

    // 2. Try to split and identify parts
    const parts = str.split(/[/-]/).map(p => p.trim());
    if (parts.length === 3) {
      let day, month, year;
      const p0 = parseInt(parts[0]);
      const p1 = parseInt(parts[1]);
      const p2 = parseInt(parts[2]);

      // Heuristic for YY-MM-DD vs DD-MM-YY
      // If delimited by '-' and first part is 2 digits and >= 20, it's very likely YY-MM-DD (ISO-like)
      if (str.includes('-') && parts[0].length === 2 && p0 >= 20 && p0 <= 50) {
        year = '20' + parts[0];
        month = parts[1].padStart(2, '0');
        day = parts[2].padStart(2, '0');
      } else if (parts[0].length === 4 || (p0 > 31)) {
        // YYYY-MM-DD
        year = parts[0].length === 2 ? '20' + parts[0] : parts[0];
        month = parts[1].padStart(2, '0');
        day = parts[2].padStart(2, '0');
      } else {
        // Assume DD-MM-YYYY or DD-MM-YY
        day = parts[0].padStart(2, '0');
        month = parts[1].padStart(2, '0');
        year = parts[2];
        if (year.length === 2) {
          year = '20' + year;
        }
      }
      
      const iso = `${year}-${month}-${day}`;
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return iso;
    }
    
    return null;
  };

  const executeImport = async () => {
    setIsProcessing(true);
    let newCount = 0;
    let upCount = 0;

    try {
      const validRows = fileData.filter(row => {
        const code = String(row[mappings.equipment_code] || '').trim();
        return code.length > 0 && code !== 'undefined';
      });

      if (validRows.length === 0) {
        alert("No se han encontrado filas con Códigos de Equipo válidos. Asegúrate de mapear la columna correctamente.");
        setIsProcessing(false);
        return;
      }

      const seenCodes = {};
      const errorList = [];
      
      for (const row of validRows) {
        let code = String(row[mappings.equipment_code] || '').trim();
        const rawName = String(row[mappings.name] || '').toLowerCase();
        const rawType = String(row[mappings.equipment_type] || '').toLowerCase();
        
        // --- PREVENCIÓN DE COLISIONES DE CÓDIGOS REPETIDOS (Dataloggers vs Sondas PT100) ---
        if (seenCodes[code]) {
           seenCodes[code] += 1;
           // Generamos un sufijo inteligene basado en si es una sonda u otro elemento asociado
           const isSonda = rawName.includes('sonda') || rawName.includes('pt100') || rawType.includes('sonda');
           const suffix = isSonda ? '-SONDA' : `-ASOC${seenCodes[code]}`;
           code = `${code}${suffix}`;
        } else {
           seenCodes[code] = 1;
        }

        const isoString = String(row[mappings.iso_17025] || '').trim().toLowerCase();
        const isIso = isoString === 'si' || isoString === 'sí' || isoString === 'true' || isoString === '1';
        
        const payload = {
          name: String(row[mappings.name] || 'Equipo Sin Nombre').trim(),
          equipment_type: mappings.equipment_type !== '' ? String(row[mappings.equipment_type] || '').trim() : 'Sin Categorizar',
          status: mappings.status !== '' ? String(row[mappings.status] || 'ALTA').trim().toUpperCase() : 'ALTA',
          equipment_code: code,
          iso_17025: isIso,
          model: mappings.model !== '' ? String(row[mappings.model] || '') : null,
          serial_number: mappings.serial_number !== '' ? String(row[mappings.serial_number] || '') : null,
          acquisition_date: mappings.acquisition_date !== '' ? parseDate(row[mappings.acquisition_date]) : null,
          assigned_to: mappings.assigned_to !== '' ? String(row[mappings.assigned_to] || '') : null,
          calibration_freq: mappings.calibration_freq !== '' ? String(row[mappings.calibration_freq] || '') : null,
          calibration_type: mappings.calibration_type !== '' ? String(row[mappings.calibration_type] || '') : null,
          tolerance: mappings.tolerance !== '' ? String(row[mappings.tolerance] || '') : null,
          intended_use: mappings.intended_use !== '' ? String(row[mappings.intended_use] || '') : null,
          measuring_range: mappings.measuring_range !== '' ? String(row[mappings.measuring_range] || '') : null,
          cal_report_ref: mappings.cal_report_ref !== '' ? String(row[mappings.cal_report_ref] || '') : null,
          standard_complies: mappings.standard_complies !== '' ? String(row[mappings.standard_complies] || '') : null,
          cal_valid_until: mappings.cal_valid_until !== '' ? parseDate(row[mappings.cal_valid_until]) : null,
          verification_freq: mappings.verification_freq !== '' ? String(row[mappings.verification_freq] || '') : null,
          ver_report_ref: mappings.ver_report_ref !== '' ? String(row[mappings.ver_report_ref] || '') : null,
          ver_valid_until: mappings.ver_valid_until !== '' ? parseDate(row[mappings.ver_valid_until]) : null,
          manual_ref: mappings.manual_ref !== '' ? String(row[mappings.manual_ref] || '') : null,
          lab: targetSubLab === 'Consultores' ? `${globalLab} - Consultores` : globalLab,
          macro_category: targetSubLab === 'Consultores' ? 'Equipos Consultores Externos' : null
        };

        // Si es de consultores, forzamos que no afecte a ISO 17025 por defecto a menos que se diga lo contrario
        if (targetSubLab === 'Consultores' && mappings.iso_17025 === '') {
           payload.iso_17025 = false;
        }

        // Try to update existing by equipment_code
        const { data: existing } = await supabase.from('equipments').select('id').eq('equipment_code', code).maybeSingle();
        
        if (existing) {
          const { error } = await supabase.from('equipments').update(payload).eq('id', existing.id);
          if (!error) upCount++;
          else {
            console.error("Error updating", code, error);
            errorList.push(`[${code} Update] ${error.message} - ${error.details || ''}`);
          }
        } else {
          const { error } = await supabase.from('equipments').insert(payload);
          if (!error) newCount++;
          else {
            console.error("Error inserting", code, error);
            errorList.push(`[${code} Insert] ${error.message} - Detalle: ${JSON.stringify(error)} - Payload: ${JSON.stringify(payload)}`);
          }
        }
      }

      setImportResults({ new: newCount, updated: upCount, errors: errorList });
      if (onImportDone) await onImportDone();
      setStep(4);
    } catch (err) {
      console.error("Error en importación de equipos:", err);
      alert("Error al importar: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderMappingField = (label, key) => (
    <div className="input-group" style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="input-label" style={{ marginBottom: 0, fontSize: '0.8rem', width: '40%' }}>{label}</label>
        <select 
          className="input-field" 
          style={{ width: '55%', margin: 0, padding: '4px 8px', fontSize: '0.85rem' }}
          value={mappings[key] !== '' ? mappings[key] : ''}
          onChange={(e) => setMappings({ ...mappings, [key]: e.target.value !== '' ? parseInt(e.target.value) : '' })}
        >
          <option value="">-- No importar --</option>
          {headers.map((h, i) => (
            <option key={i} value={i}>{h}</option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(10px)'
    }}>
      <div className="card" style={{ width: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ 
          padding: '24px', 
          background: 'linear-gradient(135deg, var(--secondary) 0%, #0f172a 100%)',
          color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
        }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FileSpreadsheet size={28} /> Importador de Inventario de Equipos
            </h3>
            <p style={{ margin: '4px 0 0 0', opacity: 0.8, fontSize: '0.85rem' }}>
              Carga tu Excel de Metrología e inventario en <b>{globalLab}</b>
            </p>
          </div>
          <button style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Breadcrumb */}
        <div style={{ padding: '12px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', fontSize: '0.8rem', fontWeight: 600 }}>
          <span style={{ color: step >= 1 ? 'var(--primary)' : 'var(--text-muted)' }}>1. Archivo</span>
          <ArrowRight size={14} color="#cbd5e1" />
          <span style={{ color: step >= 1.5 ? 'var(--primary)' : 'var(--text-muted)' }}>2. Pestaña</span>
          <ArrowRight size={14} color="#cbd5e1" />
          <span style={{ color: step >= 2 ? 'var(--primary)' : 'var(--text-muted)' }}>3. Mapeo</span>
          <ArrowRight size={14} color="#cbd5e1" />
          <span style={{ color: step >= 3 ? 'var(--primary)' : 'var(--text-muted)' }}>4. Vista Previa</span>
          <ArrowRight size={14} color="#cbd5e1" />
          <span style={{ color: step >= 4 ? 'var(--primary)' : 'var(--text-muted)' }}>5. Finalizado</span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          {step === 1 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div 
                style={{ 
                  border: '3px dashed var(--border)', borderRadius: '24px', padding: '60px 20px', 
                  backgroundColor: '#f1f5f9', cursor: 'pointer', transition: 'background-color 0.2s'
                }}
                onClick={() => fileInputRef.current.click()}
              >
                <Upload size={60} color="var(--primary)" style={{ marginBottom: '20px' }} />
                <h3>Sube el listado de Equipos</h3>
                <p style={{ color: 'var(--text-muted)' }}>XLSX con columnas: Código Equipo, Tipo, Modelo, Calibración...</p>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
              </div>
            </div>
          )}

          {step === 1.5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', paddingTop: '20px' }}>
              <h3 style={{ margin: 0 }}>Opciones del Excel importado</h3>
              
              <div className="card" style={{ width: '100%', maxWidth: '600px', padding: '24px' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '12px' }}>1. ¿Qué pestaña del Excel quieres extraer?</label>
                <select 
                  className="input-field" 
                  value={selectedSheet} 
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  style={{ width: '100%', marginBottom: '24px' }}
                >
                  {sheetsData.names.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>

                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '12px' }}>2. ¿En qué sección del HUB instalamos estos equipos?</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ flex: 1, padding: '16px', border: targetSubLab === '' ? '2px solid var(--primary)' : '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', backgroundColor: targetSubLab === '' ? 'var(--primary-light)' : 'transparent', textAlign: 'center', fontWeight: 'bold' }}>
                    <input type="radio" name="targetSubLab" value="" checked={targetSubLab === ''} onChange={() => setTargetSubLab('')} style={{ display: 'none' }} />
                    <Microscope size={24} style={{ display: 'block', margin: '0 auto 8px auto' }} />
                    Laboratorio Base
                  </label>
                  <label style={{ flex: 1, padding: '16px', border: targetSubLab === 'Consultores' ? '2px solid var(--primary)' : '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', backgroundColor: targetSubLab === 'Consultores' ? 'var(--primary-light)' : 'transparent', textAlign: 'center', fontWeight: 'bold' }}>
                    <input type="radio" name="targetSubLab" value="Consultores" checked={targetSubLab === 'Consultores'} onChange={() => setTargetSubLab('Consultores')} style={{ display: 'none' }} />
                    <Database size={24} style={{ display: 'block', margin: '0 auto 8px auto' }} />
                    Equipos Consultores
                  </label>
                </div>
              </div>

              <button className="btn btn-primary" onClick={processSheet} style={{ padding: '12px 40px', fontSize: '1.1rem' }}>
                Procesar y Mapear <ChevronRight size={20} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', gap: '24px' }}>
              <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', height: '500px', overflowY: 'auto' }}>
                <h4 style={{ margin: '0 0 16px 0', borderBottom: '2px solid var(--primary)', display: 'inline-block' }}>Propiedades Generales</h4>
                {renderMappingField('Código Interno (EQ-xx)*', 'equipment_code')}
                {renderMappingField('Nombre del Equipo*', 'name')}
                {renderMappingField('Familia / Tipo*', 'equipment_type')}
                {renderMappingField('Modelo', 'model')}
                {renderMappingField('Estado (ALTA/BAJA)', 'status')}
                {renderMappingField('Nº Serie', 'serial_number')}
                {targetSubLab === 'Consultores' && renderMappingField('Asignado a (Consultor)*', 'assigned_to')}
                {targetSubLab === 'Consultores' && renderMappingField('Fecha de Adquisición', 'acquisition_date')}
                {targetSubLab === '' && renderMappingField('Aplica ISO 17025', 'iso_17025')}
                {targetSubLab === '' && renderMappingField('Enlace a Manual', 'manual_ref')}
                
                <h4 style={{ margin: '24px 0 16px 0', borderBottom: '2px solid var(--primary)', display: 'inline-block' }}>Calibración</h4>
                {renderMappingField('Válido Hasta (CAL)', 'cal_valid_until')}
                {renderMappingField('Frecuencia', 'calibration_freq')}
                {renderMappingField('Doc Informe CAL', 'cal_report_ref')}
                {targetSubLab === '' && renderMappingField('Int / Ext', 'calibration_type')}
                
                <h4 style={{ margin: '24px 0 16px 0', borderBottom: '2px solid var(--primary)', display: 'inline-block' }}>Verificación</h4>
                {renderMappingField('Válido Hasta (VER)', 'ver_valid_until')}
                {targetSubLab === '' && renderMappingField('Frecuencia', 'verification_freq')}
                {renderMappingField('Doc Informe VER', 'ver_report_ref')}
              </div>
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', padding: '24px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                  <h4 style={{ marginTop: 0 }}>Autodetectado</h4>
                  <p>Hemos vinculado la mayoría de columnas usando algoritmos semánticos basados en tu documento patrón.</p>
                  <p>Por favor comprueba al menos que el <b>Código Interno</b> apunte a la columna de tus EQ-xxx.</p>
                </div>
                <button className="btn btn-primary" style={{ padding: '16px', fontSize: '1.1rem' }} onClick={() => setStep(3)} disabled={mappings.equipment_code === '' || mappings.name === ''}>
                  Siguiente: Vista Previa <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h4>Primeros 3 Equipos para revisión:</h4>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Cód.</th>
                      <th>Nombre</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                      <th>Próx Calibración</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fileData.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 'bold' }}>{row[mappings.equipment_code]}</td>
                        <td>{row[mappings.name]}</td>
                        <td>{row[mappings.equipment_type]}</td>
                        <td>{row[mappings.status]}</td>
                        <td>{mappings.cal_valid_until !== '' ? row[mappings.cal_valid_until] : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setStep(2)}>Atrás</button>
                <button className="btn btn-primary" onClick={executeImport} disabled={isProcessing}>
                  {isProcessing ? 'Procesando...' : 'Proceder con la Inserción'}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ 
                width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.1)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto'
              }}>
                <CheckCircle2 size={64} color="var(--success)" />
              </div>
              <h2>¡Equipos Importados!</h2>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '24px' }}>
                <div className="card" style={{ padding: '16px 24px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: 'var(--success)' }}>{importResults?.new}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>Nuevos Equipos</p>
                </div>
                <div className="card" style={{ padding: '16px 24px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: 'var(--primary)' }}>{importResults?.updated}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>Actualizados</p>
                </div>
              </div>

              {importResults?.errors && importResults.errors.length > 0 && (
                <div style={{ marginTop: '24px', textAlign: 'left', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', maxHeight: '200px', overflowY: 'auto' }}>
                  <h4 style={{ color: '#dc2626', margin: '0 0 8px 0', fontSize: '1rem' }}>⚠ Errores durante la importación ({importResults.errors.length}):</h4>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#7f1d1d' }}>Copia estos errores para consultarlos con soporte si es necesario.</p>
                  <ul style={{ fontSize: '0.8rem', color: '#991b1b', paddingLeft: '20px', margin: 0, wordBreak: 'break-all' }}>
                    {importResults.errors.slice(0, 50).map((err, i) => (
                      <li key={i} style={{ marginBottom: '8px' }}>{err}</li>
                    ))}
                    {importResults.errors.length > 50 && <li>...y {importResults.errors.length - 50} errores más.</li>}
                  </ul>
                </div>
              )}

              <button className="btn btn-primary" style={{ marginTop: '40px', padding: '12px 60px' }} onClick={onClose}>Continuar trabajando</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
