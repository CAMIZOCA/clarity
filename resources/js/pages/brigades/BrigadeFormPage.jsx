import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';

export default function BrigadeFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const isEdit = Boolean(id);
    const [saving, setSaving] = useState(false);
    const [optometristas, setOptometristas] = useState([]);
    const [form, setForm] = useState({ nombre: '', lugar: '', fecha: '', optometrista_id: '', observaciones: '' });

    useEffect(() => {
        client.get('/users').then(r => {
            const list = r.data.data ?? r.data;
            setOptometristas(list.filter(u => u.roles?.includes('optometra') || u.roles?.includes('admin')));
        }).catch(() => {});

        if (!isEdit) return;

        client.get(`/brigades/${id}`).then(r => {
            const b = r.data;
            setForm({
                nombre: b.nombre || '',
                lugar: b.lugar || '',
                fecha: b.fecha?.slice(0, 10) || '',
                optometrista_id: b.optometrista_id || '',
                observaciones: b.observaciones || '',
            });
        }).catch(() => navigate('/brigadas'));
    }, [id, isEdit, navigate]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { ...form, optometrista_id: form.optometrista_id || null };
            if (isEdit) { await client.put(`/brigades/${id}`, payload); addToast('Brigada actualizada', 'success'); }
            else { await client.post('/brigades', payload); addToast('Brigada creada', 'success'); }
            navigate('/brigadas');
        } catch (err) {
            addToast(err.response?.data?.message || 'Error al guardar', 'error');
        } finally { setSaving(false); }
    };

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto pb-24">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={24} /></button>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Shield size={24} className="text-[#1a2a4a]" /> {isEdit ? 'Editar Brigada' : 'Nueva Brigada'}
                </h1>
            </div>
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 space-y-5">
                <Input label="Nombre" required value={form.nombre} onChange={e => set('nombre', e.target.value)} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Lugar" required value={form.lugar} onChange={e => set('lugar', e.target.value)} />
                    <Input label="Fecha" type="date" required value={form.fecha} onChange={e => set('fecha', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Optometrista responsable</label>
                    <select
                        value={form.optometrista_id}
                        onChange={e => set('optometrista_id', e.target.value)}
                        className="min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                    >
                        <option value="">— Seleccionar —</option>
                        {optometristas.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Observaciones</label>
                    <textarea
                        value={form.observaciones}
                        onChange={e => set('observaciones', e.target.value)}
                        rows={3}
                        className="w-full min-h-11 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                    />
                </div>

                <div className="mobile-sticky-actions -mx-5 px-5 py-4 sm:-mx-6 sm:px-6">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button variant="secondary" type="button" onClick={() => navigate(-1)} className="w-full justify-center sm:flex-1">Cancelar</Button>
                        <Button type="submit" loading={saving} className="w-full justify-center sm:flex-1">{isEdit ? 'Guardar cambios' : 'Crear brigada'}</Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
