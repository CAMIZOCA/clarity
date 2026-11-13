import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, PanelLeft } from 'lucide-react';
import PatientAutocomplete from '../ui/PatientAutocomplete';
import { useUiTemplate } from '../../contexts/UiTemplateContext';
import { ShellContext } from './shellContext';
import { routeTitle } from '../../data/routeTitles';
import WhatsNewModal from '../onboarding/WhatsNewModal';
import CompactTour from '../onboarding/CompactTour';
import Sidebar from './Sidebar';
import ConnectionBanner from '../ui/ConnectionBanner';
import { useBranch } from '../../contexts/BranchContext';
import AssistantChatButton from '../ai/AssistantChatButton';
import { useAuth } from '../../contexts/AuthContext';
import { useScrolled } from '../../hooks/useScrolled';

function BranchSelector() {
    const { branches, activeBranch, switchBranch } = useBranch();

    if (branches.length <= 1) return null;

    return (
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3">
            <span className="flex-shrink-0 text-xs font-medium text-gray-500">Sucursal</span>
            <select
                value={activeBranch?.id || ''}
                onChange={(e) => {
                    const branch = branches.find(b => b.id === parseInt(e.target.value));
                    if (branch) switchBranch(branch);
                }}
                className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            >
                {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                ))}
            </select>
        </div>
    );
}

const SIDEBAR_KEY = 'clarity.ui.sidebar.v1';

function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
    useEffect(() => {
        const media = window.matchMedia(query);
        const update = () => setMatches(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, [query]);
    return matches;
}

/** Barra superior de la plantilla Compacto: titulo, buscador global y sucursal. */
function CompactToolbar({ title, sidebarHidden, onToggleSidebar, onOpenMobileMenu }) {
    const navigate = useNavigate();
    const searchRef = useRef(null);
    const { branches, activeBranch, switchBranch } = useBranch();

    // Ctrl+K (Cmd+K en Mac) lleva al buscador de pacientes desde cualquier pantalla.
    useEffect(() => {
        const onKey = (event) => {
            if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
                const input = searchRef.current?.querySelector('input');
                if (!input) return;
                event.preventDefault();
                input.focus();
                input.select();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <div className="flex h-[52px] items-center gap-2 px-3 lg:px-4">
            <button
                type="button"
                onClick={onOpenMobileMenu}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-900/5 lg:hidden"
                aria-label="Abrir menu"
            >
                <Menu size={19} />
            </button>
            <button
                type="button"
                onClick={onToggleSidebar}
                className="hidden h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-900/5 hover:text-gray-800 lg:inline-flex"
                aria-label={sidebarHidden ? 'Mostrar la barra lateral' : 'Ocultar la barra lateral'}
                aria-pressed={!sidebarHidden}
                title={sidebarHidden ? 'Mostrar menú' : 'Ocultar menú'}
            >
                <PanelLeft size={17} />
            </button>
            <h1 className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-gray-900">{title}</h1>
            <div className="flex-1" />
            {branches.length > 1 && (
                <select
                    aria-label="Sucursal"
                    value={activeBranch?.id || ''}
                    onChange={(e) => {
                        const branch = branches.find(b => b.id === parseInt(e.target.value));
                        if (branch) switchBranch(branch);
                    }}
                    className="hidden max-w-44 rounded-lg border-0 bg-gray-900/5 px-2 py-1 text-[13px] text-gray-800 sm:block"
                >
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            )}
            <div ref={searchRef} className="relative w-56 max-w-[45vw] lg:w-72" title="Buscar paciente (Ctrl+K)">
                <PatientAutocomplete
                    placeholder="Buscar paciente…  Ctrl K"
                    onSelect={(patient) => patient?.id && navigate(`/pacientes/${patient.id}`)}
                />
            </div>
        </div>
    );
}

export default function AppShell() {
    const { user } = useAuth();
    const { isCompact } = useUiTemplate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const mainRef = useRef(null);
    const scrolled = useScrolled(mainRef);

    // Plantilla Compacto: la barra lateral se puede ocultar, y una pagina de
    // captura (la consulta) pide ocultarla sola en laptop (`useFocusMode`).
    const [sidebarHidden, setSidebarHidden] = useState(() => {
        try { return localStorage.getItem(SIDEBAR_KEY) === 'hidden'; } catch { return false; }
    });
    const [focusMode, setFocusModeState] = useState(false);
    const [focusOverride, setFocusOverride] = useState(null);
    const laptopWidth = useMediaQuery('(max-width: 1599px)');
    const desktopSidebarHidden = isCompact && (focusOverride ?? ((focusMode && laptopWidth) || sidebarHidden));
    const setFocusMode = useCallback((value) => {
        setFocusModeState(value);
        setFocusOverride(null);
    }, []);
    const toggleSidebar = useCallback(() => {
        if (focusMode) {
            setFocusOverride(!desktopSidebarHidden);
            return;
        }
        const next = !sidebarHidden;
        setSidebarHidden(next);
        try { localStorage.setItem(SIDEBAR_KEY, next ? 'hidden' : 'shown'); } catch { /* sin almacenamiento */ }
    }, [focusMode, desktopSidebarHidden, sidebarHidden]);
    const shellValue = useMemo(() => ({ setFocusMode }), [setFocusMode]);
    const context = user ? { role: user.roles?.[0] ?? user.role, name: user.name } : {};
    const handleMobileMenuOpen = useCallback(() => {
        setMobileMenuOpen(true);
    }, []);
    const handleMobileMenuClose = useCallback(() => {
        setMobileMenuOpen(false);
    }, []);

    useEffect(() => {
        handleMobileMenuClose();
    }, [location.pathname, handleMobileMenuClose]);

    // Bajo `lg` el que scrollea es <main> (overscroll-contain), asi que el shell
    // necesita altura fija: con solo min-h, main crecia al alto del contenido,
    // no tenia nada que scrollear y el overscroll-contain bloqueaba el scroll
    // del documento. Con una ventana de escritorio angosta no se podia bajar.
    return (
        <ShellContext.Provider value={shellValue}>
        <div className="ui-app flex h-[100dvh] bg-gray-50 lg:h-auto lg:min-h-[100dvh]">
            <Sidebar mobileOpen={mobileMenuOpen} onClose={handleMobileMenuClose} desktopHidden={desktopSidebarHidden} />
            <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden lg:overflow-visible">
                <header
                    className="material-toolbar scroll-edge relative sticky top-0 z-30 pt-[env(safe-area-inset-top)]"
                    data-scrolled={scrolled}
                >
                    {isCompact ? (
                        <CompactToolbar
                            title={routeTitle(location.pathname)}
                            sidebarHidden={desktopSidebarHidden}
                            onToggleSidebar={toggleSidebar}
                            onOpenMobileMenu={handleMobileMenuOpen}
                        />
                    ) : (
                    <>
                    <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
                        <button
                            type="button"
                            onClick={handleMobileMenuOpen}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 lg:hidden"
                            aria-label="Abrir menu"
                        >
                            <Menu size={20} />
                        </button>
                        <div className="min-w-0 flex-1">
                            <p className="text-heading truncate text-sm font-semibold text-gray-900">Sistema Clinico</p>
                            <p className="truncate text-xs text-gray-500">Accesos rapidos, pacientes y operacion diaria</p>
                        </div>
                    </div>
                    <BranchSelector />
                    </>
                    )}
                </header>
                <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] lg:overflow-visible lg:overscroll-auto">
                    <ConnectionBanner />
                    <Outlet />
                </main>
            </div>
            {/* Floating AI assistant — available throughout the app */}
            <AssistantChatButton context={context} />
            {/* Induccion del diseño Compacto: aviso unico y recorrido por pantalla. */}
            <WhatsNewModal />
            <CompactTour />
        </div>
        </ShellContext.Provider>
    );
}
