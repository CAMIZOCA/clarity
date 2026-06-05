<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('inventory', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_variant_id')->constrained('product_variants')->onDelete('cascade');
            $table->foreignId('warehouse_id')->constrained('warehouses')->onDelete('cascade');
            $table->integer('quantity')->default(0);      // Stock actual
            $table->integer('reserved')->default(0);       // Stock reservado (órdenes en proceso)
            $table->integer('min_stock')->default(0);      // Stock mínimo para alerta
            $table->integer('max_stock')->nullable();       // Stock máximo
            $table->integer('reorder_point')->default(0);  // Punto de reorden
            $table->decimal('avg_cost', 10, 2)->default(0); // Costo promedio ponderado
            $table->timestamp('last_count_at')->nullable(); // Última toma física
            $table->timestamp('last_movement_at')->nullable(); // Último movimiento
            $table->timestamps();

            // Un producto solo puede tener un registro por bodega
            $table->unique(['product_variant_id', 'warehouse_id']);
            $table->index('product_variant_id');
            $table->index('warehouse_id');
            $table->index(['quantity', 'min_stock']); // Para alertas de stock bajo
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory');
    }
};
