import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Plus, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import PatientAutocomplete from '../../components/ui/PatientAutocomplete';
import { useToast } from '../../components/ui/Toast';
import { getReminders, createReminder } from '../../api/crm';
import { getList } from '../../api/response';

const TYPE_LABELS = {
    appointment: 'Recordatorio cita',
    lab_ready:            'Lab listo',
    birthday:             'Cumpleaños',
    control_visual:       'Control visual',
    reorder:              'Reorden',
    balance:              'Saldo pendiente',
    custom:               'Manual',
};

const STATUS_CONFIG = {
    pending: { label: 'Pendiente', icon: Clock,        className: 'bg-yellow-100 text-yellow-700' },
    sent:    { label: 'Enviado',   icon: CheckCircle,   className: 'bg-green-100 text-green-700' },
    failed:  { label: 'Fallido',   icon: XCircle,       className: 'bg-red-100 text-red-700' },
};

const AVAILABLE_VARS = ['{nombre}', '{nombre_completo}', '{optica}', '{fecha}', '{monto}', '{producto}'];

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] ?? { label: status, icon: Clock, className: 'bg-gray-100 text-gray-600' };
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
            <Icon size={10} />
            {cfg.label}
        </span>
    );
}

const EMPTY_FORM = {
    patient_id: null,
    patient_name: '',
    type: 'custom',
    channel: 'whatsapp',
    message: '',
    scheduled_at: '',
};

function NewReminderModal({ open, onClose, onCreated }) {
    const { addToast } = useToast();
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) setForm(EMPTY_FORM);
    }, [open]);

    const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    const handlePatientSelect = (patient) => {
        set('patient_id', patient.id);
        set('patient_name', patient.nombre);
    };

    const handleSave = async () => {
        if (!form.patient_id) return addToast('Selecciona un paciente', 'error');
        if (!form.message.trim()) return addToast('El mensaje no puede estar vacío', 'error');
        if (!form.scheduled_at) return addToast('Selecciona la fecha y hora de envío', 'error');
        setSaving(true);
        try {
            await createReminder(form);
            addToast('Recordatorio creado exitosamente', 'success');
            onCreated();
            onClose();
        } catch {
            addToast('Error al crear el recordatorio', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Nuevo Recordatorio Manual" size="md">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paciente</label>
                    <PatientAutocomplete onSelect={handlePatientSelect} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                        <select
                            value={form.type}
                            onChange={e => set('type', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm"
                        >
                            {Object.entries(TYPE_LABELS).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Canal</label>
                        <select
                            value={form.channel}
                            onChange={e => set('channel', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm"
                        >
                            <option value="whatsapp">WhatsApp</option>
                            <option value="email">Email</option>
                        </select>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700">Mensaje</label>
                        <span className="text-xs text-gray-400">{form.message.length} car.</span>
                    </div>
                    <textarea
                        value={form.message}
                        onChange={e => set('message', e.target.value)}
                        rows={4}
                        placeholder="Hola {nombre}, te recordamos..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm resize-none"
                    />
                    <div className="mt-1 flex flex-wrap gap-1">
                        <span className="text-xs text-gray-400">Variables:</span>
                        {AVAILABLE_VARS.map(v => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => set('message', form.message + v)}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono transition-colors"
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora de envío</label>
                    <input
                        type="datetime-local"
                        value={form.scheduled_at}
                        onChange={e => set('scheduled_at', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} loading={saving}>
                        <Bell size={14} /> Crear Recordatorio
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export default function RemindersPage() {
    const { addToast } = useToast();
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [filters, setFilters] = useState({ status: '', type: '', date: '' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.status) params.status = filters.status;
            if (filters.type) params.type = filters.type;
            if (filters.date) params.date = filters.date;
            const r = await getReminders(params);
            setReminders(getList(r));
        } catch {
            addToast('Error al cargar recordatorios', 'error');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => { load(); }, [load]);

    const setFilter = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1a2a4a] rounded-xl flex items-center justify-center">
                        <Bell size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Recordatorios</h1>
                        <p className="text-sm text-gray-500">Notificaciones automáticas y manuales</p>
                    </div>
                </div>
                <Button onClick={() => setShowModal(true)}>
                    <Plus size={16} /> Nuevo Recordatorio Manual
                </Button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-600">
                    <Filter size={15} /> Filtros
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Estado</label>
                        <select
                            value={filters.status}
                            onChange={e => setFilter('status', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                        >
                            <option value="">Todos</option>
                            <option value="pending">Pendiente</option>
                            <option value="sent">Enviado</option>
                            <option value="failed">Fallido</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                        <select
                            value={filters.type}
                            onChange={e => setFilter('type', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                        >
                            <option value="">Todos</option>
                            {Object.entries(TYPE_LABELS).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                        <input
                            type="date"
                            value={filters.date}
                            onChange={e => setFilter('date', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-48 text-gray-400">
                        <div className="animate-spin h-8 w-8 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
                    </div>
                ) : reminders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
                        <Bell size={36} className="opacity-30" />
                        <p className="text-base font-medium">No hay recordatorios</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    {['Paciente', 'Tipo', 'Canal', 'Mensaje', 'Estado', 'Programado', 'Enviado'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {reminders.map(r => (
                                    <tr key={r.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {r.patient?.nombre ?? r.patient_name ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[r.type] ?? r.type}</td>
                                        <td className="px-4 py-3 text-gray-600 capitalize">{r.channel}</td>
                                        <td className="px-4 py-3 text-gray-600 max-w-xs">
                                            <span className="truncate block" title={r.message}>
                                                {r.message?.length > 60 ? r.message.slice(0, 60) + '...' : r.message}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {r.scheduled_at ? new Date(r.scheduled_at).toLocaleString('es-ES') : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {r.sent_at ? new Date(r.sent_at).toLocaleString('es-ES') : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <NewReminderModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onCreated={load}
            />
        </div>
    );
}
