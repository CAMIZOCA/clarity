<?php

namespace App\Jobs;

use App\Models\Reminder;
use App\Services\WhatsAppService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendWhatsAppMessage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 60; // segundos entre reintentos

    public function __construct(public readonly Reminder $reminder) {}

    public function handle(WhatsAppService $whatsApp): void
    {
        $whatsApp->sendReminder($this->reminder);
    }

    public function failed(\Throwable $e): void
    {
        $this->reminder->update([
            'status'        => 'failed',
            'error_message' => $e->getMessage(),
        ]);
    }
}
