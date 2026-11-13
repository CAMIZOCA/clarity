import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Plus, CheckCircle, XCircle, Clock, Filter, Search, MessageCircle, Ban, Users } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import PatientAutocomplete from '../../components/ui/PatientAutocomplete';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import {
    getReminders, createReminder, getTemplates, getWhatsappContacts,
    previewReminderMessage, recordWhatsAppSent, updateReminderStatus,
} from '../../api/crm';
import { getList, getPagination, getPayload } from '../../api/response';
import { toDisplayDate, toDisplayDateTime } from '../../utils/dates';
import { whatsappLink, whatsappNumber } from '../../utils/whatsapp';

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
    cancelled: { label: 'Cancelado', icon: Ban,         className: 'bg-gray-100 text-gray-600' },
};

const CHANNEL_LABELS = { whatsapp: 'WhatsApp', email: 'Email', sms: 'SMS' };

const SEARCH_DEBOUNCE_MS = 350;
const UNDO_TOAST_MS = 10000;

/** Primer y ultimo dia de un `YYYY-MM` (input type="month"). */
function monthRange(month) {
    const [year, mon] = month.split('-').map(Number);
    const last = new Date(year, mon, 0).getDate();
    return { date_from: `${month}-01`, date_to: `${month}-${String(last).padStart(2, '0')}` };
}

function useDebounced(value, delay) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

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
        set('patient_name', patient.nombre_completo || patient.nombre);
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm resize-none"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
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

/**
 * Prepara el mensaje y abre WhatsApp (web o escritorio) con el texto ya
 * escrito. Al abrirlo queda como "Enviado": el sistema no puede saber si se
 * pulso enviar dentro de WhatsApp, por eso el aviso ofrece deshacer.
 *
 * `target`: { patient_id, nombre_completo, telefono, consultation_id?, reminder? }.
 * Con `reminder` (un recordatorio ya creado) se parte de su mensaje.
 */
function SendWhatsAppModal({ target, onClose, onSent }) {
    const { addToast } = useToast();
    const [templates, setTemplates] = useState([]);
    const [templateId, setTemplateId] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const open = Boolean(target);
    const number = whatsappNumber(target?.telefono);

    const loadPreview = useCallback(async (patientId, tplId) => {
        setLoading(true);
        try {
            const r = await previewReminderMessage({ patient_id: patientId, template_id: tplId || undefined });
            const preview = getPayload(r);
            setMessage(preview?.message ?? '');
            setTemplateId(preview?.template_id ? String(preview.template_id) : '');
        } catch {
            addToast('No se pudo preparar el mensaje', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        if (!open) return;
        getTemplates({ channel: 'whatsapp' })
            .then(r => setTemplates(getList(r)))
            .catch(() => setTemplates([]));

        if (target.reminder) {
            setMessage(target.reminder.message ?? '');
            setTemplateId(target.reminder.template_id ? String(target.reminder.template_id) : '');
        } else {
            setMessage('');
            loadPreview(target.patient_id, null);
        }
    }, [open, target, loadPreview]);

    const handleTemplate = (value) => {
        setTemplateId(value);
        if (value) loadPreview(target.patient_id, value);
    };

    const handleOpen = async () => {
        const text = message.trim();
        if (!text) return addToast('El mensaje no puede estar vacío', 'warning');
        const link = whatsappLink(target.telefono, text);
        if (!link) return addToast('El paciente no tiene un celular válido para WhatsApp', 'warning');

        // window.open debe ir antes de cualquier await o el navegador lo bloquea.
        window.open(link, '_blank', 'noopener');

        setSaving(true);
        try {
            if (target.reminder) {
                await updateReminderStatus(target.reminder.id, { status: 'sent', message: text });
                onSent({ reminderId: target.reminder.id, undoStatus: target.reminder.status === 'failed' ? 'failed' : 'pending' });
            } else {
                const r = await recordWhatsAppSent({
                    patient_id: target.patient_id,
                    consultation_id: target.consultation_id ?? undefined,
                    template_id: templateId ? Number(templateId) : undefined,
                    message: text,
                });
                onSent({ reminderId: getPayload(r)?.id, undoStatus: 'cancelled' });
            }
            onClose();
        } catch {
            addToast('Se abrió WhatsApp, pero no se pudo marcar como enviado', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Enviar por WhatsApp" size="md">
            {target && (
                <div className="space-y-4">
                    <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        <p className="font-medium text-gray-900">{target.nombre_completo}</p>
                        <p className="text-gray-500">
                            {target.telefono || 'Sin teléfono'}
                            {!number && <span className="ml-2 text-amber-700">· no es un celular, WhatsApp no lo abrirá</span>}
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-gray-700">Plantilla</label>
                            <Link to="/crm/plantillas" className="text-xs text-navy underline hover:no-underline">
                                Editar plantillas
                            </Link>
                        </div>
                        <select
                            value={templateId}
                            onChange={e => handleTemplate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                        >
                            <option value="">— Mensaje actual —</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-gray-700">Mensaje</label>
                            <span className="text-xs text-gray-400">Puede editarlo antes de abrir WhatsApp</span>
                        </div>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={6}
                            disabled={loading}
                            placeholder={loading ? 'Preparando mensaje…' : ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy text-sm"
                        />
                    </div>

                    <p className="text-xs text-gray-500">
                        Se abrirá WhatsApp (escritorio o web) con el mensaje escrito; solo falta pulsar enviar allí.
                        Quedará marcado como enviado y podrá deshacerlo.
                    </p>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                        <Button variant="success" onClick={handleOpen} loading={saving} disabled={loading || !number}>
                            <MessageCircle size={16} /> Abrir WhatsApp
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

function WhatsAppButton({ telefono, onClick, label = 'WhatsApp', disabled }) {
    const hasMobile = Boolean(whatsappNumber(telefono));
    return (
        <Button
            size="sm"
            variant="success"
            onClick={onClick}
            disabled={disabled || !hasMobile}
            title={hasMobile ? 'Abrir WhatsApp con el mensaje' : 'Sin celular registrado'}
        >
            <MessageCircle size={14} /> {hasMobile ? label : 'Sin celular'}
        </Button>
    );
}

function Pager({ pagination, onPage }) {
    if (!pagination || pagination.last_page <= 1) return null;
    const { current_page: page, last_page: last, total } = pagination;
    return (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
            <span>{total} resultados</span>
            <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</Button>
                <span>Página {page} de {last}</span>
                <Button size="sm" variant="ghost" disabled={page >= last} onClick={() => onPage(page + 1)}>Siguiente</Button>
            </div>
        </div>
    );
}

function SearchBox({ value, onChange, placeholder }) {
    return (
        <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
                type="search"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            />
        </div>
    );
}

function Spinner() {
    return (
        <div className="flex items-center justify-center h-48 text-gray-400">
            <div className="animate-spin h-8 w-8 border-4 border-navy border-t-transparent rounded-full" />
        </div>
    );
}

function NoticeCell({ notice }) {
    if (!notice || notice.status === 'cancelled') {
        return <StatusBadge status="pending" />;
    }
    return (
        <div className="space-y-0.5">
            <StatusBadge status={notice.status} />
            {notice.sent_at && (
                <p className="text-xs text-gray-500">
                    {toDisplayDateTime(notice.sent_at)}{notice.sent_by ? ` · ${notice.sent_by}` : ''}
                </p>
            )}
        </div>
    );
}

/** Atendidos en los ultimos 30 dias; al buscar, todo el padron. */
function RecentContactsTab({ canSend, onSend, reloadKey }) {
    const { addToast } = useToast();
    const [search, setSearch] = useState('');
    const debounced = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [recentDays, setRecentDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const requestId = useRef(0);

    useEffect(() => { setPage(1); }, [debounced]);

    useEffect(() => {
        const id = ++requestId.current;
        setLoading(true);
        getWhatsappContacts({ search: debounced || undefined, page })
            .then(r => {
                if (id !== requestId.current) return;
                setRows(getList(r));
                setPagination(getPagination(r));
                if (r?.data?.recent_days) setRecentDays(r.data.recent_days);
            })
            .catch(() => id === requestId.current && addToast('Error al cargar los pacientes', 'error'))
            .finally(() => id === requestId.current && setLoading(false));
    }, [debounced, page, reloadKey, addToast]);

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                <SearchBox
                    value={search}
                    onChange={setSearch}
                    placeholder="Buscar paciente por nombre, apellido o cédula…"
                />
                <p className="text-xs text-gray-500">
                    {debounced
                        ? 'Resultados en todos los pacientes, de la visita más reciente a la más antigua.'
                        : `Atendidos en los últimos ${recentDays} días, de la visita más reciente a la anterior. Use el buscador para encontrar a cualquier otro paciente.`}
                </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {loading ? <Spinner /> : rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
                        <Users size={36} className="opacity-30" />
                        <p className="text-base font-medium">
                            {debounced ? 'Ningún paciente coincide con la búsqueda' : `Sin pacientes atendidos en los últimos ${recentDays} días`}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    {['Paciente', 'Teléfono', 'Última visita', 'Aviso lentes listos', ''].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rows.map(row => (
                                    <tr key={row.patient_id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <Link to={`/pacientes/${row.patient_id}`} className="font-medium text-gray-900 hover:underline">
                                                {row.nombre_completo || '—'}
                                            </Link>
                                            {row.cedula && <p className="text-xs text-gray-500">{row.cedula}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{row.telefono || '—'}</td>
                                        <td className="px-4 py-3 text-gray-600">{toDisplayDate(row.last_visit, 'Sin consultas')}</td>
                                        <td className="px-4 py-3"><NoticeCell notice={row.notice} /></td>
                                        <td className="px-4 py-3 text-right">
                                            {canSend && (
                                                <WhatsAppButton
                                                    telefono={row.telefono}
                                                    label={row.notice?.status === 'sent' ? 'Reenviar' : 'WhatsApp'}
                                                    onClick={() => onSend({
                                                        patient_id: row.patient_id,
                                                        nombre_completo: row.nombre_completo,
                                                        telefono: row.telefono,
                                                        consultation_id: row.consultation_id,
                                                    })}
                                                />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pager pagination={pagination} onPage={setPage} />
            </div>
        </div>
    );
}

/** Recordatorios guardados (cumpleanos, controles, manuales, campanas). */
function RemindersTab({ canSend, onSend, reloadKey }) {
    const { addToast } = useToast();
    const [reminders, setReminders] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const debounced = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);
    const [filters, setFilters] = useState({ status: '', type: '', month: '' });

    useEffect(() => { setPage(1); }, [debounced, filters]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page };
            if (filters.status) params.status = filters.status;
            if (filters.type) params.type = filters.type;
            if (filters.month) Object.assign(params, monthRange(filters.month));
            if (debounced) params.search = debounced;
            const r = await getReminders(params);
            setReminders(getList(r));
            setPagination(getPagination(r));
        } catch {
            addToast('Error al cargar recordatorios', 'error');
        } finally {
            setLoading(false);
        }
    }, [filters, debounced, page, addToast]);

    useEffect(() => { load(); }, [load, reloadKey]);

    const setFilter = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-600">
                    <Filter size={15} /> Filtros
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="sm:col-span-2 lg:col-span-1">
                        <label className="block text-xs text-gray-500 mb-1">Paciente</label>
                        <SearchBox value={search} onChange={setSearch} placeholder="Nombre o cédula…" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Estado</label>
                        <select
                            value={filters.status}
                            onChange={e => setFilter('status', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                        >
                            <option value="">Todos</option>
                            {Object.entries(STATUS_CONFIG).map(([v, cfg]) => (
                                <option key={v} value={v}>{cfg.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                        <select
                            value={filters.type}
                            onChange={e => setFilter('type', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                        >
                            <option value="">Todos</option>
                            {Object.entries(TYPE_LABELS).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Mes programado</label>
                        <input
                            type="month"
                            value={filters.month}
                            onChange={e => setFilter('month', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {loading ? <Spinner /> : reminders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
                        <Bell size={36} className="opacity-30" />
                        <p className="text-base font-medium">No hay recordatorios</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    {['Paciente', 'Tipo', 'Canal', 'Mensaje', 'Estado', 'Programado', 'Enviado', ''].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {reminders.map(r => (
                                    <tr key={r.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {r.patient?.nombre_completo ?? r.patient?.nombre ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[r.type] ?? r.type}</td>
                                        <td className="px-4 py-3 text-gray-600">{CHANNEL_LABELS[r.channel] ?? r.channel}</td>
                                        <td className="px-4 py-3 text-gray-600 max-w-xs">
                                            <span className="truncate block" title={r.message}>
                                                {r.message?.length > 60 ? r.message.slice(0, 60) + '...' : r.message}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">{toDisplayDateTime(r.scheduled_at, '—')}</td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">{toDisplayDateTime(r.sent_at, '—')}</td>
                                        <td className="px-4 py-3 text-right">
                                            {canSend && r.channel === 'whatsapp' && ['pending', 'failed'].includes(r.status) && (
                                                <WhatsAppButton
                                                    telefono={r.patient?.telefono}
                                                    label="Enviar"
                                                    onClick={() => onSend({
                                                        patient_id: r.patient_id,
                                                        nombre_completo: r.patient?.nombre_completo ?? '',
                                                        telefono: r.patient?.telefono,
                                                        reminder: r,
                                                    })}
                                                />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pager pagination={pagination} onPage={setPage} />
            </div>
        </div>
    );
}

const TABS = [
    { key: 'contacts', label: 'Clientes recientes', icon: Users },
    { key: 'reminders', label: 'Recordatorios', icon: Bell },
];

export default function RemindersPage() {
    const { addToast } = useToast();
    const { can } = useAuth();
    const canSend = can('crm.send_messages');
    const [tab, setTab] = useState('contacts');
    const [showModal, setShowModal] = useState(false);
    const [sendTarget, setSendTarget] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    const reload = useCallback(() => setReloadKey(k => k + 1), []);

    const handleSent = useCallback(({ reminderId, undoStatus }) => {
        reload();
        if (!reminderId) return;
        addToast('Marcado como enviado.', 'success', UNDO_TOAST_MS, {
            label: 'Deshacer',
            onClick: async () => {
                try {
                    await updateReminderStatus(reminderId, { status: undoStatus });
                    addToast('Se deshizo el envío.', 'info');
                    reload();
                } catch {
                    addToast('No se pudo deshacer el envío', 'error');
                }
            },
        });
    }, [addToast, reload]);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-navy rounded-xl flex items-center justify-center">
                        <Bell size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Recordatorios</h1>
                        <p className="text-sm text-gray-500">Envío manual por WhatsApp: el sistema abre el chat con el mensaje listo</p>
                    </div>
                </div>
                {canSend && (
                    <Button onClick={() => setShowModal(true)}>
                        <Plus size={16} /> Nuevo Recordatorio Manual
                    </Button>
                )}
            </div>

            <div className="flex gap-1 border-b border-gray-200">
                {TABS.map(t => {
                    const Icon = t.icon;
                    const active = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={`inline-flex items-center gap-2 px-4 py-2 -mb-px border-b-2 text-sm font-medium transition-colors ${
                                active ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Icon size={15} /> {t.label}
                        </button>
                    );
                })}
            </div>

            {tab === 'contacts'
                ? <RecentContactsTab canSend={canSend} onSend={setSendTarget} reloadKey={reloadKey} />
                : <RemindersTab canSend={canSend} onSend={setSendTarget} reloadKey={reloadKey} />}

            <SendWhatsAppModal
                target={sendTarget}
                onClose={() => setSendTarget(null)}
                onSent={handleSent}
            />

            <NewReminderModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onCreated={reload}
            />
        </div>
    );
}
