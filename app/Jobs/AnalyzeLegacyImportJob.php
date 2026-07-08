<?php

namespace App\Jobs;

use App\Models\MaintenanceOperation;
use App\Services\LegacyImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class AnalyzeLegacyImportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 1800;

    public function __construct(public readonly int $operationId) {}

    public function handle(LegacyImportService $imports): void
    {
        $operation = MaintenanceOperation::findOrFail($this->operationId);
        $operation->update([
            'status' => 'analyzing',
            'mode' => 'dry-run',
            'started_at' => now(),
            'error_message' => null,
        ]);

        $result = $imports->analyze($operation);

        $operation->update([
            'status' => 'analyzed',
            'summary' => $result['summary'],
            'log' => $result['log'],
            'finished_at' => now(),
        ]);

        $this->audit($operation, 'Analisis de importacion legacy completado');
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
                ->withProperties(['summary' => $operation->summary])
                ->log($message);
        }
    }
}
