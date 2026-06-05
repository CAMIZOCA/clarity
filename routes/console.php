<?php

use App\Console\Commands\SendDailyReminders;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ─── CRM: recordatorios diarios ───────────────────────────────────────────────
Schedule::command(SendDailyReminders::class)->dailyAt('08:00');
