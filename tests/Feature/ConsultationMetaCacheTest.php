<?php

namespace Tests\Feature;

use App\Models\ClinicalCatalogGroup;
use App\Models\ClinicalCatalogItem;
use App\Models\PrintTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * `/api/consultations-meta` se cachea 10 min. En produccion el store es
 * `database`, que serializa el valor; como `config/cache.php` restringe las
 * clases deserializables, todo Collection o Model guardado ahi volvia como
 * `__PHP_Incomplete_Class` y los selects de Medico, Plantilla y Diagnosticos
 * salian vacios en cuanto la respuesta venia de cache.
 *
 * La suite corre con CACHE_STORE=array, que guarda objetos en memoria y no
 * reproduce el fallo: estos tests fuerzan el store de base de datos.
 */
class ConsultationMetaCacheTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['cache.default' => 'database']);
        Cache::store('database')->clear();
    }

    private function seedMeta(): void
    {
        $group = ClinicalCatalogGroup::create([
            'key' => 'diagnoses',
            'name' => 'Diagnósticos',
        ]);

        ClinicalCatalogItem::create([
            'group_id' => $group->id,
            'key' => 'miopia',
            'code' => 'H52.1',
            'label' => 'Miopía',
            'is_active' => true,
            'sort_order' => 1,
        ]);

        PrintTemplate::create([
            'key' => 'receta',
            'name' => 'Receta estándar',
            'is_active' => true,
            'sort_order' => 1,
        ]);

        User::factory()->create(['role' => 'optometra', 'name' => 'Dra. Prueba']);
    }

    public function test_meta_survives_a_cache_hit(): void
    {
        $this->seedMeta();
        Sanctum::actingAs(User::factory()->create());

        // Primera peticion: se calcula y se guarda en cache.
        $fresh = $this->getJson('/api/consultations-meta')->assertOk()->json();

        // Segunda peticion: se lee de cache. Aqui es donde se corrompia.
        $cached = $this->getJson('/api/consultations-meta')->assertOk()->json();

        foreach (['catalogs', 'templates', 'optometrists'] as $key) {
            $this->assertNotEmpty($fresh[$key], "La primera respuesta trae {$key} vacío.");
            $this->assertNotEmpty($cached[$key], "La respuesta cacheada perdió {$key}.");
        }

        $this->assertSame($fresh, $cached);
    }

    public function test_cached_meta_contains_no_incomplete_classes(): void
    {
        $this->seedMeta();
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/consultations-meta')->assertOk();

        $raw = Cache::store('database')->get('consultation_meta');

        $this->assertIsArray($raw);
        $this->assertStringNotContainsString(
            '__PHP_Incomplete_Class',
            json_encode($raw),
            'El valor cacheado contiene objetos que no se pueden reconstruir.'
        );

        foreach ($raw as $value) {
            $this->assertIsNotObject($value, 'Ningun valor cacheado debe ser un objeto.');
        }
    }

    public function test_catalog_labels_are_present_for_the_form_selects(): void
    {
        $this->seedMeta();
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/consultations-meta');

        $this->getJson('/api/consultations-meta')
            ->assertOk()
            ->assertJsonPath('catalogs.diagnoses.0.label', 'Miopía')
            ->assertJsonPath('templates.0.key', 'receta')
            ->assertJsonPath('optometrists.0.label', 'Dra. Prueba');
    }
}
