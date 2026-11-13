import React, { createContext, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
import { DEFAULT_MENU_VISIBLE_ITEMS, DEFAULT_MENU_VISIBLE_SECTIONS, MENU_ITEM_OPTIONS_BY_SECTION, canUseMenuItem } from '../../data/menuOptions';
import client from '../../api/client';
import { motionTransition, SPRING_SHEET, REDUCED_MOTION_TRANSITION } from '../../utils/motion';
import { useUiTemplate } from '../../contexts/UiTemplateContext';
import TemplateSwitch from '../ui/TemplateSwitch';

/*
 * Dos pieles para el mismo menu. "clasico" son exactamente las clases de
 * siempre (fondo azul marino); "compacto" es la barra lateral clara y
 * translucida de las HIG. Grupos, permisos y enlaces son los mismos.
 */
const SKINS = {
    clasico: {
        link: 'flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition-colors',
        active: 'bg-white/20 text-white shadow-sm shadow-black/10',
        idle: 'text-slate-200 hover:bg-white/10 hover:text-white',
        linkCompact: 'py-2.5 text-sm',
        icon: 'shrink-0',
        iconSize: 18,
        sectionButton: 'flex w-full items-center gap-3 rounded-xl px-4 py-2 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 transition hover:bg-white/10 hover:text-slate-200',
        sectionSpacing: 'space-y-2',
        sectionItems: 'space-y-1',
        nav: 'flex-1 space-y-4 overflow-y-auto px-3 py-4',
    },
    compacto: {
        link: 'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] font-medium transition-colors',
        active: 'bg-gray-900/10 text-gray-900 font-semibold',
        idle: 'text-gray-800 hover:bg-gray-900/5',
        linkCompact: '',
        icon: 'shrink-0 text-navy',
        iconSize: 16,
        sectionButton: 'flex w-full items-center gap-2 rounded-md px-2.5 pb-1 pt-3 text-left text-[11px] font-semibold text-gray-500 transition hover:text-gray-700',
        sectionSpacing: 'space-y-0.5',
        sectionItems: 'space-y-0.5',
        nav: 'flex-1 space-y-1 overflow-y-auto px-2.5 pb-3',
    },
};

// Mismo menu en las dos plantillas: NavItem y Section leen la piel del contexto.
const SkinContext = createContext(SKINS.clasico);

function NavItem({ to, icon: Icon, label, badge, compact = false, end = false, onNavigate }) {
    const skin = useContext(SkinContext);
    return (
        <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
                `${skin.link} ${
                    isActive
                        ? skin.active
                        : skin.idle
                } ${compact ? skin.linkCompact : ''}`
            }
        >
            <Icon size={skin.iconSize} className={skin.icon} />
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
    const skin = useContext(SkinContext);
    const compactSkin = skin === SKINS.compacto;
    const [open, setOpen] = useState(defaultOpen);

    useEffect(() => {
        setOpen(defaultOpen);
    }, [defaultOpen]);

    return (
        <section className={skin.sectionSpacing}>
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className={skin.sectionButton}
                aria-expanded={open}
            >
                {!compactSkin && (Icon ? <Icon size={14} className="shrink-0" /> : <span className="h-3.5 w-3.5" />)}
                <span className="flex-1">{title}</span>
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {open && <div className={skin.sectionItems}>{children}</div>}
        </section>
    );
}

function SidebarContent({ onNavigate, onLogout, isAdmin, can, canManageSettings, pendingAppointments, userName, userRole, visibleMenuSections, visibleMenuItems, compactSkin = false }) {
    const visibleSections = Array.isArray(visibleMenuSections) && visibleMenuSections.length > 0
        ? visibleMenuSections
        : DEFAULT_MENU_VISIBLE_SECTIONS;
    const visibleItems = Array.isArray(visibleMenuItems) && visibleMenuItems.length > 0
        ? visibleMenuItems
        : DEFAULT_MENU_VISIBLE_ITEMS;
    const isMenuSectionVisible = (section) => visibleSections.includes(section);
    // El ajuste global decide que se ofrece; el permiso, quien lo ve.
    const isMenuItemVisible = (item) => visibleItems.includes(item) && canUseMenuItem(can, item);
    const hasVisibleItemsInSection = (section) =>
        MENU_ITEM_OPTIONS_BY_SECTION[section]?.some((item) => isMenuItemVisible(item.key));
    const shouldShowSection = (section) => isMenuSectionVisible(section) && hasVisibleItemsInSection(section);

    // La consulta no tiene acceso directo: se abre siempre desde la ficha del
    // paciente (`/consulta?paciente=ID`), que es donde esta su historial.
    const quickActions = [
        // `end`: que no quede resaltado tambien en /pacientes/nuevo.
        { to: '/pacientes', label: 'Pacientes', icon: Users, section: 'atencion_clinica', item: 'pacientes', end: true },
        { to: '/pacientes/nuevo', label: 'Nuevo paciente', icon: Plus, section: 'atencion_clinica', item: 'pacientes' },
        { to: '/pos', label: 'Nueva venta', icon: ShoppingCart, section: 'operacion_diaria', item: 'pos' },
    ];
    const visibleQuickActions = quickActions.filter((action) => shouldShowSection(action.section) && isMenuItemVisible(action.item));
    const skin = compactSkin ? SKINS.compacto : SKINS.clasico;

    return (
        <SkinContext.Provider value={skin}>
            {compactSkin ? (
                <div className="px-3 pb-2 pt-4">
                    <div className="flex items-center gap-2.5 px-1.5 pb-3">
                        <div className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-white">
                            <Eye size={15} />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-semibold text-gray-900">Sistema Clínico</p>
                            <p className="truncate text-[11px] text-gray-500">Optometría y operación diaria</p>
                        </div>
                    </div>
                    <div className="space-y-0.5">
                        {visibleQuickActions.map((action) => (
                            <NavItem
                                key={action.to}
                                to={action.to}
                                icon={action.icon}
                                label={action.label}
                                end={action.end}
                                compact
                                onNavigate={onNavigate}
                            />
                        ))}
                    </div>
                </div>
            ) : (
            <div className="border-b border-white/10 px-5 py-5">
                <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-navy shadow-sm">
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
                            end={action.end}
                            compact
                            onNavigate={onNavigate}
                        />
                    ))}
                </div>
            </div>
            )}

            <nav className={skin.nav}>
                <Section title="Inicio" icon={Sparkles} defaultOpen>
                    <NavItem to="/dashboard" icon={LayoutDashboard} label="Resumen" onNavigate={onNavigate} />
                    <NavItem to="/ayuda" icon={BookOpen} label="Ayuda" onNavigate={onNavigate} />
                    {canManageSettings && <NavItem to="/configuracion" icon={Settings} label="Configuracion" onNavigate={onNavigate} />}
                </Section>

                {shouldShowSection('atencion_clinica') && (
                    <Section title="Atencion clinica" icon={Stethoscope} defaultOpen>
                        {isMenuItemVisible('pacientes') && <NavItem to="/pacientes" icon={Users} label="Pacientes" onNavigate={onNavigate} />}
                        {isMenuItemVisible('agenda') && <NavItem to="/agenda" icon={Calendar} label="Agenda" badge={pendingAppointments} onNavigate={onNavigate} />}
                        {isMenuItemVisible('ordenes_trabajo') && <NavItem to="/ordenes-trabajo" icon={ClipboardList} label="Ordenes de trabajo" onNavigate={onNavigate} />}
                        {isMenuItemVisible('lentes_especiales') && <NavItem to="/lentes-especiales" icon={Eye} label="Lentes especiales" onNavigate={onNavigate} />}
                        {isMenuItemVisible('referencias') && <NavItem to="/referencias" icon={FileText} label="Oftalmologia" onNavigate={onNavigate} />}
                        {isMenuItemVisible('brigadas') && <NavItem to="/brigadas" icon={Shield} label="Brigadas" onNavigate={onNavigate} />}
                    </Section>
                )}

                {shouldShowSection('operacion_diaria') && (
                    <Section title="Operacion diaria" icon={ShoppingCart} defaultOpen>
                        {isMenuItemVisible('pos') && <NavItem to="/pos" icon={ShoppingCart} label="Ventas / POS" onNavigate={onNavigate} />}
                        {isMenuItemVisible('ventas') && <NavItem to="/ventas" icon={History} label="Historial de ventas" onNavigate={onNavigate} />}
                        {isMenuItemVisible('caja') && <NavItem to="/caja" icon={DollarSign} label="Caja" onNavigate={onNavigate} />}
                        {isMenuItemVisible('laboratorio') && <NavItem to="/laboratorio" icon={FlaskConical} label="Laboratorio" onNavigate={onNavigate} />}
                    </Section>
                )}

                {shouldShowSection('inventario') && (
                    <Section title="Inventario" icon={Warehouse} defaultOpen>
                        {isMenuItemVisible('inventario_productos') && <NavItem to="/inventario/productos" icon={Package} label="Productos" onNavigate={onNavigate} />}
                        {isMenuItemVisible('inventario_stock') && <NavItem to="/inventario/stock" icon={Warehouse} label="Stock" onNavigate={onNavigate} />}
                        {isMenuItemVisible('inventario_movimientos') && <NavItem to="/inventario/movimientos" icon={RefreshCw} label="Movimientos" onNavigate={onNavigate} />}
                    </Section>
                )}

                {shouldShowSection('comercial') && (
                    <Section title="Comercial" icon={Megaphone} defaultOpen>
                        {isMenuItemVisible('crm_campanas') && <NavItem to="/crm/campanas" icon={Megaphone} label="Campanas" onNavigate={onNavigate} />}
                        {isMenuItemVisible('crm_plantillas') && <NavItem to="/crm/plantillas" icon={FileText} label="Plantillas" onNavigate={onNavigate} />}
                        {isMenuItemVisible('crm_recordatorios') && <NavItem to="/crm/recordatorios" icon={Bell} label="Recordatorios" onNavigate={onNavigate} />}
                    </Section>
                )}

                {shouldShowSection('reportes') && (
                    <Section title="Reportes" icon={BarChart2} defaultOpen>
                        {isMenuItemVisible('reportes_clinicos') && <NavItem to="/reportes" icon={BarChart2} label="Reportes clinicos" onNavigate={onNavigate} />}
                        {isMenuItemVisible('reportes_comerciales') && <NavItem to="/reportes-comerciales" icon={FileSpreadsheet} label="Reportes comerciales" onNavigate={onNavigate} />}
                        {isAdmin && isMenuItemVisible('dashboard_gerencial') && <NavItem to="/dashboard-gerencial" icon={BarChart3} label="Dashboard gerencial" onNavigate={onNavigate} />}
                    </Section>
                )}

                {isAdmin && (
                    <Section title="Administracion" icon={Settings} defaultOpen={false}>
                        <NavItem to="/admin/sucursales" icon={Building2} label="Sucursales" onNavigate={onNavigate} />
                        <NavItem to="/admin/bodegas" icon={Warehouse} label="Bodegas" onNavigate={onNavigate} />
                        <NavItem to="/admin/mantenimiento" icon={Database} label="Backups" onNavigate={onNavigate} />
                        <NavItem to="/usuarios" icon={User} label="Usuarios" onNavigate={onNavigate} />
                        <NavItem to="/catalogos" icon={Database} label="Catalogos" onNavigate={onNavigate} />
                    </Section>
                )}
            </nav>

            {compactSkin ? (
                <div className="border-t border-gray-900/10 px-3 py-3">
                    <div className="flex items-center gap-2.5 px-1">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900/10 text-xs font-semibold text-gray-700">
                            {(userName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-gray-900">{userName || 'Usuario'}</p>
                            <p className="truncate text-[11px] text-gray-500">{userRole || 'Sesion activa'}</p>
                        </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                        <NavLink to="/perfil" onClick={onNavigate} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-gray-700 hover:bg-gray-900/5">
                            <User size={13} /> Mi perfil
                        </NavLink>
                        <button type="button" onClick={() => onLogout?.()} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-gray-700 hover:bg-gray-900/5">
                            <LogOut size={13} /> Salir
                        </button>
                    </div>
                    <TemplateSwitch className="mt-2 px-1" />
                </div>
            ) : (
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

                <TemplateSwitch tone="dark" className="mt-3" />
            </div>
            )}
        </SkinContext.Provider>
    );
}

export default function Sidebar({ mobileOpen = false, onClose, desktopHidden = false }) {
    const { user, logout, isAdmin, can } = useAuth();
    const { settings } = useSettings();
    const { isCompact } = useUiTemplate();
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
        <div className={isCompact ? 'flex h-full min-h-0 flex-col' : 'flex h-full flex-col bg-navy'}>
            <SidebarContent
                compactSkin={isCompact}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
                isAdmin={isAdmin()}
                can={can}
                canManageSettings={can('settings.edit')}
                pendingAppointments={pendingAppointments}
                userName={userMeta.userName}
                userRole={userMeta.userRole}
                visibleMenuSections={settings.menu_visible_sections}
                visibleMenuItems={settings.menu_visible_items}
            />
        </div>
    );

    return (
        <>
            {isCompact ? (
                !desktopHidden && (
                    <aside className="ui-sidebar hidden h-screen w-60 shrink-0 border-r border-gray-900/10 lg:sticky lg:top-0 lg:flex lg:flex-col" aria-label="Menú principal">
                        {content}
                    </aside>
                )
            ) : (
                <aside className="hidden h-screen w-72 shrink-0 border-r border-white/10 bg-navy lg:sticky lg:top-0 lg:flex lg:flex-col">
                    {content}
                </aside>
            )}

            <AnimatePresence>
                {mobileOpen && (
                    <div className="fixed inset-0 z-40 lg:hidden">
                        <motion.div
                            className="material-scrim absolute inset-0"
                            onClick={onClose}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={REDUCED_MOTION_TRANSITION}
                        />
                        <motion.aside
                            className={isCompact
                                ? 'absolute inset-y-0 left-0 z-10 flex w-[88vw] max-w-sm flex-col border-r border-gray-900/10 bg-gray-50 shadow-2xl'
                                : 'absolute inset-y-0 left-0 z-10 flex w-[88vw] max-w-sm flex-col border-r border-white/10 bg-navy shadow-2xl'}
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={motionTransition(SPRING_SHEET)}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={{ left: 1, right: 0 }}
                            onDragEnd={(event, info) => {
                                if (info.offset.x < -80 || info.velocity.x < -500) onClose?.();
                            }}
                        >
                            {isCompact ? (
                                <div className="flex justify-end px-3 pt-3">
                                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-600 hover:bg-gray-900/5" aria-label="Cerrar menu">
                                        <X size={20} />
                                    </button>
                                </div>
                            ) : (
                            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-navy">
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
                            )}
                            {content}
                        </motion.aside>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
