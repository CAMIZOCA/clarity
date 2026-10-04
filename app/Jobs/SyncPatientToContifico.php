<?php

namespace App\Jobs;

use App\Models\Patient;
use App\Services\ContificoService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/**
 * Envia un paciente recien creado a Contifico sin frenar a recepcion.
 *
 * Solo viaja el id: las credenciales se leen al ejecutar, nunca quedan
 * serializadas en la tabla `jobs`. Un fallo definitivo (400, 401) termina el
 * job sin reintentar; ContificoTemporaryException lo devuelve a la cola.
 */
class SyncPatientToContifico implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    /** Segundos que dura el candado que evita dos envios del mismo paciente. */
    public int $uniqueFor = 3600;

    public function __construct(
        public readonly int $patientId,
        public readonly ?int $userId = null,
    ) {}

    public function uniqueId(): string
    {
        return (string) $this->patientId;
    }

    /** @return array<int, int> segundos entre reintentos */
    public function backoff(): array
    {
        return [60, 300, 900];
    }

    public function handle(ContificoService $contifico): void
    {
        $patient = Patient::find($this->patientId);

        if (! $patient) {
            return;
        }

        // syncPatient vuelve a comprobar el interruptor: apagarlo en Ajustes
        // detiene tambien los envios que ya estaban en cola.
        $contifico->syncPatient($patient, $this->userId, $this->attempts());
    }
}
