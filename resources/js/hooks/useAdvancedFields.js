import { useCallback, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { ADVANCED_REQUIRED_FIELDS, DEFAULT_ADVANCED_FORM_FIELDS } from '../data/formFieldsOptions';

/**
 * Lee la configuración de "campos avanzados" (Ajustes → Campos avanzados) y expone
 * `isAdvanced(key)` para decidir qué campos ocultar por defecto en un formulario.
 *
 * Reglas:
 * - Un campo es avanzado si su key está en `settings.advanced_form_fields`
 *   (o en el default si no hay configuración guardada).
 * - Un campo asociado a un campo obligatorio (`settings.required_fields`) NUNCA se
 *   oculta: lo obligatorio gana sobre lo avanzado.
 *
 * @param {string} formKey - prefijo del formulario, ej. 'consulta', 'paciente'.
 */
export function useAdvancedFields(formKey) {
    const { settings } = useSettings();

    const advancedList = useMemo(() => {
        const configured = settings?.advanced_form_fields;
        // Una lista vacía configurada es válida (todo núcleo); solo caemos al
        // default cuando no hay configuración (undefined/no-array).
        return Array.isArray(configured) ? configured : DEFAULT_ADVANCED_FORM_FIELDS;
    }, [settings?.advanced_form_fields]);

    const requiredSet = useMemo(
        () => new Set(Array.isArray(settings?.required_fields) ? settings.required_fields : []),
        [settings?.required_fields]
    );

    const isAdvanced = useCallback((key) => {
        if (!key) return false;
        const fullKey = key.includes(':') ? key : `${formKey}:${key}`;

        // Obligatorio gana sobre avanzado.
        const linkedRequired = ADVANCED_REQUIRED_FIELDS[fullKey] ?? [];
        if (linkedRequired.some((field) => requiredSet.has(field))) {
            return false;
        }

        return advancedList.includes(fullKey);
    }, [advancedList, requiredSet, formKey]);

    return { isAdvanced };
}

export default useAdvancedFields;
