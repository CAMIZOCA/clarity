import React, { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client';
import { DEFAULT_MENU_VISIBLE_ITEMS, DEFAULT_MENU_VISIBLE_SECTIONS } from '../data/menuOptions';

const SettingsContext = createContext({});

function parseJsonArray(value, fallback = [], fallbackWhenEmpty = false) {
    if (Array.isArray(value)) return value;

    try {
        const parsed = JSON.parse(value || '[]');
        if (fallbackWhenEmpty && Array.isArray(parsed) && parsed.length === 0) {
            return fallback;
        }

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
        menu_visible_items: DEFAULT_MENU_VISIBLE_ITEMS,
    });

    useEffect(() => {
        client.get('/settings').then(r => {
            const data = r.data;
            setSettings(prev => ({
                ...prev,
                ...data,
                required_fields: parseJsonArray(data.required_fields),
                menu_visible_sections: parseJsonArray(data.menu_visible_sections, DEFAULT_MENU_VISIBLE_SECTIONS, true),
                menu_visible_items: parseJsonArray(data.menu_visible_items, DEFAULT_MENU_VISIBLE_ITEMS, true),
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
                menu_visible_sections: parseJsonArray(data.menu_visible_sections, DEFAULT_MENU_VISIBLE_SECTIONS, true),
                menu_visible_items: parseJsonArray(data.menu_visible_items, DEFAULT_MENU_VISIBLE_ITEMS, true),
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
