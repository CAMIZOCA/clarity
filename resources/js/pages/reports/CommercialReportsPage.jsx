import React, { useState, useEffect, useCallback } from 'react';
import {
    BarChart2, Package, FlaskConical, DollarSign,
    Download, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import {
    getSalesReport,
    getInventoryReport,
    getLabReport,
    getCashReport,
    exportSales,
    exportInventory,
} from '../../api/reports';
import { format, startOfMonth } from 'date-fns';

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
const money  = (n) => `$${Number(n ?? 0).toFixed(2)}`;
const pct    = (n) => `${Number(n ?? 0).toFixed(1)}%`;
const today  = () => format(new Date(), 'yyyy-MM-dd');
const firstDayOfMonth = () => format(startOfMonth(new Date()), 'yyyy-MM-dd');

function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function TabButton({ active, onClick, icon: Icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                    ? 'bg-[#1a2a4a] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
            <Icon size={16} />
            {label}
        </button>
    );
}

// ────────────────────────────────────────────────────────────────
// Bar chart (CSS, horizontal)
// ────────────────────────────────────────────────────────────────
function HBarChart({ data = [], labelKey = 'period', valueKey = 'amount', colorClass = 'bg-blue-500' }) {
    const max = Math.max(...data.map(d => d[valueKey]), 1);
    return (
        <div className="space-y-2">
            {data.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-24 flex-shrink-0 truncate">{item[labelKey]}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div
                            className={`${colorClass} h-full rounded-full transition-all`}
                            style={{ width: `${Math.max((item[valueKey] / max) * 100, 2)}%` }}
                        />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-24 text-right flex-shrink-0">
                        {money(item[valueKey])}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Table
// ────────────────────────────────────────────────────────────────
function DataTable({ columns = [], rows = [], loading = false }) {
    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState('asc');

    const sorted = [...rows].sort((a, b) => {
        if (!sortCol) return 0;
        const av = a[sortCol];
        const bv = b[sortCol];
        const cmp = typeof av === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
        return sortDir === 'asc' ? cmp : -cmp;
    });

    const toggleSort = (key) => {
        if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(key); setSortDir('asc'); }
    };

    return (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <tr>
                        {columns.map(col => (
                            <th
                                key={col.key}
                                className={`px-4 py-3 text-left select-none ${col.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                                onClick={col.sortable !== false ? () => toggleSort(col.key) : undefined}
                            >
                                <span className="flex items-center gap-1">
                                    {col.label}
                                    {sortCol === col.key && (
                                        sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                    )}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {loading ? (
                        [...Array(5)].map((_, i) => (
                            <tr key={i}>
                                {columns.map(col => (
                                    <td key={col.key} className="px-4 py-3">
                                        <Skeleton className="h-4" />
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : sorted.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                                Sin datos para el período seleccionado
                            </td>
                        </tr>
                    ) : sorted.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                            {columns.map(col => (
                                <td key={col.key} className={`px-4 py-3 text-gray-700 ${col.className ?? ''}`}>
                                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Payment method breakdown
// ────────────────────────────────────────────────────────────────
function PaymentBreakdown({ data = [], loading }) {
    if (loading) return <div className="grid grid-cols-2 gap-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
    if (!data.length) return <p className="text-sm text-gray-400">Sin datos</p>;
    const total = data.reduce((s, d) => s + (d.total ?? 0), 0);
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data.map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 truncate">{item.method}</p>
                    <p className="text-lg font-bold text-gray-900">{money(item.total)}</p>
                    <p className="text-xs text-gray-400">{pct(total ? (item.total / total) * 100 : 0)}</p>
                </div>
            ))}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Tab: Ventas
// ────────────────────────────────────────────────────────────────
function SalesTab() {
    const [filters, setFilters] = useState({
        from: firstDayOfMonth(),
        to: today(),
        seller_id: '',
    });
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        getSalesReport(filters)
            .then(r => setData(r.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [filters]);

    useEffect(() => { load(); }, [load]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const response = await exportSales(filters);
            const url  = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'ventas.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            alert('Error al exportar. Intente nuevamente.');
        } finally {
            setExporting(false);
        }
    };

    const salesCols = [
        { key: 'date',       label: 'Fecha' },
        { key: 'invoice',    label: 'Factura/Recibo' },
        { key: 'customer',   label: 'Cliente' },
        { key: 'seller',     label: 'Vendedor' },
        { key: 'subtotal',   label: 'Subtotal',  render: v => money(v), className: 'text-right font-mono' },
        { key: 'discount',   label: 'Descuento', render: v => money(v), className: 'text-right font-mono text-red-500' },
        { key: 'total',      label: 'Total',     render: v => money(v), className: 'text-right font-mono font-semibold' },
        { key: 'status',     label: 'Estado' },
    ];

    const topSellersCols = [
        { key: 'position',  label: '#',        sortable: false, render: (_, __, idx) => idx + 1 },
        { key: 'name',      label: 'Vendedor' },
        { key: 'count',     label: 'Ventas',   render: v => v ?? 0 },
        { key: 'total',     label: 'Total',    render: v => money(v), className: 'font-mono font-semibold' },
    ];

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                        <input
                            type="date"
                            value={filters.from}
                            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]/30"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                        <input
                            type="date"
                            value={filters.to}
                            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]/30"
                        />
                    </div>
                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={load}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                        >
                            <RefreshCw size={14} /> Aplicar
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors disabled:opacity-60"
                        >
                            <Download size={14} />
                            {exporting ? 'Exportando...' : 'Exportar Excel'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {loading ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />) : (
                    <>
                        {[
                            { label: 'Total ventas',    value: money(data?.summary?.total) },
                            { label: 'Núm. ventas',     value: data?.summary?.count ?? 0 },
                            { label: 'Ticket promedio', value: money(data?.summary?.avgTicket) },
                            { label: 'Descuentos',      value: money(data?.summary?.discounts) },
                        ].map(card => (
                            <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-4">
                                <p className="text-xs text-gray-500">{card.label}</p>
                                <p className="text-xl font-bold text-gray-900 mt-1">{card.value}</p>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Sales by period chart */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Ventas por período</h3>
                {loading
                    ? <Skeleton className="h-24" />
                    : <HBarChart data={data?.byPeriod ?? []} labelKey="period" valueKey="amount" />
                }
            </div>

            {/* Payment method breakdown */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Desglose por método de pago</h3>
                <PaymentBreakdown data={data?.byPaymentMethod ?? []} loading={loading} />
            </div>

            {/* Top sellers */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Top vendedores</h3>
                <DataTable columns={topSellersCols} rows={data?.topSellers ?? []} loading={loading} />
            </div>

            {/* Sales table */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Detalle de ventas</h3>
                <DataTable columns={salesCols} rows={data?.sales ?? []} loading={loading} />
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Tab: Inventario
// ────────────────────────────────────────────────────────────────
function InventoryTab() {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        getInventoryReport()
            .then(r => setData(r.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const response = await exportInventory();
            const url  = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'inventario.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            alert('Error al exportar. Intente nuevamente.');
        } finally {
            setExporting(false);
        }
    };

    const lowStockCols = [
        { key: 'sku',       label: 'SKU' },
        { key: 'name',      label: 'Producto' },
        { key: 'category',  label: 'Categoría' },
        { key: 'stock',     label: 'Stock actual', className: 'font-semibold text-red-500' },
        { key: 'minStock',  label: 'Stock mínimo' },
    ];

    const noMovCols = [
        { key: 'sku',      label: 'SKU' },
        { key: 'name',     label: 'Producto' },
        { key: 'stock',    label: 'Stock', render: v => money(v) },
        { key: 'lastMove', label: 'Último movimiento' },
    ];

    const byCatCols = [
        { key: 'category', label: 'Categoría' },
        { key: 'count',    label: 'Productos' },
        { key: 'value',    label: 'Valor total', render: v => money(v), className: 'font-mono font-semibold' },
    ];

    return (
        <div className="space-y-6">
            {/* Header actions */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Inventario</h3>
                <div className="flex gap-2">
                    <button onClick={load} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                        <RefreshCw size={14} /> Actualizar
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                        <Download size={14} /> {exporting ? 'Exportando...' : 'Exportar Excel'}
                    </button>
                </div>
            </div>

            {/* Valorization */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {loading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />) : (
                    <>
                        <div className="bg-white rounded-2xl border border-gray-200 p-4">
                            <p className="text-xs text-gray-500">Valorización total (costo)</p>
                            <p className="text-xl font-bold text-gray-900 mt-1">{money(data?.valorizacionCosto)}</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-200 p-4">
                            <p className="text-xs text-gray-500">Valorización total (venta)</p>
                            <p className="text-xl font-bold text-gray-900 mt-1">{money(data?.valorizacionVenta)}</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-200 p-4">
                            <p className="text-xs text-gray-500">Productos con stock bajo</p>
                            <p className="text-xl font-bold text-red-600 mt-1">{data?.stockBajoCount ?? 0}</p>
                        </div>
                    </>
                )}
            </div>

            {/* Low stock */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4 text-red-600">Productos con stock bajo</h3>
                <DataTable columns={lowStockCols} rows={data?.stockBajo ?? []} loading={loading} />
            </div>

            {/* No movement */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Sin movimiento (últimos 30 días)</h3>
                <DataTable columns={noMovCols} rows={data?.sinMovimiento ?? []} loading={loading} />
            </div>

            {/* By category */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Por categoría</h3>
                <DataTable columns={byCatCols} rows={data?.porCategoria ?? []} loading={loading} />
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Tab: Laboratorio
// ────────────────────────────────────────────────────────────────
function LabTab() {
    const [filters, setFilters] = useState({ from: firstDayOfMonth(), to: today() });
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        getLabReport(filters)
            .then(r => setData(r.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [filters]);

    useEffect(() => { load(); }, [load]);

    const lateOrdersCols = [
        { key: 'id',         label: 'ID' },
        { key: 'patient',    label: 'Paciente' },
        { key: 'lab',        label: 'Laboratorio' },
        { key: 'dueDate',    label: 'Fecha prometida' },
        { key: 'daysLate',   label: 'Días atrasado', render: v => <span className="text-red-500 font-semibold">{v}</span> },
    ];

    const labPerfCols = [
        { key: 'lab',        label: 'Laboratorio' },
        { key: 'total',      label: 'Total' },
        { key: 'delivered',  label: 'Entregadas' },
        { key: 'late',       label: 'Atrasadas', render: v => <span className={v > 0 ? 'text-red-500' : 'text-green-600'}>{v}</span> },
        { key: 'avgDays',    label: 'Días promedio' },
    ];

    const statuses = data?.porEstado ?? [];

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                        <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]/30" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                        <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]/30" />
                    </div>
                    <button onClick={load} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                        <RefreshCw size={14} /> Aplicar
                    </button>
                </div>
            </div>

            {/* Status summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {loading
                    ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)
                    : statuses.map(s => (
                        <div key={s.status} className="bg-white rounded-2xl border border-gray-200 p-4">
                            <p className="text-xs text-gray-500 capitalize">{s.status}</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{s.count}</p>
                        </div>
                    ))
                }
            </div>

            {/* Late orders */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4 text-red-600">Órdenes atrasadas</h3>
                <DataTable columns={lateOrdersCols} rows={data?.ordenesAtrasadas ?? []} loading={loading} />
            </div>

            {/* Performance per lab */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Rendimiento por laboratorio</h3>
                <DataTable columns={labPerfCols} rows={data?.porLaboratorio ?? []} loading={loading} />
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Tab: Caja
// ────────────────────────────────────────────────────────────────
function CashTab() {
    const [filters, setFilters] = useState({ from: firstDayOfMonth(), to: today() });
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        getCashReport(filters)
            .then(r => setData(r.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [filters]);

    useEffect(() => { load(); }, [load]);

    const sessionCols = [
        { key: 'date',       label: 'Fecha' },
        { key: 'openedBy',   label: 'Abierta por' },
        { key: 'openTime',   label: 'Apertura' },
        { key: 'closeTime',  label: 'Cierre' },
        { key: 'openAmount', label: 'Monto apertura', render: v => money(v), className: 'font-mono' },
        { key: 'closeAmount',label: 'Monto cierre',   render: v => money(v), className: 'font-mono font-semibold' },
        { key: 'status',     label: 'Estado' },
    ];

    const expenseCols = [
        { key: 'date',        label: 'Fecha' },
        { key: 'description', label: 'Descripción' },
        { key: 'category',    label: 'Categoría' },
        { key: 'amount',      label: 'Monto', render: v => money(v), className: 'font-mono font-semibold' },
    ];

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                        <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]/30" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                        <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]/30" />
                    </div>
                    <button onClick={load} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                        <RefreshCw size={14} /> Aplicar
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {loading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />) : (
                    <>
                        <div className="bg-white rounded-2xl border border-gray-200 p-4">
                            <p className="text-xs text-gray-500">Ingresos totales</p>
                            <p className="text-xl font-bold text-emerald-700 mt-1">{money(data?.totalIngresos)}</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-200 p-4">
                            <p className="text-xs text-gray-500">Gastos del período</p>
                            <p className="text-xl font-bold text-red-600 mt-1">{money(data?.totalGastos)}</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-200 p-4">
                            <p className="text-xs text-gray-500">Saldo neto</p>
                            <p className="text-xl font-bold text-gray-900 mt-1">{money((data?.totalIngresos ?? 0) - (data?.totalGastos ?? 0))}</p>
                        </div>
                    </>
                )}
            </div>

            {/* Payment totals */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Totales por método de pago</h3>
                <PaymentBreakdown data={data?.porMetodoPago ?? []} loading={loading} />
            </div>

            {/* Sessions */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Historial de sesiones de caja</h3>
                <DataTable columns={sessionCols} rows={data?.sesiones ?? []} loading={loading} />
            </div>

            {/* Expenses */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Gastos del período</h3>
                <DataTable columns={expenseCols} rows={data?.gastos ?? []} loading={loading} />
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────
const TABS = [
    { key: 'ventas',      label: 'Ventas',      icon: BarChart2,    Component: SalesTab },
    { key: 'inventario',  label: 'Inventario',  icon: Package,      Component: InventoryTab },
    { key: 'laboratorio', label: 'Laboratorio', icon: FlaskConical, Component: LabTab },
    { key: 'caja',        label: 'Caja',        icon: DollarSign,   Component: CashTab },
];

export default function CommercialReportsPage() {
    const [activeTab, setActiveTab] = useState('ventas');
    const ActiveComponent = TABS.find(t => t.key === activeTab)?.Component ?? SalesTab;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <BarChart2 size={24} className="text-[#1a2a4a]" />
                    Reportes Comerciales
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">Análisis de ventas, inventario, laboratorio y caja</p>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 bg-gray-100 rounded-xl p-1.5">
                {TABS.map(tab => (
                    <TabButton
                        key={tab.key}
                        active={activeTab === tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        icon={tab.icon}
                        label={tab.label}
                    />
                ))}
            </div>

            {/* Active Tab Content */}
            <ActiveComponent />
        </div>
    );
}
