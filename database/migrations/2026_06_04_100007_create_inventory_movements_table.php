<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_variant_id')->constrained('product_variants')->onDelete('restrict');
            $table->foreignId('warehouse_id')->constrained('warehouses')->onDelete('restrict');
            $table->foreignId('user_id')->constrained('users')->onDelete('restrict');

            // Tipo de movimiento
            $table->enum('type', [
                'purchase',       // Compra de proveedor
                'sale',           // Venta al cliente
                'return',         // Devolución de cliente
                'transfer_in',    // Transferencia entrada
                'transfer_out',   // Transferencia salida
                'adjustment_add', // Ajuste positivo
                'adjustment_sub', // Ajuste negativo
                'physical_count', // Toma física (ajuste por conteo)
                'initial',        // Stock inicial
            ]);

            // Cantidades
            $table->integer('quantity');          // Cantidad del movimiento (siempre positivo)
            $table->integer('quantity_before');   // Stock antes del movimiento
            $table->integer('quantity_after');    // Stock después del movimiento

            // Precio
            $table->decimal('unit_cost', 10, 2)->default(0); // Costo unitario en este movimiento
            $table->decimal('total_cost', 10, 2)->default(0); // Costo total = qty * unit_cost

            // Referencia (polymorphic) — qué documento generó este movimiento
            $table->string('reference_type')->nullable(); // App\Models\Sale, App\Models\Purchase, etc.
            $table->unsignedBigInteger('reference_id')->nullable();

            // Transferencias: destino
            $table->foreignId('destination_warehouse_id')->nullable()->constrained('warehouses')->onDelete('set null');

            $table->string('notes', 500)->nullable();
            $table->timestamp('created_at')->useCurrent();

            // Índices para reportes
            $table->index('product_variant_id');
            $table->index('warehouse_id');
            $table->index('type');
            $table->index('created_at');
            $table->index(['reference_type', 'reference_id']);
            $table->index('user_id');
        });

        // NOTA: Sin updated_at en movimientos — son inmutables por diseño
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_movements');
    }
};
