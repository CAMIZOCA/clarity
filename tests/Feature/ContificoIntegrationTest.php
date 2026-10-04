<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Exceptions\ContificoTemporaryException;
use App\Jobs\SyncPatientToContifico;
use App\Models\ContificoSyncLog;
use App\Models\Patient;
use App\Models\Setting;
use App\Models\User;
use App\Services\ContificoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class ContificoIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private const API_KEY = 'clave-secreta-de-prueba';

    private const API_TOKEN = 'token-pos-de-prueba';

    /** Cedula que pasa el algoritmo de ValidEcuadorCedula. */
    private const CEDULA = '1710034065';

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        // Ninguna prueba debe salir a la red real.
        Http::preventStrayRequests();
    }

    private function actingWith(Permission ...$permissions): User
    {
        $user = User::factory()->create();

        foreach ($permissions as $permission) {
            SpatiePermission::firstOrCreate(['name' => $permission->value, 'guard_name' => 'web']);
            $user->givePermissionTo($permission->value);
        }

        Sanctum::actingAs($user);

        return $user;
    }

    private function enableContifico(): ContificoService
    {
        $contifico = app(ContificoService::class);
        $contifico->storeApiKey(self::API_KEY);
        $contifico->storeApiToken(self::API_TOKEN);
        $contifico->setEnabled(true);

        return $contifico;
    }

    private function patient(array $overrides = []): Patient
    {
        return Patient::create($overrides + [
            'nombre' => 'Ana',
            'apellido' => 'Pérez',
            'cedula' => self::CEDULA,
            'telefono' => '0991234567',
            'email' => 'ana@example.com',
            'direccion' => 'Av. Siempre Viva 123',
            'fecha_nacimiento' => '1990-01-01',
        ]);
    }

    // ─── Credenciales ────────────────────────────────────────────────────────

    public function test_credentials_are_stored_encrypted_and_never_returned(): void
    {
        $this->actingWith(Permission::SETTINGS_EDIT);
        Http::fake(['api.contifico.com/*' => Http::response([], 200)]);

        $response = $this->putJson('/api/contifico/config', [
            'api_key' => self::API_KEY,
            'api_token' => self::API_TOKEN,
            'enabled' => true,
        ])->assertOk()
            ->assertJsonPath('enabled', true)
            ->assertJsonPath('has_api_key', true)
            ->assertJsonPath('has_api_token', true);

        $this->assertStringNotContainsString(self::API_KEY, $response->getContent());
        $this->assertStringNotContainsString(self::API_TOKEN, $response->getContent());

        // En la base queda el texto cifrado, no la clave.
        $this->assertNotSame(self::API_KEY, Setting::get(ContificoService::SETTING_API_KEY));
        $this->assertSame(self::API_KEY, app(ContificoService::class)->apiKey());

        foreach (['/api/settings', '/api/contifico/status'] as $url) {
            $body = $this->getJson($url)->assertOk()->getContent();
            $this->assertStringNotContainsString(self::API_KEY, $body);
            $this->assertStringNotContainsString(self::API_TOKEN, $body);
            $this->assertStringNotContainsString(Setting::get(ContificoService::SETTING_API_KEY), $body);
        }

        $this->getJson('/api/settings')
            ->assertJsonPath(ContificoService::SETTING_API_KEY, '__stored__')
            ->assertJsonPath(ContificoService::SETTING_API_TOKEN, '__stored__');
    }

    public function test_settings_update_response_does_not_leak_secrets(): void
    {
        Setting::set('mail_password', 'super-secreta');
        $this->enableContifico();
        $this->actingWith(Permission::SETTINGS_EDIT);

        $body = $this->postJson('/api/settings', ['clinic_name' => 'Óptica'])
            ->assertOk()
            ->assertJsonPath('mail_password', '__stored__')
            ->assertJsonPath(ContificoService::SETTING_API_KEY, '__stored__')
            ->getContent();

        $this->assertStringNotContainsString('super-secreta', $body);
    }

    public function test_enabling_requires_both_credentials(): void
    {
        $this->actingWith(Permission::SETTINGS_EDIT);
        Http::fake();

        $this->putJson('/api/contifico/config', ['api_key' => self::API_KEY, 'enabled' => true])
            ->assertStatus(422)
            ->assertJsonPath('enabled', false);

        $this->assertFalse(app(ContificoService::class)->isEnabled());
        Http::assertNothingSent();
    }

    public function test_enabling_is_rejected_when_contifico_refuses_the_key(): void
    {
        $this->actingWith(Permission::SETTINGS_EDIT);
        Http::fake(['api.contifico.com/*' => Http::response(['mensaje' => 'No autorizado'], 401)]);

        $this->putJson('/api/contifico/config', [
            'api_key' => 'mala',
            'api_token' => self::API_TOKEN,
            'enabled' => true,
        ])->assertStatus(422)->assertJsonPath('enabled', false);

        $this->assertFalse(app(ContificoService::class)->isEnabled());
    }

    public function test_connection_test_sends_the_key_in_the_authorization_header(): void
    {
        $this->enableContifico();
        $this->actingWith(Permission::SETTINGS_EDIT);
        Http::fake(['api.contifico.com/*' => Http::response([], 200)]);

        $this->postJson('/api/contifico/test')->assertOk()->assertJsonPath('ok', true);

        Http::assertSent(fn (Request $request) => $request->method() === 'GET'
            && $request->hasHeader('Authorization', self::API_KEY)
            && str_contains($request->url(), '/sistema/api/v1/persona/')
            && ! str_contains($request->url(), 'pos='));
    }

    public function test_config_endpoints_require_settings_permission(): void
    {
        $this->enableContifico();
        $this->actingWith();

        $this->getJson('/api/contifico/status')->assertForbidden();
        $this->getJson('/api/contifico/logs')->assertForbidden();
        $this->postJson('/api/contifico/test')->assertForbidden();
        $this->putJson('/api/contifico/config', ['enabled' => false])->assertForbidden();
    }

    public function test_credentials_can_be_cleared(): void
    {
        $this->enableContifico();
        $this->actingWith(Permission::SETTINGS_EDIT);

        $this->putJson('/api/contifico/config', ['clear_credentials' => true])
            ->assertOk()
            ->assertJsonPath('enabled', false)
            ->assertJsonPath('has_api_key', false)
            ->assertJsonPath('has_api_token', false);
    }

    // ─── Alta de pacientes ───────────────────────────────────────────────────

    public function test_creating_a_patient_queues_the_sync_only_when_enabled(): void
    {
        Queue::fake();
        $this->actingWith(Permission::PATIENTS_CREATE);

        $this->postJson('/api/patients', ['nombre' => 'Sin', 'apellido' => 'Integración', 'cedula' => '1710034073', 'fecha_nacimiento' => '1990-01-01'])->assertCreated();
        Queue::assertNothingPushed();

        $this->enableContifico();

        $id = $this->postJson('/api/patients', ['nombre' => 'Ana', 'cedula' => self::CEDULA, 'fecha_nacimiento' => '1990-01-01'])
            ->assertCreated()
            ->json('data.id');

        Queue::assertPushed(SyncPatientToContifico::class, fn ($job) => $job->patientId === $id);
    }

    public function test_patient_is_saved_even_if_contifico_is_down(): void
    {
        $this->enableContifico();
        $this->actingWith(Permission::PATIENTS_CREATE);
        Http::fake(fn () => throw new ConnectionException('cURL error 28: timeout'));

        // La suite usa la cola `sync`: el job corre dentro del request.
        $this->postJson('/api/patients', ['nombre' => 'Ana', 'cedula' => self::CEDULA, 'fecha_nacimiento' => '1990-01-01'])->assertCreated();

        $this->assertDatabaseHas('patients', ['cedula' => self::CEDULA, 'contifico_id' => null]);
        $this->assertDatabaseHas('contifico_sync_logs', ['status' => ContificoSyncLog::STATUS_FAILED]);
    }

    // ─── Envio ───────────────────────────────────────────────────────────────

    public function test_new_persona_is_created_as_client_with_token_in_query(): void
    {
        $contifico = $this->enableContifico();
        $patient = $this->patient();

        Http::fake(fn (Request $request) => $request->method() === 'GET'
            ? Http::response([], 200)
            : Http::response(['id' => 'AUOjQdy9jgMcydJ4m'], 201));

        $log = $contifico->syncPatient($patient);

        $this->assertSame(ContificoSyncLog::STATUS_SUCCESS, $log->status);
        $this->assertSame(ContificoSyncLog::ACTION_CREATE, $log->action);
        $this->assertSame('AUOjQdy9jgMcydJ4m', $patient->fresh()->contifico_id);
        $this->assertNotNull($patient->fresh()->contifico_synced_at);

        Http::assertSent(function (Request $request) {
            if ($request->method() !== 'POST') {
                return false;
            }

            return $request->hasHeader('Authorization', self::API_KEY)
                && str_contains($request->url(), 'pos='.self::API_TOKEN)
                && $request['tipo'] === 'N'
                && $request['cedula'] === self::CEDULA
                && $request['razon_social'] === 'Ana Pérez'
                && $request['es_cliente'] === true
                && $request['es_proveedor'] === false
                && ! array_key_exists('antecedentes', $request->data());
        });
    }

    public function test_existing_persona_is_linked_without_creating_a_duplicate(): void
    {
        $contifico = $this->enableContifico();
        $patient = $this->patient();

        Http::fake(['api.contifico.com/*' => Http::response([
            ['id' => 'otro', 'cedula' => '0999999999'],
            ['id' => 'EXISTENTE', 'cedula' => self::CEDULA],
        ], 200)]);

        $log = $contifico->syncPatient($patient);

        $this->assertSame(ContificoSyncLog::ACTION_LINK, $log->action);
        $this->assertSame('EXISTENTE', $patient->fresh()->contifico_id);
        Http::assertNotSent(fn (Request $request) => $request->method() === 'POST');
    }

    public function test_patient_without_valid_identification_is_skipped(): void
    {
        $contifico = $this->enableContifico();
        Http::fake();

        $log = $contifico->syncPatient($this->patient(['cedula' => 'AB123456']));

        $this->assertSame(ContificoSyncLog::STATUS_SKIPPED, $log->status);
        Http::assertNothingSent();
    }

    public function test_nothing_is_sent_when_disabled_or_already_synced(): void
    {
        Http::fake();
        $contifico = app(ContificoService::class);

        $this->assertNull($contifico->syncPatient($this->patient()));

        $this->enableContifico();
        $synced = $this->patient(['cedula' => '1710034073']);
        $synced->forceFill(['contifico_id' => 'YA'])->save();

        $this->assertNull($contifico->syncPatient($synced));
        Http::assertNothingSent();
    }

    public function test_rejected_request_is_final(): void
    {
        $contifico = $this->enableContifico();
        $patient = $this->patient();

        Http::fake(fn (Request $request) => $request->method() === 'GET'
            ? Http::response([], 200)
            : Http::response(['mensaje' => 'La cédula es inválida'], 400));

        $log = $contifico->syncPatient($patient);

        $this->assertSame(ContificoSyncLog::STATUS_FAILED, $log->status);
        $this->assertSame(400, $log->http_status);
        $this->assertStringContainsString('La cédula es inválida', $log->message);
    }

    public function test_rejected_credentials_on_lookup_do_not_attempt_to_create(): void
    {
        $contifico = $this->enableContifico();

        Http::fake(fn () => Http::response(['mensaje' => 'No autorizado'], 401));

        $log = $contifico->syncPatient($this->patient());

        $this->assertSame(ContificoSyncLog::STATUS_FAILED, $log->status);
        $this->assertSame(401, $log->http_status);
        Http::assertNotSent(fn (Request $request) => $request->method() === 'POST');
    }

    public function test_server_error_is_retryable(): void
    {
        $contifico = $this->enableContifico();

        Http::fake(fn () => Http::response('Bad gateway', 502));

        $this->expectException(ContificoTemporaryException::class);
        $contifico->syncPatient($this->patient());
    }

    public function test_error_messages_never_contain_the_credentials(): void
    {
        $contifico = $this->enableContifico();
        $patient = $this->patient();

        Http::fake(fn (Request $request) => throw new ConnectionException(
            'cURL error 6 for https://api.contifico.com/sistema/api/v1/persona/?pos='.self::API_TOKEN.' key '.self::API_KEY
        ));

        try {
            $contifico->syncPatient($patient);
            $this->fail('Se esperaba ContificoTemporaryException.');
        } catch (ContificoTemporaryException $e) {
            $this->assertStringNotContainsString(self::API_TOKEN, $e->getMessage());
            $this->assertStringNotContainsString(self::API_KEY, $e->getMessage());
        }

        $stored = ContificoSyncLog::latest('id')->first();
        $this->assertStringNotContainsString(self::API_TOKEN, $stored->message);
        $this->assertStringNotContainsString(self::API_KEY, $stored->message);
        $this->assertStringNotContainsString(self::API_TOKEN, json_encode($stored->payload));
    }

    public function test_retry_overwrites_the_failed_row_instead_of_adding_one(): void
    {
        $contifico = $this->enableContifico();
        $patient = $this->patient();

        Http::fake(fn () => Http::response('caido', 503));

        foreach ([1, 2] as $attempt) {
            try {
                $contifico->syncPatient($patient, null, $attempt);
            } catch (ContificoTemporaryException) {
                // esperado
            }
        }

        $this->assertSame(1, ContificoSyncLog::where('patient_id', $patient->id)->count());
        $this->assertSame(2, ContificoSyncLog::where('patient_id', $patient->id)->value('attempt'));
    }

    // ─── Historial y reintento manual ────────────────────────────────────────

    public function test_logs_endpoint_returns_only_the_last_ten_sends(): void
    {
        $this->enableContifico();
        $this->actingWith(Permission::SETTINGS_EDIT);
        $patient = $this->patient();

        foreach (range(1, 12) as $i) {
            ContificoSyncLog::create([
                'patient_id' => $patient->id,
                'action' => ContificoSyncLog::ACTION_CREATE,
                'status' => ContificoSyncLog::STATUS_FAILED,
                'message' => "Intento {$i}",
            ]);
        }
        ContificoSyncLog::create([
            'action' => ContificoSyncLog::ACTION_TEST,
            'status' => ContificoSyncLog::STATUS_SUCCESS,
        ]);

        $this->getJson('/api/contifico/logs')
            ->assertOk()
            ->assertJsonCount(10, 'data')
            ->assertJsonPath('data.0.message', 'Intento 12')
            ->assertJsonPath('data.0.patient.nombre_completo', 'Ana Pérez')
            ->assertJsonPath('data.0.can_retry', true);
    }

    public function test_manual_sync_reports_the_real_result(): void
    {
        $this->enableContifico();
        $this->actingWith(Permission::PATIENTS_EDIT);
        $patient = $this->patient();

        Http::fake(fn (Request $request) => $request->method() === 'GET'
            ? Http::response([], 200)
            : Http::response(['id' => 'NUEVO'], 201));

        $this->postJson("/api/contifico/patients/{$patient->id}/sync")
            ->assertOk()
            ->assertJsonPath('contifico_id', 'NUEVO');

        // Segunda vez: no vuelve a llamar a Contifico.
        Http::fake();
        $this->postJson("/api/contifico/patients/{$patient->id}/sync")->assertOk();
        Http::assertNothingSent();
    }

    public function test_manual_sync_requires_permission_and_active_integration(): void
    {
        $patient = $this->patient();

        $this->actingWith();
        $this->postJson("/api/contifico/patients/{$patient->id}/sync")->assertForbidden();

        $this->actingWith(Permission::PATIENTS_EDIT);
        $this->postJson("/api/contifico/patients/{$patient->id}/sync")->assertStatus(422);
    }
}
