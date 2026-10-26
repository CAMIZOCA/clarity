/**
 * Quien puede editar abre el formulario de la consulta; el resto (Recepcion)
 * la ficha de solo lectura, que no tiene autoguardado.
 */
export function consultationUrl(can, consultationId) {
    return can('consultations.edit')
        ? `/consulta/${consultationId}`
        : `/consulta/${consultationId}/ver`;
}
