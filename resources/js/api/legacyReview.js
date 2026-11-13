import client from './client';

export const getLegacyReviewCases = () => client.get('/admin/legacy-review/cases');

export const getLegacyReviewRows = (caseKey, params) =>
    client.get(`/admin/legacy-review/${caseKey}`, { params });

export const previewLegacyReview = (caseKey, selection) =>
    client.post(`/admin/legacy-review/${caseKey}/preview`, selection);

export const applyLegacyReview = (caseKey, selection) =>
    client.post(`/admin/legacy-review/${caseKey}/apply`, { ...selection, confirm: true });

export const getLegacyReviewBatches = () => client.get('/admin/legacy-review/batches');

export const revertLegacyReviewBatch = (id) => client.post(`/admin/legacy-review/batches/${id}/revert`);
