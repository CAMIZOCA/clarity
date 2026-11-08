/**
 * Apaga el historial de formularios del navegador en todo el sistema.
 *
 * Chrome/Edge recuerdan lo escrito en cada input con el mismo `name` y lo ofrecen
 * en una lista al volver a ese campo. En la consulta ("Lectura computador",
 * "Retinoscopia"...) esa lista hacia creer al personal que eran las unicas
 * opciones validas.
 *
 * A cada input/textarea que entra al DOM sin `autocomplete` propio se le pone
 * `autocomplete="off"`. Un valor declarado (`username`, `current-password`,
 * `new-password`, `email`...) se respeta: quien quiera sugerencias debe declararlo.
 */
const SKIPPED_TYPES = new Set(['hidden', 'checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'image', 'range', 'color']);

function markField(el) {
    if (el.hasAttribute('autocomplete')) return;
    if (el.tagName === 'INPUT' && SKIPPED_TYPES.has((el.getAttribute('type') || 'text').toLowerCase())) return;
    el.setAttribute('autocomplete', 'off');
}

function markTree(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
        markField(node);
        return;
    }
    node.querySelectorAll('input, textarea').forEach(markField);
}

export function disableFormHistory(root = document.body) {
    if (!root || typeof MutationObserver === 'undefined') return () => {};

    markTree(root);

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(markTree);
        }
    });
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
}
