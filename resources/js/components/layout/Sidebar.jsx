import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    Eye, Users, Calendar, Shield, FileText,
    BarChart2, LogOut, User, Stethoscope, LayoutDashboard,
    Settings, BookOpen, Database, ClipboardList
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import client from '../../api/client';

const NavItem = ({ to, icon: Icon, label, badge }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors
            ${isActive
                ? 'bg-white/20 text-white'
                : 'text-blue-100 hover:bg-white/10 hover:text-white'
            }`
        }
    >
        <Icon size={20} />
        <span className="flex-1">{label}</span>
        {badge > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {badge}
            </span>
        )}
    </NavLink>
);

export default function Sidebar() {
    const { user, logout, isAdmin } = useAuth();
    const [pendingAppointments, setPendingAppointments] = useState(0);

    useEffect(() => {
        const load = () => {
            client.get('/reports/dashboard').then(r => {
                setPendingAppointments(r.data.citasPendientes ?? 0);
            }).catch(() => {});
        };
        load();
        const interval = setInterval(load, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <aside className="w-64 min-h-screen bg-[#1a2a4a] flex flex-col flex-shrink-0">
            {/* Logo */}
            <div className="px-6 py-5 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
                        <Eye size={22} className="text-[#1a2a4a]" />
                    </div>
                    <div>
                        <p className="font-bold text-white text-sm leading-tight">Sistema Clínico</p>
                        <p className="text-blue-200 text-xs">Optometría</p>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
                <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                <NavItem to="/consulta" icon={Stethoscope} label="Consulta" />
                <NavItem to="/ordenes-trabajo" icon={ClipboardList} label="Órdenes de Trabajo" />
                <NavItem to="/pacientes" icon={Users} label="Pacientes" />
                <NavItem to="/agenda" icon={Calendar} label="Agenda" badge={pendingAppointments} />
                <NavItem to="/brigadas" icon={Shield} label="Brigadas" />
                <NavItem to="/lentes-especiales" icon={Eye} label="Lentes Especiales" />
                <NavItem to="/referencias" icon={FileText} label="Oftalmología" />
                <NavItem to="/reportes" icon={BarChart2} label="Reportes" />
                {isAdmin() && (
                    <>
                        <div className="border-t border-white/10 my-2" />
                        <NavItem to="/usuarios" icon={User} label="Usuarios" />
                        <NavItem to="/catalogos" icon={Database} label="Catálogos" />
                    </>
                )}
                <div className="border-t border-white/10 my-2" />
                <NavItem to="/configuracion" icon={Settings} label="Configuración" />
                <NavItem to="/ayuda" icon={BookOpen} label="Ayuda" />
            </nav>

            {/* User info */}
            <div className="px-4 py-4 border-t border-white/10">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm">
                        {user?.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-white text-sm font-medium truncate">{user?.name}</p>
                        <p className="text-blue-200 text-xs capitalize">{user?.roles?.[0] ?? user?.role}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <NavLink to="/perfil" className="flex items-center gap-1 text-blue-200 hover:text-white text-sm transition-colors">
                        <User size={14} /> Mi perfil
                    </NavLink>
                    <span className="text-white/20">|</span>
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 text-blue-200 hover:text-white text-sm transition-colors"
                    >
                        <LogOut size={16} />
                        Salir
                    </button>
                </div>
            </div>
        </aside>
    );
}
