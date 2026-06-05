import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Plus, X, CheckCircle, TrendingUp, TrendingDown, Printer, Clock, User, AlertCircle } from 'lucide-react';
import {
    getCurrentSession,
    openCashSession,
    closeCashSession,
    registerExpense,
    getCashSessions,
} from '../../api/sales';
import { getList, getPayload } from '../../api/response';

const DEFAULT_REGISTER_ID = 1;

function fmt(n) {
    return Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(str) {
    if (!str) return '—';
    return new Date(str).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function SummaryCard({ label, value, icon: Icon, color = 'blue' }) {
    const colorMap = {
        blue:   'bg-blue-50 text-blue-700 border-blue-200',
        green:  'bg-green-50 text-green-700 border-green-200',
        purple: 'bg-purple-50 text-purple-700 border-purple-200',
        gray:   'bg-gray-50 text-gray-700 border-gray-200',
        red:    'bg-red-50 text-red-700 border-red-200',
    };
    return (
        <div className={`flex flex-col gap-1 border rounded-xl p-4 ${colorMap[color]}`}>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-70">
                <Icon size={14} />
                {label}
            </div>
            <span className="text-2xl font-bold">${fmt(value)}</span>
        </div>
    );
}

/* ─── View A: No active session ─────────────────────────────────── */
function OpenCashView({ onOpened }) {
    const [openingAmount, setOpeningAmount] = useState('0.00');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        getCashSessions({ per_page: 10 })
            .then(r => setHistory(getList(r)))
            .catch(() => {});
    }, []);

    const handleOpen = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await openCashSession(DEFAULT_REGISTER_ID, {
                opening_amount: parseFloat(openingAmount) || 0,
            });
            onOpened(getPayload(res));
        } catch (err) {
            setError(err?.response?.data?.message ?? 'Error al abrir caja');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
            {/* Open form */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 w-full max-w-sm">
                <div className="flex flex-col items-center gap-3 mb-6">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                        <DollarSign size={32} className="text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Apertura de Caja</h2>
                    <p className="text-sm text-gray-500 text-center">
                        Ingresa el monto inicial de efectivo en caja para comenzar el turno.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg flex items-center gap-2">
                        <AlertCircle size={15} />
                        {error}
                    </div>
                )}

                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto inicial (efectivo en caja)
                </label>
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
                    value={openingAmount}
                    onChange={e => setOpeningAmount(e.target.value)}
                    onFocus={e => e.target.select()}
                />

                <button
                    onClick={handleOpen}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-base transition-colors"
                >
                    {saving ? (
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                        <CheckCircle size={20} />
                    )}
                    {saving ? 'Abriendo...' : 'Abrir Caja'}
                </button>
            </div>

            {/* History table */}
            {history.length > 0 && (
                <div className="w-full max-w-2xl">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Sesiones anteriores
                    </h3>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Fecha apertura</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Cajero</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Total ventas</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Diferencia</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(s => {
                                    const diff = (s.actual_cash ?? 0) - (s.expected_cash ?? 0);
                                    return (
                                        <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="px-4 py-2 text-gray-700">{fmtDate(s.opened_at)}</td>
                                            <td className="px-4 py-2 text-gray-600">{s.cashier?.name ?? '—'}</td>
                                            <td className="px-4 py-2 text-right text-gray-700">${fmt(s.total_sales)}</td>
                                            <td className={`px-4 py-2 text-right font-semibold ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                                {diff >= 0 ? '+' : ''}{fmt(diff)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── View B: Active session ─────────────────────────────────────── */
function ActiveSessionView({ session, onClosed }) {
    const [summary, setSummary] = useState(session);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [expenseForm, setExpenseForm] = useState({ category: '', description: '', amount: '', date: new Date().toISOString().slice(0, 10) });
    const [closeForm, setCloseForm] = useState({ actual_cash: '', closing_notes: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [closeResult, setCloseResult] = useState(null);

    const refresh = useCallback(() => {
        getCurrentSession(DEFAULT_REGISTER_ID)
            .then(r => setSummary(getPayload(r)))
            .catch(() => {});
    }, []);

    useEffect(() => {
        const interval = setInterval(refresh, 60000);
        return () => clearInterval(interval);
    }, [refresh]);

    const cashSales    = summary?.cash_sales    ?? summary?.totals?.cash    ?? 0;
    const cardSales    = summary?.card_sales    ?? summary?.totals?.card    ?? 0;
    const transferSales= summary?.transfer_sales ?? summary?.totals?.transfer ?? 0;
    const totalSales   = summary?.total_sales   ?? (Number(cashSales) + Number(cardSales) + Number(transferSales));
    const totalExpenses= summary?.total_expenses ?? 0;
    const netBalance   = Number(totalSales) - Number(totalExpenses);
    const openingAmount= summary?.opening_amount ?? 0;
    const expectedCash = Number(openingAmount) + Number(cashSales) - Number(totalExpenses);

    const cashDiff = closeForm.actual_cash !== ''
        ? parseFloat(closeForm.actual_cash) - expectedCash
        : null;

    const openedAt = summary?.opened_at ? new Date(summary.opened_at) : null;
    const openedHour = openedAt
        ? openedAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
        : '—';

    /* Save expense */
    const handleExpense = async () => {
        if (!expenseForm.amount || isNaN(parseFloat(expenseForm.amount))) {
            setError('Ingresa un monto válido');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await registerExpense(summary.id, {
                category: expenseForm.category || 'general',
                description: expenseForm.description,
                amount: parseFloat(expenseForm.amount),
                date: expenseForm.date,
            });
            setShowExpenseModal(false);
            setExpenseForm({ category: '', description: '', amount: '', date: new Date().toISOString().slice(0, 10) });
            refresh();
        } catch (err) {
            setError(err?.response?.data?.message ?? 'Error al registrar gasto');
        } finally {
            setSaving(false);
        }
    };

    /* Close session */
    const handleClose = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await closeCashSession(summary.id, {
                actual_cash: parseFloat(closeForm.actual_cash) || 0,
                closing_notes: closeForm.closing_notes,
            });
            setCloseResult(getPayload(res));
            setShowCloseModal(false);
            onClosed(getPayload(res));
        } catch (err) {
            setError(err?.response?.data?.message ?? 'Error al cerrar caja');
        } finally {
            setSaving(false);
        }
    };

    if (closeResult) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 print:block">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 w-full max-w-md">
                    <div className="flex flex-col items-center gap-2 mb-6">
                        <CheckCircle size={48} className="text-green-500" />
                        <h2 className="text-xl font-bold text-gray-900">Caja Cerrada</h2>
                        <p className="text-sm text-gray-500">Turno finalizado correctamente</p>
                    </div>
                    <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Total ventas</dt>
                            <dd className="font-semibold">${fmt(closeResult.total_sales ?? totalSales)}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Gastos</dt>
                            <dd className="font-semibold text-red-600">-${fmt(closeResult.total_expenses ?? totalExpenses)}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Efectivo esperado</dt>
                            <dd className="font-semibold">${fmt(closeResult.expected_cash ?? expectedCash)}</dd>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                            <dt className="text-gray-700 font-medium">Efectivo contado</dt>
                            <dd className="font-bold">${fmt(closeResult.actual_cash ?? closeForm.actual_cash)}</dd>
                        </div>
                    </dl>
                    <button
                        onClick={() => window.print()}
                        className="mt-6 w-full flex items-center justify-center gap-2 border border-gray-300 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors print:hidden"
                    >
                        <Printer size={16} />
                        Imprimir resumen
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5 p-4">
            {/* Header */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <DollarSign size={24} className="text-green-600" />
                    <h1 className="text-xl font-bold text-gray-900">Caja Registradora</h1>
                </div>
                <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                    ABIERTA
                </span>
                <span className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock size={14} />
                    Desde las {openedHour}
                </span>
                {summary?.cashier && (
                    <span className="flex items-center gap-1 text-sm text-gray-500">
                        <User size={14} />
                        {summary.cashier.name}
                    </span>
                )}
                <div className="ml-auto flex gap-2">
                    <button
                        onClick={() => { setError(null); setShowExpenseModal(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                        <TrendingDown size={16} />
                        Registrar Gasto
                    </button>
                    <button
                        onClick={() => { setError(null); setShowCloseModal(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
                    >
                        <X size={16} />
                        Cerrar Caja
                    </button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard label="Efectivo" value={cashSales} icon={DollarSign} color="green" />
                <SummaryCard label="Tarjeta" value={cardSales} icon={TrendingUp} color="blue" />
                <SummaryCard label="Transferencia" value={transferSales} icon={TrendingUp} color="purple" />
                <SummaryCard label="Total ventas" value={totalSales} icon={TrendingUp} color="gray" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <SummaryCard label="Gastos" value={totalExpenses} icon={TrendingDown} color="red" />
                <SummaryCard label="Saldo neto" value={netBalance} icon={DollarSign} color={netBalance >= 0 ? 'green' : 'red'} />
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Apertura</span>
                    <span className="text-2xl font-bold text-gray-700">${fmt(openingAmount)}</span>
                </div>
            </div>

            {/* Expense Modal */}
            {showExpenseModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <TrendingDown size={20} className="text-red-600" />
                                Registrar Gasto
                            </h2>
                            <button onClick={() => setShowExpenseModal(false)} className="text-gray-400 hover:text-gray-600">
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                                    value={expenseForm.category}
                                    onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}
                                >
                                    <option value="general">General</option>
                                    <option value="supplies">Insumos</option>
                                    <option value="transport">Transporte</option>
                                    <option value="maintenance">Mantenimiento</option>
                                    <option value="other">Otro</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                                    placeholder="Detalle del gasto"
                                    value={expenseForm.description}
                                    onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Monto <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                                    placeholder="0.00"
                                    value={expenseForm.amount}
                                    onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                                <input
                                    type="date"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                                    value={expenseForm.date}
                                    onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-6 py-4 border-t">
                            <button
                                onClick={() => setShowExpenseModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                            >Cancelar</button>
                            <button
                                onClick={handleExpense}
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                {saving
                                    ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                    : <CheckCircle size={16} />}
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Close Modal */}
            {showCloseModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h2 className="text-lg font-bold text-gray-900">Cierre de Caja</h2>
                            <button onClick={() => setShowCloseModal(false)} className="text-gray-400 hover:text-gray-600">
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

                            {/* Summary */}
                            <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
                                <p className="font-semibold text-gray-700 mb-2">Resumen del turno</p>
                                <div className="flex justify-between text-gray-600">
                                    <span>Ventas totales</span>
                                    <span className="font-medium">${fmt(totalSales)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Gastos</span>
                                    <span className="font-medium text-red-600">-${fmt(totalExpenses)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600 border-t pt-1.5">
                                    <span>Efectivo esperado</span>
                                    <span className="font-semibold">${fmt(expectedCash)}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Monto contado en efectivo <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="0.00"
                                    value={closeForm.actual_cash}
                                    onChange={e => setCloseForm(f => ({ ...f, actual_cash: e.target.value }))}
                                />
                                {cashDiff !== null && (
                                    <p className={`mt-1 text-sm font-semibold ${cashDiff < 0 ? 'text-red-600' : cashDiff > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                        Diferencia: {cashDiff >= 0 ? '+' : ''}${fmt(cashDiff)}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Notas de cierre
                                </label>
                                <textarea
                                    rows={2}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    placeholder="Opcional"
                                    value={closeForm.closing_notes}
                                    onChange={e => setCloseForm(f => ({ ...f, closing_notes: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-6 py-4 border-t">
                            <button
                                onClick={() => setShowCloseModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                            >Cancelar</button>
                            <button
                                onClick={handleClose}
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                {saving
                                    ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                    : <X size={16} />}
                                {saving ? 'Cerrando...' : 'Cerrar Turno'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Main page ──────────────────────────────────────────────────── */
export default function CashRegisterPage() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [noRegister, setNoRegister] = useState(false);

    const loadSession = useCallback(() => {
        setLoading(true);
        getCurrentSession(DEFAULT_REGISTER_ID)
            .then(r => {
                const currentSession = getPayload(r);
                setSession(currentSession?.id ? currentSession : null);
                setNoRegister(false);
            })
            .catch(err => {
                if (err?.response?.status === 404) {
                    setSession(null);
                    setNoRegister(false);
                } else {
                    setNoRegister(true);
                }
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        loadSession();
    }, [loadSession]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-10 w-10 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
            </div>
        );
    }

    if (noRegister) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <AlertCircle size={36} className="text-gray-400" />
                <p className="text-gray-500">No se pudo conectar con la caja registradora.</p>
            </div>
        );
    }

    return (
        <div className="p-4">
            {session ? (
                <ActiveSessionView
                    session={session}
                    onClosed={() => setSession(null)}
                />
            ) : (
                <OpenCashView onOpened={(s) => setSession(s)} />
            )}
        </div>
    );
}
