<?php

namespace App\Events;

use App\Models\LabOrder;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LabOrderReady
{
    use Dispatchable, SerializesModels;

    /**
     * Crea una instancia del evento.
     */
    public function __construct(public readonly LabOrder $labOrder) {}
}
