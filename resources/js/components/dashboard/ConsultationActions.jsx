import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const STYLES = {
    light: {
        history: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
        sell: 'bg-[#1a2a4a] text-white hover:bg-[#253d6b]',
        sold: 'bg-green-50 text-green-800',
    },
    // Sobre el encabezado azul de la tarjeta destacada.
    dark: {
        history: 'border border-white/40 text-white hover:bg-white/10',
        sell: 'bg-white text-[#1a2a4a] hover:bg-gray-100',
        sold: 'bg-green-500/25 text-green-100',
    },
};

/** "Abrir historia" e "Iniciar venta" (ligada a la consulta) para una consulta del resumen. */
export default function ConsultationActions({ item, onDark = false }) {
    const { can } = useAuth();
    const styles = STYLES[onDark ? 'dark' : 'light'];
    const sellUrl = `/pos?paciente=${item.patient.id}&consulta=${item.id}`;

    return (
        <div className="flex flex-wrap gap-2">
            {can('consultations.view') && (
                <Link
                    to={`/consulta/${item.id}`}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${styles.history}`}
                >
                    <FileText size={16} /> Abrir historia
                </Link>
            )}
            {can('sales.create') && !item.sale_id && (
                <Link
                    to={sellUrl}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${styles.sell}`}
                >
                    <ShoppingCart size={16} /> Iniciar venta
                </Link>
            )}
            {item.sale_id && (
                <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${styles.sold}`}>
                    <ShoppingCart size={16} /> Venta iniciada
                </span>
            )}
        </div>
    );
}
