// Normaliza medidas ópticas escritas sin punto decimal (personal de clínica,
// teclado rápido, sin decimales): "025" -> "0.25", "-050" -> "-0.50".
//
// Las reglas de digitos son las de `App\Support\OpticalValueNormalizer` (PHP);
// ver ese archivo para el detalle de cada una.
//
// El signo, en cambio, es cosa de este archivo: la receta se escribe con signo
// siempre explicito ("+0.75", "-0.25"), y como las columnas son `decimal` el
// "+" no se guarda, asi que hay que reponerlo al cargar (`formatOpticalForInput`).
// Un cilindro tecleado sin signo se toma negativo, que es la convencion de la
// optometria; el backend no lo hace, porque ahi un 0.25 sin signo es un numero
// positivo legitimo (otros clientes de la API, valores ya guardados).

const NEUTRAL_ALIASES = new Set(['N', 'NEUTRO', 'PLANO', 'PL']);

// Signo que recibe un valor escrito sin signo, segun la medida.
const DEFAULT_SIGN = { sphere: '+', cylinder: '-', add: '+' };

/** "+0.75" / "-0.25"; el cero va sin signo. */
function withSign(sign, magnitude, type) {
    if (Number(magnitude) === 0) return '0.00';
    return (sign || DEFAULT_SIGN[type] || '') + magnitude;
}

function normalizeAxis(value, raw) {
    const stripped = value.replace(/°+$/, '');
    if (stripped === '' || Number.isNaN(Number(stripped))) return raw;
    return String(Math.round(Number(stripped)));
}

function normalizeDecimal(value, raw, type) {
    let sign = '';
    let rest = value;
    if (rest !== '' && (rest[0] === '+' || rest[0] === '-')) {
        sign = rest[0];
        rest = rest.slice(1);
    }

    if (rest === '' || Number.isNaN(Number(rest))) return raw;

    if (rest.includes('.')) {
        return withSign(sign, Number(rest).toFixed(2), type);
    }

    const digits = rest;
    if (digits.length >= 3) {
        const integerPart = digits.slice(0, -2);
        const decimalPart = digits.slice(-2);
        return withSign(sign, Number(`${integerPart}.${decimalPart}`).toFixed(2), type);
    }

    return withSign(sign, Number(digits).toFixed(2), type);
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

    return normalizeDecimal(value, raw, type);
}

/**
 * Valor guardado (numero o texto decimal) tal como debe verse en un input:
 * dos decimales y signo explicito. A diferencia de `normalizeOpticalValue` no
 * reinterpreta digitos ni cambia el signo: un cilindro positivo guardado sigue
 * siendo positivo, y un valor legacy fuera de rango se muestra como esta.
 *
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
export function formatOpticalForInput(value) {
    if (value === null || value === undefined || value === '') return '';
    if (String(value).toUpperCase() === 'N') return 'N';
    const num = Number(value);
    if (Number.isNaN(num)) return String(value);
    if (num === 0) return '0.00';
    return num > 0 ? `+${num.toFixed(2)}` : num.toFixed(2);
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
