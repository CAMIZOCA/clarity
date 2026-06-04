import React, { useState } from 'react';
import { User, Lock, Save } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';

export default function ProfilePage() {
    const { user, login } = useAuth();
    const { addToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: user?.name || '',
        email: user?.email || '',
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password && form.password !== form.password_confirmation) {
            addToast('Las contraseñas no coinciden', 'error');
            return;
        }
        setSaving(true);
        try {
            const payload = { name: form.name, email: form.email };
            if (form.password) {
                payload.password = form.password;
                payload.current_password = form.current_password;
            }
            await client.put(`/users/${user.id}`, payload);
            addToast('Perfil actualizado correctamente', 'success');
            setForm(f => ({ ...f, current_password: '', password: '', password_confirmation: '' }));
        } catch (err) {
            const errors = err.response?.data?.errors;
            if (errors) addToast(Object.values(errors).flat().join(', '), 'error');
            else addToast(err.response?.data?.message || 'Error al guardar', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#1a2a4a] flex items-center justify-center text-white text-xl font-bold">
                        {user?.name?.[0]?.toUpperCase()}
                    </div>
                    Mi Perfil
                </h1>
                <p className="text-gray-500 mt-1">Actualiza tu información personal y contraseña</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Datos personales */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
                        <User size={18} className="text-[#1a2a4a]" /> Datos personales
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                        </div>
                        <div className="pt-1">
                            <p className="text-xs text-gray-500">Rol: <span className="font-medium capitalize">{user?.roles?.[0] ?? user?.role}</span></p>
                        </div>
                    </div>
                </div>

                {/* Cambio de contraseña */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
                        <Lock size={18} className="text-[#1a2a4a]" /> Cambiar contraseña
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
                            <input type="password" value={form.current_password} onChange={e => set('current_password', e.target.value)}
                                placeholder="Ingresa tu contraseña actual para confirmar"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                            <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                                minLength={form.password ? 8 : 0}
                                placeholder="Mínimo 8 caracteres (dejar vacío para no cambiar)"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
                            <input type="password" value={form.password_confirmation} onChange={e => set('password_confirmation', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button type="submit" loading={saving} size="lg">
                        <Save size={18} /> Guardar cambios
                    </Button>
                </div>
            </form>
        </div>
    );
}
