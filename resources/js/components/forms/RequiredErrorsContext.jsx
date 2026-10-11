import React from 'react';

/**
 * Campos que deben resaltarse en rojo en el formulario de consulta.
 *
 * Es un `Map` de nombre de campo a mensaje: los que fallaron la validacion, ya
 * sea por ser obligatorios y estar vacios o porque el backend devolvio un 422
 * sobre ellos. `has(nombre)` pinta el campo y `get(nombre)` da el texto que se
 * muestra junto a el.
 *
 * Vive en su propio modulo para que `EyeFieldGroup` pueda consumirlo sin crear
 * una dependencia circular con `ConsultationForm`.
 */
export const RequiredErrorsCtx = React.createContext(new Map());

export function useRequiredErrors() {
    return React.useContext(RequiredErrorsCtx);
}

export default RequiredErrorsCtx;
