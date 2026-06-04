import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppShell from '../components/layout/AppShell';

// Pages (lazy loaded)
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const PatientListPage = lazy(() => import('../pages/patients/PatientListPage'));
const PatientFormPage = lazy(() => import('../pages/patients/PatientFormPage'));
const PatientDetailPage = lazy(() => import('../pages/patients/PatientDetailPage'));
const ConsultationPage = lazy(() => import('../pages/consultations/ConsultationPage'));
const GuaranteeReportFormPage = lazy(() => import('../pages/guaranteeReports/GuaranteeReportFormPage'));
const AgendaPage = lazy(() => import('../pages/agenda/AgendaPage'));
const BrigadeListPage = lazy(() => import('../pages/brigades/BrigadeListPage'));
const BrigadeFormPage = lazy(() => import('../pages/brigades/BrigadeFormPage'));
const BrigadeDetailPage = lazy(() => import('../pages/brigades/BrigadeDetailPage'));
const SpecialLensListPage = lazy(() => import('../pages/specialLenses/SpecialLensListPage'));
const SpecialLensFormPage = lazy(() => import('../pages/specialLenses/SpecialLensFormPage'));
const ReferenceListPage = lazy(() => import('../pages/references/ReferenceListPage'));
const ReferenceFormPage = lazy(() => import('../pages/references/ReferenceFormPage'));
const UserListPage = lazy(() => import('../pages/users/UserListPage'));
const UserFormPage = lazy(() => import('../pages/users/UserFormPage'));
const ReportsPage = lazy(() => import('../pages/reports/ReportsPage'));
const ProfilePage = lazy(() => import('../pages/profile/ProfilePage'));
const SettingsPage = lazy(() => import('../pages/settings/SettingsPage'));
const CatalogPage = lazy(() => import('../pages/catalog/CatalogPage'));
const HelpPage = lazy(() => import('../pages/help/HelpPage'));
const OrdenTrabajoPage = lazy(() => import('../pages/ordenes/OrdenTrabajoPage'));

const Loader = () => (
    <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-10 w-10 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
    </div>
);

function PrivateRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <Loader />;
    if (!user) return <Navigate to="/login" replace />;
    return children;
}

function PublicRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <Loader />;
    if (user) return <Navigate to="/consulta" replace />;
    return children;
}

function wrap(Component) {
    return (
        <PrivateRoute>
            <Suspense fallback={<Loader />}>
                <Component />
            </Suspense>
        </PrivateRoute>
    );
}

export const router = createBrowserRouter([
    {
        path: '/login',
        element: (
            <PublicRoute>
                <Suspense fallback={<Loader />}>
                    <LoginPage />
                </Suspense>
            </PublicRoute>
        ),
    },
    {
        path: '/',
        element: <PrivateRoute><AppShell /></PrivateRoute>,
        children: [
            { index: true, element: <Navigate to="/dashboard" replace /> },
            { path: 'dashboard', element: wrap(DashboardPage) },
            { path: 'consulta', element: wrap(ConsultationPage) },
            { path: 'consulta/:consultationId', element: wrap(ConsultationPage) },
            { path: 'pacientes', element: wrap(PatientListPage) },
            { path: 'pacientes/nuevo', element: wrap(PatientFormPage) },
            { path: 'pacientes/:id', element: wrap(PatientDetailPage) },
            { path: 'pacientes/:id/editar', element: wrap(PatientFormPage) },
            { path: 'informes-garantia/nuevo', element: wrap(GuaranteeReportFormPage) },
            { path: 'informes-garantia/:id/editar', element: wrap(GuaranteeReportFormPage) },
            { path: 'agenda', element: wrap(AgendaPage) },
            { path: 'brigadas', element: wrap(BrigadeListPage) },
            { path: 'brigadas/nueva', element: wrap(BrigadeFormPage) },
            { path: 'brigadas/:id', element: wrap(BrigadeDetailPage) },
            { path: 'brigadas/:id/editar', element: wrap(BrigadeFormPage) },
            { path: 'lentes-especiales', element: wrap(SpecialLensListPage) },
            { path: 'lentes-especiales/nuevo', element: wrap(SpecialLensFormPage) },
            { path: 'lentes-especiales/:id/editar', element: wrap(SpecialLensFormPage) },
            { path: 'referencias', element: wrap(ReferenceListPage) },
            { path: 'referencias/nueva', element: wrap(ReferenceFormPage) },
            { path: 'referencias/:id/editar', element: wrap(ReferenceFormPage) },
            { path: 'usuarios', element: wrap(UserListPage) },
            { path: 'usuarios/nuevo', element: wrap(UserFormPage) },
            { path: 'usuarios/:id/editar', element: wrap(UserFormPage) },
            { path: 'reportes', element: wrap(ReportsPage) },
            { path: 'perfil', element: wrap(ProfilePage) },
            { path: 'configuracion', element: wrap(SettingsPage) },
            { path: 'catalogos', element: wrap(CatalogPage) },
            { path: 'ayuda', element: wrap(HelpPage) },
            { path: 'ordenes-trabajo', element: wrap(OrdenTrabajoPage) },
        ],
    },
    { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
