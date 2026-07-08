<?php

namespace App\Jobs;

use App\Models\MaintenanceOperation;
use App\Services\DatabaseBackupService;
use App\Services\LegacyImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class RunLegacyImportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 1800;

    public function __construct(
        public readonly int $operationId,
        public readonly bool $rewriteLegacy,
    ) {}

    public function handle(DatabaseBackupService $backups, LegacyImportService $imports): void
    {
        $operation = MaintenanceOperation::findOrFail($this->operationId);
        $operation->update([
            'status' => 'importing',
            'mode' => $this->rewriteLegacy ? 'rewrite-legacy' : 'append',
            'started_at' => now(),
            'finished_at' => null,
            'error_message' => null,
        ]);

        $backup = MaintenanceOperation::create([
            'type' => 'backup',
            'status' => 'pending',
            'user_id' => $operation->user_id,
            'mode' => 'before-import',
            'expires_at' => now()->addDays(7),
        ]);

        $backups->generate($backup, 'before-import');

        $result = $imports->import($operation, $this->rewriteLegacy);
        $summary = $result['summary'];
        $summary['backup_operation_id'] = $backup->id;

        $operation->update([
            'status' => 'completed',
            'backup_operation_id' => $backup->id,
            'summary' => $summary,
            'log' => $result['log'],
            'finished_at' => now(),
        ]);

        $this->audit($operation, 'Importacion legacy completada');
    }

    public function failed(Throwable $e): void
    {
        MaintenanceOperation::whereKey($this->operationId)->update([
            'status' => 'failed',
            'error_message' => $e->getMessage(),
            'finished_at' => now(),
        ]);
    }

    private function audit(MaintenanceOperation $operation, string $message): void
    {
        if (function_exists('activity')) {
            activity('maintenance')
                ->causedBy($operation->user)
                ->performedOn($operation)
                ->withProperties([
                    'mode' => $operation->mode,
                    'summary' => $operation->summary,
                    'backup_operation_id' => $operation->backup_operation_id,
                ])
                ->log($message);
        }
    }
}
