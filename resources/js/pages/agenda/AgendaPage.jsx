import React, { useState, useEffect, useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { Plus, Mail } from 'lucide-react';
import client from '../../api/client';
import { getList, getPayload } from '../../api/response';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import PatientAutocomplete from '../../components/ui/PatientAutocomplete';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { toDateTimeLocal } from '../../utils/dates';

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
    const { can } = useAuth();
    const canCreate = can('appointments.create');
    const canEdit = can('appointments.edit');
    const canDelete = can('appointments.delete');
    const [events, setEvents] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);
    /** Cita abierta tal como vino del servidor (email del paciente, ultimo recordatorio). */
    const [current, setCurrent] = useState(null);
    const [sendingReminder, setSendingReminder] = useState(false);
    const calendarRef = useRef(null);

    /** Sin esto una cita recien creada no aparecia hasta cambiar de vista. */
    const refetch = () => calendarRef.current?.getApi()?.refetchEvents();

    const fetchEvents = useCallback(async (info, successCb, failureCb) => {
        try {
            const res = await client.get('/appointments', {
                params: {
                    from: info.startStr,
                    to: info.endStr,
                },
            });
            const mapped = getList(res).map(a => ({
                id: String(a.id),
                title: a.titulo || a.patient?.nombre_completo || a.patient?.nombre || 'Cita',
                start: a.fecha_hora_inicio,
                end: a.fecha_hora_fin,
                backgroundColor: ESTADO_COLORS[a.estado] ?? '#3b82f6',
                borderColor: ESTADO_COLORS[a.estado] ?? '#3b82f6',
                extendedProps: { ...a },
            }));
            successCb(mapped);
        } catch (err) {
            addToast('No se pudieron cargar las citas del período.', 'error');
            failureCb(err);
        }
    }, [addToast]);

    const openNew = (selectInfo) => {
        if (!canCreate) return;
        const f = emptyForm();
        if (selectInfo) {
            f.fecha_hora_inicio = selectInfo.startStr.slice(0, 16);
            f.fecha_hora_fin = selectInfo.endStr.slice(0, 16);
        }
        setForm(f);
        setEditing(null);
        setCurrent(null);
        setModalOpen(true);
    };

    const openEdit = (clickInfo) => {
        const a = clickInfo.event.extendedProps;
        setForm({
            patient_id: a.patient_id || '',
            patient: a.patient || null,
            titulo: a.titulo || '',
            fecha_hora_inicio: toDateTimeLocal(a.fecha_hora_inicio),
            fecha_hora_fin: toDateTimeLocal(a.fecha_hora_fin),
            notas: a.notas || '',
            estado: a.estado || 'pendiente',
        });
        setCurrent(a);
        setEditing(clickInfo.event.id);
        setModalOpen(true);
    };

    const handleSendReminder = async () => {
        if (!editing) return;
        setSendingReminder(true);
        try {
            const res = await client.post(`/appointments/${editing}/send-reminder`);
            const body = getPayload(res);
            setCurrent(c => ({ ...c, reminder_email_sent_at: body.sent_at }));
            addToast(res.data?.message || 'Recordatorio enviado', 'success');
            refetch();
        } catch (err) {
            addToast(err.response?.data?.message || 'No se pudo enviar el recordatorio', 'error');
        } finally {
            setSendingReminder(false);
        }
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
            refetch();
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
            refetch();
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
                {canCreate && (
                    <Button onClick={() => openNew(null)}>
                        <Plus size={20} /> Nueva cita
                    </Button>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek"
                    locale={esLocale}
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek,timeGridDay',
                    }}
                    selectable={canCreate}
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy"
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fin <span className="text-red-500">*</span></label>
                            <input
                                type="datetime-local"
                                value={form.fecha_hora_fin}
                                onChange={e => set('fecha_hora_fin', e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                        <select
                            value={form.estado}
                            onChange={e => set('estado', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy resize-none"
                        />
                    </div>
                    {editing && canEdit && current && (
                        <ReminderBox
                            appointment={current}
                            patientChanged={String(form.patient_id || '') !== String(current.patient_id || '')}
                            sending={sendingReminder}
                            onSend={handleSendReminder}
                        />
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        {editing && canDelete ? (
                            <Button type="button" variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>Eliminar cita</Button>
                        ) : <span />}
                        <div className="flex gap-3">
                            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
                                {editing && !canEdit ? 'Cerrar' : 'Cancelar'}
                            </Button>
                            {(editing ? canEdit : canCreate) && (
                                <Button type="submit" loading={saving}>{editing ? 'Guardar' : 'Crear cita'}</Button>
                            )}
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

const formatSentAt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * Recordatorio por correo de la cita abierta. Se envia con los datos guardados,
 * asi que si se cambio el paciente sin guardar hay que guardar antes.
 */
function ReminderBox({ appointment, patientChanged, sending, onSend }) {
    const email = appointment.patient?.email;
    const cancelled = appointment.estado === 'cancelado';
    const sentAt = formatSentAt(appointment.reminder_email_sent_at);

    let hint;
    if (!appointment.patient_id) hint = 'Asigne un paciente y guarde la cita para enviar el recordatorio.';
    else if (patientChanged) hint = 'Guarde la cita antes de enviar el recordatorio al nuevo paciente.';
    else if (cancelled) hint = 'La cita está cancelada.';
    else if (!email) hint = 'El paciente no tiene correo registrado. Agréguelo en su ficha.';

    const disabled = Boolean(hint);

    return (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 text-sm">
                <p className="font-medium text-gray-800 flex items-center gap-2">
                    <Mail size={16} className="text-[#2f6db5]" /> Recordatorio por correo
                </p>
                <p className="text-gray-500 text-xs mt-0.5">
                    {hint || (sentAt ? `Enviado el ${sentAt} a ${email}` : `Se enviará a ${email}, con la cita para agregar al calendario.`)}
                </p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={onSend} loading={sending} disabled={disabled}>
                <Mail size={16} /> {sentAt ? 'Reenviar' : 'Enviar recordatorio'}
            </Button>
        </div>
    );
}
