/**
 * Quien puede editar abre el formulario de la consulta; el resto (Recepcion)
 * la ficha de solo lectura, que no tiene autoguardado.
 */
export function consultationUrl(can, consultationId) {
    return can('consultations.edit')
        ? `/consulta/${consultationId}`
        : `/consulta/${consultationId}/ver`;
}

/**
 * Orden de trabajo con el paciente y la RX final de esa consulta ya cargados:
 * Recepcion la llena al salir el paciente sin copiar la receta de un papel.
 * Solo tiene sentido con la consulta completada.
 */
export function canStartWorkOrder(can, consultation) {
    return can('lab_orders.create') && consultation?.estado === 'completada';
}

export function workOrderUrl(patientId, consultationId) {
    return `/ordenes-trabajo?paciente=${patientId}&consulta=${consultationId}`;
}
