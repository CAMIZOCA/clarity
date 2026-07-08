<?php

namespace App\Console\Commands;

use App\Models\MaintenanceOperation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PruneMaintenanceOperations extends Command
{
    protected $signature = 'maintenance:prune {--days=7 : Dias de retencion}';

    protected $description = 'Elimina backups, imports y logs de mantenimiento vencidos';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $cutoff = now()->subDays($days);
        $deleted = 0;

        MaintenanceOperation::where(function ($query) use ($cutoff): void {
            $query->where('expires_at', '<=', now())
                ->orWhere('created_at', '<=', $cutoff);
        })->chunkById(100, function ($operations) use (&$deleted): void {
            foreach ($operations as $operation) {
                if ($operation->path) {
                    Storage::disk($operation->disk)->delete($operation->path);
                }
                $operation->delete();
                $deleted++;
            }
        });

        $this->info("Operaciones de mantenimiento eliminadas: {$deleted}");

        return Command::SUCCESS;
    }
}
