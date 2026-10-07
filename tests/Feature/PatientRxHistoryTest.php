<?php

namespace Tests\Feature;

use App\Models\Consultation;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Historial de RX final que la consulta nueva ofrece para copiar a "RX en uso".
 */
class PatientRxHistoryTest extends TestCase
{
    use RefreshDatabase;

    private function makePatient(string $cedula = '1710000201'): Patient
    {
        return Patient::create([
            'nombre' => 'Luberth', 'apellido' => 'Sabando',
            'cedula' => $cedula, 'fecha_nacimiento' => '1975-03-10',
        ]);
    }

    private function makeConsultation(Patient $patient, string $date, array $attributes = []): Consultation
    {
        return Consultation::create([
            'patient_id' => $patient->id,
            'fecha_consulta' => $date,
            'estado' => 'completada',
            ...$attributes,
        ]);
    }

    public function test_history_lists_the_latest_final_prescriptions_first(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $patient = $this->makePatient();

        $old = $this->makeConsultation($patient, '2025-01-10', ['rx_final_esfera_od' => -1.25, 'rx_final_cilindro_od' => -0.50, 'rx_final_eje_od' => 90]);
        $recent = $this->makeConsultation($patient, '2026-02-20', ['rx_final_esfera_od' => 0.75, 'rx_final_esfera_oi' => 0.75, 'rx_final_av_od' => '20/20']);

        $response = $this->getJson("/api/patients/{$patient->id}/rx-history")->assertOk();

        $response->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $recent->id)
            ->assertJsonPath('data.0.fecha_consulta', '2026-02-20')
            ->assertJsonPath('data.0.rx_final_av_od', '20/20')
            ->assertJsonPath('data.1.id', $old->id)
            ->assertJsonPath('data.1.rx_final_eje_od', 90);

        $this->assertEqualsWithDelta(0.75, (float) $response->json('data.0.rx_final_esfera_od'), 0.001);
    }

    public function test_history_skips_consultations_without_a_final_prescription(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $patient = $this->makePatient();

        $this->makeConsultation($patient, '2026-01-05', ['motivo_consulta' => 'Control']);
        $neutral = $this->makeConsultation($patient, '2026-01-06', ['rx_final_esfera_od_neutral' => true]);

        $this->getJson("/api/patients/{$patient->id}/rx-history")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $neutral->id)
            ->assertJsonPath('data.0.rx_final_esfera_od_neutral', true);
    }

    public function test_history_excludes_the_open_consultation_and_other_patients(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $patient = $this->makePatient();
        $other = $this->makePatient('1710000202');

        $previous = $this->makeConsultation($patient, '2026-03-01', ['rx_final_esfera_od' => -2.00]);
        $current = $this->makeConsultation($patient, '2026-04-01', ['rx_final_esfera_od' => -2.25]);
        $this->makeConsultation($other, '2026-04-02', ['rx_final_esfera_od' => 3.00]);

        $this->getJson("/api/patients/{$patient->id}/rx-history?exclude={$current->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $previous->id);
    }

    public function test_history_respects_the_limit(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $patient = $this->makePatient();

        foreach (range(1, 7) as $day) {
            $this->makeConsultation($patient, sprintf('2026-05-%02d', $day), ['rx_final_esfera_od' => -1.00]);
        }

        $this->getJson("/api/patients/{$patient->id}/rx-history")->assertOk()->assertJsonCount(5, 'data');
        $this->getJson("/api/patients/{$patient->id}/rx-history?limit=2")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.fecha_consulta', '2026-05-07');
    }

    public function test_history_requires_authentication(): void
    {
        $patient = $this->makePatient();

        $this->getJson("/api/patients/{$patient->id}/rx-history")->assertUnauthorized();
    }
}
