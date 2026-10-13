<?php

namespace App\Console\Commands;

use App\Services\LegacyConsultationRepairService;
use Illuminate\Console\Command;
use PDO;

class RepairLegacyConsultations extends Command
{
    protected $signature = 'consultations:repair-legacy-import
                            {--dry-run : Solo informar, no guardar en BD}
                            {--only= : Reglas a aplicar, separadas por coma (decimales, rx_uso, ark, subj; con --source: subj_origen, rx_uso_origen)}
                            {--source= : SQLite convertido del Access: recupera el subjetivo y la RX en uso completos}
                            {--examples=20 : Ejemplos antes/despues que se muestran por regla}
                            {--revert : Deshace la reparacion con los valores guardados en la bitacora}';

    protected $description = 'Corrige las medidas de las consultas importadas de Optica Andina (dioptrias sin punto, RX en uso corrida, ARK en lugar de retinoscopia)';

    public function handle(LegacyConsultationRepairService $service): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $rules = $this->rules();

        if ($rules === null) {
            return Command::FAILURE;
        }

        if ($dryRun) {
            $this->warn('MODO DRY-RUN activado — no se guardarán cambios en la BD');
        }

        if ($this->option('revert')) {
            $restored = $service->revert($rules ?: LegacyConsultationRepairService::RULES, $dryRun);
            $this->info("Valores restaurados: {$restored}");

            return Command::SUCCESS;
        }

        $examples = max(0, (int) $this->option('examples'));
        $sourcePath = trim((string) $this->option('source'));
        $sourceRules = array_values(array_intersect($rules, LegacyConsultationRepairService::SOURCE_RULES));

        if ($sourcePath === '' && $sourceRules !== []) {
            $this->error('Las reglas '.implode(', ', $sourceRules).' necesitan el respaldo original: --source=ruta.sqlite');

            return Command::FAILURE;
        }

        if ($sourcePath !== '' && ($rules === [] || $sourceRules !== [])) {
            $source = $this->openSource($sourcePath);

            if ($source === null) {
                return Command::FAILURE;
            }

            // Con el respaldo solo corren las reglas que lo usan; las demas no lo necesitan.
            $report = $service->repairFromSource(
                $source,
                $rules === [] ? LegacyConsultationRepairService::SOURCE_RULES : $sourceRules,
                $dryRun,
                $examples,
            );
        } else {
            $report = $service->repair($rules ?: LegacyConsultationRepairService::DEFAULT_RULES, $dryRun, $examples);
        }

        foreach ($report['rules'] as $rule => $summary) {
            $this->newLine();
            $this->info("Regla «{$rule}»: {$summary['consultations']} consultas, {$summary['changes']} valores");

            $rows = [];
            foreach ($summary['examples'] as $example) {
                foreach ($example['changes'] as $change) {
                    $rows[] = [$example['consultation_id'], $change['column'], $change['old'] ?? '—', $change['new'] ?? '—'];
                }
            }

            if ($rows !== []) {
                $this->table(['Consulta', 'Columna', 'Antes', 'Después'], $rows);
            }
        }

        if ($report['anomalies'] !== []) {
            $this->newLine();
            $this->warn(count($report['anomalies']).' valores no se tocaron y requieren revisión manual:');
            $this->table(
                ['Consulta', 'Columna', 'Valor', 'Motivo'],
                array_map(fn ($anomaly) => array_values($anomaly), array_slice($report['anomalies'], 0, 50)),
            );
        }

        if ($dryRun) {
            $this->newLine();
            $this->warn('DRY-RUN completado. Ningún dato fue guardado.');
        }

        return Command::SUCCESS;
    }

    private function openSource(string $path): ?PDO
    {
        if (! is_file($path)) {
            $this->error("Archivo no encontrado: {$path}");

            return null;
        }

        $source = new PDO('sqlite:'.$path);
        $source->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $table = $source->query("select count(*) from sqlite_master where type = 'table' and name = 'HISTORIAL OPTAMOLOGIA'");
        if ((int) $table->fetchColumn() === 0) {
            $this->error('El archivo no es el respaldo del sistema anterior: falta la tabla HISTORIAL OPTAMOLOGIA.');

            return null;
        }

        return $source;
    }

    /**
     * Reglas pedidas con `--only`: lista vacia si no se paso la opcion (el valor
     * por defecto lo decide quien llama, porque reparar y revertir difieren) y
     * null si alguna no existe.
     *
     * @return list<string>|null
     */
    private function rules(): ?array
    {
        $only = trim((string) $this->option('only'));

        if ($only === '') {
            return [];
        }

        $rules = array_values(array_filter(array_map('trim', explode(',', $only))));
        $unknown = array_diff($rules, LegacyConsultationRepairService::RULES);

        if ($unknown !== []) {
            $this->error('Reglas desconocidas: '.implode(', ', $unknown).'. Válidas: '.implode(', ', LegacyConsultationRepairService::RULES));

            return null;
        }

        return $rules;
    }
}
