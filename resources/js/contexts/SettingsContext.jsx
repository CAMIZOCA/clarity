import React, { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client';

const SettingsContext = createContext({});

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState({
        clinic_name: 'Clínica Optométrica',
        clinic_tagline: 'Cuidando tu visión',
        clinic_address: '',
        clinic_phone: '',
        clinic_logo: '',
        required_fields: [],
    });

    useEffect(() => {
        client.get('/settings').then(r => {
            const data = r.data;
            setSettings(prev => ({
                ...prev,
                ...data,
                required_fields: (() => {
                    try { return JSON.parse(data.required_fields || '[]'); }
                    catch { return []; }
                })(),
            }));
        }).catch(() => {});
    }, []);

    const refresh = () => {
        client.get('/settings').then(r => {
            const data = r.data;
            setSettings(prev => ({
                ...prev,
                ...data,
                required_fields: (() => {
                    try { return JSON.parse(data.required_fields || '[]'); }
                    catch { return []; }
                })(),
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
