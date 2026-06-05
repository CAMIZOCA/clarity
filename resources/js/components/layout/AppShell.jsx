import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useBranch } from '../../contexts/BranchContext';
import AssistantChatButton from '../ai/AssistantChatButton';
import { useAuth } from '../../contexts/AuthContext';

function BranchSelector() {
    const { branches, activeBranch, switchBranch } = useBranch();

    if (branches.length <= 1) return null;

    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200">
            <span className="text-xs text-gray-500 font-medium">Sucursal:</span>
            <select
                value={activeBranch?.id || ''}
                onChange={(e) => {
                    const branch = branches.find(b => b.id === parseInt(e.target.value));
                    if (branch) switchBranch(branch);
                }}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
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
    const context = user ? { role: user.roles?.[0]?.name, name: user.name } : {};

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <BranchSelector />
                <main className="flex-1 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
            {/* Floating AI assistant — available throughout the app */}
            <AssistantChatButton context={context} />
        </div>
    );
}
