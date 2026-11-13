/**
 * Titulo de la barra superior en la plantilla Compacto (orientacion: "donde
 * estoy"). Se elige el prefijo mas largo que coincida con la ruta.
 */
const ROUTE_TITLES = [
    ['/dashboard-gerencial', 'Dashboard gerencial'],
    ['/dashboard', 'Inicio'],
    ['/pacientes/nuevo', 'Nuevo paciente'],
    ['/pacientes', 'Pacientes'],
    ['/consulta', 'Consulta'],
    ['/agenda', 'Agenda'],
    ['/ordenes-trabajo', 'Órdenes de trabajo'],
    ['/lentes-especiales', 'Lentes especiales'],
    ['/referencias', 'Oftalmología'],
    ['/brigadas', 'Brigadas'],
    ['/pos', 'Ventas'],
    ['/ventas', 'Historial de ventas'],
    ['/caja', 'Caja'],
    ['/laboratorio', 'Laboratorio'],
    ['/inventario/productos', 'Productos'],
    ['/inventario/stock', 'Stock'],
    ['/inventario/movimientos', 'Movimientos'],
    ['/crm/campanas', 'Campañas'],
    ['/crm/plantillas', 'Plantillas'],
    ['/crm/recordatorios', 'Recordatorios'],
    ['/reportes-comerciales', 'Reportes comerciales'],
    ['/reportes', 'Reportes clínicos'],
    ['/informes-garantia', 'Informes de garantía'],
    ['/configuracion', 'Configuración'],
    ['/usuarios', 'Usuarios'],
    ['/catalogos', 'Catálogos'],
    ['/admin/sucursales', 'Sucursales'],
    ['/admin/bodegas', 'Bodegas'],
    ['/admin/mantenimiento', 'Backups'],
    ['/perfil', 'Mi perfil'],
    ['/ayuda', 'Ayuda'],
];

export function routeTitle(pathname) {
    if (/^\/pacientes\/\d+\/editar/.test(pathname)) return 'Editar paciente';
    if (/^\/pacientes\/\d+/.test(pathname)) return 'Ficha del paciente';
    const match = ROUTE_TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`));
    return match ? match[1] : 'Sistema Clínico';
}
