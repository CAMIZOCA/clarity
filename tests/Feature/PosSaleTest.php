<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Models\Branch;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class PosSaleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function actingAsSeller(): User
    {
        $user = User::factory()->create();

        foreach ([Permission::SALES_CREATE->value, Permission::SALES_VIEW->value] as $permission) {
            SpatiePermission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
            $user->givePermissionTo($permission);
        }

        Sanctum::actingAs($user);

        return $user;
    }

    private function seedBranchAndWarehouse(): array
    {
        $branch = Branch::create([
            'name' => 'Matriz',
            'code' => 'EC-001',
            'is_active' => true,
            'is_main' => true,
        ]);

        $warehouse = Warehouse::create([
            'branch_id' => $branch->id,
            'name' => 'Bodega principal',
            'type' => 'principal',
            'is_active' => true,
            'is_default' => true,
        ]);

        return [$branch, $warehouse];
    }

    /**
     * `prescription_eye` e `item_type` son NOT NULL con default en la tabla.
     * El servicio les pasaba NULL explicito, que en modo strict aborta el
     * insert: agregar cualquier producto en el POS respondia 500.
     */
    public function test_item_can_be_added_without_optional_enum_fields(): void
    {
        $this->actingAsSeller();
        $this->seedBranchAndWarehouse();

        $saleId = $this->postJson('/api/sales', [])
            ->assertCreated()
            ->json('data.id');

        $this->postJson("/api/sales/{$saleId}/items", [
            'description' => 'Armazón de prueba',
            'quantity' => 1,
            'unit_price' => 50,
        ])->assertCreated();

        $this->assertDatabaseHas('sale_items', [
            'sale_id' => $saleId,
            'description' => 'Armazón de prueba',
            'item_type' => 'product',
            'prescription_eye' => 'N/A',
        ]);
    }

    /**
     * Sin sucursal ni bodega, deductInventoryForSale() hace return temprano y
     * la venta pagada nunca descuenta stock; ademas todo reporte por sucursal
     * queda en cero.
     */
    public function test_draft_sale_falls_back_to_main_branch_and_default_warehouse(): void
    {
        $this->actingAsSeller();
        [$branch, $warehouse] = $this->seedBranchAndWarehouse();

        $sale = $this->postJson('/api/sales', [])
            ->assertCreated()
            ->json('data');

        $this->assertSame($branch->id, $sale['branch_id']);
        $this->assertSame($warehouse->id, $sale['warehouse_id']);
    }

    /** La sucursal del usuario gana sobre la principal. */
    public function test_draft_sale_prefers_the_user_own_branch(): void
    {
        $user = $this->actingAsSeller();
        $this->seedBranchAndWarehouse();

        $otherBranch = Branch::create([
            'name' => 'Sucursal Norte',
            'code' => 'EC-002',
            'is_active' => true,
            'is_main' => false,
        ]);
        $otherWarehouse = Warehouse::create([
            'branch_id' => $otherBranch->id,
            'name' => 'Bodega Norte',
            'type' => 'principal',
            'is_active' => true,
            'is_default' => true,
        ]);

        $user->update(['branch_id' => $otherBranch->id]);

        $sale = $this->postJson('/api/sales', [])
            ->assertCreated()
            ->json('data');

        $this->assertSame($otherBranch->id, $sale['branch_id']);
        $this->assertSame($otherWarehouse->id, $sale['warehouse_id']);
    }
}
