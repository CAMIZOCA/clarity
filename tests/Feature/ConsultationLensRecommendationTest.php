<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Models\ClinicalCatalogGroup;
use App\Models\ClinicalCatalogItem;
use App\Models\Consultation;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * `luna_material`, `luna_espesor` y `luna_proteccion` repiten la etiqueta del
 * catalogo elegido en "Recomendacion de lunas". En las consultas importadas
 * traen texto del sistema anterior (752 de ellas, a veces notas clinicas) que
 * el formulario no muestra en esos selectores: cada guardado lo borraba.
 */
class ConsultationLensRecommendationTest extends TestCase
{
    use RefreshDatabase;

    private const NO_SELECTION = [
        'material_item_id' => '',
        'thickness_item_id' => '',
        'protection_item_id' => '',
        'observation' => '',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $user = User::factory()->create();
        foreach ([Permission::CONSULTATIONS_CREATE->value, Permission::CONSULTATIONS_EDIT->value] as $permission) {
            SpatiePermission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
            $user->givePermissionTo($permission);
        }
        Sanctum::actingAs($user);
    }

    private function importedConsultation(): Consultation
    {
        $patient = Patient::create([
            'nombre' => 'Elena', 'apellido' => 'Tapia', 'cedula' => '1710000601', 'fecha_nacimiento' => '1958-06-02',
        ]);

        return Consultation::create([
            'patient_id' => $patient->id,
            'fecha_consulta' => '2018-11-05',
            'estado' => 'completada',
            'legacy_id' => '71791',
            'luna_espesor' => 'Usa Anapril de 20',
            'luna_proteccion' => 'Lleva 24 horas con el ojo izquierdo irritado.',
        ]);
    }

    private function catalogItem(string $label): ClinicalCatalogItem
    {
        $group = ClinicalCatalogGroup::firstOrCreate(['key' => 'lens_thicknesses'], ['name' => 'Espesores']);

        return ClinicalCatalogItem::create([
            'group_id' => $group->id, 'key' => str($label)->slug('_')->value(), 'label' => $label,
            'is_active' => true, 'sort_order' => 1,
        ]);
    }

    public function test_saving_an_imported_consultation_keeps_its_inherited_lens_text(): void
    {
        $consultation = $this->importedConsultation();

        $this->putJson("/api/consultations/{$consultation->id}", [
            'estado' => 'completada',
            'observaciones' => 'Control sin novedad.',
            'lens_recommendation' => self::NO_SELECTION,
        ])->assertOk();

        $this->assertDatabaseHas('consultations', [
            'id' => $consultation->id,
            'luna_espesor' => 'Usa Anapril de 20',
            'luna_proteccion' => 'Lleva 24 horas con el ojo izquierdo irritado.',
            'observaciones' => 'Control sin novedad.',
        ]);
        // Sin nada elegido tampoco se crea una fila vacia.
        $this->assertDatabaseCount('consultation_lens_recommendations', 0);
    }

    public function test_choosing_a_catalog_item_replaces_the_flat_column_and_clearing_it_empties_it(): void
    {
        $consultation = $this->importedConsultation();
        $item = $this->catalogItem('Alto índice 1.67');

        $this->putJson("/api/consultations/{$consultation->id}", [
            'estado' => 'completada',
            'lens_recommendation' => ['thickness_item_id' => $item->id] + self::NO_SELECTION,
        ])->assertOk();

        $this->assertDatabaseHas('consultations', [
            'id' => $consultation->id,
            'luna_espesor' => 'Alto índice 1.67',
            // La proteccion no se toco: conserva el texto importado.
            'luna_proteccion' => 'Lleva 24 horas con el ojo izquierdo irritado.',
        ]);

        // Quitar una seleccion hecha en el sistema si vacia la columna, y la
        // seleccion deja de volver al recargar.
        $this->putJson("/api/consultations/{$consultation->id}", [
            'estado' => 'completada',
            'lens_recommendation' => self::NO_SELECTION,
        ])->assertOk()->assertJsonPath('lens_recommendation.thickness_item_id', null);

        $this->assertDatabaseHas('consultations', [
            'id' => $consultation->id,
            'luna_espesor' => null,
            'luna_proteccion' => 'Lleva 24 horas con el ojo izquierdo irritado.',
        ]);
    }

    public function test_the_lens_observation_is_mirrored_to_its_flat_column(): void
    {
        $consultation = $this->importedConsultation();

        $this->putJson("/api/consultations/{$consultation->id}", [
            'estado' => 'completada',
            'lens_recommendation' => ['observation' => 'Antirreflejo recomendado'] + self::NO_SELECTION,
        ])->assertOk()->assertJsonPath('lens_recommendation.observation', 'Antirreflejo recomendado');

        $this->assertDatabaseHas('consultations', [
            'id' => $consultation->id,
            'luna_observacion' => 'Antirreflejo recomendado',
        ]);
    }
}
