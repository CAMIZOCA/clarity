import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Estado de error explicito para una seccion que no pudo cargar.
 *
 * Existe porque el patron `.catch(() => setData(null))` dejaba las pantallas
 * indistinguibles de un periodo sin datos: un 500 se veia igual que "$0.00" o
 * "Sin datos", y el usuario concluia que no hubo ventas. Cuando una peticion
 * falla hay que decirlo y ofrecer reintentar.
 */
export default function ErrorState({
    title = 'No se pudieron cargar los datos',
    message = 'El servidor respondió con un error. Intente nuevamente en unos segundos.',
    onRetry = null,
    compact = false,
}) {
    return (
        <div
            role="alert"
            className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 text-center
                ${compact ? 'px-4 py-6' : 'px-6 py-12'}`}
        >
            <AlertTriangle size={compact ? 24 : 32} className="flex-shrink-0 text-red-600" />

            <div className="space-y-1">
                <p className="font-semibold text-red-900">{title}</p>
                <p className="max-w-md text-sm text-red-800">{message}</p>
            </div>

            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                >
                    <RefreshCw size={16} />
                    Reintentar
                </button>
            )}
        </div>
    );
}
