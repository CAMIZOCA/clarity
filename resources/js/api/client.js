import axios from 'axios';

const debugEnabled = import.meta.env.DEV || window.location.hostname.endsWith('.test');

function debugLog(label, payload) {
    if (!debugEnabled) return;
    console.groupCollapsed(`[HTTP Debug] ${label}`);
    console.log(payload);
    console.groupEnd();
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
            return Promise.reject(error);
        }
    );
}

attachDebugInterceptors(client, 'api');
attachDebugInterceptors(webClient, 'web');

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
