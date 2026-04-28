import React, { useState, useRef } from 'react';
import { 
  FileUp, 
  Search, 
  Check, 
  AlertCircle, 
  Save, 
  X, 
  Info, 
  RefreshCcw,
  PlusCircle,
  FileSearch,
  CheckCircle2,
  Building,
  AlertTriangle,
  InfoIcon
} from 'lucide-react';
import { supabase } from './supabaseClient';

export default function InvoiceImporter({ isOpen, onClose, existingArticles, onImportDone, selectedLab = 'HSLAB Baleares' }) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState([]);
  const [step, setStep] = useState(1); // 1: Upload, 2: Review/Match, 3: Import
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsExtracting(true);
    setStep(2);

    try {
      const reader = new FileReader();
      reader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
        let fullText = "";
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(" ");
          fullText += pageText + "\n";
        }

        processText(fullText);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      alert("Error al leer el PDF: " + err.message);
      setIsExtracting(false);
      setStep(1);
    }
  };

  const processText = (text) => {
    // Keywords that indicate the line is NOT an article (totals, footers, etc)
    const discardKeywords = ['TOTAL', 'SUBTOTAL', 'IVA', 'VENCIMIENTO', 'BANCO', 'IBAN', 'PÁG', 'CLIENTE', 'FECHA', 'ALBARÁN', 'BASE IMPONIBLE', 'DESCUENTO', 'R.E.'];
    
    const lines = text.split('\n');
    const processed = [];
    
    // Pattern to look for potential item lines: typically has a reference-like string and a price
    const potentialLines = text.match(/[A-Z0-9./-]{3,}.*?\d+[,.]\d{2}/gi) || [];

    potentialLines.forEach((line, idx) => {
      // 1. Skip if it contains discard keywords
      const upperLine = line.toUpperCase();
      if (discardKeywords.some(kw => upperLine.includes(kw))) return;

      // 2. Extract price (usually the last numeric value with decimals in the line)
      const priceMatches = [...line.matchAll(/(\d+[,.]\d{2})/g)];
      if (priceMatches.length === 0) return;
      
      const lastPriceStr = priceMatches[priceMatches.length - 1][0];
      
      // 3. Extract potential reference (typically at the beginning or after a small code)
      // Look for a combination of letters and numbers that doesn't look like a common word
      const refMatch = line.match(/[A-Z0-9./-]{5,}/i);
      const ref = refMatch ? refMatch[0] : null;
      
      // 4. Extract description by removing ref and price
      let desc = line;
      if (ref) desc = desc.replace(ref, '');
      desc = desc.replace(lastPriceStr, '').replace(/€/g, '').trim();
      
      // If description is empty or too short, it might not be an article
      if (desc.length < 5 && !ref) return;

      // 5. Match against existing articles
      // Use comma for decimals to stay consistent with seed data format (e.g. "55,42 €")
      const normalizedNewPrice = lastPriceStr.replace('.', ',') + ' €';
      const newPriceVal = parseFloat(lastPriceStr.replace(',', '.'));

      // Find match only within the same lab
      const labExisting = existingArticles.filter(a => (a.lab || 'HSLAB Baleares') === selectedLab);
      const match = labExisting.find(a =>
        (ref && a.supplierRef && a.supplierRef.toLowerCase() === ref.toLowerCase()) ||
        (ref && a.id.toLowerCase() === ref.toLowerCase()) ||
        (desc.length > 10 && a.name.toLowerCase().includes(desc.toLowerCase().substring(0, 15)))
      );

      let action = 'new'; 
      let actionColor = 'var(--info)';
      let statusText = 'Nuevo Artículo';

      if (match) {
        const currentPriceStr = match.price ? match.price.replace('€', '').trim().replace(',', '.') : '0';
        const oldPriceVal = parseFloat(currentPriceStr);
        
        if (Math.abs(newPriceVal - oldPriceVal) > 0.01) {
          action = 'update_price';
          actionColor = 'var(--warning)';
          statusText = 'Cambio de Precio';
        } else {
          action = 'exists';
          actionColor = 'var(--success)';
          statusText = 'Ya existe (Igual)';
        }
      }

      processed.push({
        id: match ? match.id : null,
        ref: ref || 'S/REF',
        name: match ? match.name : desc,
        originalDesc: desc,
        currentPrice: match ? match.price : null,
        newPrice: normalizedNewPrice,
        action,
        statusText,
        actionColor,
        selected: action !== 'exists',
        isDuplicate: match && action === 'exists',
        article: match // Store full article for later upsert
      });
    });

    setExtractedData(processed);
    setIsExtracting(false);
  };

  const handleToggleSelect = (idx) => {
    setExtractedData(prev => prev.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item));
  };

  const handleImport = async () => {
    setIsExtracting(true);
    const selected = extractedData.filter(d => d.selected);
    
    try {
      let updatedCount = 0;
      let newCount = 0;

      for (const item of selected) {
        if (item.action === 'update_price') {
          console.log(`Actualizando precio de ${item.id} a ${item.newPrice}`);
          const { error } = await supabase
            .from('articles')
            .update({ price: item.newPrice })
            .eq('id', item.id);

          if (error) throw new Error(`Error actualizando ${item.name}: ${error.message}`);
          updatedCount++;
        } else if (item.action === 'new') {
          console.log(`Insertando nuevo artículo: ${item.name}`);
          const { error } = await supabase
            .from('articles')
            .insert({
              id: `LAB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
              name: item.name,
              supplierRef: item.ref,
              price: item.newPrice,
              supplierName: selectedSupplierName || 'Importado por Factura',
              category: 'General',
              stock: 0,
              minStock: 5,
              lab: selectedLab
            });

          if (error) throw new Error(`Error insertando ${item.name}: ${error.message}`);
          newCount++;
        }
      }
      
      console.log(`Importación finalizada: ${updatedCount} actualizados, ${newCount} nuevos.`);
      await onImportDone();
      setStep(3);
    } catch (err) {
      console.error("Fallo crítico en importación:", err);
      alert("Error en el proceso de importación: " + err.message);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(8px)'
    }}>
      <div className="card" style={{ width: '900px', height: '80vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--secondary)' }}>
              <FileSearch size={24} color="var(--primary)" /> Importador Inteligente de Facturas
            </h3>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Actualice precios y añada nuevas referencias automáticamente desde sus PDFs.</p>
          </div>
          <button className="btn btn-secondary" style={{ padding: '8px', border: 'none' }} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {step === 1 && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ marginBottom: '32px', width: '100%', maxWidth: '400px' }}>
                <label className="input-label" style={{ textAlign: 'left', display: 'block' }}>1. Seleccione el Proveedor (Opcional)</label>
                <select 
                  className="input-field"
                  value={selectedSupplierName}
                  onChange={(e) => setSelectedSupplierName(e.target.value)}
                >
                  <option value="">Detectar automáticamente o genérico</option>
                  {[...new Set(existingArticles.filter(a => (a.lab || 'HSLAB Baleares') === selectedLab).map(a => a.supplierName))].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div 
                style={{ 
                  width: '100%', 
                  maxWidth: '500px', 
                  padding: '60px 40px', 
                  border: '2px dashed var(--border)', 
                  borderRadius: '16px', 
                  backgroundColor: 'var(--background)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
                onClick={() => fileInputRef.current.click()}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <FileUp size={64} color="var(--primary)" style={{ marginBottom: '20px', opacity: 0.7 }} />
                <h4>2. Subir Factura PDF</h4>
                <p style={{ color: 'var(--text-muted)' }}>Analizaremos solo líneas de artículos, ignorando totales e impuestos.</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept=".pdf" 
                  onChange={handleFileChange}
                />
              </div>
              <div style={{ marginTop: '32px', display: 'flex', gap: '24px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="var(--success)"/> Filtrado inteligente de líneas</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCcw size={16} color="var(--warning)"/> Comparativa de precios</div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              {isExtracting ? (
                <div style={{ textAlign: 'center', padding: '100px' }}>
                  <RefreshCcw size={48} className="spin" style={{ marginBottom: '20px', color: 'var(--primary)' }} />
                  <h4>Escaneando la factura...</h4>
                  <p>Estamos identificando códigos de proveedor y precios de mercado.</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0 }}>Validación de Líneas ({extractedData.length})</h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <RefreshCcw size={12}/> {extractedData.filter(d => d.action === 'update_price').length} cambios
                      </span>
                      <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <PlusCircle size={12}/> {extractedData.filter(d => d.action === 'new').length} nuevos
                      </span>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <table style={{ margin: 0, width: '100%' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--background)', zIndex: 10 }}>
                        <tr>
                          <th style={{ width: '40px' }}></th>
                          <th style={{ width: '150px' }}>Validación</th>
                          <th>Referencia</th>
                          <th>Artículo (BD / Factura)</th>
                          <th style={{ textAlign: 'right' }}>Anterior</th>
                          <th style={{ textAlign: 'right' }}>Nuevo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extractedData.map((item, idx) => (
                          <tr key={idx} style={{ 
                            opacity: item.selected ? 1 : 0.6, 
                            backgroundColor: item.action === 'update_price' ? 'rgba(255, 243, 205, 0.2)' : 
                                            item.action === 'new' ? 'rgba(0, 123, 255, 0.02)' : 'transparent'
                          }}>
                            <td>
                              <input 
                                type="checkbox" 
                                checked={item.selected} 
                                onChange={() => handleToggleSelect(idx)}
                                disabled={item.action === 'exists'}
                              />
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: item.actionColor, fontSize: '0.8rem', fontWeight: 600 }}>
                                {item.action === 'update_price' && <AlertTriangle size={14} />}
                                {item.action === 'new' && <PlusCircle size={14} />}
                                {item.action === 'exists' && <Check size={14} />}
                                {item.statusText}
                              </div>
                            </td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.ref}</td>
                            <td style={{ maxWidth: '300px' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.name}
                              </div>
                              {item.action === 'new' && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  Extraído: {item.originalDesc.substring(0, 40)}...
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{item.currentPrice || '-'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: item.action === 'update_price' ? 'var(--danger)' : 'var(--text)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                {item.newPrice}
                                {item.action === 'update_price' && <RefreshCcw size={14} />}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ 
                width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(40, 167, 69, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px'
              }}>
                <CheckCircle2 size={48} color="var(--success)" />
              </div>
              <h3>¡Importación completada con éxito!</h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '400px' }}>Se han actualizado los precios y añadido los nuevos artículos seleccionados a la base de datos de HSLAB.</p>
              <button className="btn btn-primary" style={{ marginTop: '24px' }} onClick={onClose}>Volver al Catálogo</button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 2 && !isExtracting && (
          <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Cancelar</button>
            <button 
              className="btn btn-primary" 
              onClick={handleImport}
              disabled={extractedData.filter(d => d.selected).length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={18} /> Procesar {extractedData.filter(d => d.selected).length} cambios
            </button>
          </div>
        )}
      </div>
      
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
