import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import client from '../../api/client';
import { getPayload } from '../../api/response';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';

// Mismos valores que App\Enums\Role.
const ROLE_OPTIONS = [
    { value: 'recepcionista', label: 'Recepcionista' },
    { value: 'optometra', label: 'Optómetra' },
    { value: 'vendedor', label: 'Vendedor' },
    { value: 'cajero', label: 'Cajero' },
    { value: 'encargado_lab', label: 'Encargado de Laboratorio' },
    { value: 'admin', label: 'Administrador' },
];

const emptyForm = () => ({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    role: 'recepcionista',
    codigo: '',
    registro_senescyt: '',
    phone: '',
    is_active: true,
});

export default function UserFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const isEdit = Boolean(id);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(isEdit);
    const [errors, setErrors] = useState({});
    const [form, setForm] = useState(emptyForm);

    useEffect(() => {
        if (!isEdit) return;

        setLoading(true);
        // `show` responde `{data: {...}}` (UserResource): leer r.data directo
        // dejaba el formulario en blanco y al guardar se perdian los datos.
        client.get(`/users/${id}`).then(r => {
            const u = getPayload(r);
            setForm({
                ...emptyForm(),
                name: u.name || '',
                email: u.email || '',
                role: u.roles?.[0] || u.role || 'recepcionista',
                codigo: u.codigo || '',
                registro_senescyt: u.registro_senescyt || '',
                phone: u.phone || '',
                is_active: u.is_active ?? true,
            });
        }).catch(() => {
            addToast('No se pudo cargar el usuario', 'error');
            navigate('/usuarios');
        }).finally(() => setLoading(false));
    }, [id, isEdit, navigate, addToast]);

    const set = (field, value) => {
        setForm(f => ({ ...f, [field]: value }));
        setErrors(e => ({ ...e, [field]: undefined }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if ((form.password || form.password_confirmation) && form.password !== form.password_confirmation) {
            setErrors({ password_confirmation: 'La confirmación de contraseña no coincide.' });
            addToast('La confirmación de contraseña no coincide.', 'error');
            return;
        }

        setSaving(true);
        setErrors({});
        try {
            const payload = { ...form };
            if (!payload.password) {
                delete payload.password;
                delete payload.password_confirmation;
            }
            if (!isEdit) delete payload.is_active;

            if (isEdit) {
                await client.put(`/users/${id}`, payload);
                addToast('Usuario actualizado', 'success');
            } else {
                await client.post('/users', payload);
                addToast('Usuario creado', 'success');
            }
            navigate('/usuarios');
        } catch (err) {
            const apiErrors = err.response?.data?.errors;
            if (apiErrors) {
                setErrors(Object.fromEntries(
                    Object.entries(apiErrors).map(([field, messages]) => [field, [].concat(messages)[0]])
                ));
                addToast(Object.values(apiErrors).flat().join(', '), 'error');
            } else {
                addToast(err.response?.data?.message || 'Error al guardar', 'error');
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-6 text-center text-sm text-gray-500">Cargando usuario...</div>;
    }

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto pb-24">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <User size={24} className="text-[#1a2a4a]" />
                    {isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h1>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 space-y-5">
                <Input
                    id="user-name"
                    label="Nombre completo"
                    required
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    error={errors.name}
                    nextFieldId="user-email"
                />
                <Input
                    id="user-email"
                    label="Correo electrónico"
                    type="email"
                    required
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    error={errors.email}
                    nextFieldId="user-password"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                        id="user-password"
                        label={isEdit ? 'Nueva contraseña (vacío = sin cambio)' : 'Contraseña'}
                        type="password"
                        autoComplete="new-password"
                        required={!isEdit}
                        minLength={8}
                        value={form.password}
                        onChange={e => set('password', e.target.value)}
                        placeholder={isEdit ? '••••••••' : 'Mínimo 8, letras y números'}
                        error={errors.password}
                        nextFieldId="user-password-confirmation"
                    />
                    <Input
                        id="user-password-confirmation"
                        label="Confirmar contraseña"
                        type="password"
                        autoComplete="new-password"
                        required={!isEdit || Boolean(form.password)}
                        value={form.password_confirmation}
                        onChange={e => set('password_confirmation', e.target.value)}
                        placeholder="Repita la contraseña"
                        error={errors.password_confirmation}
                        nextFieldId="user-role"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label htmlFor="user-role" className="text-sm font-medium text-gray-700">Rol <span className="text-red-500">*</span></label>
                    <select
                        id="user-role"
                        value={form.role}
                        onChange={e => set('role', e.target.value)}
                        className="min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                    >
                        {ROLE_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    {errors.role && <p className="text-xs text-red-600">{errors.role}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                        label="Código interno"
                        value={form.codigo}
                        onChange={e => set('codigo', e.target.value)}
                        error={errors.codigo}
                        nextFieldId="user-registro"
                    />
                    <Input
                        id="user-registro"
                        label="Registro Senescyt"
                        value={form.registro_senescyt}
                        onChange={e => set('registro_senescyt', e.target.value)}
                        error={errors.registro_senescyt}
                        nextFieldId="user-phone"
                    />
                    <Input
                        id="user-phone"
                        label="Teléfono"
                        type="tel"
                        value={form.phone}
                        onChange={e => set('phone', e.target.value)}
                        error={errors.phone}
                    />
                    {isEdit && (
                        <label className="flex min-h-11 items-center gap-3 self-end rounded-lg border border-gray-200 px-3 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={Boolean(form.is_active)}
                                onChange={e => set('is_active', e.target.checked)}
                                className="h-4 w-4"
                            />
                            Usuario activo
                        </label>
                    )}
                </div>

                <div className="mobile-sticky-actions -mx-5 px-5 py-4 sm:-mx-6 sm:px-6">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button variant="secondary" type="button" onClick={() => navigate(-1)} className="w-full justify-center sm:flex-1">
                            Cancelar
                        </Button>
                        <Button type="submit" loading={saving} className="w-full justify-center sm:flex-1">
                            {isEdit ? 'Guardar cambios' : 'Crear usuario'}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
