/**
 * Navegacion de formularios con Enter y flechas, equivalente a Tab.
 *
 * Pedido por usuarios con poca practica en el teclado: en vez de buscar Tab,
 * Enter y las flechas llevan al campo siguiente/anterior. Se activa por
 * formulario con `<form onKeyDown={handleFieldNavigation}>`.
 *
 * Reglas:
 *  - Enter avanza y nunca envia el formulario: en el ultimo campo deja el foco
 *    en el boton de guardar. En un <textarea> sigue siendo salto de linea.
 *  - Arriba/Abajo retroceden/avanzan siempre, tambien en <select>, fechas y
 *    numeros, donde el navegador cambiaria el valor en silencio al pasar.
 *  - Izquierda/Derecha solo saltan de campo cuando el cursor ya esta en el
 *    borde del texto, para no estorbar la edicion.
 *  - Una pulsacion mueve un solo campo: la autorrepeticion de una tecla que se
 *    queda apretada se ignora.
 */

const FIELD_SELECTOR = 'input, select, textarea';
const SUBMIT_SELECTOR = 'button[type="submit"], input[type="submit"]';

// Tipos de <input> que no son campos de captura.
const NON_FIELD_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file']);

const ARROW_INTENT = {
    ArrowDown: 'next',
    ArrowRight: 'next',
    ArrowUp: 'prev',
    ArrowLeft: 'prev',
};

/**
 * Indica si el cursor ya esta en el borde hacia el que apunta la flecha, sin
 * texto seleccionado. `email`, `number` y `date` no exponen la posicion del
 * cursor (`selectionStart` es null): en ellos Izquierda/Derecha nunca saltan.
 */
function caretAtEdge(field, intent) {
    const { selectionStart, selectionEnd } = field;
    if (typeof selectionStart !== 'number' || selectionStart !== selectionEnd) return false;

    return intent === 'next' ? selectionEnd === field.value.length : selectionStart === 0;
}

/**
 * Con la lista desplegada las flechas eligen la opcion. `:open` aun no existe
 * en todos los navegadores; donde falta, la lista abierta ya consume sus
 * propias teclas y el evento no llega a la pagina.
 */
function isPickerOpen(select) {
    try {
        return select.matches(':open');
    } catch {
        return false;
    }
}

/**
 * Traduce una tecla a 'next' / 'prev', o `null` si en ese campo la tecla
 * conserva su funcion nativa. Acepta el evento sintetico de React o el nativo.
 */
export function navigationIntent(event) {
    const native = event.nativeEvent ?? event;
    if (native.isComposing || event.ctrlKey || event.altKey || event.metaKey) return null;

    const field = event.target;
    const tag = field?.tagName;
    const isCaptureInput = tag === 'INPUT' && !NON_FIELD_TYPES.has(field.type);

    if (event.key === 'Enter') {
        // En <textarea> es salto de linea y sobre un boton lo activa.
        return tag === 'SELECT' || isCaptureInput ? 'next' : null;
    }

    const intent = ARROW_INTENT[event.key];
    // Shift + flecha selecciona texto.
    if (!intent || event.shiftKey) return null;

    if (tag === 'SELECT') {
        const isListbox = field.multiple || field.size > 1;
        return isListbox || isPickerOpen(field) ? null : intent;
    }
    if (tag === 'TEXTAREA') return caretAtEdge(field, intent) ? intent : null;
    if (!isCaptureInput) return null;

    // En radio y range las flechas son la forma de elegir el valor.
    if (field.type === 'radio' || field.type === 'range') return null;
    if (field.type === 'checkbox') return intent;

    const isVertical = event.key === 'ArrowDown' || event.key === 'ArrowUp';
    return isVertical || caretAtEdge(field, intent) ? intent : null;
}

function isNavigable(field) {
    if (field.disabled || field.readOnly || field.tabIndex < 0) return false;
    if (field.tagName === 'INPUT' && NON_FIELD_TYPES.has(field.type)) return false;

    // Sin cajas de layout = oculto (display: none propio o de un ancestro).
    return field.getClientRects().length > 0;
}

/** Campo navegable mas cercano a `from` en orden de documento, dentro de `scope`. */
function adjacentField(scope, from, intent, accept) {
    const fields = Array.from(scope.querySelectorAll(FIELD_SELECTOR));
    if (intent === 'prev') fields.reverse();

    const side = intent === 'next' ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING;

    return fields.find(
        (field) => (from.compareDocumentPosition(field) & side) !== 0 && isNavigable(field) && accept(field)
    ) ?? null;
}

/** Primer boton de envio visible y habilitado que sigue a `from`. */
function submitButtonAfter(scope, from) {
    return Array.from(scope.querySelectorAll(SUBMIT_SELECTOR)).find(
        (button) => (from.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
            && !button.disabled
            && button.getClientRects().length > 0
    ) ?? null;
}

/**
 * True si en la posicion del campo se ve otra cosa (una barra fija, el borde
 * de un contenedor con scroll) o el campo esta fuera de pantalla.
 */
function isCovered(field) {
    const rect = field.getBoundingClientRect();
    const x = rect.left + rect.width / 2;

    return [rect.top + 1, rect.bottom - 1].some((y) => {
        const hit = document.elementFromPoint(x, y);
        return !hit || !(hit === field || field.contains(hit));
    });
}

/**
 * Lleva el foco a `field` y lo deja a la vista.
 *
 * El foco va con `preventScroll` porque el scroll automatico del navegador da
 * por visible un campo que quedo debajo de una barra fija (las acciones de la
 * consulta, la cabecera del shell). Aqui se comprueba que el campo sea lo que
 * realmente se ve en su posicion y, si no, se centra.
 */
export function focusField(field) {
    field.focus({ preventScroll: true });

    if (field.tagName === 'TEXTAREA') {
        // Cursor al final: listo para seguir escribiendo o seguir bajando.
        field.setSelectionRange(field.value.length, field.value.length);
    } else if (typeof field.select === 'function') {
        field.select();
    }

    if (isCovered(field)) {
        field.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
}

/**
 * `onKeyDown` de un <form>: Enter y las flechas recorren sus campos.
 *
 * Los componentes con recorrido propio (`EyeFieldGroup`, `nextFieldId` de
 * `Input`) resuelven la tecla antes y la marcan con `preventDefault()`; aqui
 * solo llega lo que nadie atendio.
 */
export function handleFieldNavigation(event) {
    if (event.defaultPrevented) return;

    const intent = navigationIntent(event);
    if (!intent) return;

    // Desde aqui la tecla es de navegacion: ni envio implicito del formulario
    // ni cambio de valor en un <select> o una fecha.
    event.preventDefault();
    if (event.repeat) return;

    const form = event.currentTarget;
    const from = event.target;
    // Enter sobre una casilla sale de la lista de casillas en vez de recorrerla.
    const leavesCheckboxes = event.key === 'Enter' && from.type === 'checkbox';

    const target = adjacentField(form, from, intent, (field) => !(leavesCheckboxes && field.type === 'checkbox'))
        ?? (intent === 'next' ? submitButtonAfter(form, from) : null);

    if (target) focusField(target);
}
