import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  ChevronRight,
  Info,
  Database,
  ArrowRight,
  RefreshCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';

export default function ExcelImporter({ isOpen, onClose, existingArticles, onImportDone }) {
  const [fileData, setFileData] = useState([]);
  const [step, setStep] = useState(1); // 1: Upload, 2: Map Columns, 3: Preview, 4: Done
  const [mappings, setMappings] = useState({
    id: '', // Optional internal ID
    name: '',
    category: '',
    supplierName: '',
    supplierRef: '',
    price: '',
    stock: '',
    minStock: '',
    description: '',
    format: ''
  });
  const [headers, setHeaders] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState({ new: 0, updated: 0, suppliers: 0 });
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      if (data.length > 0) {
        setHeaders(data[0]);
        setFileData(data.slice(1));
        
        // Auto-mapping logic
        const newMappings = { ...mappings };
        const headerMap = {
          minStock: ['stock mínimo', 'mínimo', 'minimo', 'alerta', 'min stock', 'umbral'], // Check this first
          name: ['nombre', 'articulo', 'artículo', 'producto', 'item', 'name', 'designación'],
          supplierRef: ['supplierref', 'referencia', 'ref', 'código', 'codigo', 'ref proveedor', 'referencia proveedor', 'supplier ref', 'catalogo'],
          supplierName: ['proveedor', 'laboratorio', 'casa comercial', 'supplier', 'fabricante'],
          price: ['precio unitario', 'precio (€)', 'precio', 'coste', 'pve', 'tarifa', 'price', 'unitario'],
          stock: ['stock marzo', 'stock febrero', 'stock enero', 'stock actual', 'stock', 'cantidad', 'existencias', 'en mano', 'inventario'],
          description: ['descripción', 'observaciones', 'notas', 'description'],
          format: ['formato', 'presentación', 'presentacion', 'envase', 'format', 'unidad'],
          category: ['categoría', 'familia', 'grupo', 'category', 'sección']
        };

        data[0].forEach((header, index) => {
          const h = String(header).toLowerCase().trim();
          Object.keys(headerMap).forEach(key => {
            if (headerMap[key].includes(h) || headerMap[key].some(alias => h.includes(alias))) {
              // Guard: Don't map 'stock' (actual) if the header mentions 'mínimo'
              if (key === 'stock' && (h.includes('mínimo') || h.includes('minimo'))) return;
              if (newMappings[key] === '') newMappings[key] = index;
            }
          });
        });
        
        setMappings(newMappings);
        setStep(2);
      }
    };
    reader.readAsBinaryString(file);
  };

  const executeImport = async () => {
    setIsProcessing(true);
    let newCount = 0;
    let upCount = 0;
    let supCount = 0;

    try {
      const validRows = fileData.filter(row => {
        const name = String(row[mappings.name] || '').trim();
        // Skip rows that start with the triangle or are empty
        if (!name || name === 'PRODUCTO' || name.startsWith('▶') || name.startsWith('MEDIOS DE CULTIVO') || name.startsWith('REACTIVOS')) return false;
        // Make sure it has a name
        return name.length > 0;
      });

      if (validRows.length === 0) {
        alert("No se han encontrado filas válidas después de aplicar los filtros. Asegúrese de haber mapeado correctamente la columna del nombre/producto.");
        setIsProcessing(false);
        return;
      }

      // 1. Collect all unique suppliers from the file
      const fileSuppliers = [...new Set(validRows.map(row => String(row[mappings.supplierName] || '').trim()).filter(Boolean))];
      
      // 2. Ensure they exist in the database
      for (const supName of fileSuppliers) {
        const { data: existingSup } = await supabase.from('suppliers').select('id').eq('name', supName).single();
        if (!existingSup) {
          await supabase.from('suppliers').insert({ name: supName });
          supCount++;
        }
      }

      // 3. Process Articles
      for (const row of validRows) {
        const name = String(row[mappings.name] || '').trim();
        const ref = String(row[mappings.supplierRef] || '').trim();
        const sup = String(row[mappings.supplierName] || '').trim();
        
        // Try to find existing article by ref or name
        const existing = existingArticles.find(a => 
          (ref && a.supplierRef && String(a.supplierRef).trim().toLowerCase() === ref.toLowerCase()) ||
          (a.name.toLowerCase().trim() === name.toLowerCase())
        );

        // Price cleaning: "495,00 €" -> "495.00"
        let rawPrice = mappings.price !== '' ? String(row[mappings.price] || '0').replace('€', '').replace(',', '.').trim() : null;
        const priceFormatted = rawPrice !== null ? (parseFloat(rawPrice) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : (existing?.price || '0,00 €');

        const articleData = {
          name: name,
          supplierName: (mappings.supplierName !== '' ? sup : null) || existing?.supplierName || 'Genérico',
          supplierRef: (mappings.supplierRef !== '' ? ref : null) || existing?.supplierRef || null,
          category: (mappings.category !== '' ? row[mappings.category] : null) || existing?.category || 'General',
          price: priceFormatted,
          stock: mappings.stock !== '' ? parseInt(row[mappings.stock] || 0) : (existing?.stock || 0),
          minStock: mappings.minStock !== '' ? parseInt(row[mappings.minStock] || 0) : (existing?.minStock || 5),
          description: (mappings.description !== '' ? row[mappings.description] : null) || existing?.description || '',
          format: (mappings.format !== '' ? row[mappings.format] : null) || existing?.format || ''
        };

        if (existing) {
          const { error } = await supabase.from('articles').update(articleData).eq('id', existing.id);
          if (!error) upCount++;
        } else {
          // Generate a custom ID based on Name + Ref or Random
          const newId = row[mappings.id] || `LAB-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
          const { error } = await supabase.from('articles').insert({ ...articleData, id: newId });
          if (!error) newCount++;
        }
      }

      setImportResults({ new: newCount, updated: upCount, suppliers: supCount });
      await onImportDone();
      setStep(4);
    } catch (err) {
      console.error("Error en importación masiva:", err);
      alert("Error al importar: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderMappingField = (label, key) => (
    <div className="input-group" style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="input-label" style={{ marginBottom: 0 }}>{label}</label>
        <select 
          className="input-field" 
          style={{ width: '60%', margin: 0, padding: '4px 8px', fontSize: '0.85rem' }}
          value={mappings[key]}
          onChange={(e) => setMappings({ ...mappings, [key]: e.target.value })}
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
      <div className="card" style={{ width: '850px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ 
          padding: '24px', 
          background: 'linear-gradient(135deg, var(--secondary) 0%, #1e293b 100%)',
          color: 'white',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FileSpreadsheet size={28} /> Importador Masivo (Excel / CSV)
            </h3>
            <p style={{ margin: '4px 0 0 0', opacity: 0.8, fontSize: '0.85rem' }}>
              Sincronice miles de referencias en segundos
            </p>
          </div>
          <button style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Steps Breadcrumb */}
        <div style={{ padding: '12px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', fontSize: '0.8rem', fontWeight: 600 }}>
          <span style={{ color: step >= 1 ? 'var(--primary)' : 'var(--text-muted)' }}>1. Archivo</span>
          <ArrowRight size={14} color="#cbd5e1" />
          <span style={{ color: step >= 2 ? 'var(--primary)' : 'var(--text-muted)' }}>2. Mapeo</span>
          <ArrowRight size={14} color="#cbd5e1" />
          <span style={{ color: step >= 3 ? 'var(--primary)' : 'var(--text-muted)' }}>3. Vista Previa</span>
          <ArrowRight size={14} color="#cbd5e1" />
          <span style={{ color: step >= 4 ? 'var(--primary)' : 'var(--text-muted)' }}>4. Finalizado</span>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          
          {step === 1 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div 
                style={{ 
                  border: '3px dashed var(--border)', 
                  borderRadius: '24px', 
                  padding: '60px 20px', 
                  backgroundColor: '#f1f5f9',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onClick={() => fileInputRef.current.click()}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              >
                <Upload size={60} color="var(--primary)" style={{ marginBottom: '20px' }} />
                <h3>Selecciona tu archivo Excel</h3>
                <p style={{ color: 'var(--text-muted)' }}>Formatos soportados: .xlsx, .xls, .csv</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleFileUpload}
                />
              </div>
              <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center', gap: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
                  <Database size={24} color="var(--success)" />
                  <span style={{ fontSize: '0.9rem' }}><b>Autoresuelve</b><br/>Proveedores inexistentes</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
                  <RefreshCcw size={24} color="var(--warning)" />
                  <span style={{ fontSize: '0.9rem' }}><b>Actualiza</b><br/>Precios y Stocks</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1fr', gap: '32px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <h4 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '2px solid var(--primary)', display: 'inline-block' }}>Columnas Requeridas</h4>
                {renderMappingField('Nombre del Artículo*', 'name')}
                {renderMappingField('Proveedor*', 'supplierName')}
                {renderMappingField('Referencia Proveedor*', 'supplierRef')}
                {renderMappingField('Precio Unitario', 'price')}
                
                <h4 style={{ marginTop: '24px', marginBottom: '20px', borderBottom: '2px solid var(--primary)', display: 'inline-block' }}>Opcionales</h4>
                {renderMappingField('Formato / Envase', 'format')}
                {renderMappingField('Stock Actual', 'stock')}
                {renderMappingField('Stock Mínimo', 'minStock')}
                {renderMappingField('Categoría', 'category')}
                {renderMappingField('Descripción Técnica', 'description')}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, backgroundColor: 'rgba(59, 130, 246, 0.05)', padding: '24px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                  <h4 style={{ marginTop: 0 }}>Consejos para el XLS</h4>
                  <ul style={{ paddingLeft: '20px', fontSize: '0.9rem', lineHeight: '1.6' }}>
                    <li>Las referencias (SKU) deben ser **únicas**.</li>
                    <li>Si la referencia ya existe, se **actualizarán** los datos del artículo anterior.</li>
                    <li>El sistema creará los laboratorios que no reconozca.</li>
                    <li>Asegúrate de que los precios usen puntos o comas correctamente.</li>
                  </ul>
                  <div style={{ marginTop: '20px', padding: '12px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.8rem' }}>
                    <Info size={16} color="var(--primary)" style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                    Detectadas <b>{fileData.length} filas</b> de datos en el archivo.
                  </div>
                </div>
                <button 
                  className="btn btn-primary" 
                  style={{ marginTop: '24px', height: '54px', fontSize: '1.1rem', fontWeight: 600 }}
                  onClick={() => setStep(3)}
                  disabled={mappings.name === ''}
                >
                  Ver Vista Previa <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex-between" style={{ marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Vista Previa de los primeros 5 artículos</h4>
                <div className="badge badge-info">Total: {fileData.length} registros</div>
              </div>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Artículo</th>
                      <th>Proveedor</th>
                      <th>Ref.</th>
                      <th>Precio</th>
                      <th>Formato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fileData.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{row[mappings.name]}</td>
                        <td>{row[mappings.supplierName]}</td>
                        <td>{row[mappings.supplierRef]}</td>
                        <td style={{ fontWeight: 700 }}>{row[mappings.price]} €</td>
                        <td>{row[mappings.format]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div style={{ marginTop: '32px', padding: '20px', backgroundColor: 'rgba(255, 243, 205, 0.3)', borderRadius: '12px', border: '1px solid var(--warning)' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <AlertTriangle color="var(--warning)" size={32} />
                  <div>
                    <h5 style={{ margin: '0 0 4px 0', color: '#856404' }}>Acción Permanente</h5>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#856404' }}>
                      Al hacer clic en "Procesar Importación", se realizarán cambios en la base de datos de producción. 
                      Se crearán nuevos artículos y se sobreescribirán los precios y formatos de aquellos cuyas referencias coincidan.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setStep(2)}>Volver a Mapear</button>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '0 32px' }}
                  onClick={executeImport}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Procesando...' : '¡Procesar Importación Masiva!'}
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
              <h2>¡Importación Finalizada!</h2>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '24px' }}>
                <div className="card" style={{ padding: '16px 24px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: 'var(--success)' }}>{importResults.new}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>Nuevos Artículos</p>
                </div>
                <div className="card" style={{ padding: '16px 24px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: 'var(--primary)' }}>{importResults.updated}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>Actualizados</p>
                </div>
                <div className="card" style={{ padding: '16px 24px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#9333ea' }}>{importResults.suppliers}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>Proveedores Creados</p>
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: '40px', padding: '12px 60px', height: 'auto' }} onClick={onClose}>Listo, Cerrar</button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
