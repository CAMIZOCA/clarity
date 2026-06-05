import client from './client';

export const getDashboardClinical = () =>
    client.get('/reports/dashboard');

export const getDashboardCommercial = () =>
    client.get('/reports/dashboard-commercial');

export const getSalesReport = (params = {}) =>
    client.get('/reports/sales', { params });

export const getInventoryReport = (params = {}) =>
    client.get('/reports/inventory', { params });

export const getLabReport = (params = {}) =>
    client.get('/reports/lab', { params });

export const getCashReport = (params = {}) =>
    client.get('/reports/cash', { params });

export const exportSales = (params = {}) =>
    client.get('/export/sales', { params, responseType: 'blob' });

export const exportInventory = (params = {}) =>
    client.get('/export/inventory', { params, responseType: 'blob' });
