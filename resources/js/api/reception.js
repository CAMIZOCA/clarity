import client from './client';

/**
 * Consultas completadas de hoy (o de los ultimos `days` dias), con su resumen.
 * Lectura en vivo: no pasa por `cached()`, el servidor tampoco la cachea.
 * Solo se llama al abrir el dashboard y al pulsar "Actualizar": no hay polling.
 */
export const getReceptionFeed = (days = 1) =>
    client.get('/reception/consultations', { params: { days } });
