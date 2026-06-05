import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    ShoppingCart, CreditCard, Banknote, Building2, Plus, Trash2,
    RotateCcw, FlaskConical, AlertCircle, Search, ChevronDown,
    ChevronUp, CheckCircle, X, Printer, Tag
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import PatientAutocomplete from '../../components/ui/PatientAutocomplete';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import client from '../../api/client';
import {
    createSale, addItemToSale, removeItemFromSale,
    processPayment, cancelSale, getPatientSaleSummary, getSale,
    createLabOrder
} from '../../api/sales';
import { getList, getPayload } from '../../api/response';

const IVA_RATE = 0.15;
const LS_KEY = 'pos_draft';

function fmt(n) {
    return Number(n || 0).toFixed(2);
}

const PAYMENT_METHODS = [
    { key: 'cash', label: 'EFECTIVO', icon: Banknote },
    { key: 'card', label: 'TARJETA', icon: CreditCard },
    { key: 'transfer', label: 'TRANSFERENCIA', icon: Building2 },
];

function getSellableVariant(product) {
    return product?.product_variant
        ?? product?.variant
        ?? product?.variants?.[0]
        ?? (product?.product_id ? product : null);
}

function getSellableName(product) {
    return product?.name
        ?? product?.nombre
        ?? product?.product?.name
        ?? product?.product_name
        ?? product?.display_name
        ?? 'Producto';
}

function getSellablePrice(product) {
    const variant = getSellableVariant(product);
    return Number(variant?.sale_price ?? product?.sale_price ?? product?.price ?? 0);
}

export default function PosPage() {
    const { user } = useAuth();

    // POS state machine: idle | draft | paying | completed
    const [status, setStatus] = useState('idle');
    const [sale, setSale] = useState(null); // sale object from API

    // Patient
    const [patient, setPatient] = useState(null);
    const [patientSummary, setPatientSummary] = useState(null);
    const [recipeOpen, setRecipeOpen] = useState(false);

    // Cart (local items for display; server is source of truth)
    const [cartItems, setCartItems] = useState([]);
    const [editingQty, setEditingQty] = useState(null); // itemId
    const [editingDisc, setEditingDisc] = useState(null); // itemId

    // Product search
    const searchRef = useRef(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const searchWrapRef = useRef(null);

    // Item modal
    const [addModal, setAddModal] = useState({ open: false, product: null });
    const [addQty, setAddQty] = useState(1);
    const [addDisc, setAddDisc] = useState(0);

    // Payment
    const [selectedMethods, setSelectedMethods] = useState([]);
    const [paymentAmounts, setPaymentAmounts] = useState({ cash: '', card: '', transfer: '' });
    const [paymentRefs, setPaymentRefs] = useState({ card: '', transfer: '' });
    const [cashReceived, setCashReceived] = useState('');
    const [isAbono, setIsAbono] = useState(false);
    const [abonoAmount, setAbonoAmount] = useState('');
    const [paymentLoading, setPaymentLoading] = useState(false);

    // Cancel
    const [cancelModal, setCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    // Lab order prompt
    const [labModal, setLabModal] = useState(false);
    const [labForm, setLabForm] = useState({ lab_name: '', notes: '', estimated_days: 7, priority: 'normal' });

    // Completed sale
    const [completedSale, setCompletedSale] = useState(null);

    const [error, setError] = useState('');

    // ── Restore draft from localStorage ──────────────────────────────────
    useEffect(() => {
        try {
            const saved = localStorage.getItem(LS_KEY);
            if (saved) {
                const draft = JSON.parse(saved);
                if (draft.sale && draft.cartItems) {
                    setSale(draft.sale);
                    setCartItems(draft.cartItems);
                    setPatient(draft.patient || null);
                    setStatus('draft');
                }
            }
        } catch (_) { /* ignore */ }
    }, []);

    // Save draft on change
    useEffect(() => {
        if (status === 'draft' && sale) {
            localStorage.setItem(LS_KEY, JSON.stringify({ sale, cartItems, patient }));
        }
    }, [sale, cartItems, patient, status]);

    // ── Keyboard shortcuts ────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'F9') { e.preventDefault(); handlePay(); }
            if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
            if (e.key === 'Escape') { setSearchQuery(''); setSearchOpen(false); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    });

    // Auto-focus search when entering draft
    useEffect(() => {
        if (status === 'draft') {
            setTimeout(() => searchRef.current?.focus(), 100);
        }
    }, [status]);

    // Close search dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (!searchWrapRef.current?.contains(e.target)) setSearchOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Product search ────────────────────────────────────────────────────
    const searchTimeout = useRef(null);
    const handleSearchInput = (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        clearTimeout(searchTimeout.current);
        if (val.length < 2) { setSearchOpen(false); return; }
        searchTimeout.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const res = await client.get('/products', { params: { search: val } });
                setSearchResults(getList(res));
                setSearchOpen(true);
            } catch (_) { setSearchResults([]); }
            finally { setSearchLoading(false); }
        }, 200);
    };

    // Barcode scanner: rapid input + Enter
    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            e.preventDefault();
            // Treat as barcode scan — search by exact barcode
            client.get(`/products/barcode/${searchQuery.trim()}`)
                .then(res => {
                    const found = getPayload(res);
                    const products = found ? [found] : [];
                    if (products.length === 1) {
                        openAddModal(products[0]);
                        setSearchQuery('');
                        setSearchOpen(false);
                    } else {
                        setSearchResults(products);
                        setSearchOpen(true);
                    }
                }).catch(() => {});
        }
    };

    // ── Sale lifecycle ────────────────────────────────────────────────────
    const handleStartSale = async () => {
        setError('');
        try {
            const res = await createSale({ patient_id: patient?.id });
            setSale(getPayload(res));
            setCartItems([]);
            setStatus('draft');
        } catch (err) {
            setError(err.response?.data?.message || 'Error al iniciar la venta');
        }
    };

    const handleSelectPatient = async (p) => {
        setPatient(p);
        try {
            const res = await getPatientSaleSummary(p.id);
            setPatientSummary(getPayload(res));
        } catch (_) { setPatientSummary(null); }
    };

    // ── Add to cart ───────────────────────────────────────────────────────
    const openAddModal = (product) => {
        setAddModal({ open: true, product });
        setAddQty(1);
        setAddDisc(0);
    };

    const handleConfirmAdd = async () => {
        if (!sale) return;
        const product = addModal.product;
        const variant = getSellableVariant(product);
        if (!variant?.id) {
            setError('Este producto no tiene una variante vendible');
            setAddModal({ open: false, product: null });
            return;
        }
        try {
            await addItemToSale(sale.id, {
                product_variant_id: variant.id,
                description: getSellableName(product),
                quantity: addQty,
                unit_price: getSellablePrice(product),
                discount_pct: addDisc,
            });
            const saleRes = await getSale(sale.id);
            const updatedSale = getPayload(saleRes);
            // Refresh cart from updated sale
            setCartItems(updatedSale.items || []);
            setSale(updatedSale);
        } catch (err) {
            setError(err.response?.data?.message || 'Error al agregar producto');
        }
        setAddModal({ open: false, product: null });
        setSearchQuery('');
        setTimeout(() => searchRef.current?.focus(), 50);
    };

    // ── Remove from cart ──────────────────────────────────────────────────
    const handleRemoveItem = async (itemId) => {
        if (!sale) return;
        try {
            await removeItemFromSale(sale.id, itemId);
            const saleRes = await getSale(sale.id);
            const updatedSale = getPayload(saleRes);
            setCartItems(updatedSale.items || []);
            setSale(updatedSale);
        } catch (err) {
            setError(err.response?.data?.message || 'Error al eliminar ítem');
        }
    };

    // ── Inline edit quantity/discount ────────────────────────────────────
    const handleInlineUpdate = async (item, field, value) => {
        if (!sale) return;
        const payload = {
            product_variant_id: item.product_variant_id,
            description: item.description || item.product_name || item.name || 'Producto',
            quantity: field === 'quantity' ? Number(value) : item.quantity,
            unit_price: item.unit_price,
            discount_pct: field === 'discount_percent' ? Number(value) : (item.discount_pct ?? item.discount_percent ?? 0),
        };
        try {
            // Remove and re-add is the common pattern if no PATCH endpoint
            await removeItemFromSale(sale.id, item.id);
            await addItemToSale(sale.id, payload);
            const saleRes = await getSale(sale.id);
            const updatedSale = getPayload(saleRes);
            setCartItems(updatedSale.items || []);
            setSale(updatedSale);
        } catch (err) {
            setError(err.response?.data?.message || 'Error al actualizar ítem');
        }
        setEditingQty(null);
        setEditingDisc(null);
    };

    // ── Totals ────────────────────────────────────────────────────────────
    const subtotal = cartItems.reduce((acc, item) => {
        const line = item.unit_price * item.quantity;
        const discountPct = item.discount_pct ?? item.discount_percent ?? 0;
        const disc = line * (discountPct / 100);
        return acc + line - disc;
    }, 0);
    const totalDiscount = cartItems.reduce((acc, item) => {
        const discountPct = item.discount_pct ?? item.discount_percent ?? 0;
        return acc + item.unit_price * item.quantity * (discountPct / 100);
    }, 0);
    const iva = subtotal * IVA_RATE;
    const total = subtotal + iva;
    const prevBalance = patientSummary?.pending_balance ?? patientSummary?.saldo_pendiente ?? 0;

    const cashChange = selectedMethods.includes('cash')
        ? Math.max(0, Number(cashReceived || 0) - (isAbono ? Number(abonoAmount || 0) : total))
        : 0;

    // ── Payment ───────────────────────────────────────────────────────────
    const toggleMethod = (key) => {
        setSelectedMethods(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handlePay = async () => {
        if (status !== 'draft' || cartItems.length === 0) return;
        if (selectedMethods.length === 0) {
            setError('Selecciona al menos un método de pago');
            return;
        }
        setError('');
        setPaymentLoading(true);
        try {
            const amountDue = isAbono ? Number(abonoAmount || 0) : total;
            const payments = selectedMethods.map(method => ({
                method,
                amount: amountDue / selectedMethods.length,
                reference: paymentRefs[method] || null,
            }));

            for (const payment of payments) {
                await processPayment(sale.id, payment);
            }
            const finalSaleRes = await getSale(sale.id);
            const finishedSale = getPayload(finalSaleRes);
            setCompletedSale(finishedSale);
            setStatus('completed');
            localStorage.removeItem(LS_KEY);

            if (finishedSale.requires_lab_order) {
                setLabModal(true);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error al procesar el pago');
        } finally {
            setPaymentLoading(false);
        }
    };

    // ── Cancel ────────────────────────────────────────────────────────────
    const handleCancel = async () => {
        if (!sale) return;
        try {
            await cancelSale(sale.id, { reason: cancelReason });
            resetPOS();
        } catch (err) {
            setError(err.response?.data?.message || 'Error al cancelar la venta');
        }
        setCancelModal(false);
    };

    // ── Lab order ─────────────────────────────────────────────────────────
    const handleCreateLabOrder = async () => {
        try {
            await createLabOrder({
                sale_id: completedSale?.id,
                patient_id: patient?.id,
                ...labForm,
            });
        } catch (_) {}
        setLabModal(false);
    };

    // ── Reset ─────────────────────────────────────────────────────────────
    const resetPOS = () => {
        setSale(null);
        setCartItems([]);
        setPatient(null);
        setPatientSummary(null);
        setCompletedSale(null);
        setSelectedMethods([]);
        setPaymentAmounts({ cash: '', card: '', transfer: '' });
        setCashReceived('');
        setIsAbono(false);
        setAbonoAmount('');
        setCancelReason('');
        setSearchQuery('');
        setStatus('idle');
        localStorage.removeItem(LS_KEY);
    };

    // ── RENDER: Completed ─────────────────────────────────────────────────
    if (status === 'completed') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
                <div className="bg-white rounded-2xl shadow-xl p-10 max-w-lg w-full text-center">
                    <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Venta completada</h2>
                    <p className="text-gray-500 mb-1">Venta #{completedSale?.sale_number || completedSale?.id}</p>
                    <p className="text-3xl font-bold text-green-600 mb-6">${fmt(total)}</p>
                    {completedSale?.change > 0 && (
                        <p className="text-lg text-gray-700 mb-4">Vuelto: <span className="font-semibold">${fmt(completedSale.change)}</span></p>
                    )}
                    <div className="flex gap-3 justify-center flex-wrap">
                        <Button variant="secondary" onClick={() => window.print()}>
                            <Printer size={16} /> Imprimir recibo
                        </Button>
                        <Button variant="success" onClick={resetPOS}>
                            <Plus size={16} /> Nueva venta
                        </Button>
                    </div>
                </div>

                {/* Lab order modal */}
                <Modal open={labModal} onClose={() => setLabModal(false)} title="Crear orden de laboratorio" size="md">
                    <p className="text-gray-600 mb-4">Esta venta requiere una orden de laboratorio. ¿Deseas crearla ahora?</p>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Laboratorio</label>
                            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                                value={labForm.lab_name} onChange={e => setLabForm(p => ({ ...p, lab_name: e.target.value }))} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                                value={labForm.notes} onChange={e => setLabForm(p => ({ ...p, notes: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Días estimados</label>
                                <input type="number" min={1} className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    value={labForm.estimated_days} onChange={e => setLabForm(p => ({ ...p, estimated_days: Number(e.target.value) }))} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                                <select className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    value={labForm.priority} onChange={e => setLabForm(p => ({ ...p, priority: e.target.value }))}>
                                    <option value="normal">Normal</option>
                                    <option value="urgent">Urgente</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end mt-4">
                            <Button variant="ghost" onClick={() => setLabModal(false)}>Omitir</Button>
                            <Button variant="primary" onClick={handleCreateLabOrder}>
                                <FlaskConical size={16} /> Crear orden
                            </Button>
                        </div>
                    </div>
                </Modal>
            </div>
        );
    }

    // ── RENDER: Idle ──────────────────────────────────────────────────────
    if (status === 'idle') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 gap-6">
                <div className="text-center">
                    <ShoppingCart size={56} className="text-[#1a2a4a] mx-auto mb-4" />
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Punto de Venta</h1>
                    <p className="text-gray-500">Selecciona un cliente o inicia directamente</p>
                </div>
                {/* Optional: pre-select patient before starting */}
                <div className="w-full max-w-md">
                    <PatientAutocomplete onSelect={handleSelectPatient} placeholder="Buscar cliente (opcional)..." />
                    {patient && (
                        <div className="mt-2 p-3 bg-blue-50 rounded-xl flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#1a2a4a] rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {patient.nombre?.[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900">{patient.nombre}</p>
                                <p className="text-xs text-gray-500">CI: {patient.cedula}</p>
                            </div>
                            <button onClick={() => setPatient(null)} className="text-gray-400 hover:text-red-500">
                                <X size={16} />
                            </button>
                        </div>
                    )}
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <Button size="lg" variant="success" className="text-xl px-12 py-5" onClick={handleStartSale}>
                    <ShoppingCart size={24} /> INICIAR VENTA
                </Button>
            </div>
        );
    }

    // ── RENDER: Draft / Paying ────────────────────────────────────────────
    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden" style={{ flex: '0 0 60%' }}>
                {/* Header */}
                <div className="bg-[#1a2a4a] text-white px-6 py-3 flex items-center gap-4 flex-shrink-0">
                    <ShoppingCart size={20} />
                    <div className="flex-1">
                        <span className="font-semibold">{user?.name}</span>
                        <span className="mx-2 opacity-40">|</span>
                        <span className="text-blue-200 text-sm">Venta #{sale?.sale_number || sale?.id || '---'}</span>
                    </div>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">DRAFT</span>
                </div>

                {/* Patient selector */}
                <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
                    {!patient ? (
                        <PatientAutocomplete onSelect={handleSelectPatient} />
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#1a2a4a] rounded-full flex items-center justify-center text-white font-bold">
                                    {patient.nombre?.[0]?.toUpperCase()}
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-900">{patient.nombre}</p>
                                    <p className="text-sm text-gray-500">CI: {patient.cedula} · Tel: {patient.telefono || '—'}</p>
                                </div>
                                {prevBalance > 0 && (
                                    <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
                                        Saldo: ${fmt(prevBalance)}
                                    </span>
                                )}
                                <button onClick={() => { setPatient(null); setPatientSummary(null); }} className="text-gray-400 hover:text-red-500 ml-2">
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Receta activa */}
                            {patientSummary?.recent_prescription && (
                                <div className="border border-blue-200 rounded-xl overflow-hidden">
                                    <button
                                        className="w-full flex items-center justify-between px-4 py-2 bg-blue-50 text-blue-800 text-sm font-medium"
                                        onClick={() => setRecipeOpen(o => !o)}
                                    >
                                        <span>Receta activa ({patientSummary.recent_prescription.fecha})</span>
                                        {recipeOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                    {recipeOpen && (
                                        <div className="px-4 py-3 bg-white text-xs">
                                            <table className="w-full text-center">
                                                <thead>
                                                    <tr className="text-gray-500">
                                                        <th></th>
                                                        <th>Esf</th><th>Cil</th><th>Eje</th><th>Adi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {['od', 'oi'].map(eye => (
                                                        <tr key={eye}>
                                                            <td className="font-bold text-gray-700 uppercase pr-2">{eye}</td>
                                                            <td>{patientSummary.recent_prescription[eye]?.esfera ?? '—'}</td>
                                                            <td>{patientSummary.recent_prescription[eye]?.cilindro ?? '—'}</td>
                                                            <td>{patientSummary.recent_prescription[eye]?.eje ?? '—'}</td>
                                                            <td>{patientSummary.recent_prescription[eye]?.adicion ?? '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Product search */}
                <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0" ref={searchWrapRef}>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        {searchLoading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            </div>
                        )}
                        <input
                            ref={searchRef}
                            type="text"
                            value={searchQuery}
                            onChange={handleSearchInput}
                            onKeyDown={handleSearchKeyDown}
                            placeholder="Buscar por nombre, SKU o escanear código... (F2)"
                            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-base"
                        />
                        {searchOpen && searchResults.length > 0 && (
                            <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 overflow-hidden max-h-64 overflow-y-auto">
                            {searchResults.map(p => (
                                <li
                                    key={p.id}
                                    onClick={() => { openAddModal(p); setSearchOpen(false); }}
                                        className="flex items-center justify-between px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                                    >
                                        <div>
                                            <p className="font-medium text-gray-900">{getSellableName(p)}</p>
                                            <p className="text-xs text-gray-500">SKU: {getSellableVariant(p)?.sku || p.sku || '—'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-green-700">${fmt(getSellablePrice(p))}</p>
                                            <p className="text-xs text-gray-400">Stock: {p.stock ?? p.stock_total ?? '?'}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {searchOpen && searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
                            <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 p-4 text-center text-gray-500 text-sm">
                                Sin resultados para "{searchQuery}"
                            </div>
                        )}
                    </div>
                </div>

                {/* Cart table */}
                <div className="flex-1 overflow-y-auto bg-white">
                    {cartItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 py-16">
                            <ShoppingCart size={40} className="opacity-30" />
                            <p className="text-base">Carrito vacío — busca un producto o escanea un código</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Producto</th>
                                    <th className="text-center px-3 py-3 font-semibold text-gray-600">Cant.</th>
                                    <th className="text-right px-3 py-3 font-semibold text-gray-600">P. Unit.</th>
                                    <th className="text-center px-3 py-3 font-semibold text-gray-600">Desc.%</th>
                                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Subtotal</th>
                                    <th className="w-10 px-2 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {cartItems.map(item => {
                                    const discountPct = item.discount_pct ?? item.discount_percent ?? 0;
                                    const lineSubtotal = item.unit_price * item.quantity * (1 - discountPct / 100);
                                    return (
                                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-gray-900">{item.product_variant?.product?.name || item.product?.name || item.description || item.product_name || item.name}</p>
                                                <p className="text-xs text-gray-400">{item.product_variant?.sku || item.product?.sku || item.sku}</p>
                                            </td>
                                            {/* Inline qty */}
                                            <td className="text-center px-3 py-3">
                                                {editingQty === item.id ? (
                                                    <input
                                                        type="number" min={1}
                                                        defaultValue={item.quantity}
                                                        autoFocus
                                                        className="w-16 text-center border border-blue-400 rounded px-1 py-0.5"
                                                        onBlur={e => handleInlineUpdate(item, 'quantity', e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleInlineUpdate(item, 'quantity', e.target.value)}
                                                    />
                                                ) : (
                                                    <span
                                                        className="cursor-pointer hover:bg-blue-100 px-2 py-1 rounded font-semibold"
                                                        onClick={() => setEditingQty(item.id)}
                                                    >{item.quantity}</span>
                                                )}
                                            </td>
                                            <td className="text-right px-3 py-3 text-gray-700">${fmt(item.unit_price)}</td>
                                            {/* Inline discount */}
                                            <td className="text-center px-3 py-3">
                                                {editingDisc === item.id ? (
                                                    <input
                                                        type="number" min={0} max={100}
                                                        defaultValue={discountPct}
                                                        autoFocus
                                                        className="w-16 text-center border border-blue-400 rounded px-1 py-0.5"
                                                        onBlur={e => handleInlineUpdate(item, 'discount_percent', e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleInlineUpdate(item, 'discount_percent', e.target.value)}
                                                    />
                                                ) : (
                                                    <span
                                                        className={`cursor-pointer hover:bg-blue-100 px-2 py-1 rounded ${discountPct > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}
                                                        onClick={() => setEditingDisc(item.id)}
                                                    >{discountPct}%</span>
                                                )}
                                            </td>
                                            <td className="text-right px-4 py-3 font-semibold text-gray-900">${fmt(lineSubtotal)}</td>
                                            <td className="px-2 py-3">
                                                <button onClick={() => handleRemoveItem(item.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Cart footer total */}
                {cartItems.length > 0 && (
                    <div className="bg-[#1a2a4a] text-white px-6 py-3 flex items-center justify-between flex-shrink-0">
                        <span className="text-blue-200">{cartItems.length} producto(s)</span>
                        <span className="text-xl font-bold">TOTAL: ${fmt(total)}</span>
                    </div>
                )}
            </div>

            {/* ── RIGHT COLUMN ────────────────────────────────────────── */}
            <div className="flex flex-col bg-white border-l border-gray-200 overflow-y-auto" style={{ flex: '0 0 40%' }}>
                {/* Totals summary */}
                <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Resumen</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Subtotal</span>
                            <span className="font-medium">${fmt(subtotal + totalDiscount)}</span>
                        </div>
                        {totalDiscount > 0 && (
                            <div className="flex justify-between text-red-600">
                                <span>Descuentos</span>
                                <span>-${fmt(totalDiscount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-gray-600">IVA (15%)</span>
                            <span>${fmt(iva)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold text-green-700 border-t pt-2 mt-1">
                            <span>TOTAL</span>
                            <span>${fmt(total)}</span>
                        </div>
                        {prevBalance > 0 && (
                            <div className="flex justify-between text-red-600 text-sm">
                                <span>Saldo anterior</span>
                                <span>${fmt(prevBalance)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Payment methods */}
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Método de pago</h3>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {PAYMENT_METHODS.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => toggleMethod(key)}
                                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-xs font-semibold
                                    ${selectedMethods.includes(key)
                                        ? 'border-[#1a2a4a] bg-[#1a2a4a] text-white'
                                        : 'border-gray-200 text-gray-600 hover:border-[#1a2a4a]'}`}
                            >
                                <Icon size={22} />
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Cash: received + change */}
                    {selectedMethods.includes('cash') && (
                        <div className="space-y-2 mb-3">
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600 w-24">Recibido:</label>
                                <input
                                    type="number" min={0} step="0.01"
                                    value={cashReceived}
                                    onChange={e => setCashReceived(e.target.value)}
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                                    placeholder={fmt(total)}
                                />
                            </div>
                            {Number(cashReceived) > 0 && (
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-gray-600 w-24">Vuelto:</label>
                                    <span className={`font-bold text-base ${cashChange >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                        ${fmt(cashChange)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Card/Transfer reference */}
                    {(selectedMethods.includes('card') || selectedMethods.includes('transfer')) && (
                        <div className="space-y-2 mb-3">
                            {selectedMethods.filter(m => m !== 'cash').map(method => (
                                <div key={method} className="flex items-center gap-2">
                                    <label className="text-sm text-gray-600 w-24 capitalize">Ref. {method === 'card' ? 'tarjeta' : 'transf.'}:</label>
                                    <input
                                        type="text"
                                        value={paymentRefs[method] || ''}
                                        onChange={e => setPaymentRefs(p => ({ ...p, [method]: e.target.value }))}
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                                        placeholder="Número de referencia"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Abono toggle */}
                    <div className="flex items-center gap-3 mt-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={isAbono} onChange={e => setIsAbono(e.target.checked)} className="sr-only peer" />
                            <div className="w-9 h-5 bg-gray-200 peer-checked:bg-[#1a2a4a] rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                        </label>
                        <span className="text-sm text-gray-700">¿Es abono?</span>
                        {isAbono && (
                            <input
                                type="number" min={0} step="0.01"
                                value={abonoAmount}
                                onChange={e => setAbonoAmount(e.target.value)}
                                className="ml-auto w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                placeholder="Monto abono"
                            />
                        )}
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mx-6 mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                        <AlertCircle size={16} className="flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* Action buttons */}
                <div className="px-6 py-5 mt-auto space-y-3">
                    <button
                        onClick={handlePay}
                        disabled={paymentLoading || cartItems.length === 0 || selectedMethods.length === 0}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-2xl font-bold py-5 rounded-2xl transition-colors flex items-center justify-center gap-3"
                    >
                        {paymentLoading ? (
                            <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        ) : <CreditCard size={28} />}
                        COBRAR (F9)
                    </button>

                    <div className="flex gap-2">
                        <Button variant="ghost" className="flex-1" onClick={resetPOS}>
                            <RotateCcw size={16} /> Nueva venta
                        </Button>
                        <Button variant="danger" className="flex-1" onClick={() => setCancelModal(true)}>
                            <X size={16} /> Cancelar venta
                        </Button>
                    </div>
                    <p className="text-center text-xs text-gray-400">F9: Cobrar · F2: Enfocar búsqueda · Esc: Limpiar búsqueda</p>
                </div>
            </div>

            {/* ── Add product modal ────────────────────────────────────── */}
            <Modal open={addModal.open} onClose={() => setAddModal({ open: false, product: null })} title="Agregar producto" size="sm">
                {addModal.product && (
                    <div className="space-y-4">
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="font-semibold text-gray-900 text-lg">{addModal.product.name || addModal.product.nombre}</p>
                            <p className="text-sm text-gray-500">SKU: {getSellableVariant(addModal.product)?.sku || addModal.product.sku || '—'} · Precio: ${fmt(getSellablePrice(addModal.product))}</p>
                            <p className="text-sm text-gray-500">Stock disponible: {addModal.product.stock ?? '?'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                                <input
                                    type="number" min={1}
                                    value={addQty}
                                    onChange={e => setAddQty(Number(e.target.value))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descuento %</label>
                                <input
                                    type="number" min={0} max={100}
                                    value={addDisc}
                                    onChange={e => setAddDisc(Number(e.target.value))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                                />
                            </div>
                        </div>
                        <div className="bg-green-50 rounded-xl p-3 text-center">
                            <p className="text-sm text-gray-500">Subtotal</p>
                            <p className="text-2xl font-bold text-green-700">
                                ${fmt(getSellablePrice(addModal.product) * addQty * (1 - addDisc / 100))}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="ghost" className="flex-1" onClick={() => setAddModal({ open: false, product: null })}>
                                Cancelar
                            </Button>
                            <Button variant="success" className="flex-1" onClick={handleConfirmAdd}>
                                <Plus size={16} /> Agregar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── Cancel modal ─────────────────────────────────────────── */}
            <Modal open={cancelModal} onClose={() => setCancelModal(false)} title="Cancelar venta" size="sm">
                <div className="space-y-4">
                    <p className="text-gray-600">¿Estás seguro de que deseas cancelar esta venta? Esta acción no se puede deshacer.</p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de cancelación</label>
                        <textarea
                            rows={3}
                            value={cancelReason}
                            onChange={e => setCancelReason(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                            placeholder="Ingresa el motivo..."
                        />
                    </div>
                    <div className="flex gap-3">
                        <Button variant="ghost" className="flex-1" onClick={() => setCancelModal(false)}>Volver</Button>
                        <Button variant="danger" className="flex-1" onClick={handleCancel}>
                            <Trash2 size={16} /> Confirmar cancelación
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
