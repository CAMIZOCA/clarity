<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->onDelete('cascade');
            $table->string('sku', 80)->unique(); // SKU único por variante
            $table->string('barcode', 50)->nullable()->unique(); // Código de barras

            // ─── Atributos de ARMAZÓN ───────────────────────────────────
            $table->string('color', 60)->nullable();
            $table->string('size', 20)->nullable();       // "small", "medium", "large", "52-18-135"
            $table->string('material', 60)->nullable();    // acetato, metal, titanio, TR90
            $table->enum('gender', ['unisex', 'hombre', 'mujer', 'nino'])->nullable();
            $table->string('frame_shape', 40)->nullable(); // redondo, cuadrado, aviador, etc.
            $table->string('frame_color_code', 20)->nullable(); // Código de color del fabricante

            // ─── Atributos de LUNA ──────────────────────────────────────
            $table->enum('lens_type', ['monofocal', 'bifocal', 'progresivo', 'ocupacional', 'contacto'])->nullable();
            $table->string('lens_material', 60)->nullable();  // CR-39, policarbonato, trivex, 1.67, 1.74
            $table->decimal('lens_index', 4, 2)->nullable();   // 1.50, 1.56, 1.67, 1.74
            $table->string('lens_treatment', 150)->nullable(); // AR, UV, fotocromático, blue-cut
            $table->string('lens_design', 60)->nullable();     // Diseño de progresivo

            // ─── Atributos de LENTE DE CONTACTO ────────────────────────
            $table->decimal('base_curve', 5, 2)->nullable();  // 8.4, 8.6, 8.8
            $table->decimal('lens_diameter', 5, 2)->nullable(); // 13.8, 14.0, 14.2
            $table->string('lens_power', 20)->nullable();     // -3.00, Plano, +2.50 (con cilindro puede ser complejo)
            $table->string('lens_duration', 30)->nullable();   // diario, quincenal, mensual, anual
            $table->string('lens_water_content', 20)->nullable(); // 38%, 58%, 70%

            // ─── Precios ────────────────────────────────────────────────
            $table->decimal('cost_price', 10, 2)->default(0);     // Precio de costo
            $table->decimal('sale_price', 10, 2)->default(0);     // Precio de venta público
            $table->decimal('wholesale_price', 10, 2)->nullable(); // Precio mayorista
            $table->string('supplier_ref', 50)->nullable();       // Referencia del proveedor

            // ─── Estado ─────────────────────────────────────────────────
            $table->boolean('is_active')->default(true);
            $table->string('image_path')->nullable();
            $table->json('attributes')->nullable(); // Atributos adicionales flexibles
            $table->timestamps();
            $table->softDeletes();

            // Índices
            $table->index('product_id');
            $table->index('barcode');
            $table->index(['product_id', 'is_active']);
            $table->index('color');
            $table->index('lens_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variants');
    }
};
