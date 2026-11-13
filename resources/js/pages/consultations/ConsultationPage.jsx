import React, { useState, useEffect, useCallback } from 'react';
import { Link, Navigate, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { UserSearch, Plus, AlertTriangle, ChevronDown } from 'lucide-react';
import client from '../../api/client';
import { cached, invalidate } from '../../api/cache';
import PatientAutocomplete from '../../components/ui/PatientAutocomplete';
import ConsultationForm from './ConsultationForm';
import Button from '../../components/ui/Button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { getPayload } from '../../api/response';
import { useAuth } from '../../contexts/AuthContext';
import { toDisplayDate, getYear } from '../../utils/dates';
import { useUiTemplate } from '../../contexts/UiTemplateContext';
import { useFocusMode } from '../../components/layout/shellContext';

/**
 * Datos fijos del paciente que acompañan la consulta. Las dos plantillas
 * muestran exactamente esta lista (la tarjeta azul del Clasico y el inspector o
 * la franja del Compacto): un dato nuevo se agrega aqui y sale en ambas.
 */
export function patientFacts(patient) {
    return [
        ['Cédula', patient.cedula || '—'],
        ['Código interno', patient.codigo_interno || '—'],
        ['Fecha nac.', toDisplayDate(patient.fecha_nacimiento, '—')],
        ['Edad', patient.edad != null
            ? `${patient.edad} años (${getYear(patient.fecha_nacimiento, '—')})`
            : '—'],
        ['Teléfono', patient.telefono || '—'],
        ['Ocupación', patient.ocupacion || '—'],
        ['Dirección', patient.direccion || '—'],
        ['Quién le recomienda', patient.como_nos_conocio || '—'],
    ];
}

/** Plantilla Compacto: inspector a la derecha (monitor) o franja desplegable (laptop). */
function CompactPatientPanel({ patient, patientName, variant, onChangePatient, title }) {
    const [expanded, setExpanded] = useState(false);
    const facts = patientFacts(patient);
    const antecedentes = patient.antecedentes?.trim();
    const initial = patientName?.[0];

    if (variant === 'inspector') {
        return (
            <aside aria-label="Datos del paciente" className="sticky top-[64px] hidden max-h-[calc(100dvh-76px)] w-72 shrink-0 space-y-3 overflow-y-auto rounded-xl bg-white p-3 shadow-sm min-[1600px]:block">
                <div className="flex items-center gap-2.5">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-base font-semibold text-white">{initial}</div>
                    <div className="min-w-0">
                        <p className="text-[14px] font-semibold leading-tight text-gray-900">{patientName}</p>
                        {onChangePatient && (
                            <button type="button" onClick={onChangePatient} className="text-xs text-navy hover:underline">Cambiar paciente</button>
                        )}
                    </div>
                </div>
                {antecedentes && (
                    <div className="flex gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[12.5px] text-amber-900">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                        <p className="min-w-0 whitespace-pre-line break-words"><span className="font-semibold">Antecedentes: </span>{antecedentes}</p>
                    </div>
                )}
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12.5px]">
                    {facts.map(([term, value]) => (
                        <React.Fragment key={term}>
                            <dt className="text-gray-500">{term}</dt>
                            <dd className="break-words text-gray-900">{value}</dd>
                        </React.Fragment>
                    ))}
                </dl>
            </aside>
        );
    }

    // Franja: en laptop no hay ancho para el inspector. Lo esencial a la vista y
    // el resto al desplegar (mismos 8 datos y antecedentes).
    return (
        <div className="mb-2 rounded-xl bg-white px-3 py-1.5 shadow-sm min-[1600px]:hidden">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white">{initial}</div>
                <p className="min-w-0 text-[14px] font-semibold text-gray-900">
                    {patient.id
                        ? <Link to={`/pacientes/${patient.id}`} className="hover:underline" title="Volver a la ficha del paciente">{patientName}</Link>
                        : patientName}
                    {title && <span className="ml-2 font-normal text-gray-500">· {title}</span>}
                </p>
                <p className="text-[12.5px] tabular-nums text-gray-500">
                    C.I. {patient.cedula || '—'} · {patient.edad != null ? `${patient.edad} años` : 'edad —'} · {patient.telefono || 'sin teléfono'}
                </p>
                {antecedentes && (
                    <span className="max-w-[28rem] truncate rounded-full bg-amber-50 px-2.5 py-0.5 text-[12px] text-amber-900" title={antecedentes}>
                        Antecedentes: {antecedentes}
                    </span>
                )}
                <span className="flex-1" />
                {onChangePatient && (
                    <button type="button" onClick={onChangePatient} className="text-xs text-navy hover:underline">Cambiar paciente</button>
                )}
                <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    aria-expanded={expanded}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12.5px] font-medium text-navy hover:bg-navy/10"
                >
                    {expanded ? 'Menos datos' : 'Más datos'}
                    <ChevronDown size={14} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
            </div>
            {expanded && (
                <div className="mt-2 border-t border-gray-100 pt-2">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-4">
                        {facts.map(([term, value]) => (
                            <div key={term} className="min-w-0">
                                <dt className="text-gray-500">{term}</dt>
                                <dd className="break-words text-gray-900">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    {antecedentes && (
                        <p className="mt-2 whitespace-pre-line break-words rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12.5px] text-amber-900">
                            <span className="font-semibold">Antecedentes: </span>{antecedentes}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ConsultationPage() {
    const { consultationId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { can } = useAuth();
    const { isCompact } = useUiTemplate();
    // Compacto en laptop: se oculta la barra lateral para dar ancho al formulario.
    useFocusMode(isCompact);
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

    // Recepcion ve la historia pero no la crea ni la edita (el servidor
    // tambien lo rechaza). Una consulta existente se abre en solo lectura.
    // Sin permiso de edicion la consulta se ve en la ficha de solo lectura.
    if (consultationId && !can('consultations.edit')) {
        return <Navigate to={`/consulta/${consultationId}/ver`} replace />;
    }

    if (!consultationId && !can('consultations.create')) return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                <AlertTriangle size={28} className="mx-auto mb-3 text-amber-600" />
                <p className="font-medium text-amber-900">No tiene permiso para crear consultas.</p>
                <div className="mt-4 flex justify-center">
                    <Button variant="secondary" onClick={() => navigate(-1)}>Volver</Button>
                </div>
            </div>
        </div>
    );

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
            <div className="animate-spin h-10 w-10 border-4 border-navy border-t-transparent rounded-full" />
        </div>
    );

    const patientName = selectedPatient?.nombre_completo || selectedPatient?.nombre || '';

    // La consulta es hija de la ficha del paciente: la ruta permite volver a ella.
    const breadcrumbs = [
        { label: 'Pacientes', to: '/pacientes' },
        selectedPatient?.id && { label: patientName || 'Paciente', to: `/pacientes/${selectedPatient.id}` },
        { label: consultationId ? `Consulta #${consultation?.numero_consulta ?? '...'}` : 'Nueva consulta' },
    ].filter(Boolean);

    const title = consultationId ? `Consulta #${consultation?.numero_consulta ?? '...'}` : 'Nueva Consulta';

    if (isCompact && selectedPatient) {
        const changePatient = !consultationId ? () => setSelectedPatient(null) : null;
        return (
            <div className="px-3 pb-3 pt-2 lg:px-4">
                <nav aria-label="Ruta" className="sr-only"><Breadcrumbs items={breadcrumbs} /></nav>
                <CompactPatientPanel patient={selectedPatient} patientName={patientName} variant="strip" onChangePatient={changePatient} title={title} />
                <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                        <ConsultationForm
                            patient={selectedPatient}
                            consultation={consultation}
                            meta={meta}
                            readOnly={Boolean(consultationId) && !can('consultations.edit')}
                        />
                    </div>
                    <CompactPatientPanel patient={selectedPatient} patientName={patientName} variant="inspector" onChangePatient={changePatient} />
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <Breadcrumbs items={breadcrumbs} />
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
                            <div className="w-12 h-12 bg-navy/10 rounded-xl flex items-center justify-center">
                                <UserSearch size={24} className="text-navy" />
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
                    <div className="bg-navy rounded-2xl p-5 mb-6 text-white">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center font-bold text-xl">
                                    {patientName?.[0]}
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold">{patientName}</h2>
                                </div>
                            </div>
                            {!consultationId && (
                                <button onClick={() => setSelectedPatient(null)}
                                    className="text-blue-200 hover:text-white text-sm underline">
                                    Cambiar paciente
                                </button>
                            )}
                        </div>
                        {/* Todo lo fijo del paciente va aqui: la cabecera clinica
                            solo tiene lo que se edita en la consulta. */}
                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/15 pt-4 sm:grid-cols-4">
                            {patientFacts(selectedPatient).map(([term, value]) => (
                                <div key={term} className="min-w-0">
                                    <dt className="text-[11px] uppercase tracking-wide text-blue-300">{term}</dt>
                                    <dd className="break-words text-sm font-medium text-white">{value}</dd>
                                </div>
                            ))}
                        </dl>
                        {selectedPatient.antecedentes?.trim() && (
                            <div className="mt-4 flex gap-2 rounded-xl border border-amber-300/40 bg-amber-400/15 px-3 py-2 text-sm">
                                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
                                <div className="min-w-0">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">Antecedentes</span>
                                    <p className="whitespace-pre-line break-words text-amber-50">{selectedPatient.antecedentes}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <ConsultationForm
                        patient={selectedPatient}
                        consultation={consultation}
                        meta={meta}
                        readOnly={Boolean(consultationId) && !can('consultations.edit')}
                    />
                </>
            )}
        </div>
    );
}
