import React, { useMemo, useState } from 'react';
import {
    BarChart2,
    BookOpen,
    Calendar,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    DollarSign,
    Eye,
    FileText,
    FlaskConical,
    LayoutDashboard,
    Megaphone,
    Package,
    Settings,
    Shield,
    Sparkles,
    Stethoscope,
    User,
    Users,
} from 'lucide-react';

const sections = [
    {
        icon: Sparkles,
        title: 'Primeros pasos',
        color: 'text-slate-700',
        summary:
            'Si acabas de entrar al sistema, empieza por ubicarte en el panel principal y luego abre el area que necesites segun tu trabajo del dia.',
        bullets: [
            'Busca primero al paciente o registralo si es nuevo.',
            'Usa Consulta para dejar la atencion clinica completa.',
            'Revisa Agenda si necesitas programar o confirmar citas.',
            'Entra a Inventario, Ventas, Caja o Laboratorio si tu trabajo es operativo.',
            'La ayuda puede consultarse en cualquier momento desde el menu lateral.',
        ],
    },
    {
        icon: LayoutDashboard,
        title: 'Panel principal',
        color: 'text-indigo-600',
        summary:
            'El dashboard te muestra un resumen rapido de la actividad de la clinica para que no tengas que entrar modulo por modulo.',
        bullets: [
            'Pacientes registrados en el sistema.',
            'Consultas realizadas en el dia.',
            'Citas pendientes y proximas citas.',
            'Consultas o movimientos recientes para retomar trabajo rapido.',
            'Accesos directos a los modulos que mas usas.',
        ],
    },
    {
        icon: Users,
        title: 'Pacientes',
        color: 'text-green-600',
        summary:
            'Aqui se guarda la informacion de cada paciente y se organiza su historial para que sea facil volver a encontrarlo.',
        bullets: [
            'Crear, editar y buscar pacientes por nombre, cedula o telefono.',
            'Ver su historial clinico en un solo lugar.',
            'Abrir una nueva consulta desde la ficha del paciente.',
            'Consultar informacion de contacto y observaciones relevantes.',
            'Revisar informes relacionados, como garantias o referencias.',
        ],
    },
    {
        icon: Stethoscope,
        title: 'Consulta',
        color: 'text-blue-600',
        summary:
            'Este es el espacio donde registras la atencion clinica. Esta pensado para que el proceso sea ordenado y facil de seguir.',
        bullets: [
            'Registrar el paciente atendido, el profesional y la fecha.',
            'Guardar datos clinicos, diagnosticos y recomendaciones.',
            'Completar medidas, observaciones y prescripcion cuando aplique.',
            'Mantener todo ligado al historial del paciente.',
            'Preparar la informacion que luego puede usarse en documentos o impresiones.',
        ],
    },
    {
        icon: Calendar,
        title: 'Agenda',
        color: 'text-purple-600',
        summary:
            'La agenda te ayuda a organizar citas por dia, semana o mes para que el equipo sepa que paciente atender y cuando.',
        bullets: [
            'Crear nuevas citas en el calendario.',
            'Revisar citas pendientes, atendidas o canceladas.',
            'Editar una cita cuando cambien la hora o el paciente.',
            'Ver de forma clara la carga de trabajo del dia.',
            'Coordinar mejor la atencion entre recepcion y consulta.',
        ],
    },
    {
        icon: Shield,
        title: 'Brigadas',
        color: 'text-orange-600',
        summary:
            'Sirve para organizar jornadas comunitarias o actividades fuera de la clinica y llevar control de los pacientes atendidos.',
        bullets: [
            'Crear brigadas con lugar, fecha y responsable.',
            'Agregar pacientes participantes.',
            'Editar la informacion de la jornada cuando sea necesario.',
            'Mantener el seguimiento sin mezclarlo con las consultas diarias.',
        ],
    },
    {
        icon: Eye,
        title: 'Lentes especiales',
        color: 'text-cyan-600',
        summary:
            'Aqui se lleva el control de adaptaciones y seguimientos de lentes especiales para casos que requieren mas detalle.',
        bullets: [
            'Registrar lentes especiales por paciente.',
            'Guardar datos de adaptacion y seguimiento.',
            'Revisar el estado de cada caso en la lista.',
            'Volver a una atencion anterior sin perder el contexto.',
        ],
    },
    {
        icon: FileText,
        title: 'Referencias',
        color: 'text-teal-600',
        summary:
            'Cuando un caso necesita atencion especializada, aqui puedes dejar registrada la derivacion para su seguimiento.',
        bullets: [
            'Crear referencias a oftalmologia u otras especialidades.',
            'Registrar el motivo y las observaciones del caso.',
            'Mantener la trazabilidad de la derivacion.',
            'Consultar despues si el paciente ya fue remitido o atendido.',
        ],
    },
    {
        icon: ClipboardList,
        title: 'Ordenes de trabajo',
        color: 'text-amber-600',
        summary:
            'Este modulo te ayuda a dejar por escrito lo que debe elaborarse, ajustarse o entregarse al paciente.',
        bullets: [
            'Crear una orden ligada al paciente cuando haga falta.',
            'Revisar datos de trabajo, observaciones y estado.',
            'Usarla como apoyo para control interno o produccion.',
            'Tener un seguimiento claro de lo que ya fue atendido y lo que sigue pendiente.',
        ],
    },
    {
        icon: Package,
        title: 'Inventario',
        color: 'text-emerald-600',
        summary:
            'El inventario te permite controlar productos, existencias y movimientos para saber que hay disponible en cada momento.',
        bullets: [
            'Crear y editar productos.',
            'Revisar stock disponible y movimientos recientes.',
            'Trabajar por bodegas o sucursales cuando aplique.',
            'Detectar faltantes antes de que afecten las ventas o la atencion.',
        ],
    },
    {
        icon: DollarSign,
        title: 'Ventas y caja',
        color: 'text-rose-600',
        summary:
            'Aqui se registra la operacion comercial del dia, desde la venta hasta el control de caja y su historial.',
        bullets: [
            'Hacer ventas en el punto de venta.',
            'Revisar el historial de ventas y movimientos.',
            'Registrar pagos, descuentos y devoluciones segun las reglas del negocio.',
            'Abrir o cerrar la caja y consultar sus sesiones.',
        ],
    },
    {
        icon: FlaskConical,
        title: 'Laboratorio',
        color: 'text-sky-600',
        summary:
            'Centraliza las ordenes de laboratorio para darles seguimiento sin perder fechas, estados ni observaciones tecnicas.',
        bullets: [
            'Crear y revisar ordenes pendientes o completadas.',
            'Consultar el estado del trabajo en cada etapa.',
            'Ver observaciones tecnicas y notas de seguimiento.',
            'Mantener el control de pedidos sin usar hojas sueltas.',
        ],
    },
    {
        icon: Megaphone,
        title: 'CRM',
        color: 'text-fuchsia-600',
        summary:
            'El CRM sirve para comunicarte mejor con tus pacientes y mantener recordatorios o campanas organizadas.',
        bullets: [
            'Crear recordatorios manuales o automatizados.',
            'Gestionar plantillas de mensajes.',
            'Lanzar campanas de seguimiento cuando sea necesario.',
            'Reducir olvidos en citas, cobros o revisiones.',
        ],
    },
    {
        icon: BarChart2,
        title: 'Reportes',
        color: 'text-red-600',
        summary:
            'Los reportes te ayudan a revisar como va la clinica y a tomar decisiones con datos, no solo con percepciones.',
        bullets: [
            'Ver reportes clinicos y comerciales.',
            'Abrir el dashboard gerencial si tienes permisos de administrador.',
            'Revisar indicadores por periodo y por sucursal.',
            'Exportar informacion cuando necesites compartirla o analizarla fuera del sistema.',
            'Identificar tendencias de pacientes, ventas, stock o laboratorio.',
        ],
    },
    {
        icon: Settings,
        title: 'Administracion',
        color: 'text-slate-600',
        summary:
            'Estas opciones son para usuarios con permisos de administrador y ayudan a mantener la plataforma ordenada.',
        bullets: [
            'Gestionar usuarios, roles y permisos.',
            'Configurar sucursales y bodegas.',
            'Editar catalogos y listas maestras.',
            'Ajustar la informacion general de la clinica y los datos de impresion.',
        ],
    },
    {
        icon: User,
        title: 'Mi perfil',
        color: 'text-pink-600',
        summary:
            'Cada usuario puede actualizar sus propios datos sin depender del administrador.',
        bullets: [
            'Cambiar nombre o correo electronico.',
            'Actualizar la contrasena de acceso.',
            'Mantener tu cuenta personal al dia.',
        ],
    },
];

function Section({ section }) {
    const [open, setOpen] = useState(section.defaultOpen ?? false);
    const Icon = section.icon;

    return (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-gray-50"
            >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                    <Icon size={20} className={section.color} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{section.title}</p>
                    <p className="mt-1 text-sm text-gray-500">{section.summary}</p>
                </div>
                {open ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
            </button>
            {open && (
                <div className="border-t border-gray-100 px-6 pb-5 pt-2">
                    <ul className="space-y-2">
                        {section.bullets.map((bullet) => (
                            <li key={bullet} className="flex gap-3 text-sm text-gray-600">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                                <span>{bullet}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function HelpPage() {
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) {
            return sections;
        }

        return sections.filter((section) => {
            const searchable = [section.title, section.summary, ...section.bullets].join(' ').toLowerCase();
            return searchable.includes(query);
        });
    }, [search]);

    return (
        <div className="mx-auto max-w-5xl p-6">
            <div className="mb-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1a2a4a] text-white shadow-sm">
                        <BookOpen size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Centro de ayuda</h1>
                        <p className="mt-1 text-gray-600">
                            Guia simple para aprender a usar el sistema por primera vez y ubicar cada modulo con rapidez.
                        </p>
                    </div>
                </div>
            </div>

            <div className="mb-6 grid gap-3 rounded-2xl border border-[#d7e1ef] bg-[#f5f8fc] p-4 text-sm text-slate-700 md:grid-cols-3">
                <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                    <p className="font-semibold text-slate-900">1. Busca al paciente</p>
                    <p className="mt-1">Empieza por Pacientes si necesitas crear o revisar una ficha.</p>
                </div>
                <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                    <p className="font-semibold text-slate-900">2. Registra la atencion</p>
                    <p className="mt-1">Usa Consulta para dejar la informacion clinica organizada.</p>
                </div>
                <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                    <p className="font-semibold text-slate-900">3. Revisa la operacion</p>
                    <p className="mt-1">Apoyate en Agenda, Inventario, Ventas, Caja y Reportes para el trabajo diario.</p>
                </div>
            </div>

            <div className="mb-6">
                <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar en la ayuda: pacientes, agenda, caja, inventario..."
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#1a2a4a] focus:ring-2 focus:ring-[#1a2a4a]/20"
                />
            </div>

            <div className="space-y-3">
                {filtered.map((section, index) => (
                    <Section
                        key={section.title}
                        section={{
                            ...section,
                            defaultOpen: index === 0 && !search.trim(),
                        }}
                    />
                ))}

                {filtered.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-gray-500">
                        No se encontraron resultados para "{search}".
                    </div>
                )}
            </div>
        </div>
    );
}

export default HelpPage;
