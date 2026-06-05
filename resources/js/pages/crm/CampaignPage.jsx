import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, Plus, Send, Users, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import {
    getCampaigns,
    createCampaign,
    previewCampaign,
    sendCampaign,
    getTemplates,
} from '../../api/crm';
import SegmentBuilder from '../../components/crm/SegmentBuilder';
import { getList, getPayload } from '../../api/response';

const STATUS_BADGES = {
    draft:     { label: 'Borrador',    className: 'bg-gray-100 text-gray-600' },
    scheduled: { label: 'Programada',  className: 'bg-blue-100 text-blue-700' },
    running:   { label: 'Enviando',    className: 'bg-yellow-100 text-yellow-700' },
    completed: { label: 'Completada',  className: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelada',   className: 'bg-red-100 text-red-700' },
};

const CHANNEL_LABELS = { whatsapp: 'WhatsApp', email: 'Email' };

const EXAMPLE_VARS = { nombre: 'Juan', nombre_completo: 'Juan Pérez', optica: 'Clarity Óptica', fecha: '05/06/2026', monto: '$150.00', producto: 'Lentes progresivos' };

function applyExampleVars(text) {
    if (!text) return '';
    return text.replace(/\{(\w+)\}/g, (_, key) => EXAMPLE_VARS[key] ?? `{${key}}`);
}

function StatusBadge({ status }) {
    const s = STATUS_BADGES[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
            {s.label}
        </span>
    );
}

const WIZARD_STEPS = ['Segmentación', 'Mensaje', 'Programación'];

function NewCampaignModal({ open, onClose, onCreated }) {
    const { addToast } = useToast();
    const [step, setStep] = useState(1);
    const [criteria, setCriteria] = useState({});
    const [preview, setPreview] = useState(null);
    const [calculating, setCalculating] = useState(false);

    const [channel, setChannel] = useState('whatsapp');
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [message, setMessage] = useState('');

    const [scheduleMode, setScheduleMode] = useState('now');
    const [scheduledAt, setScheduledAt] = useState('');
    const [campaignName, setCampaignName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            getTemplates({ channel }).then(r => setTemplates(getList(r))).catch(() => {});
        }
    }, [open, channel]);

    useEffect(() => {
        if (!open) {
            setStep(1);
            setCriteria({});
            setPreview(null);
            setChannel('whatsapp');
            setSelectedTemplate('');
            setMessage('');
            setScheduleMode('now');
            setScheduledAt('');
            setCampaignName('');
        }
    }, [open]);

    const handleCalculate = async () => {
        setCalculating(true);
        try {
            const r = await previewCampaign({ segment_criteria: criteria });
            setPreview(getPayload(r));
        } catch {
            addToast('Error al calcular destinatarios', 'error');
        } finally {
            setCalculating(false);
        }
    };

    const handleTemplateSelect = (id) => {
        setSelectedTemplate(id);
        const tpl = templates.find(t => String(t.id) === String(id));
        if (tpl) setMessage(tpl.body ?? '');
    };

    const handleCreate = async () => {
        if (!campaignName.trim()) return addToast('Ingresa un nombre para la campaña', 'error');
        if (!message.trim()) return addToast('El mensaje no puede estar vacío', 'error');
        setSaving(true);
        try {
            await createCampaign({
                name: campaignName,
                channel,
                segment_criteria: criteria,
                message_body: message,
                template_id: selectedTemplate || null,
                status: scheduleMode === 'scheduled' ? 'scheduled' : 'draft',
                scheduled_at: scheduleMode === 'scheduled' ? scheduledAt : null,
            });
            addToast('Campaña creada exitosamente', 'success');
            onCreated();
            onClose();
        } catch {
            addToast('Error al crear la campaña', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Nueva Campaña" size="lg">
            {/* Stepper */}
            <div className="flex items-center mb-6">
                {WIZARD_STEPS.map((label, i) => {
                    const num = i + 1;
                    const active = step === num;
                    const done = step > num;
                    return (
                        <React.Fragment key={num}>
                            <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                                    ${done ? 'bg-green-500 text-white' : active ? 'bg-[#1a2a4a] text-white' : 'bg-gray-200 text-gray-500'}`}>
                                    {done ? <CheckCircle size={16} /> : num}
                                </div>
                                <span className={`text-xs mt-1 ${active ? 'text-[#1a2a4a] font-semibold' : 'text-gray-400'}`}>{label}</span>
                            </div>
                            {i < WIZARD_STEPS.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-2 mb-4 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Step 1: Segmentación */}
            {step === 1 && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la campaña</label>
                        <input
                            type="text"
                            value={campaignName}
                            onChange={e => setCampaignName(e.target.value)}
                            placeholder="Ej: Campaña recordatorio julio 2026"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm"
                        />
                    </div>
                    <SegmentBuilder
                        criteria={criteria}
                        onChange={setCriteria}
                        preview={preview}
                        onCalculate={handleCalculate}
                        calculating={calculating}
                    />
                    <div className="flex justify-end pt-2">
                        <Button onClick={() => setStep(2)} disabled={!campaignName.trim()}>
                            Siguiente
                        </Button>
                    </div>
                </div>
            )}

            {/* Step 2: Mensaje */}
            {step === 2 && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Canal</label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
                                { value: 'email', label: 'Email', icon: '✉️' },
                            ].map(ch => (
                                <button
                                    key={ch.value}
                                    type="button"
                                    onClick={() => { setChannel(ch.value); setSelectedTemplate(''); setMessage(''); }}
                                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-colors font-medium
                                        ${channel === ch.value
                                            ? 'border-[#1a2a4a] bg-blue-50 text-[#1a2a4a]'
                                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                >
                                    <span className="text-2xl">{ch.icon}</span>
                                    {ch.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla</label>
                        <select
                            value={selectedTemplate}
                            onChange={e => handleTemplateSelect(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm"
                        >
                            <option value="">— Seleccionar plantilla —</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-gray-700">Mensaje</label>
                            <span className={`text-xs ${message.length > 4096 ? 'text-red-500' : 'text-gray-400'}`}>
                                {message.length}/4096
                            </span>
                        </div>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={5}
                            maxLength={4096}
                            placeholder="Escribe tu mensaje aquí..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm resize-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Variables disponibles:{' '}
                            {['{nombre}', '{nombre_completo}', '{optica}', '{fecha}', '{monto}', '{producto}'].map(v => (
                                <code key={v} className="bg-gray-100 px-1 rounded mx-0.5">{v}</code>
                            ))}
                        </p>
                    </div>

                    {message && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                                <Eye size={12} /> Vista previa
                            </p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{applyExampleVars(message)}</p>
                        </div>
                    )}

                    <div className="flex justify-between pt-2">
                        <Button variant="secondary" onClick={() => setStep(1)}>Atrás</Button>
                        <Button onClick={() => setStep(3)} disabled={!message.trim()}>Siguiente</Button>
                    </div>
                </div>
            )}

            {/* Step 3: Programación */}
            {step === 3 && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Envío</label>
                        <div className="space-y-2">
                            {[
                                { value: 'now', label: 'Enviar ahora' },
                                { value: 'scheduled', label: 'Programar para más tarde' },
                            ].map(opt => (
                                <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                                    ${scheduleMode === opt.value ? 'border-[#1a2a4a] bg-blue-50' : 'border-gray-200'}`}>
                                    <input
                                        type="radio"
                                        name="scheduleMode"
                                        value={opt.value}
                                        checked={scheduleMode === opt.value}
                                        onChange={() => setScheduleMode(opt.value)}
                                        className="accent-[#1a2a4a]"
                                    />
                                    <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {scheduleMode === 'scheduled' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora</label>
                            <input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={e => setScheduledAt(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm"
                            />
                        </div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1">
                        <p className="text-sm font-semibold text-blue-900">Resumen</p>
                        <p className="text-sm text-blue-700">
                            Campaña: <strong>{campaignName}</strong>
                        </p>
                        <p className="text-sm text-blue-700">
                            Canal: <strong>{CHANNEL_LABELS[channel]}</strong>
                        </p>
                        {preview && (
                            <p className="text-sm text-blue-700">
                                Destinatarios: <strong>{preview.count} personas</strong>
                            </p>
                        )}
                        <p className="text-sm text-blue-700">
                            Envío:{' '}
                            <strong>
                                {scheduleMode === 'now'
                                    ? 'Inmediatamente'
                                    : scheduledAt
                                        ? new Date(scheduledAt).toLocaleString('es-ES')
                                        : 'Sin fecha'
                                }
                            </strong>
                        </p>
                    </div>

                    <div className="flex justify-between pt-2">
                        <Button variant="secondary" onClick={() => setStep(2)}>Atrás</Button>
                        <Button
                            onClick={handleCreate}
                            loading={saving}
                            disabled={saving || (scheduleMode === 'scheduled' && !scheduledAt)}
                        >
                            <Send size={16} />
                            Crear Campaña
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

function CampaignDetail({ campaign }) {
    const total = campaign.total_recipients ?? 0;
    const sent = campaign.sent_count ?? 0;
    const failed = campaign.failed_count ?? 0;
    const pending = total - sent - failed;
    const progress = total > 0 ? Math.round((sent / total) * 100) : 0;

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                    {CHANNEL_LABELS[campaign.channel] ?? campaign.channel} &middot;{' '}
                    <StatusBadge status={campaign.status} />
                </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-800">{total}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Total</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{sent}</p>
                    <p className="text-xs text-green-600 mt-0.5">Enviados</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{failed}</p>
                    <p className="text-xs text-red-600 mt-0.5">Fallidos</p>
                </div>
            </div>

            {total > 0 && (
                <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Progreso</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {campaign.recipients && campaign.recipients.length > 0 && (
                <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Destinatarios</p>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600">Nombre</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {campaign.recipients.map((r, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-gray-800">{r.name ?? r.nombre}</td>
                                        <td className="px-3 py-2">
                                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium
                                                ${r.status === 'sent' ? 'bg-green-100 text-green-700'
                                                    : r.status === 'failed' ? 'bg-red-100 text-red-700'
                                                    : 'bg-yellow-100 text-yellow-700'}`}>
                                                {r.status === 'sent' ? <CheckCircle size={10} /> : r.status === 'failed' ? <XCircle size={10} /> : <Clock size={10} />}
                                                {r.status === 'sent' ? 'Enviado' : r.status === 'failed' ? 'Fallido' : 'Pendiente'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {total === 0 && (
                <div className="text-center py-8 text-gray-400">
                    <Users size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Sin destinatarios</p>
                </div>
            )}
        </div>
    );
}

export default function CampaignPage() {
    const { addToast } = useToast();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [sendingId, setSendingId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await getCampaigns();
            setCampaigns(getList(r));
        } catch {
            addToast('Error al cargar campañas', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleSend = async (campaign) => {
        setSendingId(campaign.id);
        try {
            await sendCampaign(campaign.id);
            addToast('Campaña enviada exitosamente', 'success');
            load();
        } catch {
            addToast('Error al enviar la campaña', 'error');
        } finally {
            setSendingId(null);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1a2a4a] rounded-xl flex items-center justify-center">
                        <Megaphone size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Campañas</h1>
                        <p className="text-sm text-gray-500">Envíos masivos por WhatsApp y Email</p>
                    </div>
                </div>
                <Button onClick={() => setShowModal(true)}>
                    <Plus size={16} /> Nueva Campaña
                </Button>
            </div>

            {/* Content */}
            <div className="flex gap-6 flex-1 min-h-0">
                {/* Lista */}
                <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                            <div className="animate-spin h-8 w-8 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 p-8">
                            <Megaphone size={40} className="opacity-30" />
                            <p className="text-base font-medium">No hay campañas aún</p>
                            <Button size="sm" onClick={() => setShowModal(true)}>
                                <Plus size={14} /> Crear primera campaña
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        {['Nombre', 'Canal', 'Destinatarios', 'Enviados/Fallidos', 'Estado', 'Programada', 'Acciones'].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {campaigns.map(c => (
                                        <tr
                                            key={c.id}
                                            onClick={() => setSelected(c)}
                                            className={`hover:bg-gray-50 cursor-pointer transition-colors ${selected?.id === c.id ? 'bg-blue-50' : ''}`}
                                        >
                                            <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                                            <td className="px-4 py-3 text-gray-600">{CHANNEL_LABELS[c.channel] ?? c.channel}</td>
                                            <td className="px-4 py-3 text-gray-600">{c.total_recipients ?? '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className="text-green-700 font-medium">{c.sent_count ?? 0}</span>
                                                <span className="text-gray-400 mx-1">/</span>
                                                <span className="text-red-600 font-medium">{c.failed_count ?? 0}</span>
                                            </td>
                                            <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                                            <td className="px-4 py-3 text-gray-500 text-xs">
                                                {c.scheduled_at ? new Date(c.scheduled_at).toLocaleString('es-ES') : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {c.status === 'draft' && (
                                                    <Button
                                                        size="sm"
                                                        variant="success"
                                                        loading={sendingId === c.id}
                                                        onClick={e => { e.stopPropagation(); handleSend(c); }}
                                                    >
                                                        <Send size={12} /> Enviar
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Detalle */}
                {selected && (
                    <div className="w-80 bg-white rounded-xl border border-gray-200 p-5 overflow-y-auto flex-shrink-0">
                        <CampaignDetail campaign={selected} />
                    </div>
                )}
            </div>

            <NewCampaignModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onCreated={load}
            />
        </div>
    );
}
