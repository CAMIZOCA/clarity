import React, { useEffect, useRef, useState } from 'react';
import { Plus, Upload, Trash2, Pencil, Star, Save } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';

const EMPTY = {
    nombre: '',
    titulo: 'OPTÓMETRA',
    registro_senescyt: '',
    codigo: '',
    is_active: true,
    is_default: false,
};

export default function CertifyingDoctorsTab() {
    const { addToast } = useToast();
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null); // doctor being edited or null (new)
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [uploadingId, setUploadingId] = useState(null);
    const fileRef = useRef(null);
    const uploadTarget = useRef(null);

    const load = () => {
        setLoading(true);
        client.get('/certifying-doctors')
            .then(r => setDoctors(r.data.data ?? r.data ?? []))
            .catch(() => addToast('No se pudieron cargar los doctores', 'error'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const openNew = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
    const openEdit = (d) => {
        setEditing(d);
        setForm({
            nombre: d.nombre || '',
            titulo: d.titulo || 'OPTÓMETRA',
            registro_senescyt: d.registro_senescyt || '',
            codigo: d.codigo || '',
            is_active: !!d.is_active,
            is_default: !!d.is_default,
        });
        setModalOpen(true);
    };

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!form.nombre.trim()) { addToast('El nombre es obligatorio', 'error'); return; }
        setSaving(true);
        try {
            if (editing) {
                await client.put(`/certifying-doctors/${editing.id}`, form);
                addToast('Doctor actualizado', 'success');
            } else {
                await client.post('/certifying-doctors', form);
                addToast('Doctor creado', 'success');
            }
            setModalOpen(false);
            load();
        } catch (e) {
            addToast(e.response?.data?.message || 'Error al guardar', 'error');
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        try {
            await client.delete(`/certifying-doctors/${confirmDelete.id}`);
            addToast('Doctor eliminado', 'success');
            load();
        } catch { addToast('Error al eliminar', 'error'); }
        finally { setConfirmDelete(null); }
    };

    const triggerUpload = (doctor) => {
        uploadTarget.current = doctor;
        fileRef.current?.click();
    };

    const handleFirmaUpload = async (e) => {
        const file = e.target.files?.[0];
        const doctor = uploadTarget.current;
        e.target.value = '';
        if (!file || !doctor) return;
        setUploadingId(doctor.id);
        try {
            const fd = new FormData();
            fd.append('firma', file);
            await client.post(`/certifying-doctors/${doctor.id}/firma`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            addToast('Firma actualizada', 'success');
            load();
        } catch { addToast('Error al subir la firma', 'error'); }
        finally { setUploadingId(null); }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-2">
                <div>
                    <h2 className="font-semibold text-gray-900">Doctores certificadores</h2>
                    <p className="text-sm text-gray-500 mt-1 max-w-xl">
                        Registra los doctores que firman los certificados con su REG. SENESCYT e imagen de firma.
                        El doctor predeterminado se selecciona automáticamente al generar un certificado.
                    </p>
                </div>
                <Button onClick={openNew}><Plus size={16} /> Nuevo doctor</Button>
            </div>

            <input type="file" ref={fileRef} accept="image/*" onChange={handleFirmaUpload} className="hidden" />

            <div className="mt-5 space-y-3">
                {loading && <p className="text-sm text-gray-400">Cargando…</p>}
                {!loading && doctors.length === 0 && (
                    <p className="text-sm text-gray-400">No hay doctores registrados todavía.</p>
                )}
                {doctors.map(d => (
                    <div key={d.id} className="flex items-center gap-4 rounded-xl border border-gray-200 p-4">
                        <div className="w-28 h-16 shrink-0 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden">
                            {d.firma_url
                                ? <img src={d.firma_url} alt="Firma" className="max-h-14 max-w-full object-contain" />
                                : <span className="text-[10px] text-gray-400 text-center px-1">Sin firma</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 truncate">{d.nombre}</span>
                                {d.is_default && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                        <Star size={11} /> Predeterminado
                                    </span>
                                )}
                                {!d.is_active && (
                                    <span className="text-[11px] text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">Inactivo</span>
                                )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                                {d.titulo}{d.registro_senescyt ? ` · REG. SENESCYT: ${d.registro_senescyt}` : ''}{d.codigo ? ` · ${d.codigo}` : ''}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button variant="secondary" size="sm" onClick={() => triggerUpload(d)} loading={uploadingId === d.id}>
                                <Upload size={14} /> Firma
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(d)}><Pencil size={14} /></Button>
                            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(d)}><Trash2 size={14} className="text-red-500" /></Button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar doctor' : 'Nuevo doctor'} size="md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
                        <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                            <input type="text" value={form.titulo} onChange={e => set('titulo', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                            <input type="text" value={form.codigo} onChange={e => set('codigo', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">REG. SENESCYT</label>
                        <input type="text" value={form.registro_senescyt} onChange={e => set('registro_senescyt', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                    </div>
                    <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                            <input type="checkbox" checked={form.is_default} onChange={e => set('is_default', e.target.checked)} className="w-4 h-4 accent-[#1a2a4a]" />
                            Predeterminado
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4 accent-[#1a2a4a]" />
                            Activo
                        </label>
                    </div>
                    {!editing && (
                        <p className="text-xs text-gray-400">La imagen de firma se sube después de crear el doctor, con el botón "Firma".</p>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} loading={saving}><Save size={16} /> Guardar</Button>
                    </div>
                </div>
            </Modal>

            <ConfirmModal
                open={!!confirmDelete}
                onCancel={() => setConfirmDelete(null)}
                onConfirm={handleDelete}
                title="Eliminar doctor"
                message={`¿Eliminar a "${confirmDelete?.nombre}"? Esta acción no se puede deshacer.`}
                confirmLabel="Eliminar"
                variant="danger"
            />
        </div>
    );
}
