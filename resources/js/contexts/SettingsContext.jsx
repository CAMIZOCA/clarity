import React, { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client';

const SettingsContext = createContext({});

const DEFAULT_MENU_VISIBLE_SECTIONS = [
    'atencion_clinica',
    'operacion_diaria',
    'inventario',
    'comercial',
    'reportes',
];

function parseJsonArray(value, fallback = []) {
    if (Array.isArray(value)) return value;

    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState({
        clinic_name: 'Clínica Optométrica',
        clinic_tagline: 'Cuidando tu visión',
        clinic_address: '',
        clinic_phone: '',
        clinic_logo: '',
        required_fields: [],
        menu_visible_sections: DEFAULT_MENU_VISIBLE_SECTIONS,
    });

    useEffect(() => {
        client.get('/settings').then(r => {
            const data = r.data;
            setSettings(prev => ({
                ...prev,
                ...data,
                required_fields: parseJsonArray(data.required_fields),
                menu_visible_sections: parseJsonArray(data.menu_visible_sections, DEFAULT_MENU_VISIBLE_SECTIONS),
            }));
        }).catch(() => {});
    }, []);

    const refresh = () => {
        client.get('/settings').then(r => {
            const data = r.data;
            setSettings(prev => ({
                ...prev,
                ...data,
                required_fields: parseJsonArray(data.required_fields),
                menu_visible_sections: parseJsonArray(data.menu_visible_sections, DEFAULT_MENU_VISIBLE_SECTIONS),
            }));
        }).catch(() => {});
    };

    const logoUrl = settings.clinic_logo
        ? `/storage/${settings.clinic_logo}`
        : null;

    return (
        <SettingsContext.Provider value={{ settings, logoUrl, refresh }}>
            {children}
        </SettingsContext.Provider>
    );
}

export const useSettings = () => useContext(SettingsContext);
