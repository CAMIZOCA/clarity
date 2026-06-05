import React, { useState, useEffect, useCallback } from 'react';
import { Search, ChevronDown, ChevronUp, DollarSign, AlertCircle, Eye, Plus } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { getSales, getSale, processPayment } from '../../api/sales';
import { useAuth } from '../../contexts/AuthContext';
import { getList, getPayload } from '../../api/response';

function fmt(n) { return Number(n || 0).toFixed(2); }

const STATUS_BADGES = {
    draft:     { label: 'Borrador',    cls: 'bg-gray-100 text-gray-600' },
    pending:   { label: 'Pendiente',   cls: 'bg-yellow-100 text-yellow-700' },
    partial:   { label: 'Abono',       cls: 'bg-blue-100 text-blue-700' },
    paid:      { label: 'Pagado',      cls: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelado',   cls: 'bg-red-100 text-red-700' },
};

const PAYMENT_METHODS = [
    { key: 'cash', label: 'Efectivo' },
    { key: 'card', label: 'Tarjeta' },
    { key: 'transfer', label: 'Transferencia' },
];

export default function SalesHistoryPage() {
    const { isAdmin } = useAuth();

    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Filters
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        date_from: '',
        date_to: '',
    });

    // Expanded row
    const [expandedId, setExpandedId] = useState(null);
    const [expandedSale, setExpandedSale] = useState(null);
    const [expandedLoading, setExpandedLoading] = useState(false);

    // Abono modal
    const [abonoModal, setAbonoModal] = useState({ open: false, sale: null });
    const [abonoAmount, setAbonoAmount] = useState('');
    const [abonoMethod, setAbonoMethod] = useState('cash');
    const [abonoRef, setAbonoRef] = useState('');
    const [abonoLoading, setAbonoLoading] = useState(false);
    const [abonoError, setAbonoError] = useState('');

    const loadSales = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = {};
            if (filters.search) params.search = filters.search;
            if (filters.status) params.status = filters.status;
            if (filters.date_from) params.date_from = filters.date_from;
            if (filters.date_to) params.date_to = filters.date_to;
            const res = await getSales(params);
            setSales(getList(res));
        } catch (err) {
            setError(err.response?.data?.message || 'Error al cargar ventas');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadSales();
    }, [loadSales]);

    const toggleExpand = async (saleId) => {
        if (expandedId === saleId) {
            setExpandedId(null);
            setExpandedSale(null);
            return;
        }
        setExpandedId(saleId);
        setExpandedLoading(true);
        try {
            const res = await getSale(saleId);
            setExpandedSale(getPayload(res));
        } catch (_) {}
        finally { setExpandedLoading(false); }
    };

    const openAbono = (sale) => {
        setAbonoModal({ open: true, sale });
        setAbonoAmount('');
        setAbonoMethod('cash');
        setAbonoRef('');
        setAbonoError('');
    };

    const handleAbono = async () => {
        const { sale } = abonoModal;
        if (!abonoAmount || Number(abonoAmount) <= 0) {
            setAbonoError('Ingresa un monto válido');
            return;
        }
        setAbonoLoading(true);
        setAbonoError('');
        try {
            await processPayment(sale.id, { method: abonoMethod, amount: Number(abonoAmount), reference: abonoRef || null });
            setAbonoModal({ open: false, sale: null });
            loadSales();
        } catch (err) {
            setAbonoError(err.response?.data?.message || 'Error al registrar abono');
        } finally {
            setAbonoLoading(false);
        }
    };

    const setFilter = (key, val) => setFilters(p => ({ ...p, [key]: val }));

    return (
        <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Historial de Ventas</h1>
                    <p className="text-gray-500 text-sm mt-0.5">Consulta y gestiona todas las ventas</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por número o cliente..."
                            value={filters.search}
                            onChange={e => setFilter('search', e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                        />
                    </div>
                    <select
                        value={filters.status}
                        onChange={e => setFilter('status', e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                    >
                        <option value="">Todos los estados</option>
                        {Object.entries(STATUS_BADGES).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                    <input
                        type="date"
                        value={filters.date_from}
                        onChange={e => setFilter('date_from', e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                        placeholder="Desde"
                    />
                    <input
                        type="date"
                        value={filters.date_to}
                        onChange={e => setFilter('date_to', e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                        placeholder="Hasta"
                    />
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-gray-400">
                        <svg className="animate-spin h-8 w-8 mr-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Cargando ventas...
                    </div>
                ) : sales.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <DollarSign size={40} className="mx-auto mb-3 opacity-30" />
                        <p>No se encontraron ventas</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600">Vendedor</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-600">Abonado</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-600">Saldo</th>
                                <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                                <th className="w-24 px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map(sale => {
                                const badge = STATUS_BADGES[sale.status] || STATUS_BADGES.draft;
                                const paid = Number(sale.paid_amount ?? sale.paid ?? 0);
                                const balance = Number(sale.balance ?? (Number(sale.total || 0) - paid));
                                const isExpanded = expandedId === sale.id;
                                return (
                                    <React.Fragment key={sale.id}>
                                        <tr
                                            className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
                                            onClick={() => toggleExpand(sale.id)}
                                        >
                                            <td className="px-4 py-3 font-mono text-gray-700">
                                                #{sale.sale_number || sale.id}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {sale.created_at ? new Date(sale.created_at).toLocaleDateString('es-ES') : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-gray-900">{sale.patient?.nombre || sale.patient_name || '—'}</p>
                                                <p className="text-xs text-gray-400">{sale.patient?.cedula}</p>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{sale.user?.name || sale.seller_name || '—'}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-gray-900">${fmt(sale.total)}</td>
                                            <td className="px-4 py-3 text-right text-green-700">${fmt(paid)}</td>
                                            <td className={`px-4 py-3 text-right font-semibold ${balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                ${fmt(balance)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    {isExpanded
                                                        ? <ChevronUp size={16} className="text-gray-400" />
                                                        : <ChevronDown size={16} className="text-gray-400" />}
                                                    {balance > 0 && sale.status !== 'cancelled' && (
                                                        <button
                                                            onClick={e => { e.stopPropagation(); openAbono(sale); }}
                                                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-200 font-medium whitespace-nowrap"
                                                        >
                                                            + Abono
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Expanded detail */}
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={9} className="bg-blue-50 px-6 py-4">
                                                    {expandedLoading ? (
                                                        <p className="text-center text-gray-400 py-4">Cargando detalle...</p>
                                                    ) : expandedSale ? (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            {/* Items */}
                                                            <div>
                                                                <h4 className="font-semibold text-gray-700 mb-2">Productos</h4>
                                                                <table className="w-full text-xs">
                                                                    <thead>
                                                                        <tr className="text-gray-500">
                                                                            <th className="text-left pb-1">Producto</th>
                                                                            <th className="text-center pb-1">Cant.</th>
                                                                            <th className="text-right pb-1">P.Unit.</th>
                                                                            <th className="text-right pb-1">Subtotal</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {(expandedSale.items || []).map(item => (
                                                                            <tr key={item.id} className="border-t border-blue-100">
                                                                                <td className="py-1">{item.product?.name || item.product_name}</td>
                                                                                <td className="text-center">{item.quantity}</td>
                                                                                <td className="text-right">${fmt(item.unit_price)}</td>
                                                                                <td className="text-right font-medium">${fmt(item.subtotal)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>

                                                            {/* Payments */}
                                                            <div>
                                                                <h4 className="font-semibold text-gray-700 mb-2">Pagos registrados</h4>
                                                                {(expandedSale.payments || []).length === 0 ? (
                                                                    <p className="text-gray-400 text-xs">Sin pagos registrados</p>
                                                                ) : (
                                                                    <table className="w-full text-xs">
                                                                        <thead>
                                                                            <tr className="text-gray-500">
                                                                                <th className="text-left pb-1">Método</th>
                                                                                <th className="text-left pb-1">Referencia</th>
                                                                                <th className="text-right pb-1">Monto</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {expandedSale.payments.map((p, i) => (
                                                                                <tr key={i} className="border-t border-blue-100">
                                                                                    <td className="py-1 capitalize">{p.method}</td>
                                                                                    <td>{p.reference || '—'}</td>
                                                                                    <td className="text-right font-medium">${fmt(p.amount)}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                )}

                                                                {/* Lab order */}
                                                                {expandedSale.lab_order && (
                                                                    <div className="mt-3 p-2 bg-purple-50 rounded-lg border border-purple-200">
                                                                        <p className="text-xs font-semibold text-purple-700">
                                                                            Orden Lab #{expandedSale.lab_order.id} — {expandedSale.lab_order.status}
                                                                        </p>
                                                                        <p className="text-xs text-purple-500">{expandedSale.lab_order.lab_name}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Abono modal */}
            <Modal open={abonoModal.open} onClose={() => setAbonoModal({ open: false, sale: null })} title="Registrar abono" size="sm">
                {abonoModal.sale && (
                    <div className="space-y-4">
                        <div className="bg-gray-50 rounded-xl p-3">
                            <p className="font-medium text-gray-900">Venta #{abonoModal.sale.sale_number || abonoModal.sale.id}</p>
                            <p className="text-sm text-gray-500">
                                Saldo pendiente: <span className="text-red-600 font-semibold">
                                    ${fmt(abonoModal.sale.balance ?? (Number(abonoModal.sale.total) - Number(abonoModal.sale.paid_amount ?? abonoModal.sale.paid ?? 0)))}
                                </span>
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Monto a abonar</label>
                            <input
                                type="number" min={0.01} step="0.01"
                                value={abonoAmount}
                                onChange={e => setAbonoAmount(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago</label>
                            <div className="grid grid-cols-3 gap-2">
                                {PAYMENT_METHODS.map(m => (
                                    <button key={m.key} onClick={() => setAbonoMethod(m.key)}
                                        className={`py-2 rounded-xl border-2 text-sm font-medium transition-all
                                            ${abonoMethod === m.key ? 'border-[#1a2a4a] bg-[#1a2a4a] text-white' : 'border-gray-200 text-gray-600 hover:border-[#1a2a4a]'}`}>
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {abonoMethod !== 'cash' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                                <input
                                    type="text"
                                    value={abonoRef}
                                    onChange={e => setAbonoRef(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                                    placeholder="Número de referencia"
                                />
                            </div>
                        )}
                        {abonoError && (
                            <p className="text-sm text-red-600 flex items-center gap-1">
                                <AlertCircle size={14} /> {abonoError}
                            </p>
                        )}
                        <div className="flex gap-3">
                            <Button variant="ghost" className="flex-1" onClick={() => setAbonoModal({ open: false, sale: null })}>
                                Cancelar
                            </Button>
                            <Button variant="primary" className="flex-1" loading={abonoLoading} onClick={handleAbono}>
                                <DollarSign size={16} /> Registrar abono
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
