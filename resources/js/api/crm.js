import client from './client';

// Plantillas
export const getTemplates = (params = {}) => client.get('/crm/templates', { params });
export const createTemplate = (data) => client.post('/crm/templates', data);
export const updateTemplate = (id, data) => client.put(`/crm/templates/${id}`, data);

// Recordatorios
export const getReminders = (params = {}) => client.get('/crm/reminders', { params });
export const createReminder = (data) => client.post('/crm/reminders', data);

// Campañas
export const getCampaigns = (params = {}) => client.get('/crm/campaigns', { params });
export const createCampaign = (data) => client.post('/crm/campaigns', data);
export const previewCampaign = (data) => client.post('/crm/campaigns/preview', data);
export const sendCampaign = (id) => client.post(`/crm/campaigns/${id}/send`);
