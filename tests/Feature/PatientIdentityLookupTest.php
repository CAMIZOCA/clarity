<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Models\Patient;
use App\Models\User;
use App\Services\EcuadorApiService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Autocompletado del alta con EcuadorAPI: llena nombre, apellido y fecha de
 * nacimiento cuando puede y, cuando no, responde vacio sin estorbar el alta.
 */
class PatientIdentityLookupTest extends TestCase
{
    use RefreshDatabase;

    private const API_KEY = 'ecu_clave_de_prueba';

    // Cedulas con digito verificador correcto.
    private const CEDULA = '1710034065';

    private const OTRA_CEDULA = '0926687856';

    private const NOMBRES_URL = 'api.ecuadorapi.com/api/v1/cedulas/*/nombres';

    private const NACIMIENTO_URL = 'api.ecuadorapi.com/api/v1/cedulas/*/nacimiento';

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        config(['services.ecuadorapi.key' => self::API_KEY]);

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

    private function identity(string $cedula = self::CEDULA)
    {
        return $this->getJson('/api/patients/identity?cedula='.urlencode($cedula));
    }

    /** Sobre `{data, error, message, code}` de EcuadorAPI. */
    private function envelope(array $data)
    {
        return Http::response(['data' => $data, 'error' => null, 'message' => null, 'code' => null]);
    }

    private function names(array $overrides = [])
    {
        return $this->envelope($overrides + [
            'id' => self::CEDULA,
            'full_name' => 'PEREZ LOPEZ JUAN CARLOS',
            'first_name' => 'JUAN CARLOS',
            'last_name' => 'PEREZ LOPEZ',
        ]);
    }

    private function birth(?string $date = '1985-03-14')
    {
        return $this->envelope(['id' => self::CEDULA, 'birth_date' => $date, 'age' => 41]);
    }

    private function fakeApi(mixed $names = null, mixed $birth = null): void
    {
        Http::fake([
            self::NOMBRES_URL => $names ?? $this->names(),
            self::NACIMIENTO_URL => $birth ?? $this->birth(),
        ]);
    }

    private function outOfCredit()
    {
        return Http::response(
            ['data' => null, 'error' => true, 'message' => 'Te quedaste sin saldo de créditos.', 'code' => 'payment_required'],
            402,
            ['Retry-After' => '1929856'],
        );
    }

    private function assertNothingFound($response): void
    {
        $response->assertOk()
            ->assertJsonPath('data.encontrado', false)
            ->assertJsonPath('data.nombre', null)
            ->assertJsonPath('data.apellido', null)
            ->assertJsonPath('data.fecha_nacimiento', null);
    }

    public function test_a_new_document_returns_names_and_birth_date(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE);
        $this->fakeApi();

        $this->identity()
            ->assertOk()
            ->assertJsonPath('data.encontrado', true)
            ->assertJsonPath('data.nombre', 'JUAN CARLOS')
            ->assertJsonPath('data.apellido', 'PEREZ LOPEZ')
            ->assertJsonPath('data.fecha_nacimiento', '1985-03-14');

        Http::assertSentCount(2);
        Http::assertSent(fn (Request $request) => $request->method() === 'GET'
            && $request->url() === 'https://api.ecuadorapi.com/api/v1/cedulas/'.self::CEDULA.'/nombres'
            && $request->hasHeader('Authorization', 'Bearer '.self::API_KEY));
        Http::assertSent(fn (Request $request) => $request->url() === 'https://api.ecuadorapi.com/api/v1/cedulas/'.self::CEDULA.'/nacimiento');
    }

    /** Un RUC de persona natural es su cedula + establecimiento. */
    public function test_a_ruc_is_looked_up_by_its_cedula(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE);
        $this->fakeApi();

        $this->identity(self::CEDULA.'001')->assertJsonPath('data.nombre', 'JUAN CARLOS');

        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/cedulas/'.self::CEDULA.'/nombres'));
    }

    /** La API no documenta el formato de `birth_date`. */
    public function test_a_day_first_birth_date_is_normalized_to_iso(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE);
        $this->fakeApi(birth: $this->birth('14/03/1985'));

        $this->identity()->assertJsonPath('data.fecha_nacimiento', '1985-03-14');
    }

    public function test_a_birth_date_with_time_is_normalized_to_iso(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE);
        $this->fakeApi(birth: $this->birth('1985-03-14T00:00:00Z'));

        $this->identity()->assertJsonPath('data.fecha_nacimiento', '1985-03-14');
    }

    public function test_names_are_returned_even_if_the_birth_date_fails(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE);
        $this->fakeApi(birth: Http::response(['data' => null, 'error' => true], 500));

        $this->identity()
            ->assertJsonPath('data.encontrado', true)
            ->assertJsonPath('data.apellido', 'PEREZ LOPEZ')
            ->assertJsonPath('data.fecha_nacimiento', null);

        // A medias no se cachea: la siguiente consulta vuelve a intentarlo.
        $this->identity();
        Http::assertSentCount(4);
    }

    /** Una fecha que el alta rechazaria no se ofrece. */
    public function test_an_unusable_birth_date_is_dropped(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE);
        $this->fakeApi(birth: $this->birth('31/02/1985'));

        $this->identity()
            ->assertJsonPath('data.encontrado', true)
            ->assertJsonPath('data.fecha_nacimiento', null);
    }

    public function test_a_full_name_without_breakdown_goes_to_nombre(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE);
        $this->fakeApi(names: $this->names(['first_name' => null, 'last_name' => null]));

        $this->identity()
            ->assertJsonPath('data.nombre', 'PEREZ LOPEZ JUAN CARLOS')
            ->assertJsonPath('data.apellido', null);
    }

    public function test_running_out_of_credit_answers_empty_and_pauses_the_lookups(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE);
        $this->fakeApi($this->outOfCredit(), $this->outOfCredit());

        $this->assertNothingFound($this->identity());
        Http::assertSentCount(2);
        $this->assertTrue(Cache::has(EcuadorApiService::CACHE_PAUSED));

        // En pausa no se vuelve a llamar: cada alta no paga la espera.
        $this->assertNothingFound($this->identity(self::OTRA_CEDULA));
        Http::assertSentCount(2);
    }

    public function test_the_pause_ends_by_itself(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE);
        $this->fakeApi($this->outOfCredit(), $this->outOfCredit());
        $this->identity();

        // El Retry-After de la API (22 dias) se recorta a una hora.
        $this->travel(61)->minutes();
        $this->assertFalse(Cache::has(EcuadorApiService::CACHE_PAUSED));
    }

    public function test_a_connection_failure_answers_empty(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE);
        Http::fake(fn () => throw new ConnectionException('cURL error 28: timeout'));

        $this->assertNothingFound($this->identity());
        $this->assertFalse(Cache::has(EcuadorApiService::CACHE_PAUSED));
    }

    public function test_an_unknown_document_answers_empty(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE);
        $notFound = Http::response(['data' => null, 'error' => true, 'code' => 'not_found'], 404);
        $this->fakeApi($notFound, $notFound);

        $this->assertNothingFound($this->identity());
        $this->assertFalse(Cache::has(EcuadorApiService::CACHE_PAUSED));
    }

    public function test_the_same_document_is_only_paid_once(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE);
        $this->fakeApi();

        $this->identity()->assertJsonPath('data.nombre', 'JUAN CARLOS');
        $this->identity()->assertJsonPath('data.nombre', 'JUAN CARLOS')
            ->assertJsonPath('data.fecha_nacimiento', '1985-03-14');

        Http::assertSentCount(2);
    }

    public function test_a_registered_document_is_never_looked_up(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE);
        Http::fake();
        Patient::create(['nombre' => 'Ana', 'apellido' => 'Pérez', 'cedula' => self::CEDULA, 'fecha_nacimiento' => '1990-01-01']);

        $this->assertNothingFound($this->identity());
        // El RUC de la misma persona tampoco.
        $this->assertNothingFound($this->identity(self::CEDULA.'001'));

        Http::assertNothingSent();
    }

    public function test_an_invalid_document_or_a_passport_is_never_looked_up(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE);
        Http::fake();

        // Digito verificador incorrecto, pasaporte y vacio.
        $this->assertNothingFound($this->identity('1710034066'));
        $this->assertNothingFound($this->identity('AB123456'));
        $this->assertNothingFound($this->identity(''));

        Http::assertNothingSent();
    }

    public function test_without_a_key_the_lookup_is_off(): void
    {
        config(['services.ecuadorapi.key' => null]);
        $this->actingWith(Permission::PATIENTS_CREATE);
        Http::fake();

        $this->assertNothingFound($this->identity());

        Http::assertNothingSent();
    }

    public function test_identity_needs_the_create_permission(): void
    {
        Http::fake();

        $this->actingWith(Permission::PATIENTS_VIEW);
        $this->identity()->assertForbidden();

        Http::assertNothingSent();
    }

    public function test_identity_requires_authentication(): void
    {
        $this->identity()->assertUnauthorized();
    }
}
