import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getProduct, createProduct, updateProduct, getSuppliers } from '../../api/inventory';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { getList, getPayload } from '../../api/response';

const CATEGORIES = [
    { value: 'armazon', label: 'Armazón' },
    { value: 'luna', label: 'Luna' },
    { value: 'lente_contacto', label: 'Lente de Contacto' },
    { value: 'accesorio', label: 'Accesorio' },
    { value: 'servicio', label: 'Servicio' },
];

function slugify(str) {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function suggestSku(nombre, marca) {
    const parts = [nombre, marca].filter(Boolean).map(s => slugify(s).substring(0, 6));
    return parts.join('-').toUpperCase();
}

export default function ProductFormPage() {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [suppliers, setSuppliers] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(isEdit);
    const [skuError, setSkuError] = useState('');

    const [form, setForm] = useState({
        nombre: '',
        sku: '',
        marca: '',
        categoria: '',
        subcategoria: '',
        proveedor_id: '',
        descripcion: '',
        requiere_receta: false,
        tiene_variantes: true,
        controlar_inventario: true,
    });

    useEffect(() => {
        getSuppliers().then(r => setSuppliers(getList(r))).catch(() => {});

        if (!isEdit) return;

        getProduct(id)
            .then(r => {
                const p = getPayload(r);
                setForm({
                    nombre: p.nombre ?? p.name ?? '',
                    sku: p.sku ?? '',
                    marca: p.marca ?? p.brand ?? '',
                    categoria: p.categoria ?? p.category ?? '',
                    subcategoria: p.subcategoria ?? p.subcategory ?? '',
                    proveedor_id: p.proveedor_id ?? p.supplier_id ?? '',
                    descripcion: p.descripcion ?? p.description ?? '',
                    requiere_receta: Boolean(p.requiere_receta ?? p.requires_prescription),
                    tiene_variantes: Boolean(p.tiene_variantes ?? p.has_variants ?? true),
                    controlar_inventario: Boolean(p.controlar_inventario ?? p.track_inventory ?? true),
                });
            })
            .catch(() => addToast('Error al cargar el producto', 'error'))
            .finally(() => setLoading(false));
    }, [id, isEdit, addToast]);

    const set = (field) => (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setForm(prev => {
            const next = { ...prev, [field]: value };
            if ((field === 'nombre' || field === 'marca') && !isEdit) {
                next.sku = suggestSku(next.nombre, next.marca);
            }
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.nombre.trim()) {
            addToast('El nombre del producto es requerido', 'error');
            return;
        }
        setSaving(true);
        const payload = {
            name: form.nombre,
            sku: form.sku,
            brand: form.marca || null,
            category: form.categoria,
            subcategory: form.subcategoria || null,
            supplier_id: form.proveedor_id || null,
            description: form.descripcion || null,
            requires_prescription: form.requiere_receta,
            has_variants: form.tiene_variantes,
            track_inventory: form.controlar_inventario,
        };
        try {
            if (isEdit) {
                await updateProduct(id, payload);
                addToast('Producto actualizado correctamente', 'success');
            } else {
                await createProduct(payload);
                addToast('Producto creado correctamente', 'success');
            }
            navigate('/inventario/productos');
        } catch (err) {
            const msg = err.response?.data?.message ?? 'Error al guardar el producto';
            addToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-10 w-10 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-24">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/inventario/productos')}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {isEdit ? 'Editar Producto' : 'Nuevo Producto'}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {isEdit ? 'Modifica los datos del producto' : 'Completa los datos para registrar el producto'}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 space-y-5">
                    <h2 className="text-base font-semibold text-gray-700 border-b pb-2">Información General</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Nombre del producto"
                            required
                            value={form.nombre}
                            onChange={set('nombre')}
                            placeholder="Ej: Armazón Metalic Pro"
                        />
                        <Input
                            label="SKU"
                            value={form.sku}
                            onChange={set('sku')}
                            onBlur={() => {
                                setSkuError(form.sku.length > 0 && form.sku.length < 3 ? 'El SKU debe tener al menos 3 caracteres' : '');
                            }}
                            error={skuError}
                            placeholder="Ej: ARMAT-MET-PRO"
                            hint="Se sugiere automáticamente basado en nombre y marca"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Marca"
                            value={form.marca}
                            onChange={set('marca')}
                            placeholder="Ej: Ray-Ban, Oakley..."
                        />

                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-gray-700">Categoría</label>
                            <select
                                value={form.categoria}
                                onChange={set('categoria')}
                                className="min-h-11 py-2.5 px-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] bg-white text-sm touch-manipulation"
                            >
                                <option value="">Seleccionar categoría...</option>
                                {CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Subcategoría"
                            value={form.subcategoria}
                            onChange={set('subcategoria')}
                            placeholder="Ej: Deportivos, Fotocromáticos..."
                        />

                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-gray-700">Proveedor</label>
                            <select
                                value={form.proveedor_id}
                                onChange={set('proveedor_id')}
                                className="min-h-11 py-2.5 px-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] bg-white text-sm touch-manipulation"
                            >
                                <option value="">Sin proveedor asignado</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.nombre ?? s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-700">Descripción</label>
                        <textarea
                            value={form.descripcion}
                            onChange={set('descripcion')}
                            placeholder="Descripción opcional del producto..."
                            rows={3}
                            className="min-h-11 py-2.5 px-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] bg-white text-sm resize-none touch-manipulation"
                        />
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 space-y-4">
                    <h2 className="text-base font-semibold text-gray-700 border-b pb-2">Opciones</h2>

                    {[
                        { field: 'requiere_receta', label: 'Requiere receta médica', desc: 'Solo se vende con prescripción del optometrista' },
                        { field: 'tiene_variantes', label: 'Tiene variantes', desc: 'El producto tiene diferentes tallas, colores u opciones' },
                        { field: 'controlar_inventario', label: 'Controlar inventario', desc: 'Llevar conteo de unidades disponibles' },
                    ].map(({ field, label, desc }) => (
                        <label key={field} className="flex items-start gap-3 cursor-pointer">
                            <div className="relative mt-0.5">
                                <input
                                    type="checkbox"
                                    checked={form[field]}
                                    onChange={set(field)}
                                    className="sr-only peer"
                                />
                                <div className="w-10 h-6 bg-gray-200 peer-checked:bg-[#1a2a4a] rounded-full transition-colors" />
                                <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-800">{label}</p>
                                <p className="text-xs text-gray-500">{desc}</p>
                            </div>
                        </label>
                    ))}
                </div>

                <div className="mobile-sticky-actions -mx-5 px-5 py-4 sm:-mx-6 sm:px-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => navigate('/inventario/productos')}
                            className="w-full justify-center sm:w-auto"
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" loading={saving} className="w-full justify-center sm:w-auto">
                            {isEdit ? 'Guardar cambios' : 'Crear producto'}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
