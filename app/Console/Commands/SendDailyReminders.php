<?php

namespace App\Console\Commands;

use App\Jobs\ProcessPendingReminders;
use App\Services\CrmService;
use Illuminate\Console\Command;

class SendDailyReminders extends Command
{
    protected $signature = 'crm:send-reminders {--dry-run : Solo mostrar sin enviar}';
    protected $description = 'Procesa recordatorios pendientes, cumpleaños y controles visuales';

    public function handle(CrmService $crm): int
    {
        $this->info('📱 Procesando recordatorios CRM...');

        // Crear recordatorios de cumpleaños para mañana
        $birthdays = $crm->scheduleBirthdayReminders();
        $this->info("  🎂 Cumpleaños creados: {$birthdays}");

        // Crear recordatorios de control visual
        $controls = $crm->scheduleControlVisualReminders();
        $this->info("  👁️  Controles visuales creados: {$controls}");

        // Despachar job para enviar pendientes
        if (!$this->option('dry-run')) {
            ProcessPendingReminders::dispatch();
            $this->info('  ✅ Job de envío despachado');
        } else {
            $this->warn('  ⚠️  --dry-run activo, sin envío real');
        }

        return Command::SUCCESS;
    }
}
