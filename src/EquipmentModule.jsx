import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Microscope, Activity, Settings, Plus, FileText, Trash2, Eye, ShieldCheck, ChevronLeft, Upload, Target, Thermometer, Scale, Download, Database, Users, RefreshCcw, Waves, Box, FlaskConical, Zap, Cpu, Sun, Wind } from 'lucide-react';
import * as XLSX from 'xlsx';
import logo from './assets/logo.png';
import EquipmentExcelImporter from './EquipmentExcelImporter';
import EquipmentCardModal from './EquipmentCardModal';

const CATEGORY_DETAILS = {
  'Patrones Metrológicos': 'Pesas, masas y otros ítems de referencia física no térmica utilizados exclusivamente para calibraciones internas.',
  'Termómetros - Loggers y Equipos Patrón': 'Instrumentos de referencia térmica (Termómetros de alta precisión, Dataloggers patrones) usados exclusivamente para la trazabilidad y calibración del resto de equipos térmicos.',
  'Sondas de Medición de Temperatura - Humedad': 'Sensores externos, sondas PT100, termopares e higrómetros utilizados para la captación directa de datos ambientales y de proceso.',
  'Materiales de Referencia (MR)': 'Sustancias o materiales con propiedades suficientemente homogéneas y establecidas para calibrar aparatos, evaluar métodos o asignar valores a materiales.',
  'Medios Isotermos (Neveras - Estufas y Baños)': 'Equipos destinados al mantenimiento, estabilización y registro continuo de temperatura para incubación de cultivos y preservación de reactivos/muestras.',
  'Instrumentación Analítica y Fisicoquímica': 'Equipos que arrojan resultados directos de un parámetro (ej. Conductímetros, Ph-metros).',
  'Pipetas y Balanzas': 'Dispositivos de medición dimensional y másica necesarios para la preparación precisa de muestras, diluciones y medios de cultivo.',
  'Equipos Consultores Externos': 'Equipos de campo asignados a consultores externos para trabajos fuera de la sede central.',
  'Equipos Auxiliares y de Preparación': 'Aparamenta estandarizada cuyo correcto funcionamiento afecta al flujo analítico indirectamente.'
};

const categorizeEquipment = (eq) => {
  if (eq.macro_category) return eq.macro_category;
  
  // Si el lab indica que es consultor, forzamos esa categoría primero
  if (eq.lab && eq.lab.includes('- Consultores')) {
    return 'Equipos Consultores Externos';
  }

  const type = (eq.equipment_type || '').toLowerCase();
  const name = (eq.name || '').toLowerCase();
  
  const isPatron = type.includes('patrón') || type.includes('patron') || name.includes('patron');
  const isThermal = type.includes('termómetro') || type.includes('termometro') || type.includes('logger');
  const isProbeOrHum = type.includes('sonda') || name.includes('sonda') || type.includes('humedad') || type.includes('higro') || name.includes('pt100');

  if (isPatron && isThermal) {
    return 'Termómetros - Loggers y Equipos Patrón';
  }
  if (isPatron) {
    return 'Patrones Metrológicos';
  }
  if (isProbeOrHum) {
    return 'Sondas de Medición de Temperatura - Humedad';
  }
  if (isThermal || type.includes('incubador') || type.includes('estufa') || type.includes('nevera') || type.includes('frigorifico') || type.includes('clima') || type.includes('baño')) {
    return 'Medios Isotermos (Neveras - Estufas y Baños)';
  }
  if (type.includes('conductímetro') || type.includes('analítica') || type.includes('espectro') || type.includes('fotómetro') || type.includes('turbidímetro') || type.includes('ph')) {
    return 'Instrumentación Analítica y Fisicoquímica';
  }
  if (type.includes('pipeta') || type.includes('volumetría') || type.includes('balanza') || type.includes('báscula') || type.includes('masa')) {
    return 'Pipetas y Balanzas';
  }
  
  return 'Equipos Auxiliares y de Preparación';
};

const getCategoryIcon = (category) => {
  switch (category) {
    case 'Termómetros - Loggers y Equipos Patrón': return <Thermometer size={24} color="#f59e0b" />;
    case 'Patrones Metrológicos': return <Target size={24} color="var(--primary)" />;
    case 'Sondas de Medición de Temperatura - Humedad': return <Activity size={24} color="var(--primary)" />;
    case 'Materiales de Referencia (MR)': return <FileText size={24} color="var(--primary)" />;
    case 'Medios Isotermos (Neveras - Estufas y Baños)': return <Thermometer size={24} color="var(--primary)" />;
    case 'Instrumentación Analítica y Fisicoquímica': return <Activity size={24} color="var(--primary)" />;
    case 'Pipetas y Balanzas': return <Scale size={24} color="var(--primary)" />;
    case 'Equipos Consultores Externos': return <Users size={24} color="var(--primary)" />;
    default: return <Microscope size={24} color="var(--primary)" />; /* Auxiliares */
  }
};

const getSubtypeIcon = (sub) => {
  const s = String(sub).toLowerCase();
  if (s === 'todos') return <Database size={18} />;
  if (s.includes('agitador') || s.includes('vortex')) return <RefreshCcw size={18} />;
  if (s.includes('autoclave') || s.includes('esteril')) return <ShieldCheck size={18} />;
  if (s.includes('baño')) return <Waves size={18} />;
  if (s.includes('bomba')) return <Activity size={18} />;
  if (s.includes('cabina')) return <Box size={18} />;
  if (s.includes('dispensador') || s.includes('pipeta')) return <FlaskConical size={18} />;
  if (s.includes('homogeneizador')) return <Zap size={18} />;
  if (s.includes('informát') || s.includes('pc') || s.includes('tablet')) return <Cpu size={18} />;
  if (s.includes('lamp') || s.includes('luz')) return <Sun size={18} />;
  if (s.includes('lupa') || s.includes('microscopio')) return <Microscope size={18} />;
  if (s.includes('purificador') || s.includes('aire')) return <Wind size={18} />;
  if (s.includes('termo') || s.includes('estufa')) return <Thermometer size={18} />;
  if (s.includes('balanza') || s.includes('bascula')) return <Scale size={18} />;
  if (s.includes('fotómetro') || s.includes('cloro')) return <Sun size={18} />;
  if (s.includes('higrómetro') || s.includes('humedad')) return <Wind size={18} />;
  if (s.includes('polares') || s.includes('aceite')) return <FlaskConical size={18} />;
  if (s.includes('cocina')) return <Settings size={18} />;
  return <Settings size={18} />;
};

const DELEGACIONES = ['Baleares', 'Cataluña', 'Madrid', 'Valencia', 'Andalucía', 'Canarias'];
const labFromDelegacion = (d) => d === 'Canarias' ? 'HSLAB Canarias' : 'HSLAB Baleares';

export default function EquipmentModule({ session, onLogout, globalLab, onBackToHub, onSelectModule, role = 'operations' }) {
  const [activeTab, setActiveTab] = useState('inventario');
  const [equipments, setEquipments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubtype, setSelectedSubtype] = useState('Todos');
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Bulk Edit States
  const [selectedEquipments, setSelectedEquipments] = useState([]);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkFormData, setBulkFormData] = useState({ equipment_type: '', macro_category: '', status: '' });
  const [consultorFilter, setConsultorFilter] = useState('Todos');

  const handleUpdateDelegacion = async (equipmentId, newDelegacion) => {
    const newLab = `${globalLab} - Consultores`;
    await supabase.from('equipments')
      .update({ delegacion: newDelegacion, lab: newLab })
      .eq('id', equipmentId);
    fetchEquipments();
  };

  const fetchEquipments = async () => {
    const { data, error } = await supabase
      .from('equipments')
      .select('*')
      .in('lab', [globalLab, `${globalLab} - Consultores`])
      .order('equipment_code');

    if (error) {
       console.error("Error fetching equipments:", error.message);
    } else {
       setEquipments(data || []);
    }
  };

  const exportToExcel = () => {
    // Generar un array limpio para el Excel con los campos clave
    const dataToExport = equipments.map(eq => ({
      'EQ': eq.equipment_code,
      'Nombre / Descripción': eq.name,
      'Subtipo': eq.equipment_type,
      'Familia ISO (Calculada/Manual)': categorizeEquipment(eq),
      'Estado Operativo': eq.status,
      'Marca / Modelo': eq.model,
      'Número de Serie': eq.serial_number,
      'Laboratorio': eq.lab,
      'Se usa en ISO 17025': eq.iso_17025 ? 'SÍ' : 'NO',
      'Fecha Adquisición': eq.acquisition_date,
      'Asignado A': eq.assigned_to,
      'Válido Hasta (Calibración)': eq.cal_valid_until,
      'Válido Hasta (Verificación)': eq.ver_valid_until
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario');
    XLSX.writeFile(workbook, `Listado_Equipos_${globalLab}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  useEffect(() => {
    fetchEquipments();
  }, [globalLab]);

  useEffect(() => {
    if (role === 'operations') {
      setSelectedCategory('Equipos Consultores Externos');
    }
  }, [role]);

  const filteredEquipments = equipments.filter(eq => {
    // Solo permitimos equipos del laboratorio base o de sus consultores
    const isBase = eq.lab === globalLab;
    const isConsultant = eq.lab === `${globalLab} - Consultores`;
    if (!isBase && !isConsultant) return false;

    const term = searchQuery.toLowerCase();
    const nameStr = (eq.name || '').toLowerCase();
    const codeStr = (eq.equipment_code || '').toLowerCase();
    const modelStr = (eq.model || '').toLowerCase();
    const assignedStr = (eq.assigned_to || '').toLowerCase();
    return nameStr.includes(term) || codeStr.includes(term) || modelStr.includes(term) || assignedStr.includes(term);
  });

  // Calculate stats by macro-category based on current filters
  const categoryStats = useMemo(() => {
    const stats = {};
    Object.keys(CATEGORY_DETAILS).forEach(cat => {
      if (role === 'operations' && cat !== 'Equipos Consultores Externos') return;
      stats[cat] = { total: 0, altas: 0, bajas: 0 };
    });

    filteredEquipments.forEach(eq => {
      const macroCategory = categorizeEquipment(eq);
      if (role === 'operations' && macroCategory !== 'Equipos Consultores Externos') return;
      
      if (!stats[macroCategory]) stats[macroCategory] = { total: 0, altas: 0, bajas: 0 };
      stats[macroCategory].total += 1;
      if (eq.status === 'BAJA') stats[macroCategory].bajas += 1;
      else stats[macroCategory].altas += 1;
    });
    // Sort descending by total items, but keeping the predefined ones on top isn't strictly necessary if sorting by count.
    // However, the user wants 'Equipos Consultores Externos' always at the end.
    return Object.entries(stats).sort((a, b) => {
      if (a[0] === 'Equipos Consultores Externos') return 1;
      if (b[0] === 'Equipos Consultores Externos') return -1;
      return b[1].total - a[1].total;
    });
  }, [filteredEquipments]);

  // Determine which items to show for the selected family
  const familyEquips = selectedCategory ? filteredEquipments.filter(eq => categorizeEquipment(eq) === selectedCategory) : [];
  
  // Calculate unique subtypes for the pills/tabs
  const subtypes = useMemo(() => {
    if (!selectedCategory) return [];
    const uniqueTypes = new Set(familyEquips.map(eq => eq.equipment_type || 'Resto de familia / Sin asignar').filter(Boolean));
    return ['Todos', ...Array.from(uniqueTypes).sort()];
  }, [familyEquips, selectedCategory]);

  const uniqueConsultors = useMemo(() => {
    if (selectedCategory !== 'Equipos Consultores Externos') return [];
    const names = [...new Set(familyEquips.map(eq => eq.assigned_to).filter(Boolean))].sort();
    return ['Todos', ...names];
  }, [familyEquips, selectedCategory]);

  // Apply subgroup tab filter and sort by status (BAJA at the end)
  const tableEquipments = (selectedSubtype === 'Todos'
    ? familyEquips
    : familyEquips.filter(eq => (eq.equipment_type || 'Resto de familia / Sin asignar') === selectedSubtype)
  ).filter(eq => {
    if (selectedCategory !== 'Equipos Consultores Externos' || consultorFilter === 'Todos') return true;
    return (eq.assigned_to || '') === consultorFilter;
  }).sort((a, b) => {
    if (a.status === 'BAJA' && b.status !== 'BAJA') return 1;
    if (a.status !== 'BAJA' && b.status === 'BAJA') return -1;
    return 0;
  });

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar" style={{ backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
        <div className="sidebar-header" style={{ padding: '0 10px', height: '180px' }}>
          <img src={logo} alt="HSLAB Logo" className="sidebar-logo" />
        </div>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
          <button 
            className="btn btn-secondary" 
            onClick={onBackToHub}
            style={{ 
              width: '100%', 
              backgroundColor: 'var(--primary-light)', 
              color: 'var(--primary)', 
              border: '1px solid var(--primary)',
              display: 'flex',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}
          >
            ← Volver al Hub
          </button>
        </div>
        
        <nav className="nav-links" style={{ marginTop: '12px', flex: 1 }}>
          <div 
            className={`nav-item ${activeTab === 'inventario' ? 'active' : ''}`}
            onClick={() => { setActiveTab('inventario'); setSelectedCategory(null); setSelectedSubtype('Todos'); }}
            style={{ color: activeTab === 'inventario' ? 'white' : 'var(--text-muted)' }}
          >
            <Microscope size={20} />
            <span>Inventario Equipos</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'mantenimiento' ? 'active' : ''}`}
            onClick={() => setActiveTab('mantenimiento')}
            style={{ color: activeTab === 'mantenimiento' ? 'white' : 'var(--text-muted)' }}
          >
            <ShieldCheck size={20} />
            <span>Plan Mantenimiento</span>
          </div>

          {role === 'admin' && (
            <div 
              className="nav-item"
              onClick={() => onSelectModule('usuarios')}
              style={{ color: 'var(--text-muted)', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}
            >
              <Settings size={20} />
              <span>Accesos y Roles</span>
            </div>
          )}
        </nav>

        {/* Sidebar Actions */}
        {role === 'admin' && (
          <div style={{ padding: '24px 16px', borderTop: '1px solid rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Acciones de Base de Datos
            </div>
            <button 
              className="btn btn-secondary" 
              onClick={() => setIsImporterOpen(true)} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                width: '100%', 
                justifyContent: 'flex-start',
                padding: '12px',
                fontSize: '0.9rem',
                backgroundColor: 'white'
              }}
            >
              <Upload size={18} color="var(--primary)" /> 
              <span>Carga Masiva (XLS)</span>
            </button>
            
            <button 
              className="btn btn-secondary" 
              onClick={exportToExcel} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                width: '100%', 
                justifyContent: 'flex-start',
                padding: '12px',
                fontSize: '0.9rem',
                backgroundColor: '#f0fdf4',
                borderColor: '#86efac',
                color: '#166534'
              }}
            >
              <Download size={18} /> 
              <span>Exportar Equipos</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', padding: '32px' }}>
        
        {(activeTab === 'inventario' || activeTab === 'consultores') && (
          <>
            <div className="flex-between" style={{ marginBottom: '24px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {selectedCategory && (
                    <button 
                      onClick={() => { setSelectedCategory(null); setSelectedSubtype('Todos'); setSelectedEquipments([]); setConsultorFilter('Todos'); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--primary)', fontWeight: 'bold' }}
                    >
                      <ChevronLeft size={24} />
                    </button>
                  )}
                  <h2 className="page-title" style={{ margin: 0 }}>
                    {selectedCategory ? selectedCategory : 'Inventario Equipos / Listado'}
                  </h2>
                </div>
                {!selectedCategory && (
                  <div style={{ backgroundColor: 'var(--primary-light)', padding: '4px 12px', borderRadius: '4px', borderLeft: '4px solid var(--primary)', display: 'inline-block', marginTop: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>
                      {globalLab}: {filteredEquipments.length} equipos registrados
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    placeholder={selectedCategory === 'Equipos Consultores Externos' ? 'Filtrar por nombre, modelo, SN o consultor...' : 'Filtrar por nombre, modelo o SN...'}
                    className="input-field" 
                    style={{ width: '320px', margin: 0, paddingLeft: '40px' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Database size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
                
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    const isCanarias = (globalLab || '').includes('Canarias');
                    const prefix = isCanarias ? 'EQC' : 'EQ';
                    const pattern = isCanarias ? 'EQC-%' : 'EQ-%';
                    const regex = isCanarias ? /EQC-(\d+)/ : /EQ-(\d+)/;

                    const { data } = await supabase
                      .from('equipments')
                      .select('equipment_code')
                      .like('equipment_code', pattern);

                    const maxNum = (data || []).reduce((max, e) => {
                      const match = (e.equipment_code || '').match(regex);
                      return match ? Math.max(max, parseInt(match[1])) : max;
                    }, 0);
                    const nextCode = `${prefix}-${String(maxNum + 1).padStart(2, '0')}`;

                    setEditingEquipment({
                      equipment_code: nextCode,
                      status: 'ALTA',
                      lab: globalLab || 'HSLAB Baleares',
                      iso_17025: true,
                      new: true
                    });
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Plus size={20} /> <span>Alta Manual</span>
                </button>
              </div>
            </div>

            {!selectedCategory ? (
              // VISTA DE TARJETAS (FAMILIAS)
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {categoryStats.map(([category, stats]) => (
                  <div 
                    key={category}
                    className="card"
                    style={{ 
                      cursor: 'pointer', 
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      borderTop: '4px solid var(--primary)',
                      opacity: stats.total === 0 ? 0.6 : 1 // slight dim if empty
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 10px 15px rgba(0,0,0,0.1)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow)';
                    }}
                    onClick={() => setSelectedCategory(category)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {getCategoryIcon(category)}
                      </div>
                      <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--secondary)' }}>
                        {stats.total}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--secondary)' }}>
                      {category}
                    </h3>
                    <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4', flex: 1 }}>
                      {CATEGORY_DETAILS[category]}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      <span className="badge badge-success" style={{ flex: 1, textAlign: 'center' }}>
                        {stats.altas} Operativos
                      </span>
                      {stats.bajas > 0 && (
                        <span className="badge badge-danger" style={{ flex: 1, textAlign: 'center' }}>
                          {stats.bajas} Bajas
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {categoryStats.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                    No hay familias de equipos que coincidan con la búsqueda.
                  </div>
                )}
              </div>
            ) : (
              // VISTA DE TABLA (LISTADO DE EQUIPOS DE LA FAMILIA SELECCIONADA)
              <div>

                {/* TARJETAS DE SUBGRUPOS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                  {subtypes.map(sub => {
                    const isSelected = selectedSubtype === sub;
                    const count = sub === 'Todos' 
                      ? familyEquips.length 
                      : familyEquips.filter(e => (e.equipment_type || 'Resto de familia / Sin asignar') === sub).length;
                    
                    return (
                      <div 
                        key={sub}
                        onClick={() => setSelectedSubtype(sub)}
                        style={{ 
                          padding: '12px 16px', 
                          borderRadius: '12px', 
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'var(--primary)' : 'white',
                          color: isSelected ? 'white' : 'var(--secondary)',
                          border: isSelected ? 'none' : '1px solid var(--border)',
                          boxShadow: isSelected ? '0 5px 15px rgba(59, 130, 246, 0.3)' : 'var(--shadow)',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: '12px',
                          minHeight: '74px',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{ 
                          width: '32px', 
                          height: '32px', 
                          borderRadius: '8px', 
                          backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--primary-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isSelected ? 'white' : 'var(--primary)'
                        }}>
                          {getSubtypeIcon(sub)}
                        </div>
                        <div style={{ textAlign: 'left', flex: 1 }}>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', lineHeight: 1 }}>{count}</div>
                          <div style={{ 
                            fontSize: '0.78rem', 
                            fontWeight: 600, 
                            opacity: isSelected ? 1 : 0.8, 
                            lineHeight: '1.2', 
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {sub}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <Activity size={20} color="var(--primary)" />
                   <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Listado de Equipos: {selectedSubtype}</h3>
                </div>

                <div className="card table-wrapper">
                  <table>
                    <thead>
                      <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={tableEquipments.length > 0 && selectedEquipments.length === tableEquipments.length}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedEquipments(tableEquipments.map(eq => eq.id));
                            else setSelectedEquipments([]);
                          }}
                        />
                      </th>
                      <th style={{ width: '130px' }}>Cód. Interno</th>
                      <th>Descripción / Modelo</th>
                      <th style={{ width: '150px' }}>S/N</th>
                      <th style={{ width: '150px' }}>Asignado A</th>
                      {selectedCategory === 'Equipos Consultores Externos' && <th style={{ width: '130px' }}>Delegación</th>}
                      {selectedCategory === 'Equipos Consultores Externos' && <th style={{ width: '140px' }}>Laboratorio</th>}
                      <th style={{ width: '100px' }}>Estado</th>
                      <th style={{ width: '140px' }}>Próx. Calibración</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableEquipments.map(eq => {
                      const isBaja = eq.status === 'BAJA';
                      const calExpired = eq.cal_valid_until && new Date(eq.cal_valid_until) < new Date();
                      return (
                        <tr key={eq.id} style={{ opacity: isBaja ? 0.6 : 1, backgroundColor: selectedEquipments.includes(eq.id) ? 'var(--primary-light)' : calExpired ? '#fff5f5' : 'transparent' }}>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedEquipments.includes(eq.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedEquipments([...selectedEquipments, eq.id]);
                                else setSelectedEquipments(selectedEquipments.filter(id => id !== eq.id));
                              }}
                            />
                          </td>
                          <td style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '0.9rem' }}>{eq.equipment_code}</td>
                          <td>
                            <div style={{ fontWeight: 'bold' }}>{eq.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{eq.model || 'Sin especificar'}</div>
                          </td>
                          <td style={{ fontSize: '0.9rem' }}>{eq.serial_number || '-'}</td>
                          <td style={{ fontSize: '0.9rem' }}>{eq.assigned_to || '-'}</td>
                          {selectedCategory === 'Equipos Consultores Externos' && (
                            <td>
                              <select
                                value={eq.delegacion || (globalLab === 'HSLAB Canarias' ? 'Canarias' : 'Baleares')}
                                onChange={(e) => handleUpdateDelegacion(eq.id, e.target.value)}
                                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                              >
                                {DELEGACIONES.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                            </td>
                          )}
                          {selectedCategory === 'Equipos Consultores Externos' && (
                            <td>
                              <span style={{
                                padding: '3px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                                backgroundColor: (eq.lab || '').includes('Canarias') ? '#f0fdf4' : '#eff6ff',
                                color: (eq.lab || '').includes('Canarias') ? '#166534' : 'var(--primary)'
                              }}>
                                {eq.lab || 'HSLAB Baleares'}
                              </span>
                            </td>
                          )}
                          <td>
                            <span className={`badge ${isBaja ? 'badge-danger' : 'badge-success'}`}>
                              {eq.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, fontSize: '0.9rem', color: calExpired ? '#dc2626' : 'inherit' }}>
                            {eq.cal_valid_until ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                {calExpired && <span style={{ fontSize: '0.7rem', backgroundColor: '#dc2626', color: 'white', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>VENCIDA</span>}
                                {new Date(eq.cal_valid_until).toLocaleDateString()}
                              </span>
                            ) : 'N/A'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px', color: 'var(--primary)', border: '1px solid var(--border)' }}
                                title="Ver Ficha Técnica"
                                onClick={() => setEditingEquipment(eq)}
                              >
                                <Eye size={16} />
                              </button>
                              {role === 'admin' && (
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '6px', color: '#e11d48', border: '1px solid #fda4af' }}
                                  title="Eliminar equipo"
                                  onClick={async () => {
                                    if (!confirm(`¿Eliminar ${eq.equipment_code} — ${eq.name}? Esta acción no se puede deshacer.`)) return;
                                    const { error } = await supabase.from('equipments').delete().eq('id', eq.id);
                                    if (error) alert('Error: ' + error.message);
                                    else fetchEquipments();
                                  }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {tableEquipments.length === 0 && (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No hay equipos en este subgrupo.
                  </div>
                )}
              </div>
            </div>
            )}
          </>
        )}

        {activeTab === 'mantenimiento' && (
          <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-muted)' }}>
            <Activity size={60} style={{ opacity: 0.5, marginBottom: '20px', marginLeft: 'auto', marginRight: 'auto' }} />
            <h2>Plan de Mantenimiento</h2>
            <p>Sección para consolidar vencimientos de calibración, certificados y preventivos de todo el parque.</p>
          </div>
        )}

        <EquipmentExcelImporter 
          isOpen={isImporterOpen} 
          onClose={() => setIsImporterOpen(false)} 
          globalLab={globalLab}
          onImportDone={fetchEquipments}
        />

        <EquipmentCardModal
          isOpen={!!editingEquipment}
          onClose={() => setEditingEquipment(null)}
          equipment={editingEquipment}
          onSave={fetchEquipments}
          existingEquipments={equipments}
        />

        {/* Floating Bulk Action Bar */}
        {role === 'admin' && selectedEquipments.length > 0 && (
          <div style={{ 
            position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', 
            backgroundColor: 'var(--surface)', padding: '16px 32px', borderRadius: '40px', 
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)', display: 'flex', gap: '20px', 
            alignItems: 'center', zIndex: 1000, border: '2px solid var(--primary)' 
          }}>
             <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--secondary)' }}>
                {selectedEquipments.length} equipos seleccionados
             </span>
             <button className="btn btn-primary" onClick={() => setBulkEditMode(true)}>
                Modificar en Lote
             </button>
             <button className="btn btn-secondary" onClick={() => setSelectedEquipments([])}>
                Desmarcar todos
             </button>
          </div>
        )}

        {/* Bulk Edit Modal */}
        {bulkEditMode && (
          <div style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', 
            justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(4px)' 
          }}>
            <div className="card" style={{ width: '500px', padding: '32px' }}>
              <h2 style={{ margin: '0 0 16px 0' }}>Edición Masiva</h2>
              <p style={{ color: 'var(--text-muted)' }}>
                Modificando <b>{selectedEquipments.length}</b> equipos simultáneamente. <br/>
                <i>Los campos que dejes en blanco no se alterarán.</i>
              </p>
              
              <label className="input-label" style={{ marginTop: '24px' }}>Mover de Familia ISO</label>
              <select className="input-field" value={bulkFormData.macro_category} onChange={(e) => setBulkFormData({...bulkFormData, macro_category: e.target.value})}>
                <option value="">-- No modificar --</option>
                {Object.keys(CATEGORY_DETAILS).map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <label className="input-label">Cambiar Subcategoría (Subtipo de equipo)</label>
              <input type="text" className="input-field" placeholder="ej. Dataloggers, Termómetros Max-Min" value={bulkFormData.equipment_type} onChange={(e) => setBulkFormData({...bulkFormData, equipment_type: e.target.value})} />

              <label className="input-label">Cambiar Estado Operativo</label>
              <select className="input-field" value={bulkFormData.status} onChange={(e) => setBulkFormData({...bulkFormData, status: e.target.value})}>
                <option value="">-- No modificar --</option>
                <option value="ALTA">ALTA</option>
                <option value="BAJA">BAJA</option>
              </select>

              <div style={{ display: 'flex', gap: '12px', marginTop: '32px', justifyContent: 'flex-end' }}>
                 <button className="btn btn-secondary" onClick={() => setBulkEditMode(false)}>Cancelar</button>
                 <button className="btn btn-primary" onClick={async () => {
                   const updates = {};
                   if (bulkFormData.macro_category) updates.macro_category = bulkFormData.macro_category;
                   if (bulkFormData.equipment_type) updates.equipment_type = bulkFormData.equipment_type;
                   if (bulkFormData.status) updates.status = bulkFormData.status;
                   
                   if (Object.keys(updates).length > 0) {
                      await supabase.from('equipments').update(updates).in('id', selectedEquipments);
                      await fetchEquipments();
                   }
                   
                   setBulkEditMode(false);
                   setSelectedEquipments([]);
                   setBulkFormData({ equipment_type: '', macro_category: '', status: '' });
                 }}>Aplicar Cambios</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
