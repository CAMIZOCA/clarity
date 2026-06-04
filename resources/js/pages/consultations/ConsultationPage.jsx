import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { UserSearch, Plus } from 'lucide-react';
import client from '../../api/client';
import { cached } from '../../api/cache';
import PatientAutocomplete from '../../components/ui/PatientAutocomplete';
import ConsultationForm from './ConsultationForm';
import Button from '../../components/ui/Button';

export default function ConsultationPage() {
    const { consultationId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [consultation, setConsultation] = useState(null);
    const [meta, setMeta] = useState(null);
    const [loadingConsultation, setLoadingConsultation] = useState(false);

    // Load existing consultation
    useEffect(() => {
        cached('consultation_meta', 300_000, () => client.get('/consultations-meta').then(r => r.data))
            .then(setMeta);
    }, []);

    useEffect(() => {
        if (!consultationId) return;
        setLoadingConsultation(true);
        client.get(`/consultations/${consultationId}`)
            .then(r => {
                setConsultation(r.data);
                setSelectedPatient(r.data.patient);
            })
            .finally(() => setLoadingConsultation(false));
    }, [consultationId]);

    // Pre-select patient from query param
    useEffect(() => {
        const pacienteId = searchParams.get('paciente');
        if (pacienteId && !selectedPatient) {
            client.get(`/patients/${pacienteId}`)
                .then(r => setSelectedPatient(r.data));
        }
    }, [searchParams]);

    if (loadingConsultation || !meta) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-10 w-10 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">
                    {consultationId ? `Consulta #${consultation?.numero_consulta ?? '...'}` : 'Nueva Consulta'}
                </h1>
                <p className="text-gray-500 mt-1">Formulario clínico optométrico</p>
            </div>

            {/* Patient selection banner */}
            {!selectedPatient ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-6">
                    <div className="max-w-2xl mx-auto">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-[#1a2a4a]/10 rounded-xl flex items-center justify-center">
                                <UserSearch size={24} className="text-[#1a2a4a]" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">Seleccionar Paciente</h2>
                                <p className="text-gray-500">Busque el paciente para iniciar la consulta</p>
                            </div>
                        </div>
                        <PatientAutocomplete onSelect={setSelectedPatient} />
                        <div className="flex items-center gap-4 mt-4">
                            <div className="flex-1 border-t border-gray-200" />
                            <span className="text-gray-400 text-sm">o</span>
                            <div className="flex-1 border-t border-gray-200" />
                        </div>
                        <Button variant="secondary" className="w-full justify-center mt-4"
                            onClick={() => navigate('/pacientes/nuevo')}>
                            <Plus size={18} /> Registrar Nuevo Paciente
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Patient header */}
                    <div className="bg-[#1a2a4a] rounded-2xl p-5 mb-6 text-white flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center font-bold text-xl">
                                {selectedPatient.nombre?.[0]}
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">{selectedPatient.nombre}</h2>
                                <p className="text-blue-200 text-sm">
                                    CI: {selectedPatient.cedula} · {selectedPatient.edad} años
                                    {selectedPatient.ocupacion && ` · ${selectedPatient.ocupacion}`}
                                </p>
                            </div>
                        </div>
                        {!consultationId && (
                            <button onClick={() => setSelectedPatient(null)}
                                className="text-blue-200 hover:text-white text-sm underline">
                                Cambiar paciente
                            </button>
                        )}
                    </div>

                    <ConsultationForm
                        patient={selectedPatient}
                        consultation={consultation}
                        meta={meta}
                    />
                </>
            )}
        </div>
    );
}
