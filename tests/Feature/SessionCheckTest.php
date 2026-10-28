<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\AppVersion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * `/session-check` alimenta "Revisar conexion" del SPA. Debe responder 200
 * siempre (un fallo aqui no diagnostica nada) y no exponer datos del usuario.
 */
class SessionCheckTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_gets_unauthenticated_status(): void
    {
        $this->getJson('/session-check')
            ->assertOk()
            ->assertHeader('Cache-Control', 'max-age=0, no-store, private')
            ->assertJsonStructure(['server', 'database', 'authenticated', 'version', 'time'])
            ->assertJson([
                'server' => true,
                'database' => true,
                'authenticated' => false,
                'version' => AppVersion::current(),
            ]);
    }

    public function test_logged_user_is_authenticated_without_leaking_data(): void
    {
        $user = User::factory()->create(['email' => 'temporal@example.com']);

        $response = $this->actingAs($user)->getJson('/session-check')->assertOk();

        $this->assertTrue($response->json('authenticated'));
        $this->assertSame(['server', 'database', 'authenticated', 'version', 'time'], array_keys($response->json()));
        $this->assertStringNotContainsString('temporal@example.com', $response->getContent());
    }

    public function test_reports_database_down_with_ok_status(): void
    {
        $default = config('database.default');
        $original = config("database.connections.$default");

        try {
            config(['database.connections.broken' => [
                'driver' => 'sqlite',
                'database' => storage_path('no-existe/no-existe.sqlite'),
                'prefix' => '',
            ], 'database.default' => 'broken']);

            $this->getJson('/session-check')
                ->assertOk()
                ->assertJson(['server' => true, 'database' => false, 'authenticated' => false]);
        } finally {
            config(['database.default' => $default, "database.connections.$default" => $original]);
            DB::purge('broken');
        }
    }
}
