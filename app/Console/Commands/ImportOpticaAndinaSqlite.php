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
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PDO;
use Throwable;

class ImportOpticaAndinaSqlite extends Command
{
    protected $signature = 'import:optica-andina-sqlite
                            {database : Ruta al archivo SQLite exportado del sistema anterior}
                            {--only=all : all, users, patients, consultations}
                            {--user-id= : ID del usuario creador de los registros importados}
                            {--replace : Actualiza registros importados existentes}
                            {--reset-placeholder-import : Elimina consultas/pacientes placeholder de importaciones anteriores antes de importar}
                            {--prune-placeholders : Elimina placeholders importados que queden sin consultas}
                            {--json-summary= : Ruta opcional para escribir resumen JSON estructurado}
                            {--dry-run : Solo reportar, no guardar en BD}';

    protected $description = 'Importa clientes, medicos e historias desde el backup SQLite de Optica Andina';

    private PDO $source;

    private bool $dryRun = false;

    private bool $replace = false;

    private int $createdBy = 0;

    private array $patientByCedula = [];

    private array $userByCode = [];

    private array $stats = [
        'users_created' => 0,
        'users_updated' => 0,
        'users_skipped' => 0,
        'patients_created' => 0,
        'patients_updated' => 0,
        'patients_skipped' => 0,
        'consultations_created' => 0,
        'consultations_updated' => 0,
        'consultations_skipped' => 0,
        'placeholder_patients_created' => 0,
        'previous_consultations_removed' => 0,
        'previous_placeholders_removed' => 0,
        'placeholders_pruned' => 0,
        'errors' => 0,
    ];

    private array $errors = [];

    public function handle(): int
    {
        ini_set('memory_limit', '1G');
        DB::disableQueryLog();

        $path = (string) $this->argument('database');
        $this->dryRun = (bool) $this->option('dry-run');
        $this->replace = (bool) $this->option('replace');

        if (! is_file($path)) {
            $this->error("Archivo no encontrado: {$path}");

            return Command::FAILURE;
        }

        $only = strtolower((string) $this->option('only'));
        $allowed = ['all', 'users', 'patients', 'consultations'];
        if (! in_array($only, $allowed, true)) {
            $this->error('--only debe ser: '.implode(', ', $allowed));

            return Command::FAILURE;
        }

        $this->source = new PDO('sqlite:'.$path);
        $this->source->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->source->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        foreach (['CLIENTES', 'HISTORIAL OPTAMOLOGIA', 'MEDICOS'] as $table) {
            if (! $this->tableExists($table)) {
                $this->error("La tabla requerida no existe en el backup: {$table}");

                return Command::FAILURE;
            }
        }

        if ($this->dryRun) {
            $this->warn('MODO DRY-RUN activo: no se guardaran cambios.');
        }

        $this->createdBy = $this->resolveCreatorId();
        $this->loadUserMap();
        $this->loadPatientMap();

        if ((bool) $this->option('reset-placeholder-import')) {
            $this->resetPreviousPlaceholderImport();
            $this->loadPatientMap();
        }

        if ($only === 'all' || $only === 'users') {
            $this->importUsers();
            $this->loadUserMap();
        }

        if ($only === 'all' || $only === 'patients') {
            $this->importPatients();
            $this->loadPatientMap();
        }

        if ($only === 'all' || $only === 'consultations') {
            $this->importConsultations();
            $this->refreshPatientCrmStats();
        }

        if ((bool) $this->option('prune-placeholders')) {
            $this->pruneEmptyPlaceholders();
        }

        $this->printSummary();
        $this->writeJsonSummary();

        return $this->stats['errors'] > 0 ? Command::FAILURE : Command::SUCCESS;
    }

    private function importUsers(): void
    {
        $total = $this->countRows('MEDICOS');
        $this->info("Importando medicos/optometras ({$total})...");

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        foreach ($this->rows('MEDICOS') as $row) {
            $bar->advance();

            try {
                $name = $this->limit($this->v($row, 'MED_NOMBRE APELLIDOS'), 255);
                if ($name === null) {
                    $this->stats['users_skipped']++;

                    continue;
                }

                $code = $this->limit($this->v($row, 'MED_CODIGO') ?? $this->v($row, 'Id'), 50);
                $email = $this->emailOrGenerated($this->v($row, 'MED_ORREO'), $code ?? $this->v($row, 'Id'));
                $registration = $this->limit($this->v($row, 'CODIGO DE SALUD') ?? $this->v($row, 'MED_UMERO DE CED'), 100);

                if ($this->dryRun) {
                    User::where('email', $email)->orWhere('codigo', $code)->exists()
                        ? $this->stats['users_updated']++
                        : $this->stats['users_created']++;

                    continue;
                }

                $user = User::where('codigo', $code)->first() ?? User::where('email', $email)->first();
                if (! $user) {
                    User::create([
                        'name' => $name,
                        'email' => $email,
                        'password' => Hash::make(Str::random(32)),
                        'role' => 'optometra',
                        'codigo' => $code,
                        'registro_senescyt' => $registration,
                    ]);
                    $this->stats['users_created']++;

                    continue;
                }

                if (! $this->replace) {
                    $this->stats['users_skipped']++;

                    continue;
                }

                $user->fill([
                    'name' => $name,
                    'role' => 'optometra',
                    'codigo' => $code,
                    'registro_senescyt' => $registration,
                ])->save();
                $this->stats['users_updated']++;
            } catch (Throwable $e) {
                $this->recordError('MEDICOS', $this->v($row, 'Id'), $e);
            }
        }

        $bar->finish();
        $this->newLine(2);
    }

    private function importPatients(): void
    {
        $total = $this->countRows('CLIENTES');
        $this->info("Importando clientes ({$total})...");

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        foreach ($this->rows('CLIENTES') as $row) {
            $bar->advance();

            try {
                $legacyId = $this->v($row, 'Id');
                if ($legacyId === null) {
                    $this->stats['patients_skipped']++;

                    continue;
                }

                if ($this->dryRun) {
                    Patient::where('legacy_id', $legacyId)->exists()
                        ? $this->stats['patients_updated']++
                        : $this->stats['patients_created']++;

                    continue;
                }

                Model::withoutEvents(function () use ($row, $legacyId): void {
                    $this->storePatient($row, $legacyId);
                });
            } catch (Throwable $e) {
                $this->recordError('CLIENTES', $this->v($row, 'Id'), $e);
            }
        }

        $bar->finish();
        $this->newLine(2);
    }

    private function importConsultations(): void
    {
        $total = $this->countRows('HISTORIAL OPTAMOLOGIA');
        $this->info("Importando historias clinicas ({$total})...");

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        foreach ($this->rows('HISTORIAL OPTAMOLOGIA') as $row) {
            $bar->advance();

            try {
                $legacyId = $this->v($row, 'Id');
                if ($legacyId === null) {
                    $this->stats['consultations_skipped']++;

                    continue;
                }

                if ($this->dryRun) {
                    Consultation::where('legacy_id', $legacyId)->exists()
                        ? $this->stats['consultations_updated']++
                        : $this->stats['consultations_created']++;

                    continue;
                }

                DB::transaction(function () use ($row, $legacyId): void {
                    Model::withoutEvents(function () use ($row, $legacyId): void {
                        $this->storeConsultation($row, $legacyId);
                    });
                });
            } catch (Throwable $e) {
                $this->recordError('HISTORIAL OPTAMOLOGIA', $this->v($row, 'Id'), $e);
            }
        }

        $bar->finish();
        $this->newLine(2);
    }

    private function storePatient(array $row, string $legacyId): Patient
    {
        $originalCedula = $this->cleanCedula($this->v($row, 'CLIE_CEDULA'));
        $patient = Patient::where('legacy_id', $legacyId)->first();

        if (! $patient && $this->usableCedula($originalCedula)) {
            $patient = Patient::where('cedula', $originalCedula)->first();
        }

        $isNew = ! $patient;
        $patient ??= new Patient;

        $cedula = $this->uniqueCedula(
            $this->usableCedula($originalCedula) ? $originalCedula : null,
            "IMPORT-{$legacyId}",
            $patient->exists ? $patient->id : null
        );

        $name = $this->limit(
            $this->v($row, 'CLIE_APELLIDOS NOMBRES') ?? $this->v($row, 'CLIE_NOMBRES') ?? "Paciente {$legacyId}",
            255
        );

        $data = [
            'nombre' => $name,
            'cedula' => $cedula,
            'codigo_interno' => $this->uniqueInternalCode("OA-{$legacyId}", $patient->exists ? $patient->id : null),
            'legacy_id' => $legacyId,
            'fecha_nacimiento' => $this->birthDate($this->v($row, 'CLIE_FECH_NACIMEINTO'), $this->v($row, 'cliente_edad') ?? $this->v($row, 'CLIE_EDAD')),
            'ocupacion' => $this->limit($this->v($row, 'CLIE_PROFECION') ?? $this->v($row, 'CLIE_LUGAR DE TRABAJO'), 255),
            'direccion' => $this->v($row, 'CLIE_DOMICILIO'),
            'telefono' => $this->limit($this->firstValue($row, ['CLIE_TELEFONO1', 'CLIE_TELEFONO2', 'CLIE_TELEFONO3']), 20),
            'email' => $this->limit($this->validEmail($this->v($row, 'CLIE_CORREO')), 255),
            'antecedentes' => $this->v($row, 'CLIE_ANTECEDENTES'),
            'created_by' => $this->createdBy ?: null,
            'customer_type' => 'particular',
            'preferred_contact' => 'whatsapp',
            'last_purchase_at' => $this->dateTimeOrNull($this->v($row, 'CLIE_ULTIMO CONTROL') ?? $this->v($row, 'CLIE_FECHA_ACTUAL')),
            'internal_notes' => $this->patientNotes($row, $legacyId, $originalCedula, $cedula),
        ];

        if ($isNew || $this->replace || $this->isImportedPlaceholder($patient)) {
            $patient->fill($data)->save();
            $isNew ? $this->stats['patients_created']++ : $this->stats['patients_updated']++;
        } else {
            $patient->fill(array_filter($data, fn ($value, $key) => $patient->{$key} === null && $value !== null, ARRAY_FILTER_USE_BOTH));
            $patient->legacy_id = $patient->legacy_id ?: $legacyId;
            $patient->save();
            $this->stats['patients_updated']++;
        }

        if ($this->usableCedula($originalCedula)) {
            $this->patientByCedula[$originalCedula] = $patient->id;
        }
        $this->patientByCedula[$patient->cedula] = $patient->id;

        return $patient;
    }

    private function storeConsultation(array $row, string $legacyId): Consultation
    {
        $consultation = Consultation::where('legacy_id', $legacyId)->first();
        $isNew = ! $consultation;

        if ($consultation && ! $this->replace) {
            $this->stats['consultations_skipped']++;

            return $consultation;
        }

        $consultation ??= new Consultation;
        $patient = $this->patientForConsultation($row, $legacyId);
        $optometristId = $this->optometristId($this->v($row, 'MEDICO_RESPONSABLE'));

        $verOd = $this->v($row, 'VER_OD');
        $verOi = $this->v($row, 'VER_OI');
        $phOd = $this->mergeFields($this->v($row, 'PH_OD'), $this->v($row, 'PH_OD1'));
        $phOi = $this->mergeFields($this->v($row, 'PH_OI'), $this->v($row, 'PH_OI1'));

        $consultation->fill([
            'legacy_id' => $legacyId,
            'patient_id' => $patient->id,
            'optometrista_id' => $optometristId,
            'created_by' => $this->createdBy ?: null,
            'fecha_consulta' => $this->dateOrNull($this->v($row, 'FECHA')) ?? now()->toDateString(),
            'ultimo_control' => $this->dateOrNull($this->v($row, 'ULTIMO CONTROL')),
            'estado' => 'completada',
            'estado_lentes' => $this->limit($this->v($row, 'ESTADO DE LENTES'), 50),
            'motivo_consulta' => $this->v($row, 'MOTIVO DE COPNSULTA'),
            'av_lectura_od' => $this->limit($this->v($row, 'LECTURA COMPUTADOR'), 20),
            'av_lectura_oi' => $this->limit($this->v($row, 'LECTURA COMPUTADOR OI'), 20),
            'avsc_od' => $this->limit($this->v($row, 'AVSC_LEJOS_DERECHA'), 20),
            'avsc_oi' => $this->limit($this->v($row, 'AVSC_LEJOS_IZQUIERDA'), 20),
            'avsc_cerca_od' => $this->limit($this->v($row, 'AVSC_CERCA_DERECHA'), 20),
            'avsc_cerca_oi' => $this->limit($this->v($row, 'AVSC_CERCA_IZQUIERDA'), 20),
            'avcc_od' => $this->limit($this->v($row, 'AVCC_LEJOS_DERECHA'), 20),
            'avcc_oi' => $this->limit($this->v($row, 'AVCC_LEJOS_IZQUIERDA'), 20),
            'avcc_cerca_od' => $this->limit($this->v($row, 'AVCC_CERCA_DERECHA'), 20),
            'avcc_cerca_oi' => $this->limit($this->v($row, 'AVCC_CERCA_IZQUIERDA'), 20),
            'retinoscopia_od' => $this->limit($this->v($row, 'RETINOSCOPIA_OD'), 20),
            'retinoscopia_oi' => $this->limit($this->v($row, 'RETINOSCOPIA_OI'), 20),
            'retinoscopia_esfera_od' => $this->limit($this->v($row, 'RETINOSCOPIA_ESFERA_OD'), 20),
            'retinoscopia_esfera_oi' => $this->limit($this->v($row, 'RETINOSCOPIA_ESFERA_OI'), 20),
            'retinoscopia_cilindro_od' => $this->limit($this->v($row, 'RETINOSCOPIA_CILINDRO_OD'), 20),
            'retinoscopia_cilindro_oi' => $this->limit($this->v($row, 'RETINOSCOPIA_CILINDRO_OI'), 20),
            'retinoscopia_eje_od' => $this->limit($this->v($row, 'RETINOSCOPIA_EJE_OD'), 20),
            'retinoscopia_eje_oi' => $this->limit($this->v($row, 'RETINOSCOPIA_EJE_OI'), 20),
            'retinoscopia_ppc' => $this->limit($this->v($row, 'RETINOSCOPIA_PPC'), 50),
            'cover_test' => $this->limit($this->v($row, 'RETINOSCOPIA_COVER TEST'), 100),
            'rx_uso_esfera_od' => $this->decimal($this->v($row, 'RX_EN USO_ESFERA_OD')),
            'rx_uso_cilindro_od' => $this->decimal($this->v($row, 'RX_EN USO_CILINDRO_OD')),
            'rx_uso_eje_od' => $this->integer($this->v($row, 'RX_EN USO_EJE_OD')),
            'rx_uso_add_od' => $this->decimal($this->v($row, 'RX_EN USO_ADD_OD')),
            'rx_uso_avcc_od' => $this->limit($this->v($row, 'RX_EN USO_AVCC_OD'), 20),
            'rx_uso_esfera_oi' => $this->decimal($this->v($row, 'RX_EN USO_ESFERA_OI')),
            'rx_uso_cilindro_oi' => $this->decimal($this->v($row, 'RX_EN USO_CILINDRO_OI')),
            'rx_uso_eje_oi' => $this->integer($this->v($row, 'RX_EN USO_EJE_OI')),
            'rx_uso_add_oi' => $this->decimal($this->v($row, 'RX_EN USO_ADD_OI')),
            'rx_uso_avcc_oi' => $this->limit($this->v($row, 'RX_EN USO_AVCC_OI'), 20),
            'subj_esfera_od' => $this->decimal($this->v($row, 'RXPARCIAL_ESFERA_OD')),
            'subj_cilindro_od' => $this->decimal($this->v($row, 'RXPARCIAL_CILINDRO_OD')),
            'subj_eje_od' => $this->integer($this->v($row, 'RXPARCIAL_EJE_OD')),
            'subj_avl_od' => $this->limit($this->v($row, 'RXPARCIAL_AVL_OD'), 20),
            'subj_add_od' => $this->limit($this->v($row, 'RXPARCIAL_ADD_OD'), 20),
            'subj_avc_od' => $this->limit($this->v($row, 'RXPARCIAL_AVC_OD'), 20),
            'subj_esfera_oi' => $this->decimal($this->v($row, 'RXPARCIAL_ESFERA_OI')),
            'subj_cilindro_oi' => $this->decimal($this->v($row, 'RXPARCIAL_CILINDRO_OI')),
            'subj_eje_oi' => $this->integer($this->v($row, 'RXPARCIAL_EJE_OI')),
            'subj_avl_oi' => $this->limit($this->v($row, 'RXPARCIAL_AVL_OI'), 20),
            'subj_add_oi' => $this->limit($this->v($row, 'RXPARCIAL_ADD_OI'), 20),
            'subj_avc_oi' => $this->limit($this->v($row, 'RXPARCIAL_AVC_OI'), 20),
            'subj_dp' => $this->limit($this->v($row, 'RXPARCIAL_DP'), 20),
            'rx_final_esfera_od' => $this->decimal($this->v($row, 'RX_FINAL_OD_ESFRERA')),
            'rx_final_cilindro_od' => $this->decimal($this->v($row, 'RX_FINAL_OD_CILINDRO')),
            'rx_final_eje_od' => $this->integer($this->v($row, 'RX_FINAL_OD_EJE')),
            'rx_final_add_od' => $this->decimal($this->v($row, 'RX_FINAL_OD_ADD')),
            'rx_final_avl_od' => $this->limit($this->v($row, 'RX_FINAL_OD_AVL'), 20),
            'rx_final_dnp_od' => $this->limit($this->v($row, 'RX_FINAL_DNP_OD'), 20),
            'rx_final_esfera_oi' => $this->decimal($this->v($row, 'RX_FINAL_OI_ESFRERA')),
            'rx_final_cilindro_oi' => $this->decimal($this->v($row, 'RX_FINAL_OI_CILINDRO')),
            'rx_final_eje_oi' => $this->integer($this->v($row, 'RX_FINAL_OI_EJE')),
            'rx_final_add_oi' => $this->decimal($this->v($row, 'RX_FINAL_OI_ADD')),
            'rx_final_avl_oi' => $this->limit($this->v($row, 'RX_FINAL_OI_AVL'), 20),
            'rx_final_dnp_oi' => $this->limit($this->v($row, 'RX_FINAL_DNP_OIZ'), 20),
            'vc_esfera_od' => $this->decimal($this->v($row, 'VISION_CERCA_ESFERA_OD')),
            'vc_cilindro_od' => $this->decimal($this->v($row, 'VISION_CERCA_Cyl_OD')),
            'vc_eje_od' => $this->integer($this->v($row, 'VISION_CERCA_EJE_OD')),
            'vc_av_od' => $this->limit($this->v($row, 'VISION_CERCA_AV_OD'), 20),
            'vc_dnp_od' => $this->limit($this->v($row, 'VISION_CERCA_DNP_OD'), 20),
            'vc_avcc_od' => $this->limit($this->v($row, 'VISION_CERCA_AVCC OD'), 20),
            'vc_esfera_oi' => $this->decimal($this->v($row, 'VISION_CERCA_ESFERA_OI')),
            'vc_cilindro_oi' => $this->decimal($this->v($row, 'VISION_CERCA_Cyl_OI')),
            'vc_eje_oi' => $this->integer($this->v($row, 'VISION_CERCA_EJE_OI')),
            'vc_av_oi' => $this->limit($this->v($row, 'VISION_CERCA_AV_OI'), 20),
            'vc_dnp_oi' => $this->limit($this->v($row, 'VISION_CERCA_DNP_OI'), 20),
            'vc_avcc_oi' => $this->limit($this->v($row, 'VISION_CERCA_AVCC OI'), 20),
            'queratometria_od' => $this->limit($this->v($row, 'QUERATOMETRIA_OD'), 100),
            'queratometria_oi' => $this->limit($this->v($row, 'QUERATOMETRIA_OI'), 100),
            'queratometria_horizontal_od' => $this->limit($this->v($row, 'QUERATOMETRIA_ORIZONTAL_OD'), 20),
            'queratometria_horizontal_oi' => $this->limit($this->v($row, 'QUERATOMETRIA_ORIZONTAL_OI'), 20),
            'queratometria_vertical_od' => $this->limit($this->v($row, 'QUERATOMETRIA_VERTICAL_OD'), 20),
            'queratometria_vertical_oi' => $this->limit($this->v($row, 'QUERATOMETRIA_VERTICAL_OI'), 20),
            'queratometria_eje_od' => $this->limit($this->v($row, 'QUERATOMETRIA_EJE_OD'), 20),
            'queratometria_eje_oi' => $this->limit($this->v($row, 'QUERATOMETRIA_EJE_OI'), 20),
            'queratometria_miras_od' => $this->limit($this->v($row, 'QUERATOMETRIA_MIRAS_OD'), 50),
            'queratometria_miras_oi' => $this->limit($this->v($row, 'QUERATOMETRIA_MIRAS_OI'), 50),
            'queratometria_calificacion' => $this->limit($this->v($row, 'QUERATOMETRIA_CALIFICACION'), 50),
            'examen_externo_od' => $this->v($row, 'EXAMEN_INTERNO_OD'),
            'examen_externo_oi' => $this->v($row, 'EXAMEN_INTERNO_OI'),
            'ark_od' => $this->limit($this->v($row, 'ARK_OD'), 50),
            'ark_oi' => $this->limit($this->v($row, 'ARK_OI'), 50),
            'morfoscopica_lejos_od' => $this->limit($this->v($row, 'MORFOSCOPICA_LEJOS_OD'), 50),
            'morfoscopica_lejos_oi' => $this->limit($this->v($row, 'MORFOSCOPICA_LEJOS_OI'), 50),
            'morfoscopica_cerca_od' => $this->limit($this->v($row, 'MORFOSCOPICA_CERCA_OD'), 50),
            'morfoscopica_cerca_oi' => $this->limit($this->v($row, 'MORFOSCOPICA_CERCA_OI'), 50),
            'ph_od' => $this->limit($phOd, 20),
            'ph_oi' => $this->limit($phOi, 20),
            'certificado_diagnostico_od' => $this->limit($this->v($row, 'CERTIFICADO_ DIAGNOSTICO_OD'), 100),
            'certificado_diagnostico_oi' => $this->limit($this->v($row, 'CERTIFICADO_ DIAGNOSTICO_OI'), 100),
            'certificado_nota' => $this->v($row, 'CERTIFICADO_ NOTA'),
            'ducciones_od' => $this->limit($this->v($row, 'DUC_OD'), 100),
            'ducciones_oi' => $this->limit($this->v($row, 'DUC_OI'), 100),
            'versiones' => $this->limit($this->mergeFields($verOd, $verOi), 100),
            'luna_proteccion' => $this->limit($this->v($row, 'TRATAMIENTO'), 100),
            'luna_espesor' => $this->limit($this->v($row, 'ESPESOR'), 100),
            'costo_total' => $this->decimal($this->v($row, 'COSTO TOTAL')),
            'abono' => $this->decimal($this->v($row, 'ABONO')),
            'estado_cancelado' => $this->booleanOrNull($this->v($row, 'ESTADO CANCELADO_S/N')),
            'tipo_lentes' => $this->limit($this->v($row, 'TIPO DE LENTES'), 100),
            'color_lentes' => $this->limit($this->v($row, 'COLOR'), 50),
            'bifocal' => $this->limit($this->v($row, 'BIFOCAL'), 50),
            'espesor' => $this->limit($this->v($row, 'ESPESOR'), 100),
            'laboratorio_pedido' => $this->limit($this->v($row, 'lABORATORIO PARA PEDIDO'), 100),
            'pedido_armazon' => $this->limit($this->v($row, 'PEDIDO ARMAZON'), 100),
            'fecha_entrega' => $this->dateOrNull($this->v($row, 'FECHA DE ENTREGA')),
            'observacion_pedidos' => $this->v($row, 'OBSERVACION PEDIDOS'),
            'observaciones' => $this->v($row, 'OBSERVACIONES'),
        ])->save();

        $this->upsertContactLensModule($consultation, $row);
        $this->upsertOphthalmoscopyModule($consultation, $row);
        $this->upsertTreatmentModule($consultation, $row);

        $isNew ? $this->stats['consultations_created']++ : $this->stats['consultations_updated']++;

        return $consultation;
    }

    private function patientForConsultation(array $row, string $legacyId): Patient
    {
        $cedula = $this->cleanCedula($this->v($row, 'ced_optometria'));
        if ($cedula !== null && isset($this->patientByCedula[$cedula])) {
            return Patient::findOrFail($this->patientByCedula[$cedula]);
        }

        if ($cedula !== null) {
            $patient = Patient::where('cedula', $cedula)->first();
            if ($patient) {
                $this->patientByCedula[$cedula] = $patient->id;

                return $patient;
            }
        }

        $placeholderLegacyId = "HIST-PAT-{$legacyId}";
        $patient = Patient::where('legacy_id', $placeholderLegacyId)->first();
        if ($patient) {
            return $patient;
        }

        $patient = Patient::create([
            'nombre' => $cedula ? "Paciente importado {$cedula}" : "Paciente importado {$legacyId}",
            'cedula' => $this->uniqueCedula(null, "HIST-{$legacyId}"),
            'codigo_interno' => $this->uniqueInternalCode("OA-HIST-{$legacyId}"),
            'legacy_id' => $placeholderLegacyId,
            'fecha_nacimiento' => '2000-01-01',
            'created_by' => $this->createdBy ?: null,
            'customer_type' => 'particular',
            'preferred_contact' => 'whatsapp',
            'internal_notes' => trim("Placeholder creado durante importacion de historia {$legacyId}. Cedula legacy: {$cedula}"),
        ]);

        if ($cedula !== null) {
            $this->patientByCedula[$cedula] = $patient->id;
        }
        $this->patientByCedula[$patient->cedula] = $patient->id;
        $this->stats['placeholder_patients_created']++;

        return $patient;
    }

    private function upsertContactLensModule(Consultation $consultation, array $row): void
    {
        $fields = [
            'diametro_pupilar' => $this->limit($this->v($row, 'LENTECONTACTO_DIAMETRO_PUPILAR_OD'), 50),
            'diametro_corneal' => $this->limit($this->v($row, 'LENTECONTACTO_DIAMETRO_CORNEAL_OD'), 50),
            'apertura_palpebral' => $this->limit($this->v($row, 'LENTECONTACTO_APERTURA PAIPEBRAL_OD'), 50),
            'tension_palpebral' => $this->limit($this->v($row, 'LENTECONTACTO_TENCION PAIPEBRAL_OD'), 50),
            'ojo_dominante' => $this->limit($this->v($row, 'LENTECONTACTO_OJO DOMINANTE_OD'), 10),
            'but_value' => $this->limit($this->v($row, 'LENTECONTACTO_BUT'), 50),
            'shirmer_test' => $this->limit($this->v($row, 'LENTECONTACTO_SCRIRMER TEST'), 50),
            'frecuencia_parpadeo' => $this->limit($this->v($row, 'LENTECONTACTO_FRECUENCIA DE PARPADEO'), 50),
            'observaciones' => $this->v($row, 'LENTECONTACTO_OBSERVACIONES'),
        ];

        $testLens = $this->compactValues([
            'bc_od' => $this->v($row, 'LENTECONTACTO_PRUEBA_BC_OD'),
            'bc_oi' => $this->v($row, 'LENTECONTACTO_PRUEBA_BC_OI'),
            'poder_od' => $this->v($row, 'LENTECONTACTO_PRUEBA_PODER_OD'),
            'poder_oi' => $this->v($row, 'LENTECONTACTO_PRUEBA_PODER_OI'),
            'diametro_od' => $this->v($row, 'LENTECONTACTO_PRUEBA_DIAMETRO_OD'),
            'diametro_oi' => $this->v($row, 'LENTECONTACTO_PRUEBA_DIAMETRO_OI'),
            'material_od' => $this->v($row, 'LENTECONTACTO_PRUEBA_MATERIAL_OD'),
            'material_oi' => $this->v($row, 'LENTECONTACTO_PRUEBA_MATERIAL_OI'),
            'h2o_od' => $this->v($row, 'LENTECONTACTO_PRUEBA_%H2O_OD'),
            'h2o_oi' => $this->v($row, 'LENTECONTACTO_PRUEBA_%H2O_OI'),
            'sobreref_od' => $this->v($row, 'LENTECONTACTO_PRUEBA_SOBREREFRACCION_OD'),
            'sobreref_oi' => $this->v($row, 'LENTECONTACTO_PRUEBA_SOBREREFRACCION_OI'),
            'av_od' => $this->v($row, 'LENTECONTACTO_PRUEBA_AV_OD'),
            'av_oi' => $this->v($row, 'LENTECONTACTO_PRUEBA_AV_OI'),
            'calificacion' => $this->v($row, 'LENTECONTACTO_PRUEBA_CALIFICACION'),
            'gas_permeable' => $this->v($row, 'LENTECONTACTO_PRUEBA_GAS PERMEABLE'),
            'tipo_lente' => $this->v($row, 'LENTECONTACTO_PRUEBA_TIPO DE LENTE'),
            'blando' => $this->v($row, 'LENTECONTACTO_PRUEBA_BLANDO'),
        ]);

        $finalLens = $this->compactValues([
            'poder_od' => $this->v($row, 'LENTECONTACTO_PEDIDO_PODER_OD'),
            'poder_oi' => $this->v($row, 'LENTECONTACTO_PEDIDO_PODER_OI'),
            'cb_od' => $this->v($row, 'LENTECONTACTO_PEDIDO_CB_OD'),
            'cb_oi' => $this->v($row, 'LENTECONTACTO_PEDIDO_CB_OI'),
            'diametro_od' => $this->v($row, 'LENTECONTACTO_PEDIDO_DIAMETRO_OD'),
            'diametro_oi' => $this->v($row, 'LENTECONTACTO_PEDIDO_DIAMETRO_OI'),
            'av_od' => $this->v($row, 'LENTECONTACTO_PEDIDO_AV_OD'),
            'av_oi' => $this->v($row, 'LENTECONTACTO_PEDIDO_AV_OI'),
            'color_od' => $this->v($row, 'LENTECONTACTO_PEDIDO_COLOR_OD'),
            'color_oi' => $this->v($row, 'LENTECONTACTO_PEDIDO_COLOR_OI'),
            'tipo_lente' => $this->v($row, 'LENTECONTACTO_PEDIDO_TIPO DE LENTE'),
        ]);

        if ($testLens !== []) {
            $fields['test_lens'] = $testLens;
        }
        if ($finalLens !== []) {
            $fields['final_lens'] = $finalLens;
        }

        if (! $this->hasAnyValue($fields)) {
            return;
        }

        ConsultationContactLensModule::updateOrCreate(
            ['consultation_id' => $consultation->id],
            $fields
        );
    }

    private function upsertOphthalmoscopyModule(Consultation $consultation, array $row): void
    {
        $fields = [
            'fijacion_od' => $this->limit($this->v($row, 'LENTECONTACTO_OFTALMOSCOPIA/5_FIJACION_OD'), 100),
            'fijacion_oi' => $this->limit($this->v($row, 'LENTECONTACTO_OFTALMOSCOPIA/5_FIJACION_OI'), 100),
            'valoracion_motora' => $this->limit($this->v($row, 'LENTECONTACTO_VALORACION MOTORA_TEST UTILIZADO'), 100),
            'ppc_obj' => $this->limit($this->v($row, 'LENTES DE CONTACTO_PPC_OBJ'), 100),
            'luz' => $this->limit($this->v($row, 'LENTES DE CONTACTO_LUZ'), 100),
            'fr' => $this->limit($this->v($row, 'LENTES DE CONTACTO_FR'), 100),
        ];

        if (! $this->hasAnyValue($fields)) {
            return;
        }

        ConsultationOphthalmoscopyModule::updateOrCreate(
            ['consultation_id' => $consultation->id],
            $fields
        );
    }

    private function upsertTreatmentModule(Consultation $consultation, array $row): void
    {
        $fields = [
            'plan' => $this->v($row, 'LENTES DE CONTACTO_PLAN DE TRATAMIENTO'),
            'horas_uso' => $this->limit($this->v($row, 'LENTES DE CONTACTO_HORAS DE USO'), 100),
            'metodo_limpieza' => $this->limit($this->v($row, 'LENTES DE CONTACTO_METODO DE LIMPIEZA'), 100),
            'modalidad_uso' => $this->limit($this->v($row, 'LENTES DE CONTACTO_MODALIDAD DE USO'), 100),
        ];

        if (! $this->hasAnyValue($fields)) {
            return;
        }

        ConsultationTreatmentModule::updateOrCreate(
            ['consultation_id' => $consultation->id],
            $fields
        );
    }

    private function refreshPatientCrmStats(): void
    {
        if ($this->dryRun) {
            return;
        }

        $this->info('Actualizando metricas CRM de pacientes...');

        DB::statement(<<<'SQL'
            update patients
            set
                visit_count = (
                    select count(*)
                    from consultations
                    where consultations.patient_id = patients.id
                      and consultations.deleted_at is null
                ),
                last_purchase_at = (
                    select max(fecha_consulta)
                    from consultations
                    where consultations.patient_id = patients.id
                      and consultations.deleted_at is null
                ),
                total_spent = coalesce((
                    select sum(costo_total)
                    from consultations
                    where consultations.patient_id = patients.id
                      and consultations.deleted_at is null
                ), 0)
        SQL);
    }

    private function pruneEmptyPlaceholders(): void
    {
        $query = Patient::where(function ($query): void {
            $query->where(function ($query): void {
                $query->where('cedula', 'like', 'IMPORT-%')
                    ->where('nombre', 'like', 'Paciente Pendiente #%');
            })
                ->orWhere('cedula', 'like', 'HIST-%')
                ->orWhere('legacy_id', 'like', 'HIST-PAT-%')
                ->orWhere('nombre', 'like', 'Paciente Pendiente #%');
        })->whereDoesntHave('consultations');

        $count = (clone $query)->count();
        if ($this->dryRun) {
            $this->stats['placeholders_pruned'] = $count;

            return;
        }

        $query->select('id')->chunkById(500, function ($patients): void {
            $ids = $patients->pluck('id');
            DB::table('patients')->whereIn('id', $ids)->delete();
            $this->stats['placeholders_pruned'] += $ids->count();
        });
    }

    private function resetPreviousPlaceholderImport(): void
    {
        $consultationQuery = Consultation::whereHas('patient', function ($query): void {
            $query->where(function ($query): void {
                $query->where('cedula', 'like', 'IMPORT-%')
                    ->where('nombre', 'like', 'Paciente Pendiente #%');
            })
                ->orWhere('cedula', 'like', 'HIST-%')
                ->orWhere('legacy_id', 'like', 'HIST-PAT-%')
                ->orWhere('nombre', 'like', 'Paciente Pendiente #%');
        });

        $consultationCount = (clone $consultationQuery)->count();
        $placeholderQuery = Patient::where(function ($query): void {
            $query->where(function ($query): void {
                $query->where('cedula', 'like', 'IMPORT-%')
                    ->where('nombre', 'like', 'Paciente Pendiente #%');
            })
                ->orWhere('cedula', 'like', 'HIST-%')
                ->orWhere('legacy_id', 'like', 'HIST-PAT-%')
                ->orWhere('nombre', 'like', 'Paciente Pendiente #%');
        });
        $placeholderCount = (clone $placeholderQuery)->count();

        if ($this->dryRun) {
            $this->stats['previous_consultations_removed'] = $consultationCount;
            $this->stats['previous_placeholders_removed'] = $placeholderCount;

            return;
        }

        $this->warn("Eliminando importacion placeholder previa: {$consultationCount} consultas, {$placeholderCount} pacientes...");

        $placeholderIds = $placeholderQuery->pluck('id');
        $consultationIds = (clone $consultationQuery)->pluck('id');

        foreach ($consultationIds->chunk(500) as $ids) {
            DB::table('consultation_diagnoses')->whereIn('consultation_id', $ids)->delete();
            DB::table('consultation_recommendations')->whereIn('consultation_id', $ids)->delete();
            DB::table('consultation_lens_recommendations')->whereIn('consultation_id', $ids)->delete();
            DB::table('consultation_contact_lens_modules')->whereIn('consultation_id', $ids)->delete();
            DB::table('consultation_ophthalmoscopy_modules')->whereIn('consultation_id', $ids)->delete();
            DB::table('consultation_treatment_modules')->whereIn('consultation_id', $ids)->delete();
            DB::table('sales')->whereIn('consultation_id', $ids)->update(['consultation_id' => null]);
            DB::table('lab_orders')->whereIn('consultation_id', $ids)->update(['consultation_id' => null]);
            DB::table('consultations')->whereIn('id', $ids)->delete();
            $this->stats['previous_consultations_removed'] += $ids->count();
        }

        foreach ($placeholderIds->chunk(500) as $ids) {
            DB::table('patients')->whereIn('id', $ids)->delete();
            $this->stats['previous_placeholders_removed'] += $ids->count();
        }
    }

    private function rows(string $table): iterable
    {
        $statement = $this->source->query('select * from '.$this->qi($table));

        while ($row = $statement->fetch()) {
            yield $row;
        }
    }

    private function countRows(string $table): int
    {
        return (int) $this->source
            ->query('select count(*) from '.$this->qi($table))
            ->fetchColumn();
    }

    private function tableExists(string $table): bool
    {
        $statement = $this->source->prepare("select count(*) from sqlite_master where type = 'table' and name = ?");
        $statement->execute([$table]);

        return (int) $statement->fetchColumn() > 0;
    }

    private function qi(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }

    private function resolveCreatorId(): int
    {
        $option = $this->option('user-id');
        if ($option && User::whereKey((int) $option)->exists()) {
            return (int) $option;
        }

        $first = User::query()->orderBy('id')->value('id');
        if ($first) {
            return (int) $first;
        }

        if ($this->dryRun) {
            return 0;
        }

        return (int) User::create([
            'name' => 'Importador Optica Andina',
            'email' => 'importador@local.test',
            'password' => Hash::make(Str::random(32)),
            'role' => 'admin',
        ])->id;
    }

    private function loadPatientMap(): void
    {
        $this->patientByCedula = [];
        Patient::query()
            ->select(['id', 'cedula'])
            ->whereNotNull('cedula')
            ->orderBy('id')
            ->chunk(1000, function ($patients): void {
                foreach ($patients as $patient) {
                    $this->patientByCedula[$this->cleanCedula($patient->cedula) ?? $patient->cedula] = $patient->id;
                }
            });
    }

    private function loadUserMap(): void
    {
        $this->userByCode = [];
        User::query()
            ->select(['id', 'codigo'])
            ->whereNotNull('codigo')
            ->get()
            ->each(function (User $user): void {
                $this->userByCode[(string) $user->codigo] = $user->id;
            });
    }

    private function optometristId(?string $value): ?int
    {
        if ($value === null) {
            return null;
        }

        if (isset($this->userByCode[$value])) {
            return $this->userByCode[$value];
        }

        $user = User::where('codigo', $value)->first() ?? User::find((int) $value);

        return $user?->id;
    }

    private function uniqueCedula(?string $wanted, string $fallback, ?int $ignoreId = null): string
    {
        $base = $this->limit($wanted ?: $fallback, 20) ?: $this->limit($fallback, 20);
        $candidate = $base;
        $counter = 1;

        while ($this->patientCedulaExists($candidate, $ignoreId)) {
            $suffix = '-'.$counter++;
            $candidate = substr($base, 0, 20 - strlen($suffix)).$suffix;
        }

        return $candidate;
    }

    private function uniqueInternalCode(string $wanted, ?int $ignoreId = null): string
    {
        $base = $this->limit($wanted, 50) ?: 'OA';
        $candidate = $base;
        $counter = 1;

        while ($this->patientInternalCodeExists($candidate, $ignoreId)) {
            $suffix = '-'.$counter++;
            $candidate = substr($base, 0, 50 - strlen($suffix)).$suffix;
        }

        return $candidate;
    }

    private function patientCedulaExists(string $cedula, ?int $ignoreId = null): bool
    {
        return Patient::where('cedula', $cedula)
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->exists();
    }

    private function patientInternalCodeExists(string $code, ?int $ignoreId = null): bool
    {
        return Patient::where('codigo_interno', $code)
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->exists();
    }

    private function v(array $row, string $key): ?string
    {
        $value = $row[$key] ?? null;
        if ($value === null) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    private function cleanCedula(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $clean = preg_replace('/\s+/', '', trim($value));

        return $clean === '' ? null : $clean;
    }

    private function usableCedula(?string $value): bool
    {
        if ($value === null || strlen($value) > 20) {
            return false;
        }

        if (! preg_match('/[A-Za-z0-9]/', $value)) {
            return false;
        }

        preg_match_all('/\d/', $value, $digits);

        return count($digits[0]) >= 5 || preg_match('/[A-Za-z]/', $value) === 1;
    }

    private function firstValue(array $row, array $keys): ?string
    {
        foreach ($keys as $key) {
            $value = $this->v($row, $key);
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    private function patientNotes(array $row, string $legacyId, ?string $originalCedula, string $storedCedula): string
    {
        $notes = [
            'Importado desde Optica Andina SQLite.',
            "Cliente legacy: {$legacyId}",
        ];

        if ($originalCedula !== null && $originalCedula !== $storedCedula) {
            $notes[] = "Cedula legacy: {$originalCedula}";
        }

        foreach ([
            'CLIE_TELEFONO2' => 'Telefono 2',
            'CLIE_TELEFONO3' => 'Telefono 3',
            'CIUDAD' => 'Ciudad',
            'CLIEN_SEXO' => 'Sexo',
            'CLIE_LUGAR DE TRABAJO' => 'Lugar de trabajo',
            'CLIE_PARTI_SOCIO' => 'Particular/socio',
            'CLIE_ABONO' => 'Abono legacy',
            'CLIE_DEUDA' => 'Deuda legacy',
        ] as $field => $label) {
            $value = $this->v($row, $field);
            if ($value !== null) {
                $notes[] = "{$label}: {$value}";
            }
        }

        return implode("\n", $notes);
    }

    private function emailOrGenerated(?string $email, ?string $code): string
    {
        return $this->validEmail($email)
            ?? 'oa-medico-'.Str::slug($code ?: Str::random(8)).'@import.local';
    }

    private function validEmail(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $email = trim($value);

        return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
    }

    private function birthDate(?string $date, ?string $age): string
    {
        $parsed = $this->dateOrNull($date);
        if ($parsed !== null) {
            return $parsed;
        }

        if ($age !== null && preg_match('/\d+/', $age, $matches)) {
            $years = (int) $matches[0];
            if ($years >= 0 && $years <= 120) {
                return now()->subYears($years)->startOfYear()->toDateString();
            }
        }

        return '2000-01-01';
    }

    private function dateTimeOrNull(?string $value): ?string
    {
        $date = $this->parseDate($value);

        return $date?->toDateTimeString();
    }

    private function dateOrNull(?string $value): ?string
    {
        $date = $this->parseDate($value);

        return $date?->toDateString();
    }

    private function parseDate(?string $value): ?Carbon
    {
        if ($value === null) {
            return null;
        }

        $value = trim($value);
        if ($value === '' || $value === '0') {
            return null;
        }

        foreach (['m/d/y H:i:s', 'm/d/Y H:i:s', 'm/d/y', 'm/d/Y', 'Y-m-d H:i:s', 'Y-m-d', 'd/m/y H:i:s', 'd/m/Y H:i:s', 'd/m/y', 'd/m/Y'] as $format) {
            try {
                $date = Carbon::createFromFormat($format, $value);
                if ($date !== false) {
                    return $date;
                }
            } catch (Throwable) {
                //
            }
        }

        try {
            return Carbon::parse($value);
        } catch (Throwable) {
            return null;
        }
    }

    private function decimal(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim(str_replace(',', '.', $value));
        if (! preg_match('/[-+]?\d+(?:\.\d+)?/', $value, $matches)) {
            return null;
        }

        return number_format((float) $matches[0], 2, '.', '');
    }

    private function integer(?string $value): ?int
    {
        if ($value === null || ! preg_match('/[-+]?\d+/', $value, $matches)) {
            return null;
        }

        return (int) $matches[0];
    }

    private function booleanOrNull(?string $value): ?bool
    {
        if ($value === null) {
            return null;
        }

        $value = Str::lower(trim($value));

        return match ($value) {
            's', 'si', '1', 'true', 'yes', 'pagado', 'cancelado' => true,
            'n', 'no', '0', 'false', 'por cancelar', 'pendiente' => false,
            default => null,
        };
    }

    private function mergeFields(?string ...$values): ?string
    {
        $values = array_values(array_filter($values, fn ($value) => $value !== null && $value !== ''));

        return $values === [] ? null : implode(' / ', $values);
    }

    private function compactValues(array $values): array
    {
        return array_filter($values, fn ($value) => $value !== null && $value !== '');
    }

    private function hasAnyValue(array $values): bool
    {
        return $this->compactValues($values) !== [];
    }

    private function limit(?string $value, int $limit): ?string
    {
        if ($value === null) {
            return null;
        }

        return Str::limit($value, $limit, '');
    }

    private function isImportedPlaceholder(Patient $patient): bool
    {
        return Str::startsWith((string) $patient->cedula, 'HIST-')
            || Str::startsWith((string) $patient->legacy_id, 'HIST-PAT-')
            || Str::startsWith((string) $patient->nombre, 'Paciente Pendiente #');
    }

    private function recordError(string $table, ?string $legacyId, Throwable $e): void
    {
        $this->stats['errors']++;
        $this->errors[] = "{$table} {$legacyId}: ".$e->getMessage();
    }

    private function printSummary(): void
    {
        $this->table(['Resultado', 'Total'], [
            ['Usuarios creados', $this->stats['users_created']],
            ['Usuarios actualizados', $this->stats['users_updated']],
            ['Usuarios saltados', $this->stats['users_skipped']],
            ['Pacientes creados', $this->stats['patients_created']],
            ['Pacientes actualizados', $this->stats['patients_updated']],
            ['Pacientes saltados', $this->stats['patients_skipped']],
            ['Historias creadas', $this->stats['consultations_created']],
            ['Historias actualizadas', $this->stats['consultations_updated']],
            ['Historias saltadas', $this->stats['consultations_skipped']],
            ['Placeholders nuevos', $this->stats['placeholder_patients_created']],
            ['Consultas placeholder previas eliminadas', $this->stats['previous_consultations_removed']],
            ['Pacientes placeholder previos eliminados', $this->stats['previous_placeholders_removed']],
            ['Placeholders eliminados', $this->stats['placeholders_pruned']],
            ['Errores', $this->stats['errors']],
        ]);

        if ($this->errors !== []) {
            $this->warn('Primeros errores:');
            foreach (array_slice($this->errors, 0, 20) as $error) {
                $this->line(' - '.$error);
            }
        }
    }

    private function writeJsonSummary(): void
    {
        $path = $this->option('json-summary');
        if (! is_string($path) || trim($path) === '') {
            return;
        }

        $directory = dirname($path);
        if (! is_dir($directory)) {
            mkdir($directory, 0755, true);
        }

        file_put_contents($path, json_encode([
            'stats' => $this->stats,
            'errors' => $this->errors,
            'dry_run' => $this->dryRun,
            'replace' => $this->replace,
            'generated_at' => now()->toIso8601String(),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
}
