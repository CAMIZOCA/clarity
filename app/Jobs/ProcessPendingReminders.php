<?php

namespace App\Jobs;

use App\Models\Reminder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessPendingReminders implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function handle(): void
    {
        $reminders = Reminder::pending()->with('patient')->get();

        Log::info("ProcessPendingReminders: encontrados {$reminders->count()} recordatorios pendientes.");

        foreach ($reminders as $reminder) {
            SendWhatsAppMessage::dispatch($reminder);
        }
    }
}
