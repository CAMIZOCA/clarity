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

// Letras escritas despues de una medida ("20cc"): la optica anota "CC" junto al
// numero que comprobo con una prueba. La nota empieza en la primera letra que
// sigue a un numero, o a una esfera neutra seguida de un espacio ("N CC"); "N",
// "PL" o "NEUTRO" solos son la esfera, no una nota. Mismo criterio que
// `OpticalValueNormalizer::splitNote` (PHP), que es quien las separa al guardar.
const MEASURE_NOTE = /^\s*([-+]{0,2}\s*\d[\d.,]*\s*°?|(?:N|NEUTRO|PLANO|PL)(?=\s))\s*(\p{L}.*)$/iu;

/**
 * @param {string|number|null|undefined} raw
 * @returns {{ value: string|number|null|undefined, note: string }}
 */
export function splitMeasureNote(raw) {
    const match = typeof raw === 'string' ? raw.match(MEASURE_NOTE) : null;
    if (!match) return { value: raw, note: '' };

    return { value: match[1].trim(), note: match[2].trim().replace(/\s+/g, ' ').toUpperCase() };
}

/** Une una medida ya formateada con su nota: ("20", "CC") -> "20 CC". */
export function withMeasureNote(value, note) {
    return note ? `${value} ${note}` : value;
}

/**
 * `normalizeOpticalValue` para esfera, cilindro y eje, que admiten letras
 * despues del numero: "20cc" -> "20 CC", "-125cc" -> "-1.25 CC".
 *
 * @param {string|null|undefined} raw
 * @param {'sphere'|'cylinder'|'axis'} type
 */
export function normalizeMeasureWithNote(raw, type) {
    if (raw === null || raw === undefined || raw === '') return raw;

    const { value, note } = splitMeasureNote(String(raw));

    return withMeasureNote(normalizeOpticalValue(value, type), note);
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

// Refraccion completa escrita de corrido en un campo de texto:
// esfera, cilindro (con su signo, que es lo que lo separa de la esfera) y eje.
const REFRACTION_TEXT = new RegExp(
    '^(NEUTRO|PLANO|PL|N|[+-]?\\d+(?:[.,]\\d+)?)'
    + '(?:\\s*([+-]\\s?\\d+(?:[.,]\\d+)?))?'
    + '(?:\\s*[x×*@]\\s*(\\d{1,3})\\s*°?)?'
    + '(?=$|\\s)(.*)$',
    'i'
);

// Eje escrito sin la "x", separado solo por un espacio: "-125 -225 180".
const TRAILING_AXIS = /^\s+(\d{1,3})\s*°?(?=$|\s)(.*)$/;

/**
 * Uniforma una refraccion escrita en un solo campo ("Lectura computador",
 * "Retinoscopia"): "-125-225x2" y "+050 -025 X 100" quedan "-1.25 -2.25 x 2" y
 * "+0.50 -0.25 x 100". Cada parte pasa por `normalizeOpticalValue`, asi que
 * sigue la misma regla de digitos que los campos de esfera y cilindro, y el
 * texto que venga despues ("cc 20/20") se conserva.
 *
 * Devuelve lo escrito tal cual cuando no es una refraccion (una agudeza
 * "20/20", una queratometria "43.50/44.25", un "ORTHO" heredado), cuando es un
 * numero sin signo ni cilindro —puede ser cualquier cosa— o cuando el
 * resultado no cabe en la columna (`maxLength`).
 *
 * @param {string|null|undefined} raw
 * @param {number} [maxLength]
 * @returns {string|null|undefined}
 */
export function normalizeRefractionText(raw, maxLength = Infinity) {
    if (raw === null || raw === undefined) return raw;

    const text = String(raw).trim();
    const match = REFRACTION_TEXT.exec(text);
    if (!match) return raw;

    const [, sphereText, cylinderText] = match;
    let [, , , axisText, rest] = match;

    if (cylinderText && !axisText) {
        const trailing = TRAILING_AXIS.exec(rest);
        if (trailing) [, axisText, rest] = trailing;
    }

    // Sin cilindro, solo una esfera con signo (o "N") es claramente una
    // refraccion: "43.50 x 90" puede ser una queratometria.
    const hasSign = /^[+-]/.test(sphereText) || /^[a-z]/i.test(sphereText);
    if (!cylinderText && !hasSign) return raw;

    const parts = [normalizeOpticalValue(sphereText, 'sphere')];
    if (cylinderText) parts.push(normalizeOpticalValue(cylinderText, 'cylinder'));
    if (axisText) parts.push(`x ${Number(axisText)}`);
    if (rest.trim()) parts.push(rest.trim());

    const formatted = parts.join(' ');
    return formatted.length > maxLength ? raw : formatted;
}

export const normalizeSphere = (raw) => normalizeOpticalValue(raw, 'sphere');
export const normalizeCylinder = (raw) => normalizeOpticalValue(raw, 'cylinder');
export const normalizeAxisValue = (raw) => normalizeOpticalValue(raw, 'axis');
export const normalizeAdd = (raw) => normalizeOpticalValue(raw, 'add');

/** Formatea una esfera ya normalizada para el resumen de solo lectura ("N", "+0.25", "±0.00" si está vacía). */
export function displaySphere(value, emptyPlaceholder = '±0.00') {
    if (value === null || value === undefined || value === '') return emptyPlaceholder;
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
