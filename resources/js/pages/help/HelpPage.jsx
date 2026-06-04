import React, { useState } from 'react';
import {
    BookOpen, LayoutDashboard, Users, Stethoscope, Calendar,
    Shield, Eye, FileText, BarChart2, Settings, Database,
    ShieldCheck, ChevronDown, ChevronRight, User
} from 'lucide-react';

const sections = [
    {
        icon: LayoutDashboard,
        title: 'Dashboard',
        color: 'text-indigo-600',
        content: `La página de inicio muestra un resumen del estado actual de la clínica:
• Total de pacientes registrados en el sistema.
• Consultas realizadas el día de hoy.
• Citas pendientes en los próximos 7 días.
• Las 5 consultas más recientes.
• Las próximas 5 citas agendadas.

Haz clic en cualquier tarjeta estadística para navegar al módulo correspondiente.`,
    },
    {
        icon: Stethoscope,
        title: 'Consulta',
        color: 'text-blue-600',
        content: `El formulario de consulta clínica es el núcleo del sistema. Permite registrar:

**Datos básicos:** paciente, médico, motivo de consulta y fecha.

**Agudeza visual (AV):** SC (sin corrección) y CC (con corrección) para ojo derecho (OD) e ojo izquierdo (OI).

**Rx final:** prescripción óptica con esfera, cilindro, eje, adición y AV para cada ojo. Incluye distancia pupilar (DP).

**Biomicroscopía:** exploración con lámpara de hendidura del segmento anterior.

**Fondo de ojo:** examen del segmento posterior (retina, nervio óptico, mácula).

**Diagnóstico:** diagnóstico principal y diagnósticos adicionales del catálogo clínico.

**Recomendaciones:** indicaciones y recomendaciones al paciente.

**Lentes de contacto:** parámetros de adaptación (radio base, diámetro, potencia, material, etc.).

**Opciones de impresión:** selección de plantilla para generar el certificado/receta.

Cada sección puede contraerse o expandirse haciendo clic en su encabezado. El estado se recuerda entre sesiones.

**Campos obligatorios:** los campos marcados como requeridos en Configuración → Campos obligatorios se resaltan en rojo si están vacíos al intentar guardar.`,
    },
    {
        icon: Users,
        title: 'Pacientes',
        color: 'text-green-600',
        content: `Gestión completa del directorio de pacientes.

**Lista de pacientes:** búsqueda en tiempo real por nombre, apellido, cédula o teléfono. Acceso rápido al historial y nueva consulta.

**Nuevo paciente / Editar:** formulario con datos personales (nombre, apellido, cédula, fecha de nacimiento, género, teléfono, email, dirección, ocupación, observaciones).

**Historial del paciente:** vista unificada de todas las consultas e informes de garantía ordenados por fecha. Haz clic en una consulta para editarla.

Desde el historial puedes:
• Iniciar una nueva consulta vinculada al paciente.
• Generar un Informe de Garantía.`,
    },
    {
        icon: ShieldCheck,
        title: 'Informe de Garantía',
        color: 'text-amber-600',
        content: `Documento clínico para registrar cambios, correcciones o soluciones postratamiento.

Se genera desde el historial del paciente con el botón "Informe de Garantía". Campos:
• Fecha del informe.
• Estado: Pendiente o Completado.
• Médico responsable.
• Motivo del informe (texto libre).
• Cambios realizados.
• Soluciones indicadas.

Los informes aparecen en el historial del paciente junto a las consultas normales, diferenciados por un ícono y borde ámbar. Cada informe genera un número único automático (IG-YYYY-XXXX).`,
    },
    {
        icon: Calendar,
        title: 'Agenda',
        color: 'text-purple-600',
        content: `Calendario interactivo de citas para la clínica.

**Vistas disponibles:** mensual, semanal y diaria.

**Nueva cita:** haz clic en cualquier slot vacío del calendario para agendar. Puedes especificar: paciente, médico, título, fecha/hora inicio y fin, notas, y estado.

**Editar/eliminar cita:** haz clic en una cita existente para editarla o eliminarla.

**Colores por estado:**
• Azul: Pendiente
• Verde: Atendido
• Gris: Cancelado

El sidebar muestra un badge rojo con el número de citas pendientes del día actual.`,
    },
    {
        icon: Shield,
        title: 'Brigadas',
        color: 'text-orange-600',
        content: `Gestión de brigadas médicas y operativos de salud visual.

**Lista de brigadas:** muestra nombre, lugar, fecha, médico responsable y número de pacientes atendidos.

**Nueva brigada / Editar:** nombre, lugar, fecha, médico responsable y observaciones.

**Detalle de brigada:** lista de pacientes participantes. Puedes agregar pacientes existentes del sistema o quitarlos de la brigada. Los pacientes no se eliminan del sistema, solo se desasocian de la brigada.`,
    },
    {
        icon: Eye,
        title: 'Lentes Especiales',
        color: 'text-cyan-600',
        content: `Módulo para el seguimiento de adaptaciones de lentes de contacto especiales.

**Tipos soportados:**
• Lentes esclerales
• Ortoqueratología
• Lentes para queratocono

**Parámetros por ojo (OD/OI):** radio base, diámetro, potencia esférica y cilíndrica, eje, material.

**Seguimiento:** fecha de adaptación, protocolo de seguimiento y fecha de próxima revisión.

Filtro por tipo de lente en la lista para localizar rápidamente los casos.`,
    },
    {
        icon: FileText,
        title: 'Referencias Oftalmológicas',
        color: 'text-teal-600',
        content: `Registro de referencias/derivaciones a especialistas oftalmológicos.

Cada referencia incluye:
• Paciente referido.
• Motivo de la referencia.
• Médico oftalmólogo al que se refiere.
• Especialidad.
• Fecha de referencia.
• Observaciones adicionales.

Útil para el seguimiento de casos que requieren atención especializada más allá de la optometría general.`,
    },
    {
        icon: BarChart2,
        title: 'Reportes',
        color: 'text-red-600',
        content: `Generación de informes estadísticos de la actividad clínica.

**Consultas por período:** filtra por rango de fechas para ver el volumen de consultas. Incluye gráfico de barras.

**Diagnósticos más frecuentes:** ranking de los diagnósticos más registrados en el período seleccionado.

**Reporte de pacientes:** estadísticas demográficas y de registro de pacientes.

**Exportar CSV:** descarga los datos del reporte activo en formato CSV para análisis externo.`,
    },
    {
        icon: Users,
        title: 'Usuarios',
        color: 'text-gray-600',
        content: `Administración de cuentas de usuario del sistema. Solo visible para administradores.

**Roles disponibles:**
• Admin: acceso completo, incluyendo gestión de usuarios y catálogos.
• Optometrista: acceso a consultas, pacientes, agenda y módulos clínicos.
• Recepcionista: acceso a pacientes y agenda.

**Formulario de usuario:** nombre, email, contraseña (solo en creación), rol. Los usuarios pueden modificar sus propios datos desde "Mi Perfil".

**Código / Registro:** campo para número de colegiado o registro profesional (aparece en los certificados impresos).`,
    },
    {
        icon: Database,
        title: 'Catálogos',
        color: 'text-violet-600',
        content: `Editor de los valores predefinidos que aparecen en los selectores del sistema. Solo accesible para administradores.

**Catálogos disponibles:**
• Médicos / Optometras
• Materiales de lentes
• Espesor de lentes
• Protecciones/tratamientos
• Diagnósticos clínicos
• Recomendaciones
• Plantillas de impresión
• Tipos de lentes de contacto especiales

Para agregar un elemento: haz clic en "Agregar" en el grupo correspondiente, escribe el código (opcional) y nombre, y presiona Enter o el ícono de confirmación.

Para editar: haz clic en el ícono de lápiz. Para eliminar: ícono de papelera + confirmación.`,
    },
    {
        icon: Settings,
        title: 'Configuración',
        color: 'text-slate-600',
        content: `Parámetros globales de la clínica.

**Pestaña General:**
• Nombre de la clínica (aparece en certificados e informes).
• Slogan / Tagline.
• Dirección y teléfono.
• Logo de la clínica (PNG/JPG, máx. 2 MB, recomendado 300×100 px). El logo aparece en la cabecera de los documentos impresos.

**Pestaña Campos obligatorios:**
Define cuáles campos del formulario de consulta son requeridos. Al intentar guardar una consulta con campos faltantes, se mostrarán en rojo con un aviso indicando cuáles faltan completar.`,
    },
    {
        icon: User,
        title: 'Mi Perfil',
        color: 'text-pink-600',
        content: `Permite a cada usuario actualizar su propia información.

**Datos personales:** nombre completo y correo electrónico.

**Cambio de contraseña:** requiere ingresar la contraseña actual antes de establecer una nueva. La nueva contraseña debe tener al menos 8 caracteres. Si no deseas cambiarla, deja los campos en blanco.

Accede desde el enlace "Mi perfil" en la parte inferior del menú lateral.`,
    },
];

function Section({ section }) {
    const [open, setOpen] = useState(false);
    const Icon = section.icon;

    const renderContent = (text) => {
        return text.split('\n').map((line, i) => {
            if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="font-semibold text-gray-800 mt-3 mb-1">{line.slice(2, -2)}</p>;
            }
            if (line.startsWith('• ')) {
                return <li key={i} className="ml-4 text-gray-600 text-sm">{line.slice(2)}</li>;
            }
            if (line === '') return <br key={i} />;
            const parts = line.split(/\*\*(.*?)\*\*/g);
            return (
                <p key={i} className="text-gray-600 text-sm">
                    {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
                </p>
            );
        });
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
            >
                <div className={`w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0`}>
                    <Icon size={20} className={section.color} />
                </div>
                <span className="flex-1 font-semibold text-gray-900">{section.title}</span>
                {open ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
            </button>
            {open && (
                <div className="px-6 pb-5 pt-1 border-t border-gray-100">
                    <ul className="space-y-1">
                        {renderContent(section.content)}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default function HelpPage() {
    const [search, setSearch] = useState('');
    const filtered = sections.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.content.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <BookOpen size={28} className="text-[#1a2a4a]" /> Centro de ayuda
                </h1>
                <p className="text-gray-500 mt-1">Guía de referencia para todos los módulos y funcionalidades del sistema</p>
            </div>

            <div className="mb-6">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar en la ayuda..."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm"
                />
            </div>

            <div className="space-y-3">
                {filtered.map(s => <Section key={s.title} section={s} />)}
                {filtered.length === 0 && (
                    <div className="text-center py-12 text-gray-400">No se encontraron resultados para "{search}".</div>
                )}
            </div>
        </div>
    );
}
