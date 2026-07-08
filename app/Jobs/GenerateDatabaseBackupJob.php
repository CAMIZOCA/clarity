<?php

namespace App\Jobs;

use App\Models\MaintenanceOperation;
use App\Services\DatabaseBackupService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class GenerateDatabaseBackupJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 1800;

    public function __construct(
        public readonly int $operationId,
        public readonly string $reason = 'manual',
    ) {}

    public function handle(DatabaseBackupService $backups): void
    {
        $operation = MaintenanceOperation::findOrFail($this->operationId);
        $backups->generate($operation, $this->reason);
    }

    public function failed(Throwable $e): void
    {
        MaintenanceOperation::whereKey($this->operationId)->update([
            'status' => 'failed',
            'error_message' => $e->getMessage(),
            'finished_at' => now(),
        ]);
    }
}
