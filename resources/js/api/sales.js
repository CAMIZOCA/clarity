import client from './client';

export const getSales = (params = {}) =>
    client.get('/sales', { params });

export const getSale = (id) =>
    client.get(`/sales/${id}`);

export const createSale = (data) =>
    client.post('/sales', data);

export const addItemToSale = (saleId, data) =>
    client.post(`/sales/${saleId}/items`, data);

export const removeItemFromSale = (saleId, itemId) =>
    client.delete(`/sales/${saleId}/items/${itemId}`);

export const processPayment = (saleId, data) =>
    client.post(`/sales/${saleId}/payments`, data);

export const cancelSale = (saleId, data) =>
    client.post(`/sales/${saleId}/cancel`, data);

export const getPatientSaleSummary = (patientId) =>
    client.get(`/sales/patient/${patientId}`);

// Laboratorio
export const getLabOrders = (params = {}) =>
    client.get('/lab-orders', { params });

export const getLabSuppliers = () =>
    client.get('/lab-orders/suppliers');

export const getLabOrder = (id) =>
    client.get(`/lab-orders/${id}`);

export const createLabOrder = (data) =>
    client.post('/lab-orders', data);

export const updateLabOrderStatus = (id, data) =>
    client.post(`/lab-orders/${id}/status`, data);

export const updateLabOrder = (id, data) =>
    client.put(`/lab-orders/${id}`, data);

// Caja
export const getCashSessions = (params = {}) =>
    client.get('/cash-registers/sessions', { params });

export const openCashSession = (registerId, data) =>
    client.post(`/cash-registers/${registerId}/open`, data);

export const closeCashSession = (sessionId, data) =>
    client.post(`/cash-registers/sessions/${sessionId}/close`, data);

export const getCurrentSession = (registerId) =>
    client.get(`/cash-registers/${registerId}/current-session`);

export const registerExpense = (sessionId, data) =>
    client.post(`/cash-registers/sessions/${sessionId}/expenses`, data);
