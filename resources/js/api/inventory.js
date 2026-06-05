import client from './client';

// ── Productos ─────────────────────────────────────────────────────
export const getProducts = (params = {}) =>
  client.get('/products', { params });

export const getProduct = (id) =>
  client.get(`/products/${id}`);

export const createProduct = (data) =>
  client.post('/products', data);

export const updateProduct = (id, data) =>
  client.put(`/products/${id}`, data);

export const deleteProduct = (id) =>
  client.delete(`/products/${id}`);

export const findByBarcode = (barcode) =>
  client.get(`/products/barcode/${barcode}`);

export const getProductVariants = (productId) =>
  client.get(`/products/${productId}/variants`);

export const createVariant = (productId, data) =>
  client.post(`/products/${productId}/variants`, data);

export const updateVariant = (productId, variantId, data) =>
  client.put(`/products/${productId}/variants/${variantId}`, data);

// ── Inventario ────────────────────────────────────────────────────
export const getInventory = (params = {}) =>
  client.get('/inventory', { params });

export const getInventoryMovements = (params = {}) =>
  client.get('/inventory/movements', { params });

export const getLowStock = (params = {}) =>
  client.get('/inventory/low-stock', { params });

export const getValuation = (params = {}) =>
  client.get('/inventory/valuation', { params });

export const adjustStock = (data) =>
  client.post('/inventory/adjust', data);

export const transferStock = (data) =>
  client.post('/inventory/transfer', data);

// ── Proveedores ───────────────────────────────────────────────────
export const getSuppliers = (params = {}) =>
  client.get('/suppliers', { params });

export const createSupplier = (data) =>
  client.post('/suppliers', data);

export const updateSupplier = (id, data) =>
  client.put(`/suppliers/${id}`, data);

export const deleteSupplier = (id) =>
  client.delete(`/suppliers/${id}`);
