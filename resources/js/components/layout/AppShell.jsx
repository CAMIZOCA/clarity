import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
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
                className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
            >
                {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                ))}
            </select>
        </div>
    );
}

export default function AppShell() {
    const { user } = useAuth();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const mainRef = useRef(null);
    const scrolled = useScrolled(mainRef);
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
        <div className="flex h-[100dvh] bg-gray-50 lg:h-auto lg:min-h-[100dvh]">
            <Sidebar mobileOpen={mobileMenuOpen} onClose={handleMobileMenuClose} />
            <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden lg:overflow-visible">
                <header
                    className="material-toolbar scroll-edge relative sticky top-0 z-30 pt-[env(safe-area-inset-top)]"
                    data-scrolled={scrolled}
                >
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
                </header>
                <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] lg:overflow-visible lg:overscroll-auto">
                    <ConnectionBanner />
                    <Outlet />
                </main>
            </div>
            {/* Floating AI assistant — available throughout the app */}
            <AssistantChatButton context={context} />
        </div>
    );
}
