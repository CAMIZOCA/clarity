<?php

namespace App\Services;

use App\Models\MaintenanceOperation;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use PDO;
use RuntimeException;

class LegacyImportService
{
    public function validateSqlite(string $absolutePath): array
    {
        if (! is_file($absolutePath)) {
            throw new RuntimeException('Archivo SQLite no encontrado.');
        }

        $pdo = new PDO('sqlite:'.$absolutePath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $required = ['CLIENTES', 'HISTORIAL OPTAMOLOGIA', 'MEDICOS'];
        $counts = [];
        $missing = [];

        foreach ($required as $table) {
            $statement = $pdo->prepare("select count(*) from sqlite_master where type = 'table' and name = ?");
            $statement->execute([$table]);
            if ((int) $statement->fetchColumn() === 0) {
                $missing[] = $table;

                continue;
            }

            $quoted = '"'.str_replace('"', '""', $table).'"';
            $counts[$table] = (int) $pdo->query("select count(*) from {$quoted}")->fetchColumn();
        }

        if ($missing !== []) {
            throw new RuntimeException(
                'El archivo SQLite no corresponde al backup del sistema anterior Optica Andina. '
                .'Faltan tablas requeridas: '.implode(', ', $missing).'.'
            );
        }

        return $counts;
    }

    public function analyze(MaintenanceOperation $operation): array
    {
        return $this->runCommand($operation, dryRun: true, rewriteLegacy: true);
    }

    public function import(MaintenanceOperation $operation, bool $rewriteLegacy): array
    {
        return $this->runCommand($operation, dryRun: false, rewriteLegacy: $rewriteLegacy);
    }

    private function runCommand(MaintenanceOperation $operation, bool $dryRun, bool $rewriteLegacy): array
    {
        if (! $operation->path) {
            throw new RuntimeException('La operacion no tiene archivo asociado.');
        }

        $absolutePath = Storage::disk($operation->disk)->path($operation->path);
        $this->validateSqlite($absolutePath);

        $summaryPath = storage_path('app/private/maintenance/import-summary-'.$operation->id.'-'.uniqid().'.json');

        $exitCode = Artisan::call('import:optica-andina-sqlite', [
            'database' => $absolutePath,
            '--replace' => $rewriteLegacy,
            '--reset-placeholder-import' => $rewriteLegacy,
            '--prune-placeholders' => $rewriteLegacy,
            '--dry-run' => $dryRun,
            '--user-id' => $operation->user_id,
            '--json-summary' => $summaryPath,
        ]);

        $output = Artisan::output();
        $summary = is_file($summaryPath)
            ? json_decode((string) file_get_contents($summaryPath), true)
            : ['stats' => [], 'errors' => ['No se genero resumen JSON.']];

        @unlink($summaryPath);

        $summary['exit_code'] = $exitCode;
        $summary['rewrite_legacy'] = $rewriteLegacy;

        if ($exitCode !== 0) {
            throw new RuntimeException($summary['errors'][0] ?? 'La importacion legacy fallo.');
        }

        return [
            'summary' => $summary,
            'log' => $output,
        ];
    }
}
