import React, { useState, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { Plus } from 'lucide-react';
import client from '../../api/client';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import PatientAutocomplete from '../../components/ui/PatientAutocomplete';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';

const ESTADO_COLORS = {
    pendiente: '#3b82f6',
    atendido: '#22c55e',
    cancelado: '#9ca3af',
};

const emptyForm = () => ({
    patient_id: '',
    patient: null,
    titulo: '',
    fecha_hora_inicio: '',
    fecha_hora_fin: '',
    notas: '',
    estado: 'pendiente',
});

export default function AgendaPage() {
    const { addToast } = useToast();
    const [events, setEvents] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);

    const fetchEvents = useCallback(async (info, successCb, failureCb) => {
        try {
            const res = await client.get('/appointments', {
                params: {
                    from: info.startStr,
                    to: info.endStr,
                },
            });
            const mapped = res.data.map(a => ({
                id: String(a.id),
                title: a.titulo || a.patient?.nombre || 'Cita',
                start: a.fecha_hora_inicio,
                end: a.fecha_hora_fin,
                backgroundColor: ESTADO_COLORS[a.estado] ?? '#3b82f6',
                borderColor: ESTADO_COLORS[a.estado] ?? '#3b82f6',
                extendedProps: { ...a },
            }));
            successCb(mapped);
        } catch {
            failureCb();
        }
    }, []);

    const openNew = (selectInfo) => {
        const f = emptyForm();
        if (selectInfo) {
            f.fecha_hora_inicio = selectInfo.startStr.slice(0, 16);
            f.fecha_hora_fin = selectInfo.endStr.slice(0, 16);
        }
        setForm(f);
        setEditing(null);
        setModalOpen(true);
    };

    const openEdit = (clickInfo) => {
        const a = clickInfo.event.extendedProps;
        setForm({
            patient_id: a.patient_id || '',
            patient: a.patient || null,
            titulo: a.titulo || '',
            fecha_hora_inicio: a.fecha_hora_inicio?.slice(0, 16) || '',
            fecha_hora_fin: a.fecha_hora_fin?.slice(0, 16) || '',
            notas: a.notas || '',
            estado: a.estado || 'pendiente',
        });
        setEditing(clickInfo.event.id);
        setModalOpen(true);
    };

    const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.fecha_hora_inicio || !form.fecha_hora_fin) {
            addToast('Las fechas son requeridas', 'error');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                patient_id: form.patient_id || null,
                titulo: form.titulo || null,
                fecha_hora_inicio: form.fecha_hora_inicio,
                fecha_hora_fin: form.fecha_hora_fin,
                notas: form.notas || null,
                estado: form.estado,
            };
            if (editing) {
                await client.put(`/appointments/${editing}`, payload);
                addToast('Cita actualizada', 'success');
            } else {
                await client.post('/appointments', payload);
                addToast('Cita creada', 'success');
            }
            setModalOpen(false);
        } catch (err) {
            addToast(err.response?.data?.message || 'Error al guardar', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editing) return;
        try {
            await client.delete(`/appointments/${editing}`);
            addToast('Cita eliminada', 'success');
            setModalOpen(false);
            setConfirmOpen(false);
        } catch {
            addToast('Error al eliminar', 'error');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Agenda</h1>
                    <p className="text-gray-500 mt-1">Gestión de citas y calendario</p>
                </div>
                <Button onClick={() => openNew(null)}>
                    <Plus size={20} /> Nueva cita
                </Button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek"
                    locale={esLocale}
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek,timeGridDay',
                    }}
                    selectable
                    selectMirror
                    editable={false}
                    events={fetchEvents}
                    select={openNew}
                    eventClick={openEdit}
                    height="auto"
                    slotMinTime="07:00:00"
                    slotMaxTime="20:00:00"
                    buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }}
                />
            </div>

            {/* Leyenda */}
            <div className="flex gap-4 mt-4 text-sm text-gray-600">
                {Object.entries(ESTADO_COLORS).map(([estado, color]) => (
                    <span key={estado} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        {estado.charAt(0).toUpperCase() + estado.slice(1)}
                    </span>
                ))}
            </div>

            {/* Modal nueva/editar cita */}
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar cita' : 'Nueva cita'} size="md">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Paciente</label>
                        <PatientAutocomplete
                            value={form.patient}
                            onChange={p => { set('patient', p); set('patient_id', p?.id || ''); }}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Título / Motivo</label>
                        <input
                            type="text"
                            value={form.titulo}
                            onChange={e => set('titulo', e.target.value)}
                            placeholder="Ej: Control, Primera vez..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Inicio <span className="text-red-500">*</span></label>
                            <input
                                type="datetime-local"
                                value={form.fecha_hora_inicio}
                                onChange={e => set('fecha_hora_inicio', e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fin <span className="text-red-500">*</span></label>
                            <input
                                type="datetime-local"
                                value={form.fecha_hora_fin}
                                onChange={e => set('fecha_hora_fin', e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                        <select
                            value={form.estado}
                            onChange={e => set('estado', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                        >
                            <option value="pendiente">Pendiente</option>
                            <option value="atendido">Atendido</option>
                            <option value="cancelado">Cancelado</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                        <textarea
                            value={form.notas}
                            onChange={e => set('notas', e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] resize-none"
                        />
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        {editing ? (
                            <Button type="button" variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>Eliminar cita</Button>
                        ) : <span />}
                        <div className="flex gap-3">
                            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button>
                            <Button type="submit" loading={saving}>{editing ? 'Guardar' : 'Crear cita'}</Button>
                        </div>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                open={confirmOpen}
                title="¿Eliminar cita?"
                message="Esta acción no se puede deshacer."
                confirmLabel="Eliminar"
                onConfirm={handleDelete}
                onCancel={() => setConfirmOpen(false)}
            />
        </div>
    );
}
