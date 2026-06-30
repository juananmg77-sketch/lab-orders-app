import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { ChevronLeft, ChevronRight, Users, Plus, X, Save } from 'lucide-react';

const DEPT_STYLE = {
  'Consultoría': { color: '#185FA5', bg: '#e6f1fb', border: '#b5d4f4' },
  'Laboratorio': { color: '#534AB7', bg: '#eeedfe', border: '#afa9ec' },
  'Dirección':   { color: '#993C1D', bg: '#faece7', border: '#f5c4b3' },
};

const DELEGACIONES = ['Baleares', 'Canarias (Tenerife)', 'Canarias (Gran Canaria)', 'Madrid', 'Barcelona', 'Andalucía', 'Valencia'];
const DEPARTAMENTOS = ['Consultoría', 'Laboratorio', 'Dirección'];
const VAC_STYLE = {
  'Aprobado':   { bg: '#dcfce7', color: '#166534', border: '#86efac', pattern: false },
  'Solicitado': { bg: '#fff', color: '#0369a1', border: '#7dd3fc', pattern: true },
};

const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}



// Get calendar grid for a given year/month (0-indexed)
function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  // Monday=0 offset
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const days = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(year, month, 1 - startOffset + i);
    days.push({ date: isoDate(d), inMonth: d.getMonth() === month });
  }
  return days;
}

export default function VacationCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [filterDeleg, setFilterDeleg] = useState('Todos');
  const [filterDept, setFilterDept] = useState('Todos');
  const [employees, setEmployees] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employee_id: '', start_date: '', end_date: '', status: 'Solicitado', notes: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [empRes, absRes] = await Promise.all([
          supabase.from('employees').select('id,full_name,department,delegacion,position,status').eq('status', 'Activo'),
          supabase.from('absences').select('*'),
        ]);
        setEmployees(empRes.data || []);
        setAbsences(absRes.data || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function saveVacation() {
    setFormError('');
    if (!form.employee_id) return setFormError('Selecciona un consultor.');
    if (!form.start_date || !form.end_date) return setFormError('Indica las fechas.');
    if (form.end_date < form.start_date) return setFormError('La fecha de fin debe ser posterior al inicio.');
    const start = new Date(form.start_date);
    const end   = new Date(form.end_date);
    const days  = Math.round((end - start) / 86400000) + 1;
    setSaving(true);
    const { error } = await supabase.from('absences').insert({
      employee_id: form.employee_id,
      type: 'Vacaciones',
      start_date: form.start_date,
      end_date: form.end_date,
      days,
      status: form.status,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) { setFormError(error.message); return; }
    setShowForm(false);
    setForm({ employee_id: '', start_date: '', end_date: '', status: 'Solicitado', notes: '' });
    const absRes = await supabase.from('absences').select('*');
    setAbsences(absRes.data || []);
  }

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const filteredEmployees = employees.filter(e => {
    const matchDeleg = filterDeleg === 'Todos' || e.delegacion === filterDeleg;
    const matchDept  = filterDept  === 'Todos' || e.department  === filterDept;
    return matchDeleg && matchDept;
  });
  const empIds = new Set(filteredEmployees.map(e => e.id));

  const calDays = getCalendarDays(year, month);
  const today = isoDate(now);

  // Build a map: date → [{ emp, absence }]
  // Check each calendar day against absence range — avoids expanding multi-year ranges
  const dayMap = {};
  calDays.forEach(({ date }) => {
    absences.forEach(a => {
      if (!empIds.has(a.employee_id)) return;
      if (a.type !== 'Vacaciones') return;
      if (a.status === 'Rechazado') return;
      if (!a.start_date || !a.end_date) return;
      if (date < a.start_date || date > a.end_date) return;
      const emp = filteredEmployees.find(e => e.id === a.employee_id);
      if (!emp) return;
      if (!dayMap[date]) dayMap[date] = [];
      dayMap[date].push({ emp, absence: a });
    });
  });

  const chipStyle = (dept) => {
    const s = DEPT_STYLE[dept] || DEPT_STYLE['Dirección'];
    return { backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: '4px', padding: '1px 5px', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' };
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', color: 'var(--secondary)', fontSize: '1.4rem', fontWeight: 700 }}>Calendario de vacaciones</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Vista mensual del equipo</p>
        </div>
        {/* Navegación mes + botón nueva vacación */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={prevMonth} style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex' }}><ChevronLeft size={18} /></button>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--secondary)', minWidth: '160px', textAlign: 'center' }}>{MONTHS_ES[month]} {year}</span>
          <button onClick={nextMonth} style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', display: 'flex' }}><ChevronRight size={18} /></button>
          <button type="button" onClick={() => { setForm({ employee_id: '', start_date: '', end_date: '', status: 'Solicitado', notes: '' }); setFormError(''); setShowForm(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
            <Plus size={15} /> Nueva vacación
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', padding: '14px 16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border)' }}>
        {/* Departamento */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Depto.</span>
          {['Todos', ...DEPARTAMENTOS].map(d => (
            <button key={d} onClick={() => setFilterDept(d)}
              style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: filterDept === d ? `1.5px solid ${DEPT_STYLE[d]?.color || 'var(--primary)'}` : '1px solid var(--border)', backgroundColor: filterDept === d ? (DEPT_STYLE[d]?.bg || 'var(--primary-light)') : 'white', color: filterDept === d ? (DEPT_STYLE[d]?.color || 'var(--primary)') : 'var(--text-muted)' }}>
              {d}
            </button>
          ))}
        </div>
        {/* Delegación */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Delegación</span>
          {['Todos', ...DELEGACIONES].map(d => (
            <button key={d} onClick={() => setFilterDeleg(d)}
              style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: filterDeleg === d ? '1.5px solid var(--primary)' : '1px solid var(--border)', backgroundColor: filterDeleg === d ? 'var(--primary-light)' : 'white', color: filterDeleg === d ? 'var(--primary)' : 'var(--text-muted)' }}>
              {d}
            </button>
          ))}
        </div>
      </div>


      {/* Leyenda */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
          <span style={{ width: '28px', height: '14px', borderRadius: '3px', backgroundColor: '#dcfce7', border: '1px solid #86efac', display: 'inline-block' }} />
          Aprobadas
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#0369a1', fontWeight: 600 }}>
          <span style={{ width: '28px', height: '14px', borderRadius: '3px', backgroundImage: 'repeating-linear-gradient(45deg, #7dd3fc 0px, #7dd3fc 1px, #fff 1px, #fff 6px)', border: '1px dashed #7dd3fc', display: 'inline-block' }} />
          Solicitadas (pendiente)
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Cargando...</div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Cabecera días */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
            {DAYS_ES.map(d => (
              <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', backgroundColor: '#f8fafc' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Grid días */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {calDays.map(({ date, inMonth }, i) => {
              const entries = dayMap[date] || [];
              const isToday = date === today;
              const isWeekend = i % 7 >= 5;
              return (
                <div key={date}
                  style={{
                    minHeight: '100px',
                    borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                    borderBottom: i < calDays.length - 7 ? '1px solid var(--border)' : 'none',
                    backgroundColor: !inMonth ? '#fafafa' : isWeekend ? '#f8fafc' : 'white',
                    padding: '6px',
                    position: 'relative',
                  }}>
                  {/* Número del día */}
                  <div style={{
                    fontSize: '0.82rem', fontWeight: isToday ? 700 : 500,
                    color: !inMonth ? '#cbd5e1' : isToday ? 'white' : '#374151',
                    width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isToday ? 'var(--primary)' : 'transparent',
                    marginBottom: '4px',
                  }}>
                    {parseInt(date.slice(8))}
                  </div>

                  {/* Empleados */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {entries.slice(0, 3).map(({ emp, absence }, j) => {
                      const s = VAC_STYLE[absence.status] || VAC_STYLE['Aprobado'];
                      return (
                        <div key={j}
                          title={`${emp.full_name} — ${absence.status}${absence.notes ? ': ' + absence.notes : ''}`}
                          style={{
                            ...chipStyle(emp.department),
                            backgroundColor: s.bg,
                            color: s.color,
                            borderColor: s.border,
                            ...(s.pattern ? {
                              backgroundImage: `repeating-linear-gradient(45deg, ${s.border} 0px, ${s.border} 1px, ${s.bg} 1px, ${s.bg} 6px)`,
                              borderStyle: 'dashed',
                            } : {}),
                          }}>
                          {emp.full_name.split(' ')[0]}
                        </div>
                      );
                    })}
                    {entries.length > 3 && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, paddingLeft: '2px' }}>
                        +{entries.length - 3} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resumen del mes */}
      {!loading && (
        <div style={{ marginTop: '16px', padding: '14px 18px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--secondary)' }}>{filteredEmployees.length}</strong> empleados filtrados
            </span>
          </div>
          {(() => {
            const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
            const count = absences.filter(a => {
              if (a.type !== 'Vacaciones') return false;
              if (!empIds.has(a.employee_id)) return false;
              if (a.status === 'Rechazado') return false;
              return a.start_date?.startsWith(monthStr) || a.end_date?.startsWith(monthStr) ||
                (a.start_date < monthStr + '-01' && a.end_date > monthStr + '-31');
            }).length;
            if (!count) return null;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: VAC_STYLE.bg, border: `1px solid ${VAC_STYLE.border}`, display: 'inline-block' }} />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <strong style={{ color: VAC_STYLE.color }}>{count}</strong> periodos de vacaciones este mes
                </span>
              </div>
            );
          })()}
        </div>
      )}
    {/* ── Modal nueva vacación ── */}
    {showForm && (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '460px', maxWidth: '95vw', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--secondary)' }}>Nueva vacación</h3>
            <button type="button" onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Consultor</label>
              <select value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', outline: 'none' }}>
                <option value="">— Selecciona consultor —</option>
                {[...employees].sort((a, b) => a.full_name.localeCompare(b.full_name)).map(e => (
                  <option key={e.id} value={e.id}>{e.full_name} ({e.department || 'Sin depto.'})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Fecha inicio</label>
                <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Fecha fin</label>
                <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Estado</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', outline: 'none' }}>
                <option value="Solicitado">Solicitado</option>
                <option value="Aprobado">Aprobado</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Notas (opcional)</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            {formError && <div style={{ color: '#dc2626', fontSize: '0.85rem', backgroundColor: '#fee2e2', padding: '8px 12px', borderRadius: '8px' }}>{formError}</div>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
              Cancelar
            </button>
            <button type="button" onClick={saveVacation} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              <Save size={15} /> {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
