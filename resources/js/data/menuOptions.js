export const DEFAULT_MENU_VISIBLE_SECTIONS = [
    'atencion_clinica',
    'operacion_diaria',
    'inventario',
];

export const MENU_SECTION_OPTIONS = [
    {
        key: 'atencion_clinica',
        label: 'Atencion clinica',
        description: 'Pacientes, agenda, ordenes, lentes especiales, oftalmologia y brigadas.',
    },
    {
        key: 'operacion_diaria',
        label: 'Operacion diaria',
        description: 'Ventas / POS, historial de ventas, caja y laboratorio.',
    },
    {
        key: 'inventario',
        label: 'Inventario',
        description: 'Productos, stock y movimientos.',
    },
    {
        key: 'comercial',
        label: 'Comercial',
        description: 'Campanas, plantillas y recordatorios.',
    },
    {
        key: 'reportes',
        label: 'Reportes',
        description: 'Reportes clinicos, comerciales y dashboard gerencial.',
    },
];

export const MENU_ITEM_OPTIONS_BY_SECTION = {
    atencion_clinica: [
        // `consulta` ya no es un item del menu: se entra desde la ficha del
        // paciente. La clave sigue en la lista blanca de `SettingController`
        // porque el valor guardado en `settings.menu_visible_items` la conserva.
        { key: 'pacientes', label: 'Pacientes' },
        { key: 'agenda', label: 'Agenda' },
        { key: 'ordenes_trabajo', label: 'Ordenes de trabajo' },
        { key: 'lentes_especiales', label: 'Lentes especiales' },
        { key: 'referencias', label: 'Oftalmologia' },
        { key: 'brigadas', label: 'Brigadas' },
    ],
    operacion_diaria: [
        { key: 'pos', label: 'Ventas / POS' },
        { key: 'ventas', label: 'Historial de ventas' },
        { key: 'caja', label: 'Caja' },
        { key: 'laboratorio', label: 'Laboratorio' },
    ],
    inventario: [
        { key: 'inventario_productos', label: 'Productos' },
        { key: 'inventario_stock', label: 'Stock' },
        { key: 'inventario_movimientos', label: 'Movimientos' },
    ],
    comercial: [
        { key: 'crm_campanas', label: 'Campanas' },
        { key: 'crm_plantillas', label: 'Plantillas' },
        { key: 'crm_recordatorios', label: 'Recordatorios' },
    ],
    reportes: [
        { key: 'reportes_clinicos', label: 'Reportes clinicos' },
        { key: 'reportes_comerciales', label: 'Reportes comerciales' },
        { key: 'dashboard_gerencial', label: 'Dashboard gerencial' },
    ],
};

export const DEFAULT_MENU_VISIBLE_ITEMS = Object.values(MENU_ITEM_OPTIONS_BY_SECTION).flatMap((items) =>
    items.map((item) => item.key)
);

/**
 * Permiso que pide cada item del menu; un array basta con uno. La misma tabla
 * protege la ruta (`RequirePermission` en el router): menu y URL no pueden
 * desalinearse. El servidor vuelve a comprobarlo en cada endpoint.
 */
export const MENU_ITEM_PERMISSIONS = {
    pacientes: 'patients.view',
    agenda: 'appointments.view',
    ordenes_trabajo: 'lab_orders.create',
    lentes_especiales: 'special_lenses.view',
    referencias: 'references.view',
    brigadas: 'brigades.view',
    pos: 'sales.create',
    ventas: 'sales.view',
    caja: 'cash.view',
    laboratorio: 'lab_orders.view',
    inventario_productos: 'products.view',
    inventario_stock: 'inventory.view',
    inventario_movimientos: 'inventory.view',
    crm_campanas: 'crm.view',
    crm_plantillas: 'crm.view',
    crm_recordatorios: 'crm.view',
    reportes_clinicos: 'reports.clinical',
    reportes_comerciales: ['reports.sales', 'reports.financial', 'reports.inventory'],
    dashboard_gerencial: 'reports.financial',
};

/** `permission` puede ser un string o un array (alcanza con uno). */
export function hasAnyPermission(can, permission) {
    if (!permission) return true;
    return (Array.isArray(permission) ? permission : [permission]).some((p) => can(p));
}

export function canUseMenuItem(can, item) {
    return hasAnyPermission(can, MENU_ITEM_PERMISSIONS[item]);
}
