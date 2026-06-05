<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('sku', 50)->unique();
            $table->string('name', 200);
            $table->string('brand', 100)->nullable();
            $table->enum('category', [
                'armazon',
                'luna',
                'lente_contacto',
                'accesorio',
                'servicio',
                'repuesto',
            ]);
            $table->string('subcategory', 100)->nullable(); // ej: "sol", "formulado", "deportivo"
            $table->text('description')->nullable();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->onDelete('set null');
            $table->boolean('requires_prescription')->default(false); // ¿Requiere receta médica?
            $table->boolean('is_active')->default(true);
            $table->boolean('has_variants')->default(false); // ¿Tiene variantes (color, talla, etc.)?
            $table->boolean('track_inventory')->default(true); // false para servicios
            $table->string('image_path')->nullable();
            $table->json('meta')->nullable(); // Datos adicionales por categoría
            $table->timestamps();
            $table->softDeletes();

            $table->index('category');
            $table->index('brand');
            $table->index('supplier_id');
            $table->index(['category', 'is_active']);
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
