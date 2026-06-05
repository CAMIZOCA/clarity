export function getPayload(response) {
    const body = response?.data ?? response ?? {};
    return body?.data ?? body;
}

export function getList(response) {
    const body = response?.data ?? response ?? {};

    if (Array.isArray(body?.data?.data)) return body.data.data;
    if (Array.isArray(body?.data)) return body.data;
    if (Array.isArray(body)) return body;

    return [];
}

export function getPagination(response) {
    const body = response?.data ?? response ?? {};

    if (body?.data?.current_page) return body.data;
    if (body?.meta) return body.meta;
    if (body?.current_page) return body;

    return null;
}
