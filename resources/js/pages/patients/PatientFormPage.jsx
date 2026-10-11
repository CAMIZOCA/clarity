import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, LogIn, Save, Search, UserCheck, WifiOff } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ErrorState from '../../components/ui/ErrorState';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import DateInput from '../../components/ui/DateInput';
import PatientMatchCard, { PatientMatchList } from '../../components/patients/PatientMatchCard';
import { AdvancedToggleButton, useAdvancedToggle } from '../../components/forms/AdvancedFieldsToggle';
import { useAdvancedFields } from '../../hooks/useAdvancedFields';
import { useAuth } from '../../contexts/AuthContext';
import { getPayload } from '../../api/response';
import { calculateAge, toDisplayDate, todayIso } from '../../utils/dates';
import { focusField, handleFieldNavigation } from '../../utils/fieldNavigation';
import {
    DOC_CEDULA, DOC_OTHER, birthDateError, centuryCorrection, documentTypeOf, emailError, hasLetters,
    isCompleteCedula, normalizeDocument, phoneError, registrationDateError,
} from '../../utils/patientValidation';

/**
 * Verificacion de la cedula contra `GET /patients/lookup`. El alta empieza por
 * ahi: el resto del formulario no se habilita hasta saber que el paciente no
 * existe, para no registrar dos veces a la misma persona.
 */
const DOC_IDLE = { status: 'idle', cedula: '', paciente: null, relacionados: [], mensaje: null };

// Estados en los que se puede seguir con el alta. Sin conexion no bloquea: el
// servidor repite la comprobacion al guardar.
const DOC_UNLOCKED = ['nuevo', 'sin_conexion'];

// Estados sin respuesta util: la misma cedula se vuelve a consultar.
const DOC_RETRYABLE = ['idle', 'sin_conexion', 'sesion', 'sin_permiso'];

// Sin limite, un servidor colgado dejaba "Verificando la cedula..." para
// siempre, con el formulario bloqueado y sin boton de reintentar.
const LOOKUP_TIMEOUT_MS = 8000;

const DOC_TYPES = [
    { value: DOC_CEDULA, label: 'Cédula / RUC' },
    { value: DOC_OTHER, label: 'Pasaporte u otro documento' },
];

const LETTERS_IN_CEDULA = 'La cédula o RUC solo lleva números. Si es un pasaporte, elija «Pasaporte u otro documento».';

// Orden en pantalla, para llevar el foco al primer campo con error.
const FIELD_ORDER = [
    'cedula', 'nombre', 'apellido', 'fecha_nacimiento', 'fecha_registro', 'ocupacion',
    'telefono', 'email', 'direccion', 'como_nos_conocio', 'antecedentes',
];

const FIELD_LABELS = {
    cedula: 'Documento',
    nombre: 'Nombre',
    apellido: 'Apellido',
    fecha_nacimiento: 'Fecha de nacimiento',
    fecha_registro: 'Fecha de registro',
    ocupacion: 'Ocupación',
    telefono: 'Teléfono',
    email: 'Email',
    direccion: 'Dirección',
    como_nos_conocio: 'Cómo nos conoció',
    antecedentes: 'Antecedentes',
};

// Campos que `GET /patients/identity` puede traer del Registro Civil.
const IDENTITY_FIELDS = ['nombre', 'apellido', 'fecha_nacimiento'];

// Lo que se pierde al salir del alta: la cedula sola se vuelve a teclear.
const DRAFT_FIELDS = FIELD_ORDER.filter((name) => name !== 'cedula' && name !== 'fecha_registro');

// Lo ya tecleado que "Es este paciente" lleva a la edicion del registro existente.
const CARRY_FIELDS = ['fecha_nacimiento', 'ocupacion', 'telefono', 'email', 'direccion', 'como_nos_conocio', 'antecedentes'];

/** Palabras de un nombre que sirven para buscar parecidos (mismo criterio que el servidor). */
const nameWords = (...parts) => parts.join(' ').split(/\s+/).filter((word) => word.length >= 3);

const text = (value) => String(value ?? '').trim();

function DocumentStatus({ isEdit, docType, doc, identity, onRetry }) {
    const base = 'flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm';
    const isOther = docType === DOC_OTHER;
    const retry = <button type="button" onClick={onRetry} className="font-semibold underline">Reintentar</button>;

    switch (doc.status) {
        case 'checking':
            return <p className={`${base} bg-gray-50 text-gray-600`}><Loader2 size={18} className="animate-spin" /> Verificando el documento...</p>;
        case 'nuevo': {
            const available = isOther ? 'Documento disponible' : 'Cédula disponible';
            let message = isEdit ? `${available}.` : `${available}: complete los datos del paciente.`;
            if (identity === 'loading') message = `${available}. Buscando los datos del paciente...`;
            if (identity === 'filled') message = `${available}. Datos completados automáticamente: verifíquelos.`;

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
                    {isEdit ? 'Este documento pertenece a otro paciente.' : 'Ya hay un paciente con este documento.'}
                </p>
            );
        case 'invalida':
            return (
                <p className={`${base} bg-red-50 text-red-700`}>
                    <AlertTriangle size={18} className="flex-shrink-0" /> {isOther ? 'Revise el documento.' : 'Revise la cédula.'}
                </p>
            );
        case 'sin_conexion':
            return (
                <div className={`${base} flex-wrap bg-amber-50 text-amber-900`}>
                    <WifiOff size={18} className="flex-shrink-0" />
                    <span className="flex-1">No se pudo verificar. Puede continuar; se comprobará al guardar.</span>
                    {retry}
                </div>
            );
        // Con la sesion vencida o sin permiso el guardado tambien fallaria: no
        // se invita a seguir llenando un formulario que no se va a poder enviar.
        case 'sesion':
            return (
                <div className={`${base} flex-wrap bg-red-50 text-red-700`}>
                    <LogIn size={18} className="flex-shrink-0" />
                    <span className="flex-1">Su sesión expiró. Inicie sesión en otra pestaña y pulse Reintentar: lo escrito sigue aquí.</span>
                    {retry}
                </div>
            );
        case 'sin_permiso':
            return (
                <p className={`${base} bg-red-50 text-red-700`}>
                    <AlertTriangle size={18} className="flex-shrink-0" /> Su usuario no tiene permiso para verificar pacientes.
                </p>
            );
        default:
            return (
                <p className={`${base} bg-gray-50 text-gray-600`}>
                    <Search size={18} className="flex-shrink-0" />
                    {isEdit
                        ? 'Si cambia el documento, se verifica que no sea de otro paciente.'
                        : 'Escriba el documento y pulse Enter: verificamos si el paciente ya está registrado.'}
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
    const location = useLocation();
    const [searchParams] = useSearchParams();
    // `?cedula=`: en el alta viene del buscador; en la edicion, de "es este
    // paciente" (corregir la cedula de un registro que ya existia).
    const presetRaw = searchParams.get('cedula') ?? '';
    const presetCedula = normalizeDocument(presetRaw, documentTypeOf(presetRaw));
    const { addToast } = useToast();
    const { can } = useAuth();
    const [loading, setLoading] = useState(false);
    // La edicion no se habilita hasta tener al paciente: con el formulario
    // abierto y vacio, "Actualizar" guardaba blancos sobre los datos reales.
    const [loadState, setLoadState] = useState(isEdit ? 'loading' : 'ready');
    const [reloadKey, setReloadKey] = useState(0);
    const [restoring, setRestoring] = useState(false);
    const [confirmRestore, setConfirmRestore] = useState(false);
    const [docType, setDocType] = useState(() => (isEdit ? DOC_CEDULA : documentTypeOf(presetRaw)));
    const [doc, setDoc] = useState(DOC_IDLE);
    const [similares, setSimilares] = useState([]);
    const [sharedEmail, setSharedEmail] = useState([]);
    // Autocompletado desde el Registro Civil: 'idle' | 'loading' | 'filled'.
    const [identity, setIdentity] = useState('idle');
    // Datos del Registro Civil que no se aplicaron solos porque ya habia algo escrito.
    const [suggestion, setSuggestion] = useState(null);

    const docRef = useRef(doc);
    docRef.current = doc;
    const docTypeRef = useRef(docType);
    const requestedCedula = useRef('');
    const loadedCedula = useRef('');
    const loadedBirth = useRef('');
    const debounceTimer = useRef(null);
    const pendingFocus = useRef(false);
    const similarKey = useRef('');
    const emailKey = useRef('');
    const matchRef = useRef(null);
    // Lo que lleno el autocompletado, para retirarlo si la cedula cambia.
    const autofilled = useRef({});
    // Salida ya decidida (guardado, "es este paciente"): no se vuelve a preguntar.
    const allowLeave = useRef(false);
    const carried = useRef(location.state?.carry ?? {});

    const {
        register, handleSubmit, reset, control, setError, clearErrors, setValue, getValues, setFocus, trigger, watch,
        formState: { errors, isDirty },
    } = useForm({
        defaultValues: { fecha_registro: todayIso(), cedula: isEdit ? '' : presetCedula },
    });
    const dirtyRef = useRef(isDirty);
    dirtyRef.current = isDirty;
    const [cedulaValue, birthValue] = watch(['cedula', 'fecha_nacimiento']);

    const { isAdvanced } = useAdvancedFields('paciente');
    const antecedentesAdv = useAdvancedToggle('paciente:antecedentes');
    const showAntecedentes = !isAdvanced('paciente:antecedentes') || antecedentesAdv.open;

    const unlocked = isEdit ? loadState === 'ready' : DOC_UNLOCKED.includes(doc.status);

    /**
     * Hay algo escrito que se perderia al salir. En el alta no cuenta lo que
     * puso el autocompletado: vuelve solo al teclear la cedula otra vez.
     */
    const hasUnsavedData = useCallback(() => {
        if (allowLeave.current) return false;
        if (isEdit) return dirtyRef.current;

        const values = getValues();

        return DRAFT_FIELDS.some((name) => {
            const value = text(values[name]);
            return value !== '' && value !== autofilled.current[name];
        });
    }, [isEdit, getValues]);

    // "Ver ficha", Cancelar, la flecha atras o el menu sacaban del formulario
    // sin avisar y todo lo tecleado se perdia.
    const blocker = useBlocker(useCallback(
        ({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname && hasUnsavedData(),
        [hasUnsavedData]
    ));

    useEffect(() => {
        const warn = (event) => {
            if (!hasUnsavedData()) return;
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [hasUnsavedData]);

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

    // En una familia es normal compartir el email, asi que no bloquea; pero
    // tambien delata a la misma persona registrada dos veces.
    const checkSharedEmail = useCallback(async () => {
        const email = text(getValues('email')).toLowerCase();
        if (email === emailKey.current) return;
        emailKey.current = email;

        if (email === '' || emailError(email) !== true) {
            setSharedEmail([]);
            return;
        }

        try {
            const data = getPayload(await client.get('/patients/lookup', {
                params: { email, ...(isEdit ? { exclude: id } : {}) },
                skipErrorToast: true,
            }));
            if (emailKey.current === email) setSharedEmail(data.mismo_email ?? []);
        } catch {
            // Es solo un aviso: sin respuesta, el formulario sigue igual.
        }
    }, [id, isEdit, getValues]);

    /**
     * Pone en el formulario los datos del Registro Civil y devuelve los que
     * dejo sin aplicar. Sin `force` no toca nada de lo que ya se escribio:
     *  - nombre y apellido van juntos: con "JUAN PEREZ" tecleado en Nombre,
     *    llenar solo Apellido dejaba "JUAN PEREZ PEREZ GOMEZ";
     *  - la fecha con el foco se respeta aunque su valor siga vacio: a medio
     *    escribir no tiene valor hasta el ultimo digito.
     */
    const applyIdentity = useCallback((person, force = false) => {
        const current = getValues();
        const focused = document.activeElement?.id;
        const namesFree = force || (!text(current.nombre) && !text(current.apellido));
        const pending = {};

        IDENTITY_FIELDS.forEach((name) => {
            const value = person[name];
            if (!value || text(current[name]) === value) return;

            const free = name === 'fecha_nacimiento'
                ? force || (!current[name] && focused !== name)
                : namesFree;

            if (!free) {
                pending[name] = value;
                return;
            }

            setValue(name, value, { shouldDirty: true, shouldValidate: true });
            autofilled.current[name] = value;

            // Tras verificar, el foco ya espera en Nombre: si el dato llega ahi
            // se deja seleccionado, o lo siguiente que se teclee se le pegaria
            // detras ("MARIA FERNANDAJUAN").
            if (focused === name) document.getElementById(name)?.select?.();
        });

        // El Registro Civil a veces solo trae el nombre completo: sin esto el
        // apellido tecleado quedaria pegado detras.
        if (force && person.nombre && !person.apellido) setValue('apellido', '', { shouldDirty: true });

        return pending;
    }, [getValues, setValue]);

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

            const person = {};
            IDENTITY_FIELDS.forEach((name) => {
                if (data?.[name]) person[name] = data[name];
            });

            const pending = applyIdentity(person);
            const filled = Object.keys(autofilled.current);

            setSuggestion(Object.keys(pending).length > 0 ? person : null);
            setIdentity(filled.length > 0 ? 'filled' : 'idle');
            if (filled.includes('nombre') || filled.includes('apellido')) checkSimilarNames();
        } catch {
            if (requestedCedula.current === cedula) setIdentity('idle');
        }
    }, [applyIdentity, checkSimilarNames]);

    const acceptSuggestion = () => {
        applyIdentity(suggestion, true);
        setSuggestion(null);
        setIdentity('filled');
        checkSimilarNames();
    };

    /** Retira lo autocompletado que nadie edito: pertenecia a otra cedula. */
    const clearAutofilled = () => {
        const names = Object.keys(autofilled.current);

        names.forEach((name) => {
            if (getValues(name) === autofilled.current[name]) setValue(name, '', { shouldDirty: true });
        });
        autofilled.current = {};
        setIdentity('idle');
        setSuggestion(null);

        if (names.length > 0) {
            similarKey.current = '';
            setSimilares([]);
        }
    };

    const verifyDocument = useCallback(async (raw, { focusNext = false, force = false } = {}) => {
        const type = docTypeRef.current;
        const cedula = normalizeDocument(raw, type);
        clearTimeout(debounceTimer.current);
        pendingFocus.current = focusNext;

        if (cedula === '') {
            requestedCedula.current = '';
            setDoc(DOC_IDLE);
            return;
        }

        const current = docRef.current;
        if (!force && cedula === current.cedula && !DOC_RETRYABLE.includes(current.status)) {
            // Ya verificada (o en camino): solo queda resolver el foco pendiente.
            if (current.status !== 'checking') setDoc({ ...current });
            return;
        }

        // El documento que el paciente en edicion ya tenia no puede ser de
        // otro, pero si un dato heredado que el servidor rechazara al guardar.
        const inherited = isEdit && cedula === loadedCedula.current;

        requestedCedula.current = cedula;
        setDoc({ ...DOC_IDLE, status: 'checking', cedula });

        try {
            const data = getPayload(await client.get('/patients/lookup', {
                params: { cedula, tipo: type, ...(isEdit ? { exclude: id } : {}) },
                timeout: LOOKUP_TIMEOUT_MS,
                // El resultado ya se muestra junto al campo.
                skipErrorToast: true,
            }));
            // La respuesta de una cedula que ya se cambio no cuenta.
            if (requestedCedula.current !== cedula) return;

            const estado = data.estado ?? 'nuevo';

            if (inherited) {
                setDoc(estado === 'invalida'
                    ? { ...DOC_IDLE, status: 'invalida', cedula, mensaje: data.mensaje ?? null }
                    : { ...DOC_IDLE, status: 'sin_cambio', cedula });
                return;
            }

            // Se guarda sin guiones ni espacios: que se vea igual que quedara.
            const typed = getValues('cedula');
            if (typed !== cedula && normalizeDocument(typed, type) === cedula) {
                setValue('cedula', cedula, { shouldDirty: true });
            }

            setDoc({
                status: estado,
                cedula,
                paciente: data.paciente ?? null,
                relacionados: data.relacionados ?? [],
                mensaje: data.mensaje ?? null,
            });

            // Sin await: el formulario ya esta habilitado y los datos llegan
            // despues. Un pasaporte no tiene nada que consultar.
            if (!isEdit && estado === 'nuevo' && type === DOC_CEDULA && isCompleteCedula(cedula)) {
                fetchIdentity(cedula);
            }
        } catch (err) {
            if (requestedCedula.current !== cedula) return;

            // Solo la falta de respuesta deja continuar. Antes cualquier error
            // decia "puede continuar": con la sesion vencida se llenaba todo el
            // formulario para fallar recien al guardar.
            const status = err.response?.status;
            let failure = 'sin_conexion';
            if (status === 401 || status === 419) failure = 'sesion';
            if (status === 403) failure = 'sin_permiso';

            setDoc({ ...DOC_IDLE, status: failure, cedula });
        }
    }, [id, isEdit, fetchIdentity, getValues, setValue]);

    // Tras Enter/Tab el foco sigue al resultado: a Nombre cuando el formulario
    // ya se habilito (no antes), o al paciente encontrado.
    useEffect(() => {
        if (!pendingFocus.current || doc.status === 'checking') return;
        pendingFocus.current = false;

        if (doc.status === 'nuevo') {
            const nombre = document.getElementById('nombre');
            if (nombre) focusField(nombre);
        } else if (doc.status === 'eliminado') {
            // A la tarjeta y no a su boton: con el foco en "Restaurar paciente",
            // un segundo Enter lo restauraba sin que nadie lo decidiera.
            matchRef.current?.focus();
        } else if (doc.paciente) {
            matchRef.current?.querySelector('button:not(:disabled)')?.focus();
        }
    }, [doc]);

    useEffect(() => () => clearTimeout(debounceTimer.current), []);

    useEffect(() => {
        if (!isEdit) {
            if (presetCedula) verifyDocument(presetCedula, { focusNext: true });
            return undefined;
        }

        let cancelled = false;
        setLoadState('loading');

        client.get(`/patients/${id}`, { skipErrorToast: true })
            .then((r) => {
                if (cancelled) return;

                const patient = getPayload(r);
                reset(patient);
                loadedCedula.current = normalizeDocument(patient.cedula, documentTypeOf(patient.cedula));
                loadedBirth.current = patient.fecha_nacimiento ?? '';

                const type = documentTypeOf(presetCedula || patient.cedula);
                docTypeRef.current = type;
                setDocType(type);

                // Lo que ya se habia tecleado en el alta antes de "Es este
                // paciente" completa lo que al registro le falta, sin pisarlo.
                const copied = Object.entries(carried.current).filter(([name, value]) => {
                    const stored = patient[name];
                    const missing = !stored || (name === 'fecha_nacimiento' && birthDateError(stored) !== true);
                    if (!value || !missing) return false;

                    setValue(name, value, { shouldDirty: true });
                    return true;
                });
                if (copied.length > 0) {
                    addToast('Se copiaron los datos que ya había escrito. Revíselos antes de guardar.', 'info');
                }

                setLoadState('ready');

                if (presetCedula && presetCedula !== loadedCedula.current) {
                    setValue('cedula', presetCedula, { shouldDirty: true });
                    verifyDocument(presetCedula);
                } else {
                    verifyDocument(patient.cedula);
                }
            })
            .catch(() => {
                if (!cancelled) setLoadState('error');
            });

        return () => { cancelled = true; };
    }, [id, isEdit, reloadKey, reset, addToast, presetCedula, setValue, verifyDocument]);

    // El servidor rechaza una edicion mientras quede un dato heredado invalido
    // (una fecha de nacimiento en 2055, un telefono "NO TIENE"). Se marca al
    // abrir, no al pulsar "Actualizar" despues de corregir otra cosa.
    useEffect(() => {
        if (!isEdit || loadState !== 'ready') return undefined;

        let cancelled = false;

        (async () => {
            let first = null;

            for (const name of FIELD_ORDER) {
                if (name === 'cedula') continue;
                if (!(await trigger(name)) && !first) first = name;
            }

            if (first && !cancelled) setFocus(first, { shouldSelect: true });
        })();

        return () => { cancelled = true; };
    }, [isEdit, loadState, trigger, setFocus]);

    // Una fecha completa se valida al momento: en el futuro o antes de 1900
    // solo se sabia al guardar.
    useEffect(() => {
        if (birthValue) trigger('fecha_nacimiento');
    }, [birthValue, trigger]);

    const handleCedulaChange = (event) => {
        const cedula = normalizeDocument(event.target.value, docTypeRef.current);
        clearTimeout(debounceTimer.current);

        if (cedula !== docRef.current.cedula) {
            // Cedula distinta de la verificada: el alta vuelve a bloquearse, sin
            // perder lo ya escrito en los demas campos.
            requestedCedula.current = '';
            setDoc(DOC_IDLE);
            clearAutofilled();
        }

        if (docTypeRef.current === DOC_CEDULA && isCompleteCedula(cedula)) {
            debounceTimer.current = setTimeout(() => verifyDocument(cedula), 400);
        }
    };

    const handleCedulaKeyDown = (event) => {
        if (isEdit || event.nativeEvent.isComposing) return;

        const isTab = event.key === 'Tab' && !event.shiftKey;
        if (!isTab && event.key !== 'Enter' && event.key !== 'ArrowDown') return;

        const cedula = normalizeDocument(event.currentTarget.value, docTypeRef.current);
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

    /**
     * Antes cualquier documento con una letra pasaba como pasaporte: una cedula
     * mal tecleada ("17100340q5") se registraba sin digito verificador y sin
     * encontrar al paciente que ya existia. El pasaporte se elige aqui.
     */
    const changeDocType = (next) => {
        if (next === docTypeRef.current) return;

        docTypeRef.current = next;
        setDocType(next);
        clearTimeout(debounceTimer.current);
        requestedCedula.current = '';
        setDoc(DOC_IDLE);
        clearAutofilled();
        clearErrors('cedula');

        // El mismo texto se valida distinto segun el tipo.
        const typed = getValues('cedula');
        if (normalizeDocument(typed, next) !== '') verifyDocument(typed, { force: true });

        document.getElementById('cedula')?.focus();
    };

    const cedulaField = register('cedula', {
        required: 'Requerido',
        onChange: handleCedulaChange,
        onBlur: (event) => verifyDocument(event.target.value, { focusNext: pendingFocus.current }),
    });

    const handleRestore = async () => {
        setConfirmRestore(false);
        setRestoring(true);
        try {
            const restored = getPayload(await client.post(`/patients/${doc.paciente.id}/restore`));
            addToast('Paciente restaurado', 'success');
            allowLeave.current = true;
            navigate(`/pacientes/${restored.id}`);
        } catch (err) {
            addToast(err.response?.data?.message || 'No se pudo restaurar el paciente', 'error');
        } finally {
            setRestoring(false);
        }
    };

    /** "Es este paciente": abre el registro existente con lo ya tecleado en el alta. */
    const openAsExisting = (patient) => {
        const values = getValues();
        const carry = {};

        CARRY_FIELDS.forEach((name) => {
            if (text(values[name]) !== '') carry[name] = text(values[name]);
        });

        allowLeave.current = true;
        navigate(
            `/pacientes/${patient.id}/editar?cedula=${encodeURIComponent(normalizeDocument(values.cedula, docTypeRef.current))}`,
            { state: { carry } }
        );
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

        const payload = { ...data, document_type: docTypeRef.current };

        setLoading(true);
        try {
            if (isEdit) {
                await client.put(`/patients/${id}`, payload);
                addToast('Paciente actualizado correctamente', 'success');
                allowLeave.current = true;
                navigate(`/pacientes/${id}`);
            } else {
                const created = getPayload(await client.post('/patients', payload));
                addToast('Paciente registrado correctamente', 'success');
                allowLeave.current = true;
                navigate(`/pacientes/${created.id}`);
            }
        } catch (err) {
            const status = err.response?.status;

            if (status === 401 || status === 419) {
                addToast('Su sesión expiró. Inicie sesión en otra pestaña y vuelva a guardar: lo escrito sigue aquí.', 'error');
            } else if (!applyServerErrors(err)) {
                addToast(err.response?.data?.message || 'Error al guardar', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const isOther = docType === DOC_OTHER;
    const cedulaError = errors.cedula?.message
        ?? (doc.status === 'invalida' ? doc.mensaje : null)
        ?? (!isOther && hasLetters(cedulaValue) ? LETTERS_IN_CEDULA : null)
        ?? (isEdit && doc.paciente ? `Pertenece a ${doc.paciente.nombre_completo}.` : null);
    const cedulaChanged = isEdit && doc.cedula !== '' && doc.status === 'nuevo';

    const age = calculateAge(birthValue);
    const ageHint = age === null ? undefined : `Edad: ${age} ${age === 1 ? 'año' : 'años'}.${age > 110 ? ' Revise el año.' : ''}`;
    // Solo para la fecha heredada: una futura recien tecleada es otro error.
    const birthFix = isEdit && birthValue === loadedBirth.current ? centuryCorrection(birthValue) : null;

    const pendingFixes = isEdit && loadState === 'ready'
        ? FIELD_ORDER.filter((name) => errors[name] || (name === 'cedula' && doc.status === 'invalida'))
        : [];

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

            {loadState === 'error' && (
                <div className="mb-6">
                    <ErrorState
                        compact
                        title="No se pudo cargar el paciente"
                        message="El formulario queda bloqueado para no guardar datos en blanco sobre los del paciente."
                        onRetry={() => setReloadKey((key) => key + 1)}
                    />
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleFieldNavigation} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-8 space-y-6">
                {loadState === 'loading' && (
                    <p className="flex items-center gap-2 text-sm text-gray-600">
                        <Loader2 size={18} className="animate-spin" /> Cargando los datos del paciente...
                    </p>
                )}

                {pendingFixes.length > 0 && (
                    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4">
                        <p className="font-semibold text-red-900">Corrija estos datos para poder guardar</p>
                        <p className="mt-0.5 text-sm text-red-800">
                            Vienen así del registro anterior o no pasan la validación; el paciente no se actualiza mientras sigan mal.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {pendingFixes.map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => setFocus(name, { shouldSelect: true })}
                                    className="min-h-11 rounded-lg border border-red-300 bg-white px-3 text-sm font-medium text-red-800 hover:bg-red-100"
                                >
                                    {FIELD_LABELS[name] ?? name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    <div role="radiogroup" aria-label="Tipo de documento" className="inline-flex flex-wrap gap-1 rounded-lg border border-gray-300 bg-gray-50 p-1">
                        {DOC_TYPES.map(({ value, label }) => (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={docType === value}
                                disabled={loadState !== 'ready'}
                                onClick={() => changeDocType(value)}
                                className={`min-h-11 rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50
                                    ${docType === value ? 'bg-[#1a2a4a] text-white' : 'text-gray-700 hover:bg-white'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-end">
                        <Input
                            label={isOther ? 'Pasaporte u otro documento' : 'Cédula / RUC'}
                            required
                            error={cedulaError}
                            hint={cedulaChanged
                                ? `Documento nuevo, se guarda al actualizar (antes: ${loadedCedula.current}).`
                                : (isOther ? 'De 5 a 15 letras o números, sin espacios ni guiones.' : undefined)}
                            inputMode={isOther ? 'text' : 'numeric'}
                            autoCapitalize="characters"
                            autoComplete="off"
                            autoFocus={!isEdit}
                            maxLength={20}
                            disabled={loadState !== 'ready'}
                            nextFieldId={isEdit ? 'nombre' : undefined}
                            enterKeyHint="next"
                            onKeyDown={handleCedulaKeyDown}
                            {...cedulaField}
                        />
                        <div aria-live="polite" className={cedulaError || cedulaChanged || isOther ? 'md:pb-5' : ''}>
                            <DocumentStatus
                                isEdit={isEdit}
                                docType={docType}
                                doc={doc}
                                identity={identity}
                                onRetry={() => verifyDocument(getValues('cedula'), { force: true })}
                            />
                        </div>
                    </div>
                </div>

                {doc.paciente && (
                    <div ref={matchRef} tabIndex={-1} className="rounded-2xl">
                        <PatientMatchCard
                            patient={doc.paciente}
                            title={isEdit ? 'Este documento ya es de otro paciente' : undefined}
                            deleted={doc.status === 'eliminado'}
                            canEdit={can('patients.edit')}
                            canRestore={can('patients.delete')}
                            onRestore={() => setConfirmRestore(true)}
                            restoring={restoring}
                        />
                    </div>
                )}

                <PatientMatchList
                    title={isOther ? 'Hay cédulas parecidas a este documento' : 'Hay cédulas relacionadas con esta'}
                    description={isOther
                        ? 'Si es una cédula mal escrita, corríjala y elija «Cédula / RUC». Si es otra persona, puede continuar.'
                        : 'Empiezan igual. Si es otra persona (por ejemplo un familiar), puede continuar.'}
                    patients={doc.relacionados}
                    newTab
                />

                <fieldset
                    disabled={!unlocked}
                    className={`min-w-0 space-y-6 transition-opacity ${unlocked ? '' : 'opacity-50'}`}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            label="Nombre"
                            required
                            maxLength={150}
                            error={errors.nombre?.message}
                            nextFieldId="apellido"
                            {...register('nombre', {
                                required: 'Requerido',
                                validate: (value) => text(value).length >= 2 || 'El nombre debe tener al menos 2 caracteres.',
                                onBlur: checkSimilarNames,
                            })}
                        />
                        <Input
                            label="Apellido"
                            maxLength={150}
                            hint="Los apellidos van aquí, no en Nombre."
                            error={errors.apellido?.message}
                            nextFieldId="fecha_nacimiento"
                            {...register('apellido', { onBlur: checkSimilarNames })}
                        />
                        {suggestion && (
                            <div className="md:col-span-2 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-start gap-3">
                                    <UserCheck size={22} className="mt-0.5 flex-shrink-0 text-blue-700" />
                                    <div className="min-w-0">
                                        <p className="font-semibold text-blue-900">El Registro Civil tiene otros datos para esta cédula</p>
                                        <p className="text-sm text-gray-800">
                                            {[
                                                [suggestion.nombre, suggestion.apellido].filter(Boolean).join(' '),
                                                suggestion.fecha_nacimiento && `Nacimiento: ${toDisplayDate(suggestion.fecha_nacimiento)}`,
                                            ].filter(Boolean).join(' · ')}
                                        </p>
                                        <p className="text-sm text-blue-800">No se cambió lo que usted ya escribió.</p>
                                    </div>
                                </div>
                                <div className="flex flex-shrink-0 gap-2">
                                    <Button size="sm" onClick={acceptSuggestion}>Usar estos datos</Button>
                                    <Button size="sm" variant="secondary" onClick={() => setSuggestion(null)}>Ignorar</Button>
                                </div>
                            </div>
                        )}
                        {similares.length > 0 && (
                            <div className="md:col-span-2">
                                <PatientMatchList
                                    title="Hay pacientes con un nombre parecido"
                                    description="Revise que no sea la misma persona registrada con otra cédula o con un código provisional."
                                    patients={similares}
                                    newTab
                                    renderAction={(patient) => can('patients.edit') && (
                                        <Button size="sm" onClick={() => openAsExisting(patient)}>
                                            Es este paciente
                                        </Button>
                                    )}
                                />
                            </div>
                        )}
                        <div>
                            <DateInput
                                control={control}
                                name="fecha_nacimiento"
                                label="Fecha de nacimiento"
                                required
                                hint={ageHint}
                                rules={{ required: 'Requerido', validate: birthDateError }}
                                nextFieldId="fecha_registro"
                            />
                            {birthFix && (
                                <button
                                    type="button"
                                    onClick={() => setValue('fecha_nacimiento', birthFix, { shouldDirty: true, shouldValidate: true })}
                                    className="mt-2 min-h-11 rounded-lg border border-[#1a2a4a] px-3 text-sm font-medium text-[#1a2a4a] hover:bg-gray-50"
                                >
                                    ¿Es {toDisplayDate(birthFix)}? Usar esa fecha
                                </button>
                            )}
                        </div>
                        <DateInput
                            control={control}
                            name="fecha_registro"
                            label="Fecha de registro"
                            hint="Se completa con la fecha de hoy."
                            rules={{ validate: registrationDateError }}
                            nextFieldId="ocupacion"
                        />
                        <Input
                            label="Ocupación"
                            maxLength={100}
                            error={errors.ocupacion?.message}
                            nextFieldId="telefono"
                            {...register('ocupacion')}
                        />
                        <Input
                            label="Teléfono"
                            type="tel"
                            maxLength={20}
                            hint="Celular, fijo o extranjero con + (ej. +57 300 1234567)."
                            error={errors.telefono?.message}
                            nextFieldId="email"
                            {...register('telefono', { validate: phoneError, onBlur: () => trigger('telefono') })}
                        />
                        <div className="md:col-span-2">
                            <Input
                                label="Email"
                                type="email"
                                maxLength={150}
                                error={errors.email?.message}
                                nextFieldId="direccion"
                                {...register('email', {
                                    validate: emailError,
                                    onBlur: () => {
                                        trigger('email');
                                        checkSharedEmail();
                                    },
                                })}
                            />
                        </div>
                        {sharedEmail.length > 0 && (
                            <div className="md:col-span-2">
                                <PatientMatchList
                                    title="Este email ya lo usa otro paciente"
                                    description="Si es un familiar puede continuar. Si es la misma persona, no la registre dos veces."
                                    patients={sharedEmail}
                                    newTab
                                />
                            </div>
                        )}
                        <div className="md:col-span-2">
                            <Input
                                label="Dirección"
                                maxLength={250}
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
                                maxLength={500}
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
                                    maxLength={2000}
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

                <div className="mobile-sticky-actions -mx-5 px-5 py-4 sm:hidden">
                    <div className="flex flex-col gap-3">
                        <Button type="submit" size="lg" loading={loading} disabled={!unlocked} className="w-full justify-center">
                            <Save size={20} />
                            {isEdit ? 'Actualizar' : 'Registrar Paciente'}
                        </Button>
                        <Button type="button" variant="secondary" size="lg" onClick={() => navigate(-1)} className="w-full justify-center">
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

            <ConfirmModal
                open={confirmRestore}
                variant="success"
                title="¿Restaurar al paciente?"
                message={doc.paciente ? `${doc.paciente.nombre_completo} volverá a la lista de pacientes con su historial.` : null}
                confirmLabel="Restaurar"
                onConfirm={handleRestore}
                onCancel={() => setConfirmRestore(false)}
            />

            <ConfirmModal
                open={blocker.state === 'blocked'}
                title="¿Salir sin guardar?"
                message="Los datos que escribió en este formulario se perderán."
                confirmLabel="Salir sin guardar"
                onConfirm={() => blocker.proceed?.()}
                onCancel={() => blocker.reset?.()}
            />
        </div>
    );
}
