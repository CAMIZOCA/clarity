import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDate } from '../../utils/dates';

/** Cuanto dura la tarjeta destacada despues de completar la consulta. */
export const HIGHLIGHT_MINUTES = 30;

/** `2026-10-13T15:04:05-05:00` -> `15:04` en hora local del navegador. Vacio si no hay hora. */
export function formatClock(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : format(date, 'HH:mm');
}

/** Minutos enteros transcurridos desde `iso` hasta `now` (ms). Infinito si `iso` no es una hora. */
export function minutesSince(iso, now = Date.now()) {
    if (!iso) return Infinity;
    const time = new Date(iso).getTime();
    return Number.isNaN(time) ? Infinity : Math.max(0, Math.floor((now - time) / 60000));
}

/** Hoy / Ayer / Anteayer segun la posicion en la lista; el resto, el dia de la semana. */
export function dayTitle(date, index) {
    if (index === 0) return 'Hoy';
    if (index === 1) return 'Ayer';
    if (index === 2) return 'Anteayer';
    const parsed = parseDate(date);
    return parsed ? format(parsed, 'EEEE', { locale: es }) : date;
}
