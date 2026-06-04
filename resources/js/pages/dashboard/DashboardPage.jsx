import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Stethoscope, Calendar, FileText, ArrowRight, TrendingUp } from 'lucide-react';
import client from '../../api/client';
import { cached } from '../../api/cache';
import Badge from '../../components/ui/Badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';

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
    const { user } = useAuth();
    const [data, setData] = useState(null);

    useEffect(() => {
        cached('dashboard', 60_000, () => client.get('/reports/dashboard').then(r => r.data))
            .then(setData)
            .catch(() => {});
    }, []);

    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">{saludo}, {user?.name?.split(' ')[0]}</h1>
                <p className="text-gray-500 mt-1">{format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <StatCard icon={Users} label="Pacientes registrados" value={data?.totalPacientes} color="bg-[#1a2a4a]" to="/pacientes" />
                <StatCard icon={Stethoscope} label="Consultas hoy" value={data?.consultasHoy} color="bg-blue-500" to="/consulta" />
                <StatCard icon={Calendar} label="Citas próximos 7 días" value={data?.citasPendientes} color="bg-amber-500" to="/agenda" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Últimas consultas */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Stethoscope size={18} className="text-[#1a2a4a]" /> Últimas consultas
                        </h2>
                        <Link to="/pacientes" className="text-sm text-[#1a2a4a] hover:underline flex items-center gap-1">
                            Ver todo <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {!data ? (
                            <div className="py-8 text-center"><div className="animate-spin h-6 w-6 border-2 border-[#1a2a4a] border-t-transparent rounded-full mx-auto" /></div>
                        ) : (data.ultimasConsultas ?? []).length === 0 ? (
                            <p className="py-8 text-center text-gray-400 text-sm">Sin consultas aún</p>
                        ) : (data.ultimasConsultas ?? []).map(c => (
                            <Link key={c.id} to={`/consulta/${c.id}`} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors block">
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">{c.patient?.nombre}</p>
                                    <p className="text-xs text-gray-500">
                                        Consulta #{c.numero_consulta} · {c.fecha_consulta ? format(new Date(c.fecha_consulta), 'd MMM', { locale: es }) : ''}
                                    </p>
                                </div>
                                <Badge label={c.estado} />
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Próximas citas */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Calendar size={18} className="text-[#1a2a4a]" /> Próximas citas
                        </h2>
                        <Link to="/agenda" className="text-sm text-[#1a2a4a] hover:underline flex items-center gap-1">
                            Agenda <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {!data ? (
                            <div className="py-8 text-center"><div className="animate-spin h-6 w-6 border-2 border-[#1a2a4a] border-t-transparent rounded-full mx-auto" /></div>
                        ) : (data.proximasCitas ?? []).length === 0 ? (
                            <p className="py-8 text-center text-gray-400 text-sm">Sin citas próximas</p>
                        ) : (data.proximasCitas ?? []).map(a => (
                            <div key={a.id} className="px-6 py-3 flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">{a.titulo || a.patient?.nombre || 'Cita sin título'}</p>
                                    <p className="text-xs text-gray-500">
                                        {a.fecha_hora_inicio ? format(new Date(a.fecha_hora_inicio), "d MMM · HH:mm", { locale: es }) : ''}
                                    </p>
                                </div>
                                <Badge label={a.estado} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick actions */}
            <div className="mt-6 bg-[#1a2a4a] rounded-2xl p-6 text-white">
                <h2 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp size={18} /> Acciones rápidas</h2>
                <div className="flex flex-wrap gap-3">
                    <Link to="/consulta">
                        <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                            <Stethoscope size={16} /> Nueva consulta
                        </button>
                    </Link>
                    <Link to="/pacientes/nuevo">
                        <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                            <Users size={16} /> Nuevo paciente
                        </button>
                    </Link>
                    <Link to="/agenda">
                        <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                            <Calendar size={16} /> Agendar cita
                        </button>
                    </Link>
                    <Link to="/reportes">
                        <button className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                            <FileText size={16} /> Ver reportes
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
