import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, RefreshCw, Warehouse, Package } from 'lucide-react';
import {
    getProduct,
    getProductVariants,
    createVariant,
    updateVariant,
    getInventoryMovements,
    adjustStock,
    transferStock,
} from '../../api/inventory';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import StockBadge from '../../components/ui/StockBadge';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { getList, getPayload } from '../../api/response';

const CATEGORY_LABELS = {
    armazon: 'Armazón',
    luna: 'Luna',
    lente_contacto: 'Lente de Contacto',
    accesorio: 'Accesorio',
    servicio: 'Servicio',
};

// ── Formulario de Variante ──────────────────────────────────────────────────
function VariantForm({ category, initial, onSave, onCancel, saving }) {
    const [form, setForm] = useState(initial ?? {
        sku: '', color: '', talla: '', material: '', genero: '', forma: '',
        tipo: '', indice: '', tratamiento: '',
        curva_base: '', diametro: '', potencia: '', duracion: '',
        precio_costo: '', precio_venta: '', barcode: '',
        stock_inicial: 0, bodega: '', activo: true,
    });

    const set = (f) => (e) => {
        const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setForm(prev => ({ ...prev, [f]: v }));
    };

    const field = (label, name, type = 'text', required = false, placeholder = '') => (
        <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
            <input
                type={type}
                value={form[name] ?? ''}
                onChange={set(name)}
                required={required}
                placeholder={placeholder}
                className="py-2 px-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm bg-white"
            />
        </div>
    );

    return (
        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                {field('SKU Variante', 'sku', 'text', false, 'Ej: ARM-AZUL-M')}
                {field('Código de barras', 'barcode', 'text', false)}
                {field('Precio Costo', 'precio_costo', 'number', false, '0.00')}
                {field('Precio Venta', 'precio_venta', 'number', false, '0.00')}

                {/* Armazón */}
                {category === 'armazon' && <>
                    {field('Color', 'color')}
                    {field('Talla', 'talla')}
                    {field('Material', 'material')}
                    {field('Género', 'genero')}
                    {field('Forma', 'forma')}
                    {field('Stock inicial', 'stock_inicial', 'number')}
                    {field('Bodega', 'bodega')}
                </>}

                {/* Luna */}
                {category === 'luna' && <>
                    {field('Tipo', 'tipo')}
                    {field('Material', 'material')}
                    {field('Índice', 'indice')}
                    {field('Tratamiento', 'tratamiento')}
                </>}

                {/* Lente de contacto */}
                {category === 'lente_contacto' && <>
                    {field('Curva base', 'curva_base')}
                    {field('Diámetro', 'diametro')}
                    {field('Potencia', 'potencia')}
                    {field('Duración', 'duracion', 'text', false, 'Ej: Mensual, Diario...')}
                </>}

                {/* Genérico: color, talla */}
                {!['armazon', 'luna', 'lente_contacto'].includes(category) && <>
                    {field('Color', 'color')}
                    {field('Talla', 'talla')}
                    {field('Stock inicial', 'stock_inicial', 'number')}
                </>}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.activo} onChange={set('activo')} className="w-4 h-4" />
                <span className="text-sm text-gray-700">Variante activa</span>
            </label>

            <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
                <Button type="submit" loading={saving}>Guardar variante</Button>
            </div>
        </form>
    );
}

// ── Formulario Ajuste de Stock ──────────────────────────────────────────────
function AdjustForm({ variantId, onSave, onCancel, saving }) {
    const [qty, setQty] = useState('');
    const [nota, setNota] = useState('');

    return (
        <form onSubmit={e => { e.preventDefault(); onSave({ variant_id: variantId, cantidad: qty, nota }); }} className="space-y-4">
            <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Nueva cantidad <span className="text-red-500">*</span></label>
                <input
                    type="number"
                    min="0"
                    required
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="py-2.5 px-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm"
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Nota <span className="text-red-500">*</span></label>
                <textarea
                    required
                    value={nota}
                    onChange={e => setNota(e.target.value)}
                    placeholder="Motivo del ajuste..."
                    rows={3}
                    className="py-2.5 px-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm resize-none"
                />
            </div>
            <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
                <Button type="submit" loading={saving}>Aplicar ajuste</Button>
            </div>
        </form>
    );
}

// ── Formulario Transferencia ────────────────────────────────────────────────
function TransferForm({ variantId, onSave, onCancel, saving }) {
    const [form, setForm] = useState({ variant_id: variantId, bodega_origen: '', bodega_destino: '', cantidad: '', nota: '' });
    const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

    return (
        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Bodega origen <span className="text-red-500">*</span></label>
                    <input required value={form.bodega_origen} onChange={set('bodega_origen')} className="py-2 px-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Bodega destino <span className="text-red-500">*</span></label>
                    <input required value={form.bodega_destino} onChange={set('bodega_destino')} className="py-2 px-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm" />
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Cantidad <span className="text-red-500">*</span></label>
                <input type="number" min="1" required value={form.cantidad} onChange={set('cantidad')} className="py-2 px-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm" />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Nota</label>
                <textarea value={form.nota} onChange={set('nota')} rows={2} className="py-2 px-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm resize-none" />
            </div>
            <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
                <Button type="submit" loading={saving}>Transferir</Button>
            </div>
        </form>
    );
}

// ── Página principal ────────────────────────────────────────────────────────
export default function ProductDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { user } = useAuth();

    const canViewCost = user?.permissions?.includes('sales.view_cost_price') ?? false;

    const [product, setProduct] = useState(null);
    const [variants, setVariants] = useState([]);
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('variantes');

    // Modales
    const [variantModal, setVariantModal] = useState(false);
    const [editingVariant, setEditingVariant] = useState(null);
    const [adjustModal, setAdjustModal] = useState(null); // variantId
    const [transferModal, setTransferModal] = useState(null);
    const [modalSaving, setModalSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            const [prodRes, varRes] = await Promise.all([
                getProduct(id),
                getProductVariants(id),
            ]);
            setProduct(getPayload(prodRes));
            setVariants(getList(varRes));
        } catch {
            addToast('Error al cargar el producto', 'error');
        } finally {
            setLoading(false);
        }
    }, [id]);

    const loadMovements = useCallback(async () => {
        try {
            const res = await getInventoryMovements({ product_id: id });
            setMovements(getList(res));
        } catch {
            addToast('Error al cargar movimientos', 'error');
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (tab === 'movimientos') loadMovements();
    }, [tab, loadMovements]);

    const handleSaveVariant = async (data) => {
        setModalSaving(true);
        const payload = {
            sku: data.sku,
            barcode: data.barcode || null,
            color: data.color || null,
            size: data.talla || data.size || null,
            material: data.material || null,
            gender: data.genero || data.gender || null,
            frame_shape: data.forma || data.frame_shape || null,
            lens_type: data.tipo || data.lens_type || null,
            lens_index: data.indice || data.lens_index || null,
            lens_treatment: data.tratamiento || data.lens_treatment || null,
            base_curve: data.curva_base || data.base_curve || null,
            lens_diameter: data.diametro || data.lens_diameter || null,
            lens_power: data.potencia || data.lens_power || null,
            lens_duration: data.duracion || data.lens_duration || null,
            cost_price: data.precio_costo ?? data.cost_price ?? 0,
            sale_price: data.precio_venta ?? data.sale_price ?? 0,
            initial_stock: data.stock_inicial ?? data.initial_stock ?? 0,
            warehouse_id: data.warehouse_id || null,
            is_active: data.activo ?? data.is_active ?? true,
        };
        try {
            if (editingVariant) {
                await updateVariant(id, editingVariant.id, payload);
                addToast('Variante actualizada', 'success');
            } else {
                await createVariant(id, payload);
                addToast('Variante creada', 'success');
            }
            setVariantModal(false);
            setEditingVariant(null);
            load();
        } catch (err) {
            addToast(err.response?.data?.message ?? 'Error al guardar la variante', 'error');
        } finally {
            setModalSaving(false);
        }
    };

    const handleAdjust = async (data) => {
        setModalSaving(true);
        const payload = {
            product_variant_id: data.variant_id,
            warehouse_id: data.warehouse_id,
            new_quantity: data.cantidad,
            notes: data.nota,
        };
        try {
            await adjustStock(payload);
            addToast('Stock ajustado correctamente', 'success');
            setAdjustModal(null);
            load();
        } catch (err) {
            addToast(err.response?.data?.message ?? 'Error al ajustar stock', 'error');
        } finally {
            setModalSaving(false);
        }
    };

    const handleTransfer = async (data) => {
        setModalSaving(true);
        const payload = {
            product_variant_id: data.variant_id,
            from_warehouse_id: data.from_warehouse_id,
            to_warehouse_id: data.to_warehouse_id,
            quantity: data.cantidad,
            notes: data.nota,
        };
        try {
            await transferStock(payload);
            addToast('Transferencia realizada', 'success');
            setTransferModal(null);
            load();
        } catch (err) {
            addToast(err.response?.data?.message ?? 'Error en la transferencia', 'error');
        } finally {
            setModalSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-10 w-10 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!product) return null;

    const category = product.categoria ?? product.category;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/inventario/productos')}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{product.nombre ?? product.name}</h1>
                        <p className="text-gray-500 mt-1 text-sm">
                            SKU: <span className="font-mono font-medium">{product.sku || '—'}</span>
                            {product.marca && <> · <span>{product.marca}</span></>}
                            {category && <> · <span className="capitalize">{CATEGORY_LABELS[category] ?? category}</span></>}
                        </p>
                    </div>
                </div>
                <Link to={`/inventario/productos/${id}/editar`}>
                    <Button variant="secondary">
                        <Edit2 size={16} />
                        Editar producto
                    </Button>
                </Link>
            </div>

            {/* Info del producto */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Descripción', value: product.descripcion ?? product.description ?? '—' },
                    { label: 'Proveedor', value: product.proveedor?.nombre ?? product.supplier?.name ?? '—' },
                    { label: 'Estado', value: product.activo ? 'Activo' : 'Inactivo' },
                ].map(({ label, value }) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{label}</p>
                        <p className="text-sm text-gray-800">{value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 border-b border-gray-200">
                {['variantes', 'movimientos'].map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-5 py-2.5 text-sm font-medium capitalize rounded-t-lg transition-colors ${
                            tab === t
                                ? 'bg-white border border-b-white text-[#1a2a4a] -mb-px'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t === 'variantes' ? 'Variantes' : 'Movimientos'}
                    </button>
                ))}
            </div>

            {/* Tab: Variantes */}
            {tab === 'variantes' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        <p className="font-semibold text-gray-800">Variantes del producto</p>
                        <Button size="sm" onClick={() => { setEditingVariant(null); setVariantModal(true); }}>
                            <Plus size={16} />
                            Nueva variante
                        </Button>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                                <th className="px-4 py-3 text-left">SKU</th>
                                <th className="px-4 py-3 text-left">Color</th>
                                <th className="px-4 py-3 text-left">Talla</th>
                                <th className="px-4 py-3 text-left">Material</th>
                                {canViewCost && <th className="px-4 py-3 text-right">P. Costo</th>}
                                <th className="px-4 py-3 text-right">P. Venta</th>
                                <th className="px-4 py-3 text-center">Stock</th>
                                <th className="px-4 py-3 text-center">Activo</th>
                                <th className="px-4 py-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {variants.length === 0 ? (
                                <tr>
                                    <td colSpan={canViewCost ? 9 : 8} className="py-10 text-center text-gray-400">
                                        <Package size={32} className="mx-auto mb-2 text-gray-300" />
                                        No hay variantes registradas
                                    </td>
                                </tr>
                            ) : variants.map((v, i) => (
                                <tr key={v.id} className={`border-t border-gray-100 hover:bg-blue-50/40 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                                    <td className="px-4 py-3 font-mono text-xs">{v.sku || '—'}</td>
                                    <td className="px-4 py-3">{v.color || '—'}</td>
                                    <td className="px-4 py-3">{v.talla || '—'}</td>
                                    <td className="px-4 py-3">{v.material || '—'}</td>
                                    {canViewCost && (
                                        <td className="px-4 py-3 text-right">{v.precio_costo != null ? `$${Number(v.precio_costo).toFixed(2)}` : '—'}</td>
                                    )}
                                    <td className="px-4 py-3 text-right font-medium">{v.precio_venta != null ? `$${Number(v.precio_venta).toFixed(2)}` : '—'}</td>
                                    <td className="px-4 py-3 text-center">
                                        <StockBadge quantity={v.stock ?? 0} minStock={v.stock_minimo ?? 0} />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-block w-2 h-2 rounded-full ${v.activo ? 'bg-green-500' : 'bg-gray-300'}`} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => { setEditingVariant(v); setVariantModal(true); }}
                                                className="p-1.5 rounded hover:bg-yellow-100 text-yellow-600"
                                                title="Editar"
                                            >
                                                <Edit2 size={15} />
                                            </button>
                                            <button
                                                onClick={() => setAdjustModal(v.id)}
                                                className="p-1.5 rounded hover:bg-blue-100 text-blue-600"
                                                title="Ajustar stock"
                                            >
                                                <RefreshCw size={15} />
                                            </button>
                                            <button
                                                onClick={() => setTransferModal(v.id)}
                                                className="p-1.5 rounded hover:bg-green-100 text-green-600"
                                                title="Transferir"
                                            >
                                                <Warehouse size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Tab: Movimientos */}
            {tab === 'movimientos' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                                <th className="px-4 py-3 text-left">Fecha</th>
                                <th className="px-4 py-3 text-left">Tipo</th>
                                <th className="px-4 py-3 text-center">Cantidad</th>
                                <th className="px-4 py-3 text-left">Usuario</th>
                                <th className="px-4 py-3 text-left">Nota</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movements.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-10 text-center text-gray-400">
                                        No hay movimientos registrados
                                    </td>
                                </tr>
                            ) : movements.map((m, i) => (
                                <tr key={m.id ?? i} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                                    <td className="px-4 py-3 text-gray-600">{m.fecha ?? m.created_at ?? '—'}</td>
                                    <td className="px-4 py-3 capitalize">{m.tipo ?? m.type ?? '—'}</td>
                                    <td className="px-4 py-3 text-center font-medium">
                                        <span className={m.cantidad > 0 ? 'text-green-600' : 'text-red-500'}>
                                            {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{m.usuario?.name ?? m.user?.name ?? '—'}</td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">{m.nota ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal: Nueva / Editar variante */}
            <Modal
                open={variantModal}
                onClose={() => { setVariantModal(false); setEditingVariant(null); }}
                title={editingVariant ? 'Editar variante' : 'Nueva variante'}
                size="lg"
            >
                <VariantForm
                    category={category}
                    initial={editingVariant}
                    onSave={handleSaveVariant}
                    onCancel={() => { setVariantModal(false); setEditingVariant(null); }}
                    saving={modalSaving}
                />
            </Modal>

            {/* Modal: Ajuste de stock */}
            <Modal
                open={Boolean(adjustModal)}
                onClose={() => setAdjustModal(null)}
                title="Ajuste de Stock"
                size="sm"
            >
                <AdjustForm
                    variantId={adjustModal}
                    onSave={handleAdjust}
                    onCancel={() => setAdjustModal(null)}
                    saving={modalSaving}
                />
            </Modal>

            {/* Modal: Transferencia */}
            <Modal
                open={Boolean(transferModal)}
                onClose={() => setTransferModal(null)}
                title="Transferencia de Stock"
                size="md"
            >
                <TransferForm
                    variantId={transferModal}
                    onSave={handleTransfer}
                    onCancel={() => setTransferModal(null)}
                    saving={modalSaving}
                />
            </Modal>
        </div>
    );
}
