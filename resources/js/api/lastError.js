/**
 * Ultimo fallo de una peticion, para que "Revisar conexion" pueda decir que
 * fallo y cuando. Solo guarda el codigo y la ruta sin query string: nada de
 * datos del paciente ni de lo que se estaba buscando.
 */
let lastError = null;

/** Un 422 es una validacion del formulario, no un problema de conexion. */
const NOT_CONNECTION_STATUSES = new Set([422]);

/** Ventana en la que un aviso de error se atribuye a la peticion que acaba de fallar. */
const RECENT_MS = 4000;

export function recordLastError(error) {
    const config = error?.config || {};
    const url = `${config.baseURL || ''}${config.url || ''}`;

    lastError = {
        status: error?.response?.status ?? 0,
        code: error?.code ?? null,
        method: (config.method || 'get').toUpperCase(),
        path: url.split('?')[0],
        at: Date.now(),
    };
}

export function getLastError() {
    return lastError;
}

/** El ultimo fallo fue de red, sesion o servidor y ocurrio hace un instante. */
export function hasRecentConnectionFailure() {
    return Boolean(
        lastError
        && Date.now() - lastError.at < RECENT_MS
        && !NOT_CONNECTION_STATUSES.has(lastError.status)
    );
}

/** Respuesta de Cloudflare o del proxy, no de la aplicacion: el servidor no fue alcanzable. */
export function isGatewayStatus(status) {
    return status === 502 || status === 503 || status === 504 || (status >= 520 && status <= 530);
}

/**
 * Una lectura acaba de fallar porque no se llego al servidor (sin respuesta o
 * 502-504/520-530). `client.js` ya puso un unico aviso calmado y la barra; el
 * "Error al cargar X" propio de cada pantalla solo repetia la alarma en rojo.
 * Las escrituras quedan fuera: ahi el aviso de la pantalla si importa.
 */
export function hasRecentReadConnectionLoss() {
    return Boolean(
        lastError
        && Date.now() - lastError.at < RECENT_MS
        && lastError.method === 'GET'
        && (lastError.status === 0 || isGatewayStatus(lastError.status))
    );
}

export function describeLastError(error = lastError) {
    if (!error) return null;

    const time = new Date(error.at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const status = error.status ? `código ${error.status}` : 'sin respuesta del servidor';

    return `${error.method} ${error.path} — ${status} (${time})`;
}
