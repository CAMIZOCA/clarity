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

    public function test_spa_embeds_the_build_it_was_loaded_with(): void
    {
        $version = $this->getJson('/app-version.json')->json('version');

        $this->get('/login')->assertOk()->assertSee('<meta name="app-build" content="'.$version.'">', false);
    }
}
