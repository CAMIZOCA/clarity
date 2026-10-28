import { getLastError } from '../api/lastError';

/**
 * Chequeo rapido de red, servidor, base de datos, sesion y version.
 *
 * Un "Error al cargar pacientes" no decia si era la red, el servidor o la
 * sesion (en un iPad la cookie dejo de llegar y cada busqueda fallaba igual).
 * `diagnose()` pregunta a `/session-check` y devuelve un `problem` con la causa
 * mas probable; `DiagnosisModal` lo traduce a un mensaje y un boton.
 */

export const DIAGNOSE_EVENT = 'clarity:diagnose';
export const SESSION_EXPIRED_EVENT = 'clarity:session-expired';
export const SESSION_RESTORED_EVENT = 'clarity:session-restored';
export const SERVER_STATUS_EVENT = 'clarity:server-status';

const TIMEOUT_MS = 6000;

let sessionExpired = false;

/** Mientras el modal de sesion vencida esta abierto, los avisos de error no se apilan. */
export const isSessionExpired = () => sessionExpired;

export function markSessionExpired() {
    if (sessionExpired) return;
    sessionExpired = true;
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export function markSessionRestored() {
    if (!sessionExpired) return;
    sessionExpired = false;
    window.dispatchEvent(new CustomEvent(SESSION_RESTORED_EVENT));
}

export function openDiagnosis() {
    window.dispatchEvent(new CustomEvent(DIAGNOSE_EVENT));
}

export const currentBuild = () => document.querySelector('meta[name="app-build"]')?.content || 'dev';

const hasXsrfCookie = () => document.cookie.includes('XSRF-TOKEN=');

/** GET /session-check con limite de tiempo. `null` = el servidor no respondio. */
export async function fetchSessionCheck() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = performance.now();

    try {
        const response = await fetch('/session-check', {
            cache: 'no-store',
            credentials: 'include',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        const ms = Math.round(performance.now() - startedAt);
        if (!response.ok) {
            return { httpStatus: response.status, ms, body: null };
        }
        return { httpStatus: response.status, ms, body: await response.json() };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * @returns {Promise<{problem: string|null, checks: Array<{key, label, ok, detail}>, lastError: object|null}>}
 * problem: offline | server_down | server_error | database | cookies | session | outdated | null
 */
export async function diagnose() {
    const lastError = getLastError();
    const checks = [];
    const result = (problem) => ({ problem, checks, lastError });

    const online = navigator.onLine !== false;
    checks.push({ key: 'network', label: 'Conexión a internet', ok: online, detail: online ? 'El equipo tiene red' : 'El equipo no tiene red' });
    if (!online) return result('offline');

    const check = await fetchSessionCheck();
    if (!check) {
        checks.push({ key: 'server', label: 'Servidor', ok: false, detail: 'No respondió en 6 segundos' });
        return result('server_down');
    }
    if (!check.body) {
        checks.push({ key: 'server', label: 'Servidor', ok: false, detail: `Respondió con error ${check.httpStatus}` });
        return result('server_error');
    }
    checks.push({ key: 'server', label: 'Servidor', ok: true, detail: `Responde (${check.ms} ms)` });

    const { database, authenticated, version } = check.body;
    checks.push({ key: 'database', label: 'Base de datos', ok: database, detail: database ? 'Disponible' : 'No disponible' });
    if (!database) return result('database');

    // Laravel deja XSRF-TOKEN en toda respuesta web: si no aparece, el navegador rechaza las cookies.
    const cookiesOk = navigator.cookieEnabled !== false && hasXsrfCookie();
    checks.push({ key: 'cookies', label: 'Cookies del navegador', ok: cookiesOk, detail: cookiesOk ? 'Permitidas' : 'Bloqueadas' });
    if (!cookiesOk) return result('cookies');

    checks.push({ key: 'session', label: 'Sesión', ok: authenticated, detail: authenticated ? 'Activa' : 'Vencida o cerrada' });
    if (!authenticated) return result('session');

    const build = currentBuild();
    const upToDate = build === 'dev' || !version || version === 'dev' || version === build;
    checks.push({ key: 'version', label: 'Versión del sistema', ok: upToDate, detail: upToDate ? 'Al día' : 'Hay una versión nueva' });
    if (!upToDate) return result('outdated');

    return result(null);
}

/** Texto para "Copiar detalle": lo que necesita quien da soporte, sin datos clinicos. */
export function diagnosisReport({ checks, lastError }, describe) {
    const lines = [
        `Sistema: ${window.location.host}${window.location.pathname}`,
        `Fecha: ${new Date().toLocaleString('es-EC')}`,
        `Navegador: ${navigator.userAgent}`,
        `Versión cargada: ${currentBuild()}`,
        ...checks.map((c) => `${c.ok ? 'OK ' : 'FALLA'} ${c.label}: ${c.detail}`),
    ];
    if (lastError) lines.push(`Último error: ${describe(lastError)}`);
    return lines.join('\n');
}
