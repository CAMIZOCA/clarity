<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Models\CertifyingDoctor;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class CertifyingDoctorTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        Storage::fake('public');
    }

    private function admin(): User
    {
        $user = User::factory()->create();
        SpatiePermission::firstOrCreate([
            'name' => Permission::SETTINGS_EDIT->value,
            'guard_name' => 'web',
        ]);
        $user->givePermissionTo(Permission::SETTINGS_EDIT->value);

        return $user;
    }

    public function test_doctor_can_be_created(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/certifying-doctors', [
            'nombre' => 'Pamela López C.',
            'titulo' => 'OPTÓMETRA',
            'registro_senescyt' => '2250-2021-2278447',
        ])->assertCreated();

        $this->assertDatabaseHas('certifying_doctors', ['nombre' => 'Pamela López C.']);
    }

    public function test_only_one_doctor_stays_default(): void
    {
        Sanctum::actingAs($this->admin());

        $first = CertifyingDoctor::create(['nombre' => 'Doctor A', 'is_default' => true]);

        $this->postJson('/api/certifying-doctors', [
            'nombre' => 'Doctor B',
            'is_default' => true,
        ])->assertCreated();

        $this->assertFalse($first->fresh()->is_default);
        $this->assertSame(1, CertifyingDoctor::where('is_default', true)->count());
    }

    public function test_signature_can_be_uploaded(): void
    {
        Sanctum::actingAs($this->admin());
        $doctor = CertifyingDoctor::create(['nombre' => 'Doctor A']);

        $this->post("/api/certifying-doctors/{$doctor->id}/firma", [
            'firma' => UploadedFile::fake()->image('firma.png'),
        ])->assertOk();

        $doctor->refresh();
        $this->assertNotNull($doctor->firma_path);
        Storage::disk('public')->assertExists($doctor->firma_path);
    }

    public function test_user_without_settings_permission_cannot_manage_doctors(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/certifying-doctors', ['nombre' => 'Doctor X'])
            ->assertForbidden();
    }
}
