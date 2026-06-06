import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import PatientAutocomplete from '../../components/ui/PatientAutocomplete';
import Input from '../../components/ui/Input';
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
        motivo: '',
        medico_referido: '',
        especialidad: '',
        fecha: new Date().toISOString().slice(0, 10),
        observaciones: '',
    });

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    useEffect(() => {
        if (form.patient_id && !patient) {
            client.get(`/patients/${form.patient_id}`).then(r => setPatient(r.data)).catch(() => {});
        }
    }, [form.patient_id, patient]);

    useEffect(() => {
        if (!isEdit) return;

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
    }, [id, isEdit, navigate]);

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
        <div className="p-4 sm:p-6 max-w-2xl mx-auto pb-24">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={24} /></button>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText size={24} className="text-[#1a2a4a]" /> {isEdit ? 'Editar Referencia' : 'Nueva Referencia Oftalmológica'}
                </h1>
            </div>
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paciente <span className="text-red-500">*</span></label>
                    <PatientAutocomplete value={patient} onChange={p => { setPatient(p); set('patient_id', p?.id || ''); }} />
                </div>
                <Input
                    label="Motivo de referencia"
                    required
                    value={form.motivo}
                    onChange={e => set('motivo', e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                        label="Médico referido"
                        required
                        value={form.medico_referido}
                        onChange={e => set('medico_referido', e.target.value)}
                    />
                    <Input
                        label="Especialidad"
                        value={form.especialidad}
                        onChange={e => set('especialidad', e.target.value)}
                        placeholder="Ej: Retina, Córnea..."
                    />
                </div>
                <Input
                    label="Fecha"
                    type="date"
                    required
                    value={form.fecha}
                    onChange={e => set('fecha', e.target.value)}
                />
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Observaciones clínicas</label>
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
                        <Button type="submit" loading={saving} className="w-full justify-center sm:flex-1">{isEdit ? 'Guardar cambios' : 'Crear referencia'}</Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
