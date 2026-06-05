import {
    Activity,
    BarChart3,
    Bell,
    Building2,
    CalendarCheck,
    CheckCircle2,
    ClipboardList,
    DollarSign,
    Eye,
    FileCheck2,
    FlaskConical,
    LockKeyhole,
    Megaphone,
    PackageCheck,
    ShieldCheck,
    ShoppingCart,
    Sparkles,
    Stethoscope,
    Users,
    Warehouse,
} from 'lucide-react';

export const landingContent = {
    product: {
        name: 'Clarity',
        descriptor: 'Sistema de gestion para opticas y centros optometricos',
        tagline: 'Vision clara para operar, vender y atender mejor.',
        demoEmail: 'ventas@clarity.local',
    },
    nav: [
        { label: 'Funciones', href: '#funciones' },
        { label: 'Beneficios', href: '#beneficios' },
        { label: 'Modulos', href: '#modulos' },
        { label: 'Como funciona', href: '#como-funciona' },
        { label: 'FAQ', href: '#faq' },
        { label: 'Contacto', href: '#demo' },
    ],
    hero: {
        eyebrow: 'Software SaaS para opticas modernas',
        title: 'Todo el control de tu optica, en una plataforma clara.',
        subtitle:
            'Gestiona pacientes, consultas, recetas, ventas, inventario, ordenes de laboratorio, caja, CRM, reportes y sucursales desde un sistema creado para la operacion optica.',
        trust: 'Basado en modulos reales del sistema: atencion clinica, operacion comercial, inventario y administracion.',
        primaryCta: 'Solicitar demostracion',
        secondaryCta: 'Iniciar sesion',
    },
    trustItems: [
        { icon: Eye, title: 'Disenado para opticas', text: 'Flujos clinicos, recetas, ordenes y productos opticos.' },
        { icon: Building2, title: 'Varias sucursales', text: 'Sucursales, bodegas y reportes comparativos.' },
        { icon: LockKeyhole, title: 'Acceso por roles', text: 'Usuarios, permisos y auditoria de actividad.' },
        { icon: BarChart3, title: 'Decision con datos', text: 'Reportes clinicos, comerciales, caja e inventario.' },
    ],
    problems: [
        {
            problem: 'Historias, recetas y compras dispersas',
            solution:
                'Centraliza el expediente del paciente con consultas, antecedentes, recetas, citas, referencias, lentes especiales y ventas asociadas.',
        },
        {
            problem: 'Inventario desactualizado o dificil de auditar',
            solution:
                'Controla productos, variantes, bodegas, existencias, movimientos, ajustes, transferencias y alertas de bajo stock.',
        },
        {
            problem: 'Ventas sin trazabilidad completa',
            solution:
                'Registra ventas, pagos, descuentos, saldos, cancelaciones, facturas y ordenes de laboratorio vinculadas al paciente.',
        },
        {
            problem: 'Poca visibilidad para gerencia',
            solution:
                'Consulta dashboard, reportes comerciales, reportes clinicos, ventas, caja, inventario, laboratorio y comparacion por sucursal.',
        },
    ],
    platformCards: [
        { icon: Users, label: 'Pacientes', text: 'Busqueda, registro, historial y seguimiento.' },
        { icon: Stethoscope, label: 'Consulta', text: 'Evaluacion optometrica, diagnosticos y prescripcion.' },
        { icon: ShoppingCart, label: 'POS', text: 'Ventas, pagos, descuentos y saldos.' },
        { icon: PackageCheck, label: 'Inventario', text: 'Productos, variantes, stock y movimientos.' },
        { icon: FlaskConical, label: 'Laboratorio', text: 'Ordenes, estados, proveedor e historial.' },
        { icon: Megaphone, label: 'CRM', text: 'Campanas, recordatorios y plantillas.' },
    ],
    modules: [
        {
            id: 'pacientes',
            icon: Users,
            title: 'Gestion de pacientes',
            problem: 'Evita buscar informacion entre papeles, hojas de calculo o sistemas separados.',
            benefit:
                'Cada atencion empieza con contexto: datos, antecedentes, citas, consultas, referencias, lentes especiales y compras vinculadas.',
            functions: ['Registro y edicion', 'Busqueda por datos clave', 'Historial de consultas', 'Resumen de ventas por paciente'],
            mockup: 'patient',
        },
        {
            id: 'clinica',
            icon: Stethoscope,
            title: 'Consultas optometricas y recetas',
            problem: 'Reduce errores al registrar medidas, diagnosticos, recomendaciones y documentos clinicos.',
            benefit:
                'El optometrista trabaja con un flujo estructurado para evaluar, prescribir, generar datos de PDF y mantener continuidad clinica.',
            functions: ['Consultas CRUD', 'Catalogos clinicos', 'CIE-10', 'PDF de consulta', 'Lentes especiales'],
            mockup: 'clinical',
        },
        {
            id: 'ventas',
            icon: ShoppingCart,
            title: 'Ventas, pagos y facturacion',
            problem: 'Conecta la venta con paciente, receta, productos, pagos y entrega.',
            benefit:
                'El equipo comercial puede vender con mas orden, aplicar descuentos autorizados, registrar pagos y mantener saldos visibles.',
            functions: ['Punto de venta', 'Historial de ventas', 'Pagos', 'Cancelaciones', 'Facturas y XML'],
            mockup: 'sales',
        },
        {
            id: 'inventario',
            icon: Warehouse,
            title: 'Inventario y productos',
            problem: 'Controla armazones, lentes, accesorios y productos con existencias por bodega.',
            benefit:
                'Detecta bajo stock, conoce el valor del inventario y registra ajustes o transferencias con trazabilidad.',
            functions: ['Productos y variantes', 'Codigo de barras', 'Stock', 'Movimientos', 'Transferencias', 'Proveedores'],
            mockup: 'inventory',
        },
        {
            id: 'laboratorio',
            icon: FlaskConical,
            title: 'Ordenes de laboratorio',
            problem: 'Da seguimiento a trabajos pendientes, materiales, fechas y estados sin perder observaciones tecnicas.',
            benefit:
                'Cada orden se asocia a paciente, venta, receta, proveedor, prioridad, medidas, fecha estimada e historial de cambios.',
            functions: ['Ordenes', 'Estados', 'Proveedores de laboratorio', 'Historial', 'Fecha estimada', 'Notas tecnicas'],
            mockup: 'lab',
        },
        {
            id: 'reportes',
            icon: BarChart3,
            title: 'Reportes e indicadores',
            problem: 'Evita decisiones a ciegas y cierres manuales lentos.',
            benefit:
                'Consulta indicadores de pacientes, consultas, ventas, inventario, caja, laboratorio y comparacion entre sucursales.',
            functions: ['Dashboard', 'Reportes clinicos', 'Ventas', 'Inventario', 'Caja', 'Exportaciones'],
            mockup: 'reports',
        },
    ],
    workflow: [
        { title: 'Configura la operacion', text: 'Crea sucursales, bodegas, usuarios, roles, catalogos y parametros del sistema.' },
        { title: 'Registra atencion e inventario', text: 'Carga pacientes, productos, variantes, citas, consultas y existencias.' },
        { title: 'Opera el dia a dia', text: 'Gestiona consulta, POS, pagos, laboratorio, caja, CRM y recordatorios.' },
        { title: 'Mide y mejora', text: 'Revisa reportes, exporta informacion y compara resultados por area o sucursal.' },
    ],
    roleBenefits: [
        { role: 'Propietario', icon: BarChart3, benefits: ['Control de ventas y caja', 'Reportes por sucursal', 'Seguimiento de rentabilidad'] },
        { role: 'Optometrista', icon: Stethoscope, benefits: ['Historial clinico', 'Consultas organizadas', 'Recetas y recomendaciones'] },
        { role: 'Vendedor', icon: ShoppingCart, benefits: ['Consulta de stock', 'Ventas asociadas a pacientes', 'Ordenes de laboratorio'] },
        { role: 'Administrador', icon: ShieldCheck, benefits: ['Usuarios y permisos', 'Configuracion', 'Auditoria y catalogos'] },
        { role: 'Encargado de laboratorio', icon: FlaskConical, benefits: ['Estados de orden', 'Fechas estimadas', 'Notas e historial'] },
        { role: 'Encargado de inventario', icon: PackageCheck, benefits: ['Existencias', 'Movimientos', 'Transferencias y bajo stock'] },
    ],
    beforeAfter: {
        before: ['Hojas de calculo aisladas', 'Recetas dificiles de encontrar', 'Stock sin trazabilidad', 'Reportes armados a mano'],
        after: ['Informacion centralizada', 'Historial por paciente', 'Inventario por bodegas', 'Indicadores comerciales y clinicos'],
    },
    additionalFeatures: [
        { icon: CalendarCheck, title: 'Agenda y citas', text: 'Citas con seguimiento y conteo de pendientes.' },
        { icon: Bell, title: 'Recordatorios', text: 'CRM con recordatorios, plantillas y campanas.' },
        { icon: DollarSign, title: 'Caja', text: 'Apertura, cierre, sesiones y gastos.' },
        { icon: FileCheck2, title: 'Garantias', text: 'Informes de garantia disponibles en el panel.' },
        { icon: ClipboardList, title: 'Catalogos', text: 'Catalogos clinicos y plantillas imprimibles.' },
        { icon: Activity, title: 'Auditoria', text: 'Registro de actividad para cambios relevantes.' },
    ],
    gallery: [
        { label: 'Dashboard', caption: 'Indicadores clinicos y operativos para revisar la jornada.' },
        { label: 'Pacientes', caption: 'Ficha con historial, contacto, citas y ventas asociadas.' },
        { label: 'Consulta', caption: 'Flujo optometrico con medidas, diagnostico y recomendaciones.' },
        { label: 'Inventario', caption: 'Stock por producto, variante, bodega y movimientos.' },
        { label: 'Laboratorio', caption: 'Seguimiento de ordenes, estados y fechas estimadas.' },
        { label: 'Reportes', caption: 'Ventas, caja, inventario, laboratorio y sucursales.' },
    ],
    faq: [
        {
            question: 'Para que tipo de opticas esta disenado Clarity?',
            answer: 'Para opticas independientes, cadenas, centros optometricos y consultorios que atienden pacientes, venden productos opticos y necesitan controlar operacion diaria.',
        },
        {
            question: 'Puedo gestionar varias sucursales?',
            answer: 'Si. El proyecto incluye sucursales, bodegas, selector de sucursal, inventario y reportes comparativos por ubicacion.',
        },
        {
            question: 'Permite registrar pacientes y recetas?',
            answer: 'Si. Incluye pacientes, consultas, historial, datos clinicos, diagnosticos, catalogos, CIE-10 y generacion de datos para PDF.',
        },
        {
            question: 'El sistema controla inventario?',
            answer: 'Si. Incluye productos, variantes, codigos de barras, bodegas, stock, movimientos, ajustes, transferencias, bajo stock y valoracion.',
        },
        {
            question: 'Incluye ventas y pagos?',
            answer: 'Si. Tiene POS, ventas, items, pagos, saldos, descuentos, cancelaciones, historial y relacion con facturacion.',
        },
        {
            question: 'Hay seguimiento de laboratorio?',
            answer: 'Si. Las ordenes de laboratorio incluyen paciente, venta, consulta, proveedor, estados, prioridad, medidas, fechas y notas.',
        },
        {
            question: 'Como se controla el acceso?',
            answer: 'El sistema incluye usuarios, roles, permisos, autenticacion y auditoria de actividad. No se afirman certificaciones externas no verificadas.',
        },
        {
            question: 'Puedo solicitar una demostracion?',
            answer: 'Si. El formulario de esta pagina registra solicitudes para que el equipo pueda contactar a la optica interesada.',
        },
    ],
    interestOptions: [
        'Pacientes e historia clinica',
        'Consultas y recetas',
        'Ventas y caja',
        'Inventario',
        'Laboratorio',
        'Reportes',
        'Sucursales',
        'CRM',
    ],
};
