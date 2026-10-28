<?php

namespace Tests\Feature;

use Tests\TestCase;

class AppVersionTest extends TestCase
{
    public function test_app_version_is_public_json_and_never_cached(): void
    {
        $response = $this->get('/app-version.json');

        $response->assertOk()->assertJsonStructure(['version']);
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
    }

    /**
     * El SPA la pide al recuperar el foco, a veces mientras se inicia sesion. Si
     * respondia con la cookie de sesion anterior y llegaba despues del login,
     * pisaba la sesion nueva: el usuario se veia dentro y todo /api daba 401.
     */
    public function test_app_version_never_sets_session_cookies(): void
    {
        $response = $this->get('/app-version.json')->assertOk();

        $this->assertSame([], $response->headers->getCookies());
    }

    public function test_spa_embeds_the_build_it_was_loaded_with(): void
    {
        $version = $this->getJson('/app-version.json')->json('version');

        $this->get('/login')->assertOk()->assertSee('<meta name="app-build" content="'.$version.'">', false);
    }
}
