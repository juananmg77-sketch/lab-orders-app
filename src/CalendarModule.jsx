import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, X, Calendar, List, Wrench, FlaskConical, ClipboardCheck, BookOpen, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from './supabaseClient';

const EVENT_TYPES = {
  calibracion:     { label: 'Calibración',       color: '#2563EB', bg: '#EFF6FF', icon: '🔵' },
  verificacion:    { label: 'Verificación',       color: '#16A34A', bg: '#F0FDF4', icon: '🟢' },
  interlab:        { label: 'Interlab',           color: '#EA580C', bg: '#FFF7ED', icon: '🟠' },
  control_calidad: { label: 'Control de calidad', color: '#7C3AED', bg: '#F5F3FF', icon: '🟣' },
  auditoria:       { label: 'Auditoría',          color: '#DC2626', bg: '#FEF2F2', icon: '🔴' },
  mantenimiento:   { label: 'Mantenimiento',      color: '#0891B2', bg: '#ECFEFF', icon: '🔵' },
  formacion:       { label: 'Formación',          color: '#CA8A04', bg: '#FEFCE8', icon: '🟡' },
  otro:            { label: 'Otro',               color: '#6B7280', bg: '#F9FAFB', icon: '⚫' },
};

const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date(today());
  return Math.ceil(diff / 86400000);
}

function statusBadge(dateStr, status) {
  if (status === 'completado') return { label: 'Completado', color: '#16A34A', bg: '#F0FDF4' };
  if (status === 'cancelado')  return { label: 'Cancelado',  color: '#6B7280', bg: '#F9FAFB' };
  const d = daysUntil(dateStr);
  if (d < 0)  return { label: 'Vencido',    color: '#DC2626', bg: '#FEF2F2' };
  if (d <= 30) return { label: `${d}d`,     color: '#EA580C', bg: '#FFF7ED' };
  return { label: 'Pendiente', color: '#2563EB', bg: '#EFF6FF' };
}

export default function CalendarModule({ session, globalLab, onBackToHub, onSelectModule }) {
  const [view, setView]             = useState('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedDay, setSelectedDay]   = useState(null);
  const [saving, setSaving]         = useState(false);

  const emptyForm = { title: '', date: today(), end_date: '', type: 'otro', description: '', assigned_to: '', lab: globalLab, status: 'pendiente' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadEvents(); }, [globalLab]);

  async function loadEvents() {
    setLoading(true);
    const [{ data: manual }, { data: equips }] = await Promise.all([
      supabase.from('lab_calendar_events').select('*').order('date'),
      supabase.from('equipments').select('id, name, equipment_code, cal_valid_until, ver_valid_until, lab').not('cal_valid_until', 'is', null).order('cal_valid_until'),
    ]);

    const equipEvents = [];
    (equips || []).forEach(eq => {
      if (eq.cal_valid_until) equipEvents.push({
        id: `cal-${eq.id}`, title: `Calibración: ${eq.name}${eq.equipment_code ? ` (${eq.equipment_code})` : ''}`,
        date: eq.cal_valid_until, type: 'calibracion', status: 'pendiente',
        lab: eq.lab, _equipment_id: eq.id, _readonly: true,
      });
      if (eq.ver_valid_until) equipEvents.push({
        id: `ver-${eq.id}`, title: `Verificación: ${eq.name}${eq.equipment_code ? ` (${eq.equipment_code})` : ''}`,
        date: eq.ver_valid_until, type: 'verificacion', status: 'pendiente',
        lab: eq.lab, _equipment_id: eq.id, _readonly: true,
      });
    });

    setEvents([...equipEvents, ...(manual || [])]);
    setLoading(false);
  }

  const allEvents = events;

  function eventsForDay(dateStr) {
    return allEvents.filter(e => e.date === dateStr);
  }

  function upcomingEvents() {
    const t = today();
    return allEvents
      .filter(e => e.date >= t && e.status !== 'cancelado')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 50);
  }

  function overdueEvents() {
    const t = today();
    return allEvents.filter(e => e.date < t && e.status === 'pendiente');
  }

  function openNewForm(date) {
    setForm({ ...emptyForm, date: date || today(), lab: globalLab });
    setEditingEvent(null);
    setShowForm(true);
  }

  function openEdit(ev) {
    if (ev._readonly) return;
    setForm({
      title: ev.title, date: ev.date, end_date: ev.end_date || '',
      type: ev.type, description: ev.description || '',
      assigned_to: ev.assigned_to || '', lab: ev.lab || globalLab, status: ev.status,
    });
    setEditingEvent(ev);
    setShowForm(true);
  }

  async function saveEvent() {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(), date: form.date,
      end_date: form.end_date || null, type: form.type,
      description: form.description || null, assigned_to: form.assigned_to || null,
      lab: form.lab || null, status: form.status,
      created_by: session?.user?.email || null,
    };
    if (editingEvent) {
      await supabase.from('lab_calendar_events').update(payload).eq('id', editingEvent.id);
    } else {
      await supabase.from('lab_calendar_events').insert([payload]);
    }
    setSaving(false);
    setShowForm(false);
    loadEvents();
  }

  async function deleteEvent(ev) {
    if (!window.confirm(`¿Eliminar "${ev.title}"?`)) return;
    await supabase.from('lab_calendar_events').delete().eq('id', ev.id);
    setSelectedDay(null);
    loadEvents();
  }

  async function toggleDone(ev) {
    if (ev._readonly) return;
    const newStatus = ev.status === 'completado' ? 'pendiente' : 'completado';
    await supabase.from('lab_calendar_events').update({ status: newStatus }).eq('id', ev.id);
    loadEvents();
  }

  // ── Calendar grid ──────────────────────────────────────────────
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1); // Mon=0
  const totalCells  = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); }
  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); }

  const todayStr = today();

  const overdue = overdueEvents();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <header style={{ height: '64px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={onBackToHub}>
            <ArrowLeft size={16} /> Volver
          </button>
          <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={22} color="var(--primary)" /> Calendario de Laboratorio
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {overdue.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '4px 10px', fontSize: '0.82rem', fontWeight: 600 }}>
              <AlertTriangle size={13} /> {overdue.length} vencido{overdue.length > 1 ? 's' : ''}
            </span>
          )}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <button onClick={() => setView('calendar')} style={{ padding: '6px 14px', border: 'none', background: view === 'calendar' ? 'var(--primary)' : 'white', color: view === 'calendar' ? 'white' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
              <Calendar size={14} /> Mes
            </button>
            <button onClick={() => setView('agenda')} style={{ padding: '6px 14px', border: 'none', background: view === 'agenda' ? 'var(--primary)' : 'white', color: view === 'agenda' ? 'white' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
              <List size={14} /> Agenda
            </button>
          </div>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px' }} onClick={() => openNewForm(null)}>
            <Plus size={16} /> Nueva tarea
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── CALENDAR VIEW ── */}
        {view === 'calendar' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px', overflow: 'hidden' }}>
            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <button className="btn btn-secondary" style={{ padding: '5px 10px' }} onClick={prevMonth}><ChevronLeft size={18} /></button>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--secondary)', minWidth: '200px', textAlign: 'center' }}>
                {MONTHS_ES[month]} {year}
              </h2>
              <button className="btn btn-secondary" style={{ padding: '5px 10px' }} onClick={nextMonth}><ChevronRight size={18} /></button>
              <button className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '5px 12px' }} onClick={() => { setCurrentDate(new Date()); setSelectedDay(null); }}>Hoy</button>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', marginBottom: '4px' }}>
              {DAYS_ES.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridTemplateRows: `repeat(${totalCells / 7},1fr)`, gap: '2px', overflow: 'hidden' }}>
              {Array.from({ length: totalCells }).map((_, i) => {
                const dayNum = i - startOffset + 1;
                if (dayNum < 1 || dayNum > daysInMonth) return <div key={i} style={{ backgroundColor: 'transparent' }} />;
                const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
                const dayEvents = eventsForDay(dateStr);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDay;
                const hasOverdue = dayEvents.some(e => e.date < todayStr && e.status === 'pendiente');

                return (
                  <div
                    key={i}
                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                    style={{
                      backgroundColor: isSelected ? 'var(--primary-light)' : 'white',
                      border: isToday ? '2px solid var(--primary)' : isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '5px 6px',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      minHeight: '70px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{
                        fontSize: '0.85rem', fontWeight: isToday ? 700 : 500,
                        color: isToday ? 'white' : 'var(--secondary)',
                        background: isToday ? 'var(--primary)' : 'transparent',
                        borderRadius: '50%', width: '22px', height: '22px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{dayNum}</span>
                      {dayEvents.length > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); openNewForm(dateStr); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0', opacity: 0.5 }}
                        ><Plus size={12} /></button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {dayEvents.slice(0, 3).map(ev => (
                        <div
                          key={ev.id}
                          onClick={e => { e.stopPropagation(); setSelectedDay(dateStr); }}
                          style={{
                            fontSize: '0.7rem', fontWeight: 500,
                            color: EVENT_TYPES[ev.type]?.color || '#6B7280',
                            background: EVENT_TYPES[ev.type]?.bg || '#F9FAFB',
                            borderLeft: `2.5px solid ${EVENT_TYPES[ev.type]?.color || '#6B7280'}`,
                            borderRadius: '2px',
                            padding: '1px 4px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            textDecoration: ev.status === 'completado' ? 'line-through' : 'none',
                            opacity: ev.status === 'cancelado' ? 0.5 : 1,
                          }}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', paddingLeft: '4px' }}>+{dayEvents.length - 3} más</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── AGENDA VIEW ── */}
        {view === 'agenda' && (
          <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
            {overdue.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '0.9rem', fontWeight: 700, color: '#DC2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} /> Vencidos ({overdue.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {overdue.map(ev => <AgendaRow key={ev.id} ev={ev} onEdit={openEdit} onDelete={deleteEvent} onToggle={toggleDone} onGoEquip={onSelectModule} />)}
                </div>
              </div>
            )}
            <h3 style={{ margin: '0 0 10px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--secondary)' }}>Próximos eventos</h3>
            {upcomingEvents().length === 0 && <p style={{ color: 'var(--text-muted)' }}>Sin eventos pendientes.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {upcomingEvents().map(ev => <AgendaRow key={ev.id} ev={ev} onEdit={openEdit} onDelete={deleteEvent} onToggle={toggleDone} onGoEquip={onSelectModule} />)}
            </div>
          </div>
        )}

        {/* ── RIGHT PANEL: day detail or upcoming ── */}
        <div style={{ width: '300px', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', backgroundColor: 'white', flexShrink: 0 }}>
          {selectedDay && view === 'calendar' ? (
            <DayPanel
              dateStr={selectedDay}
              events={eventsForDay(selectedDay)}
              onClose={() => setSelectedDay(null)}
              onAdd={() => openNewForm(selectedDay)}
              onEdit={openEdit}
              onDelete={deleteEvent}
              onToggle={toggleDone}
              onGoEquip={onSelectModule}
            />
          ) : (
            <UpcomingPanel events={upcomingEvents().slice(0, 10)} overdue={overdue} onSelectDay={d => { setSelectedDay(d); setView('calendar'); setCurrentDate(new Date(d)); }} />
          )}
        </div>
      </div>

      {/* ── EVENT FORM MODAL ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '520px', margin: 0, padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={20} color="var(--primary)" />
                {editingEvent ? 'Editar tarea' : 'Nueva tarea'}
              </h3>
              <button className="btn btn-secondary" style={{ padding: '4px', border: 'none' }} onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '5px' }}>Título <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Control de calidad agua mayo" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '5px' }}>Fecha <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input className="input-field" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '5px' }}>Fecha fin (opcional)</label>
                  <input className="input-field" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '5px' }}>Tipo</label>
                  <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {Object.entries(EVENT_TYPES).filter(([k]) => !['calibracion','verificacion'].includes(k)).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '5px' }}>Estado</label>
                  <select className="input-field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="pendiente">Pendiente</option>
                    <option value="completado">Completado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '5px' }}>Responsable</label>
                <input className="input-field" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="Nombre del responsable" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '5px' }}>Descripción / notas</label>
                <textarea className="input-field" style={{ height: '80px', resize: 'none' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalles adicionales..." />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveEvent} disabled={!form.title.trim() || !form.date || saving}>
                {saving ? 'Guardando...' : editingEvent ? 'Guardar cambios' : 'Crear tarea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AgendaRow({ ev, onEdit, onDelete, onToggle, onGoEquip }) {
  const type  = EVENT_TYPES[ev.type] || EVENT_TYPES.otro;
  const badge = statusBadge(ev.date, ev.status);
  const d     = daysUntil(ev.date);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
      backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border)',
      borderLeft: `4px solid ${type.color}`,
      opacity: ev.status === 'cancelado' ? 0.55 : 1,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{ fontSize: '0.78rem', background: type.bg, color: type.color, borderRadius: '4px', padding: '1px 6px', fontWeight: 600, whiteSpace: 'nowrap' }}>{type.label}</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: ev.status === 'completado' ? 'line-through' : 'none' }}>{ev.title}</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <Clock size={11} style={{ verticalAlign: 'middle', marginRight: '3px' }} />
            {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: badge.color, background: badge.bg, borderRadius: '4px', padding: '1px 5px' }}>{badge.label}</span>
          {ev.assigned_to && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>👤 {ev.assigned_to}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        {!ev._readonly && (
          <>
            <button title={ev.status === 'completado' ? 'Marcar pendiente' : 'Marcar completado'} onClick={() => onToggle(ev)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ev.status === 'completado' ? '#16A34A' : 'var(--text-muted)', padding: '3px' }}>
              <CheckCircle2 size={16} />
            </button>
            <button title="Editar" onClick={() => onEdit(ev)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '3px' }}>
              ✏️
            </button>
            <button title="Eliminar" onClick={() => onDelete(ev)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '3px' }}>
              <X size={14} />
            </button>
          </>
        )}
        {ev._readonly && (
          <button title="Ver equipo" onClick={() => onGoEquip && onGoEquip('equipos', ev._equipment_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.75rem', padding: '3px' }}>
            Ver →
          </button>
        )}
      </div>
    </div>
  );
}

function DayPanel({ dateStr, events, onClose, onAdd, onEdit, onDelete, onToggle, onGoEquip }) {
  const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{dateLabel}</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--secondary)' }}>{events.length} evento{events.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={onAdd}><Plus size={13} /></button>
          <button className="btn btn-secondary" style={{ padding: '4px', border: 'none' }} onClick={onClose}><X size={16} /></button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {events.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0', fontSize: '0.85rem' }}>
            Sin eventos este día.<br />
            <button className="btn btn-secondary" style={{ marginTop: '10px', fontSize: '0.8rem' }} onClick={onAdd}><Plus size={12} /> Añadir</button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {events.map(ev => {
            const type  = EVENT_TYPES[ev.type] || EVENT_TYPES.otro;
            const badge = statusBadge(ev.date, ev.status);
            return (
              <div key={ev.id} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${type.color}33`, background: type.bg, borderLeft: `4px solid ${type.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: type.color }}>{type.label}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: badge.color, background: 'white', borderRadius: '4px', padding: '1px 5px' }}>{badge.label}</span>
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--secondary)', marginBottom: '4px', textDecoration: ev.status === 'completado' ? 'line-through' : 'none' }}>{ev.title}</div>
                {ev.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{ev.description}</div>}
                {ev.assigned_to && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>👤 {ev.assigned_to}</div>}
                {!ev._readonly && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <button style={{ fontSize: '0.75rem', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', color: ev.status === 'completado' ? '#16A34A' : 'var(--text-muted)' }} onClick={() => onToggle(ev)}>
                      {ev.status === 'completado' ? '↩ Pendiente' : '✓ Hecho'}
                    </button>
                    <button style={{ fontSize: '0.75rem', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer' }} onClick={() => onEdit(ev)}>Editar</button>
                    <button style={{ fontSize: '0.75rem', background: 'white', border: '1px solid #FECACA', color: 'var(--danger)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer' }} onClick={() => onDelete(ev)}>Eliminar</button>
                  </div>
                )}
                {ev._readonly && (
                  <button style={{ fontSize: '0.75rem', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', color: 'var(--primary)', marginTop: '6px' }} onClick={() => onGoEquip && onGoEquip('equipos', ev._equipment_id)}>
                    Ver equipo →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UpcomingPanel({ events, overdue, onSelectDay }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--secondary)' }}>Próximos 10 eventos</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {overdue.length > 0 && (
          <div style={{ marginBottom: '12px', padding: '8px 10px', background: '#FEF2F2', borderRadius: '6px', border: '1px solid #FECACA' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626', marginBottom: '4px' }}>⚠ {overdue.length} vencido{overdue.length > 1 ? 's' : ''}</div>
            {overdue.slice(0, 3).map(ev => (
              <div key={ev.id} style={{ fontSize: '0.75rem', color: '#DC2626', cursor: 'pointer', padding: '2px 0', textDecoration: 'underline' }} onClick={() => onSelectDay(ev.date)}>
                {ev.title}
              </div>
            ))}
          </div>
        )}
        {events.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>Sin eventos próximos.</p>}
        {events.map(ev => {
          const type  = EVENT_TYPES[ev.type] || EVENT_TYPES.otro;
          const d     = daysUntil(ev.date);
          const dateLabel = new Date(ev.date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
          return (
            <div key={ev.id} onClick={() => onSelectDay(ev.date)} style={{ display: 'flex', gap: '8px', padding: '7px 6px', cursor: 'pointer', borderRadius: '6px', borderBottom: '1px solid var(--border)' }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--background)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: '36px', flexShrink: 0, textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: type.color }}>{dateLabel}</div>
                <div style={{ fontSize: '0.68rem', color: d <= 7 ? '#DC2626' : d <= 30 ? '#EA580C' : 'var(--text-muted)' }}>
                  {d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `${d}d`}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: type.color, marginBottom: '1px' }}>{type.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
