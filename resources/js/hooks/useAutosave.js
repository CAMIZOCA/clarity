import { useEffect, useRef, useCallback } from 'react';
import client from '../api/client';

/**
 * Autosave hook — saves consultation every 30 seconds if dirty.
 * @param {object|null} consultationId - current consultation id (null if new draft)
 * @param {function} getValues - function returning current form values
 * @param {boolean} isDirty - react-hook-form isDirty flag
 * @param {function} onSaved - called with saved consultation data
 */
export function useAutosave(consultationId, getValues, isDirty, onSaved) {
    const intervalRef = useRef(null);
    const idRef = useRef(consultationId);

    useEffect(() => { idRef.current = consultationId; }, [consultationId]);

    const save = useCallback(async () => {
        if (!isDirty) return;
        const values = getValues();
        if (!values.patient_id) return;

        try {
            let res;
            if (idRef.current) {
                res = await client.put(`/consultations/${idRef.current}`, values);
            } else {
                res = await client.post('/consultations', values);
            }
            onSaved?.(res.data);
        } catch {
            // Silent fail on autosave
        }
    }, [isDirty, getValues, onSaved]);

    useEffect(() => {
        intervalRef.current = setInterval(save, 30000);
        return () => clearInterval(intervalRef.current);
    }, [save]);

    return save;
}
