import React, { useEffect, useState } from 'react';
import { BarChart2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getConsultationsForecast } from '../../api/reports';
import { getPayload } from '../../api/response';
import { parseDate } from '../../utils/dates';

const DAYS = 7;
const BAR_MAX_PX = 120;
/** Porcentaje de dias parecidos con carga alta a partir del cual el pronostico avisa. */
const ALERT_PCT = 10;

const dayLabel = (value) => {
    const date = parseDate(value);
    return date ? format(date, 'EEE d', { locale: es }) : '';
};

export default function ConsultationsChart({ refreshToken }) {
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);

    // Se pide al abrir la pantalla y cada vez que la pantalla pide refrescar
    // (mismo criterio que la lista del dia: sin polling).
    useEffect(() => {
        let active = true;
        getConsultationsForecast(DAYS)
            .then(response => {
                if (!active) return;
                setData(getPayload(response));
                setFailed(false);
            })
            .catch(() => {
                if (active) setFailed(true);
            });
        return () => {
            active = false;
        };
    }, [refreshToken]);

    if (!data && !failed) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 py-10 text-center">
                <div className="animate-spin h-6 w-6 border-2 border-[#1a2a4a] border-t-transparent rounded-full mx-auto" />
            </div>
        );
    }

    const threshold = data?.high_threshold ?? 6;
    const bars = data
        ? [
            ...data.actual.map(day => ({
                key: `r-${day.date}`,
                date: day.date,
                value: day.total,
                forecast: false,
                high: day.total >= threshold,
            })),
            ...data.forecast.map(day => ({
                key: `f-${day.date}`,
                date: day.date,
                value: day.expected,
                low: day.low,
                high: day.high,
                highPct: day.high_pct,
                forecast: true,
                alert: day.high_pct >= ALERT_PCT,
            })),
        ]
        : [];
    // El maximo cubre tambien el extremo alto del rango, para que la linea no se salga.
    const max = Math.max(1, ...bars.map(bar => (bar.forecast ? bar.high : bar.value)));
    const toPx = (value) => (value / max) * BAR_MAX_PX;
    const hasData = bars.some(bar => bar.value > 0);

    return (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                        <BarChart2 size={18} className="text-[#1a2a4a]" />
                        Consultas: últimos 7 días y pronóstico
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" /> Real
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block w-3 h-3 rounded-sm bg-blue-100 border border-dashed border-blue-500" /> Pronóstico (estimado)
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" /> Carga alta ({threshold} o más)
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block w-0.5 h-3 bg-blue-700" /> Rango habitual
                        </span>
                    </div>
                </div>
            </div>

            {failed && !data && (
                <p className="text-sm text-amber-700 flex items-center gap-2">
                    <RefreshCw size={14} /> No se pudo cargar el gráfico de consultas.
                </p>
            )}

            {data && (
                <>
                    <div className="flex items-end gap-1.5 overflow-x-auto" role="img" aria-label="Consultas de los últimos 7 días y pronóstico de los próximos 7">
                        {bars.map((bar, index) => {
                            const startsForecast = bar.forecast && index === data.actual.length;
                            const valueText = bar.forecast ? `~${bar.value.toFixed(1)}` : String(bar.value);
                            const barClass = bar.forecast
                                ? bar.alert
                                    ? 'bg-amber-100 border border-dashed border-amber-500 hover:bg-amber-200'
                                    : 'bg-blue-100 border border-dashed border-blue-500 hover:bg-blue-200'
                                : bar.high
                                    ? 'bg-amber-500 hover:bg-amber-600'
                                    : 'bg-blue-500 hover:bg-blue-600';
                            const tooltip = bar.forecast
                                ? `${dayLabel(bar.date)}: ~${bar.value.toFixed(1)} (rango ${bar.low}–${bar.high}); ${bar.highPct}% de días parecidos con ${threshold} o más consultas`
                                : `${dayLabel(bar.date)}: ${bar.value} consultas${bar.high ? ' (carga alta)' : ''}`;

                            return (
                                <div
                                    key={bar.key}
                                    className={`flex flex-col items-center justify-end flex-1 min-w-[2.25rem] ${
                                        startsForecast ? 'ml-2 pl-2 border-l border-dashed border-gray-300' : ''
                                    }`}
                                >
                                    <span className="text-[11px] text-gray-600 mb-1">{valueText}</span>
                                    <div className="relative w-full" style={{ height: `${BAR_MAX_PX}px` }} title={tooltip}>
                                        <div
                                            className={`absolute bottom-0 left-0 right-0 rounded-t transition-colors ${barClass}`}
                                            style={{ height: `${bar.value > 0 ? Math.max(toPx(bar.value), 4) : 0}px` }}
                                        />
                                        {bar.forecast && bar.high > bar.low && (
                                            <div
                                                className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-blue-700"
                                                style={{
                                                    bottom: `${toPx(bar.low)}px`,
                                                    height: `${toPx(bar.high) - toPx(bar.low)}px`,
                                                }}
                                            />
                                        )}
                                    </div>
                                    <span className="text-[10px] text-gray-500 mt-1 capitalize whitespace-nowrap">{dayLabel(bar.date)}</span>
                                    {bar.forecast && (
                                        <span
                                            className={`text-[10px] whitespace-nowrap ${bar.alert ? 'text-amber-800 font-semibold' : 'text-gray-400'}`}
                                        >
                                            {Math.round(bar.highPct)}% ≥{threshold}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {!hasData && (
                        <p className="text-xs text-gray-400 mt-3">Todavía no hay consultas registradas en estos días.</p>
                    )}

                    <p className="text-xs text-gray-400 mt-4">
                        Estimación orientativa: promedia los mismos días de los últimos {data.history_years} años y ajusta por la tendencia de los últimos 90 días.
                        La línea muestra el rango habitual; el % indica en cuántos de esos días hubo {threshold} o más consultas.
                        {' '}Los pronósticos en ámbar superan el {ALERT_PCT}%.
                    </p>
                </>
            )}
        </section>
    );
}
