<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->onDelete('cascade');

            // Producto (nullable para servicios sin variante)
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->onDelete('set null');

            // Descripción (para servicios o productos custom)
            $table->string('description', 250); // Snapshot del nombre en el momento de venta
            $table->string('sku', 80)->nullable(); // Snapshot del SKU

            // Cantidades y precios
            $table->decimal('quantity', 8, 2)->default(1);
            $table->decimal('unit_price', 10, 2);               // Precio unitario al momento de venta
            $table->decimal('cost_price', 10, 2)->default(0);   // Costo al momento de venta
            $table->decimal('discount_pct', 5, 2)->default(0);  // % descuento
            $table->decimal('discount_amount', 10, 2)->default(0); // $ descuento
            $table->decimal('subtotal', 10, 2);                  // (unit_price - discount) * qty
            $table->boolean('taxable')->default(true);           // ¿Aplica IVA?

            // Contexto clínico (para armazones y lunas)
            $table->enum('prescription_eye', ['OD', 'OI', 'ambos', 'N/A'])->default('N/A');
            $table->unsignedBigInteger('package_id')->nullable(); // ID para agrupar armazón+luna como paquete
            $table->string('item_type', 30)->default('product'); // product, service, package_frame, package_lens

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('sale_id');
            $table->index('product_variant_id');
            $table->index('package_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_items');
    }
};
