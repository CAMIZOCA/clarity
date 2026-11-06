<?php

namespace App\Jobs;

use App\Models\Reminder;
use App\Services\WhatsAppService;
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

    public function handle(WhatsAppService $whatsApp): void
    {
        // Sin proveedor real los pendientes se envian a mano desde Recordatorios.
        if (! $whatsApp->canSendAutomatically()) {
            Log::info('ProcessPendingReminders: sin proveedor de WhatsApp, envio manual.');

            return;
        }

        $reminders = Reminder::pending()->with('patient')->get();

        Log::info("ProcessPendingReminders: encontrados {$reminders->count()} recordatorios pendientes.");

        foreach ($reminders as $reminder) {
            SendWhatsAppMessage::dispatch($reminder);
        }
    }
}
