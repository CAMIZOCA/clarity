<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();

            // Número de venta auto-generado en el modelo: V-2026-00001
            $table->string('sale_number', 20)->unique();

            // Relaciones principales
            $table->foreignId('patient_id')->nullable()->constrained('patients')->onDelete('set null');
            $table->foreignId('consultation_id')->nullable()->constrained('consultations')->onDelete('set null');
            $table->foreignId('branch_id')->nullable()->constrained('branches')->onDelete('restrict');
            $table->foreignId('warehouse_id')->nullable()->constrained('warehouses')->onDelete('restrict');
            $table->foreignId('user_id')->constrained('users')->onDelete('restrict'); // Vendedor
            $table->foreignId('approved_by')->nullable()->constrained('users')->onDelete('set null'); // Aprobó descuento

            // Estado
            $table->enum('status', [
                'draft',      // Borrador
                'confirmed',  // Confirmada
                'partial',    // Pago parcial
                'paid',       // Pagada completa
                'cancelled',  // Cancelada
                'refunded',   // Devuelta
            ])->default('draft');

            // Montos
            $table->decimal('subtotal', 10, 2)->default(0);         // Suma de items sin descuento
            $table->decimal('discount_total', 10, 2)->default(0);   // Total descuentos
            $table->decimal('taxable_base', 10, 2)->default(0);     // Base imponible (con IVA)
            $table->decimal('tax_exempt_base', 10, 2)->default(0);  // Base exenta (sin IVA)
            $table->decimal('tax_amount', 10, 2)->default(0);       // Valor del IVA
            $table->decimal('total', 10, 2)->default(0);            // Total a pagar
            $table->decimal('paid_amount', 10, 2)->default(0);      // Lo que ha pagado
            $table->decimal('balance', 10, 2)->default(0);          // Saldo pendiente
            $table->decimal('cost_total', 10, 2)->default(0);       // Costo total (para margen)

            // Control
            $table->boolean('requires_lab_order')->default(false);
            $table->boolean('has_prescription')->default(false);     // Incluye venta de armazón+luna
            $table->string('invoice_number', 20)->nullable();        // Número de factura SRI
            $table->text('notes')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('paid_at')->nullable();               // Cuándo se completó el pago
            $table->timestamp('delivered_at')->nullable();           // Cuándo se entregó el producto

            $table->timestamps();
            $table->softDeletes();

            // Índices
            $table->index('patient_id');
            $table->index('status');
            $table->index('user_id');
            $table->index('branch_id');
            $table->index('created_at');
            $table->index(['status', 'branch_id']);
            $table->index(['patient_id', 'status']);
            $table->index('invoice_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};
