<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->string('refund_number', 20)->unique(); // DEV-2026-00001
            $table->foreignId('sale_id')->constrained('sales')->onDelete('restrict');
            $table->foreignId('authorized_by')->constrained('users')->onDelete('restrict'); // Quien autorizó
            $table->foreignId('processed_by')->constrained('users')->onDelete('restrict'); // Quien procesó

            $table->enum('reason', [
                'defecto_producto',
                'talla_incorrecta',
                'no_conforme',   // Cliente no conforme
                'garantia',      // Dentro de garantía
                'error_orden',   // Error en la orden
                'otro',
            ]);
            $table->text('reason_detail')->nullable();
            $table->json('items')->nullable(); // Items devueltos con cantidades
            $table->decimal('refund_amount', 10, 2);
            $table->enum('refund_method', ['cash', 'card', 'transfer', 'credit'])->default('cash');
            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->index('sale_id');
            $table->index('authorized_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refunds');
    }
};
