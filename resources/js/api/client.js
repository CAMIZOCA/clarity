import axios from 'axios';
import { notifyToast } from '../components/ui/Toast';

const debugEnabled = import.meta.env.DEV || window.location.hostname.endsWith('.test');

function debugLog(label, payload) {
    if (!debugEnabled) return;
    console.groupCollapsed(`[HTTP Debug] ${label}`);
    console.log(payload);
    console.groupEnd();
}

/**
 * Red de seguridad para los 5xx.
 *
 * Sin esto un 500 era indistinguible de 'no hay datos': las pantallas hacian
 * .catch(() => setData(null)) y el usuario veia $0.00 creyendo que no hubo
 * ventas. Cada pagina puede seguir mostrando su propio estado de error; este
 * aviso solo garantiza que ningun fallo del servidor pase inadvertido.
 *
 * Pasar `skipErrorToast: true` en la config de la peticion lo desactiva para
 * los casos en que el 5xx es esperado.
 */
function notifyServerError(error) {
    const status = error.response?.status;

    if (error.config?.skipErrorToast) return;
    if (error.code === 'ERR_CANCELED' || axios.isCancel?.(error)) return;
    if (status && status < 500) return;
    // Sin red ya avisa ConnectionBanner; no dupliquemos la senal.
    if (!status && navigator.onLine === false) return;

    notifyToast(
        status
            ? `Error del servidor (${status}). Los datos mostrados pueden estar incompletos.`
            : 'No se pudo contactar al servidor. Intente nuevamente.',
        'error'
    );
}

const client = axios.create({
    baseURL: '/api',
    withCredentials: true,
    withXSRFToken: true,
    headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
});

const csrfSafeMethods = new Set(['get', 'head', 'options']);

export const webClient = axios.create({
    withCredentials: true,
    withXSRFToken: true,
    headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
});

function attachDebugInterceptors(instance, name) {
    instance.interceptors.request.use(async (config) => {
        const method = (config.method || 'get').toLowerCase();

        if (!csrfSafeMethods.has(method) && !document.cookie.includes('XSRF-TOKEN=')) {
            debugLog(`${name} csrf bootstrap`, {
                method,
                url: config.baseURL ? `${config.baseURL}${config.url}` : config.url,
            });
            await initCsrf();
        }

        debugLog(`${name} request`, {
            method,
            url: config.baseURL ? `${config.baseURL}${config.url}` : config.url,
            withCredentials: config.withCredentials,
            withXSRFToken: config.withXSRFToken,
            xsrfCookieName: config.xsrfCookieName,
            xsrfHeaderName: config.xsrfHeaderName,
            hasXsrfCookie: document.cookie.includes('XSRF-TOKEN='),
            cookiePreview: document.cookie
                .split('; ')
                .filter((entry) => entry.startsWith('XSRF-TOKEN=') || entry.includes('session'))
                .map((entry) => entry.split('=')[0]),
            dataKeys: config.data && typeof config.data === 'object' ? Object.keys(config.data) : null,
        });
        return config;
    });

    instance.interceptors.response.use(
        (response) => {
            debugLog(`${name} response`, {
                status: response.status,
                url: response.config?.url,
                data: response.data,
            });
            return response;
        },
        async (error) => {
            const config = error.config || {};
            const status = error.response?.status;

            if (status === 419 && !config._retriedAfterCsrf) {
                config._retriedAfterCsrf = true;

                debugLog(`${name} csrf retry`, {
                    url: config.baseURL ? `${config.baseURL}${config.url}` : config.url,
                    method: config.method,
                });

                await initCsrf();
                return instance(config);
            }

            debugLog(`${name} error`, {
                message: error.message,
                code: error.code,
                status,
                url: config.url,
                responseData: error.response?.data,
                responseHeaders: error.response?.headers,
                hasXsrfCookie: document.cookie.includes('XSRF-TOKEN='),
                cookiePreview: document.cookie
                    .split('; ')
                    .filter((entry) => entry.startsWith('XSRF-TOKEN=') || entry.includes('session'))
                    .map((entry) => entry.split('=')[0]),
            });
            notifyServerError(error);
            return Promise.reject(error);
        }
    );
}

attachDebugInterceptors(client, 'api');
attachDebugInterceptors(webClient, 'web');

// Inyectar X-Branch-Id en cada request API según la sucursal activa en localStorage
client.interceptors.request.use(config => {
    const branchId = localStorage.getItem('active_branch_id');
    if (branchId) {
        config.headers['X-Branch-Id'] = branchId;
    }
    return config;
});

export const initCsrf = async () => {
    debugLog('csrf init start', {
        url: '/sanctum/csrf-cookie',
        origin: window.location.origin,
        host: window.location.host,
        cookiePreview: document.cookie
            .split('; ')
            .filter((entry) => entry.startsWith('XSRF-TOKEN=') || entry.includes('session'))
            .map((entry) => entry.split('=')[0]),
    });

    const response = await webClient.get('/sanctum/csrf-cookie');

    debugLog('csrf init end', {
        status: response.status,
        hasXsrfCookie: document.cookie.includes('XSRF-TOKEN='),
        cookiePreview: document.cookie
            .split('; ')
            .filter((entry) => entry.startsWith('XSRF-TOKEN=') || entry.includes('session'))
            .map((entry) => entry.split('=')[0]),
    });

    return response;
};

export default client;
