import React from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { hasAnyPermission } from '../../data/menuOptions';

/**
 * Muestra la pagina solo si el usuario tiene el permiso (string o array: basta
 * uno). Es para no dejar una pantalla a medias llena de 403: quien de verdad
 * protege los datos es el servidor.
 */
export default function RequirePermission({ permission, children }) {
    const { can } = useAuth();

    if (hasAnyPermission(can, permission)) return children;

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <Lock size={28} className="mx-auto mb-3 text-slate-400" />
                <p className="font-semibold text-gray-900">No tiene acceso a esta sección</p>
                <p className="mt-1 text-sm text-gray-500">Si lo necesita, pida al administrador que revise los permisos de su usuario.</p>
                <Link to="/dashboard" className="mt-4 inline-block text-sm font-medium text-[#1a2a4a] underline underline-offset-2">
                    Volver al resumen
                </Link>
            </div>
        </div>
    );
}
