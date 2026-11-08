/**
 * Aviso de Bloq Num desactivado al escribir con el teclado numerico.
 *
 * Con Bloq Num apagado, el teclado numerico manda teclas de edicion en vez de
 * digitos: el 8 y el 2 son Arriba/Abajo (y `fieldNavigation` salta de campo),
 * el 4 y el 6 mueven el cursor, el 7/1 son Inicio/Fin y el punto es Supr, que
 * borra un caracter. Al teclear una esfera o una cedula el foco se iba a otro
 * campo sin escribir nada y sin explicacion.
 *
 * El navegador no puede consultar Bloq Num antes de una pulsacion ni activarlo,
 * asi que se detecta en la tecla misma: `code` dice que vino del teclado
 * numerico y `key` que no produjo un caracter. En un campo de escritura esa
 * tecla se anula (no salta ni borra) y se avisa una vez cada pocos segundos.
 * `getModifierState('NumLock')` no basta solo: en Mac siempre es falso.
 */
import { notifyToast } from '../components/ui/Toast';

const NUMPAD_CHARACTER_CODE = /^Numpad(\d|Decimal)$/;

// Tipos de <input> donde no se escriben numeros.
const NON_TEXT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file', 'checkbox', 'radio', 'range', 'color']);

const WARNING_INTERVAL_MS = 10_000;

export const NUM_LOCK_MESSAGE =
    'Bloq Num está desactivado: el teclado numérico mueve el cursor en vez de escribir números. '
    + 'Presione la tecla Bloq Num (Num Lock) para activarlo.';

/**
 * True si la tecla es un digito o el punto del teclado numerico que, por Bloq
 * Num apagado, llego como tecla de edicion (ArrowDown, End, Delete, Clear...).
 * Shift + teclado numerico con Bloq Num activo da lo mismo en Windows, y ahi
 * es a proposito (seleccionar texto): se respeta.
 */
export function isNumpadWithoutNumLock(event) {
    const native = event?.nativeEvent ?? event;
    if (!native || !NUMPAD_CHARACTER_CODE.test(native.code ?? '')) return false;
    if ((native.key ?? '').length === 1) return false;

    return !native.getModifierState?.('NumLock');
}

function isTextField(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName !== 'INPUT') return false;

    return !NON_TEXT_TYPES.has((el.getAttribute('type') || 'text').toLowerCase());
}

/**
 * Instala el aviso en toda la pagina. Escucha en captura sobre `window` para
 * anular la tecla antes de que la vean React y `handleFieldNavigation`.
 */
export function watchNumLock(target = window) {
    if (!target?.addEventListener) return () => {};

    let lastWarningAt = -Infinity;

    const onKeyDown = (event) => {
        if (event.defaultPrevented || !isNumpadWithoutNumLock(event) || !isTextField(event.target)) return;

        event.preventDefault();

        const now = Date.now();
        if (now - lastWarningAt < WARNING_INTERVAL_MS) return;
        lastWarningAt = now;
        notifyToast(NUM_LOCK_MESSAGE, 'warning');
    };

    target.addEventListener('keydown', onKeyDown, true);
    return () => target.removeEventListener('keydown', onKeyDown, true);
}
