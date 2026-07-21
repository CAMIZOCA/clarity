import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { Save, FileText, CheckCircle, Clock, Plus, Trash2, Printer, AlertTriangle } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import EyeFieldGroup from '../../components/forms/EyeFieldGroup';
import CollapsibleSection from '../../components/forms/CollapsibleSection';
import { AdvancedToggleButton, useAdvancedToggle } from '../../components/forms/AdvancedFieldsToggle';
import CertificadoPdf from '../../components/pdf/CertificadoPdf';
import { useToast } from '../../components/ui/Toast';
import { useSettings } from '../../contexts/SettingsContext';
import { useAdvancedFields } from '../../hooks/useAdvancedFields';

const RequiredErrorsCtx = React.createContext(new Set());

const REQUIRED_FIELD_LABELS = {
    optometrista_id: 'Médico / Optometrista',
    motivo_consulta: 'Motivo de consulta',
    fecha_consulta: 'Fecha de consulta',
    avsc_od: 'AV SC (Ojo derecho)',
    avsc_oi: 'AV SC (Ojo izquierdo)',
    rx_final_esfera_od: 'RX Final esfera OD',
    rx_final_esfera_oi: 'RX Final esfera OI',
    diagnostico_descripcion: 'Diagnóstico principal',
    lente_anterior: 'Lente anterior',
    observaciones: 'Observaciones clínicas',
    print_template_key: 'Plantilla de impresión',
    doctor_license: 'Registro / Licencia del doctor',
};

const CLINICAL_FIELD_KEYS = [
    'motivo_consulta', 'lente_anterior', 'observaciones', 'diagnostico_adicional',
    'av_lectura_od', 'av_lectura_oi', 'avsc_od', 'avsc_oi',
    'rx_final_esfera_od', 'rx_final_esfera_oi', 'vc_esfera_od', 'vc_esfera_oi',
];

const defaultDiagnosis = (eye = 'general') => ({
    eye,
    catalog_item_id: '',
    code: '',
    description: '',
    notes: '',
});

const defaultRecommendation = () => ({
    catalog_item_id: '',
    text: '',
});

function buildOphthalmoscopyMatrix(rows = [], distances = []) {
    return rows.reduce((acc, row) => {
        acc[row] = distances.reduce((inner, distance) => {
            inner[distance] = '';
            return inner;
        }, {});
        return acc;
    }, {});
}

function buildDefaultValues(patient, consultation, meta) {
    const diagnosisFallback = consultation?.diagnoses?.length
        ? consultation.diagnoses.map((item) => ({
            eye: item.eye ?? 'general',
            catalog_item_id: item.catalog_item_id ?? '',
            code: item.code ?? '',
            description: item.description ?? '',
            notes: item.notes ?? '',
        }))
        : [
            consultation?.diagnostico_descripcion
                ? {
                    eye: 'general',
                    catalog_item_id: '',
                    code: consultation?.diagnostico_cie10 ?? '',
                    description: consultation?.diagnostico_descripcion ?? '',
                    notes: consultation?.diagnostico_adicional ?? '',
                }
                : defaultDiagnosis('od'),
            defaultDiagnosis('oi'),
        ];

    const recommendationFallback = consultation?.recommendations_list?.length
        ? consultation.recommendations_list.map((item) => ({
            catalog_item_id: item.catalog_item_id ?? '',
            text: item.text ?? '',
        }))
        : consultation?.recomendaciones
            ? consultation.recomendaciones.split('\n').filter(Boolean).map((text) => ({ catalog_item_id: '', text }))
            : [defaultRecommendation()];

    return {
        patient_id: patient.id,
        optometrista_id: consultation?.optometrista_id ?? '',
        fecha_consulta: consultation?.fecha_consulta
            ? new Date(consultation.fecha_consulta).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
        estado: consultation?.estado ?? 'borrador',
        motivo_consulta: consultation?.motivo_consulta ?? '',
        ultimo_control: consultation?.ultimo_control
            ? new Date(consultation.ultimo_control).toISOString().split('T')[0]
            : '',
        doctor_license: consultation?.doctor_license ?? consultation?.optometrista?.registro_senescyt ?? '',
        print_template_key: consultation?.print_template_key ?? meta?.templates?.[0]?.key ?? '',
        diagnoses: diagnosisFallback,
        recommendations_list: recommendationFallback,
        lens_recommendation: {
            material_item_id: consultation?.lens_recommendation?.material_item_id ?? '',
            thickness_item_id: consultation?.lens_recommendation?.thickness_item_id ?? '',
            protection_item_id: consultation?.lens_recommendation?.protection_item_id ?? '',
            observation: consultation?.lens_recommendation?.observation ?? consultation?.luna_observacion ?? '',
        },
        motor_binocular_data: consultation?.motor_binocular_data ?? {
            ducciones: { od: consultation?.ducciones_od ?? '', oi: consultation?.ducciones_oi ?? '', observacion: '' },
            versiones: { od: '', oi: '', observacion: consultation?.versiones ?? '' },
            ppc: { od: '', oi: '', observacion: consultation?.ppc ?? '' },
            cover_test: { od: '', oi: '', observacion: consultation?.cover_test ?? '' },
            reflejos_pupilares: { od: '', oi: '', observacion: consultation?.reflejos_pupilares ?? '' },
            test_hirschberg: { od: '', oi: '', observacion: consultation?.test_hirschberg ?? '' },
        },
        near_vision_data: consultation?.near_vision_data ?? {},
        contact_lens_module: consultation?.contact_lens_module ?? {
            diametro_pupilar: '',
            diametro_corneal: '',
            apertura_palpebral: '',
            tension_palpebral: '',
            ojo_dominante: '',
            but_value: '',
            shirmer_test: '',
            frecuencia_parpadeo: '',
            observaciones: '',
            test_lens: {
                od: { curva_base: '', poder: '', h2o: '', material: '', diametro: '', sobre_refraccion: '', agudeza_visual: '' },
                oi: { curva_base: '', poder: '', h2o: '', material: '', diametro: '', sobre_refraccion: '', agudeza_visual: '' },
            },
            final_lens: {
                od: { curva_base: '', poder: '', diametro: '', h2o: '', material: '' },
                oi: { curva_base: '', poder: '', diametro: '', h2o: '', material: '' },
            },
        },
        ophthalmoscopy_module: consultation?.ophthalmoscopy_module ?? {
            fijacion_od: '',
            fijacion_oi: '',
            valoracion_motora: '',
            ppc_obj: '',
            luz: '',
            fr: '',
            results: buildOphthalmoscopyMatrix(
                Array.isArray(meta?.ophthalmoscopy_rows) ? meta.ophthalmoscopy_rows : [],
                Array.isArray(meta?.ophthalmoscopy_distances) ? meta.ophthalmoscopy_distances : []
            ),
        },
        treatment_module: consultation?.treatment_module ?? {
            plan: '',
            horas_uso: '',
            metodo_limpieza: '',
            modalidad_uso: '',
        },
        ...consultation,
    };
}

function fieldErrorClass(hasError) {
    return hasError
        ? 'border-red-400 ring-1 ring-red-400'
        : 'border-slate-300';
}

function focusNextField(nextFieldId) {
    if (!nextFieldId) {
        return;
    }

    const nextField = document.getElementById(nextFieldId);
    if (nextField && typeof nextField.focus === 'function') {
        nextField.focus({ preventScroll: true });
        if (typeof nextField.select === 'function') {
            nextField.select();
        }
    }
}

function FormInput({ label, register, name, type = 'text', inputMode, enterKeyHint, nextFieldId, ...props }) {
    const errors = useContext(RequiredErrorsCtx);
    const err = errors.has(name);
    const resolvedInputMode = inputMode ?? (type === 'number' ? 'decimal' : undefined);
    const resolvedEnterKeyHint = enterKeyHint ?? (nextFieldId ? 'next' : 'done');
    return (
        <div className="flex flex-col gap-1">
            <label className={`text-sm font-medium ${err ? 'text-red-600' : 'text-slate-700'}`}>{label}{err && ' *'}</label>
            <input
                id={name}
                type={type}
                inputMode={resolvedInputMode}
                enterKeyHint={resolvedEnterKeyHint}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && nextFieldId && !event.isComposing) {
                        event.preventDefault();
                        focusNextField(nextFieldId);
                    }
                }}
                className={`w-full min-h-11 rounded-xl border px-3 py-2.5 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-slate-900 ${fieldErrorClass(err)}`}
                {...register(name)}
                {...props}
            />
        </div>
    );
}

function FormSelect({ label, register, name, options = [], placeholder = 'Seleccionar...', nextFieldId }) {
    const errors = useContext(RequiredErrorsCtx);
    const err = errors.has(name);
    return (
        <div className="flex flex-col gap-1">
            <label className={`text-sm font-medium ${err ? 'text-red-600' : 'text-slate-700'}`}>{label}{err && ' *'}</label>
            <select
                id={name}
                enterKeyHint={nextFieldId ? 'next' : 'done'}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && nextFieldId && !event.isComposing) {
                        event.preventDefault();
                        focusNextField(nextFieldId);
                    }
                }}
                className={`w-full min-h-11 rounded-xl border px-3 py-2.5 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-slate-900 ${fieldErrorClass(err)}`}
                {...register(name)}
            >
                <option value="">{placeholder}</option>
                {options.map((option) => (
                    <option key={option.id ?? option.value ?? option.label} value={option.id ?? option.value}>
                        {option.code ? `${option.code} - ${option.label}` : option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

function TextArea({ label, register, name, rows = 3, placeholder, ...props }) {
    const errors = useContext(RequiredErrorsCtx);
    const err = errors.has(name);
    return (
        <div className="flex flex-col gap-1">
            <label className={`text-sm font-medium ${err ? 'text-red-600' : 'text-slate-700'}`}>{label}{err && ' *'}</label>
            <textarea
                id={name}
                rows={rows}
                placeholder={placeholder}
                className={`w-full min-h-11 rounded-xl border px-3 py-2.5 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-slate-900 ${fieldErrorClass(err)}`}
                {...register(name)}
                {...props}
            />
        </div>
    );
}

function InlineBadge({ label }) {
    return (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {label}
        </span>
    );
}

export default function ConsultationForm({ patient, consultation, meta }) {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { settings } = useSettings();
    const [saving, setSaving] = useState(false);
    const [consultationId, setConsultationId] = useState(consultation?.id ?? null);
    const [lastSaved, setLastSaved] = useState(null);
    const [showPdf, setShowPdf] = useState(false);
    const [pdfData, setPdfData] = useState(null);
    const [requiredErrors, setRequiredErrors] = useState(new Set());
    const [showRequiredModal, setShowRequiredModal] = useState(false);
    const [missingLabels, setMissingLabels] = useState([]);
    const autosaveTimerRef = useRef(null);

    const defaultValues = useMemo(
        () => buildDefaultValues(patient, consultation, meta),
        [patient, consultation, meta]
    );

    const { register, handleSubmit, getValues, setValue, watch, control, reset } = useForm({ defaultValues });

    useEffect(() => {
        reset(defaultValues);
        setConsultationId(consultation?.id ?? null);
    }, [consultation, defaultValues, reset]);

    const diagnosesFieldArray = useFieldArray({ control, name: 'diagnoses' });
    const recommendationsFieldArray = useFieldArray({ control, name: 'recommendations_list' });

    const asArray = (value) => (Array.isArray(value) ? value : []);
    const diagnosisOptions = asArray(meta?.catalogs?.diagnoses);
    const materialOptions = asArray(meta?.catalogs?.lens_materials);
    const thicknessOptions = asArray(meta?.catalogs?.lens_thicknesses);
    const protectionOptions = asArray(meta?.catalogs?.lens_protections);
    const recommendationOptions = asArray(meta?.catalogs?.recommendations);
    const optometrists = asArray(meta?.optometrists);
    const templateOptions = asArray(meta?.templates);
    const ophthalmoscopyRows = asArray(meta?.ophthalmoscopy_rows);
    const ophthalmoscopyDistances = asArray(meta?.ophthalmoscopy_distances);
    const previousConsultation = consultation?.previous_consultation_summary;

    const doSave = useCallback(async (showMsg = false, forceStatus = null) => {
        const values = getValues();
        const hasClinicalData = CLINICAL_FIELD_KEYS.some((key) => Boolean(values[key]))
            || (values.diagnoses ?? []).some((item) => item?.description)
            || (values.recommendations_list ?? []).some((item) => item?.text);

        if (!values.patient_id) return null;
        if (!consultationId && !hasClinicalData && !showMsg) return null;

        try {
            const payload = {
                ...values,
                estado: forceStatus ?? values.estado ?? 'borrador',
            };

            let response;
            if (consultationId) {
                response = await client.put(`/consultations/${consultationId}`, payload);
            } else {
                response = await client.post('/consultations', payload);
                setConsultationId(response.data.id);
            }

            setLastSaved(new Date());
            reset(buildDefaultValues(patient, response.data, meta));
            if (showMsg) addToast('Consulta guardada correctamente', 'success');
            return response.data;
        } catch (error) {
            if (showMsg) {
                addToast(error?.response?.data?.message ?? 'Error al guardar la consulta', 'error');
            }
            throw error;
        }
    }, [consultationId, getValues, reset, patient, meta, addToast]);

    useEffect(() => {
        autosaveTimerRef.current = setInterval(() => {
            doSave(false).catch(() => {});
        }, 30000);

        return () => clearInterval(autosaveTimerRef.current);
    }, [doSave]);

    const validateRequired = () => {
        const required = Array.isArray(settings?.required_fields) ? settings.required_fields : [];
        if (required.length === 0) return true;
        const values = getValues();
        const missing = new Set();
        const labels = [];
        for (const key of required) {
            let empty = false;
            if (key === 'diagnostico_descripcion') {
                empty = !(values.diagnoses ?? []).some(d => d?.description?.trim());
            } else {
                empty = !String(values[key] ?? '').trim();
            }
            if (empty) {
                missing.add(key);
                labels.push(REQUIRED_FIELD_LABELS[key] ?? key);
            }
        }
        setRequiredErrors(missing);
        if (missing.size > 0) {
            setMissingLabels(labels);
            setShowRequiredModal(true);
            return false;
        }
        return true;
    };

    const onSubmit = async () => {
        if (!validateRequired()) return;
        setSaving(true);
        try {
            const saved = await doSave(true, 'completada');
            if (!consultationId && saved?.id) {
                navigate(`/consulta/${saved.id}`);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleGeneratePdf = async () => {
        const current = consultationId ?? (await doSave(true, 'borrador'))?.id;
        if (!current) return;

        try {
            const response = await client.get(`/consultations/${current}/pdf-data`);
            setPdfData(response.data);
            setShowPdf(true);
        } catch {
            addToast('Error al cargar la vista previa de impresion', 'error');
        }
    };

    const handleDiagnosisCatalogChange = (index, itemId) => {
        const selected = diagnosisOptions.find((item) => String(item.id) === String(itemId));
        setValue(`diagnoses.${index}.catalog_item_id`, itemId);
        setValue(`diagnoses.${index}.code`, selected?.code ?? '');
        if (!(watch(`diagnoses.${index}.description`) || '').trim()) {
            setValue(`diagnoses.${index}.description`, selected?.label ?? '');
        }
    };

    const handleRecommendationCatalogChange = (index, itemId) => {
        const selected = recommendationOptions.find((item) => String(item.id) === String(itemId));
        setValue(`recommendations_list.${index}.catalog_item_id`, itemId);
        if (!(watch(`recommendations_list.${index}.text`) || '').trim()) {
            setValue(`recommendations_list.${index}.text`, selected?.label ?? '');
        }
    };

    const { isAdvanced } = useAdvancedFields('consulta');
    const refractionAdv = useAdvancedToggle('consulta:refraccion');
    const cabeceraAdv = useAdvancedToggle('consulta:cabecera');
    const diagnosticoAdv = useAdvancedToggle('consulta:diagnostico');
    const observacionesAdv = useAdvancedToggle('consulta:observaciones');

    // Un campo avanzado se muestra solo si su sección tiene revelado "avanzado".
    const advVisible = (key, adv) => !isAdvanced(key) || adv.open;
    const filterFields = (fields, keyMap) =>
        fields.filter((f) => {
            const key = keyMap[f];
            return !key || !isAdvanced(key) || refractionAdv.open;
        });

    const topColumns = [
        { field: 'av_lectura', label: 'Lectura computador' },
        { field: 'avsc', label: 'AV.SC lejos', advKey: 'consulta:col_avsc' },
        { field: 'retinoscopia', label: 'Retinoscopia' },
        { field: 'avcc', label: 'AV.CC lejos', advKey: 'consulta:col_avcc' },
    ].filter((c) => !c.advKey || !isAdvanced(c.advKey) || refractionAdv.open);

    const rxUsoFields = filterFields(['esfera', 'cilindro', 'eje', 'add', 'avcc'], { cilindro: 'consulta:rx_uso_cilindro', avcc: 'consulta:rx_uso_avcc' });
    const subjFields = filterFields(['esfera', 'cilindro', 'eje', 'avl'], { esfera: 'consulta:subj_esfera', eje: 'consulta:subj_eje', avl: 'consulta:subj_avl' });
    const rxFinalFields = filterFields(['esfera', 'cilindro', 'eje', 'add', 'avl', 'prisma', 'base', 'dnp'], { avl: 'consulta:rx_final_avl', prisma: 'consulta:rx_final_prisma', base: 'consulta:rx_final_base' });

    const refractionAdvKeys = [
        'consulta:col_avsc', 'consulta:col_avcc', 'consulta:rx_uso_cilindro', 'consulta:rx_uso_avcc',
        'consulta:subj_esfera', 'consulta:subj_eje', 'consulta:subj_avl',
        'consulta:rx_final_avl', 'consulta:rx_final_prisma', 'consulta:rx_final_base',
        'consulta:grp_vision_cerca', 'consulta:lente_anterior',
    ];
    const hasRefractionAdvanced = refractionAdvKeys.some((k) => isAdvanced(k));
    const cabeceraHasAdvanced = isAdvanced('consulta:ultimo_control');
    const diagnosticoHasAdvanced = isAdvanced('consulta:diagnostico_adicional');
    const observacionesHasAdvanced = ['consulta:queratometria', 'consulta:examen_externo', 'consulta:vision_colores'].some((k) => isAdvanced(k));

    // Estilo/estado inicial de las secciones-módulo según estén marcadas avanzadas.
    const moduleSectionProps = (advKey) => ({
        variant: isAdvanced(advKey) ? 'advanced' : 'default',
        defaultOpen: !isAdvanced(advKey),
    });

    return (
      <RequiredErrorsCtx.Provider value={requiredErrors}>
        <form onSubmit={handleSubmit(onSubmit)} className="pb-24 lg:pb-8">
            <div className="sticky top-0 z-20 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <InlineBadge label={`Paciente ${patient.codigo_interno || patient.id}`} />
                    <InlineBadge label={`Estado: ${watch('estado') || 'borrador'}`} />
                    {lastSaved && (
                        <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                            <CheckCircle size={16} />
                            Guardado {lastSaved.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
                <div className="hidden flex-wrap items-center gap-3 lg:flex">
                    <Button type="button" variant="secondary" onClick={() => doSave(true)} loading={saving}>
                        <Clock size={18} /> Guardar borrador
                    </Button>
                    <Button type="button" variant="secondary" onClick={handleGeneratePdf}>
                        <Printer size={18} /> Imprimir
                    </Button>
                    <Button type="submit" loading={saving}>
                        <Save size={18} /> Completar consulta
                    </Button>
                </div>
            </div>

            <CollapsibleSection title="Cabecera clinica" subtitle="Resumen operativo del paciente y la consulta actual." sectionKey="cabecera">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                    <FormInput label="Fecha de consulta" name="fecha_consulta" register={register} type="date" />
                    <FormSelect label="Medico / Optometra" name="optometrista_id" register={register} options={optometrists} />
                    <FormInput label="Cedula / RUC" name="doctor_license" register={register} placeholder="Registro o licencia" />
                    <FormSelect label="Plantilla impresion" name="print_template_key" register={register} options={templateOptions.map((item) => ({ value: item.key, label: item.name }))} />
                    <FormInput label="Codigo interno" name="patient_codigo" register={register} value={patient.codigo_interno ?? ''} disabled />
                    <FormInput label="Paciente" name="patient_nombre" register={register} value={patient.nombre ?? ''} disabled />
                    <FormInput label="Edad" name="patient_edad" register={register} value={patient.edad ? `${patient.edad} anos` : ''} disabled />
                    <FormInput label="Ocupacion" name="patient_ocupacion" register={register} value={patient.ocupacion ?? ''} disabled />
                    <div className="lg:col-span-2">
                        <TextArea label="Motivo de consulta" name="motivo_consulta" register={register} rows={3} placeholder="Motivo principal, sintomas, seguimiento o reclamo..." />
                    </div>
                    {advVisible('consulta:ultimo_control', cabeceraAdv) && (
                        <FormInput label="Ultimo control" name="ultimo_control" register={register} type="date" />
                    )}
                    <FormInput label="Direccion" name="patient_direccion" register={register} value={patient.direccion ?? ''} disabled />
                    <div className="lg:col-span-4">
                        <TextArea label="Antecedentes" name="patient_antecedentes" register={register} rows={2} value={patient.antecedentes ?? ''} disabled />
                    </div>
                </div>
                {cabeceraHasAdvanced && (
                    <div className="mt-4">
                        <AdvancedToggleButton open={cabeceraAdv.open} onToggle={cabeceraAdv.toggle} />
                    </div>
                )}
                {previousConsultation && (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-amber-900">
                            <InlineBadge label={`Consulta previa #${previousConsultation.numero_consulta}`} />
                            <span>{previousConsultation.fecha_consulta}</span>
                            {previousConsultation.diagnostico_descripcion && (
                                <span>{previousConsultation.diagnostico_cie10} - {previousConsultation.diagnostico_descripcion}</span>
                            )}
                        </div>
                    </div>
                )}
            </CollapsibleSection>

            <CollapsibleSection title="Examen visual y refraccion" subtitle="Captura central de lectura, refraccion y receta final." sectionKey="refraccion">
                <div className="mb-6 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Ojo</th>
                                {topColumns.map((col) => (
                                    <th key={col.field} className="px-3 py-2 text-center text-xs font-semibold uppercase text-slate-500">{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {['od', 'oi'].map((eye) => (
                                <tr key={eye} className="border-b border-slate-200">
                                    <td className="px-3 py-3 font-semibold uppercase text-slate-700">{eye}</td>
                                    {topColumns.map((col) => {
                                        const fieldName = `${col.field}_${eye}`;
                                        const hasErr = requiredErrors.has(fieldName);
                                        return (
                                            <td key={col.field} className="px-2 py-2">
                                                <input className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${fieldErrorClass(hasErr)}`} {...register(fieldName)} />
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <EyeFieldGroup prefix="rx_uso" fields={rxUsoFields} register={register} errors={{}} label="RX en uso" />
                <EyeFieldGroup prefix="subj" fields={subjFields} register={register} errors={{}} label="Subjetivo" />
                <EyeFieldGroup prefix="rx_final" fields={rxFinalFields} register={register} errors={{}} label="RX final" />
                {advVisible('consulta:grp_vision_cerca', refractionAdv) && (
                    <EyeFieldGroup prefix="vc" fields={['esfera', 'cilindro', 'eje', 'av', 'dnp', 'avcc']} register={register} errors={{}} label="Vision de cerca" />
                )}
                {advVisible('consulta:lente_anterior', refractionAdv) && (
                    <TextArea label="Lente anterior" name="lente_anterior" register={register} rows={3} placeholder="Lente previo, marca, material y comparacion con receta anterior." />
                )}
                {hasRefractionAdvanced && (
                    <div className="mt-2">
                        <AdvancedToggleButton open={refractionAdv.open} onToggle={refractionAdv.toggle} />
                    </div>
                )}
            </CollapsibleSection>

            <CollapsibleSection title="Diagnostico clinico" subtitle="Catalogo configurable con soporte para multiples diagnosticos por ojo." sectionKey="diagnostico">
                <div className="space-y-4">
                    {diagnosesFieldArray.fields.map((field, index) => (
                        <div key={field.id} className="rounded-2xl border border-slate-200 p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-slate-800">Diagnostico {index + 1}</h3>
                                {diagnosesFieldArray.fields.length > 1 && (
                                    <button type="button" className="text-sm text-rose-600" onClick={() => diagnosesFieldArray.remove(index)}>
                                        <Trash2 size={16} className="inline-block" /> Quitar
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                                <FormSelect label="Ojo" name={`diagnoses.${index}.eye`} register={register} options={[{ value: 'od', label: 'OD' }, { value: 'oi', label: 'OI' }, { value: 'general', label: 'General' }]} />
                                <div className="flex flex-col gap-1 lg:col-span-2">
                                    <label className="text-sm font-medium text-slate-700">Catalogo</label>
                                    <select className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" value={watch(`diagnoses.${index}.catalog_item_id`) || ''} onChange={(event) => handleDiagnosisCatalogChange(index, event.target.value)}>
                                        <option value="">Seleccionar diagnostico...</option>
                                        {diagnosisOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.code ? `${option.code} - ${option.label}` : option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <FormInput label="Codigo" name={`diagnoses.${index}.code`} register={register} />
                                <div className="lg:col-span-3">
                                    <FormInput label="Descripcion" name={`diagnoses.${index}.description`} register={register} />
                                </div>
                                <div className="lg:col-span-4">
                                    <TextArea label="Notas" name={`diagnoses.${index}.notes`} register={register} rows={2} />
                                </div>
                            </div>
                        </div>
                    ))}
                    <Button type="button" variant="secondary" onClick={() => diagnosesFieldArray.append(defaultDiagnosis())}>
                        <Plus size={16} /> Agregar diagnostico
                    </Button>
                    {advVisible('consulta:diagnostico_adicional', diagnosticoAdv) && (
                        <TextArea label="Diagnostico adicional" name="diagnostico_adicional" register={register} rows={3} placeholder="Hallazgos, patologia asociada o aclaraciones diagnosticas." />
                    )}
                    {diagnosticoHasAdvanced && (
                        <AdvancedToggleButton open={diagnosticoAdv.open} onToggle={diagnosticoAdv.toggle} />
                    )}
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Recomendacion de lunas y recomendaciones medicas" subtitle="Seleccion rapida por catalogos y texto editable antes de guardar." sectionKey="recomendaciones">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="mb-4 flex items-center gap-2">
                            <InlineBadge label="M" />
                            <h3 className="font-semibold text-slate-800">Recomendacion lunas</h3>
                        </div>
                        <div className="space-y-4">
                            <FormSelect label="Material" name="lens_recommendation.material_item_id" register={register} options={materialOptions} />
                            <FormSelect label="Espesor" name="lens_recommendation.thickness_item_id" register={register} options={thicknessOptions} />
                            <FormSelect label="Proteccion" name="lens_recommendation.protection_item_id" register={register} options={protectionOptions} />
                            <TextArea label="Observacion" name="lens_recommendation.observation" register={register} rows={4} />
                        </div>
                    </div>
                    <div className="lg:col-span-2 rounded-2xl border border-slate-200 p-4">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-800">Recomendaciones medicas</h3>
                            <Button type="button" variant="secondary" onClick={() => recommendationsFieldArray.append(defaultRecommendation())}>
                                <Plus size={16} /> Agregar
                            </Button>
                        </div>
                        <div className="space-y-4">
                            {recommendationsFieldArray.fields.map((field, index) => (
                                <div key={field.id} className="rounded-2xl border border-slate-200 p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-700">Recomendacion {index + 1}</span>
                                        {recommendationsFieldArray.fields.length > 1 && (
                                            <button type="button" className="text-sm text-rose-600" onClick={() => recommendationsFieldArray.remove(index)}>
                                                <Trash2 size={16} className="inline-block" /> Quitar
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                                        <div className="lg:col-span-1">
                                            <label className="text-sm font-medium text-slate-700">Catalogo</label>
                                            <select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" value={watch(`recommendations_list.${index}.catalog_item_id`) || ''} onChange={(event) => handleRecommendationCatalogChange(index, event.target.value)}>
                                                <option value="">Seleccionar sugerencia...</option>
                                                {recommendationOptions.map((option) => (
                                                    <option key={option.id} value={option.id}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="lg:col-span-2">
                                            <TextArea label="Texto editable" name={`recommendations_list.${index}.text`} register={register} rows={3} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Observaciones clinicas, queratometria y examen externo" subtitle="Texto libre y hallazgos auxiliares del examen." sectionKey="observaciones">
                <div className="mb-4">
                    <TextArea label="Observaciones clinicas" name="observaciones" register={register} rows={6} placeholder="Comentarios del caso, comparacion con recetas previas, seguimiento y observaciones libres..." />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {advVisible('consulta:queratometria', observacionesAdv) && (
                        <FormInput label="Queratometria OD" name="queratometria_od" register={register} placeholder="K1 / K2 @ eje" />
                    )}
                    {advVisible('consulta:queratometria', observacionesAdv) && (
                        <FormInput label="Queratometria OI" name="queratometria_oi" register={register} placeholder="K1 / K2 @ eje" />
                    )}
                    {advVisible('consulta:examen_externo', observacionesAdv) && (
                        <TextArea label="Examen externo OD" name="examen_externo_od" register={register} rows={3} />
                    )}
                    {advVisible('consulta:examen_externo', observacionesAdv) && (
                        <TextArea label="Examen externo OI" name="examen_externo_oi" register={register} rows={3} />
                    )}
                    {advVisible('consulta:vision_colores', observacionesAdv) && (
                        <FormInput label="Vision de colores" name="vision_colores" register={register} placeholder="14/14 Test Ishihara" />
                    )}
                </div>
                {observacionesHasAdvanced && (
                    <div className="mt-2">
                        <AdvancedToggleButton open={observacionesAdv.open} onToggle={observacionesAdv.toggle} />
                    </div>
                )}
            </CollapsibleSection>

            <CollapsibleSection title="Motor, binocular y reflejos" subtitle="Registro por ojo con observacion general por prueba." sectionKey="motor_binocular" {...moduleSectionProps('consulta:sec_motor_binocular')}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Prueba</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-slate-500">OD</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-slate-500">OI</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-slate-500">Observacion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['ducciones', 'Ducciones'],
                                ['versiones', 'Versiones'],
                                ['ppc', 'P.P.C.'],
                                ['cover_test', 'Cover test'],
                                ['reflejos_pupilares', 'Reflejos pupilares'],
                                ['test_hirschberg', 'Test de Hirschberg'],
                            ].map(([key, label]) => (
                                <tr key={key} className="border-b border-slate-200">
                                    <td className="px-3 py-3 font-medium text-slate-700">{label}</td>
                                    <td className="px-2 py-2"><input className="w-full rounded-xl border border-slate-300 px-3 py-2" {...register(`motor_binocular_data.${key}.od`)} /></td>
                                    <td className="px-2 py-2"><input className="w-full rounded-xl border border-slate-300 px-3 py-2" {...register(`motor_binocular_data.${key}.oi`)} /></td>
                                    <td className="px-2 py-2"><input className="w-full rounded-xl border border-slate-300 px-3 py-2" {...register(`motor_binocular_data.${key}.observacion`)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Modulo de lentes de contacto" subtitle="Adaptacion, lente de prueba y lente definitivo." sectionKey="lentes_contacto" {...moduleSectionProps('consulta:sec_lentes_contacto')}>
                <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
                    <FormInput label="Diametro pupilar" name="contact_lens_module.diametro_pupilar" register={register} />
                    <FormInput label="Diametro corneal" name="contact_lens_module.diametro_corneal" register={register} />
                    <FormInput label="Apertura palpebral" name="contact_lens_module.apertura_palpebral" register={register} />
                    <FormInput label="Tension palpebral" name="contact_lens_module.tension_palpebral" register={register} />
                    <FormSelect label="Ojo dominante" name="contact_lens_module.ojo_dominante" register={register} options={[{ value: 'OD', label: 'OD' }, { value: 'OI', label: 'OI' }]} />
                    <FormInput label="BUT" name="contact_lens_module.but_value" register={register} />
                    <FormInput label="Shirmer test" name="contact_lens_module.shirmer_test" register={register} />
                    <FormInput label="Frecuencia de parpadeo" name="contact_lens_module.frecuencia_parpadeo" register={register} />
                    <div className="lg:col-span-4">
                        <TextArea label="Observaciones" name="contact_lens_module.observaciones" register={register} rows={3} />
                    </div>
                </div>
                <div className="mb-6 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Lente de prueba</th>
                                {['Curva base', 'Poder', '%H2O', 'Material', 'Diametro', 'Sobre-refraccion', 'Agudeza visual'].map((column) => (
                                    <th key={column} className="px-3 py-2 text-center text-xs font-semibold uppercase text-slate-500">{column}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {['od', 'oi'].map((eye) => (
                                <tr key={eye} className="border-b border-slate-200">
                                    <td className="px-3 py-3 font-semibold uppercase text-slate-700">{eye}</td>
                                    {['curva_base', 'poder', 'h2o', 'material', 'diametro', 'sobre_refraccion', 'agudeza_visual'].map((field) => (
                                        <td key={field} className="px-2 py-2">
                                            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" {...register(`contact_lens_module.test_lens.${eye}.${field}`)} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Lente definitivo</th>
                                {['Curva base', 'Poder', 'Diametro', '%H2O', 'Material'].map((column) => (
                                    <th key={column} className="px-3 py-2 text-center text-xs font-semibold uppercase text-slate-500">{column}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {['od', 'oi'].map((eye) => (
                                <tr key={eye} className="border-b border-slate-200">
                                    <td className="px-3 py-3 font-semibold uppercase text-slate-700">{eye}</td>
                                    {['curva_base', 'poder', 'diametro', 'h2o', 'material'].map((field) => (
                                        <td key={field} className="px-2 py-2">
                                            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" {...register(`contact_lens_module.final_lens.${eye}.${field}`)} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Oftalmoscopia" subtitle="Parametros generales y tabla editable por distancias." sectionKey="oftalmoscopia" {...moduleSectionProps('consulta:sec_oftalmoscopia')}>
                <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <FormInput label="Fijacion OD" name="ophthalmoscopy_module.fijacion_od" register={register} />
                    <FormInput label="Fijacion OI" name="ophthalmoscopy_module.fijacion_oi" register={register} />
                    <FormInput label="Valoracion motora / test" name="ophthalmoscopy_module.valoracion_motora" register={register} />
                    <FormInput label="PPC OBJ" name="ophthalmoscopy_module.ppc_obj" register={register} />
                    <FormInput label="Luz" name="ophthalmoscopy_module.luz" register={register} />
                    <FormInput label="FR" name="ophthalmoscopy_module.fr" register={register} />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Fila</th>
                                {ophthalmoscopyDistances.map((distance) => (
                                    <th key={distance} className="px-3 py-2 text-center text-xs font-semibold uppercase text-slate-500">{distance}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ophthalmoscopyRows.map((row) => (
                                <tr key={row} className="border-b border-slate-200">
                                    <td className="px-3 py-3 font-medium text-slate-700">{row}</td>
                                    {ophthalmoscopyDistances.map((distance) => (
                                        <td key={`${row}-${distance}`} className="px-2 py-2">
                                            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" {...register(`ophthalmoscopy_module.results.${row}.${distance}`)} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Tratamiento" subtitle="Plan terapeutico y modalidad de uso." sectionKey="tratamiento" {...moduleSectionProps('consulta:sec_tratamiento')}>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <TextArea label="Plan de tratamiento" name="treatment_module.plan" register={register} rows={4} />
                    <div className="grid grid-cols-1 gap-4">
                        <FormInput label="Horas de uso" name="treatment_module.horas_uso" register={register} />
                        <FormInput label="Metodo de limpieza" name="treatment_module.metodo_limpieza" register={register} />
                        <FormInput label="Modalidad de uso" name="treatment_module.modalidad_uso" register={register} />
                    </div>
                </div>
            </CollapsibleSection>

            <div className="mobile-sticky-actions -mx-4 px-4 py-4 lg:hidden">
                <div className="grid grid-cols-3 gap-2">
                    <Button type="button" variant="secondary" className="justify-center" onClick={() => doSave(true)}>
                        <Clock size={18} /> Guardar
                    </Button>
                    <Button type="button" variant="secondary" className="justify-center" onClick={handleGeneratePdf}>
                        <FileText size={18} /> Vista previa
                    </Button>
                    <Button type="submit" className="justify-center" loading={saving}>
                        <Save size={18} /> Completar
                    </Button>
                </div>
            </div>

            <div className="hidden flex-wrap justify-end gap-3 pb-8 lg:flex">
                <Button type="button" variant="secondary" onClick={() => doSave(true)}>
                    <Clock size={20} /> Guardar borrador
                </Button>
                <Button type="button" variant="secondary" onClick={handleGeneratePdf}>
                    <FileText size={20} /> Vista previa
                </Button>
                <Button type="submit" loading={saving}>
                    <Save size={20} /> Completar consulta
                </Button>
            </div>

            {showPdf && pdfData && (
                <CertificadoPdf data={pdfData} onClose={() => setShowPdf(false)} />
            )}
        </form>

        {showRequiredModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle size={20} className="text-red-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Campos obligatorios incompletos</h3>
                            <p className="text-sm text-gray-500">Completa los siguientes campos para finalizar la consulta:</p>
                        </div>
                    </div>
                    <ul className="space-y-1.5 mb-5">
                        {missingLabels.map(label => (
                            <li key={label} className="flex items-center gap-2 text-sm text-red-700">
                                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                {label}
                            </li>
                        ))}
                    </ul>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => { setShowRequiredModal(false); }}
                            className="px-4 py-2 bg-[#1a2a4a] text-white rounded-lg text-sm font-medium hover:bg-[#253a6a] transition-colors"
                        >
                            Entendido, voy a completarlos
                        </button>
                    </div>
                </div>
            </div>
        )}
      </RequiredErrorsCtx.Provider>
    );
}
