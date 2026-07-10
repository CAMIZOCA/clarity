import client from './client';

export const getBackups = () => client.get('/admin/maintenance/backups');

export const createBackup = () => client.post('/admin/maintenance/backups');

export const downloadBackup = (id) =>
    client.get(`/admin/maintenance/backups/${id}/download`, { responseType: 'blob' });

export const uploadLegacyImport = (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return client.post('/admin/maintenance/imports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

export const analyzeLegacyImport = (id) =>
    client.post(`/admin/maintenance/imports/${id}/analyze`);

export const runLegacyImport = (id, data) =>
    client.post(`/admin/maintenance/imports/${id}/run`, data);

export const restoreSystemBackup = (id, data) =>
    client.post(`/admin/maintenance/imports/${id}/restore`, data);

export const getLegacyImport = (id) =>
    client.get(`/admin/maintenance/imports/${id}`);
