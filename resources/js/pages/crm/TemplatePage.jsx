import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Edit2, Eye } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { getTemplates, createTemplate, updateTemplate } from '../../api/crm';
import { getList } from '../../api/response';

const TYPE_LABELS = {
    appointment_reminder: 'Recordatorio cita',
    lab_ready:            'Lab listo',
    birthday:             'Cumpleaños',
    reorder:              'Reorden',
    balance_reminder:     'Saldo pendiente',
    custom:               'Personalizado',
};

const CHANNEL_LABELS = { whatsapp: 'WhatsApp', email: 'Email' };

const EXAMPLE_VARS = {
    nombre: 'Juan',
    nombre_completo: 'Juan Pérez',
    optica: 'Clarity Óptica',
    fecha: '05/06/2026',
    monto: '$150.00',
    producto: 'Lentes progresivos',
};

function applyExampleVars(text) {
    if (!text) return '';
    return text.replace(/\{(\w+)\}/g, (_, key) => EXAMPLE_VARS[key] ?? `{${key}}`);
}

const AVAILABLE_VARS = ['{nombre}', '{nombre_completo}', '{optica}', '{fecha}', '{monto}', '{producto}'];

const EMPTY_FORM = { name: '', type: 'custom', channel: 'whatsapp', body: '', is_active: true };

function TemplateModal({ open, onClose, template, onSaved }) {
    const { addToast } = useToast();
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setForm(template
                ? { name: template.name, type: template.type, channel: template.channel, body: template.body ?? '', is_active: template.is_active ?? template.active ?? true }
                : EMPTY_FORM
            );
        }
    }, [open, template]);

    const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const handleSave = async () => {
        if (!form.name.trim()) return addToast('El nombre es requerido', 'error');
        if (!form.body.trim()) return addToast('El cuerpo del mensaje es requerido', 'error');
        setSaving(true);
        try {
            if (template) {
                await updateTemplate(template.id, form);
            } else {
                await createTemplate(form);
            }
            addToast(template ? 'Plantilla actualizada' : 'Plantilla creada', 'success');
            onSaved();
            onClose();
        } catch {
            addToast('Error al guardar la plantilla', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title={template ? 'Editar Plantilla' : 'Nueva Plantilla'} size="lg">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={e => set('name', e.target.value)}
                        placeholder="Ej: Recordatorio cita próxima semana"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm"
                    />
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
                        <span className="text-xs text-gray-400">{form.body.length} caracteres</span>
                    </div>
                    <textarea
                        value={form.body}
                        onChange={e => set('body', e.target.value)}
                        rows={6}
                        placeholder="Hola {nombre}, te recordamos tu cita en {optica} el {fecha}."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm resize-none"
                    />
                    <div className="mt-1 flex flex-wrap gap-1">
                        <span className="text-xs text-gray-400">Variables:</span>
                        {AVAILABLE_VARS.map(v => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => set('body', form.body + v)}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono transition-colors"
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>

                {form.body && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                            <Eye size={12} /> Vista previa con datos de ejemplo
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{applyExampleVars(form.body)}</p>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="active-toggle"
                        checked={form.is_active}
                        onChange={e => set('is_active', e.target.checked)}
                        className="accent-[#1a2a4a]"
                    />
                    <label htmlFor="active-toggle" className="text-sm text-gray-700">Plantilla activa</label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} loading={saving}>
                        {template ? 'Actualizar' : 'Crear Plantilla'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export default function TemplatePage() {
    const { addToast } = useToast();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [previewId, setPreviewId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await getTemplates();
            setTemplates(getList(r));
        } catch {
            addToast('Error al cargar plantillas', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => { setEditing(null); setShowModal(true); };
    const openEdit = (tpl) => { setEditing(tpl); setShowModal(true); };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1a2a4a] rounded-xl flex items-center justify-center">
                        <FileText size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Plantillas</h1>
                        <p className="text-sm text-gray-500">Mensajes reutilizables para campañas y recordatorios</p>
                    </div>
                </div>
                <Button onClick={openCreate}>
                    <Plus size={16} /> Nueva Plantilla
                </Button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-48 text-gray-400">
                        <div className="animate-spin h-8 w-8 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
                    </div>
                ) : templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
                        <FileText size={36} className="opacity-30" />
                        <p className="text-base font-medium">No hay plantillas aún</p>
                        <Button size="sm" onClick={openCreate}>
                            <Plus size={14} /> Crear primera plantilla
                        </Button>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                {['Nombre', 'Tipo', 'Canal', 'Estado', 'Acciones'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {templates.map(t => (
                                <React.Fragment key={t.id}>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                                        <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[t.type] ?? t.type}</td>
                                        <td className="px-4 py-3 text-gray-600">{CHANNEL_LABELS[t.channel] ?? t.channel}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                                                ${(t.is_active ?? t.active) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {(t.is_active ?? t.active) ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setPreviewId(previewId === t.id ? null : t.id)}
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#1a2a4a] hover:bg-gray-100 transition-colors"
                                                    title="Vista previa"
                                                >
                                                    <Eye size={15} />
                                                </button>
                                                <button
                                                    onClick={() => openEdit(t)}
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#1a2a4a] hover:bg-gray-100 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {previewId === t.id && (
                                        <tr className="bg-blue-50">
                                            <td colSpan={5} className="px-4 py-3">
                                                <p className="text-xs font-semibold text-blue-600 mb-1">Vista previa del mensaje:</p>
                                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{applyExampleVars(t.body)}</p>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <TemplateModal
                open={showModal}
                onClose={() => setShowModal(false)}
                template={editing}
                onSaved={load}
            />
        </div>
    );
}
