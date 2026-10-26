import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppShell from '../components/layout/AppShell';
import RequirePermission from '../components/auth/RequirePermission';
import { MENU_ITEM_PERMISSIONS } from '../data/menuOptions';

// Pages (lazy loaded)
const LandingPage = lazy(() => import('../pages/LandingPage'));
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const PatientListPage = lazy(() => import('../pages/patients/PatientListPage'));
const PatientFormPage = lazy(() => import('../pages/patients/PatientFormPage'));
const PatientDetailPage = lazy(() => import('../pages/patients/PatientDetailPage'));
const ConsultationPage = lazy(() => import('../pages/consultations/ConsultationPage'));
const ConsultationViewPage = lazy(() => import('../pages/consultations/ConsultationViewPage'));
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
const ProductListPage = lazy(() => import('../pages/inventory/ProductListPage'));
const ProductFormPage = lazy(() => import('../pages/inventory/ProductFormPage'));
const ProductDetailPage = lazy(() => import('../pages/inventory/ProductDetailPage'));
const StockPage = lazy(() => import('../pages/inventory/StockPage'));
const PosPage = lazy(() => import('../pages/pos/PosPage'));
const SalesHistoryPage = lazy(() => import('../pages/pos/SalesHistoryPage'));
const LabOrdersPage = lazy(() => import('../pages/laboratory/LabOrdersPage'));
const CashRegisterPage = lazy(() => import('../pages/cash/CashRegisterPage'));
const GerencialDashboard = lazy(() => import('../pages/dashboard/GerencialDashboard'));
const CommercialReportsPage = lazy(() => import('../pages/reports/CommercialReportsPage'));
const CampaignPage = lazy(() => import('../pages/crm/CampaignPage'));
const TemplatePage = lazy(() => import('../pages/crm/TemplatePage'));
const RemindersPage = lazy(() => import('../pages/crm/RemindersPage'));
const BranchesPage = lazy(() => import('../pages/admin/BranchesPage'));
const WarehousesPage = lazy(() => import('../pages/admin/WarehousesPage'));
const MaintenancePage = lazy(() => import('../pages/admin/MaintenancePage'));

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

function RootRoute() {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <Loader />;

    if (!user) {
        if (location.pathname === '/') {
            return (
                <Suspense fallback={<Loader />}>
                    <LandingPage />
                </Suspense>
            );
        }

        return <Navigate to="/login" replace />;
    }

    if (location.pathname === '/') return <Navigate to="/dashboard" replace />;

    return <AppShell />;
}

function PublicRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <Loader />;
    if (user) return <Navigate to="/pacientes" replace />;
    return children;
}

/**
 * `permission`: string o array (alcanza con uno). Escribir la URL a mano no
 * abre una pantalla que el menu no muestra.
 */
function wrap(Component, permission = null) {
    return (
        <PrivateRoute>
            <RequirePermission permission={permission}>
                <Suspense fallback={<Loader />}>
                    <Component />
                </Suspense>
            </RequirePermission>
        </PrivateRoute>
    );
}

const P = MENU_ITEM_PERMISSIONS;

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
        element: <RootRoute />,
        children: [
            { path: 'dashboard', element: wrap(DashboardPage) },
            { path: 'consulta', element: wrap(ConsultationPage) },
            { path: 'consulta/:consultationId', element: wrap(ConsultationPage, 'consultations.view') },
            { path: 'consulta/:consultationId/ver', element: wrap(ConsultationViewPage, 'consultations.view') },
            { path: 'pacientes', element: wrap(PatientListPage, P.pacientes) },
            { path: 'pacientes/nuevo', element: wrap(PatientFormPage, 'patients.create') },
            { path: 'pacientes/:id', element: wrap(PatientDetailPage, P.pacientes) },
            { path: 'pacientes/:id/editar', element: wrap(PatientFormPage, 'patients.edit') },
            { path: 'informes-garantia/nuevo', element: wrap(GuaranteeReportFormPage) },
            { path: 'informes-garantia/:id/editar', element: wrap(GuaranteeReportFormPage) },
            { path: 'agenda', element: wrap(AgendaPage, P.agenda) },
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
            { path: 'usuarios', element: wrap(UserListPage, 'users.view') },
            { path: 'usuarios/nuevo', element: wrap(UserFormPage, 'users.create') },
            { path: 'usuarios/:id/editar', element: wrap(UserFormPage, 'users.edit') },
            { path: 'reportes', element: wrap(ReportsPage, P.reportes_clinicos) },
            { path: 'perfil', element: wrap(ProfilePage) },
            { path: 'configuracion', element: wrap(SettingsPage, 'settings.edit') },
            { path: 'catalogos', element: wrap(CatalogPage, 'settings.edit') },
            { path: 'ayuda', element: wrap(HelpPage) },
            { path: 'ordenes-trabajo', element: wrap(OrdenTrabajoPage, P.ordenes_trabajo) },
            { path: 'inventario/productos', element: wrap(ProductListPage, P.inventario_productos) },
            { path: 'inventario/productos/nuevo', element: wrap(ProductFormPage, 'products.create') },
            { path: 'inventario/productos/:id', element: wrap(ProductDetailPage, P.inventario_productos) },
            { path: 'inventario/productos/:id/editar', element: wrap(ProductFormPage, 'products.edit') },
            { path: 'inventario/stock', element: wrap(StockPage, P.inventario_stock) },
            { path: 'inventario/movimientos', element: wrap(StockPage, P.inventario_movimientos) },
            { path: 'pos', element: wrap(PosPage, P.pos) },
            { path: 'ventas', element: wrap(SalesHistoryPage, P.ventas) },
            { path: 'laboratorio', element: wrap(LabOrdersPage, P.laboratorio) },
            { path: 'caja', element: wrap(CashRegisterPage, P.caja) },
            { path: 'dashboard-gerencial', element: wrap(GerencialDashboard, P.dashboard_gerencial) },
            { path: 'reportes-comerciales', element: wrap(CommercialReportsPage, P.reportes_comerciales) },
            { path: 'crm/campanas', element: wrap(CampaignPage, P.crm_campanas) },
            { path: 'crm/plantillas', element: wrap(TemplatePage, P.crm_plantillas) },
            { path: 'crm/recordatorios', element: wrap(RemindersPage, P.crm_recordatorios) },
            { path: 'admin/sucursales', element: wrap(BranchesPage, 'branches.manage') },
            { path: 'admin/bodegas', element: wrap(WarehousesPage, 'branches.manage') },
            { path: 'admin/mantenimiento', element: wrap(MaintenancePage, 'system.maintenance') },
        ],
    },
    { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
