<?php

namespace Tests\Feature;

use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * La pantalla de ingreso no tiene sesion, asi que el logo se pide a
 * `/api/branding` sin autenticar. Solo puede devolver la URL del logo.
 */
class LoginBrandingTest extends TestCase
{
    use RefreshDatabase;

    public function test_devuelve_null_cuando_no_hay_logo_cargado(): void
    {
        $this->getJson('/api/branding')
            ->assertOk()
            ->assertExactJson(['clinic_logo_url' => null]);
    }

    public function test_devuelve_la_url_publica_del_logo_sin_autenticar(): void
    {
        Storage::fake('public');
        Setting::set('clinic_logo', 'clinic/logo.png');

        $this->getJson('/api/branding')
            ->assertOk()
            ->assertExactJson(['clinic_logo_url' => Storage::disk('public')->url('clinic/logo.png')]);
    }
}
