<?php

namespace Tests\Unit;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Campaign;
use App\Models\Consultation;
use App\Models\Inventory;
use App\Models\MessageTemplate;
use App\Models\Patient;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Reminder;
use App\Models\Sale;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ModuleCrudTest extends TestCase
{
    use RefreshDatabase;

    public function test_patient_module_can_insert_update_and_delete_data(): void
    {
        $user = $this->createUser();

        $patient = Patient::create([
            'nombre' => 'Paciente Prueba',
            'cedula' => '1710034065',
            'fecha_nacimiento' => '1990-01-15',
            'telefono' => '0991234567',
            'email' => 'paciente@example.com',
            'created_by' => $user->id,
        ]);

        $this->assertDatabaseHas('patients', [
            'id' => $patient->id,
            'nombre' => 'Paciente Prueba',
        ]);

        $patient->update(['telefono' => '022345678']);

        $this->assertDatabaseHas('patients', [
            'id' => $patient->id,
            'telefono' => '022345678',
        ]);

        $patient->delete();

        $this->assertSoftDeleted('patients', ['id' => $patient->id]);
    }

    public function test_appointment_module_can_insert_update_and_delete_data(): void
    {
        $user = $this->createUser();
        $patient = $this->createPatient($user);

        $appointment = Appointment::create([
            'patient_id' => $patient->id,
            'optometrista_id' => $user->id,
            'titulo' => 'Control visual',
            'fecha_hora_inicio' => '2026-06-10 09:00:00',
            'fecha_hora_fin' => '2026-06-10 09:30:00',
            'estado' => 'pendiente',
        ]);

        $this->assertDatabaseHas('appointments', [
            'id' => $appointment->id,
            'estado' => 'pendiente',
        ]);

        $appointment->update(['estado' => 'atendido']);

        $this->assertDatabaseHas('appointments', [
            'id' => $appointment->id,
            'estado' => 'atendido',
        ]);

        $appointment->delete();

        $this->assertDatabaseMissing('appointments', ['id' => $appointment->id]);
    }

    public function test_consultation_module_can_insert_update_and_delete_data(): void
    {
        $user = $this->createUser();
        $patient = $this->createPatient($user);

        $consultation = Consultation::create([
            'patient_id' => $patient->id,
            'optometrista_id' => $user->id,
            'created_by' => $user->id,
            'fecha_consulta' => '2026-06-10',
            'estado' => 'borrador',
            'motivo_consulta' => 'Control anual',
        ]);

        $this->assertDatabaseHas('consultations', [
            'id' => $consultation->id,
            'estado' => 'borrador',
        ]);

        $consultation->update([
            'estado' => 'completada',
            'diagnostico_descripcion' => 'Miopia leve',
        ]);

        $this->assertDatabaseHas('consultations', [
            'id' => $consultation->id,
            'estado' => 'completada',
            'diagnostico_descripcion' => 'Miopia leve',
        ]);

        $consultation->delete();

        $this->assertSoftDeleted('consultations', ['id' => $consultation->id]);
    }

    public function test_branch_and_warehouse_modules_can_insert_update_and_delete_data(): void
    {
        $branch = $this->createBranch();

        $this->assertDatabaseHas('branches', [
            'id' => $branch->id,
            'code' => 'UIO-001',
        ]);

        $branch->update(['phone' => '022345678']);

        $this->assertDatabaseHas('branches', [
            'id' => $branch->id,
            'phone' => '022345678',
        ]);

        $warehouse = Warehouse::create([
            'branch_id' => $branch->id,
            'name' => 'Bodega Principal',
            'code' => 'BOD-001',
            'type' => 'principal',
            'is_default' => true,
        ]);

        $warehouse->update(['type' => 'exhibicion']);

        $this->assertDatabaseHas('warehouses', [
            'id' => $warehouse->id,
            'type' => 'exhibicion',
        ]);

        $warehouse->delete();
        $branch->delete();

        $this->assertSoftDeleted('warehouses', ['id' => $warehouse->id]);
        $this->assertSoftDeleted('branches', ['id' => $branch->id]);
    }

    public function test_inventory_module_can_insert_update_and_delete_data(): void
    {
        $branch = $this->createBranch();
        $warehouse = $this->createWarehouse($branch);
        $supplier = Supplier::create([
            'name' => 'Proveedor Prueba',
            'ruc' => '1710034065001',
            'type' => 'mixto',
        ]);
        $product = Product::create([
            'sku' => 'PROD-001',
            'name' => 'Armazon Prueba',
            'category' => 'armazon',
            'supplier_id' => $supplier->id,
            'has_variants' => true,
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'PROD-001-NEGRO',
            'color' => 'Negro',
            'cost_price' => 25,
            'sale_price' => 60,
        ]);

        $inventory = Inventory::create([
            'product_variant_id' => $variant->id,
            'warehouse_id' => $warehouse->id,
            'quantity' => 10,
            'reserved' => 2,
            'min_stock' => 3,
            'avg_cost' => 25,
        ]);

        $this->assertDatabaseHas('inventory', [
            'id' => $inventory->id,
            'quantity' => 10,
        ]);

        $inventory->update(['quantity' => 15]);
        $product->update(['name' => 'Armazon Actualizado']);

        $this->assertDatabaseHas('inventory', [
            'id' => $inventory->id,
            'quantity' => 15,
        ]);
        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'name' => 'Armazon Actualizado',
        ]);

        $inventory->delete();
        $variant->delete();
        $product->delete();
        $supplier->delete();

        $this->assertDatabaseMissing('inventory', ['id' => $inventory->id]);
        $this->assertSoftDeleted('product_variants', ['id' => $variant->id]);
        $this->assertSoftDeleted('products', ['id' => $product->id]);
        $this->assertSoftDeleted('suppliers', ['id' => $supplier->id]);
    }

    public function test_sales_module_can_insert_update_and_delete_data(): void
    {
        $user = $this->createUser();
        $patient = $this->createPatient($user);
        $branch = $this->createBranch();
        $warehouse = $this->createWarehouse($branch);

        $sale = Sale::create([
            'patient_id' => $patient->id,
            'branch_id' => $branch->id,
            'warehouse_id' => $warehouse->id,
            'user_id' => $user->id,
            'status' => 'draft',
            'subtotal' => 100,
            'taxable_base' => 100,
            'tax_amount' => 15,
            'total' => 115,
            'balance' => 115,
        ]);

        $this->assertDatabaseHas('sales', [
            'id' => $sale->id,
            'status' => 'draft',
        ]);

        $payment = Payment::create([
            'sale_id' => $sale->id,
            'processed_by' => $user->id,
            'method' => 'cash',
            'amount' => 50,
            'payment_type' => 'deposit',
            'processed_at' => now(),
            'created_at' => now(),
        ]);

        $sale->update([
            'status' => 'partial',
            'paid_amount' => 50,
            'balance' => 65,
        ]);

        $this->assertDatabaseHas('payments', [
            'id' => $payment->id,
            'amount' => 50,
        ]);
        $this->assertDatabaseHas('sales', [
            'id' => $sale->id,
            'status' => 'partial',
            'balance' => 65,
        ]);

        $payment->delete();
        $sale->delete();

        $this->assertDatabaseMissing('payments', ['id' => $payment->id]);
        $this->assertSoftDeleted('sales', ['id' => $sale->id]);
    }

    public function test_crm_module_can_insert_update_and_delete_data(): void
    {
        $user = $this->createUser();
        $patient = $this->createPatient($user);

        $template = MessageTemplate::create([
            'name' => 'Recordatorio de cita',
            'type' => 'appointment_reminder',
            'channel' => 'whatsapp',
            'body' => 'Hola {nombre}, recuerda tu cita.',
            'variables' => ['nombre'],
        ]);

        $reminder = Reminder::create([
            'patient_id' => $patient->id,
            'template_id' => $template->id,
            'created_by' => $user->id,
            'type' => 'appointment',
            'channel' => 'whatsapp',
            'message' => 'Hola Paciente, recuerda tu cita.',
            'status' => 'pending',
            'scheduled_at' => now()->addDay(),
        ]);

        $campaign = Campaign::create([
            'name' => 'Campana de control visual',
            'channel' => 'whatsapp',
            'template_id' => $template->id,
            'message_body' => 'Agenda tu control visual.',
            'segment_criteria' => ['customer_type' => 'particular'],
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        $this->assertDatabaseHas('reminders', [
            'id' => $reminder->id,
            'status' => 'pending',
        ]);
        $this->assertDatabaseHas('campaigns', [
            'id' => $campaign->id,
            'status' => 'draft',
        ]);

        $reminder->update(['status' => 'cancelled']);
        $campaign->update(['status' => 'scheduled']);
        $template->update(['is_active' => false]);

        $this->assertDatabaseHas('reminders', [
            'id' => $reminder->id,
            'status' => 'cancelled',
        ]);
        $this->assertDatabaseHas('campaigns', [
            'id' => $campaign->id,
            'status' => 'scheduled',
        ]);
        $this->assertDatabaseHas('message_templates', [
            'id' => $template->id,
            'is_active' => false,
        ]);

        $reminder->delete();
        $campaign->delete();
        $template->delete();

        $this->assertDatabaseMissing('reminders', ['id' => $reminder->id]);
        $this->assertSoftDeleted('campaigns', ['id' => $campaign->id]);
        $this->assertSoftDeleted('message_templates', ['id' => $template->id]);
    }

    private function createUser(): User
    {
        return User::factory()->create();
    }

    private function createPatient(User $user): Patient
    {
        return Patient::create([
            'nombre' => 'Paciente Base',
            'cedula' => fake()->unique()->numerify('##########'),
            'fecha_nacimiento' => '1990-01-15',
            'telefono' => '0991234567',
            'email' => fake()->unique()->safeEmail(),
            'created_by' => $user->id,
        ]);
    }

    private function createBranch(): Branch
    {
        return Branch::create([
            'name' => 'Sucursal Quito',
            'code' => 'UIO-001',
            'city' => 'Quito',
            'province' => 'Pichincha',
            'is_main' => true,
        ]);
    }

    private function createWarehouse(Branch $branch): Warehouse
    {
        return Warehouse::create([
            'branch_id' => $branch->id,
            'name' => 'Bodega Principal',
            'code' => 'BOD-' . $branch->id,
            'type' => 'principal',
            'is_default' => true,
        ]);
    }
}
