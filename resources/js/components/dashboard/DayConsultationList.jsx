import React from 'react';
import { ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react';
import ConsultationSummary from './ConsultationSummary';
import ConsultationActions from './ConsultationActions';
import { formatClock, dayTitle } from './timeFormat';
import { toDisplayDate } from '../../utils/dates';

/**
 * Consultas completadas de un dia. Cada fila se despliega con el mismo resumen
 * de la tarjeta destacada, sin salir del dashboard.
 */
export default function DayConsultationList({ day, index, expandedId, onToggle }) {
    const items = day.consultations ?? [];

    return (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <header className="px-6 py-4 border-b border-gray-100 flex items-baseline justify-between gap-3">
                <h2 className="font-semibold text-gray-900 capitalize">
                    {dayTitle(day.date, index)}
                    <span className="ml-2 text-sm font-normal text-gray-500 normal-case">{toDisplayDate(day.date)}</span>
                </h2>
                <span className="text-sm text-gray-500">{items.length} {items.length === 1 ? 'consulta' : 'consultas'}</span>
            </header>

            {items.length === 0 ? (
                <p className="py-6 text-center text-gray-400 text-sm">
                    {index === 0 ? 'Todavía no se ha atendido ningún paciente hoy.' : 'Sin consultas completadas'}
                </p>
            ) : (
                <ul className="divide-y divide-gray-50">
                    {items.map(item => {
                        const open = expandedId === item.id;
                        return (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onClick={() => onToggle(item.id)}
                                    aria-expanded={open}
                                    className="w-full px-6 py-3 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors"
                                >
                                    <span className="w-12 text-sm font-mono text-gray-500 tabular-nums">{formatClock(item.closed_at) || '—'}</span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block font-medium text-gray-900 text-sm truncate">{item.patient.nombre_completo}</span>
                                        <span className="block text-xs text-gray-500 truncate">
                                            {item.doctor || 'Sin médico'} · Consulta #{item.numero_consulta}
                                        </span>
                                    </span>
                                    {item.sale_id && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                                            <ShoppingCart size={12} /> Venta
                                        </span>
                                    )}
                                    {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                </button>

                                {open && (
                                    <div className="px-6 pb-5 pt-1 bg-gray-50/60 space-y-4">
                                        <ConsultationSummary item={item} />
                                        <ConsultationActions item={item} />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
