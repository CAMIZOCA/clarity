<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * "Recordarme" en el login: con `remember` la sesion sobrevive al cierre del navegador
 * mediante la cookie remember_web_* y users.remember_token. Sin la casilla no se emite.
 */
class LoginRememberTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_with_remember_issues_the_remember_cookie_and_token(): void
    {
        $user = User::factory()->create(['password' => bcrypt('Secreta-2026!'), 'remember_token' => null]);

        $response = $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'Secreta-2026!',
            'remember' => true,
        ])->assertOk();

        $cookies = collect($response->headers->getCookies())->map->getName();
        $this->assertTrue($cookies->contains(fn (string $name) => str_starts_with($name, 'remember_web_')));
        $this->assertNotNull($user->fresh()->remember_token);
    }

    public function test_login_without_remember_does_not_issue_the_remember_cookie(): void
    {
        $user = User::factory()->create(['password' => bcrypt('Secreta-2026!'), 'remember_token' => null]);

        $response = $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'Secreta-2026!',
        ])->assertOk();

        $cookies = collect($response->headers->getCookies())->map->getName();
        $this->assertFalse($cookies->contains(fn (string $name) => str_starts_with($name, 'remember_web_')));
        $this->assertNull($user->fresh()->remember_token);
    }
}
