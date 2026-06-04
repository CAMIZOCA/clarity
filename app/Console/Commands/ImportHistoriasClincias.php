<?php

namespace App\Console\Commands;

use App\Models\Consultation;
use App\Models\ConsultationContactLensModule;
use App\Models\ConsultationOphthalmoscopyModule;
use App\Models\ConsultationTreatmentModule;
use App\Models\Patient;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class ImportHistoriasClincias extends Command
{
    protected $signature = 'import:historias-clinicas
                            {file : Ruta al archivo Excel (.xlsx)}
                            {--dry-run : Solo reportar, no guardar en BD}
                            {--user-id=1 : ID del usuario creador de los registros}
                            {--skip-existing : Saltar filas cuyo legacy_id ya existe}';

    protected $description = 'Importa las historias clínicas desde el Excel del sistema anterior';

    private int $created = 0;
    private int $skipped = 0;
    private int $errors = 0;
    private array $errorLog = [];
    private bool $dryRun = false;

    public function handle(): int
    {
        ini_set('memory_limit', '1G');

        $file = $this->argument('file');
        $this->dryRun = (bool) $this->option('dry-run');
        $userId = (int) $this->option('user-id');
        $skipExisting = (bool) $this->option('skip-existing');

        if (! file_exists($file)) {
            $this->error("Archivo no encontrado: {$file}");
            return Command::FAILURE;
        }

        if ($this->dryRun) {
            $this->warn('MODO DRY-RUN activado — no se guardarán cambios en la BD');
        }

        $this->info("Leyendo archivo: {$file}");

        // Usar el reader en modo chunk para no cargar todo en memoria
        $reader = IOFactory::createReaderForFile($file);
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($file);
        $sheet = $spreadsheet->getActiveSheet();

        // Leer encabezados (fila 3)
        $headersRaw = [];
        foreach ($sheet->getRowIterator(3, 3) as $headerRowObj) {
            foreach ($headerRowObj->getCellIterator() as $cell) {
                $headersRaw[$cell->getCoordinate()] = trim((string) $cell->getValue());
            }
        }
        // Construir índice col → letra de columna
        $colIndex = [];
        foreach ($headersRaw as $coord => $header) {
            preg_match('/^([A-Z]+)/', $coord, $m);
            $colLetter = $m[1];
            if ($header !== '') {
                $colIndex[$header] = $colLetter;
            }
        }

        $totalRows = $sheet->getHighestRow() - 3;
        $this->info("Total de filas de datos: {$totalRows}");

        $bar = $this->output->createProgressBar($totalRows);
        $bar->start();

        foreach ($sheet->getRowIterator(4) as $rowObj) {
            $rowNum = $rowObj->getRowIndex();
            // Convertir fila a array keyed por letra de columna
            $row = [];
            foreach ($rowObj->getCellIterator() as $cell) {
                preg_match('/^([A-Z]+)/', $cell->getCoordinate(), $m);
                $row[$m[1]] = $cell->getValue();
            }

            $bar->advance();

            $legacyId = $this->val($row, $colIndex, 'Id');
            if (empty($legacyId)) {
                continue;
            }

            try {
                $this->processRow($row, $colIndex, $legacyId, $userId, $skipExisting);
            } catch (\Throwable $e) {
                $this->errors++;
                $this->errorLog[] = "Fila {$rowNum} (Id={$legacyId}): {$e->getMessage()}";
            }
        }

        $bar->finish();
        $this->newLine(2);

        $this->table(['Resultado', 'Total'], [
            ['Creados', $this->created],
            ['Saltados (ya existían)', $this->skipped],
            ['Errores', $this->errors],
        ]);

        if (! empty($this->errorLog)) {
            $this->warn('Errores encontrados:');
            foreach (array_slice($this->errorLog, 0, 20) as $err) {
                $this->line("  - {$err}");
            }
            if (count($this->errorLog) > 20) {
                $this->line('  ... y ' . (count($this->errorLog) - 20) . ' más');
            }
        }

        if ($this->dryRun) {
            $this->warn('DRY-RUN completado. Ningún dato fue guardado.');
        } else {
            $this->info('Importación completada.');
        }

        return Command::SUCCESS;
    }

    private function processRow(array $row, array $colIndex, string $legacyId, int $userId, bool $skipExisting): void
    {
        // Verificar si ya existe la consulta con este legacy_id
        if (Consultation::where('legacy_id', $legacyId)->exists()) {
            $this->skipped++;
            return;
        }

        if ($this->dryRun) {
            $this->created++;
            return;
        }

        // Buscar o crear paciente placeholder
        $patient = Patient::where('legacy_id', $legacyId)->first();
        if (! $patient) {
            $patient = Patient::create([
                'nombre'           => "Paciente Pendiente #{$legacyId}",
                'cedula'           => "IMPORT-{$legacyId}",
                'fecha_nacimiento' => '2000-01-01',
                'legacy_id'        => $legacyId,
                'created_by'       => $userId,
            ]);
        }

        // Resolver optometrista
        $medicoId = $this->val($row, $colIndex, 'MEDICO_RESPONSABLE');
        $optometristaId = null;
        if (! empty($medicoId)) {
            $user = User::find((int) $medicoId) ?? User::where('codigo', $medicoId)->first();
            $optometristaId = $user?->id;
        }

        // Fecha de consulta
        $fechaConsulta = $this->parseDate($this->val($row, $colIndex, 'FECHA')) ?? now()->toDateString();
        $ultimoControl = $this->parseDate($this->val($row, $colIndex, 'ULTIMO CONTROL'));
        $fechaEntrega  = $this->parseDate($this->val($row, $colIndex, 'FECHA DE ENTREGA'));

        // Estado cancelado
        $estadoCancelado = null;
        $canceladoVal = strtolower(trim((string) $this->val($row, $colIndex, 'ESTADO CANCELADO_S/N')));
        if (in_array($canceladoVal, ['s', 'si', 'sí', '1', 'true', 'yes'])) {
            $estadoCancelado = true;
        } elseif (in_array($canceladoVal, ['n', 'no', '0', 'false'])) {
            $estadoCancelado = false;
        }

        // Combinar VER_OD y VER_OI en versiones
        $verOd = $this->val($row, $colIndex, 'VER_OD');
        $verOi = $this->val($row, $colIndex, 'VER_OI');
        $versiones = implode(' / ', array_filter([$verOd, $verOi])) ?: null;

        // Combinar PH_OD + PH_OD1
        $phOd = $this->mergeFields($this->val($row, $colIndex, 'PH_OD'), $this->val($row, $colIndex, 'PH_OD1'));
        $phOi = $this->mergeFields($this->val($row, $colIndex, 'PH_OI'), $this->val($row, $colIndex, 'PH_OI1'));

        $consultation = Consultation::create([
            'legacy_id'          => $legacyId,
            'patient_id'         => $patient->id,
            'optometrista_id'    => $optometristaId,
            'created_by'         => $userId,
            'fecha_consulta'     => $fechaConsulta,
            'ultimo_control'     => $ultimoControl,
            'estado'             => 'completada',
            'estado_lentes'      => $this->val($row, $colIndex, 'ESTADO DE LENTES'),
            'motivo_consulta'    => $this->val($row, $colIndex, 'MOTIVO DE COPNSULTA'),

            // Agudeza visual
            'av_lectura_od'      => $this->val($row, $colIndex, 'LECTURA COMPUTADOR'),
            'av_lectura_oi'      => $this->val($row, $colIndex, 'LECTURA COMPUTADOR OI'),
            'avsc_od'            => $this->val($row, $colIndex, 'AVSC_LEJOS_DERECHA'),
            'avsc_oi'            => $this->val($row, $colIndex, 'AVSC_LEJOS_IZQUIERDA'),
            'avsc_cerca_od'      => $this->val($row, $colIndex, 'AVSC_CERCA_DERECHA'),
            'avsc_cerca_oi'      => $this->val($row, $colIndex, 'AVSC_CERCA_IZQUIERDA'),
            'avcc_od'            => $this->val($row, $colIndex, 'AVCC_LEJOS_DERECHA'),
            'avcc_oi'            => $this->val($row, $colIndex, 'AVCC_LEJOS_IZQUIERDA'),
            'avcc_cerca_od'      => $this->val($row, $colIndex, 'AVCC_CERCA_DERECHA'),
            'avcc_cerca_oi'      => $this->val($row, $colIndex, 'AVCC_CERCA_IZQUIERDA'),

            // Retinoscopia
            'retinoscopia_od'           => $this->val($row, $colIndex, 'RETINOSCOPIA_OD'),
            'retinoscopia_oi'           => $this->val($row, $colIndex, 'RETINOSCOPIA_OI'),
            'retinoscopia_esfera_od'    => $this->val($row, $colIndex, 'RETINOSCOPIA_ESFERA_OD'),
            'retinoscopia_esfera_oi'    => $this->val($row, $colIndex, 'RETINOSCOPIA_ESFERA_OI'),
            'retinoscopia_cilindro_od'  => $this->val($row, $colIndex, 'RETINOSCOPIA_CILINDRO_OD'),
            'retinoscopia_cilindro_oi'  => $this->val($row, $colIndex, 'RETINOSCOPIA_CILINDRO_OI'),
            'retinoscopia_eje_od'       => $this->val($row, $colIndex, 'RETINOSCOPIA_EJE_OD'),
            'retinoscopia_eje_oi'       => $this->val($row, $colIndex, 'RETINOSCOPIA_EJE_OI'),
            'retinoscopia_ppc'          => $this->val($row, $colIndex, 'RETINOSCOPIA_PPC'),
            'cover_test'                => $this->val($row, $colIndex, 'RETINOSCOPIA_COVER TEST'),

            // RX en uso — strings combinados (cols 16-17)
            'rx_uso_esfera_od'   => $this->val($row, $colIndex, 'RX_EN USO_ESFERA_OD'),
            'rx_uso_cilindro_od' => $this->val($row, $colIndex, 'RX_EN USO_CILINDRO_OD'),
            'rx_uso_eje_od'      => $this->val($row, $colIndex, 'RX_EN USO_EJE_OD'),
            'rx_uso_avcc_od'     => $this->val($row, $colIndex, 'RX_EN USO_AVCC_OD'),
            'rx_uso_add_od'      => $this->val($row, $colIndex, 'RX_EN USO_ADD_OD'),
            'rx_uso_esfera_oi'   => $this->val($row, $colIndex, 'RX_EN USO_ESFERA_OI'),
            'rx_uso_cilindro_oi' => $this->val($row, $colIndex, 'RX_EN USO_CILINDRO_OI'),
            'rx_uso_eje_oi'      => $this->val($row, $colIndex, 'RX_EN USO_EJE_OI'),
            'rx_uso_avcc_oi'     => $this->val($row, $colIndex, 'RX_EN USO_AVCC_OI'),
            'rx_uso_add_oi'      => $this->val($row, $colIndex, 'RX_EN USO_ADD_OI'),

            // Subjetivo / RXPARCIAL
            'subj_esfera_od'     => $this->val($row, $colIndex, 'RXPARCIAL_ESFERA_OD'),
            'subj_cilindro_od'   => $this->val($row, $colIndex, 'RXPARCIAL_CILINDRO_OD'),
            'subj_eje_od'        => $this->val($row, $colIndex, 'RXPARCIAL_EJE_OD'),
            'subj_avl_od'        => $this->val($row, $colIndex, 'RXPARCIAL_AVL_OD'),
            'subj_add_od'        => $this->val($row, $colIndex, 'RXPARCIAL_ADD_OD'),
            'subj_avc_od'        => $this->val($row, $colIndex, 'RXPARCIAL_AVC_OD'),
            'subj_esfera_oi'     => $this->val($row, $colIndex, 'RXPARCIAL_ESFERA_OI'),
            'subj_cilindro_oi'   => $this->val($row, $colIndex, 'RXPARCIAL_CILINDRO_OI'),
            'subj_eje_oi'        => $this->val($row, $colIndex, 'RXPARCIAL_EJE_OI'),
            'subj_avl_oi'        => $this->val($row, $colIndex, 'RXPARCIAL_AVL_OI'),
            'subj_add_oi'        => $this->val($row, $colIndex, 'RXPARCIAL_ADD_OI'),
            'subj_avc_oi'        => $this->val($row, $colIndex, 'RXPARCIAL_AVC_OI'),
            'subj_dp'            => $this->val($row, $colIndex, 'RXPARCIAL_DP'),

            // RX final
            'rx_final_esfera_od'   => $this->val($row, $colIndex, 'RX_FINAL_OD_ESFRERA'),
            'rx_final_cilindro_od' => $this->val($row, $colIndex, 'RX_FINAL_OD_CILINDRO'),
            'rx_final_eje_od'      => $this->val($row, $colIndex, 'RX_FINAL_OD_EJE'),
            'rx_final_add_od'      => $this->val($row, $colIndex, 'RX_FINAL_OD_ADD'),
            'rx_final_avl_od'      => $this->val($row, $colIndex, 'RX_FINAL_OD_AVL'),
            'rx_final_dnp_od'      => $this->val($row, $colIndex, 'RX_FINAL_DNP_OD'),
            'rx_final_esfera_oi'   => $this->val($row, $colIndex, 'RX_FINAL_OI_ESFRERA'),
            'rx_final_cilindro_oi' => $this->val($row, $colIndex, 'RX_FINAL_OI_CILINDRO'),
            'rx_final_eje_oi'      => $this->val($row, $colIndex, 'RX_FINAL_OI_EJE'),
            'rx_final_add_oi'      => $this->val($row, $colIndex, 'RX_FINAL_OI_ADD'),
            'rx_final_avl_oi'      => $this->val($row, $colIndex, 'RX_FINAL_OI_AVL'),
            'rx_final_dnp_oi'      => $this->val($row, $colIndex, 'RX_FINAL_DNP_OIZ'),

            // Visión de cerca
            'vc_esfera_od'  => $this->val($row, $colIndex, 'VISION_CERCA_ESFERA_OD'),
            'vc_cilindro_od'=> $this->val($row, $colIndex, 'VISION_CERCA_Cyl_OD'),
            'vc_eje_od'     => $this->val($row, $colIndex, 'VISION_CERCA_EJE_OD'),
            'vc_av_od'      => $this->val($row, $colIndex, 'VISION_CERCA_AV_OD'),
            'vc_dnp_od'     => $this->val($row, $colIndex, 'VISION_CERCA_DNP_OD'),
            'vc_avcc_od'    => $this->val($row, $colIndex, 'VISION_CERCA_AVCC OD'),
            'vc_esfera_oi'  => $this->val($row, $colIndex, 'VISION_CERCA_ESFERA_OI'),
            'vc_cilindro_oi'=> $this->val($row, $colIndex, 'VISION_CERCA_Cyl_OI'),
            'vc_eje_oi'     => $this->val($row, $colIndex, 'VISION_CERCA_EJE_OI'),
            'vc_av_oi'      => $this->val($row, $colIndex, 'VISION_CERCA_AV_OI'),
            'vc_dnp_oi'     => $this->val($row, $colIndex, 'VISION_CERCA_DNP_OI'),
            'vc_avcc_oi'    => $this->val($row, $colIndex, 'VISION_CERCA_AVCC OI'),

            // Queratometría
            'queratometria_od'           => $this->val($row, $colIndex, 'QUERATOMETRIA_OD'),
            'queratometria_oi'           => $this->val($row, $colIndex, 'QUERATOMETRIA_OI'),
            'queratometria_horizontal_od'=> $this->val($row, $colIndex, 'QUERATOMETRIA_ORIZONTAL_OD'),
            'queratometria_horizontal_oi'=> $this->val($row, $colIndex, 'QUERATOMETRIA_ORIZONTAL_OI'),
            'queratometria_vertical_od'  => $this->val($row, $colIndex, 'QUERATOMETRIA_VERTICAL_OD'),
            'queratometria_vertical_oi'  => $this->val($row, $colIndex, 'QUERATOMETRIA_VERTICAL_OI'),
            'queratometria_eje_od'       => $this->val($row, $colIndex, 'QUERATOMETRIA_EJE_OD'),
            'queratometria_eje_oi'       => $this->val($row, $colIndex, 'QUERATOMETRIA_EJE_OI'),
            'queratometria_miras_od'     => $this->val($row, $colIndex, 'QUERATOMETRIA_MIRAS_OD'),
            'queratometria_miras_oi'     => $this->val($row, $colIndex, 'QUERATOMETRIA_MIRAS_OI'),
            'queratometria_calificacion' => $this->val($row, $colIndex, 'QUERATOMETRIA_CALIFICACION'),

            // Examen externo (Excel dice INTERNO, sistema dice EXTERNO)
            'examen_externo_od' => $this->val($row, $colIndex, 'EXAMEN_INTERNO_OD'),
            'examen_externo_oi' => $this->val($row, $colIndex, 'EXAMEN_INTERNO_OI'),

            // Campos adicionales
            'ark_od'                   => $this->val($row, $colIndex, 'ARK_OD'),
            'ark_oi'                   => $this->val($row, $colIndex, 'ARK_OI'),
            'morfoscopica_lejos_od'    => $this->val($row, $colIndex, 'MORFOSCOPICA_LEJOS_OD'),
            'morfoscopica_lejos_oi'    => $this->val($row, $colIndex, 'MORFOSCOPICA_LEJOS_OI'),
            'morfoscopica_cerca_od'    => $this->val($row, $colIndex, 'MORFOSCOPICA_CERCA_OD'),
            'morfoscopica_cerca_oi'    => $this->val($row, $colIndex, 'MORFOSCOPICA_CERCA_OI'),
            'ph_od'                    => $phOd,
            'ph_oi'                    => $phOi,
            'certificado_diagnostico_od' => $this->val($row, $colIndex, 'CERTIFICADO_ DIAGNOSTICO_OD'),
            'certificado_diagnostico_oi' => $this->val($row, $colIndex, 'CERTIFICADO_ DIAGNOSTICO_OI'),
            'certificado_nota'           => $this->val($row, $colIndex, 'CERTIFICADO_ NOTA'),

            // Pruebas binoculares
            'ducciones_od' => $this->val($row, $colIndex, 'DUC_OD'),
            'ducciones_oi' => $this->val($row, $colIndex, 'DUC_OI'),
            'versiones'    => $versiones,

            // Lunas
            'luna_proteccion' => $this->val($row, $colIndex, 'TRATAMIENTO'),
            'luna_espesor'    => $this->val($row, $colIndex, 'ESPESOR'),

            // Comercial / pedido
            'costo_total'        => $this->numericOrNull($this->val($row, $colIndex, 'COSTO TOTAL')),
            'abono'              => $this->numericOrNull($this->val($row, $colIndex, 'ABONO')),
            'estado_cancelado'   => $estadoCancelado,
            'tipo_lentes'        => $this->val($row, $colIndex, 'TIPO DE LENTES'),
            'color_lentes'       => $this->val($row, $colIndex, 'COLOR'),
            'bifocal'            => $this->val($row, $colIndex, 'BIFOCAL'),
            'espesor'            => $this->val($row, $colIndex, 'ESPESOR'),
            'laboratorio_pedido' => $this->val($row, $colIndex, 'lABORATORIO PARA PEDIDO'),
            'pedido_armazon'     => $this->val($row, $colIndex, 'PEDIDO ARMAZON'),
            'fecha_entrega'      => $fechaEntrega,
            'observacion_pedidos'=> $this->val($row, $colIndex, 'OBSERVACION PEDIDOS'),

            // Texto libre
            'observaciones' => $this->val($row, $colIndex, 'OBSERVACIONES'),
        ]);

        // Módulo de lente de contacto (si hay datos)
        $this->createContactLensModule($consultation, $row, $colIndex);

        // Módulo de oftalmoscopía (si hay datos)
        $this->createOphthalmoscopyModule($consultation, $row, $colIndex);

        // Módulo de tratamiento (si hay datos)
        $this->createTreatmentModule($consultation, $row, $colIndex);

        $this->created++;
    }

    private function createContactLensModule(Consultation $consultation, array $row, array $colIndex): void
    {
        $fields = [
            'diametro_pupilar'  => $this->val($row, $colIndex, 'LENTECONTACTO_DIAMETRO_PUPILAR_OD'),
            'diametro_corneal'  => $this->val($row, $colIndex, 'LENTECONTACTO_DIAMETRO_CORNEAL_OD'),
            'apertura_palpebral'=> $this->val($row, $colIndex, 'LENTECONTACTO_APERTURA PAIPEBRAL_OD'),
            'tension_palpebral' => $this->val($row, $colIndex, 'LENTECONTACTO_TENCION PAIPEBRAL_OD'),
            'ojo_dominante'     => $this->val($row, $colIndex, 'LENTECONTACTO_OJO DOMINANTE_OD'),
            'but_value'         => $this->val($row, $colIndex, 'LENTECONTACTO_BUT'),
            'shirmer_test'      => $this->val($row, $colIndex, 'LENTECONTACTO_SCRIRMER TEST'),
            'frecuencia_parpadeo'=> $this->val($row, $colIndex, 'LENTECONTACTO_FRECUENCIA DE PARPADEO'),
            'observaciones'     => $this->val($row, $colIndex, 'LENTECONTACTO_OBSERVACIONES'),
        ];

        // test_lens JSON con datos de prueba
        $testLens = array_filter([
            'bc_od'        => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_BC_OD'),
            'bc_oi'        => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_BC_OI'),
            'poder_od'     => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_PODER_OD'),
            'poder_oi'     => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_PODER_OI'),
            'diametro_od'  => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_DIAMETRO_OD'),
            'diametro_oi'  => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_DIAMETRO_OI'),
            'material_od'  => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_MATERIAL_OD'),
            'material_oi'  => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_MATERIAL_OI'),
            'h2o_od'       => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_%H2O_OD'),
            'h2o_oi'       => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_%H2O_OI'),
            'sobreref_od'  => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_SOBREREFRACCION_OD'),
            'sobreref_oi'  => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_SOBREREFRACCION_OI'),
            'av_od'        => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_AV_OD'),
            'av_oi'        => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_AV_OI'),
            'calificacion' => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_CALIFICACION'),
            'gas_permeable'=> $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_GAS PERMEABLE'),
            'tipo_lente'   => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_TIPO DE LENTE'),
            'blando'       => $this->val($row, $colIndex, 'LENTECONTACTO_PRUEBA_BLANDO'),
        ]);

        // final_lens JSON con datos del pedido
        $finalLens = array_filter([
            'poder_od'    => $this->val($row, $colIndex, 'LENTECONTACTO_PEDIDO_PODER_OD'),
            'poder_oi'    => $this->val($row, $colIndex, 'LENTECONTACTO_PEDIDO_PODER_OI'),
            'cb_od'       => $this->val($row, $colIndex, 'LENTECONTACTO_PEDIDO_CB_OD'),
            'cb_oi'       => $this->val($row, $colIndex, 'LENTECONTACTO_PEDIDO_CB_OI'),
            'diametro_od' => $this->val($row, $colIndex, 'LENTECONTACTO_PEDIDO_DIAMETRO_OD'),
            'diametro_oi' => $this->val($row, $colIndex, 'LENTECONTACTO_PEDIDO_DIAMETRO_OI'),
            'av_od'       => $this->val($row, $colIndex, 'LENTECONTACTO_PEDIDO_AV_OD'),
            'av_oi'       => $this->val($row, $colIndex, 'LENTECONTACTO_PEDIDO_AV_OI'),
            'color_od'    => $this->val($row, $colIndex, 'LENTECONTACTO_PEDIDO_COLOR_OD'),
            'color_oi'    => $this->val($row, $colIndex, 'LENTECONTACTO_PEDIDO_COLOR_OI'),
            'tipo_lente'  => $this->val($row, $colIndex, 'LENTECONTACTO_PEDIDO_TIPO DE LENTE'),
        ]);

        if (! empty($testLens)) {
            $fields['test_lens'] = $testLens;
        }
        if (! empty($finalLens)) {
            $fields['final_lens'] = $finalLens;
        }

        $hasData = collect($fields)->filter(fn ($v) => ! is_null($v) && $v !== '')->isNotEmpty();
        if ($hasData) {
            ConsultationContactLensModule::create(
                array_merge(['consultation_id' => $consultation->id], $fields)
            );
        }
    }

    private function createOphthalmoscopyModule(Consultation $consultation, array $row, array $colIndex): void
    {
        $fields = [
            'fijacion_od'      => $this->val($row, $colIndex, 'LENTECONTACTO_OFTALMOSCOPIA/5_FIJACION_OD'),
            'fijacion_oi'      => $this->val($row, $colIndex, 'LENTECONTACTO_OFTALMOSCOPIA/5_FIJACION_OI'),
            'valoracion_motora'=> $this->val($row, $colIndex, 'LENTECONTACTO_VALORACION MOTORA_TEST UTILIZADO'),
            'ppc_obj'          => $this->val($row, $colIndex, 'LENTES DE CONTACTO_PPC_OBJ'),
            'luz'              => $this->val($row, $colIndex, 'LENTES DE CONTACTO_LUZ'),
            'fr'               => $this->val($row, $colIndex, 'LENTES DE CONTACTO_FR'),
        ];

        $hasData = collect($fields)->filter(fn ($v) => ! is_null($v) && $v !== '')->isNotEmpty();
        if ($hasData) {
            ConsultationOphthalmoscopyModule::create(
                array_merge(['consultation_id' => $consultation->id], $fields)
            );
        }
    }

    private function createTreatmentModule(Consultation $consultation, array $row, array $colIndex): void
    {
        $fields = [
            'plan'            => $this->val($row, $colIndex, 'LENTES DE CONTACTO_PLAN DE TRATAMIENTO'),
            'horas_uso'       => $this->val($row, $colIndex, 'LENTES DE CONTACTO_HORAS DE USO'),
            'metodo_limpieza' => $this->val($row, $colIndex, 'LENTES DE CONTACTO_METODO DE LIMPIEZA'),
            'modalidad_uso'   => $this->val($row, $colIndex, 'LENTES DE CONTACTO_MODALIDAD DE USO'),
        ];

        $hasData = collect($fields)->filter(fn ($v) => ! is_null($v) && $v !== '')->isNotEmpty();
        if ($hasData) {
            ConsultationTreatmentModule::create(
                array_merge(['consultation_id' => $consultation->id], $fields)
            );
        }
    }

    // Obtener valor de la fila por nombre de columna (colIndex mapea nombre→letra)
    private function val(array $row, array $colIndex, string $colName): ?string
    {
        if (! isset($colIndex[$colName])) {
            return null;
        }
        $colLetter = $colIndex[$colName];
        $value = $row[$colLetter] ?? null;
        if ($value === null || $value === '') {
            return null;
        }
        return trim((string) $value);
    }

    private function parseDate(?string $value): ?string
    {
        if (empty($value)) {
            return null;
        }
        // Formato "2019-02-13 00:00:00" o "2019-02-13"
        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable) {
            // Si es número de serie de Excel
            if (is_numeric($value)) {
                try {
                    return ExcelDate::excelToDateTimeObject((float) $value)->format('Y-m-d');
                } catch (\Throwable) {
                    return null;
                }
            }
            return null;
        }
    }

    private function numericOrNull(?string $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        $cleaned = str_replace([',', ' '], ['.', ''], $value);
        return is_numeric($cleaned) ? (float) $cleaned : null;
    }

    private function mergeFields(?string $a, ?string $b): ?string
    {
        $parts = array_filter([$a, $b]);
        return empty($parts) ? null : implode(' / ', $parts);
    }
}
