<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('discount_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->onDelete('cascade');
            $table->string('name', 100);
            $table->enum('type', ['percentage', 'fixed', 'bundle'])->default('percentage');
            $table->decimal('value', 10, 2); // % o $ según type
            $table->decimal('max_value', 10, 2)->nullable(); // Máximo de descuento en $
            $table->decimal('min_sale_amount', 10, 2)->default(0); // Monto mínimo de venta para aplicar
            $table->enum('applies_to', ['all', 'category', 'product'])->default('all');
            $table->string('applies_to_value', 100)->nullable(); // Categoría o SKU específico
            $table->decimal('requires_approval_above', 10, 2)->nullable(); // Requiere aprobación si desc > X%
            $table->boolean('is_active')->default(true);
            $table->date('valid_from')->nullable();
            $table->date('valid_until')->nullable();
            $table->foreignId('created_by')->constrained('users')->onDelete('restrict');
            $table->timestamps();
            $table->softDeletes();

            $table->index('is_active');
            $table->index(['valid_from', 'valid_until']);
            $table->index('branch_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discount_rules');
    }
};
