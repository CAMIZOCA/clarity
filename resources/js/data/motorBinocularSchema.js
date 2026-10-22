// Modulo de Terapia Visual (examen motor, binocular y acomodativo).
//
// Todo se guarda en la columna JSON `consultations.motor_binocular_data`, con la
// forma `{ bloque: { prueba: { campo: texto } } }`. No hay columnas propias:
// `consultations` esta al limite de fila de InnoDB (gotcha 2).
//
// La version anterior (v1) era plana, `{ prueba: { od, oi, observacion } }`, y
// no tiene la clave `motilidad`: asi se distinguen. No hubo migracion de datos;
// `buildMotorBinocularDefaults` convierte en pantalla lo que haya (v1, columnas
// planas de la importacion o PPC de Oftalmoscopia) y se guarda en v2 al guardar.
//
// `columns` son los encabezados del bloque. Cada fila trae una celda por
// columna (`null` = "—", sin campo) mas la observacion. Una celda con `label`
// lo muestra sobre el input (Horizontales, VL, BO VL...). En Binocularidad la
// unica columna "Resultado / Parametros" reparte sus celdas en linea.
//
// La validacion del servidor (`StoreConsultationRequest`) solo exige texto de
// hasta 255 caracteres en `motor_binocular_data.*.*.*`: un campo nuevo aqui no
// necesita tocar el backend.

export const MOTOR_BINOCULAR_BLOCKS = [
    {
        key: 'motilidad',
        title: '1. Motilidad ocular',
        tone: 'sky',
        columns: ['OD', 'OI'],
        rows: [
            {
                key: 'ducciones', label: 'Ducciones', hint: '(9 posiciones)',
                cells: [
                    { key: 'od', placeholder: 'Ej. completas' },
                    { key: 'oi', placeholder: 'Ej. completas' },
                ],
                observacion: 'Ej. sin limitaciones, dolor, sobreacción',
            },
            {
                key: 'versiones', label: 'Versiones', hint: '(binoculares)',
                cells: [
                    { key: 'horizontales', label: 'Horizontales', placeholder: 'Ej. normales' },
                    { key: 'verticales', label: 'Verticales', placeholder: 'Ej. normales' },
                ],
                observacion: 'Ej. sin limitaciones / incomitancia / diplopía',
            },
            {
                key: 'seguimientos', label: 'Seguimientos', hint: '(pursuits)',
                cells: [
                    { key: 'horizontales', label: 'Horizontales', placeholder: 'Ej. suaves, estables' },
                    { key: 'verticales', label: 'Verticales', placeholder: 'Ej. suaves, estables' },
                ],
                observacion: 'Ej. movimientos cefálicos, sacádicos intrusivos, pérdida de fijación',
            },
            {
                key: 'sacadicos', label: 'Sacádicos',
                cells: [
                    { key: 'horizontales', label: 'Horizontales', placeholder: 'Ej. precisos' },
                    { key: 'verticales', label: 'Verticales', placeholder: 'Ej. precisos' },
                ],
                observacion: 'Ej. lentos, hipométricos, hipermétricos, con movimientos de cabeza',
            },
        ],
    },
    {
        key: 'binocularidad',
        title: '2. Binocularidad y vergencias',
        tone: 'emerald',
        columns: ['Resultado / Parámetros'],
        rows: [
            {
                key: 'hirschberg', label: 'Test de Hirschberg',
                cells: [
                    { key: 'evaluacion', label: 'Evaluación (reflejos OD / OI)', placeholder: 'Ej. reflejos simétricos / desviación estimada en Δ' },
                ],
                observacion: 'Ej. simetría / desviación',
            },
            {
                key: 'kappa', label: 'Ángulo Kappa', hint: '(aparente)',
                cells: [
                    { key: 'od', label: 'OD', placeholder: 'Ej. positivo / negativo / neutro' },
                    { key: 'oi', label: 'OI', placeholder: 'Ej. positivo / negativo / neutro' },
                ],
                observacion: 'Ej. magnitud aparente / asimetría',
            },
            {
                key: 'cover_test', label: 'Cover Test', hint: '(Cover-Uncover / Alternante)',
                cells: [
                    { key: 'vl', label: 'VL', placeholder: 'Ej. orto / X / E / XT / ET (Δ)' },
                    { key: 'vp', label: 'VP', placeholder: 'Ej. orto / X / E / XT / ET (Δ)' },
                ],
                observacion: 'Ej. control, comitancia, magnitud, movimientos de refijación',
            },
            {
                key: 'ppc', label: 'PPC',
                cells: [
                    { key: 'objeto_real', label: 'Objeto real (ruptura/recobro)', placeholder: 'Ej. 5/7 cm' },
                    { key: 'luz', label: 'Luz (ruptura/recobro)', placeholder: 'Ej. 7/10 cm' },
                    { key: 'filtro_rojo', label: 'Luz + filtro rojo (ruptura/recobro)', placeholder: 'Ej. 9/12 cm' },
                ],
                observacion: 'Ej. diplopía, supresión, aleja un ojo',
            },
            {
                key: 'vergencias', label: 'Vergencias fusionales (B/N)', hint: '(borrosidad/ruptura/recobro)',
                cells: [
                    { key: 'bo_vl', label: 'BO VL (Base externa)', placeholder: 'Ej. 10/18/12 Δ' },
                    { key: 'bi_vl', label: 'BI VL (Base interna)', placeholder: 'Ej. 6/12/8 Δ' },
                    { key: 'bo_vp', label: 'BO VP (Base externa)', placeholder: 'Ej. 12/20/14 Δ' },
                    { key: 'bi_vp', label: 'BI VP (Base interna)', placeholder: 'Ej. 8/16/10 Δ' },
                ],
                observacion: 'Ej. rango reducido, asimétrico',
            },
            {
                key: 'flexibilidad', label: 'Flexibilidad de vergencias', hint: '(prismas 12 BO / 3 BI)',
                cells: [
                    { key: 'cpm', label: 'Ciclos por minuto (cpm)', placeholder: 'Ej. 10 cpm' },
                    { key: 'dificultad', label: 'Dificultad (BO / BI)', placeholder: 'Ej. BO / BI / ambas' },
                ],
                observacion: 'Ej. lenta, pierde fijación, fatiga',
            },
            {
                key: 'worth', label: 'Worth 4 puntos',
                cells: [
                    { key: 'resultado', label: 'Resultado', placeholder: 'Ej. fusión' },
                ],
                observacion: 'Ej. supresión, diplopía',
            },
            {
                key: 'estereopsis', label: 'Estereopsis',
                cells: [
                    { key: 'resultado', label: 'Resultado', placeholder: 'Ej. 40" (seg. de arco)' },
                ],
                observacion: 'Ej. reducida / ausente / normal (indicar test: Titmus, Randot, TNO)',
            },
        ],
    },
    {
        key: 'acomodacion',
        title: '3. Acomodación',
        tone: 'pink',
        columns: ['OD', 'OI', 'AO (ambos ojos)'],
        rows: [
            {
                key: 'amplitud', label: 'Amplitud de acomodación (A.A.)',
                cells: [
                    { key: 'od', placeholder: 'Ej. 12 D' },
                    { key: 'oi', placeholder: 'Ej. 12 D' },
                    { key: 'ao', placeholder: 'Ej. 12 D' },
                ],
                observacion: 'Ej. reducida / normal',
            },
            {
                key: 'mem', label: 'Retinoscopía dinámica (MEM)',
                cells: [
                    { key: 'od', placeholder: 'Ej. plano' },
                    { key: 'oi', placeholder: 'Ej. plano' },
                    null,
                ],
                observacion: 'Ej. lag + / lag −',
            },
            {
                key: 'arn', label: 'Respuesta negativa (ARN)',
                cells: [null, null, { key: 'ao', placeholder: 'Ej. +2.50 D' }],
                observacion: 'Ej. reducida / normal',
            },
            {
                key: 'arp', label: 'Respuesta positiva (ARP)',
                cells: [null, null, { key: 'ao', placeholder: 'Ej. −3.00 D' }],
                observacion: 'Ej. reducida / normal',
            },
            {
                key: 'maf', label: 'Flippers acomodativos ±2.00 (MAF)', hint: '(monocular)',
                cells: [
                    { key: 'od', placeholder: 'Ej. 12 cpm' },
                    { key: 'oi', placeholder: 'Ej. 12 cpm' },
                    null,
                ],
                observacion: 'Ej. dificultad con + / con − / ambos',
            },
            {
                key: 'baf', label: 'Flippers acomodativos ±2.00 (BAF)', hint: '(binocular)',
                cells: [null, null, { key: 'ao', placeholder: 'Ej. 12 cpm' }],
                observacion: 'Ej. dificultad con + / con − / ambos',
            },
        ],
    },
    {
        key: 'reflejos',
        title: '4. Reflejos pupilares',
        tone: 'amber',
        columns: ['OD', 'OI'],
        rows: [
            {
                key: 'pupilares', label: 'Reflejos pupilares', hint: '(directo y consensual)',
                cells: [
                    { key: 'od', placeholder: 'Ej. normales' },
                    { key: 'oi', placeholder: 'Ej. normales' },
                ],
                observacion: 'Ej. isocóricas, fotorreactivas, sin DPAR',
            },
        ],
    },
];

function text(value) {
    return value === null || value === undefined ? '' : String(value);
}

// "OD: x / OI: y" seguido de la observacion previa, separados como en
// `LegacyOpticalParser` ("6/8 | OD: ORTHO / OI: X"). Vacio si no hay nada.
function joinEyesWithNote(row = {}) {
    const eyes = [
        text(row?.od).trim() && `OD: ${text(row.od).trim()}`,
        text(row?.oi).trim() && `OI: ${text(row.oi).trim()}`,
    ].filter(Boolean).join(' / ');

    return [eyes, text(row?.observacion).trim()].filter(Boolean).join(' | ');
}

export function emptyMotorBinocularData() {
    return Object.fromEntries(MOTOR_BINOCULAR_BLOCKS.map((block) => [
        block.key,
        Object.fromEntries(block.rows.map((row) => [
            row.key,
            Object.fromEntries([
                ...row.cells.filter(Boolean).map((cell) => [cell.key, '']),
                ['observacion', ''],
            ]),
        ])),
    ]));
}

/**
 * Valores iniciales del modulo para el formulario. Nunca escribe en la BD: lo
 * convertido se guarda en v2 cuando el usuario guarda la consulta.
 *
 * - v2 (tiene `motilidad`): tal cual, con las claves que falten en ''.
 * - v1 (`{ prueba: { od, oi, observacion } }`): ducciones y reflejos tienen la
 *   misma forma; el OD/OI de versiones, cover test, PPC y Hirschberg no encaja
 *   en sus campos nuevos y pasa a la observacion rotulado.
 * - Sin JSON (consulta importada): columnas planas (`ducciones_od`,
 *   `versiones`...) y el PPC que la importacion dejo en Oftalmoscopia
 *   (`ppc_obj`, `luz`, `fr`).
 */
export function buildMotorBinocularDefaults(consultation) {
    const values = emptyMotorBinocularData();
    const stored = consultation?.motor_binocular_data;

    if (stored && typeof stored === 'object' && stored.motilidad) {
        for (const [blockKey, rows] of Object.entries(values)) {
            for (const [rowKey, fields] of Object.entries(rows)) {
                for (const field of Object.keys(fields)) {
                    fields[field] = text(stored?.[blockKey]?.[rowKey]?.[field]);
                }
            }
        }
        return values;
    }

    const { motilidad, binocularidad, reflejos } = values;

    if (stored && typeof stored === 'object') {
        motilidad.ducciones.od = text(stored.ducciones?.od);
        motilidad.ducciones.oi = text(stored.ducciones?.oi);
        motilidad.ducciones.observacion = text(stored.ducciones?.observacion);
        motilidad.versiones.observacion = joinEyesWithNote(stored.versiones);
        binocularidad.hirschberg.observacion = joinEyesWithNote(stored.test_hirschberg);
        binocularidad.cover_test.observacion = joinEyesWithNote(stored.cover_test);
        binocularidad.ppc.observacion = joinEyesWithNote(stored.ppc);
        reflejos.pupilares.od = text(stored.reflejos_pupilares?.od);
        reflejos.pupilares.oi = text(stored.reflejos_pupilares?.oi);
        reflejos.pupilares.observacion = text(stored.reflejos_pupilares?.observacion);
    } else {
        motilidad.ducciones.od = text(consultation?.ducciones_od);
        motilidad.ducciones.oi = text(consultation?.ducciones_oi);
        motilidad.versiones.observacion = text(consultation?.versiones);
        binocularidad.hirschberg.observacion = text(consultation?.test_hirschberg);
        binocularidad.cover_test.observacion = text(consultation?.cover_test);
        binocularidad.ppc.observacion = text(consultation?.ppc);
        reflejos.pupilares.observacion = text(consultation?.reflejos_pupilares);
    }

    // PPC de Oftalmoscopia (lentes de contacto del sistema anterior). Solo
    // rellena lo vacio: la v1 no tenia estos campos, asi que nunca pisa nada.
    const oft = consultation?.ophthalmoscopy_module;
    binocularidad.ppc.objeto_real ||= text(oft?.ppc_obj);
    binocularidad.ppc.luz ||= text(oft?.luz);
    binocularidad.ppc.filtro_rojo ||= text(oft?.fr);

    return values;
}
