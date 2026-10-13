import React from 'react';
import { BellRing } from 'lucide-react';
import ConsultationSummary from './ConsultationSummary';
import ConsultationActions from './ConsultationActions';
import { formatClock, minutesSince } from './timeFormat';

/**
 * Tarjeta destacada: la consulta que el optometra acaba de completar.
 * Mientras es reciente ocupa el ancho completo; despues se pliega a su lista.
 */
export default function LatestConsultationCard({ item, now, fresh }) {
    const minutes = minutesSince(item.closed_at, now);
    const age = minutes < 1 ? 'hace un momento' : `hace ${minutes} min`;

    return (
        <section
            aria-label="Consulta recién terminada"
            className={`mb-6 rounded-2xl border bg-white shadow-sm overflow-hidden transition-shadow ${
                fresh ? 'border-amber-400 ring-2 ring-amber-300 shadow-lg' : 'border-gray-200'
            }`}
        >
            <header className="bg-[#1a2a4a] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-wide text-white/70 flex items-center gap-1.5">
                        <BellRing size={14} className={fresh ? 'text-amber-300' : ''} />
                        Consulta terminada {age} · {formatClock(item.closed_at)}
                    </p>
                    <h2 className="text-2xl font-bold mt-0.5">{item.patient.nombre_completo}</h2>
                    <p className="text-sm text-white/80">
                        {item.patient.edad != null && `${item.patient.edad} años · `}
                        {item.doctor ? `Atendió ${item.doctor}` : 'Sin médico asignado'} · Consulta #{item.numero_consulta}
                    </p>
                </div>
                <ConsultationActions item={item} onDark />
            </header>

            <div className="p-6">
                <ConsultationSummary item={item} />
            </div>
        </section>
    );
}
