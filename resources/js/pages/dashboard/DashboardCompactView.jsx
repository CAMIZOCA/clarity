import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart2, RefreshCw, Stethoscope, Users, WifiOff } from 'lucide-react';
import LatestConsultationCard from '../../components/dashboard/LatestConsultationCard';
import DayConsultationList from '../../components/dashboard/DayConsultationList';
import ConsultationsChart from '../../components/dashboard/ConsultationsChart';

/**
 * Inicio en la plantilla Compacto (HIG). Solo presentacion: el feed, el
 * resaltado de la consulta recien terminada, los permisos y las acciones vienen
 * de DashboardPage (el mismo codigo del Clasico) y se reutilizan sus tarjetas.
 *
 * Paridad con el Clasico: fecha, saludo y mensaje del dia; "Actualizado hace" y
 * "Actualizar consultas recientes" (sin refresco automatico); Dashboard
 * gerencial (admin); consulta recien terminada y las otras en chips; pacientes
 * registrados y consultas de hoy; grafico de la semana; lista del dia; acciones
 * rapidas segun menu y permisos. Todo lo del feed solo con `canSeeFeed`.
 */
function Stat({ icon: Icon, label, value, to }) {
    const inner = (
        <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm transition-colors hover:bg-gray-50">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-navy/10 text-navy"><Icon size={18} /></div>
            <div>
                <p className="text-[22px] font-bold leading-none tracking-tight text-gray-900 tabular-nums">{value ?? '—'}</p>
                <p className="mt-0.5 text-xs text-gray-500">{label}</p>
            </div>
        </div>
    );
    return to ? <Link to={to}>{inner}</Link> : inner;
}

function QuickLink({ to, icon: Icon, children }) {
    return (
        <Link to={to} className="flex items-center gap-2.5 px-3 py-2 text-[13.5px] text-gray-800 hover:bg-gray-900/[0.03]">
            <Icon size={16} className="text-navy" />
            <span className="flex-1">{children}</span>
            <ArrowRight size={14} className="text-gray-300" />
        </Link>
    );
}

export default function DashboardCompactView({
    title, greeting, dailyMessage, canSeeFeed, feed, feedFailed, secondsAgo, formatAgo, refreshing, onRefresh,
    isAdmin, showHighlight, featured, others, freshIds, now, onSelect, stats, todayCount, chartRefresh,
    days, expandedId, onToggle, quickLinks,
}) {
    return (
        <div className="mx-auto max-w-[112rem] space-y-4 px-4 py-4 lg:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">{title}</h1>
                    <p className="text-sm text-gray-500">{greeting}</p>
                    {dailyMessage && (
                        <p className="mt-1.5 max-w-2xl text-[13.5px] italic text-gray-600">
                            “{dailyMessage.text}”
                            {dailyMessage.ref && <span className="ml-2 not-italic text-xs text-gray-500">— {dailyMessage.ref}</span>}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {canSeeFeed && (
                        <>
                            <span className={`flex items-center gap-1.5 text-xs ${feedFailed ? 'text-amber-700' : 'text-gray-500'}`} aria-live="polite">
                                {feedFailed && <WifiOff size={13} />}
                                {feedFailed ? 'No se pudo actualizar' : secondsAgo === null ? 'Cargando…' : `Actualizado hace ${formatAgo(secondsAgo)}`}
                            </span>
                            <button
                                type="button"
                                onClick={onRefresh}
                                disabled={refreshing}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-navy shadow-sm hover:bg-gray-50 disabled:opacity-60"
                            >
                                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                                Actualizar consultas recientes
                            </button>
                        </>
                    )}
                    {isAdmin && (
                        <Link to="/dashboard-gerencial" className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-navy-light">
                            <BarChart2 size={14} /> Dashboard gerencial
                        </Link>
                    )}
                </div>
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-4">
                    {showHighlight && featured && (
                        <section aria-label="Recién terminada">
                            <LatestConsultationCard item={featured} now={now} fresh={freshIds.has(featured.id)} />
                            {others.length > 0 && (
                                <div className="-mt-3 flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs text-gray-500">También terminadas:</span>
                                    {others.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => onSelect(item.id)}
                                            className={`rounded-full px-2.5 py-0.5 text-[12.5px] transition-colors ${
                                                freshIds.has(item.id) ? 'bg-amber-100 text-amber-900' : 'bg-white text-gray-700 shadow-sm hover:bg-gray-50'
                                            }`}
                                        >
                                            {item.patient.nombre_completo}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {canSeeFeed && (
                        <section aria-label="Consultas del día">
                            {!feed ? (
                                <div className="py-8 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-navy border-t-transparent" /></div>
                            ) : days.slice(0, 1).map((day, index) => (
                                <DayConsultationList key={day.date} day={day} index={index} expandedId={expandedId} onToggle={onToggle} />
                            ))}
                        </section>
                    )}
                </div>

                <div className="min-w-0 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <Stat icon={Users} label="Pacientes registrados" value={stats?.totalPacientes} to="/pacientes" />
                        {canSeeFeed && <Stat icon={Stethoscope} label="Consultas completadas hoy" value={todayCount} />}
                    </div>
                    {canSeeFeed && <ConsultationsChart refreshToken={chartRefresh} />}
                    {quickLinks.length > 0 && (
                        <section aria-labelledby="inicio-accesos">
                            <h2 id="inicio-accesos" className="mb-1.5 px-1 text-[13px] font-semibold text-gray-600">Acciones rápidas</h2>
                            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white shadow-sm">
                                {quickLinks.map((link) => (
                                    <QuickLink key={link.to} to={link.to} icon={link.icon}>{link.label}</QuickLink>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}
