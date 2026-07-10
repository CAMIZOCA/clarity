export const DEFAULT_MENU_VISIBLE_SECTIONS = [
    'atencion_clinica',
    'operacion_diaria',
    'inventario',
];

export const MENU_SECTION_OPTIONS = [
    {
        key: 'atencion_clinica',
        label: 'Atencion clinica',
        description: 'Pacientes, consulta, agenda, ordenes, lentes especiales, oftalmologia y brigadas.',
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
        { key: 'pacientes', label: 'Pacientes' },
        { key: 'consulta', label: 'Consulta' },
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
