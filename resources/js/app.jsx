import './bootstrap';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { SettingsProvider } from './contexts/SettingsContext';
import { router } from './router/index';

createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <AuthProvider>
            <SettingsProvider>
                <ToastProvider>
                    <RouterProvider router={router} />
                </ToastProvider>
            </SettingsProvider>
        </AuthProvider>
    </React.StrictMode>
);
