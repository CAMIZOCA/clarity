import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Save, Search, WifiOff } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import DateInput from '../../components/ui/DateInput';
import PatientMatchCard, { PatientMatchList } from '../../components/patients/PatientMatchCard';
import { AdvancedToggleButton, useAdvancedToggle } from '../../components/forms/AdvancedFieldsToggle';
import { useAdvancedFields } from '../../hooks/useAdvancedFields';
import { useAuth } from '../../contexts/AuthContext';
import { getPayload } from '../../api/response';
import { todayIso } from '../../utils/dates';
import { focusField, handleFieldNavigation } from '../../utils/fieldNavigation';

/**
 * Verificacion de la cedula contra `GET /patients/lookup`. El alta empieza por
 * ahi: el resto del formulario no se habilita hasta saber que el paciente no
 * existe, para no registrar dos veces a la misma persona.
 */
const DOC_IDLE = { status: 'idle', cedula: '', paciente: null, relacionados: [], mensaje: null };

// Estados en los que se puede seguir con el alta. Sin conexion no bloquea: el
// `unique` del servidor sigue siendo la ultima barrera.
const DOC_UNLOCKED = ['nuevo', 'sin_conexion'];

// Orden en pantalla, para llevar el foco al primer campo que rechazo el servidor.
const FIELD_ORDER = [
    'cedula', 'nombre', 'apellido', 'fecha_nacimiento', 'fecha_registro', 'ocupacion',
    'telefono', 'email', 'direccion', 'como_nos_conocio', 'antecedentes',
];

// Campos que `GET /patients/identity` puede traer del Registro Civil.
const IDENTITY_FIELDS = ['nombre', 'apellido', 'fecha_nacimiento'];

const normalizeDocument = (value) => String(value ?? '').trim().toUpperCase();

/** Una cedula (10) o un RUC (13) completos: se verifican sin esperar a Enter. */
const isCompleteDocument = (value) => /^(\d{10}|\d{13})$/.test(value.replace(/[\s-]/g, ''));

/** Palabras de un nombre que sirven para buscar parecidos (mismo criterio que el servidor). */
const nameWords = (...parts) => parts.join(' ').split(/\s+/).filter((word) => word.length >= 3);

function DocumentStatus({ isEdit, doc, identity, onRetry }) {
    const base = 'flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm';

    switch (doc.status) {
        case 'checking':
            return <p className={`${base} bg-gray-50 text-gray-600`}><Loader2 size={18} className="animate-spin" /> Verificando la cédula...</p>;
        case 'nuevo': {
            let message = isEdit ? 'Cédula disponible.' : 'Cédula disponible: complete los datos del paciente.';
            if (identity === 'loading') message = 'Cédula disponible. Buscando los datos del paciente...';
            if (identity === 'filled') message = 'Cédula disponible. Datos completados automáticamente: verifíquelos.';

            return (
                <p className={`${base} bg-green-50 text-green-800`}>
                    {identity === 'loading'
                        ? <Loader2 size={18} className="flex-shrink-0 animate-spin" />
                        : <CheckCircle2 size={18} className="flex-shrink-0" />}
                    {message}
                </p>
            );
        }
        case 'existe':
        case 'eliminado':
            return (
                <p className={`${base} bg-amber-50 text-amber-900`}>
                    <AlertTriangle size={18} className="flex-shrink-0" />
                    {isEdit ? 'Esta cédula pertenece a otro paciente.' : 'Ya hay un paciente con esta cédula.'}
                </p>
            );
        case 'invalida':
            return <p className={`${base} bg-red-50 text-red-700`}><AlertTriangle size={18} className="flex-shrink-0" /> Revise la cédula.</p>;
        case 'sin_conexion':
            return (
                <div className={`${base} flex-wrap bg-amber-50 text-amber-900`}>
                    <WifiOff size={18} className="flex-shrink-0" />
                    <span className="flex-1">No se pudo verificar. Puede continuar; se comprobará al guardar.</span>
                    <button type="button" onClick={onRetry} className="font-semibold underline">Reintentar</button>
                </div>
            );
        default:
            return (
                <p className={`${base} bg-gray-50 text-gray-600`}>
                    <Search size={18} className="flex-shrink-0" />
                    {isEdit
                        ? 'Si cambia la cédula, se verifica que no sea de otro paciente.'
                        : 'Escriba la cédula y pulse Enter: verificamos si el paciente ya está registrado.'}
                </p>
            );
    }
}

/**
 * `/pacientes/nuevo` y `/pacientes/:id/editar` comparten este componente y React
 * Router no lo vuelve a montar al pasar de una a otra. La `key` lo fuerza: sin
 * ella, "Actualizar datos" abriria la edicion con la verificacion del alta
 * todavia en pantalla.
 */
export default function PatientFormPage() {
    const { id } = useParams();

    return <PatientForm key={id ?? 'nuevo'} id={id} />;
}

function PatientForm({ id }) {
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // `?cedula=`: en el alta viene del buscador; en la edicion, de "es este
    // paciente" (corregir la cedula de un registro que ya existia).
    const presetCedula = normalizeDocument(searchParams.get('cedula'));
    const { addToast } = useToast();
    const { can } = useAuth();
    const [loading, setLoading] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [doc, setDoc] = useState(DOC_IDLE);
    const [similares, setSimilares] = useState([]);
    // Autocompletado desde el Registro Civil: 'idle' | 'loading' | 'filled'.
    const [identity, setIdentity] = useState('idle');

    const docRef = useRef(doc);
    docRef.current = doc;
    const requestedCedula = useRef('');
    const loadedCedula = useRef('');
    const debounceTimer = useRef(null);
    const pendingFocus = useRef(false);
    const similarKey = useRef('');
    const matchRef = useRef(null);
    // Lo que lleno el autocompletado, para retirarlo si la cedula cambia.
    const autofilled = useRef({});

    const { register, handleSubmit, reset, control, setError, setValue, getValues, trigger, formState: { errors } } = useForm({
        defaultValues: { fecha_registro: todayIso(), cedula: isEdit ? '' : presetCedula },
    });
    const { isAdvanced } = useAdvancedFields('paciente');
    const antecedentesAdv = useAdvancedToggle('paciente:antecedentes');
    const showAntecedentes = !isAdvanced('paciente:antecedentes') || antecedentesAdv.open;

    const unlocked = isEdit || DOC_UNLOCKED.includes(doc.status);

    // Segunda red: los importados sin cedula llevan un codigo provisional
    // ("HIST-00123") que ninguna cedula encuentra, pero el nombre si.
    const checkSimilarNames = useCallback(async () => {
        if (isEdit) return;

        const { nombre = '', apellido = '' } = getValues();
        const key = `${nombre} ${apellido}`.trim().toUpperCase();
        if (key === similarKey.current) return;
        similarKey.current = key;

        if (nameWords(nombre, apellido).length < 2) {
            setSimilares([]);
            return;
        }

        try {
            const data = getPayload(await client.get('/patients/lookup', { params: { nombre, apellido } }));
            if (similarKey.current === key) setSimilares(data.similares ?? []);
        } catch {
            // Es solo un aviso: sin respuesta, el alta sigue igual.
        }
    }, [isEdit, getValues]);

    /**
     * Trae nombre, apellido y fecha de nacimiento de una cedula sin registrar.
     * Es una ayuda: sin respuesta (servicio sin saldo, caido o apagado) no se
     * avisa nada y el formulario se llena a mano, como siempre.
     */
    const fetchIdentity = useCallback(async (cedula) => {
        setIdentity('loading');

        try {
            const data = getPayload(await client.get('/patients/identity', { params: { cedula } }));
            // La respuesta de una cedula que ya se cambio no cuenta.
            if (requestedCedula.current !== cedula) return;

            IDENTITY_FIELDS.forEach((name) => {
                // Lo que ya se tecleo mientras llegaba la respuesta no se pisa.
                if (data?.[name] && !getValues(name)) {
                    setValue(name, data[name], { shouldDirty: true, shouldValidate: true });
                    autofilled.current[name] = data[name];
                }
            });

            const filled = Object.keys(autofilled.current);
            setIdentity(filled.length > 0 ? 'filled' : 'idle');
            if (filled.includes('nombre') || filled.includes('apellido')) checkSimilarNames();
        } catch {
            if (requestedCedula.current === cedula) setIdentity('idle');
        }
    }, [getValues, setValue, checkSimilarNames]);

    /** Retira lo autocompletado que nadie edito: pertenecia a otra cedula. */
    const clearAutofilled = () => {
        const names = Object.keys(autofilled.current);

        names.forEach((name) => {
            if (getValues(name) === autofilled.current[name]) setValue(name, '', { shouldDirty: true });
        });
        autofilled.current = {};
        setIdentity('idle');

        if (names.length > 0) {
            similarKey.current = '';
            setSimilares([]);
        }
    };

    const verifyDocument = useCallback(async (raw, { focusNext = false, force = false } = {}) => {
        const cedula = normalizeDocument(raw);
        clearTimeout(debounceTimer.current);
        pendingFocus.current = focusNext;

        // Vacia, o la que el paciente en edicion ya tenia: nada que comprobar.
        if (cedula === '' || (isEdit && cedula === loadedCedula.current)) {
            requestedCedula.current = cedula;
            setDoc(DOC_IDLE);
            return;
        }

        const current = docRef.current;
        if (!force && cedula === current.cedula && !['idle', 'sin_conexion'].includes(current.status)) {
            // Ya verificada (o en camino): solo queda resolver el foco pendiente.
            if (current.status !== 'checking') setDoc({ ...current });
            return;
        }

        requestedCedula.current = cedula;
        setDoc({ ...DOC_IDLE, status: 'checking', cedula });

        try {
            const data = getPayload(await client.get('/patients/lookup', {
                params: { cedula, ...(isEdit ? { exclude: id } : {}) },
            }));
            // La respuesta de una cedula que ya se cambio no cuenta.
            if (requestedCedula.current !== cedula) return;

            setDoc({
                status: data.estado ?? 'nuevo',
                cedula,
                paciente: data.paciente ?? null,
                relacionados: data.relacionados ?? [],
                mensaje: data.mensaje ?? null,
            });

            // Sin await: el formulario ya esta habilitado y los datos llegan
            // despues. Un pasaporte no tiene nada que consultar.
            if (!isEdit && (data.estado ?? 'nuevo') === 'nuevo' && isCompleteDocument(cedula)) {
                fetchIdentity(cedula);
            }
        } catch {
            if (requestedCedula.current !== cedula) return;
            setDoc({ ...DOC_IDLE, status: 'sin_conexion', cedula });
        }
    }, [id, isEdit, fetchIdentity]);

    // Tras Enter/Tab el foco sigue al resultado: a Nombre cuando el formulario
    // ya se habilito (no antes), o a la primera accion del paciente encontrado.
    useEffect(() => {
        if (!pendingFocus.current || doc.status === 'checking') return;
        pendingFocus.current = false;

        if (doc.status === 'nuevo') {
            const nombre = document.getElementById('nombre');
            if (nombre) focusField(nombre);
        } else if (doc.paciente) {
            matchRef.current?.querySelector('button:not(:disabled)')?.focus();
        }
    }, [doc]);

    useEffect(() => () => clearTimeout(debounceTimer.current), []);

    useEffect(() => {
        if (isEdit) {
            client.get(`/patients/${id}`)
                .then(r => {
                    const patient = getPayload(r);
                    reset(patient);
                    loadedCedula.current = normalizeDocument(patient.cedula);

                    if (presetCedula && presetCedula !== loadedCedula.current) {
                        setValue('cedula', presetCedula, { shouldDirty: true });
                        verifyDocument(presetCedula);
                    }
                })
                .catch(() => addToast('No se pudo cargar el paciente', 'error'));
        } else if (presetCedula) {
            verifyDocument(presetCedula, { focusNext: true });
        }
    }, [id, isEdit, reset, addToast, presetCedula, setValue, verifyDocument]);

    const handleCedulaChange = (event) => {
        const cedula = normalizeDocument(event.target.value);
        clearTimeout(debounceTimer.current);

        if (cedula !== docRef.current.cedula) {
            // Cedula distinta de la verificada: el alta vuelve a bloquearse, sin
            // perder lo ya escrito en los demas campos.
            requestedCedula.current = '';
            setDoc(DOC_IDLE);
            clearAutofilled();
        }

        if (isCompleteDocument(cedula)) {
            debounceTimer.current = setTimeout(() => verifyDocument(cedula), 400);
        }
    };

    const handleCedulaKeyDown = (event) => {
        if (isEdit || event.nativeEvent.isComposing) return;

        const isTab = event.key === 'Tab' && !event.shiftKey;
        if (!isTab && event.key !== 'Enter' && event.key !== 'ArrowDown') return;

        const cedula = normalizeDocument(event.currentTarget.value);
        const answered = doc.cedula === cedula && !['idle', 'checking', 'nuevo'].includes(doc.status);

        // Con la respuesta ya en pantalla (paciente existente, cedula invalida),
        // Tab sigue su orden natural hacia las acciones de la tarjeta.
        if (isTab && answered) return;

        // Si no, el foco se queda aqui hasta tener respuesta: con los demas
        // campos deshabilitados Tab saltaria hasta "Cancelar", y con la cedula ya
        // disponible pasaria por los enlaces de las relacionadas antes que por Nombre.
        event.preventDefault();
        if (cedula === '') {
            trigger('cedula');
            return;
        }
        verifyDocument(cedula, { focusNext: true });
    };

    const cedulaField = register('cedula', {
        required: 'Requerido',
        onChange: handleCedulaChange,
        onBlur: (event) => verifyDocument(event.target.value, { focusNext: pendingFocus.current }),
    });

    const handleRestore = async () => {
        setRestoring(true);
        try {
            const restored = getPayload(await client.post(`/patients/${doc.paciente.id}/restore`));
            addToast('Paciente restaurado', 'success');
            navigate(`/pacientes/${restored.id}`);
        } catch (err) {
            addToast(err.response?.data?.message || 'No se pudo restaurar el paciente', 'error');
        } finally {
            setRestoring(false);
        }
    };

    /** Reparte un 422 por campo; devuelve false si la respuesta no era de validacion. */
    const applyServerErrors = (err) => {
        const fieldErrors = err.response?.status === 422 ? err.response.data?.errors : null;
        if (!fieldErrors) return false;

        const names = Object.keys(fieldErrors);
        const messageOf = (name) => [].concat(fieldErrors[name])[0];
        const first = FIELD_ORDER.find((name) => fieldErrors[name]);

        names.forEach((name) => {
            setError(name, { type: 'server', message: messageOf(name) }, { shouldFocus: name === first });
        });

        const lead = messageOf(first ?? names[0]);
        addToast(names.length > 1 ? `${lead} Hay ${names.length} campos por corregir.` : lead, 'error');

        // Otra persona registro la misma cedula mientras se llenaba el formulario.
        if (!isEdit && fieldErrors.cedula) verifyDocument(getValues('cedula'), { force: true });

        return true;
    };

    const onSubmit = async (data) => {
        if (!unlocked) return;

        setLoading(true);
        try {
            if (isEdit) {
                await client.put(`/patients/${id}`, data);
                addToast('Paciente actualizado correctamente', 'success');
            } else {
                const created = getPayload(await client.post('/patients', data));
                addToast('Paciente registrado correctamente', 'success');
                navigate(`/pacientes/${created.id}`);
                return;
            }
            navigate(`/pacientes/${id}`);
        } catch (err) {
            if (!applyServerErrors(err)) {
                addToast(err.response?.data?.message || 'Error al guardar', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const cedulaError = errors.cedula?.message
        ?? (doc.status === 'invalida' ? doc.mensaje : null)
        ?? (isEdit && doc.paciente ? `Pertenece a ${doc.paciente.nombre_completo}.` : null);
    const cedulaChanged = isEdit && doc.cedula !== '' && doc.status === 'nuevo';

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-24">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {isEdit ? 'Editar Paciente' : 'Nuevo Paciente'}
                    </h1>
                    <p className="text-gray-500">
                        {isEdit
                            ? 'Complete todos los campos del paciente'
                            : 'Empiece por la cédula: verificamos si el paciente ya está registrado'}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleFieldNavigation} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-end">
                    <Input
                        label="Cédula / RUC"
                        required
                        error={cedulaError}
                        hint={cedulaChanged ? `Cédula nueva, se guarda al actualizar (antes: ${loadedCedula.current}).` : undefined}
                        inputMode="numeric"
                        autoComplete="off"
                        autoFocus={!isEdit}
                        nextFieldId={isEdit ? 'nombre' : undefined}
                        enterKeyHint="next"
                        onKeyDown={handleCedulaKeyDown}
                        {...cedulaField}
                    />
                    <div aria-live="polite" className={cedulaError || cedulaChanged ? 'md:pb-5' : ''}>
                        <DocumentStatus isEdit={isEdit} doc={doc} identity={identity} onRetry={() => verifyDocument(doc.cedula, { force: true })} />
                    </div>
                </div>

                {doc.paciente && (
                    <div ref={matchRef}>
                        <PatientMatchCard
                            patient={doc.paciente}
                            title={isEdit ? 'Esta cédula ya es de otro paciente' : undefined}
                            deleted={doc.status === 'eliminado'}
                            canEdit={can('patients.edit')}
                            canRestore={can('patients.delete')}
                            onRestore={handleRestore}
                            restoring={restoring}
                        />
                    </div>
                )}

                <PatientMatchList
                    title="Hay cédulas relacionadas con esta"
                    description="Empiezan igual. Si es otra persona (por ejemplo un familiar), puede continuar."
                    patients={doc.relacionados}
                />

                <fieldset
                    disabled={!unlocked}
                    className={`min-w-0 space-y-6 transition-opacity ${unlocked ? '' : 'opacity-50'}`}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            label="Nombre"
                            required
                            error={errors.nombre?.message}
                            nextFieldId="apellido"
                            {...register('nombre', { required: 'Requerido', onBlur: checkSimilarNames })}
                        />
                        <Input
                            label="Apellido"
                            error={errors.apellido?.message}
                            nextFieldId="fecha_nacimiento"
                            {...register('apellido', { onBlur: checkSimilarNames })}
                        />
                        {similares.length > 0 && (
                            <div className="md:col-span-2">
                                <PatientMatchList
                                    title="Hay pacientes con un nombre parecido"
                                    description="Revise que no sea la misma persona registrada con otra cédula o con un código provisional."
                                    patients={similares}
                                    renderAction={(patient) => can('patients.edit') && (
                                        <Button
                                            size="sm"
                                            onClick={() => navigate(`/pacientes/${patient.id}/editar?cedula=${encodeURIComponent(normalizeDocument(getValues('cedula')))}`)}
                                        >
                                            Es este paciente
                                        </Button>
                                    )}
                                />
                            </div>
                        )}
                        <DateInput
                            control={control}
                            name="fecha_nacimiento"
                            label="Fecha de nacimiento"
                            required
                            rules={{ required: 'Requerido' }}
                            nextFieldId="fecha_registro"
                        />
                        <DateInput
                            control={control}
                            name="fecha_registro"
                            label="Fecha de registro"
                            hint="Se completa con la fecha de hoy."
                            nextFieldId="ocupacion"
                        />
                        <Input
                            label="Ocupación"
                            error={errors.ocupacion?.message}
                            nextFieldId="telefono"
                            {...register('ocupacion')}
                        />
                        <Input
                            label="Teléfono"
                            type="tel"
                            error={errors.telefono?.message}
                            nextFieldId="email"
                            {...register('telefono')}
                        />
                        <div className="md:col-span-2">
                            <Input
                                label="Email"
                                type="email"
                                error={errors.email?.message}
                                nextFieldId="direccion"
                                {...register('email')}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <Input
                                label="Dirección"
                                error={errors.direccion?.message}
                                nextFieldId="como_nos_conocio"
                                {...register('direccion')}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <Input
                                label="Quién le recomienda / ¿cómo nos conoció?"
                                placeholder="Recomendación de un conocido, redes sociales, pasaba por el local..."
                                hint="Texto libre: anote lo que indique el paciente."
                                error={errors.como_nos_conocio?.message}
                                nextFieldId="antecedentes"
                                {...register('como_nos_conocio')}
                            />
                        </div>
                        {showAntecedentes && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Antecedentes médicos oculares
                                </label>
                                <textarea
                                    id="antecedentes"
                                    rows={4}
                                    className="w-full px-3 py-2.5 text-base rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] focus:bg-[#fef08a]/20 resize-none"
                                    placeholder="Historial de enfermedades oculares, cirugías, alergias..."
                                    {...register('antecedentes')}
                                />
                                {errors.antecedentes?.message && (
                                    <p className="text-xs text-red-500">{errors.antecedentes.message}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {isAdvanced('paciente:antecedentes') && (
                        <AdvancedToggleButton open={antecedentesAdv.open} onToggle={antecedentesAdv.toggle} />
                    )}
                </fieldset>

                <div className="mobile-sticky-actions -mx-5 px-5 py-4 sm:-mx-8 sm:px-8">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button type="submit" size="lg" loading={loading} disabled={!unlocked} className="w-full justify-center sm:flex-1">
                            <Save size={20} />
                            {isEdit ? 'Actualizar' : 'Registrar Paciente'}
                        </Button>
                        <Button type="button" variant="secondary" size="lg" onClick={() => navigate(-1)} className="w-full justify-center sm:flex-1">
                            Cancelar
                        </Button>
                    </div>
                </div>

                <div className="hidden gap-3 pt-4 border-t border-gray-100 sm:flex">
                    <Button type="submit" size="lg" loading={loading} disabled={!unlocked}>
                        <Save size={20} />
                        {isEdit ? 'Actualizar' : 'Registrar Paciente'}
                    </Button>
                    <Button type="button" variant="secondary" size="lg" onClick={() => navigate(-1)}>
                        Cancelar
                    </Button>
                </div>
            </form>
        </div>
    );
}
