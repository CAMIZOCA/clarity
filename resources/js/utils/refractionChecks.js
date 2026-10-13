// Avisos sobre las medidas de la consulta: datos que el formulario acepta pero
// que casi siempre son un error de tecleo.
//
// El formato rapido de la optica ("025" -> 0.25) tiene un costado: "25" es
// +25.00, una esfera sin signo queda positiva y nada relaciona un cilindro con
// su eje. Nada de eso falla en la validacion, asi que una receta equivocada se
// guardaba sin ninguna senal.
//
// Son avisos, no errores: el criterio clinico manda y la consulta se puede
// completar igual. La unica excepcion es un cilindro sin eje en la RX Final
// (`blocking`), que tambien rechaza `StoreConsultationRequest`.
//
// Solo se revisa lo que cambio respecto de lo cargado (`baseline`): un dato
// heredado de la importacion no avisa por el solo hecho de abrir la consulta,
// igual que `UpdateConsultationRequest::relaxRangesForUnchangedValues()`.

import { normalizeOpticalValue, splitMeasureNote } from './opticalFormat';
import { parseVisualAcuity } from './diagnosisSuggestions';

const EYES = ['od', 'oi'];
const EYE_LABEL = { od: 'OD', oi: 'OI' };

// A partir de aqui un valor es posible pero raro, y suele ser un "25" que
// quiso ser "025".
const UNUSUAL = { sphere: 12, cylinder: 6, add: 3.5 };

const isBlank = (value) => value === null || value === undefined || String(value).trim() === '';

const sameValue = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();

/**
 * Numero tal como lo dejaria el formulario al salir del campo ("N" es 0). Las
 * letras que siguen al numero ("20 CC") son una nota y no cuentan.
 */
function toNumber(raw, type) {
    if (isBlank(raw)) return null;

    const normalized = normalizeOpticalValue(splitMeasureNote(raw).value, type);
    if (String(normalized).toUpperCase() === 'N') return 0;

    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
}

const signed = (value) => (value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2));

const isQuarterStep = (value) => Math.abs(value * 4 - Math.round(value * 4)) < 0.001;

/**
 * "25" se guarda como 25.00; quien queria 0.25 debia escribir "025". Solo se
 * sugiere cuando el valor es un entero que cabe en dos digitos.
 */
function decimalSlipHint(value) {
    const magnitude = Math.abs(value);
    if (!Number.isInteger(magnitude) || magnitude > 99) return '';

    const sign = value < 0 ? '-' : '';
    return ` Si quiso ${signed(value / 100)}, escriba ${sign}${String(magnitude).padStart(3, '0')}.`;
}

/**
 * Grupos de medidas del formulario: como se nombra cada uno en el aviso y como
 * se llama y se lee cada campo.
 */
function measurementGroups(values) {
    const flat = (prefix, label, columns, extra = {}) => ({
        label,
        columns,
        name: (column, eye) => `${prefix}_${column}_${eye}`,
        read: (column, eye) => values?.[`${prefix}_${column}_${eye}`],
        ...extra,
    });

    const rxUso = (values?.rx_uso_entries ?? []).map((entry, index) => ({
        label: `RX en uso ${index + 1}`,
        columns: ['esfera', 'cilindro', 'eje', 'add', 'avcc'],
        acuity: 'avcc',
        name: (column, eye) => `rx_uso_entries.${index}.${column}_${eye}`,
        read: (column, eye) => entry?.[`${column}_${eye}`],
    }));

    return [
        ...rxUso,
        flat('subj', 'Subjetivo', ['esfera', 'cilindro', 'eje', 'avl'], { acuity: 'avl' }),
        flat('rx_final', 'RX Final', ['esfera', 'cilindro', 'eje', 'add', 'av'], { acuity: 'av', isFinal: true }),
        flat('vc', 'Visión de cerca', ['esfera', 'cilindro', 'eje', 'avcc'], { acuity: 'avcc' }),
    ];
}

/** El usuario no toco ninguna medida de ese ojo desde que se cargo la consulta. */
function eyeUnchanged(group, baselineGroup, eye) {
    if (!baselineGroup) return false;

    return group.columns.every((column) => sameValue(group.read(column, eye), baselineGroup.read(column, eye)));
}

function checkAcuity(raw, field, where, warnings) {
    if (isBlank(raw) || parseVisualAcuity(raw) !== null) return;

    warnings.push({
        field,
        message: `${where}: no se reconoce la agudeza visual "${String(raw).trim()}" (ej. 20/40, 20/20-2, CD 3 m).`,
    });
}

function checkEye(group, eye, warnings) {
    const where = `${group.label} ${EYE_LABEL[eye]}`;
    const field = (column) => group.name(column, eye);

    const sphere = toNumber(group.read('esfera', eye), 'sphere');
    const cylinder = toNumber(group.read('cilindro', eye), 'cylinder');
    const axis = toNumber(group.read('eje', eye), 'axis');
    const add = group.columns.includes('add') ? toNumber(group.read('add', eye), 'add') : null;
    const hasCylinder = cylinder !== null && cylinder !== 0;

    // El orden importa: de un campo se muestra el primer aviso.
    //
    // Una sola letra tras el numero casi nunca es una nota: "2O" o "1I" son un
    // cero o un uno mal tecleados, y el servidor ya no los rechaza.
    for (const [column, label] of [['esfera', 'la esfera'], ['cilindro', 'el cilindro'], ['eje', 'el eje']]) {
        const { note } = splitMeasureNote(group.read(column, eye));
        if (note.length === 1) {
            warnings.push({ field: field(column), message: `${where}: ${label} lleva la letra "${note}" después del número. Si era un dígito, corríjalo.` });
        }
    }

    if (hasCylinder && axis === null) {
        warnings.push({ field: field('eje'), message: `${where}: hay cilindro sin eje.`, blocking: Boolean(group.isFinal) });
    }
    if (axis !== null && !hasCylinder) {
        warnings.push({ field: field('cilindro'), message: `${where}: hay eje sin cilindro.` });
    }
    if (axis !== null && (axis < 1 || axis > 180)) {
        warnings.push({
            field: field('eje'),
            message: axis === 0
                ? `${where}: el eje va de 1 a 180; para 0° se escribe 180.`
                : `${where}: el eje va de 1 a 180.`,
        });
    }

    if (sphere !== null && Math.abs(sphere) > UNUSUAL.sphere) {
        warnings.push({ field: field('esfera'), message: `${where}: una esfera de ${signed(sphere)} es poco habitual.${decimalSlipHint(sphere)}` });
    }
    if (hasCylinder && Math.abs(cylinder) > UNUSUAL.cylinder) {
        warnings.push({ field: field('cilindro'), message: `${where}: un cilindro de ${signed(cylinder)} es poco habitual.${decimalSlipHint(cylinder)}` });
    }
    if (hasCylinder && cylinder > 0) {
        warnings.push({ field: field('cilindro'), message: `${where}: el cilindro está en positivo (${signed(cylinder)}); confirme el signo.` });
    }
    if (add !== null && add < 0) {
        warnings.push({ field: field('add'), message: `${where}: la ADD no puede ser negativa.` });
    } else if (add !== null && add > UNUSUAL.add) {
        warnings.push({ field: field('add'), message: `${where}: una ADD de ${signed(add)} es poco habitual.${decimalSlipHint(add)}` });
    }

    for (const [column, label, value] of [['esfera', 'la esfera', sphere], ['cilindro', 'el cilindro', cylinder], ['add', 'la ADD', add]]) {
        if (value !== null && !isQuarterStep(value)) {
            warnings.push({ field: field(column), message: `${where}: ${label} ${signed(value)} no es múltiplo de 0.25.` });
        }
    }

    checkAcuity(group.read(group.acuity, eye), field(group.acuity), where, warnings);
}

/**
 * La RX Final contra la receta de la que parte el paciente: la primera RX en
 * uso o, si no se lleno, la RX final de la consulta anterior.
 */
function checkAgainstReference(values, previous, eye, warnings) {
    const sphere = toNumber(values?.[`rx_final_esfera_${eye}`], 'sphere');
    if (sphere === null) return;

    const inUse = values?.rx_uso_entries?.[0]?.[`esfera_${eye}`];
    const reference = isBlank(inUse)
        ? { value: toNumber(previous?.[`rx_final_esfera_${eye}`], 'sphere'), label: 'la consulta anterior' }
        : { value: toNumber(inUse, 'sphere'), label: 'la RX en uso' };
    if (reference.value === null) return;

    const field = `rx_final_esfera_${eye}`;
    const change = `${signed(reference.value)} → ${signed(sphere)}`;

    if (sphere * reference.value < 0) {
        warnings.push({ field, message: `RX Final ${EYE_LABEL[eye]}: la esfera cambia de signo respecto a ${reference.label} (${change}).` });
    } else if (Math.abs(sphere - reference.value) >= 2) {
        warnings.push({ field, message: `RX Final ${EYE_LABEL[eye]}: la esfera cambia 2.00 D o más respecto a ${reference.label} (${change}).` });
    }
}

/**
 * @param {object} values - valores actuales del formulario de consulta
 * @param {object} [options]
 * @param {object|null} [options.baseline] - valores con los que se cargo el formulario
 * @param {object|null} [options.previous] - resumen de la consulta anterior del paciente
 * @returns {{ field: string, message: string, blocking?: boolean }[]}
 */
export function refractionWarnings(values, { baseline = null, previous = null } = {}) {
    const warnings = [];
    const groups = measurementGroups(values);
    const baselineGroups = baseline ? measurementGroups(baseline) : [];
    const baselineByLabel = new Map(baselineGroups.map((group) => [group.label, group]));

    const finalChanged = {};

    for (const group of groups) {
        for (const eye of EYES) {
            const unchanged = eyeUnchanged(group, baselineByLabel.get(group.label), eye);
            if (group.isFinal) finalChanged[eye] = !unchanged;
            if (!unchanged) checkEye(group, eye, warnings);
        }
    }

    for (const eye of EYES) {
        if (finalChanged[eye]) checkAgainstReference(values, previous, eye, warnings);
    }

    if (finalChanged.od || finalChanged.oi) {
        const addOd = toNumber(values?.rx_final_add_od, 'add');
        const addOi = toNumber(values?.rx_final_add_oi, 'add');
        if (addOd !== null && addOi !== null && addOd !== addOi) {
            warnings.push({
                field: 'rx_final_add_oi',
                message: `RX Final: la ADD es distinta en cada ojo (OD ${signed(addOd)}, OI ${signed(addOi)}).`,
            });
        }
    }

    // Agudezas de la tabla del examen visual, que no pertenecen a ningun grupo.
    for (const [column, label] of [['avsc', 'AV.SC lejos'], ['avcc', 'AV Retinoscopía VL']]) {
        for (const eye of EYES) {
            const name = `${column}_${eye}`;
            if (baseline && sameValue(values?.[name], baseline[name])) continue;

            checkAcuity(values?.[name], name, `${label} ${EYE_LABEL[eye]}`, warnings);
        }
    }

    return warnings;
}
