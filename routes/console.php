<?php

use App\Console\Commands\PruneMaintenanceOperations;
use App\Console\Commands\SendDailyReminders;
use App\Models\ContificoSyncLog;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ─── CRM: recordatorios diarios ───────────────────────────────────────────────
Schedule::command(SendDailyReminders::class)->dailyAt('08:00');
Schedule::command(PruneMaintenanceOperations::class, ['--days' => 7])->dailyAt('02:30');

// ─── Contifico: el historial de envios se conserva 90 dias ────────────────────
Schedule::command('model:prune', ['--model' => [ContificoSyncLog::class]])->dailyAt('02:45');
