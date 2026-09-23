// Sugerencias de diagnostico refractivo a partir de las medidas de la consulta.
//
// Es una ayuda orientativa para ordenar el catalogo: nada se marca solo y el
// criterio clinico siempre manda. Los umbrales siguen definiciones
// internacionales de uso comun:
//   - Miopia / hipermetropia: equivalente esferico (EE) <= -0.50 / >= +0.50 D
//     (OMS, International Myopia Institute). Grados de hipermetropia: AOA.
//   - Astigmatismo: cilindro >= 0.50 D; tipo segun los meridianos principales.
//   - Presbicia: ADD >= +0.75 D (o edad >= 40 sin ADD, como sospecha).
//   - Anisometropia: diferencia de EE entre ojos >= 1.00 D.
//   - Ambliopia (sospecha): AV corregida peor que 20/30 o >= 2 lineas de
//     diferencia entre ojos (AAO, Preferred Practice Pattern).
//   - Deficiencia visual: categorias OMS / CIE-11 sobre la AV.

import { normalizeOpticalValue } from './opticalFormat';

export const DIAGNOSIS_CRITERIA = [
    { label: 'Miopía', rule: 'EE ≤ −0.50 D · leve hasta −3.00, moderada hasta −6.00, alta ≤ −6.00 D (OMS / IMI)' },
    { label: 'Hipermetropía', rule: 'EE ≥ +0.50 D · leve ≤ +2.00, moderada +2.25 a +5.00, alta > +5.00 D (AOA)' },
    { label: 'Astigmatismo', rule: 'Cilindro ≥ 0.50 D · leve < 1.00, moderado 1.00–2.00, alto > 2.00 D · simple, compuesto o mixto según meridianos' },
    { label: 'Presbicia', rule: 'ADD ≥ +0.75 D, o edad ≥ 40 años como sospecha' },
    { label: 'Anisometropía', rule: 'Diferencia de EE entre ojos ≥ 1.00 D · antimetropía si un ojo es miope y el otro hipermétrope' },
    { label: 'Ambliopía (sospecha)', rule: 'AV corregida peor que 20/30 o ≥ 2 líneas de diferencia entre ojos (AAO)' },
    { label: 'Deficiencia visual', rule: 'AV < 20/40 leve, < 20/60 moderada, < 20/200 grave, < 20/400 ceguera (OMS, CIE-11)' },
];

const EYES = ['od', 'oi'];
const EYE_LABEL = { od: 'OD', oi: 'OI' };

// Conceptos que definen la entidad; los calificadores (simple/compuesto)
// solo afinan el orden dentro de la misma familia.
const PRIMARY_CONCEPTS = new Set([
    'miopia', 'hipermetropia', 'astigmatismo', 'mixto', 'presbicia',
    'anisometropia', 'antimetropia', 'ambliopia', 'emetropia', 'baja_vision',
]);

// Entidades que describen el tipo de ametropia del ojo.
const REFRACTIVE_CONCEPTS = ['miopia', 'hipermetropia', 'astigmatismo', 'mixto', 'emetropia'];

const LABEL_PATTERNS = [
    ['miopia', /miop/],
    ['hipermetropia', /hipermetrop|hiperop/],
    ['astigmatismo', /astigm/],
    ['presbicia', /presbi/],
    ['anisometropia', /anisometr/],
    ['antimetropia', /antimetr/],
    ['ambliopia', /amblio/],
    ['emetropia', /\bemetrop/],
    ['baja_vision', /baja vision|deficiencia visual/],
    ['compuesto', /compuest/],
    ['simple', /\bsimple\b/],
    ['mixto', /\bmixt/],
];

// Solo si la etiqueta no dice nada reconocible.
const CODE_PATTERNS = [
    ['miopia', /H52\.1/],
    ['hipermetropia', /H52\.0/],
    ['astigmatismo', /H52\.2/],
    ['presbicia', /H52\.4/],
    ['anisometropia', /H52\.3/],
    ['ambliopia', /H53\.0/],
    ['baja_vision', /H54/],
];

const normalizeText = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const isBlank = (value) => value === null || value === undefined || String(value).trim() === '';

function toNumber(raw, type) {
    if (isBlank(raw)) return null;
    const normalized = normalizeOpticalValue(raw, type);
    if (String(normalized).toUpperCase() === 'N') return 0;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
}

/** "20/40", "20/40-2", "6/12", "0.5", "CD", "PL"... -> agudeza decimal. */
export function parseVisualAcuity(raw) {
    if (isBlank(raw)) return null;
    const value = String(raw).trim().toUpperCase().replace(',', '.');

    if (/^(NPL|NO ?PL)/.test(value)) return 0;
    if (/^(PL|PPL|LUZ)/.test(value)) return 0.002;
    if (/^(MM|MANO)/.test(value)) return 0.005;
    if (/^(CD|CUENTA)/.test(value)) return 0.01;

    const fraction = value.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (fraction) {
        const numerator = Number(fraction[1]);
        const denominator = Number(fraction[2]);
        return denominator > 0 ? numerator / denominator : null;
    }

    const decimal = Number(value);
    return Number.isFinite(decimal) && decimal > 0 && decimal <= 2 ? decimal : null;
}

const formatDiopters = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)} D`;

function toSnellen(decimal) {
    if (decimal === null) return '';
    if (decimal <= 0) return 'NPL';
    return `20/${Math.round(20 / decimal)}`;
}

function readEye(values, eye) {
    const sources = [
        { label: 'RX Final', prefix: 'rx_final', av: `rx_final_av_${eye}` },
        { label: 'Subjetivo', prefix: 'subj', av: `subj_avl_${eye}` },
    ];

    for (const source of sources) {
        const sphere = toNumber(values?.[`${source.prefix}_esfera_${eye}`], 'sphere');
        const cylinder = toNumber(values?.[`${source.prefix}_cilindro_${eye}`], 'cylinder');
        if (sphere === null && cylinder === null) continue;

        return {
            source: source.label,
            sphere: sphere ?? 0,
            cylinder: cylinder ?? 0,
            axis: toNumber(values?.[`${source.prefix}_eje_${eye}`], 'axis'),
            add: toNumber(values?.[`rx_final_add_${eye}`], 'add'),
            acuity: parseVisualAcuity(values?.[source.av])
                ?? parseVisualAcuity(values?.[`rx_final_av_${eye}`])
                ?? parseVisualAcuity(values?.[`avcc_${eye}`]),
        };
    }

    return {
        source: null,
        add: toNumber(values?.[`rx_final_add_${eye}`], 'add'),
        acuity: parseVisualAcuity(values?.[`rx_final_av_${eye}`]) ?? parseVisualAcuity(values?.[`avcc_${eye}`]),
    };
}

const grade = (value, limits) => limits.find(([limit]) => value <= limit)?.[1] ?? limits.at(-1)[1];

function astigmatismOrientation(cylinder, axis) {
    if (axis === null) return '';
    // Se lleva a notacion de cilindro negativo, donde "con la regla" es eje ~180.
    const minusAxis = cylinder > 0 ? ((axis + 90) % 180) : axis % 180;
    if (minusAxis <= 30 || minusAxis >= 150) return 'con la regla';
    if (minusAxis >= 60 && minusAxis <= 120) return 'contra la regla';
    return 'oblicuo';
}

function classifyRefraction({ sphere, cylinder, axis }) {
    const equivalent = sphere + cylinder / 2;
    const tags = new Map();
    const meridians = [sphere, sphere + cylinder];
    const isPlano = (power) => Math.abs(power) < 0.125;

    if (Math.abs(cylinder) >= 0.5) {
        const magnitude = Math.abs(cylinder);
        const degree = grade(magnitude, [[0.99, 'leve'], [2, 'moderado'], [Infinity, 'alto']]);
        const orientation = astigmatismOrientation(cylinder, axis);
        const [first, second] = meridians;
        let type;

        tags.set('astigmatismo', 1);
        if ((first < 0 && second > 0) || (first > 0 && second < 0)) {
            type = 'mixto';
            tags.set('mixto', 1);
        } else if (first <= 0 && second <= 0) {
            type = isPlano(first) || isPlano(second) ? 'miópico simple' : 'miópico compuesto';
            tags.set('miopia', 1);
            tags.set(type.endsWith('simple') ? 'simple' : 'compuesto', 1);
        } else {
            type = isPlano(first) || isPlano(second) ? 'hipermetrópico simple' : 'hipermetrópico compuesto';
            tags.set('hipermetropia', 1);
            tags.set(type.endsWith('simple') ? 'simple' : 'compuesto', 1);
        }

        const details = [`cil ${formatDiopters(cylinder)}`, orientation].filter(Boolean).join(', ');
        return { tags, equivalent, text: `Astigmatismo ${type} ${degree} (${details}; EE ${formatDiopters(equivalent)})` };
    }

    if (equivalent <= -0.5) {
        tags.set('miopia', 1);
        tags.set('simple', 1);
        const degree = grade(-equivalent, [[2.99, 'leve'], [5.99, 'moderada'], [Infinity, 'alta']]);
        return { tags, equivalent, text: `Miopía ${degree} (EE ${formatDiopters(equivalent)})` };
    }

    if (equivalent >= 0.5) {
        tags.set('hipermetropia', 1);
        tags.set('simple', 1);
        const degree = grade(equivalent, [[2, 'leve'], [5, 'moderada'], [Infinity, 'alta']]);
        return { tags, equivalent, text: `Hipermetropía ${degree} (EE ${formatDiopters(equivalent)})` };
    }

    tags.set('emetropia', 1);
    return { tags, equivalent, text: `Sin ametropía significativa (EE ${formatDiopters(equivalent)})` };
}

function visualImpairment(acuity) {
    if (acuity === null || acuity >= 0.5) return null;
    if (acuity >= 1 / 3) return 'leve';
    if (acuity >= 0.1) return 'moderada';
    if (acuity >= 0.05) return 'grave';
    return 'ceguera';
}

/**
 * Analiza las medidas del formulario.
 *
 * @returns {{ source: string|null, eyes: Record<'od'|'oi', { tags: Map<string, number>, findings: string[] }>, general: string[], hasData: boolean }}
 */
export function analyzeRefraction(values, patientAge = null) {
    const readings = Object.fromEntries(EYES.map((eye) => [eye, readEye(values, eye)]));
    const eyes = {};
    const general = [];
    const equivalents = {};

    for (const eye of EYES) {
        const reading = readings[eye];
        const tags = new Map();
        const findings = [];

        if (reading.source) {
            const result = classifyRefraction(reading);
            result.tags.forEach((weight, tag) => tags.set(tag, weight));
            findings.push(result.text);
            equivalents[eye] = result.equivalent;
        }

        if (reading.add !== null && reading.add >= 0.75) {
            tags.set('presbicia', 1);
            findings.push(`Presbicia (ADD ${formatDiopters(reading.add)})`);
        } else if (Number(patientAge) >= 40) {
            tags.set('presbicia', 0.5);
            findings.push(`Edad ${patientAge} años sin ADD registrada: evaluar presbicia`);
        }

        if (reading.acuity !== null && reading.acuity < 0.66) {
            tags.set('ambliopia', 0.8);
            findings.push(`AV corregida ${toSnellen(reading.acuity)}: descartar ambliopía`);
        }

        const impairment = visualImpairment(reading.acuity);
        if (impairment) {
            tags.set('baja_vision', 0.8);
            findings.push(`Rango de deficiencia visual ${impairment} (OMS)`);
        }

        eyes[eye] = { tags, findings };
    }

    const [odAcuity, oiAcuity] = EYES.map((eye) => readings[eye].acuity);
    if (odAcuity > 0 && oiAcuity > 0) {
        const lines = Math.abs(Math.log10(odAcuity) - Math.log10(oiAcuity)) / 0.1;
        if (lines >= 2 - 1e-9) {
            const worse = odAcuity < oiAcuity ? 'od' : 'oi';
            eyes[worse].tags.set('ambliopia', Math.max(eyes[worse].tags.get('ambliopia') ?? 0, 0.8));
            general.push(`Diferencia de ${Math.round(lines)} líneas de AV entre ojos (peor ${EYE_LABEL[worse]}): descartar ambliopía`);
        }
    }

    if (equivalents.od !== undefined && equivalents.oi !== undefined) {
        const difference = Math.abs(equivalents.od - equivalents.oi);
        const antimetropia = (equivalents.od <= -0.5 && equivalents.oi >= 0.5) || (equivalents.oi <= -0.5 && equivalents.od >= 0.5);
        if (antimetropia) {
            EYES.forEach((eye) => eyes[eye].tags.set('antimetropia', 0.9));
            general.push('Antimetropía: un ojo miope y el otro hipermétrope');
        }
        if (difference >= 1) {
            EYES.forEach((eye) => eyes[eye].tags.set('anisometropia', 0.9));
            general.push(`Anisometropía (diferencia de EE ${difference.toFixed(2)} D)`);
        }
    }

    const sources = [...new Set(EYES.map((eye) => readings[eye].source).filter(Boolean))];

    return {
        source: sources.join(' / ') || null,
        eyes,
        general,
        hasData: EYES.some((eye) => eyes[eye].findings.length > 0) || general.length > 0,
    };
}

/** Conceptos clinicos que nombra un item del catalogo (por etiqueta o, si no, por codigo CIE-10). */
export function catalogConcepts(option) {
    const label = normalizeText(`${option?.label ?? ''} ${option?.description ?? ''}`);
    const fromLabel = LABEL_PATTERNS.filter(([, pattern]) => pattern.test(label)).map(([concept]) => concept);
    if (fromLabel.some((concept) => PRIMARY_CONCEPTS.has(concept))) return fromLabel;

    const code = String(option?.code ?? '').toUpperCase();
    return [...new Set([...fromLabel, ...CODE_PATTERNS.filter(([, pattern]) => pattern.test(code)).map(([concept]) => concept)])];
}

/** Puntaje 0-100 de un item del catalogo frente a los hallazgos de un ojo. */
export function scoreOption(option, tags) {
    const concepts = catalogConcepts(option);
    const primaries = concepts.filter((concept) => PRIMARY_CONCEPTS.has(concept));
    if (!primaries.length || !tags?.size) return 0;

    const matchedPrimaries = primaries.filter((concept) => (tags.get(concept) ?? 0) > 0);
    if (!matchedPrimaries.length) return 0;

    const ratio = concepts.reduce((sum, concept) => sum + (tags.get(concept) ?? 0), 0) / concepts.length;
    let score = Math.round(ratio * 100);

    // "Miopia simple" no debe empatar con el astigmatismo miopico del ojo: si
    // el item describe la ametropia, tiene que describirla completa.
    const itemRefractive = concepts.filter((concept) => REFRACTIVE_CONCEPTS.includes(concept));
    const eyeRefractive = REFRACTIVE_CONCEPTS.filter((concept) => (tags.get(concept) ?? 0) >= 1);
    if (itemRefractive.length && eyeRefractive.some((concept) => !itemRefractive.includes(concept))) {
        score = Math.round(score * 0.7);
    }

    // Si falta una entidad que el item exige, queda al fondo de las sugerencias.
    return matchedPrimaries.length < primaries.length ? Math.min(score, 40) : score;
}

export function scoreLevel(score) {
    if (score >= 90) return 'alta';
    if (score >= 50) return 'media';
    if (score > 0) return 'baja';
    return null;
}

/** Catalogo ordenado de mayor a menor probabilidad; empates conservan el orden original. */
export function rankDiagnosisOptions(options, tags) {
    return options
        .map((option, index) => {
            const score = scoreOption(option, tags);
            return { option, score, level: scoreLevel(score), index };
        })
        .sort((a, b) => b.score - a.score || a.index - b.index);
}
