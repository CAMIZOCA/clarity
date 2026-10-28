<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * `AuthenticateSession` (Sanctum) guarda el hash de la contrasena del usuario en
 * la sesion y solo lo revisa mientras hay usuario. Si el usuario anterior de ese
 * navegador ya no existe, el hash viejo quedaba: el siguiente login respondia 200
 * y el primer request a /api vaciaba la sesion (401 con el usuario "dentro").
 */
class LoginSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_drops_the_password_hash_left_by_a_previous_user(): void
    {
        $user = User::factory()->create(['password' => bcrypt('Secreta-2026!')]);

        $this->withSession(['password_hash_web' => 'hash-de-un-usuario-borrado'])
            ->postJson('/login', ['email' => $user->email, 'password' => 'Secreta-2026!'])
            ->assertOk()
            ->assertSessionMissing('password_hash_web');
    }
}
