import React from 'react';

/**
 * Campos que deben resaltarse en rojo en el formulario de consulta.
 *
 * Contiene los nombres de campo que fallaron la validacion, ya sea por ser
 * obligatorios y estar vacios o porque el backend devolvio un 422 sobre ellos.
 *
 * Vive en su propio modulo para que `EyeFieldGroup` pueda consumirlo sin crear
 * una dependencia circular con `ConsultationForm`.
 */
export const RequiredErrorsCtx = React.createContext(new Set());

export function useRequiredErrors() {
    return React.useContext(RequiredErrorsCtx);
}

export default RequiredErrorsCtx;
