import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Stethoscope, FileText, ArrowRight, TrendingUp, BarChart2, Settings, WifiOff, RefreshCw } from 'lucide-react';
import client from '../../api/client';
import { cached } from '../../api/cache';
import { getReceptionFeed } from '../../api/reception';
import { getPayload } from '../../api/response';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_MENU_VISIBLE_ITEMS, DEFAULT_MENU_VISIBLE_SECTIONS } from '../../data/menuOptions';
import { useSettings } from '../../contexts/SettingsContext';
import LatestConsultationCard from '../../components/dashboard/LatestConsultationCard';
import DayConsultationList from '../../components/dashboard/DayConsultationList';
import ConsultationsChart from '../../components/dashboard/ConsultationsChart';
import { HIGHLIGHT_MINUTES, minutesSince } from '../../components/dashboard/timeFormat';

/** Cuanto tiempo queda resaltada una consulta recien llegada. */
const FRESH_MS = 8_000;

function formatAgo(seconds) {
    if (seconds < 5) return 'un momento';
    if (seconds < 60) return `${seconds} s`;
    return `${Math.floor(seconds / 60)} min`;
}

const upperFirst = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function StatCard({ icon: Icon, label, value, color, to }) {
    const inner = (
        <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex items-center gap-4 hover:shadow-md transition-shadow ${to ? 'cursor-pointer' : ''}`}>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={26} className="text-white" />
            </div>
            <div>
                <p className="text-3xl font-bold text-gray-900">{value ?? '—'}</p>
                <p className="text-sm text-gray-500 mt-0.5">{label}</p>
            </div>
        </div>
    );
    return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function DashboardPage() {
    const { user, isAdmin, can } = useAuth();
    const { settings } = useSettings();
    const [stats, setStats] = useState(null);
    const [feed, setFeed] = useState(null);
    const [feedFailed, setFeedFailed] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [now, setNow] = useState(() => Date.now());
    const [freshIds, setFreshIds] = useState(() => new Set());
    const [selectedId, setSelectedId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [chartRefresh, setChartRefresh] = useState(0);

    const canSeeFeed = can('consultations.handoff');
    // El optometra ve las listas para retomar una consulta, pero la tarjeta
    // destacada y el aviso sonoro son para quien atiende despues (el vendedor).
    const showHighlight = canSeeFeed && (isAdmin() || !user?.roles?.includes('optometra'));

    const knownIds = useRef(null);
    const freshTimer = useRef(null);

    useEffect(() => {
        cached('dashboard', 60_000, () => client.get('/reports/dashboard').then(r => r.data))
            .then(setStats)
            .catch(() => {});
    }, []);

    // Solo se consulta al abrir la pantalla y al pulsar "Actualizar": sin
    // refresco automatico, para no llenar el servidor ni la pantalla de peticiones.
    const loadFeed = useCallback(async () => {
        setRefreshing(true);
        try {
            const data = getPayload(await getReceptionFeed());
            const items = (data?.days ?? []).flatMap(day => day.consultations ?? []);

            // La primera carga solo fija la linea base: lo que ya estaba terminado
            // no cuenta como "nuevo".
            if (knownIds.current) {
                const arrived = items.filter(item =>
                    !knownIds.current.has(item.id) && minutesSince(item.closed_at) < HIGHLIGHT_MINUTES);

                if (arrived.length > 0 && showHighlight) {
                    setSelectedId(arrived[0].id);
                    setFreshIds(new Set(arrived.map(item => item.id)));
                    clearTimeout(freshTimer.current);
                    freshTimer.current = setTimeout(() => setFreshIds(new Set()), FRESH_MS);
                }
            }
            knownIds.current = new Set(items.map(item => item.id));

            setFeed(data);
            setFeedFailed(false);
            setLastUpdated(Date.now());
        } catch {
            setFeedFailed(true);
        } finally {
            setRefreshing(false);
        }
    }, [showHighlight]);

    useEffect(() => {
        if (canSeeFeed) loadFeed();
        return () => clearTimeout(freshTimer.current);
    }, [canSeeFeed, loadFeed]);

    // Las edades de la tarjeta ("hace 12 min") y el momento en que se pliega
    // dependen del reloj, no de que llegue una respuesta.
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 15_000);
        return () => clearInterval(timer);
    }, []);

    const days = feed?.days ?? [];
    const todayCount = days[0]?.consultations?.length;

    const highlighted = useMemo(
        () => days
            .flatMap(day => day.consultations ?? [])
            .filter(item => minutesSince(item.closed_at, now) < HIGHLIGHT_MINUTES)
            .sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at)),
        [days, now]
    );
    const featured = highlighted.find(item => item.id === selectedId) ?? highlighted[0] ?? null;
    const others = highlighted.filter(item => item.id !== featured?.id);

    const today = new Date(now);
    const hora = today.getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
    const secondsAgo = lastUpdated ? Math.max(0, Math.round((now - lastUpdated) / 1000)) : null;

    const visibleMenuSections = Array.isArray(settings.menu_visible_sections) && settings.menu_visible_sections.length > 0
        ? settings.menu_visible_sections
        : DEFAULT_MENU_VISIBLE_SECTIONS;
    const visibleMenuItems = Array.isArray(settings.menu_visible_items) && settings.menu_visible_items.length > 0
        ? settings.menu_visible_items
        : DEFAULT_MENU_VISIBLE_ITEMS;
    const isMenuSectionVisible = (section) => visibleMenuSections.includes(section);
    const isMenuItemVisible = (item) => visibleMenuItems.includes(item);
    const canManageSettings = can('settings.edit');

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-4xl font-bold text-gray-900">
                        {upperFirst(format(today, "EEEE d 'de' MMMM", { locale: es }))}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {saludo}, {user?.name?.split(' ')[0]} · {format(today, 'yyyy')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {canSeeFeed && (
                        <div className="flex items-center gap-3">
                            <span className={`text-xs flex items-center gap-1.5 ${feedFailed ? 'text-amber-700' : 'text-gray-400'}`} aria-live="polite">
                                {feedFailed && <WifiOff size={13} />}
                                {feedFailed
                                    ? 'No se pudo actualizar'
                                    : secondsAgo === null ? 'Cargando…' : `Actualizado hace ${formatAgo(secondsAgo)}`}
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    loadFeed();
                                    setChartRefresh(count => count + 1);
                                }}
                                disabled={refreshing}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#1a2a4a] text-[#1a2a4a] text-sm font-medium hover:bg-[#1a2a4a] hover:text-white transition-colors disabled:opacity-60"
                            >
                                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                                Actualizar consultas recientes
                            </button>
                        </div>
                    )}
                    {isAdmin() && (
                        <Link
                            to="/dashboard-gerencial"
                            className="flex items-center gap-2 px-4 py-2 bg-[#1a2a4a] text-white rounded-xl text-sm font-medium hover:bg-[#253d6b] transition-colors"
                        >
                            <BarChart2 size={16} />
                            Ver Dashboard Gerencial
                            <ArrowRight size={14} />
                        </Link>
                    )}
                </div>
            </div>

            {showHighlight && featured && (
                <>
                    <LatestConsultationCard item={featured} now={now} fresh={freshIds.has(featured.id)} />
                    {others.length > 0 && (
                        <div className="-mt-3 mb-6 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-gray-500">También terminadas:</span>
                            {others.map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setSelectedId(item.id)}
                                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                                        freshIds.has(item.id)
                                            ? 'border-amber-400 bg-amber-50 text-amber-900'
                                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    {item.patient.nombre_completo}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <StatCard icon={Users} label="Pacientes registrados" value={stats?.totalPacientes} color="bg-[#1a2a4a]" to="/pacientes" />
                {canSeeFeed && (
                    <StatCard icon={Stethoscope} label="Consultas completadas hoy" value={todayCount} color="bg-blue-500" />
                )}
            </div>

            {/* Consultas de los ultimos 7 dias y pronostico de los siguientes */}
            {canSeeFeed && <ConsultationsChart refreshToken={chartRefresh} />}

            {/* Consultas por dia */}
            {canSeeFeed && (
                <div className="space-y-6">
                    {!feed ? (
                        <div className="py-8 text-center"><div className="animate-spin h-6 w-6 border-2 border-[#1a2a4a] border-t-transparent rounded-full mx-auto" /></div>
                    ) : days.slice(0, 1).map((day, index) => (
                        <DayConsultationList
                            key={day.date}
                            day={day}
                            index={index}
                            expandedId={expandedId}
                            onToggle={(id) => setExpandedId(current => (current === id ? null : id))}
                        />
                    ))}
                </div>
            )}

            {/* Quick actions */}
            <div className="mt-6 bg-[#1a2a4a] rounded-2xl p-6 text-white">
                <h2 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp size={18} /> Acciones rápidas</h2>
                <div className="flex flex-wrap gap-3">
                    {isMenuItemVisible('pacientes') && (
                        <Link to="/pacientes">
                            <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                                <Stethoscope size={16} /> Buscar paciente
                            </button>
                        </Link>
                    )}
                    {isMenuItemVisible('pacientes') && (
                        <Link to="/pacientes/nuevo">
                            <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                                <Users size={16} /> Nuevo paciente
                            </button>
                        </Link>
                    )}
                    {isMenuSectionVisible('reportes') && isMenuItemVisible('reportes_clinicos') && (
                        <Link to="/reportes">
                            <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                                <FileText size={16} /> Ver reportes
                            </button>
                        </Link>
                    )}
                    {canManageSettings && (
                        <Link to="/configuracion">
                            <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                                <Settings size={16} /> Configurar menu
                            </button>
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
