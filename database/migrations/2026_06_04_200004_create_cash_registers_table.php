<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('cash_registers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->onDelete('cascade');
            $table->string('name', 100); // "Caja Principal", "Caja 2"
            $table->string('code', 20)->nullable(); // C001
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['branch_id', 'is_active']);
        });

        Schema::create('cash_register_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cash_register_id')->constrained('cash_registers')->onDelete('restrict');
            $table->foreignId('opened_by')->constrained('users')->onDelete('restrict');
            $table->foreignId('closed_by')->nullable()->constrained('users')->onDelete('set null');

            $table->timestamp('opened_at')->useCurrent();
            $table->timestamp('closed_at')->nullable();

            // Montos de apertura
            $table->decimal('opening_amount', 10, 2)->default(0);

            // Resumen al cierre
            $table->decimal('total_sales', 10, 2)->default(0);
            $table->decimal('total_cash', 10, 2)->default(0);
            $table->decimal('total_card', 10, 2)->default(0);
            $table->decimal('total_transfer', 10, 2)->default(0);
            $table->decimal('total_credit', 10, 2)->default(0);
            $table->decimal('total_refunds', 10, 2)->default(0);
            $table->decimal('total_expenses', 10, 2)->default(0);

            // Cierre físico
            $table->decimal('expected_cash', 10, 2)->default(0);  // Lo que debería haber
            $table->decimal('actual_cash', 10, 2)->nullable();     // Lo que se contó
            $table->decimal('difference', 10, 2)->nullable();      // expected - actual

            $table->enum('status', ['open', 'closed'])->default('open');
            $table->text('closing_notes')->nullable();
            $table->json('denomination_count')->nullable(); // Conteo por denominación de billetes

            $table->timestamps();

            $table->index('cash_register_id');
            $table->index('opened_by');
            $table->index(['status', 'cash_register_id']);
            $table->index('opened_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_register_sessions');
        Schema::dropIfExists('cash_registers');
    }
};
