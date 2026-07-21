<?php

namespace App\Console\Commands;

use App\Models\Consultation;
use Illuminate\Console\Command;

class RecalculateConsultationNumbers extends Command
{
    protected $signature = 'consultations:recalculate-numbers {--dry-run : Solo reportar, no guardar en BD}';

    protected $description = 'Recalcula numero_consulta por paciente en orden cronologico (corrige datos importados sin este valor)';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        if ($dryRun) {
            $this->warn('MODO DRY-RUN activado — no se guardarán cambios en la BD');
        }

        $patientIds = Consultation::withTrashed()->distinct()->pluck('patient_id');
        $updated = 0;

        $bar = $this->output->createProgressBar($patientIds->count());
        $bar->start();

        foreach ($patientIds as $patientId) {
            $consultations = Consultation::withTrashed()
                ->where('patient_id', $patientId)
                ->orderBy('fecha_consulta')
                ->orderBy('id')
                ->get(['id', 'numero_consulta']);

            foreach ($consultations->values() as $index => $consultation) {
                $expected = $index + 1;
                if ($consultation->numero_consulta !== $expected) {
                    if (! $dryRun) {
                        Consultation::withTrashed()
                            ->where('id', $consultation->id)
                            ->update(['numero_consulta' => $expected]);
                    }
                    $updated++;
                }
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $this->info("Consultas actualizadas: {$updated}");

        if ($dryRun) {
            $this->warn('DRY-RUN completado. Ningún dato fue guardado.');
        }

        return Command::SUCCESS;
    }
}
