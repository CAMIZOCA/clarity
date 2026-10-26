import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useBlocker, useNavigate } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { Save, FileText, CheckCircle, Clock, Plus, Trash2, Printer, AlertTriangle, ArrowRight } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import DateInput from '../../components/ui/DateInput';
import ConfirmModal from '../../components/ui/ConfirmModal';
import EyeFieldGroup from '../../components/forms/EyeFieldGroup';
import RxHistoryPicker from '../../components/forms/RxHistoryPicker';
import DiagnosisPicker, { checklistRowIndexes } from '../../components/forms/DiagnosisPicker';
import CollapsibleSection, { FormReadOnlyContext, openCollapsibleSection } from '../../components/forms/CollapsibleSection';
import { AdvancedToggleButton, useAdvancedToggle } from '../../components/forms/AdvancedFieldsToggle';
import CertificadoPdf from '../../components/pdf/CertificadoPdf';
import { useToast } from '../../components/ui/Toast';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAdvancedFields } from '../../hooks/useAdvancedFields';
import { RequiredErrorsCtx } from '../../components/forms/RequiredErrorsContext';
import { displaySphere, displaySigned, formatOpticalForInput, normalizeMeasureWithNote, normalizeOpticalValue, withMeasureNote } from '../../utils/opticalFormat';
import { refractionWarnings } from '../../utils/refractionChecks';
import { toDisplayDate, toIsoDate, todayIso } from '../../utils/dates';
import { handleFieldNavigation } from '../../utils/fieldNavigation';
import { buildMotorBinocularDefaults } from '../../data/motorBinocularSchema';
import MotorBinocularSection from './MotorBinocularSection';

const REQUIRED_FIELD_LABELS = {
    optometrista_id: 'Médico / Optometrista',
    motivo_consulta: 'Motivo de consulta',
    fecha_consulta: 'Fecha de consulta',
    avsc_od: 'AV SC (Ojo derecho)',
    avsc_oi: 'AV SC (Ojo izquierdo)',
    rx_final_esfera_od: 'RX Visión de Lejos: esfera OD',
    rx_final_esfera_oi: 'RX Visión de Lejos: esfera OI',
    diagnostico_descripcion: 'Diagnóstico principal',
    lente_anterior: 'Lente anterior',
    observaciones: 'Observaciones clínicas',
    print_template_key: 'Plantilla de impresión',
    doctor_license: 'Registro SENESCYT del médico',
};

const isBlank = (value) => value === null || value === undefined || String(value).trim() === '';

// Campos de cabecera: cambiarlos no basta para crear una consulta nueva. Es la
// misma lista que ignora `ConsultationController::hasClinicalContent()`.
const HEADER_FIELD_KEYS = [
    'patient_id', 'optometrista_id', 'fecha_consulta', 'estado', 'doctor_license', 'print_template_key',
];

/**
 * Contenido real de unos valores del formulario: sin vacios, sin los objetos
 * y filas que quedan en blanco, con las claves ordenadas y todo como texto.
 *
 * react-hook-form crea `{ campo: '' }` al montar un input cuyo valor inicial
 * no existia (los modulos de una consulta importada llegan en `null`) y
 * devuelve "4" donde la API mando 4. Nada de eso lo escribio el usuario: una
 * foto que lo contara como cambio guardaba la consulta con solo abrirla.
 */
function meaningfulContent(value) {
    if (Array.isArray(value)) {
        const items = value.map(meaningfulContent).filter((item) => item !== undefined);

        return items.length ? items : undefined;
    }

    if (value !== null && typeof value === 'object') {
        const entries = Object.keys(value).sort()
            .map((key) => [key, meaningfulContent(value[key])])
            .filter(([, item]) => item !== undefined);

        return entries.length ? Object.fromEntries(entries) : undefined;
    }

    return isBlank(value) ? undefined : String(value);
}

/** Foto comparable de los valores del formulario. */
const snapshotOf = (values) => JSON.stringify(meaningfulContent(values) ?? {});

/** La misma foto sin la cabecera: lo que cuenta como contenido clinico. */
function clinicalSnapshotOf(values) {
    const clinical = { ...values };
    for (const key of HEADER_FIELD_KEYS) delete clinical[key];

    return snapshotOf(clinical);
}

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

const defaultSaleItem = () => ({
    tipo: 'otro',
    descripcion: '',
    precio: '',
    descuento_pct: '',
    total: '',
    nota: '',
});

// Orden de columnas en todas las tablas de medidas: esfera, cilindro, eje,
// prisma/base, AV, ADD y DP.
const RX_USO_COLUMNS = ['esfera', 'cilindro', 'eje', 'avcc', 'add'];

// Campos de esfera plana que aceptan "N" (neutro); cada uno viaja con un flag
// `<campo>_neutral` aparte, ya que la columna sigue siendo decimal|null.
const NEUTRAL_SPHERE_FIELDS = [
    'rx_uso_esfera_od', 'rx_uso_esfera_oi',
    'subj_esfera_od', 'subj_esfera_oi',
    'rx_final_esfera_od', 'rx_final_esfera_oi',
    'vc_esfera_od', 'vc_esfera_oi',
];

// Medidas que se muestran con signo explicito ("+0.75", "-0.25").
const SIGNED_OPTICAL_COLUMNS = ['esfera', 'cilindro', 'add'];
const SIGNED_OPTICAL_FIELDS = ['rx_uso', 'subj', 'rx_final', 'vc'].flatMap((prefix) =>
    SIGNED_OPTICAL_COLUMNS.flatMap((column) => [`${prefix}_${column}_od`, `${prefix}_${column}_oi`])
);

// Columnas que el formulario normaliza al salir del campo, con su tipo de medida.
const OPTICAL_COLUMN_TYPES = { esfera: 'sphere', cilindro: 'cylinder', eje: 'axis', add: 'add' };

/**
 * Esfera y cilindro de subjetivo y RX final admiten un texto sin numero
 * ("COMP"): el servidor lo guarda como nota y deja la medida en null.
 */
const allowsTextOnly = (name) => /^(subj|rx_final)_(esfera|cilindro)_o[di]$/.test(name);

/**
 * Deja las medidas del envio como las dejaria el formulario al salir del campo.
 *
 * El autoguardado puede caer con un campo todavia enfocado, y un cilindro
 * "075" sin normalizar se guardaba positivo: el signo por defecto solo lo pone
 * `normalizeOpticalValue`, el servidor respeta el que recibe.
 */
function normalizeOpticalPayload(payload) {
    const normalizeRow = (row, nameOf) => {
        for (const [column, type] of Object.entries(OPTICAL_COLUMN_TYPES)) {
            for (const eye of ['od', 'oi']) {
                const name = nameOf(column, eye);
                if (typeof row[name] === 'string' && !isBlank(row[name])) {
                    // La ADD es solo un numero; el resto admite una nota ("20 CC").
                    row[name] = type === 'add'
                        ? normalizeOpticalValue(row[name], type)
                        : normalizeMeasureWithNote(row[name], type, { allowTextOnly: allowsTextOnly(name) });
                }
            }
        }

        return row;
    };

    const normalized = { ...payload };
    for (const prefix of ['rx_uso', 'subj', 'rx_final', 'vc']) {
        normalizeRow(normalized, (column, eye) => `${prefix}_${column}_${eye}`);
    }
    normalized.rx_uso_entries = (payload.rx_uso_entries ?? []).map(
        (entry) => normalizeRow({ ...entry }, (column, eye) => `${column}_${eye}`)
    );

    return normalized;
}

/** Repone el signo en esfera, cilindro y ADD de una receta en uso. */
function signRxUsoEntry(entry) {
    for (const column of SIGNED_OPTICAL_COLUMNS) {
        for (const eye of ['od', 'oi']) {
            const key = `${column}_${eye}`;
            if (!isBlank(entry[key])) entry[key] = formatOpticalForInput(entry[key]);
        }
    }
    return entry;
}

/** Regla de las fechas de la consulta: hoy o antes (`YYYY-MM-DD` se compara como texto). */
const notFutureDate = (value) => isBlank(value) || value <= todayIso() || 'La fecha no puede ser futura.';

/** Importe escrito a mano: acepta coma decimal ("25,50"). */
const parseAmount = (value) => parseFloat(String(value ?? '').replace(',', '.')) || 0;

/**
 * Deja en un importe solo digitos y separador decimal mientras se escribe.
 * "$25" daba total 0.00 y despues un 422 que dejaba la consulta sin guardar.
 * Con `max`, un valor mayor se queda en el tope (un descuento de mas de 100%
 * daba un total negativo).
 */
function keepAmount(event, max = null) {
    const digits = String(event.target.value).replace(/[^\d.,]/g, '');
    const cleaned = max !== null && parseAmount(digits) > max ? String(max) : digits;

    if (cleaned !== event.target.value) event.target.value = cleaned;
}

// Una fila de modulo cuenta como llena si trae cualquiera de estos datos. Es el
// mismo criterio de `StoreConsultationRequest::dropEmptyModuleRows()`.
const MODULE_ROW_CONTENT_KEYS = {
    diagnoses: ['description', 'code', 'notes', 'catalog_item_id'],
    recommendations_list: ['text', 'catalog_item_id'],
    sale_items: ['descripcion', 'precio', 'total', 'nota'],
};

/**
 * Descarta las filas de diagnostico, recomendacion y venta que el usuario
 * nunca lleno.
 *
 * El formulario nace con filas en blanco, y la API las valida como
 * obligatorias en cuanto el array viene con elementos: sin este filtro,
 * guardar un borrador intacto (o el autoguardado de 30 s) respondia 422
 * pidiendo una descripcion que nadie escribio.
 *
 * `rowIndexes` guarda la posicion que cada fila enviada ocupa en el
 * formulario, para que un error `sale_items.0.precio` de la API se pueda
 * atribuir a la fila correcta aunque antes haya una en blanco.
 */
function stripEmptyModuleRows(values) {
    const payload = { ...values };
    const rowIndexes = {};

    for (const [module, contentKeys] of Object.entries(MODULE_ROW_CONTENT_KEYS)) {
        const kept = (values[module] ?? [])
            .map((row, index) => ({ row, index }))
            .filter(({ row }) => contentKeys.some((key) => !isBlank(row?.[key])));

        payload[module] = kept.map(({ row }) => row);
        rowIndexes[module] = kept.map(({ index }) => index);
    }

    return { payload, rowIndexes };
}

const emptyRxUsoEntry = () => RX_USO_COLUMNS.reduce(
    (entry, column) => ({ ...entry, [`${column}_od`]: '', [`${column}_oi`]: '' }),
    { observacion: '' }
);

/**
 * Recetas en uso del formulario.
 *
 * Las consultas guardadas antes de que existieran varias recetas solo tienen
 * las columnas planas `rx_uso_*`; se convierten en la primera entrada para que
 * el historico se siga viendo completo.
 */
/**
 * Repone junto a cada medida las letras guardadas aparte ("20" + "CC" -> "20 CC").
 * Va despues del signo y de la "N": la nota acompana al valor ya formateado.
 */
function applyMeasureNotes(values, notes) {
    for (const [field, note] of Object.entries(notes ?? {})) {
        if (isBlank(note)) continue;

        if (!isBlank(values[field])) {
            values[field] = withMeasureNote(values[field], note);
        } else if (allowsTextOnly(field)) {
            // Texto en lugar de la medida ("COMP"): no hay numero al que unirlo.
            values[field] = note;
        }
    }
    return values;
}

/** Si el flag `esfera_<ojo>_neutral` esta activo, el campo se muestra como "N". */
function applyNeutralSphereFlag(entry, eye) {
    if (entry[`esfera_${eye}_neutral`]) {
        entry[`esfera_${eye}`] = 'N';
    }
    return entry;
}

function buildRxUsoEntries(consultation) {
    const stored = consultation?.rx_uso_entries;
    if (Array.isArray(stored) && stored.length) {
        return stored.map((entry) => {
            const row = {
                ...emptyRxUsoEntry(),
                ...Object.fromEntries(
                    Object.entries(entry).map(([key, value]) => [key, value ?? ''])
                ),
            };
            signRxUsoEntry(row);
            applyNeutralSphereFlag(row, 'od');
            applyNeutralSphereFlag(row, 'oi');
            applyMeasureNotes(row, entry.notas);
            return row;
        });
    }

    const legacy = emptyRxUsoEntry();
    for (const column of RX_USO_COLUMNS) {
        for (const eye of ['od', 'oi']) {
            legacy[`${column}_${eye}`] = consultation?.[`rx_uso_${column}_${eye}`] ?? '';
        }
    }
    signRxUsoEntry(legacy);
    if (consultation?.rx_uso_esfera_od_neutral) legacy.esfera_od = 'N';
    if (consultation?.rx_uso_esfera_oi_neutral) legacy.esfera_oi = 'N';

    return [legacy];
}

/** Claves internas usadas en el `name` de react-hook-form para la matriz de oftalmoscopia. */
const ophthalmoscopyRowKey = (rowIndex) => `row${rowIndex}`;
const ophthalmoscopyColKey = (distIndex) => `col${distIndex}`;

/**
 * Convierte `results` almacenado (label-keyed, como viene de la API:
 * {"Sin Rx": {"200 mt": valor, ...}, ...}) a un objeto plano con claves
 * "row<i>"/"col<j>" por posicion. Desacopla el `name` de react-hook-form
 * del texto de fila/columna: un label con un punto literal (p.ej.
 * "OI Add +3.00") rompe el parser de paths de la libreria si se usa
 * directo como fragmento de `name`. Se evitan ademas segmentos puramente
 * numericos ("0", "1"...) porque react-hook-form los trata como indice de
 * field-array y no rellena su valor por defecto si la seccion no esta
 * registrada con `useFieldArray` (results.0.0 queda vacio; results.row0.col0
 * no, igual que ya funciona contact_lens_module.test_lens.od.curva_base).
 */
function ophthalmoscopyResultsToIndexed(storedResults, rows = [], distances = []) {
    const source = storedResults && typeof storedResults === 'object' ? storedResults : {};
    return rows.reduce((acc, row, rowIndex) => {
        const rowSource = source[row] && typeof source[row] === 'object' ? source[row] : {};
        acc[ophthalmoscopyRowKey(rowIndex)] = distances.reduce((inner, distance, distIndex) => {
            inner[ophthalmoscopyColKey(distIndex)] = rowSource[distance] ?? '';
            return inner;
        }, {});
        return acc;
    }, {});
}

/** Inversa de `ophthalmoscopyResultsToIndexed`: vuelve a label-keyed para el payload. */
function ophthalmoscopyResultsToLabeled(indexedResults, rows = [], distances = []) {
    const source = indexedResults && typeof indexedResults === 'object' ? indexedResults : {};
    return rows.reduce((acc, row, rowIndex) => {
        const rowSource = source[ophthalmoscopyRowKey(rowIndex)] ?? {};
        acc[row] = distances.reduce((inner, distance, distIndex) => {
            inner[distance] = rowSource[ophthalmoscopyColKey(distIndex)] ?? '';
            return inner;
        }, {});
        return acc;
    }, {});
}

function buildDefaultValues(patient, consultation, meta, defaultDoctor = null) {
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
                : null,
        ].filter(Boolean);

    const recommendationFallback = consultation?.recommendations_list?.length
        ? consultation.recommendations_list.map((item) => ({
            catalog_item_id: item.catalog_item_id ?? '',
            text: item.text ?? '',
        }))
        : consultation?.recomendaciones
            ? consultation.recomendaciones.split('\n').filter(Boolean).map((text) => ({ catalog_item_id: '', text }))
            : [defaultRecommendation()];

    const values = {
        patient_id: patient.id,
        // El medico por defecto es solo para una consulta nueva: en una ya
        // guardada sin medico, proponerlo lo asignaria al primer guardado.
        optometrista_id: consultation ? (consultation.optometrista_id ?? '') : (defaultDoctor?.id ?? ''),
        fecha_consulta: consultation?.fecha_consulta
            ? toIsoDate(consultation.fecha_consulta)
            : todayIso(),
        estado: consultation?.estado ?? 'borrador',
        motivo_consulta: consultation?.motivo_consulta ?? '',
        ultimo_control: consultation?.ultimo_control
            ? toIsoDate(consultation.ultimo_control)
            : '',
        doctor_license: consultation
            ? (consultation.doctor_license ?? consultation.optometrista?.registro_senescyt ?? '')
            : (defaultDoctor?.registro_senescyt ?? ''),
        print_template_key: consultation?.print_template_key ?? meta?.templates?.[0]?.key ?? '',
        near_vision_data: consultation?.near_vision_data ?? {},
        ...consultation,
        // Estas van despues del spread: `consultation.diagnoses` /
        // `.recommendations_list` / `.rx_uso_entries` son el array crudo de la
        // API (vacio en cuanto el usuario borra el texto y guarda), y
        // pisarian el fallback con filas en blanco que ya calculamos arriba.
        // `ophthalmoscopy_module.results` tambien: el spread reintroduce la
        // version label-keyed cruda de la API y pisa la conversion indexada
        // de mas arriba (necesaria para que react-hook-form registre bien
        // los inputs de esa matriz, ver `ophthalmoscopyResultsToIndexed`).
        //
        // Los modulos de abajo igual: una consulta importada los trae en
        // `null`, y antes del spread ese null pisaba el valor por defecto. Asi
        // se perdian en pantalla `luna_observacion` y las pruebas binoculares
        // heredadas (`cover_test`, `ppc`...), que solo viven en columnas planas.
        // `buildMotorBinocularDefaults` las recoge (y el PPC de Oftalmoscopia).
        lens_recommendation: {
            material_item_id: consultation?.lens_recommendation?.material_item_id ?? '',
            thickness_item_id: consultation?.lens_recommendation?.thickness_item_id ?? '',
            protection_item_id: consultation?.lens_recommendation?.protection_item_id ?? '',
            observation: consultation?.lens_recommendation?.observation ?? consultation?.luna_observacion ?? '',
        },
        motor_binocular_data: buildMotorBinocularDefaults(consultation),
        contact_lens_module: consultation?.contact_lens_module ?? {
            diametro_pupilar: '',
            diametro_corneal: '',
            apertura_palpebral: '',
            tension_palpebral: '',
            ojo_dominante: '',
            but_value: '',
            shirmer_test: '',
            dhiv: '',
            tincion: '',
            estado: '',
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
        treatment_module: consultation?.treatment_module ?? {
            plan: '',
            horas_uso: '',
            metodo_limpieza: '',
            modalidad_uso: '',
        },
        diagnoses: diagnosisFallback,
        recommendations_list: recommendationFallback,
        rx_uso_entries: buildRxUsoEntries(consultation),
        ophthalmoscopy_module: {
            fijacion_od: consultation?.ophthalmoscopy_module?.fijacion_od ?? '',
            fijacion_oi: consultation?.ophthalmoscopy_module?.fijacion_oi ?? '',
            valoracion_motora: consultation?.ophthalmoscopy_module?.valoracion_motora ?? '',
            ppc_obj: consultation?.ophthalmoscopy_module?.ppc_obj ?? '',
            luz: consultation?.ophthalmoscopy_module?.luz ?? '',
            fr: consultation?.ophthalmoscopy_module?.fr ?? '',
            results: ophthalmoscopyResultsToIndexed(
                consultation?.ophthalmoscopy_module?.results,
                Array.isArray(meta?.ophthalmoscopy_rows) ? meta.ophthalmoscopy_rows : [],
                Array.isArray(meta?.ophthalmoscopy_distances) ? meta.ophthalmoscopy_distances : []
            ),
        },
        sale_items: consultation?.sale_items?.length
            ? consultation.sale_items.map((item) => ({
                tipo: item.tipo ?? 'otro',
                descripcion: item.descripcion ?? '',
                precio: item.precio ?? '',
                descuento_pct: item.descuento_pct ?? '',
                total: item.total ?? '',
                nota: item.nota ?? '',
            }))
            : [defaultSaleItem()],
    };

    // Las columnas son decimales y no guardan el "+": se repone al cargar.
    for (const field of SIGNED_OPTICAL_FIELDS) {
        if (!isBlank(values[field])) {
            values[field] = formatOpticalForInput(values[field]);
        }
    }

    for (const field of NEUTRAL_SPHERE_FIELDS) {
        if (consultation?.[`${field}_neutral`]) {
            values[field] = 'N';
        }
    }

    applyMeasureNotes(values, consultation?.medidas_notas);

    return values;
}

// Seccion (`sectionKey` de CollapsibleSection) en la que vive cada campo. Una
// seccion colapsada no monta sus inputs: para llevar al usuario a un campo con
// error hay que saber que seccion abrir primero.
const FIELD_SECTION_RULES = [
    [/^(diagnoses\.|diagnostico_)/, 'diagnostico'],
    [/^(lens_recommendation\.|recommendations_list\.)/, 'recomendaciones'],
    [/^sale_items\./, 'venta'],
    [/^(observaciones$|queratometria_|examen_externo_)/, 'observaciones'],
    [/^motor_binocular_data\./, 'motor_binocular'],
    [/^contact_lens_module\./, 'lentes_contacto'],
    [/^ophthalmoscopy_module\./, 'oftalmoscopia'],
    [/^treatment_module\./, 'tratamiento'],
    [/^(av_lectura_|ark_|avsc_|avcc_|retinoscopia_|rx_uso_|lente_anterior$|subj_|rx_final_|vc_|vision_colores$)/, 'refraccion'],
    [/^(fecha_consulta|optometrista_id|doctor_license|print_template_key|motivo_consulta|ultimo_control)$/, 'cabecera'],
];

function sectionKeyForField(fieldName) {
    return FIELD_SECTION_RULES.find(([pattern]) => pattern.test(fieldName ?? ''))?.[1] ?? null;
}

function findFieldElement(fieldName) {
    // Las columnas planas `rx_uso_*` se editan en la primera receta en uso.
    const legacyRxUso = /^rx_uso_(esfera|cilindro|eje|add|avcc)_(od|oi)$/.exec(fieldName);
    const name = legacyRxUso ? `rx_uso_entries.0.${legacyRxUso[1]}_${legacyRxUso[2]}` : fieldName;

    // Casi todos los inputs usan el nombre del campo como `id`; los que no,
    // llevan al menos el `name` que les pone react-hook-form.
    return document.getElementById(name) ?? document.getElementsByName(name)[0] ?? null;
}

function focusAndCenter(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof element.focus === 'function') {
        element.focus({ preventScroll: true });
    }
}

/**
 * Lleva el foco al campo y lo centra en pantalla; devuelve si lo encontro.
 *
 * Antes un 422 solo mostraba un toast generico y el usuario tenia que adivinar
 * cual de los ~140 campos estaba mal.
 */
function scrollToField(fieldName) {
    const element = fieldName ? findFieldElement(fieldName) : null;
    if (!element) return false;

    focusAndCenter(element);
    return true;
}

/** Destino cuando el error no tiene input propio: el primer campo de su seccion. */
function scrollToSection(sectionKey) {
    const section = document.querySelector(`[data-section-key="${sectionKey}"]`);
    if (!section) return;

    focusAndCenter(
        section.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ?? section
    );
}

/**
 * Traduce el indice de fila de un error de la API al que ocupa en el formulario.
 * Un error en la nota de una medida (`medidas_notas.subj_eje_od`) es del campo
 * donde se escribio.
 */
function toFormFieldName(rawApiField, rowIndexes) {
    const apiField = rawApiField.replace(/^medidas_notas\./, '').replace(/\.notas\./, '.');
    const match = /^([a-z_]+)\.(\d+)\.(.+)$/.exec(apiField);
    const formIndex = match ? rowIndexes?.[match[1]]?.[Number(match[2])] : undefined;

    return formIndex === undefined ? apiField : `${match[1]}.${formIndex}.${match[3]}`;
}

/** Extrae del 422 de Laravel cada campo con su mensaje, mas un resumen legible. */
function readValidationErrors(error, rowIndexes) {
    const data = error?.response?.data;
    const errors = data?.errors;

    if (!errors || typeof errors !== 'object') {
        return { fieldErrors: [], message: data?.message ?? null };
    }

    // Laravel devuelve claves con puntos (rx_uso_entries.0.esfera_od); los
    // inputs usan exactamente ese mismo nombre como id.
    const fieldErrors = Object.entries(errors).map(([field, messages]) => ({
        field: toFormFieldName(field, rowIndexes),
        message: Array.isArray(messages) ? messages[0] : messages,
    }));
    const messages = fieldErrors.map(({ message }) => message).filter(Boolean);

    return {
        fieldErrors,
        message: messages.slice(0, 4).join('\n')
            + (messages.length > 4 ? `\n(+${messages.length - 4} error(es) mas)` : ''),
    };
}

/** Compara dos valores de campo sin distinguir vacio/null ni numero/texto. */
const sameFieldValue = (a, b) => String(a ?? '') === String(b ?? '');

const isScalar = (value) => value === null || value === undefined || typeof value !== 'object';

function fieldErrorClass(hasError) {
    return hasError
        ? 'border-red-400 ring-1 ring-red-400'
        : 'border-slate-300';
}

/** Campos que la configuracion exige para completar la consulta. */
function useRequiredFields() {
    const { settings } = useSettings();

    return Array.isArray(settings?.required_fields) ? settings.required_fields : [];
}

/**
 * Etiqueta de un campo. El `*` de obligatorio va desde el principio: antes
 * solo aparecia despues de intentar completar la consulta sin el dato.
 */
function FieldLabel({ name, label, invalid }) {
    const required = useRequiredFields().includes(name);

    return (
        <label htmlFor={name} className={`text-sm font-medium ${invalid ? 'text-red-600' : 'text-slate-700'}`}>
            {label}
            {required && <span className="ml-0.5 text-red-500" title="Obligatorio para completar la consulta">*</span>}
        </label>
    );
}

/** Bajo el campo: el mensaje de su error o, si no hay, la ayuda fija. */
function FieldNote({ name, message, hint }) {
    if (message) return <p id={`${name}-error`} className="text-xs text-red-600">{message}</p>;

    return hint ? <p className="text-xs text-slate-500">{hint}</p> : null;
}

/** Atributos de accesibilidad de un campo con error. */
const invalidProps = (name, hasError) => (hasError
    ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` }
    : {});

// Enter y las flechas pasan de campo desde el `onKeyDown` del <form>
// (`handleFieldNavigation`); por eso el teclado movil muestra "siguiente".
function FormInput({ label, register, name, type = 'text', inputMode, enterKeyHint = 'next', hint, ...props }) {
    const errors = useContext(RequiredErrorsCtx);
    const err = errors.has(name);
    const resolvedInputMode = inputMode ?? (type === 'number' ? 'decimal' : undefined);
    return (
        <div className="flex flex-col gap-1">
            <FieldLabel name={name} label={label} invalid={err} />
            <input
                id={name}
                type={type}
                inputMode={resolvedInputMode}
                enterKeyHint={enterKeyHint}
                className={`w-full min-h-11 rounded-xl border px-3 py-2.5 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-slate-900 ${fieldErrorClass(err)}`}
                {...invalidProps(name, err)}
                {...register(name)}
                {...props}
            />
            <FieldNote name={name} message={errors.get(name)} hint={hint} />
        </div>
    );
}

function FormSelect({ label, register, name, options = [], placeholder = 'Seleccionar...', registerOptions }) {
    const errors = useContext(RequiredErrorsCtx);
    const err = errors.has(name);
    return (
        <div className="flex flex-col gap-1">
            <FieldLabel name={name} label={label} invalid={err} />
            <select
                id={name}
                className={`w-full min-h-11 rounded-xl border px-3 py-2.5 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-slate-900 ${fieldErrorClass(err)}`}
                {...invalidProps(name, err)}
                {...register(name, registerOptions)}
            >
                <option value="">{placeholder}</option>
                {options.map((option) => (
                    <option key={option.id ?? option.value ?? option.label} value={option.id ?? option.value}>
                        {option.code ? `${option.code} - ${option.label}` : option.label}
                    </option>
                ))}
            </select>
            <FieldNote name={name} message={errors.get(name)} />
        </div>
    );
}

function TextArea({ label, register, name, rows = 3, placeholder, hint, ...props }) {
    const errors = useContext(RequiredErrorsCtx);
    const err = errors.has(name);
    return (
        <div className="flex flex-col gap-1">
            <FieldLabel name={name} label={label} invalid={err} />
            <textarea
                id={name}
                rows={rows}
                placeholder={placeholder}
                className={`w-full min-h-11 rounded-xl border px-3 py-2.5 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-slate-900 ${fieldErrorClass(err)}`}
                {...invalidProps(name, err)}
                {...register(name)}
                {...props}
            />
            <FieldNote name={name} message={errors.get(name)} hint={hint} />
        </div>
    );
}

/**
 * Dato del paciente que la cabecera solo muestra. No se registra en el
 * formulario: como <input disabled> viajaba en cada guardado y contaba como
 * un cambio aunque nadie hubiera escrito nada.
 */
function ReadOnlyField({ label, value, multiline = false }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">{label}</span>
            <div className={`w-full min-h-11 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600 ${multiline ? 'whitespace-pre-line' : ''}`}>
                {isBlank(value) ? '—' : value}
            </div>
        </div>
    );
}

const BADGE_TONES = {
    neutral: 'bg-slate-100 text-slate-700',
    draft: 'bg-amber-100 text-amber-800',
    done: 'bg-emerald-100 text-emerald-800',
};

function InlineBadge({ label, tone = 'neutral' }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${BADGE_TONES[tone]}`}>
            {label}
        </span>
    );
}

export default function ConsultationForm({ patient, consultation, meta, readOnly = false }) {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const requiredFields = useRequiredFields();
    const { user } = useAuth();
    const [saving, setSaving] = useState(false);
    const [consultationId, setConsultationId] = useState(consultation?.id ?? null);
    const [lastSaved, setLastSaved] = useState(null);
    const [showPdf, setShowPdf] = useState(false);
    const [pdfData, setPdfData] = useState(null);
    // Campo -> mensaje (ver `RequiredErrorsCtx`).
    const [requiredErrors, setRequiredErrors] = useState(new Map());
    const [showRequiredModal, setShowRequiredModal] = useState(false);
    // Campos obligatorios vacios, como `{ field, label }`.
    const [missingFields, setMissingFields] = useState([]);
    // Se levanta cuando un guardado falla y solo baja cuando uno funciona.
    const [unsavedError, setUnsavedError] = useState(null);
    // Errores por campo del ultimo 422, como `{ field, message }`.
    const [fieldErrors, setFieldErrors] = useState([]);
    // Avisos de las medidas (`refractionChecks.js`), como `{ field, message, blocking }`.
    const [rxWarnings, setRxWarnings] = useState([]);
    const [showRxReview, setShowRxReview] = useState(false);
    const autosaveTimerRef = useRef(null);
    // El id tambien vive en un ref: un guardado que espera en cola a que termine
    // el anterior debe ver el id que ese acaba de crear, no el de su closure.
    const consultationIdRef = useRef(consultation?.id ?? null);
    const saveQueueRef = useRef(Promise.resolve());
    const pendingSavesRef = useRef(0);
    // Foto de lo que el servidor ya tiene, y del contenido clinico con el que
    // nacio el formulario: deciden si hay algo que guardar.
    const savedSnapshotRef = useRef(null);
    const initialClinicalSnapshotRef = useRef(null);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const advancedTogglesRef = useRef({});

    const assignConsultationId = useCallback((id) => {
        consultationIdRef.current = id;
        setConsultationId(id);
    }, []);

    // Solo `patient.id` alimenta los valores iniciales. Depender del objeto
    // entero reiniciaba el formulario cuando ConsultationPage cambiaba la ficha
    // reducida del autocomplete por la completa, borrando lo ya escrito.
    // Quien abre una consulta nueva queda como medico solo si es medico. El
    // servidor asignaba a cualquier usuario, y una consulta abierta por
    // recepcion quedaba a su nombre con el selector en blanco.
    const defaultDoctor = useMemo(
        () => (Array.isArray(meta?.optometrists) ? meta.optometrists : [])
            .find((item) => String(item.id) === String(user?.id)) ?? null,
        [meta, user?.id]
    );

    const defaultValues = useMemo(
        () => buildDefaultValues(patient, consultation, meta, defaultDoctor),
        [patient.id, consultation, meta, defaultDoctor]
    );

    // `onBlur`: la unica validacion propia del formulario es la de las fechas,
    // y debe avisar al salir del campo, no recien al completar.
    const { register, handleSubmit, getValues, setValue, watch, control, reset } = useForm({ defaultValues, mode: 'onBlur' });

    useEffect(() => {
        reset(defaultValues);
        assignConsultationId(consultation?.id ?? null);
        savedSnapshotRef.current = snapshotOf(defaultValues);
        initialClinicalSnapshotRef.current = clinicalSnapshotOf(defaultValues);
        setRxWarnings([]);
    }, [consultation, defaultValues, reset, assignConsultationId]);

    const diagnosesFieldArray = useFieldArray({ control, name: 'diagnoses' });
    const recommendationsFieldArray = useFieldArray({ control, name: 'recommendations_list' });
    const rxUsoFieldArray = useFieldArray({ control, name: 'rx_uso_entries' });
    const saleItemsFieldArray = useFieldArray({ control, name: 'sale_items' });

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

    // Resumen de solo lectura de RX Final, para elegir el diagnostico por ojo
    // sin tener que volver a scrollear a la seccion de refraccion.
    const [rxFinalEsferaOd, rxFinalCilindroOd, rxFinalEjeOd, rxFinalAddOd, rxFinalEsferaOi, rxFinalCilindroOi, rxFinalEjeOi, rxFinalAddOi] = watch([
        'rx_final_esfera_od', 'rx_final_cilindro_od', 'rx_final_eje_od', 'rx_final_add_od',
        'rx_final_esfera_oi', 'rx_final_cilindro_oi', 'rx_final_eje_oi', 'rx_final_add_oi',
    ]);
    const rxFinalSummaryLine = (esfera, cilindro, eje, add) => {
        // Un campo vacio no es un plano medido: antes se pintaba "±0.00".
        if ([esfera, cilindro, eje, add].every(isBlank)) return 'Sin datos';

        return `${displaySphere(esfera, '—')} ${displaySigned(cilindro, '—')} × ${eje || '—'} ADD ${displaySigned(add, '—')}`;
    };

    /**
     * Recalcula los avisos de las medidas. Se llama al salir de un campo del
     * examen visual y al completar; solo mira lo que cambio desde la carga.
     */
    const refreshRxWarnings = useCallback(() => {
        const next = refractionWarnings(getValues(), { baseline: defaultValues, previous: previousConsultation });
        setRxWarnings((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));

        return next;
    }, [getValues, defaultValues, previousConsultation]);

    // De cada campo se muestra su primer aviso.
    const rxWarningMap = useMemo(() => {
        const byField = new Map();
        for (const { field, message } of rxWarnings) {
            if (!byField.has(field)) byField.set(field, message);
        }

        return byField;
    }, [rxWarnings]);
    const hasBlockingRxWarning = rxWarnings.some(({ blocking }) => blocking);
    // En la revision va primero lo que impide completar.
    const rxReviewItems = useMemo(
        () => [...rxWarnings].sort((a, b) => Number(Boolean(b.blocking)) - Number(Boolean(a.blocking))),
        [rxWarnings]
    );

    /**
     * Lleva al campo de un error: abre su seccion si esta colapsada y, si hace
     * falta, revela los campos avanzados que lo ocultan.
     */
    const goToField = useCallback((fieldName) => {
        if (scrollToField(fieldName)) return;

        const sectionKey = sectionKeyForField(fieldName);
        if (!sectionKey) return;

        // `flushSync` deja la seccion ya pintada para poder enfocar el campo
        // en este mismo paso, sin esperar al siguiente render.
        flushSync(() => openCollapsibleSection(sectionKey));
        if (scrollToField(fieldName)) return;

        const advanced = advancedTogglesRef.current[sectionKey];
        if (advanced && !advanced.open) {
            flushSync(() => advanced.setOpen(true));
            if (scrollToField(fieldName)) return;
            // No era un campo avanzado: la seccion queda como estaba.
            flushSync(() => advanced.setOpen(false));
        }

        scrollToSection(sectionKey);
    }, []);

    /**
     * Trae al formulario lo que el servidor asigno o normalizo en las columnas
     * planas (optometra por defecto, estado, medidas), sin recargarlo entero.
     *
     * Se respeta todo lo que el usuario pudo tocar mientras viajaba el guardado:
     * el campo enfocado, los valores que cambiaron desde el envio y los modulos
     * y filas (objetos y arrays), que son contenido suyo y no del servidor.
     */
    const syncServerAssignedValues = useCallback((sent, saved) => {
        const fresh = buildDefaultValues(patient, saved, meta);
        const current = getValues();
        const focusedName = document.activeElement?.name;

        for (const [name, value] of Object.entries(fresh)) {
            if (!isScalar(value) || !isScalar(current[name])) continue;
            if (name === focusedName) continue;
            if (!sameFieldValue(current[name], sent[name])) continue;
            if (sameFieldValue(current[name], value)) continue;

            setValue(name, value);
        }
    }, [patient, meta, getValues, setValue]);

    const performSave = useCallback(async (showMsg, forceStatus) => {
        const values = getValues();
        const currentId = consultationIdRef.current;

        if (!values.patient_id) return null;

        const cleanSnapshot = snapshotOf(values);
        if (!showMsg) {
            // El autoguardado solo escribe si hay algo nuevo. Antes hacia un
            // PUT cada 30 s con la consulta abierta: leerla ya la modificaba
            // (filas hijas recreadas, `updated_by` y una entrada de auditoria).
            if (currentId && cleanSnapshot === savedSnapshotRef.current) return null;
            // Una consulta nueva nace cuando hay contenido clinico, no por
            // cambiar la fecha o el medico de la cabecera.
            if (!currentId && clinicalSnapshotOf(values) === initialClinicalSnapshotRef.current) return null;
        }

        // Foto de lo enviado: al volver la respuesta permite saber si el
        // usuario siguio escribiendo mientras tanto.
        const sentSnapshot = JSON.stringify(values);
        const { payload, rowIndexes } = stripEmptyModuleRows(normalizeOpticalPayload({
            ...values,
            estado: forceStatus ?? values.estado ?? 'borrador',
            ophthalmoscopy_module: {
                ...values.ophthalmoscopy_module,
                results: ophthalmoscopyResultsToLabeled(
                    values.ophthalmoscopy_module?.results,
                    ophthalmoscopyRows,
                    ophthalmoscopyDistances
                ),
            },
        }));

        try {
            let response;
            if (currentId) {
                response = await client.put(`/consultations/${currentId}`, payload);
            } else {
                response = await client.post('/consultations', payload);
                assignConsultationId(response.data.id);
            }

            setLastSaved(new Date());
            setUnsavedError(null);
            setFieldErrors([]);
            setRequiredErrors(new Map());

            // `reset()` reescribe todos los inputs y vuelve a montar las filas
            // (diagnosticos, RX en uso, venta): borra lo tecleado durante el
            // viaje del guardado y saca el foco del campo activo. Por eso solo
            // se usa en un guardado manual y si nadie toco nada entretanto; el
            // autoguardado nunca recarga el formulario.
            const untouched = JSON.stringify(getValues()) === sentSnapshot;
            if (showMsg && untouched) {
                reset(buildDefaultValues(patient, response.data, meta));
            } else {
                syncServerAssignedValues(JSON.parse(sentSnapshot), response.data);
            }
            // Lo tecleado durante el viaje no llego al servidor: en ese caso
            // la foto guardada es la de lo enviado y el proximo ciclo lo recoge.
            savedSnapshotRef.current = untouched ? snapshotOf(getValues()) : cleanSnapshot;

            if (showMsg) addToast('Consulta guardada correctamente', 'success');
            return response.data;
        } catch (error) {
            const status = error?.response?.status;
            const { fieldErrors: errors, message } = readValidationErrors(error, rowIndexes);

            setFieldErrors(errors);
            if (errors.length) {
                setRequiredErrors(new Map(errors.map(({ field, message: text }) => [field, text])));
            }

            let detail;
            if (status === 422) {
                detail = message || 'Revise los campos marcados en rojo.';
            } else if (status === 401 || status === 419) {
                // El servidor responde "Unauthenticated.", que no le dice nada al usuario.
                detail = 'Su sesión expiró. Inicie sesión en otra pestaña y vuelva a guardar: los datos siguen en pantalla.';
            } else {
                detail = error?.response?.data?.message
                    ?? 'No se pudo guardar. Verifique su conexión; los datos siguen en pantalla.';
            }

            // El aviso persiste aunque el guardado haya sido automatico: antes
            // el autosave fallaba en silencio y el usuario perdia el trabajo.
            setUnsavedError(detail);

            if (showMsg) {
                const firstField = errors[0]?.field;
                addToast(
                    detail,
                    'error',
                    null,
                    firstField ? { label: 'Ir al campo', onClick: () => goToField(firstField) } : null
                );

                // El scroll/foco automatico solo tiene sentido en un guardado
                // manual: en el autosave silencioso saltaba la vista sola cada
                // 30s mientras la usuaria seguia escribiendo.
                if (firstField) goToField(firstField);
            }

            throw error;
        }
    }, [getValues, reset, patient, meta, addToast, assignConsultationId, syncServerAssignedValues, goToField]);

    /**
     * Los guardados van de a uno. Dos a la vez podian crear la consulta dos
     * veces (un POST del autoguardado en vuelo mas otro del boton) o dejar en
     * el servidor la version mas vieja si las respuestas llegaban cruzadas.
     */
    const doSave = useCallback((showMsg = false, forceStatus = null, waitTurn = showMsg) => {
        // Sin `consultations.edit` el servidor responde 403: ni se intenta.
        if (readOnly) return Promise.resolve(null);

        // El autoguardado no hace cola: si hay un guardado en curso, el
        // siguiente ciclo se encarga.
        if (!waitTurn && pendingSavesRef.current > 0) return Promise.resolve(null);

        pendingSavesRef.current += 1;
        const run = saveQueueRef.current
            .catch(() => {})
            .then(() => performSave(showMsg, forceStatus))
            .finally(() => { pendingSavesRef.current -= 1; });
        saveQueueRef.current = run;

        return run;
    }, [performSave, readOnly]);

    /** Hay algo escrito que el servidor todavia no tiene. */
    const hasUnsavedChanges = useCallback(() => {
        if (readOnly) return false;
        const values = getValues();

        return consultationIdRef.current
            ? snapshotOf(values) !== savedSnapshotRef.current
            : clinicalSnapshotOf(values) !== initialClinicalSnapshotRef.current;
    }, [getValues, readOnly]);

    // El menu, la flecha atras o un enlace sacaban de la consulta sin avisar,
    // incluso con el aviso de "Cambios sin guardar" en pantalla.
    const blocker = useBlocker(useCallback(
        ({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname && hasUnsavedChanges(),
        [hasUnsavedChanges]
    ));
    const blockerRef = useRef(blocker);
    blockerRef.current = blocker;

    // Al salir con cambios pendientes primero se intenta guardarlos, sin aviso
    // de exito; solo se pregunta si ese guardado falla.
    useEffect(() => {
        if (blocker.state !== 'blocked') return undefined;

        let cancelled = false;
        doSave(false, null, true)
            .then(() => { if (!cancelled) blockerRef.current.proceed?.(); })
            .catch(() => { if (!cancelled) setConfirmLeave(true); });

        return () => { cancelled = true; };
    }, [blocker.state, doSave]);

    useEffect(() => {
        const warn = (event) => {
            if (!hasUnsavedChanges()) return;
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [hasUnsavedChanges]);

    useEffect(() => {
        if (readOnly) return undefined;

        autosaveTimerRef.current = setInterval(() => {
            // El error ya quedo registrado en `unsavedError` dentro de doSave;
            // aqui solo se evita el unhandled rejection.
            doSave(false).catch(() => {});
        }, 30000);

        return () => clearInterval(autosaveTimerRef.current);
    }, [doSave, readOnly]);

    const validateRequired = () => {
        const required = requiredFields;
        if (required.length === 0) return true;
        const values = getValues();
        const missing = [];
        for (const key of required) {
            let empty = false;
            if (key === 'diagnostico_descripcion') {
                empty = !(values.diagnoses ?? []).some(d => d?.description?.trim());
            } else {
                empty = !String(values[key] ?? '').trim();
            }
            if (empty) {
                missing.push({ field: key, label: REQUIRED_FIELD_LABELS[key] ?? key });
            }
        }
        setRequiredErrors(new Map(missing.map(({ field, label }) => [
            field,
            `${label}: dato obligatorio para completar la consulta.`,
        ])));
        if (missing.length > 0) {
            setMissingFields(missing);
            setShowRequiredModal(true);
            return false;
        }
        return true;
    };

    /** Cierra el aviso de obligatorios y lleva al campo elegido. */
    const goToMissingField = (fieldName) => {
        setShowRequiredModal(false);
        goToField(fieldName);
    };

    const completeConsultation = async () => {
        setSaving(true);
        try {
            const saved = await doSave(true, 'completada');
            if (!consultationId && saved?.id) {
                navigate(`/consulta/${saved.id}`);
            }
        } catch {
            // doSave ya mostro el detalle y marco los campos en rojo.
        } finally {
            setSaving(false);
        }
    };

    /**
     * "Completar consulta": primero los obligatorios y despues los avisos de
     * las medidas, que se pueden pasar por alto salvo un cilindro sin eje en
     * la RX Final.
     */
    const onSubmit = async () => {
        if (!validateRequired()) return;

        if (refreshRxWarnings().length > 0) {
            setShowRxReview(true);
            return;
        }

        await completeConsultation();
    };

    /** Cierra la revision de medidas y lleva al campo elegido. */
    const goToWarningField = (fieldName) => {
        setShowRxReview(false);
        goToField(fieldName);
    };

    /**
     * Guardado parcial explicito: persiste lo que haya sin exigir campos completos.
     *
     * No fuerza el estado: una consulta ya completada no debe volver a borrador
     * solo por pulsar "Guardar".
     */
    const handleSaveDraft = async () => {
        setSaving(true);
        try {
            await doSave(true);
        } catch {
            // doSave ya notifico el error.
        } finally {
            setSaving(false);
        }
    };

    const handleGeneratePdf = async () => {
        let current = consultationId;
        if (!current) {
            try {
                current = (await doSave(true, 'borrador'))?.id;
            } catch {
                return;
            }
        }
        if (!current) return;

        try {
            const response = await client.get(`/consultations/${current}/pdf-data`);
            setPdfData(response.data);
            setShowPdf(true);
        } catch {
            addToast('Error al cargar la vista previa de impresión', 'error');
        }
    };

    /**
     * Copia la RX final de una consulta anterior a "RX en uso": rellena la
     * primera receta que siga en blanco o, si todas tienen datos, agrega otra.
     */
    const copyRxFromHistory = (row) => {
        const entry = emptyRxUsoEntry();
        for (const eye of ['od', 'oi']) {
            entry[`esfera_${eye}`] = row[`rx_final_esfera_${eye}_neutral`]
                ? 'N'
                : formatOpticalForInput(row[`rx_final_esfera_${eye}`]);
            entry[`cilindro_${eye}`] = formatOpticalForInput(row[`rx_final_cilindro_${eye}`]);
            entry[`eje_${eye}`] = row[`rx_final_eje_${eye}`] ?? '';
            entry[`add_${eye}`] = formatOpticalForInput(row[`rx_final_add_${eye}`]);
            entry[`avcc_${eye}`] = row[`rx_final_av_${eye}`] ?? '';
        }
        entry.observacion = `RX final de la consulta #${row.numero_consulta} (${toDisplayDate(row.fecha_consulta)})`;

        const blankIndex = (getValues('rx_uso_entries') ?? [])
            .findIndex((current) => Object.keys(emptyRxUsoEntry()).every((key) => isBlank(current?.[key])));
        if (blankIndex >= 0) {
            rxUsoFieldArray.update(blankIndex, entry);
        } else {
            rxUsoFieldArray.append(entry);
        }

        addToast(`RX de la consulta #${row.numero_consulta} copiada a RX en uso`, 'success');
    };

    /**
     * Medico de la cabecera clinica tal como esta ahora en el formulario: el
     * certificado lo firma el, aunque el cambio todavia no se haya guardado.
     * Sin medico elegido devuelve `undefined` y el certificado usa el guardado.
     */
    const currentDoctor = () => {
        const selected = optometrists.find((item) => String(item.id) === String(getValues('optometrista_id')));
        return selected ? { id: selected.id, name: selected.name } : undefined;
    };

    // Filas de diagnostico que no salen del checklist por ojo: texto libre,
    // ojo "general", items de catalogo desactivados o duplicados historicos.
    const diagnosesWatch = watch('diagnoses') || [];
    const checklistIndexes = checklistRowIndexes(diagnosesWatch, diagnosisOptions);
    const otherDiagnosisFields = diagnosesFieldArray.fields
        .map((field, index) => ({ field, index }))
        .filter(({ index }) => !checklistIndexes.has(index));

    /**
     * Al elegir medico se trae su registro SENESCYT, que ya viene con la lista.
     * Solo pisa un valor que el formulario pudo haber puesto solo (vacio o el
     * registro de otro medico), nunca uno escrito a mano.
     */
    const handleDoctorChange = (event) => {
        const selected = optometrists.find((item) => String(item.id) === String(event.target.value));
        const current = String(getValues('doctor_license') ?? '').trim();
        const knownRegistries = optometrists.map((item) => String(item.registro_senescyt ?? '').trim()).filter(Boolean);

        if (current === '' || knownRegistries.includes(current)) {
            setValue('doctor_license', selected?.registro_senescyt ?? '', { shouldDirty: true });
        }
    };

    /** Al corregir un campo se le quita el rojo, sin esperar al siguiente guardado. */
    const clearFieldError = useCallback((event) => {
        const name = event.target?.name;
        if (!name) return;

        setRequiredErrors((current) => {
            if (!current.has(name)) return current;

            const next = new Map(current);
            next.delete(name);
            return next;
        });
    }, []);

    /** La validacion propia (fechas) freno el envio: el campo ya quedo marcado y enfocado. */
    const onInvalidSubmit = () => {
        addToast('Hay un dato no válido. Revise el campo marcado en rojo.', 'error');
    };

    // En las consultas importadas `luna_*` trae texto del sistema anterior
    // (a veces notas clinicas) sin item de catalogo: se muestra tal cual.
    const legacyLensNotes = [
        ['Material', 'luna_material', 'material_item_id'],
        ['Espesor', 'luna_espesor', 'thickness_item_id'],
        ['Protección', 'luna_proteccion', 'protection_item_id'],
    ].filter(([, column, itemKey]) => !isBlank(consultation?.[column]) && isBlank(consultation?.lens_recommendation?.[itemKey]))
        .map(([label, column]) => [label, consultation[column]]);

    const handleDiagnosisCatalogChange = (index, itemId) => {
        const selected = diagnosisOptions.find((item) => String(item.id) === String(itemId));
        setValue(`diagnoses.${index}.catalog_item_id`, itemId);
        setValue(`diagnoses.${index}.code`, selected?.code ?? '');
        setValue(`diagnoses.${index}.description`, selected?.label ?? '');
    };

    const recomputeSaleItemTotal = (index) => {
        const precio = getValues(`sale_items.${index}.precio`);
        const pct = Math.min(Math.max(parseAmount(getValues(`sale_items.${index}.descuento_pct`)), 0), 100);
        // Sin precio no hay total: un "0.00" haria pasar por llena una fila vacia.
        const total = isBlank(precio) ? '' : (parseAmount(precio) * (1 - pct / 100)).toFixed(2);
        setValue(`sale_items.${index}.total`, total, { shouldDirty: true });
    };

    const saleItemsWatch = watch('sale_items') || [];
    const saleItemsTotal = saleItemsWatch.reduce((sum, item) => sum + (parseFloat(item?.total) || 0), 0);

    const handleRecommendationCatalogChange = (index, itemId) => {
        const selected = recommendationOptions.find((item) => String(item.id) === String(itemId));
        setValue(`recommendations_list.${index}.catalog_item_id`, itemId);
        if (!(watch(`recommendations_list.${index}.text`) || '').trim()) {
            setValue(`recommendations_list.${index}.text`, selected?.label ?? '');
        }
    };

    const { isAdvanced } = useAdvancedFields('consulta');
    // En solo lectura no hay boton para revelar avanzados: se muestran todos.
    const revealInReadOnly = (adv) => (readOnly ? { ...adv, open: true } : adv);
    const refractionAdv = revealInReadOnly(useAdvancedToggle('consulta:refraccion'));
    const cabeceraAdv = revealInReadOnly(useAdvancedToggle('consulta:cabecera'));
    const diagnosticoAdv = revealInReadOnly(useAdvancedToggle('consulta:diagnostico'));
    const observacionesAdv = revealInReadOnly(useAdvancedToggle('consulta:observaciones'));
    // Por `sectionKey`, para que `goToField` revele un campo avanzado con error.
    advancedTogglesRef.current = {
        cabecera: cabeceraAdv,
        refraccion: refractionAdv,
        diagnostico: diagnosticoAdv,
        observaciones: observacionesAdv,
    };

    // Un campo avanzado se muestra solo si su sección tiene revelado "avanzado".
    const advVisible = (key, adv) => !isAdvanced(key) || adv.open;
    const filterFields = (fields, keyMap) =>
        fields.filter((f) => {
            const key = keyMap[f];
            return !key || !isAdvanced(key) || refractionAdv.open;
        });

    const topFields = filterFields(
        ['av_lectura', 'ark', 'avsc', 'retinoscopia', 'avcc'],
        { avsc: 'consulta:col_avsc', avcc: 'consulta:col_avcc' }
    );
    const topLabels = {
        av_lectura: 'Lectura computador',
        ark: 'Queratometría',
        avsc: 'AV.SC lejos',
        retinoscopia: 'Retinoscopia',
        avcc: 'AV Retinoscopía VL',
    };

    const rxUsoFields = filterFields(RX_USO_COLUMNS, { cilindro: 'consulta:rx_uso_cilindro', avcc: 'consulta:rx_uso_avcc' });
    const subjFields = filterFields(['esfera', 'cilindro', 'eje', 'avl'], { esfera: 'consulta:subj_esfera', eje: 'consulta:subj_eje', avl: 'consulta:subj_avl' });
    // Orden pedido por la optica (papel de Optica Andina): Esfera, Cilindro,
    // Eje, Prisma, Base, AV, ADD, DP. Distancia queda como campo avanzado.
    const rxFinalFields = filterFields(
        ['esfera', 'cilindro', 'eje', 'prisma', 'base', 'av', 'add', 'dnp', 'distancia'],
        { prisma: 'consulta:rx_final_prisma', base: 'consulta:rx_final_base', distancia: 'consulta:rx_final_distancia' }
    );

    const refractionAdvKeys = [
        'consulta:col_avsc', 'consulta:col_avcc', 'consulta:rx_uso_cilindro', 'consulta:rx_uso_avcc',
        'consulta:subj_esfera', 'consulta:subj_eje', 'consulta:subj_avl',
        'consulta:rx_final_prisma', 'consulta:rx_final_base', 'consulta:rx_final_distancia',
        'consulta:grp_vision_cerca', 'consulta:vision_colores', 'consulta:lente_anterior',
    ];
    const hasRefractionAdvanced = refractionAdvKeys.some((k) => isAdvanced(k));
    const cabeceraHasAdvanced = isAdvanced('consulta:ultimo_control');
    const diagnosticoHasAdvanced = isAdvanced('consulta:diagnostico_adicional');
    const observacionesHasAdvanced = ['consulta:queratometria', 'consulta:examen_externo'].some((k) => isAdvanced(k));

    // "Guardar borrador" sobre una consulta completada hacia pensar que la
    // devolvia a borrador; ese boton nunca cambia el estado.
    const isCompleted = watch('estado') === 'completada';
    const saveLabel = isCompleted ? 'Guardar cambios' : 'Guardar borrador';

    // Estilo/estado inicial de las secciones-módulo según estén marcadas avanzadas.
    const moduleSectionProps = (advKey) => ({
        variant: isAdvanced(advKey) ? 'advanced' : 'default',
        defaultOpen: !isAdvanced(advKey),
    });

    return (
      <FormReadOnlyContext.Provider value={readOnly}>
      <RequiredErrorsCtx.Provider value={requiredErrors}>
        <form
            onSubmit={readOnly ? (event) => event.preventDefault() : handleSubmit(onSubmit, onInvalidSubmit)}
            onKeyDown={handleFieldNavigation}
            onChange={clearFieldError}
            className="pb-24 lg:pb-8"
        >
            <div className="sticky top-0 z-20 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <InlineBadge label={`Paciente ${patient.codigo_interno || patient.id}`} />
                    <InlineBadge label={isCompleted ? 'Completada' : 'Borrador'} tone={isCompleted ? 'done' : 'draft'} />
                    {readOnly && <InlineBadge label="Solo lectura" />}
                    {lastSaved && (
                        <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                            <CheckCircle size={16} />
                            Guardado {lastSaved.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
                {unsavedError && (
                    <div className="w-full rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                        <span className="font-semibold">Cambios sin guardar. </span>
                        {fieldErrors.length > 0 ? (
                            <>
                                <span>Haga clic en un error para ir al campo:</span>
                                <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto">
                                    {fieldErrors.map(({ field, message }) => (
                                        <li key={field}>
                                            {sectionKeyForField(field) ? (
                                                <button
                                                    type="button"
                                                    onClick={() => goToField(field)}
                                                    className="inline-flex items-start gap-1.5 text-left underline decoration-red-300 underline-offset-2 hover:text-red-950 hover:decoration-red-700"
                                                >
                                                    <ArrowRight size={14} className="mt-0.5 shrink-0" />
                                                    {message}
                                                </button>
                                            ) : (
                                                <span>{message}</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        ) : (
                            <span className="whitespace-pre-line">{unsavedError}</span>
                        )}
                    </div>
                )}
                <div className="hidden flex-wrap items-center gap-3 lg:flex">
                    {!readOnly && (
                        <Button type="button" variant="secondary" onClick={handleSaveDraft} loading={saving}>
                            <Clock size={18} /> {saveLabel}
                        </Button>
                    )}
                    <Button type="button" variant="secondary" onClick={handleGeneratePdf}>
                        <Printer size={18} /> Imprimir
                    </Button>
                    {!readOnly && (
                        <Button type="submit" loading={saving}>
                            <Save size={18} /> Completar consulta
                        </Button>
                    )}
                </div>
                {readOnly && (
                    <p className="w-full text-sm text-slate-500">
                        Puede ver e imprimir esta consulta, pero no modificarla.
                    </p>
                )}
            </div>

            <CollapsibleSection title="Cabecera clínica" subtitle="Resumen operativo del paciente y la consulta actual." sectionKey="cabecera">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                    <DateInput
                        control={control}
                        name="fecha_consulta"
                        label="Fecha de consulta"
                        required={requiredFields.includes('fecha_consulta')}
                        rules={{ validate: notFutureDate }}
                        error={requiredErrors.get('fecha_consulta')}
                    />
                    <FormSelect
                        label="Médico / Optometrista"
                        name="optometrista_id"
                        register={register}
                        options={optometrists}
                        registerOptions={{ onChange: handleDoctorChange }}
                    />
                    <FormInput
                        label="Registro SENESCYT del médico"
                        name="doctor_license"
                        register={register}
                        placeholder="Se llena al elegir el médico"
                    />
                    <FormSelect label="Plantilla de impresión" name="print_template_key" register={register} options={templateOptions.map((item) => ({ value: item.key, label: item.name }))} />
                    <ReadOnlyField label="Código interno" value={patient.codigo_interno} />
                    <ReadOnlyField label="Paciente" value={patient.nombre_completo || patient.nombre} />
                    <ReadOnlyField label="Edad" value={patient.edad != null ? `${patient.edad} años` : ''} />
                    <ReadOnlyField label="Ocupación" value={patient.ocupacion} />
                    <div className="lg:col-span-2">
                        <TextArea label="Motivo de consulta" name="motivo_consulta" register={register} rows={3} placeholder="Motivo principal, síntomas, seguimiento o reclamo..." />
                    </div>
                    {advVisible('consulta:ultimo_control', cabeceraAdv) && (
                        <DateInput
                            control={control}
                            name="ultimo_control"
                            label="Último control"
                            rules={{ validate: notFutureDate }}
                            error={requiredErrors.get('ultimo_control')}
                        />
                    )}
                    <ReadOnlyField label="Dirección" value={patient.direccion} />
                    <div className="lg:col-span-4">
                        <ReadOnlyField label="Antecedentes" value={patient.antecedentes} multiline />
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
                            <span>{toDisplayDate(previousConsultation.fecha_consulta)}</span>
                            {previousConsultation.diagnostico_descripcion && (
                                <span>
                                    {[previousConsultation.diagnostico_cie10, previousConsultation.diagnostico_descripcion].filter(Boolean).join(' - ')}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </CollapsibleSection>

            <CollapsibleSection title="Examen visual y refracción" subtitle="Captura central de lectura, refracción y receta final." sectionKey="refraccion">
                <div onBlur={refreshRxWarnings}>
                    <EyeFieldGroup
                        fields={topFields}
                        register={register}
                        setValue={setValue}
                        warnings={rxWarningMap}
                        requiredFields={requiredFields}
                        labelOverrides={topLabels}
                        nameFor={(field, eye) => `${field}_${eye}`}
                    />
                    <div className="mb-6">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#1a2a4a]/20 pb-1">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-[#1a2a4a]">RX en uso</h3>
                            <Button type="button" variant="secondary" onClick={() => rxUsoFieldArray.append(emptyRxUsoEntry())}>
                                <Plus size={16} /> Agregar RX en uso
                            </Button>
                        </div>
                        <RxHistoryPicker patientId={patient.id} excludeId={consultationId} onUse={copyRxFromHistory} />
                        <div className="space-y-4">
                            {rxUsoFieldArray.fields.map((field, index) => (
                                <div key={field.id} className="rounded-2xl border border-slate-200 p-4">
                                    <div className="mb-2 flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-700">RX en uso {index + 1}</span>
                                        {rxUsoFieldArray.fields.length > 1 && (
                                            <button type="button" className="text-sm text-rose-600" onClick={() => rxUsoFieldArray.remove(index)}>
                                                <Trash2 size={16} className="inline-block" /> Quitar
                                            </button>
                                        )}
                                    </div>
                                    <EyeFieldGroup
                                        fields={rxUsoFields}
                                        register={register}
                                        setValue={setValue}
                                        warnings={rxWarningMap}
                                        requiredFields={requiredFields}
                                        nameFor={(column, eye) => `rx_uso_entries.${index}.${column}_${eye}`}
                                    />
                                    <TextArea
                                        label="Observación"
                                        name={`rx_uso_entries.${index}.observacion`}
                                        register={register}
                                        rows={2}
                                        placeholder="Notas sobre esta receta en uso."
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {advVisible('consulta:lente_anterior', refractionAdv) && (
                        <div className="mb-6">
                            <TextArea label="Lente anterior" name="lente_anterior" register={register} rows={3} placeholder="Lente previo, marca, material y comparación con receta anterior." />
                        </div>
                    )}

                    <EyeFieldGroup
                        prefix="subj"
                        fields={subjFields}
                        register={register}
                        setValue={setValue}
                        warnings={rxWarningMap}
                        requiredFields={requiredFields}
                        label="Subjetivo"
                    />

                    <EyeFieldGroup
                        prefix="rx_final"
                        fields={rxFinalFields}
                        register={register}
                        setValue={setValue}
                        warnings={rxWarningMap}
                        requiredFields={requiredFields}
                        label="RX FINAL"
                        labelOverrides={{ dnp: 'DP' }}
                        footer={(
                            <div className="mt-3">
                                <TextArea
                                    label="Observaciones"
                                    name="rx_final_observaciones"
                                    register={register}
                                    rows={3}
                                    placeholder="Observaciones de la receta final (aplican a ambos ojos)."
                                hint="No se imprime en el certificado."
                                />
                            </div>
                        )}
                    />

                    {advVisible('consulta:grp_vision_cerca', refractionAdv) && (
                        <EyeFieldGroup
                            prefix="vc"
                            fields={['esfera', 'cilindro', 'eje', 'avcc', 'dnp']}
                            register={register}
                            setValue={setValue}
                            warnings={rxWarningMap}
                            requiredFields={requiredFields}
                            label="RX - Visión de Cerca"
                        />
                    )}
                    {advVisible('consulta:vision_colores', refractionAdv) && (
                        <div className="mt-4 max-w-md">
                            <FormInput label="Visión de colores" name="vision_colores" register={register} placeholder="14/14 Test Ishihara" hint="Se imprime en el certificado." />
                        </div>
                    )}
                    {hasRefractionAdvanced && (
                        <div className="mt-2">
                            <AdvancedToggleButton open={refractionAdv.open} onToggle={refractionAdv.toggle} />
                        </div>
                    )}
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Diagnóstico clínico" subtitle="Catálogo configurable con soporte para múltiples diagnósticos por ojo." sectionKey="diagnostico">
                <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">RX Final</div>
                    <div className="grid grid-cols-1 gap-1 font-mono text-slate-700 sm:grid-cols-2">
                        <div><span className="font-semibold">OD:</span> {rxFinalSummaryLine(rxFinalEsferaOd, rxFinalCilindroOd, rxFinalEjeOd, rxFinalAddOd)}</div>
                        <div><span className="font-semibold">OI:</span> {rxFinalSummaryLine(rxFinalEsferaOi, rxFinalCilindroOi, rxFinalEjeOi, rxFinalAddOi)}</div>
                    </div>
                </div>
                {requiredFields.includes('diagnostico_descripcion') && (
                    <p className={`mb-3 text-xs ${requiredErrors.has('diagnostico_descripcion') ? 'font-medium text-red-600' : 'text-slate-500'}`}>
                        <span className="text-red-500">*</span> Se necesita al menos un diagnóstico para completar la consulta.
                    </p>
                )}
                <DiagnosisPicker
                    control={control}
                    register={register}
                    options={diagnosisOptions}
                    fieldArray={diagnosesFieldArray}
                    patientAge={patient.edad}
                />
                <div className="mt-4 space-y-4">
                    {otherDiagnosisFields.length > 0 && (
                        <h3 className="text-sm font-semibold text-slate-800">Otros diagnósticos</h3>
                    )}
                    {otherDiagnosisFields.map(({ field, index }, position) => (
                        <div key={field.id} className="rounded-2xl border border-slate-200 p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-slate-800">Diagnóstico adicional {position + 1}</h4>
                                <button type="button" className="text-sm text-rose-600" onClick={() => diagnosesFieldArray.remove(index)}>
                                    <Trash2 size={16} className="inline-block" /> Quitar
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                                <FormSelect label="Ojo" name={`diagnoses.${index}.eye`} register={register} options={[{ value: 'od', label: 'OD' }, { value: 'oi', label: 'OI' }, { value: 'general', label: 'General' }]} />
                                <div className="flex flex-col gap-1 lg:col-span-2">
                                    <label className="text-sm font-medium text-slate-700">Catálogo</label>
                                    <select className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" value={watch(`diagnoses.${index}.catalog_item_id`) || ''} onChange={(event) => handleDiagnosisCatalogChange(index, event.target.value)}>
                                        <option value="">Seleccionar diagnóstico...</option>
                                        {diagnosisOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.code ? `${option.code} - ${option.label}` : option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <FormInput label="Código" name={`diagnoses.${index}.code`} register={register} />
                                <div className="lg:col-span-3">
                                    <FormInput label="Descripción" name={`diagnoses.${index}.description`} register={register} />
                                </div>
                                <div className="lg:col-span-4">
                                    <TextArea label="Nota del diagnóstico" name={`diagnoses.${index}.notes`} register={register} rows={2} hint="No se imprime en el certificado." />
                                </div>
                            </div>
                        </div>
                    ))}
                    <Button type="button" variant="secondary" onClick={() => diagnosesFieldArray.append(defaultDiagnosis())}>
                        <Plus size={16} /> Agregar diagnóstico manual (texto libre / general)
                    </Button>
                    {advVisible('consulta:diagnostico_adicional', diagnosticoAdv) && (
                        <TextArea label="Diagnóstico adicional" name="diagnostico_adicional" register={register} rows={3} placeholder="Hallazgos, patología asociada o aclaraciones diagnósticas." hint="No se imprime en el certificado." />
                    )}
                    {diagnosticoHasAdvanced && (
                        <AdvancedToggleButton open={diagnosticoAdv.open} onToggle={diagnosticoAdv.toggle} />
                    )}
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Recomendación de lunas y recomendaciones médicas" subtitle="Selección rápida por catálogos y texto editable antes de guardar." sectionKey="recomendaciones">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="mb-4 flex items-center gap-2">
                            <InlineBadge label="M" />
                            <h3 className="font-semibold text-slate-800">Recomendación de lunas</h3>
                        </div>
                        {legacyLensNotes.length > 0 && (
                            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                <div className="mb-1 font-semibold text-slate-700">Registro del sistema anterior</div>
                                {legacyLensNotes.map(([label, text]) => (
                                    <div key={label}><span className="font-medium">{label}:</span> {text}</div>
                                ))}
                            </div>
                        )}
                        <div className="space-y-4">
                            <FormSelect label="Material" name="lens_recommendation.material_item_id" register={register} options={materialOptions} />
                            <FormSelect label="Espesor" name="lens_recommendation.thickness_item_id" register={register} options={thicknessOptions} />
                            <FormSelect label="Protección" name="lens_recommendation.protection_item_id" register={register} options={protectionOptions} />
                            <TextArea label="Observación" name="lens_recommendation.observation" register={register} rows={4} hint="No se imprime en el certificado." />
                        </div>
                    </div>
                    <div className="lg:col-span-2 rounded-2xl border border-slate-200 p-4">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-800">Recomendaciones médicas</h3>
                            <Button type="button" variant="secondary" onClick={() => recommendationsFieldArray.append(defaultRecommendation())}>
                                <Plus size={16} /> Agregar
                            </Button>
                        </div>
                        <div className="space-y-4">
                            {recommendationsFieldArray.fields.map((field, index) => (
                                <div key={field.id} className="rounded-2xl border border-slate-200 p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-700">Recomendación {index + 1}</span>
                                        {recommendationsFieldArray.fields.length > 1 && (
                                            <button type="button" className="text-sm text-rose-600" onClick={() => recommendationsFieldArray.remove(index)}>
                                                <Trash2 size={16} className="inline-block" /> Quitar
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                                        <div className="lg:col-span-1">
                                            <label className="text-sm font-medium text-slate-700">Catálogo</label>
                                            <select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" value={watch(`recommendations_list.${index}.catalog_item_id`) || ''} onChange={(event) => handleRecommendationCatalogChange(index, event.target.value)}>
                                                <option value="">Seleccionar sugerencia...</option>
                                                {recommendationOptions.map((option) => (
                                                    <option key={option.id} value={option.id}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="lg:col-span-2">
                                            <TextArea label="Texto editable" name={`recommendations_list.${index}.text`} register={register} rows={3} hint="Se imprime en el certificado, bajo RECOMENDACIONES." />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Venta / Productos vendidos" subtitle="Registro informativo de lo vendido en la consulta; no se imprime en el certificado ni afecta caja o inventario." sectionKey="venta">
                <div className="space-y-4">
                    {saleItemsFieldArray.fields.map((field, index) => {
                        const precioReg = register(`sale_items.${index}.precio`);
                        const pctReg = register(`sale_items.${index}.descuento_pct`);
                        return (
                            <div key={field.id} className="rounded-2xl border border-slate-200 p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-700">Item {index + 1}</span>
                                    {saleItemsFieldArray.fields.length > 1 && (
                                        <button type="button" className="text-sm text-rose-600" onClick={() => saleItemsFieldArray.remove(index)}>
                                            <Trash2 size={16} className="inline-block" /> Quitar
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
                                    <FormSelect
                                        label="Tipo"
                                        name={`sale_items.${index}.tipo`}
                                        register={register}
                                        options={[
                                            { value: 'armazon', label: 'Armazón' },
                                            { value: 'lunas', label: 'Lunas' },
                                            { value: 'lentes_contacto', label: 'Lentes de contacto' },
                                            { value: 'otro', label: 'Otro' },
                                        ]}
                                    />
                                    <div className="lg:col-span-2">
                                        <FormInput label="Descripción" name={`sale_items.${index}.descripcion`} register={register} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-sm font-medium text-slate-700">Precio</label>
                                        <input
                                            id={precioReg.name}
                                            type="text"
                                            inputMode="decimal"
                                            className={`w-full min-h-11 rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${fieldErrorClass(requiredErrors.has(precioReg.name))}`}
                                            {...precioReg}
                                            onChange={(event) => { keepAmount(event); precioReg.onChange(event); recomputeSaleItemTotal(index); }}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-sm font-medium text-slate-700">% Descuento</label>
                                        <input
                                            id={pctReg.name}
                                            type="text"
                                            inputMode="decimal"
                                            className={`w-full min-h-11 rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 ${fieldErrorClass(requiredErrors.has(pctReg.name))}`}
                                            {...pctReg}
                                            onChange={(event) => { keepAmount(event, 100); pctReg.onChange(event); recomputeSaleItemTotal(index); }}
                                        />
                                    </div>
                                    <FormInput label="Total" name={`sale_items.${index}.total`} register={register} readOnly />
                                </div>
                                <div className="mt-4">
                                    <TextArea label="Nota" name={`sale_items.${index}.nota`} register={register} rows={2} />
                                </div>
                            </div>
                        );
                    })}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Button type="button" variant="secondary" onClick={() => saleItemsFieldArray.append(defaultSaleItem())}>
                            <Plus size={16} /> Agregar item
                        </Button>
                        <span className="text-sm font-semibold text-slate-800">
                            Total de la venta: ${saleItemsTotal.toFixed(2)}
                        </span>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Observaciones clínicas, queratometría y examen externo" subtitle="Texto libre y hallazgos auxiliares del examen." sectionKey="observaciones">
                <div className="mb-4">
                    <TextArea label="Observaciones clínicas" name="observaciones" register={register} rows={6} placeholder="Comentarios del caso, comparación con recetas previas, seguimiento y observaciones libres..." hint="No se imprimen en el certificado." />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {advVisible('consulta:queratometria', observacionesAdv) && (
                        <FormInput label="Queratometría detallada OD" name="queratometria_od" register={register} placeholder="K1 / K2 @ eje" hint="Complementa la columna Queratometría del examen visual." />
                    )}
                    {advVisible('consulta:queratometria', observacionesAdv) && (
                        <FormInput label="Queratometría detallada OI" name="queratometria_oi" register={register} placeholder="K1 / K2 @ eje" hint="Complementa la columna Queratometría del examen visual." />
                    )}
                    {advVisible('consulta:examen_externo', observacionesAdv) && (
                        <TextArea label="Examen externo OD" name="examen_externo_od" register={register} rows={3} />
                    )}
                    {advVisible('consulta:examen_externo', observacionesAdv) && (
                        <TextArea label="Examen externo OI" name="examen_externo_oi" register={register} rows={3} />
                    )}
                </div>
                {observacionesHasAdvanced && (
                    <div className="mt-2">
                        <AdvancedToggleButton open={observacionesAdv.open} onToggle={observacionesAdv.toggle} />
                    </div>
                )}
            </CollapsibleSection>

            <CollapsibleSection title="Módulo de Terapia Visual – Examen motor, binocular y acomodativo" subtitle="Motilidad ocular, binocularidad y vergencias, acomodación y reflejos pupilares." sectionKey="motor_binocular" {...moduleSectionProps('consulta:sec_motor_binocular')}>
                <MotorBinocularSection register={register} />
            </CollapsibleSection>

            <CollapsibleSection title="Módulo de lentes de contacto" subtitle="Adaptación, lente de prueba y lente definitivo." sectionKey="lentes_contacto" {...moduleSectionProps('consulta:sec_lentes_contacto')}>
                <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
                    <FormInput label="Diámetro pupilar" name="contact_lens_module.diametro_pupilar" register={register} />
                    <FormInput label="Diámetro corneal" name="contact_lens_module.diametro_corneal" register={register} />
                    <FormInput label="Apertura palpebral" name="contact_lens_module.apertura_palpebral" register={register} />
                    <FormInput label="Tensión palpebral" name="contact_lens_module.tension_palpebral" register={register} />
                    <FormInput label="DHIV" name="contact_lens_module.dhiv" register={register} />
                    <FormSelect label="Ojo dominante" name="contact_lens_module.ojo_dominante" register={register} options={[{ value: 'OD', label: 'OD' }, { value: 'OI', label: 'OI' }]} />
                    <FormInput label="BUT" name="contact_lens_module.but_value" register={register} />
                    <FormInput label="Test de Schirmer" name="contact_lens_module.shirmer_test" register={register} />
                    <FormInput label="Tinción" name="contact_lens_module.tincion" register={register} />
                    <FormInput label="Frecuencia de parpadeo" name="contact_lens_module.frecuencia_parpadeo" register={register} />
                    <FormSelect label="Estado" name="contact_lens_module.estado" register={register} options={[{ value: 'en_observacion', label: 'En proceso de observación' }, { value: 'finalizado', label: 'Finalizado' }]} />
                    <div className="lg:col-span-5">
                        <TextArea label="Observaciones" name="contact_lens_module.observaciones" register={register} rows={3} />
                    </div>
                </div>
                <div className="mb-6 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-100">
                                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Lente de prueba</th>
                                {['Curva base', 'Poder', '%H2O', 'Material', 'Diámetro', 'Sobre-refracción', 'Agudeza visual'].map((column) => (
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
                                {['Curva base', 'Poder', 'Diámetro', '%H2O', 'Material'].map((column) => (
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

            <CollapsibleSection title="Oftalmoscopia" subtitle="Parámetros generales y tabla editable por distancias." sectionKey="oftalmoscopia" {...moduleSectionProps('consulta:sec_oftalmoscopia')}>
                <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <FormInput label="Fijación OD" name="ophthalmoscopy_module.fijacion_od" register={register} />
                    <FormInput label="Fijación OI" name="ophthalmoscopy_module.fijacion_oi" register={register} />
                    <FormInput label="Valoración motora / test" name="ophthalmoscopy_module.valoracion_motora" register={register} />
                    {/* PPC OBJ, Luz y FR pasaron al PPC de Terapia visual; sus valores siguen viajando en los defaults. */}
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
                            {ophthalmoscopyRows.map((row, rowIndex) => (
                                <tr key={row} className="border-b border-slate-200">
                                    <td className="px-3 py-3 font-medium text-slate-700">{row}</td>
                                    {ophthalmoscopyDistances.map((distance, distIndex) => (
                                        <td key={`${row}-${distance}`} className="px-2 py-2">
                                            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" {...register(`ophthalmoscopy_module.results.row${rowIndex}.col${distIndex}`)} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Tratamiento" subtitle="Plan terapéutico y modalidad de uso." sectionKey="tratamiento" {...moduleSectionProps('consulta:sec_tratamiento')}>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <TextArea label="Plan de tratamiento" name="treatment_module.plan" register={register} rows={4} />
                    <div className="grid grid-cols-1 gap-4">
                        <FormInput label="Horas de uso" name="treatment_module.horas_uso" register={register} />
                        <FormInput label="Método de limpieza" name="treatment_module.metodo_limpieza" register={register} />
                        <FormInput label="Modalidad de uso" name="treatment_module.modalidad_uso" register={register} />
                    </div>
                </div>
            </CollapsibleSection>

            <div className="mobile-sticky-actions -mx-4 px-4 py-4 lg:hidden">
                <div className={`grid gap-2 ${readOnly ? 'grid-cols-1' : 'grid-cols-3'}`}>
                    {!readOnly && (
                        <Button type="button" variant="secondary" className="justify-center" onClick={handleSaveDraft}>
                            <Clock size={18} /> Guardar
                        </Button>
                    )}
                    <Button type="button" variant="secondary" className="justify-center" onClick={handleGeneratePdf}>
                        <FileText size={18} /> Vista previa
                    </Button>
                    {!readOnly && (
                        <Button type="submit" className="justify-center" loading={saving}>
                            <Save size={18} /> Completar
                        </Button>
                    )}
                </div>
            </div>

            <div className="hidden flex-wrap justify-end gap-3 pb-8 lg:flex">
                {!readOnly && (
                    <Button type="button" variant="secondary" onClick={handleSaveDraft}>
                        <Clock size={20} /> {saveLabel}
                    </Button>
                )}
                <Button type="button" variant="secondary" onClick={handleGeneratePdf}>
                    <FileText size={20} /> Vista previa
                </Button>
                {!readOnly && (
                    <Button type="submit" loading={saving}>
                        <Save size={20} /> Completar consulta
                    </Button>
                )}
            </div>
        </form>

        {/* Fuera del <form>: Enter en el correo del certificado completaba la consulta. */}
        {showPdf && pdfData && (
            <CertificadoPdf data={pdfData} onClose={() => setShowPdf(false)} consultationDoctor={currentDoctor()} />
        )}

        <ConfirmModal
            open={confirmLeave}
            title="¿Salir sin guardar?"
            message="No se pudieron guardar los últimos cambios de la consulta. Si sale ahora se perderán."
            confirmLabel="Salir sin guardar"
            onConfirm={() => { setConfirmLeave(false); blocker.proceed?.(); }}
            onCancel={() => { setConfirmLeave(false); blocker.reset?.(); }}
        />

        {showRxReview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="rx-review-title">
                <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto overflow-x-hidden rounded-2xl bg-white p-6 shadow-xl">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
                            <AlertTriangle size={20} className="text-amber-600" />
                        </div>
                        <div>
                            <h3 id="rx-review-title" className="font-semibold text-gray-900">Revise las medidas antes de completar</h3>
                            <p className="text-sm text-gray-500">
                                {hasBlockingRxWarning
                                    ? 'Hay un dato que impide completar la consulta. Haga clic en un aviso para ir al campo:'
                                    : 'Estos valores son poco habituales. Haga clic en uno para corregirlo, o complete la consulta si son correctos:'}
                            </p>
                        </div>
                    </div>
                    <ul className="mb-5 space-y-1">
                        {rxReviewItems.map(({ field, message, blocking }) => (
                            <li key={`${field}:${message}`}>
                                <button
                                    type="button"
                                    onClick={() => goToWarningField(field)}
                                    className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${blocking ? 'text-red-700 hover:bg-red-50' : 'text-amber-900 hover:bg-amber-50'}`}
                                >
                                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${blocking ? 'bg-red-500' : 'bg-amber-500'}`} />
                                    <span className="flex-1">
                                        {message}
                                        {blocking && <span className="ml-1 font-semibold">Hay que corregirlo.</span>}
                                    </span>
                                    <ArrowRight size={16} className="shrink-0 opacity-60" />
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="flex flex-wrap justify-end gap-3">
                        <Button type="button" variant="secondary" onClick={() => goToWarningField(rxReviewItems[0]?.field)}>
                            Volver a revisar
                        </Button>
                        {!hasBlockingRxWarning && (
                            <Button type="button" onClick={() => { setShowRxReview(false); completeConsultation(); }}>
                                Completar de todos modos
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        )}

        {showRequiredModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle size={20} className="text-red-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Campos obligatorios incompletos</h3>
                            <p className="text-sm text-gray-500">Completa los siguientes campos para finalizar la consulta. Haz clic en uno para ir directo a él:</p>
                        </div>
                    </div>
                    <ul className="space-y-1 mb-5">
                        {missingFields.map(({ field, label }) => (
                            <li key={field}>
                                <button
                                    type="button"
                                    onClick={() => goToMissingField(field)}
                                    className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-red-700 transition-colors hover:bg-red-50"
                                >
                                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                    <span className="flex-1 underline decoration-red-300 underline-offset-2">{label}</span>
                                    <ArrowRight size={16} className="shrink-0 text-red-400" />
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => goToMissingField(missingFields[0]?.field)}
                            className="px-4 py-2 bg-[#1a2a4a] text-white rounded-lg text-sm font-medium hover:bg-[#253a6a] transition-colors"
                        >
                            Entendido, voy a completarlos
                        </button>
                    </div>
                </div>
            </div>
        )}
      </RequiredErrorsCtx.Provider>
      </FormReadOnlyContext.Provider>
    );
}
