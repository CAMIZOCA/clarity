<?php

namespace App\Enums;

enum Permission: string
{
    // ─── PACIENTES ───────────────────────────────────────
    case PATIENTS_VIEW   = 'patients.view';
    case PATIENTS_CREATE = 'patients.create';
    case PATIENTS_EDIT   = 'patients.edit';
    case PATIENTS_DELETE = 'patients.delete';
    case PATIENTS_EXPORT = 'patients.export';
    case PATIENTS_VIEW_CLINICAL = 'patients.view_clinical';  // Ver datos clínicos sensibles

    // ─── CONSULTAS CLÍNICAS ───────────────────────────────
    case CONSULTATIONS_VIEW   = 'consultations.view';
    case CONSULTATIONS_CREATE = 'consultations.create';
    case CONSULTATIONS_EDIT   = 'consultations.edit';
    case CONSULTATIONS_DELETE = 'consultations.delete';
    case CONSULTATIONS_PDF    = 'consultations.generate_pdf';

    // ─── AGENDA / CITAS ───────────────────────────────────
    case APPOINTMENTS_VIEW   = 'appointments.view';
    case APPOINTMENTS_CREATE = 'appointments.create';
    case APPOINTMENTS_EDIT   = 'appointments.edit';
    case APPOINTMENTS_DELETE = 'appointments.delete';

    // ─── VENTAS / POS ─────────────────────────────────────
    case SALES_VIEW           = 'sales.view';
    case SALES_CREATE         = 'sales.create';
    case SALES_EDIT           = 'sales.edit';
    case SALES_CANCEL         = 'sales.cancel';
    case SALES_REFUND         = 'sales.refund';
    case SALES_APPLY_DISCOUNT = 'sales.apply_discount';
    case SALES_DISCOUNT_LIMIT = 'sales.discount_over_limit';  // Descuentos sobre el límite
    case SALES_VIEW_COST      = 'sales.view_cost_price';      // Ver precio de costo
    case SALES_EXPORT         = 'sales.export';

    // ─── PRODUCTOS / INVENTARIO ───────────────────────────
    case PRODUCTS_VIEW        = 'products.view';
    case PRODUCTS_CREATE      = 'products.create';
    case PRODUCTS_EDIT        = 'products.edit';
    case PRODUCTS_DELETE      = 'products.delete';
    case INVENTORY_VIEW       = 'inventory.view';
    case INVENTORY_ADJUST     = 'inventory.adjust';
    case INVENTORY_TRANSFER   = 'inventory.transfer';
    case INVENTORY_COUNT      = 'inventory.physical_count';
    case PURCHASES_VIEW       = 'purchases.view';
    case PURCHASES_CREATE     = 'purchases.create';

    // ─── LABORATORIO ──────────────────────────────────────
    case LAB_ORDERS_VIEW    = 'lab_orders.view';
    case LAB_ORDERS_CREATE  = 'lab_orders.create';
    case LAB_ORDERS_EDIT    = 'lab_orders.edit';
    case LAB_ORDERS_MANAGE  = 'lab_orders.manage_status';   // Cambiar estados
    case LAB_ORDERS_DELETE  = 'lab_orders.delete';

    // ─── CAJA ─────────────────────────────────────────────
    case CASH_VIEW            = 'cash.view';
    case CASH_OPEN            = 'cash.open';
    case CASH_CLOSE           = 'cash.close';
    case CASH_REGISTER_EXPENSES = 'cash.register_expenses';
    case CASH_VIEW_ALL        = 'cash.view_all_sessions';   // Ver sesiones de otros

    // ─── PROVEEDORES ──────────────────────────────────────
    case SUPPLIERS_VIEW   = 'suppliers.view';
    case SUPPLIERS_CREATE = 'suppliers.create';
    case SUPPLIERS_EDIT   = 'suppliers.edit';
    case SUPPLIERS_DELETE = 'suppliers.delete';

    // ─── CRM / CAMPAÑAS ───────────────────────────────────
    case CRM_VIEW           = 'crm.view';
    case CRM_SEND_MESSAGES  = 'crm.send_messages';
    case CRM_CAMPAIGNS      = 'crm.manage_campaigns';
    case CRM_EXPORT_CONTACTS = 'crm.export_contacts';

    // ─── REPORTES ─────────────────────────────────────────
    case REPORTS_CLINICAL   = 'reports.clinical';
    case REPORTS_SALES      = 'reports.sales';
    case REPORTS_FINANCIAL  = 'reports.financial';         // Reporte de utilidad, caja
    case REPORTS_INVENTORY  = 'reports.inventory';
    case REPORTS_EXPORT     = 'reports.export';

    // ─── CONFIGURACIÓN / ADMIN ────────────────────────────
    case SETTINGS_VIEW   = 'settings.view';
    case SETTINGS_EDIT   = 'settings.edit';
    case USERS_VIEW      = 'users.view';
    case USERS_CREATE    = 'users.create';
    case USERS_EDIT      = 'users.edit';
    case USERS_DELETE    = 'users.delete';
    case AUDIT_VIEW      = 'audit.view';                   // Ver logs de auditoría
    case BRANCHES_MANAGE = 'branches.manage';
    case SYSTEM_MAINTENANCE = 'system.maintenance';

    // ─── BRIGADAS Y MÓDULOS ESPECIALES ────────────────────
    case BRIGADES_VIEW    = 'brigades.view';
    case BRIGADES_MANAGE  = 'brigades.manage';
    case SPECIAL_LENSES_VIEW   = 'special_lenses.view';
    case SPECIAL_LENSES_MANAGE = 'special_lenses.manage';
    case REFERENCES_VIEW   = 'references.view';
    case REFERENCES_MANAGE = 'references.manage';
    case GUARANTEE_REPORTS_VIEW   = 'guarantee_reports.view';
    case GUARANTEE_REPORTS_MANAGE = 'guarantee_reports.manage';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public static function forRole(Role $role): array
    {
        return match($role) {
            Role::ADMIN => self::values(), // Admin tiene todos los permisos

            Role::OPTOMETRA => [
                self::PATIENTS_VIEW->value,
                self::PATIENTS_CREATE->value,
                self::PATIENTS_EDIT->value,
                self::PATIENTS_VIEW_CLINICAL->value,
                self::CONSULTATIONS_VIEW->value,
                self::CONSULTATIONS_CREATE->value,
                self::CONSULTATIONS_EDIT->value,
                self::CONSULTATIONS_PDF->value,
                self::APPOINTMENTS_VIEW->value,
                self::APPOINTMENTS_CREATE->value,
                self::APPOINTMENTS_EDIT->value,
                self::BRIGADES_VIEW->value,
                self::BRIGADES_MANAGE->value,
                self::SPECIAL_LENSES_VIEW->value,
                self::SPECIAL_LENSES_MANAGE->value,
                self::REFERENCES_VIEW->value,
                self::REFERENCES_MANAGE->value,
                self::GUARANTEE_REPORTS_VIEW->value,
                self::GUARANTEE_REPORTS_MANAGE->value,
                self::REPORTS_CLINICAL->value,
            ],

            Role::RECEPCIONISTA => [
                self::PATIENTS_VIEW->value,
                self::PATIENTS_CREATE->value,
                self::PATIENTS_EDIT->value,
                self::APPOINTMENTS_VIEW->value,
                self::APPOINTMENTS_CREATE->value,
                self::APPOINTMENTS_EDIT->value,
                self::APPOINTMENTS_DELETE->value,
                self::BRIGADES_VIEW->value,
                self::REFERENCES_VIEW->value,
                self::GUARANTEE_REPORTS_VIEW->value,
                self::REPORTS_CLINICAL->value,
                self::CRM_VIEW->value,
            ],

            Role::VENDEDOR => [
                self::PATIENTS_VIEW->value,
                self::PATIENTS_CREATE->value,
                self::PATIENTS_EDIT->value,
                self::CONSULTATIONS_VIEW->value,           // Ver recetas para vender
                self::APPOINTMENTS_VIEW->value,
                self::APPOINTMENTS_CREATE->value,
                self::SALES_VIEW->value,
                self::SALES_CREATE->value,
                self::SALES_EDIT->value,
                self::SALES_APPLY_DISCOUNT->value,
                self::PRODUCTS_VIEW->value,
                self::INVENTORY_VIEW->value,
                self::LAB_ORDERS_VIEW->value,
                self::LAB_ORDERS_CREATE->value,
                self::GUARANTEE_REPORTS_VIEW->value,
                self::GUARANTEE_REPORTS_MANAGE->value,
                self::CRM_VIEW->value,
            ],

            Role::CAJERO => [
                self::PATIENTS_VIEW->value,
                self::SALES_VIEW->value,
                self::SALES_CREATE->value,
                self::CASH_VIEW->value,
                self::CASH_OPEN->value,
                self::CASH_CLOSE->value,
                self::CASH_REGISTER_EXPENSES->value,
                self::REPORTS_SALES->value,
                self::LAB_ORDERS_VIEW->value,
            ],

            Role::ENCARGADO_LAB => [
                self::PATIENTS_VIEW->value,
                self::CONSULTATIONS_VIEW->value,
                self::LAB_ORDERS_VIEW->value,
                self::LAB_ORDERS_CREATE->value,
                self::LAB_ORDERS_EDIT->value,
                self::LAB_ORDERS_MANAGE->value,
                self::SALES_VIEW->value,
                self::REPORTS_CLINICAL->value,
            ],
        };
    }
}
