import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { useBranch } from '../../contexts/BranchContext';
import AssistantChatButton from '../ai/AssistantChatButton';
import { useAuth } from '../../contexts/AuthContext';

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
    const context = user ? { role: user.roles?.[0]?.name, name: user.name } : {};

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
                    <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(true)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 lg:hidden"
                            aria-label="Abrir menu"
                        >
                            <Menu size={20} />
                        </button>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">Sistema Clinico</p>
                            <p className="truncate text-xs text-gray-500">Accesos rapidos, pacientes y operacion diaria</p>
                        </div>
                    </div>
                    <BranchSelector />
                </header>
                <main className="flex-1 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
            {/* Floating AI assistant — available throughout the app */}
            <AssistantChatButton context={context} />
        </div>
    );
}
