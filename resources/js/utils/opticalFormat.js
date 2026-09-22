// Normaliza medidas ópticas escritas sin punto decimal (personal de clínica,
// teclado rápido, sin decimales): "025" -> "0.25", "-050" -> "-0.50".
//
// Espejo exacto de `App\Support\OpticalValueNormalizer` (PHP) — mismas reglas,
// misma firma conceptual. Ver ese archivo para el detalle de cada regla.

const NEUTRAL_ALIASES = new Set(['N', 'NEUTRO', 'PLANO', 'PL']);

function normalizeAxis(value, raw) {
    const stripped = value.replace(/°+$/, '');
    if (stripped === '' || Number.isNaN(Number(stripped))) return raw;
    return String(Math.round(Number(stripped)));
}

function normalizeDecimal(value, raw) {
    let sign = '';
    let rest = value;
    if (rest !== '' && (rest[0] === '+' || rest[0] === '-')) {
        sign = rest[0];
        rest = rest.slice(1);
    }

    if (rest === '' || Number.isNaN(Number(rest))) return raw;

    if (rest.includes('.')) {
        return sign + Number(rest).toFixed(2);
    }

    const digits = rest;
    if (digits.length >= 3) {
        const integerPart = digits.slice(0, -2);
        const decimalPart = digits.slice(-2);
        return sign + Number(`${integerPart}.${decimalPart}`).toFixed(2);
    }

    return sign + Number(digits).toFixed(2);
}

/** @param {string|null|undefined} raw @param {'sphere'|'cylinder'|'axis'|'add'} type */
export function normalizeOpticalValue(raw, type) {
    if (raw === null || raw === undefined || raw === '') return raw;

    let value = String(raw).trim().replace(/\s+/g, '');
    value = value.replace(',', '.');

    if (type === 'sphere' && NEUTRAL_ALIASES.has(value.toUpperCase())) {
        return 'N';
    }

    if (type === 'axis') {
        return normalizeAxis(value, raw);
    }

    return normalizeDecimal(value, raw);
}

export const normalizeSphere = (raw) => normalizeOpticalValue(raw, 'sphere');
export const normalizeCylinder = (raw) => normalizeOpticalValue(raw, 'cylinder');
export const normalizeAxisValue = (raw) => normalizeOpticalValue(raw, 'axis');
export const normalizeAdd = (raw) => normalizeOpticalValue(raw, 'add');

/** Formatea una esfera ya normalizada para el resumen de solo lectura ("N", "+0.25", "±0.00" si está vacía). */
export function displaySphere(value) {
    if (value === null || value === undefined || value === '') return '±0.00';
    if (String(value).toUpperCase() === 'N') return 'N';
    const num = Number(value);
    if (Number.isNaN(num)) return String(value);
    return num >= 0 ? `+${num.toFixed(2)}` : num.toFixed(2);
}

/** Formatea cilindro/ADD ya normalizados ("+0.25", "-0.50", "±0.00" si está vacío). */
export function displaySigned(value, emptyPlaceholder = '±0.00') {
    if (value === null || value === undefined || value === '') return emptyPlaceholder;
    const num = Number(value);
    if (Number.isNaN(num)) return String(value);
    return num >= 0 ? `+${num.toFixed(2)}` : num.toFixed(2);
}
