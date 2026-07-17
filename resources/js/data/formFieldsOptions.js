// Catálogo de campos/bloques que pueden marcarse como "avanzados" (ocultos por
// defecto detrás de un toggle o en la zona avanzada del formulario).
//
// Cada key lleva el prefijo del formulario: `<form>:<slug>`. El administrador
// puede activar/desactivar cada uno desde Ajustes → Campos avanzados. El default
// (`defaultAdvanced`) se sembró midiendo la tasa de llenado real de la base
// (importación legacy Óptica Andina: 4.592 consultas / 3.579 pacientes): se
// marcaron avanzados los campos con <10% de llenado.
//
// `requiredFields`: nombres de campo del formulario asociados a la key. Si alguno
// está en `settings.required_fields`, el campo NUNCA se oculta (obligatorio gana).

export const FORM_ADVANCED_OPTIONS = [
    {
        form: 'consulta',
        label: 'Consulta oftalmológica',
        description: 'Campos poco usados según el llenado histórico. Los marcados se ocultan tras "Mostrar campos avanzados" o en la zona avanzada al final.',
        items: [
            // Secciones completas (van a la zona avanzada, colapsadas)
            { key: 'consulta:sec_motor_binocular', label: 'Sección: Motor, binocular y reflejos', type: 'section', defaultAdvanced: true },
            { key: 'consulta:sec_lentes_contacto', label: 'Sección: Módulo de lentes de contacto', type: 'section', defaultAdvanced: true },
            { key: 'consulta:sec_oftalmoscopia', label: 'Sección: Oftalmoscopía', type: 'section', defaultAdvanced: true },
            { key: 'consulta:sec_tratamiento', label: 'Sección: Tratamiento', type: 'section', defaultAdvanced: true },
            // Campos / columnas sueltos
            { key: 'consulta:ultimo_control', label: 'Cabecera: Último control', type: 'field', defaultAdvanced: true },
            { key: 'consulta:col_avsc', label: 'Refracción: columna AV.SC (lejos)', type: 'field', defaultAdvanced: true, requiredFields: ['avsc_od', 'avsc_oi'] },
            { key: 'consulta:col_avcc', label: 'Refracción: columna AV.CC (lejos)', type: 'field', defaultAdvanced: true },
            { key: 'consulta:rx_uso_cilindro', label: 'RX en uso: cilindro', type: 'field', defaultAdvanced: true },
            { key: 'consulta:rx_uso_avcc', label: 'RX en uso: AV.CC', type: 'field', defaultAdvanced: true },
            { key: 'consulta:subj_esfera', label: 'Subjetivo: esfera', type: 'field', defaultAdvanced: true },
            { key: 'consulta:subj_eje', label: 'Subjetivo: eje', type: 'field', defaultAdvanced: true },
            { key: 'consulta:subj_avl', label: 'Subjetivo: AVL', type: 'field', defaultAdvanced: true },
            { key: 'consulta:rx_final_avl', label: 'RX final: AVL', type: 'field', defaultAdvanced: true },
            { key: 'consulta:rx_final_prisma', label: 'RX final: prisma', type: 'field', defaultAdvanced: true },
            { key: 'consulta:rx_final_base', label: 'RX final: base', type: 'field', defaultAdvanced: true },
            { key: 'consulta:grp_vision_cerca', label: 'Grupo: Visión de cerca', type: 'field', defaultAdvanced: true },
            { key: 'consulta:lente_anterior', label: 'Lente anterior', type: 'field', defaultAdvanced: true, requiredFields: ['lente_anterior'] },
            { key: 'consulta:queratometria', label: 'Queratometría (OD/OI)', type: 'field', defaultAdvanced: true },
            { key: 'consulta:examen_externo', label: 'Examen externo (OD/OI)', type: 'field', defaultAdvanced: true },
            { key: 'consulta:vision_colores', label: 'Visión de colores', type: 'field', defaultAdvanced: true },
            { key: 'consulta:diagnostico_adicional', label: 'Diagnóstico adicional', type: 'field', defaultAdvanced: true },
        ],
    },
    {
        form: 'paciente',
        label: 'Ficha de paciente',
        description: 'Campos secundarios de la ficha de paciente.',
        items: [
            { key: 'paciente:antecedentes', label: 'Antecedentes médicos oculares', type: 'field', defaultAdvanced: true },
        ],
    },
    {
        form: 'orden_trabajo',
        label: 'Orden de trabajo',
        description: 'Bloques extensos de la orden que suelen usarse ocasionalmente.',
        items: [
            { key: 'orden_trabajo:especificaciones', label: 'Especificaciones de lentes (rejilla de casillas)', type: 'field', defaultAdvanced: true },
            { key: 'orden_trabajo:laboratorio_extra', label: 'Campos de laboratorio secundarios (ALT., FAC., R.C.)', type: 'field', defaultAdvanced: true },
        ],
    },
    {
        form: 'producto',
        label: 'Producto de inventario',
        description: 'Campos opcionales del producto.',
        items: [
            { key: 'producto:subcategoria', label: 'Subcategoría', type: 'field', defaultAdvanced: true },
        ],
    },
];

export const DEFAULT_ADVANCED_FORM_FIELDS = FORM_ADVANCED_OPTIONS.flatMap((group) =>
    group.items.filter((item) => item.defaultAdvanced).map((item) => item.key)
);

export const ALL_ADVANCED_FIELD_KEYS = FORM_ADVANCED_OPTIONS.flatMap((group) =>
    group.items.map((item) => item.key)
);

// Mapa key -> requiredFields, para que "obligatorio gane sobre avanzado".
export const ADVANCED_REQUIRED_FIELDS = FORM_ADVANCED_OPTIONS.reduce((acc, group) => {
    group.items.forEach((item) => {
        if (item.requiredFields?.length) {
            acc[item.key] = item.requiredFields;
        }
    });
    return acc;
}, {});
