import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import PatientAutocomplete from '../../components/ui/PatientAutocomplete';
import { useToast } from '../../components/ui/Toast';

export default function ReferenceFormPage() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const isEdit = Boolean(id);
    const [saving, setSaving] = useState(false);
    const [patient, setPatient] = useState(null);
    const [form, setForm] = useState({
        patient_id: searchParams.get('paciente') || '',
        motivo: '', medico_referido: '', especialidad: '',
        fecha: new Date().toISOString().slice(0, 10),
        observaciones: '',
    });

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    useEffect(() => {
        if (form.patient_id && !patient) {
            client.get(`/patients/${form.patient_id}`).then(r => setPatient(r.data)).catch(() => {});
        }
    }, [form.patient_id]);

    useEffect(() => {
        if (isEdit) {
            client.get(`/ophthalmology-references/${id}`).then(r => {
                const ref = r.data;
                setPatient(ref.patient);
                setForm({
                    patient_id: ref.patient_id,
                    motivo: ref.motivo || '',
                    medico_referido: ref.medico_referido || '',
                    especialidad: ref.especialidad || '',
                    fecha: ref.fecha?.slice(0, 10) || '',
                    observaciones: ref.observaciones || '',
                });
            }).catch(() => navigate('/referencias'));
        }
    }, [id, isEdit]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.patient_id) { addToast('Seleccione un paciente', 'error'); return; }
        setSaving(true);
        try {
            if (isEdit) { await client.put(`/ophthalmology-references/${id}`, form); addToast('Referencia actualizada', 'success'); }
            else { await client.post('/ophthalmology-references', form); addToast('Referencia creada', 'success'); }
            if (form.patient_id) navigate(`/pacientes/${form.patient_id}`);
            else navigate('/referencias');
        } catch (err) { addToast(err.response?.data?.message || 'Error al guardar', 'error'); }
        finally { setSaving(false); }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={24} /></button>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText size={24} className="text-[#1a2a4a]" /> {isEdit ? 'Editar Referencia' : 'Nueva Referencia Oftalmológica'}
                </h1>
            </div>
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paciente <span className="text-red-500">*</span></label>
                    <PatientAutocomplete value={patient} onChange={p => { setPatient(p); set('patient_id', p?.id || ''); }} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de referencia <span className="text-red-500">*</span></label>
                    <textarea value={form.motivo} onChange={e => set('motivo', e.target.value)} required rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Médico referido <span className="text-red-500">*</span></label>
                        <input type="text" value={form.medico_referido} onChange={e => set('medico_referido', e.target.value)} required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Especialidad</label>
                        <input type="text" value={form.especialidad} onChange={e => set('especialidad', e.target.value)}
                            placeholder="Ej: Retina, Córnea..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha <span className="text-red-500">*</span></label>
                    <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones clínicas</label>
                    <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] resize-none" />
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                    <Button variant="secondary" type="button" onClick={() => navigate(-1)}>Cancelar</Button>
                    <Button type="submit" loading={saving}>{isEdit ? 'Guardar cambios' : 'Crear referencia'}</Button>
                </div>
            </form>
        </div>
    );
}
