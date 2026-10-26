// Ficha de solo lectura de la consulta (`ConsultationViewPage`): que se muestra
// y con que rotulo. Una seccion o una fila sin datos no se pinta.
//
// Las etiquetas siguen las del formulario (`ConsultationForm.jsx`). Un campo
// nuevo de la consulta que deba verse en recepcion se agrega aqui.

/**
 * Medidas sueltas por ojo: cada fila lee `${key}_od` y `${key}_oi`.
 */
export const PRELIMINARY_ROWS = [
    { key: 'av_lectura', label: 'Lectura computador' },
    { key: 'ark', label: 'Queratometría' },
    { key: 'avsc', label: 'AV.SC lejos' },
    { key: 'avsc_cerca', label: 'AV.SC cerca' },
    { key: 'retinoscopia', label: 'Retinoscopia' },
    { key: 'avcc', label: 'AV Retinoscopía VL' },
    { key: 'avcc_cerca', label: 'AV cerca' },
    { key: 'ph', label: 'Agujero estenopeico (PH)' },
    { key: 'morfoscopica_lejos', label: 'Morfoscópica lejos' },
    { key: 'morfoscopica_cerca', label: 'Morfoscópica cerca' },
];

/**
 * Tablas de refraccion: columnas `${prefix}_${columna}_${ojo}`. `optical`
 * marca las que se muestran con signo y dos decimales.
 */
export const REFRACTION_TABLES = [
    {
        key: 'subj',
        title: 'Subjetivo',
        columns: [
            { key: 'esfera', label: 'Esfera', optical: true },
            { key: 'cilindro', label: 'Cilindro', optical: true },
            { key: 'eje', label: 'Eje' },
            { key: 'add', label: 'ADD', optical: true },
            { key: 'avl', label: 'AV lejos' },
            { key: 'avc', label: 'AV cerca' },
        ],
        extra: [{ key: 'subj_dp', label: 'DP' }],
    },
    {
        key: 'rx_final',
        title: 'RX final',
        columns: [
            { key: 'esfera', label: 'Esfera', optical: true },
            { key: 'cilindro', label: 'Cilindro', optical: true },
            { key: 'eje', label: 'Eje' },
            { key: 'prisma', label: 'Prisma' },
            { key: 'base', label: 'Base' },
            { key: 'av', label: 'AV' },
            { key: 'add', label: 'ADD', optical: true },
            { key: 'dnp', label: 'DP' },
            { key: 'distancia', label: 'Distancia' },
        ],
        extra: [{ key: 'rx_final_observaciones', label: 'Observaciones' }],
    },
    {
        key: 'vc',
        title: 'Visión de cerca',
        columns: [
            { key: 'esfera', label: 'Esfera', optical: true },
            { key: 'cilindro', label: 'Cilindro', optical: true },
            { key: 'eje', label: 'Eje' },
            { key: 'av', label: 'AV' },
            { key: 'avcc', label: 'AVCC' },
            { key: 'dnp', label: 'DP' },
        ],
    },
];

/** RX en uso: filas de `rx_uso_entries` (o las columnas planas importadas). */
export const RX_USO_COLUMNS = [
    { key: 'esfera', label: 'Esfera', optical: true },
    { key: 'cilindro', label: 'Cilindro', optical: true },
    { key: 'eje', label: 'Eje' },
    { key: 'add', label: 'ADD', optical: true },
    { key: 'avcc', label: 'AVCC' },
];

export const KERATOMETRY_ROWS = [
    { key: 'queratometria_horizontal', label: 'Horizontal' },
    { key: 'queratometria_vertical', label: 'Vertical' },
    { key: 'queratometria_eje', label: 'Eje' },
    { key: 'queratometria_miras', label: 'Miras' },
    { key: 'queratometria', label: 'Detalle' },
    { key: 'examen_externo', label: 'Examen externo' },
];

/** Campos de texto sueltos, por seccion. `path` admite `modulo.campo`. */
export const TEXT_SECTIONS = {
    cabecera: [
        { path: 'motivo_consulta', label: 'Motivo de consulta' },
        { path: 'ultimo_control', label: 'Último control' },
        { path: 'lente_anterior', label: 'Lente anterior' },
        { path: 'vision_colores', label: 'Visión de colores' },
    ],
    queratometria: [
        { path: 'queratometria_calificacion', label: 'Calificación' },
    ],
    contactLens: [
        { path: 'contact_lens_module.diametro_pupilar', label: 'Diámetro pupilar' },
        { path: 'contact_lens_module.diametro_corneal', label: 'Diámetro corneal' },
        { path: 'contact_lens_module.apertura_palpebral', label: 'Apertura palpebral' },
        { path: 'contact_lens_module.tension_palpebral', label: 'Tensión palpebral' },
        { path: 'contact_lens_module.dhiv', label: 'DHIV' },
        { path: 'contact_lens_module.ojo_dominante', label: 'Ojo dominante' },
        { path: 'contact_lens_module.but_value', label: 'BUT' },
        { path: 'contact_lens_module.shirmer_test', label: 'Test de Schirmer' },
        { path: 'contact_lens_module.tincion', label: 'Tinción' },
        { path: 'contact_lens_module.frecuencia_parpadeo', label: 'Frecuencia de parpadeo' },
        { path: 'contact_lens_module.estado', label: 'Estado' },
        { path: 'contact_lens_module.observaciones', label: 'Observaciones' },
    ],
    ophthalmoscopy: [
        { path: 'ophthalmoscopy_module.fijacion_od', label: 'Fijación OD' },
        { path: 'ophthalmoscopy_module.fijacion_oi', label: 'Fijación OI' },
        { path: 'ophthalmoscopy_module.valoracion_motora', label: 'Valoración motora / test' },
    ],
    treatment: [
        { path: 'treatment_module.plan', label: 'Plan de tratamiento' },
        { path: 'treatment_module.horas_uso', label: 'Horas de uso' },
        { path: 'treatment_module.metodo_limpieza', label: 'Método de limpieza' },
        { path: 'treatment_module.modalidad_uso', label: 'Modalidad de uso' },
    ],
    observaciones: [
        { path: 'observaciones', label: 'Observaciones clínicas' },
        { path: 'certificado_nota', label: 'Nota del certificado' },
    ],
};
