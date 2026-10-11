/**
 * Validaciones del alta de paciente que el formulario adelanta al salir del
 * campo, para no descubrir el error recien al pulsar "Registrar".
 *
 * Repiten el criterio del servidor (`ValidPatientDocument`, `ValidEcuadorPhone`
 * y `StorePatientRequest`): si una regla cambia alla, cambia aqui. El servidor
 * sigue siendo quien decide; esto solo avisa antes.
 */

import { todayIso } from './dates';

/** Cedula o RUC ecuatorianos: solo digitos, con digito verificador. */
export const DOC_CEDULA = 'cedula';

/** Pasaporte o documento extranjero: hay que elegirlo a proposito. */
export const DOC_OTHER = 'otro';

/** Tipo que corresponde a un documento ya escrito o guardado: con letras no es una cedula. */
export const documentTypeOf = (value) => (/[A-Z]/i.test(String(value ?? '')) ? DOC_OTHER : DOC_CEDULA);

/**
 * Forma en que se guarda y se compara. En una cedula los espacios, guiones y
 * puntos son solo de presentacion; en otro documento no se tocan.
 */
export function normalizeDocument(value, type = DOC_CEDULA) {
    const document = String(value ?? '').trim().toUpperCase();

    return type === DOC_CEDULA && /^[\d\s.-]+$/.test(document)
        ? document.replace(/[\s.-]/g, '')
        : document;
}

/** Una cedula (10) o un RUC (13) completos: se verifican sin esperar a Enter. */
export const isCompleteCedula = (value) => /^(\d{10}|\d{13})$/.test(value);

export const hasLetters = (value) => /[A-Z]/i.test(String(value ?? ''));

const PHONE_MESSAGE = 'Teléfono no válido. Ejemplos: 0991234567, 022345678, 2345678 o +57 300 1234567.';

/** `true` si el telefono es aceptable (o esta vacio); si no, el mensaje de error. */
export function phoneError(value) {
    const raw = String(value ?? '').trim();
    if (raw === '') return true;
    if (raw.length > 20) return 'El teléfono no puede tener más de 20 caracteres.';

    const digits = raw.replace(/[\s\-()+]/g, '');
    if (!/^\d+$/.test(digits)) return PHONE_MESSAGE;

    // Con codigo de pais Ecuador: +593 o 593.
    const local = digits.startsWith('593') ? `0${digits.slice(3)}` : digits;

    // Celular, fijo con codigo de provincia y fijo local de 7 digitos.
    if (/^09\d{8}$/.test(local) || /^0[2-7]\d{7}$/.test(local) || /^[2-7]\d{6}$/.test(local)) return true;

    // Numero extranjero: "+" y el codigo de pais.
    if (raw.startsWith('+') && !digits.startsWith('593') && /^\d{8,15}$/.test(digits)) return true;

    return PHONE_MESSAGE;
}

export function emailError(value) {
    const email = String(value ?? '').trim();
    if (email === '') return true;

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || 'El email no tiene un formato válido.';
}

/** Recibe la fecha en `YYYY-MM-DD`, que es como la guarda el formulario. */
export function birthDateError(iso) {
    if (!iso) return true;
    if (iso >= todayIso()) return 'La fecha de nacimiento debe ser anterior a hoy.';
    if (iso <= '1900-01-01') return 'La fecha de nacimiento debe ser posterior al año 1900.';

    return true;
}

export function registrationDateError(iso) {
    return !iso || iso <= todayIso() || 'La fecha de registro no puede ser posterior a hoy.';
}

/**
 * La importacion leyo los anios de dos digitos como 20XX: "12/03/55" quedo en
 * 2055. Devuelve la misma fecha cien anios antes si con eso pasa a ser valida.
 */
export function centuryCorrection(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
    if (!match || iso < todayIso()) return null;

    const corrected = `${Number(match[1]) - 100}-${match[2]}-${match[3]}`;

    return birthDateError(corrected) === true ? corrected : null;
}
