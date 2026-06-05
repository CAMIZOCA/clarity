import React, { useState, useEffect, useCallback } from 'react';
import { FlaskConical, AlertCircle, Clock, CheckCircle, Plus, RefreshCw, X } from 'lucide-react';
import { getLabOrders, updateLabOrderStatus, createLabOrder, getLabSuppliers } from '../../api/sales';
import PatientAutocomplete from '../../components/ui/PatientAutocomplete';
import { getList } from '../../api/response';

const KANBAN_COLUMNS = [
    { key: 'draft',     label: 'Borrador',        color: 'gray'   },
    { key: 'pending',   label: 'Pendiente envío', color: 'yellow' },
    { key: 'sent',      label: 'En Laboratorio',  color: 'blue'   },
    { key: 'processing', label: 'Procesando',     color: 'indigo' },
    { key: 'received',  label: 'Recibido',         color: 'indigo' },
    { key: 'qc',        label: 'Control Calidad',  color: 'purple' },
    { key: 'ready',     label: 'Listo ✓',          color: 'green'  },
    { key: 'delivered', label: 'Entregado',         color: 'gray'   },
];

const COLOR_MAP = {
    yellow: {
        header: 'bg-yellow-100 border-yellow-300 text-yellow-800',
        badge:  'bg-yellow-200 text-yellow-800',
        drop:   'bg-yellow-50',
        border: 'border-yellow-200',
    },
    blue: {
        header: 'bg-blue-100 border-blue-300 text-blue-800',
        badge:  'bg-blue-200 text-blue-800',
        drop:   'bg-blue-50',
        border: 'border-blue-200',
    },
    indigo: {
        header: 'bg-indigo-100 border-indigo-300 text-indigo-800',
        badge:  'bg-indigo-200 text-indigo-800',
        drop:   'bg-indigo-50',
        border: 'border-indigo-200',
    },
    purple: {
        header: 'bg-purple-100 border-purple-300 text-purple-800',
        badge:  'bg-purple-200 text-purple-800',
        drop:   'bg-purple-50',
        border: 'border-purple-200',
    },
    green: {
        header: 'bg-green-100 border-green-300 text-green-800',
        badge:  'bg-green-200 text-green-800',
        drop:   'bg-green-50',
        border: 'border-green-200',
    },
    gray: {
        header: 'bg-gray-100 border-gray-300 text-gray-700',
        badge:  'bg-gray-200 text-gray-700',
        drop:   'bg-gray-50',
        border: 'border-gray-200',
    },
};

function fmt(date) {
    if (!date) return null;
    return new Date(date);
}

function DeliveryBadge({ date }) {
    if (!date) return null;
    const d = fmt(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    d.setHours(0, 0, 0, 0);

    let cls = 'text-gray-500';
    if (d < today) cls = 'text-red-600 font-semibold';
    else if (d <= tomorrow) cls = 'text-yellow-600 font-semibold';

    return (
        <span className={`text-xs ${cls}`}>
            <Clock size={11} className="inline mr-0.5" />
            {d.toLocaleDateString('es', { day: '2-digit', month: 'short' })}
        </span>
    );
}

function OrderCard({ order, onDragStart, dragging }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData('orderId', String(order.id));
                onDragStart();
            }}
            className={`bg-white rounded-lg border border-gray-200 shadow-sm cursor-grab active:cursor-grabbing select-none transition-opacity ${dragging ? 'opacity-40' : ''}`}
        >
            <div
                className="p-3 cursor-pointer"
                onClick={() => setExpanded(v => !v)}
            >
                <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-500">
                        {order.order_number ?? `LB-${String(order.id).padStart(6, '0')}`}
                    </span>
                    {order.priority === 'urgent' && (
                        <span className="flex items-center gap-0.5 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                            <AlertCircle size={10} /> Urgente
                        </span>
                    )}
                </div>

                <p className="text-sm font-medium text-gray-800 leading-tight truncate">
                    {order.patient?.name ?? order.patient_name ?? '—'}
                </p>

                <p className="text-xs text-gray-500 truncate mt-0.5">
                    {order.lab_supplier?.name ?? order.supplier_name ?? 'Sin asignar'}
                </p>

                <div className="mt-1.5">
                    <DeliveryBadge date={order.estimated_delivery_date} />
                </div>
            </div>

            {expanded && (
                <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-1.5">
                    {order.technical_notes && (
                        <div>
                            <span className="text-[10px] font-semibold text-gray-400 uppercase">Notas</span>
                            <p className="text-xs text-gray-600">{order.technical_notes}</p>
                        </div>
                    )}
                    {order.prescription && (
                        <div>
                            <span className="text-[10px] font-semibold text-gray-400 uppercase">Receta</span>
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                                {typeof order.prescription === 'object'
                                    ? JSON.stringify(order.prescription, null, 2)
                                    : order.prescription}
                            </pre>
                        </div>
                    )}
                    {order.sale_id && (
                        <p className="text-[10px] text-gray-400">Venta #{order.sale_id}</p>
                    )}
                </div>
            )}
        </div>
    );
}

function KanbanColumn({ col, orders, onDrop, draggingId }) {
    const [over, setOver] = useState(false);
    const theme = COLOR_MAP[col.color];

    return (
        <div
            className={`flex-shrink-0 w-64 flex flex-col rounded-xl border ${theme.border} overflow-hidden`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { setOver(false); onDrop(e, col.key); }}
        >
            {/* Column header */}
            <div className={`flex items-center justify-between px-3 py-2.5 border-b ${theme.header}`}>
                <span className="text-sm font-semibold">{col.label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${theme.badge}`}>
                    {orders.length}
                </span>
            </div>

            {/* Drop zone */}
            <div
                className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[4rem] transition-colors ${over ? 'bg-blue-50 ring-2 ring-inset ring-blue-300' : theme.drop}`}
            >
                {orders.length === 0 ? (
                    <p className="text-center text-xs text-gray-400 py-6 italic">Sin órdenes</p>
                ) : (
                    orders.map(order => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            dragging={draggingId === order.id}
                            onDragStart={() => {}}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

const EMPTY_FORM = {
    patient: null,
    lab_supplier_id: '',
    priority: 'normal',
    estimated_delivery_date: '',
    technical_notes: '',
};

export default function LabOrdersPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [suppliers, setSuppliers] = useState([]);
    const [filterSupplier, setFilterSupplier] = useState('');
    const [draggingId, setDraggingId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const loadOrders = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterSupplier) params.lab_supplier_id = filterSupplier;
            const res = await getLabOrders(params);
            setOrders(getList(res));
        } catch {
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [filterSupplier]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    useEffect(() => {
        getLabSuppliers()
            .then(r => setSuppliers(getList(r)))
            .catch(() => {});
    }, []);

    const handleDrop = async (e, newStatus) => {
        const orderId = e.dataTransfer.getData('orderId');
        if (!orderId) return;
        setDraggingId(null);
        try {
            await updateLabOrderStatus(Number(orderId), { status: newStatus });
            await loadOrders();
        } catch {
            /* silently fail — let user retry */
        }
    };

    const overdueCount = orders.filter(o => {
        if (!o.estimated_delivery_date) return false;
        if (o.status === 'delivered') return false;
        const d = new Date(o.estimated_delivery_date);
        d.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return d < today;
    }).length;

    const grouped = KANBAN_COLUMNS.reduce((acc, col) => {
        acc[col.key] = orders.filter(o => o.status === col.key);
        return acc;
    }, {});

    const handleSave = async () => {
        if (!form.patient) { setError('Selecciona un paciente'); return; }
        setSaving(true);
        setError(null);
        try {
            await createLabOrder({
                patient_id: form.patient.id,
                lab_supplier_id: form.lab_supplier_id || null,
                priority: form.priority,
                estimated_delivery_date: form.estimated_delivery_date || null,
                technical_notes: form.technical_notes,
            });
            setShowModal(false);
            setForm(EMPTY_FORM);
            await loadOrders();
        } catch (err) {
            setError(err?.response?.data?.message ?? 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full p-4 gap-4">
            {/* Header */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <FlaskConical size={24} className="text-[#1a2a4a]" />
                    <h1 className="text-xl font-bold text-gray-900">Órdenes de Laboratorio</h1>
                </div>

                {overdueCount > 0 && (
                    <span className="flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
                        <AlertCircle size={13} />
                        {overdueCount} atrasada{overdueCount > 1 ? 's' : ''}
                    </span>
                )}

                <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <select
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={filterSupplier}
                        onChange={e => setFilterSupplier(e.target.value)}
                    >
                        <option value="">Todos los laboratorios</option>
                        {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>

                    <button
                        onClick={loadOrders}
                        className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw size={15} />
                        Actualizar
                    </button>

                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#1a2a4a] text-white rounded-lg text-sm font-semibold hover:bg-[#223260] transition-colors"
                    >
                        <Plus size={16} />
                        Nueva Orden
                    </button>
                </div>
            </div>

            {/* Kanban board */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin h-10 w-10 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
                </div>
            ) : (
                <div
                    className="flex gap-4 overflow-x-auto pb-4"
                    style={{ height: 'calc(100vh - 12rem)' }}
                    onDragStart={(e) => {
                        const id = e.dataTransfer.getData('orderId');
                        if (id) setDraggingId(Number(id));
                    }}
                >
                    {KANBAN_COLUMNS.map(col => (
                        <KanbanColumn
                            key={col.key}
                            col={col}
                            orders={grouped[col.key] ?? []}
                            onDrop={handleDrop}
                            draggingId={draggingId}
                        />
                    ))}
                </div>
            )}

            {/* Modal Nueva Orden */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <FlaskConical size={20} className="text-[#1a2a4a]" />
                                Nueva Orden de Laboratorio
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg flex items-center gap-2">
                                    <AlertCircle size={15} />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Paciente <span className="text-red-500">*</span>
                                </label>
                                <PatientAutocomplete
                                    value={form.patient}
                                    onChange={(p) => setForm(f => ({ ...f, patient: p }))}
                                    placeholder="Buscar paciente..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Laboratorio
                                </label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={form.lab_supplier_id}
                                    onChange={e => setForm(f => ({ ...f, lab_supplier_id: e.target.value }))}
                                >
                                    <option value="">Sin asignar</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Prioridad
                                </label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={form.priority}
                                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                                >
                                    <option value="normal">Normal</option>
                                    <option value="urgent">Urgente</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Fecha estimada de entrega
                                </label>
                                <input
                                    type="date"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={form.estimated_delivery_date}
                                    onChange={e => setForm(f => ({ ...f, estimated_delivery_date: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Notas técnicas
                                </label>
                                <textarea
                                    rows={3}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    placeholder="Indicaciones de fabricación, materiales, etc."
                                    value={form.technical_notes}
                                    onChange={e => setForm(f => ({ ...f, technical_notes: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 px-6 py-4 border-t">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 bg-[#1a2a4a] text-white rounded-lg text-sm font-semibold hover:bg-[#223260] disabled:opacity-50 transition-colors"
                            >
                                {saving ? (
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                ) : (
                                    <CheckCircle size={16} />
                                )}
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
