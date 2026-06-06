import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';

export default function UserFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const isEdit = Boolean(id);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'recepcionista',
        codigo: '',
        registro_senescyt: '',
    });

    useEffect(() => {
        if (!isEdit) return;

        client.get(`/users/${id}`).then(r => {
            const u = r.data;
            setForm({
                name: u.name || '',
                email: u.email || '',
                password: '',
                role: u.roles?.[0] || 'recepcionista',
                codigo: u.codigo || '',
                registro_senescyt: u.registro_senescyt || '',
            });
        }).catch(() => navigate('/usuarios'));
    }, [id, isEdit, navigate]);

    const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { ...form };
            if (!payload.password) delete payload.password;
            if (isEdit) {
                await client.put(`/users/${id}`, payload);
                addToast('Usuario actualizado', 'success');
            } else {
                await client.post('/users', payload);
                addToast('Usuario creado', 'success');
            }
            navigate('/usuarios');
        } catch (err) {
            const errors = err.response?.data?.errors;
            if (errors) {
                addToast(Object.values(errors).flat().join(', '), 'error');
            } else {
                addToast(err.response?.data?.message || 'Error al guardar', 'error');
            }
        } finally {
            setSaving(false);
        }
    };

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
                    label="Nombre completo"
                    required
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    nextFieldId="user-email"
                />
                <Input
                    id="user-email"
                    label="Correo electrónico"
                    type="email"
                    required
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    nextFieldId="user-password"
                />
                <Input
                    id="user-password"
                    label={isEdit ? 'Nueva contraseña (vacío = sin cambio)' : 'Contraseña'}
                    type="password"
                    required={!isEdit}
                    minLength={8}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder={isEdit ? '••••••••' : 'Mínimo 8 caracteres'}
                    nextFieldId="user-role"
                />
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Rol <span className="text-red-500">*</span></label>
                    <select
                        id="user-role"
                        value={form.role}
                        onChange={e => set('role', e.target.value)}
                        className="min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                    >
                        <option value="recepcionista">Recepcionista</option>
                        <option value="optometra">Optómetra</option>
                        <option value="admin">Administrador</option>
                    </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                        label="Código interno"
                        value={form.codigo}
                        onChange={e => set('codigo', e.target.value)}
                        nextFieldId="user-registro"
                    />
                    <Input
                        id="user-registro"
                        label="Registro Senescyt"
                        value={form.registro_senescyt}
                        onChange={e => set('registro_senescyt', e.target.value)}
                    />
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
