<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Models\Consultation;
use App\Models\ConsultationDiagnosis;
use App\Models\Patient;
use App\Models\Sale;
use App\Models\User;
use App\Services\ConsultationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Pantalla de recepcion: en cuanto el optometra completa la consulta, el
 * vendedor ve un resumen sin abrir la historia. Todo gira en torno a
 * `completed_at`, que solo fija el paso a "completada".
 */
class ReceptionFeedTest extends TestCase
{
    use RefreshDatabase;

    private User $seller;

    private Patient $patient;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        // Un jueves a las 19:30 hora local: en UTC ya es el dia siguiente, que es
        // justo donde se rompian los conteos por dia (CLAUDE.md, base de datos).
        $this->travelTo(Carbon::parse('2026-10-13 19:30:00', 'America/Guayaquil'));

        $this->seller = $this->userWith([Permission::CONSULTATIONS_HANDOFF->value]);
        Sanctum::actingAs($this->seller);

        $this->patient = Patient::create([
            'nombre' => 'Lucia', 'apellido' => 'Mena', 'cedula' => '1710034065', 'fecha_nacimiento' => '1980-03-02',
        ]);
    }

    private function userWith(array $permissions): User
    {
        $user = User::factory()->create();
        foreach ($permissions as $permission) {
            SpatiePermission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
            $user->givePermissionTo($permission);
        }

        return $user;
    }

    private function consultation(array $attributes = [], ?string $completedAt = null): Consultation
    {
        $consultation = new Consultation(array_merge([
            'patient_id' => $this->patient->id,
            'fecha_consulta' => '2026-10-13',
            'estado' => 'completada',
        ], $attributes));

        if ($completedAt) {
            $consultation->completed_at = Carbon::parse($completedAt, 'America/Guayaquil');
        }
        $consultation->save();

        return $consultation;
    }

    public function test_feed_requires_the_handoff_permission(): void
    {
        Sanctum::actingAs($this->userWith([Permission::CONSULTATIONS_VIEW->value]));

        $this->getJson('/api/reception/consultations')->assertForbidden();
    }

    public function test_completing_a_consultation_stamps_completed_at_once(): void
    {
        $service = app(ConsultationService::class);
        $consultation = $this->consultation(['estado' => 'borrador']);
        $this->assertNull($consultation->completed_at);

        $service->update($consultation, ['estado' => 'borrador', 'observaciones' => 'autoguardado'], $this->seller->id);
        $this->assertNull($consultation->fresh()->completed_at, 'el autoguardado no completa');

        $service->update($consultation, ['estado' => 'completada'], $this->seller->id);
        $stamped = $consultation->fresh()->completed_at;
        $this->assertNotNull($stamped);
        $this->assertSame('2026-10-13 19:30:00', $stamped->format('Y-m-d H:i:s'));

        $this->travel(10)->minutes();
        $service->update($consultation, ['estado' => 'completada', 'observaciones' => 'corregido'], $this->seller->id);
        $this->assertEquals($stamped, $consultation->fresh()->completed_at, 'guardar cambios no mueve la hora');

        $service->update($consultation, ['estado' => 'borrador'], $this->seller->id);
        $this->assertNull($consultation->fresh()->completed_at, 'reabrir la anula');
    }

    public function test_a_consultation_created_as_completed_is_stamped(): void
    {
        $consultation = app(ConsultationService::class)->create([
            'patient_id' => $this->patient->id,
            'fecha_consulta' => '2026-10-13',
            'estado' => 'completada',
        ], $this->seller->id);

        $this->assertNotNull($consultation->fresh()->completed_at);
    }

    public function test_completed_at_cannot_be_sent_by_the_client(): void
    {
        Sanctum::actingAs($this->userWith([Permission::CONSULTATIONS_EDIT->value]));
        $consultation = $this->consultation(['estado' => 'borrador']);

        $this->putJson("/api/consultations/{$consultation->id}", [
            'estado' => 'borrador',
            'completed_at' => '2020-01-01 08:00:00',
        ])->assertOk();

        $this->assertNull($consultation->fresh()->completed_at);
    }

    public function test_feed_groups_completed_consultations_by_local_day_newest_first(): void
    {
        $early = $this->consultation([], '2026-10-13 09:00:00');
        $late = $this->consultation([], '2026-10-13 19:25:00');          // en UTC ya es el 14
        $yesterday = $this->consultation(['fecha_consulta' => '2026-10-12'], '2026-10-12 23:50:00');
        $this->consultation(['fecha_consulta' => '2026-10-10'], '2026-10-10 10:00:00'); // fuera de los 3 dias
        $this->consultation(['estado' => 'borrador'], null);

        $days = $this->getJson('/api/reception/consultations?days=3')->assertOk()->json('days');

        $this->assertSame(['2026-10-13', '2026-10-12', '2026-10-11'], array_column($days, 'date'));
        $this->assertSame([$late->id, $early->id], array_column($days[0]['consultations'], 'id'));
        $this->assertSame([$yesterday->id], array_column($days[1]['consultations'], 'id'));
        $this->assertSame([], $days[2]['consultations']);
    }

    public function test_feed_returns_only_today_by_default(): void
    {
        $today = $this->consultation([], '2026-10-13 09:00:00');
        $this->consultation(['fecha_consulta' => '2026-10-12'], '2026-10-12 17:00:00');

        $days = $this->getJson('/api/reception/consultations')->assertOk()->json('days');

        $this->assertSame(['2026-10-13'], array_column($days, 'date'));
        $this->assertSame([$today->id], array_column($days[0]['consultations'], 'id'));
    }

    public function test_feed_falls_back_to_the_consultation_date_when_there_is_no_completed_at(): void
    {
        $imported = $this->consultation(['fecha_consulta' => '2026-10-12']);

        $days = $this->getJson('/api/reception/consultations?days=3')->assertOk()->json('days');

        $this->assertSame([$imported->id], array_column($days[1]['consultations'], 'id'));
        $this->assertNull($days[1]['consultations'][0]['closed_at']);
    }

    public function test_feed_carries_the_summary_the_seller_needs(): void
    {
        $consultation = $this->consultation([
            'rx_final_esfera_od' => -1.25, 'rx_final_cilindro_od' => -0.50, 'rx_final_eje_od' => 90,
            'rx_final_add_od' => 1.50, 'rx_final_av_od' => '20/20', 'rx_final_dnp_od' => '31',
            'rx_final_esfera_oi' => null, 'rx_final_esfera_oi_neutral' => true,
            'recomendaciones' => 'Antirreflejo',
            'luna_espesor' => 'Alto indice',
            'observaciones' => 'Usa pantallas 8 horas',
        ], '2026-10-13 18:00:00');
        ConsultationDiagnosis::create([
            'consultation_id' => $consultation->id, 'eye' => 'AO', 'code' => 'H52.1', 'description' => 'Miopia', 'sort_order' => 1,
        ]);
        $consultation->saleItems()->create(['orden' => 1, 'tipo' => 'lunas', 'descripcion' => 'Lunas blue cut', 'total' => 80]);

        $item = $this->getJson('/api/reception/consultations')->assertOk()->json('days.0.consultations.0');

        $this->assertSame('Lucia Mena', $item['patient']['nombre_completo']);
        $this->assertSame(46, $item['patient']['edad']);
        $this->assertEquals(-1.25, $item['rx']['od']['esfera']);
        $this->assertEquals(90, $item['rx']['od']['eje']);
        // SQLite toma un nombre de columna inexistente como texto; MariaDB falla con 500.
        $this->assertSame('20/20', $item['rx']['od']['av']);
        $this->assertSame('31', $item['rx']['od']['dnp']);
        $this->assertTrue($item['rx']['oi']['neutra']);
        $this->assertSame('Alto indice', $item['lens']['espesor']);
        $this->assertSame(['Antirreflejo'], $item['recommendations']);
        $this->assertSame('H52.1', $item['diagnoses'][0]['code']);
        $this->assertSame('Lunas blue cut', $item['sale_items'][0]['descripcion']);
        $this->assertSame('Usa pantallas 8 horas', $item['observaciones']);
        $this->assertNull($item['sale_id']);
    }

    public function test_feed_links_the_open_sale_of_a_consultation(): void
    {
        $consultation = $this->consultation([], '2026-10-13 18:00:00');
        $sale = Sale::create([
            'consultation_id' => $consultation->id,
            'patient_id' => $this->patient->id,
            'user_id' => $this->seller->id,
            'status' => 'draft',
        ]);

        $item = $this->getJson('/api/reception/consultations')->json('days.0.consultations.0');

        $this->assertSame($sale->id, $item['sale_id']);
    }

    public function test_dashboard_counts_only_completed_consultations_closed_today(): void
    {
        $this->consultation([], '2026-10-13 09:00:00');
        $this->consultation([], '2026-10-13 19:00:00');
        $this->consultation(['estado' => 'borrador']);
        $this->consultation(['fecha_consulta' => '2026-10-12'], '2026-10-12 17:00:00');

        $this->getJson('/api/reports/dashboard')->assertOk()->assertJsonPath('consultasHoy', 2);
    }
}
