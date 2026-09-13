/**
 * Utilidades de fecha compartidas.
 *
 * Toda fecha "de calendario" (sin hora) viaja como `YYYY-MM-DD` entre el frontend
 * y la API. Parsearla con `new Date('YYYY-MM-DD')` la interpreta como medianoche
 * UTC, asi que en UTC-5 (Ecuador) se muestra el dia anterior. Por eso todos los
 * parseos de este modulo anclan la hora al mediodia local.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ]\d{2}:\d{2}/;
const DISPLAY_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function pad(value) {
    return String(value).padStart(2, '0');
}

/**
 * Convierte cualquier fecha soportada a un `Date` local seguro (mediodia).
 * Devuelve `null` si el valor no es una fecha valida.
 */
export function parseDate(value) {
    if (!value) return null;

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    const iso = raw.match(ISO_DATE);
    if (iso) {
        const [, year, month, day] = iso;
        const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    // Un timestamp con hora no es una fecha de calendario: anclarlo al
    // mediodia local descartaba la hora real y toda marca horaria se
    // mostraba como 12:00. Aqui se deja que el motor aplique la zona.
    if (ISO_DATETIME.test(raw)) {
        const parsed = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const display = raw.match(DISPLAY_DATE);
    if (display) {
        const [, day, month, year] = display;
        const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** `YYYY-MM-DD` | Date -> `DD/MM/AAAA`. Cadena vacia si no hay fecha valida. */
export function toDisplayDate(value, fallback = '') {
    const date = parseDate(value);
    if (!date) return fallback;
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** `DD/MM/AAAA` | Date -> `YYYY-MM-DD` (formato que espera la API). */
export function toIsoDate(value, fallback = '') {
    const date = parseDate(value);
    if (!date) return fallback;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Fecha de hoy en `YYYY-MM-DD`, en hora local (no UTC). */
export function todayIso() {
    return toIsoDate(new Date());
}

/** Solo el anio de una fecha, para cabeceras compactas. */
export function getYear(value, fallback = '') {
    const date = parseDate(value);
    return date ? String(date.getFullYear()) : fallback;
}

/** Edad en anios cumplidos. Devuelve `null` si no hay fecha valida. */
export function calculateAge(value) {
    const birth = parseDate(value);
    if (!birth) return null;

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age -= 1;
    }

    return age >= 0 ? age : null;
}

/**
 * Timestamp -> `YYYY-MM-DDTHH:mm` en hora local, que es lo que espera
 * `<input type="datetime-local">`.
 *
 * Recortar la cadena ISO con `.slice(0, 16)` mostraba la hora UTC dentro
 * del input, y al reenviarla la cita se corria una vez por cada edicion.
 */
export function toDateTimeLocal(value, fallback = '') {
    const date = parseDate(value);
    if (!date) return fallback;
    return `${toIsoDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `DD/MM/AAAA HH:MM` para timestamps completos. */
export function toDisplayDateTime(value, fallback = '') {
    const date = parseDate(value);
    if (!date) return fallback;
    return `${toDisplayDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
