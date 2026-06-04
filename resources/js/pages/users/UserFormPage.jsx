import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
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
        if (isEdit) {
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
        }
    }, [id, isEdit]);

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
        <div className="p-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <User size={24} className="text-[#1a2a4a]" />
                    {isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h1>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo <span className="text-red-500">*</span></label>
                    <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico <span className="text-red-500">*</span></label>
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        {isEdit ? 'Nueva contraseña (vacío = sin cambio)' : 'Contraseña'} {!isEdit && <span className="text-red-500">*</span>}
                    </label>
                    <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                        required={!isEdit} minLength={8} placeholder={isEdit ? '••••••••' : 'Mínimo 8 caracteres'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rol <span className="text-red-500">*</span></label>
                    <select value={form.role} onChange={e => set('role', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]">
                        <option value="recepcionista">Recepcionista</option>
                        <option value="optometra">Optómetra</option>
                        <option value="admin">Administrador</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Código interno</label>
                        <input type="text" value={form.codigo} onChange={e => set('codigo', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Registro Senescyt</label>
                        <input type="text" value={form.registro_senescyt} onChange={e => set('registro_senescyt', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                    <Button variant="secondary" type="button" onClick={() => navigate(-1)}>Cancelar</Button>
                    <Button type="submit" loading={saving}>{isEdit ? 'Guardar cambios' : 'Crear usuario'}</Button>
                </div>
            </form>
        </div>
    );
}
