import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { UserSearch, Plus, AlertTriangle } from 'lucide-react';
import client from '../../api/client';
import { cached, invalidate } from '../../api/cache';
import PatientAutocomplete from '../../components/ui/PatientAutocomplete';
import ConsultationForm from './ConsultationForm';
import Button from '../../components/ui/Button';
import { getPayload } from '../../api/response';
import { toDisplayDate, getYear } from '../../utils/dates';

export default function ConsultationPage() {
    const { consultationId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [consultation, setConsultation] = useState(null);
    const [meta, setMeta] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [loadingConsultation, setLoadingConsultation] = useState(false);

    // Catalogos, plantillas y optometras. Sin `.catch()` un fallo aqui dejaba la
    // pagina girando el spinner indefinidamente, sin explicar nada al usuario.
    const loadMeta = useCallback(() => {
        setLoadError(null);
        cached('consultation_meta', 300_000, () => client.get('/consultations-meta').then(r => r.data))
            .then(setMeta)
            .catch(() => setLoadError('No se pudieron cargar los catalogos de la consulta.'));
    }, []);

    useEffect(() => { loadMeta(); }, [loadMeta]);

    useEffect(() => {
        if (!consultationId) return;
        setLoadingConsultation(true);
        client.get(`/consultations/${consultationId}`)
            .then(r => {
                setConsultation(r.data);
                setSelectedPatient(r.data.patient);
            })
            .catch(() => setLoadError('No se pudo cargar la consulta solicitada.'))
            .finally(() => setLoadingConsultation(false));
    }, [consultationId]);

    // Pre-select patient from query param
    useEffect(() => {
        const pacienteId = searchParams.get('paciente');
        if (pacienteId && !selectedPatient) {
            client.get(`/patients/${pacienteId}`)
                .then(r => setSelectedPatient(getPayload(r)))
                .catch(() => setLoadError('No se pudo cargar el paciente indicado.'));
        }
    }, [searchParams]);

    // `/patients/search` devuelve una ficha reducida (sin direccion ni
    // ocupacion), asi que al elegir en el autocomplete se muestra de inmediato
    // lo que ya se tiene y se recarga la ficha completa en segundo plano.
    const handlePatientSelect = useCallback((patient) => {
        setSelectedPatient(patient);
        if (!patient?.id) return;
        client.get(`/patients/${patient.id}`)
            .then(r => setSelectedPatient(getPayload(r)))
            .catch(() => { /* se conserva la ficha reducida del autocomplete */ });
    }, []);

    if (loadError) return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <AlertTriangle size={28} className="mx-auto mb-3 text-red-600" />
                <p className="font-medium text-red-900">{loadError}</p>
                <p className="mt-1 text-sm text-red-700">Revise su conexion e intente nuevamente.</p>
                <div className="mt-4 flex justify-center">
                    <Button
                        variant="secondary"
                        onClick={() => {
                            invalidate('consultation_meta');
                            loadMeta();
                        }}
                    >
                        Reintentar
                    </Button>
                </div>
            </div>
        </div>
    );

    if (loadingConsultation || !meta) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-10 w-10 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
        </div>
    );

    const patientName = selectedPatient?.nombre_completo || selectedPatient?.nombre || '';

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
                        <PatientAutocomplete onSelect={handlePatientSelect} />
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
                    {/* Patient header: identificacion siempre visible durante la consulta */}
                    <div className="bg-[#1a2a4a] rounded-2xl p-5 mb-6 text-white">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center font-bold text-xl">
                                    {patientName?.[0]}
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold">{patientName}</h2>
                                    {selectedPatient.ocupacion && (
                                        <p className="text-blue-200 text-sm">{selectedPatient.ocupacion}</p>
                                    )}
                                </div>
                            </div>
                            {!consultationId && (
                                <button onClick={() => setSelectedPatient(null)}
                                    className="text-blue-200 hover:text-white text-sm underline">
                                    Cambiar paciente
                                </button>
                            )}
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/15 pt-4 sm:grid-cols-4">
                            {[
                                ['Cédula', selectedPatient.cedula || '—'],
                                ['Fecha nac.', toDisplayDate(selectedPatient.fecha_nacimiento, '—')],
                                ['Año', getYear(selectedPatient.fecha_nacimiento, '—')],
                                ['Edad', selectedPatient.edad != null ? `${selectedPatient.edad} años` : '—'],
                            ].map(([term, value]) => (
                                <div key={term}>
                                    <dt className="text-[11px] uppercase tracking-wide text-blue-300">{term}</dt>
                                    <dd className="text-sm font-medium text-white">{value}</dd>
                                </div>
                            ))}
                        </dl>
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
