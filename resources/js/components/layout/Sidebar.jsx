import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    BookOpen,
    BarChart2,
    BarChart3,
    Bell,
    Building2,
    Calendar,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    DollarSign,
    Eye,
    FileSpreadsheet,
    FileText,
    FlaskConical,
    History,
    LayoutDashboard,
    LogOut,
    Megaphone,
    Package,
    Plus,
    RefreshCw,
    Settings,
    Shield,
    ShoppingCart,
    Sparkles,
    Stethoscope,
    User,
    Users,
    Warehouse,
    X,
    Database,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import client from '../../api/client';

const primaryLinkClass =
    'flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition-colors';

const DEFAULT_MENU_VISIBLE_SECTIONS = [
    'atencion_clinica',
    'operacion_diaria',
    'inventario',
    'comercial',
    'reportes',
];

function NavItem({ to, icon: Icon, label, badge, compact = false, onNavigate }) {
    return (
        <NavLink
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
                `${primaryLinkClass} ${
                    isActive
                        ? 'bg-white/20 text-white shadow-sm shadow-black/10'
                        : 'text-slate-200 hover:bg-white/10 hover:text-white'
                } ${compact ? 'py-2.5 text-sm' : ''}`
            }
        >
            <Icon size={18} className="shrink-0" />
            <span className="flex-1 truncate">{label}</span>
            {badge > 0 && (
                <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                    {badge}
                </span>
            )}
        </NavLink>
    );
}

function Section({ title, icon: Icon, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);

    useEffect(() => {
        setOpen(defaultOpen);
    }, [defaultOpen]);

    return (
        <section className="space-y-2">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-2 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
            >
                {Icon ? <Icon size={14} className="shrink-0" /> : <span className="h-3.5 w-3.5" />}
                <span className="flex-1">{title}</span>
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {open && <div className="space-y-1">{children}</div>}
        </section>
    );
}

function SidebarContent({ onNavigate, onLogout, isAdmin, pendingAppointments, userName, userRole, visibleMenuSections }) {
    const visibleSections = Array.isArray(visibleMenuSections)
        ? visibleMenuSections
        : DEFAULT_MENU_VISIBLE_SECTIONS;
    const isMenuSectionVisible = (section) => visibleSections.includes(section);

    const quickActions = [
        { to: '/consulta', label: 'Nueva consulta', icon: Stethoscope, section: 'atencion_clinica' },
        { to: '/pacientes/nuevo', label: 'Nuevo paciente', icon: Plus, section: 'atencion_clinica' },
        { to: '/pos', label: 'Nueva venta', icon: ShoppingCart, section: 'operacion_diaria' },
    ];
    const visibleQuickActions = quickActions.filter((action) => isMenuSectionVisible(action.section));

    return (
        <>
            <div className="border-b border-white/10 px-5 py-5">
                <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#1a2a4a] shadow-sm">
                        <Eye size={22} />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold tracking-wide text-white">Sistema Clinico</p>
                        <p className="truncate text-xs text-slate-300">Optometria y operacion diaria</p>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2">
                    {visibleQuickActions.map((action) => (
                        <NavItem
                            key={action.to}
                            to={action.to}
                            icon={action.icon}
                            label={action.label}
                            compact
                            onNavigate={onNavigate}
                        />
                    ))}
                </div>
            </div>

            <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
                <Section title="Inicio" icon={Sparkles} defaultOpen>
                    <NavItem to="/dashboard" icon={LayoutDashboard} label="Resumen" onNavigate={onNavigate} />
                    <NavItem to="/ayuda" icon={BookOpen} label="Ayuda" onNavigate={onNavigate} />
                </Section>

                {isMenuSectionVisible('atencion_clinica') && (
                    <Section title="Atencion clinica" icon={Stethoscope} defaultOpen>
                        <NavItem to="/pacientes" icon={Users} label="Pacientes" onNavigate={onNavigate} />
                        <NavItem to="/consulta" icon={Stethoscope} label="Consulta" onNavigate={onNavigate} />
                        <NavItem to="/agenda" icon={Calendar} label="Agenda" badge={pendingAppointments} onNavigate={onNavigate} />
                        <NavItem to="/ordenes-trabajo" icon={ClipboardList} label="Ordenes de trabajo" onNavigate={onNavigate} />
                        <NavItem to="/lentes-especiales" icon={Eye} label="Lentes especiales" onNavigate={onNavigate} />
                        <NavItem to="/referencias" icon={FileText} label="Oftalmologia" onNavigate={onNavigate} />
                        <NavItem to="/brigadas" icon={Shield} label="Brigadas" onNavigate={onNavigate} />
                    </Section>
                )}

                {isMenuSectionVisible('operacion_diaria') && (
                    <Section title="Operacion diaria" icon={ShoppingCart} defaultOpen>
                        <NavItem to="/pos" icon={ShoppingCart} label="Ventas / POS" onNavigate={onNavigate} />
                        <NavItem to="/ventas" icon={History} label="Historial de ventas" onNavigate={onNavigate} />
                        <NavItem to="/caja" icon={DollarSign} label="Caja" onNavigate={onNavigate} />
                        <NavItem to="/laboratorio" icon={FlaskConical} label="Laboratorio" onNavigate={onNavigate} />
                    </Section>
                )}

                {isMenuSectionVisible('inventario') && (
                    <Section title="Inventario" icon={Warehouse} defaultOpen>
                        <NavItem to="/inventario/productos" icon={Package} label="Productos" onNavigate={onNavigate} />
                        <NavItem to="/inventario/stock" icon={Warehouse} label="Stock" onNavigate={onNavigate} />
                        <NavItem to="/inventario/movimientos" icon={RefreshCw} label="Movimientos" onNavigate={onNavigate} />
                    </Section>
                )}

                {isMenuSectionVisible('comercial') && (
                    <Section title="Comercial" icon={Megaphone} defaultOpen>
                        <NavItem to="/crm/campanas" icon={Megaphone} label="Campanas" onNavigate={onNavigate} />
                        <NavItem to="/crm/plantillas" icon={FileText} label="Plantillas" onNavigate={onNavigate} />
                        <NavItem to="/crm/recordatorios" icon={Bell} label="Recordatorios" onNavigate={onNavigate} />
                    </Section>
                )}

                {isMenuSectionVisible('reportes') && (
                    <Section title="Reportes" icon={BarChart2} defaultOpen>
                        <NavItem to="/reportes" icon={BarChart2} label="Reportes clinicos" onNavigate={onNavigate} />
                        <NavItem to="/reportes-comerciales" icon={FileSpreadsheet} label="Reportes comerciales" onNavigate={onNavigate} />
                        {isAdmin && <NavItem to="/dashboard-gerencial" icon={BarChart3} label="Dashboard gerencial" onNavigate={onNavigate} />}
                    </Section>
                )}

                {isAdmin && (
                    <Section title="Administracion" icon={Settings} defaultOpen={false}>
                        <NavItem to="/admin/sucursales" icon={Building2} label="Sucursales" onNavigate={onNavigate} />
                        <NavItem to="/admin/bodegas" icon={Warehouse} label="Bodegas" onNavigate={onNavigate} />
                        <NavItem to="/admin/mantenimiento" icon={Database} label="Backups" onNavigate={onNavigate} />
                        <NavItem to="/usuarios" icon={User} label="Usuarios" onNavigate={onNavigate} />
                        <NavItem to="/catalogos" icon={Database} label="Catalogos" onNavigate={onNavigate} />
                        <NavItem to="/configuracion" icon={Settings} label="Configuracion" onNavigate={onNavigate} />
                    </Section>
                )}
            </nav>

            <div className="border-t border-white/10 px-4 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
                        {isAdmin ? 'A' : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{userName || 'Usuario'}</p>
                        <p className="truncate text-xs text-slate-300">{userRole || 'Sesion activa'}</p>
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                    <NavLink
                        to="/perfil"
                        onClick={onNavigate}
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white"
                    >
                        <User size={14} />
                        Mi perfil
                    </NavLink>
                    <button
                        type="button"
                        onClick={() => onLogout?.()}
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white"
                    >
                        <LogOut size={14} />
                        Salir
                    </button>
                </div>
            </div>
        </>
    );
}

export default function Sidebar({ mobileOpen = false, onClose }) {
    const { user, logout, isAdmin } = useAuth();
    const { settings } = useSettings();
    const [pendingAppointments, setPendingAppointments] = useState(0);
    const location = useLocation();

    useEffect(() => {
        const load = () => {
            client
                .get('/reports/dashboard')
                .then((r) => {
                    setPendingAppointments(r.data.citasPendientes ?? 0);
                })
                .catch(() => {});
        };

        load();
        const interval = setInterval(load, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        onClose?.();
    }, [location.pathname, onClose]);

    const drawerState = mobileOpen ? 'translate-x-0' : '-translate-x-full';
    const userMeta = {
        userName: user?.name || 'Usuario',
        userRole: user?.roles?.[0] || user?.role || 'Sesion activa',
    };

    const handleNavigate = () => {
        onClose?.();
    };

    const handleLogout = async () => {
        onClose?.();
        await logout();
    };

    const content = (
        <div className="flex h-full flex-col bg-[#1a2a4a]">
            <SidebarContent
                onNavigate={handleNavigate}
                onLogout={handleLogout}
                isAdmin={isAdmin()}
                pendingAppointments={pendingAppointments}
                userName={userMeta.userName}
                userRole={userMeta.userRole}
                visibleMenuSections={settings.menu_visible_sections}
            />
        </div>
    );

    return (
        <>
            <aside className="hidden h-screen w-72 shrink-0 border-r border-white/10 bg-[#1a2a4a] lg:sticky lg:top-0 lg:flex lg:flex-col">
                {content}
            </aside>

            <div className={`fixed inset-0 z-40 lg:hidden ${mobileOpen ? '' : 'pointer-events-none'}`}>
                <div
                    className={`absolute inset-0 bg-slate-950/45 transition-opacity duration-200 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
                    onClick={onClose}
                />
                <aside
                    className={`absolute inset-y-0 left-0 z-10 flex w-[88vw] max-w-sm flex-col border-r border-white/10 bg-[#1a2a4a] shadow-2xl transition-transform duration-300 ease-out ${drawerState}`}
                >
                    <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#1a2a4a]">
                                <Eye size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-extrabold text-white">Sistema Clinico</p>
                                <p className="text-xs text-slate-300">Acceso rapido</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl p-2 text-slate-200 transition hover:bg-white/10 hover:text-white"
                            aria-label="Cerrar menu"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    {content}
                </aside>
            </div>

        </>
    );
}
