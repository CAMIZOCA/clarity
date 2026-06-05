<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->onDelete('set null');
            $table->unsignedBigInteger('cash_register_session_id')->nullable(); // FK sin constraint (tabla creada antes)
            $table->foreignId('user_id')->constrained('users')->onDelete('restrict');
            $table->foreignId('approved_by')->nullable()->constrained('users')->onDelete('set null');

            $table->enum('category', [
                'arriendo',
                'servicios',    // Luz, agua, internet
                'suministros',  // Materiales de oficina, limpieza
                'mensajeria',   // Envíos
                'mantenimiento',
                'publicidad',
                'nomina',       // Pago de personal
                'laboratorio',  // Pagos a laboratorios
                'otros',
            ]);
            $table->string('description', 250);
            $table->decimal('amount', 10, 2);
            $table->string('receipt_number', 50)->nullable(); // Número de factura/recibo del gasto
            $table->string('receipt_path')->nullable();       // Foto del comprobante
            $table->date('expense_date');
            $table->text('notes')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index('branch_id');
            $table->index('category');
            $table->index('expense_date');
            $table->index('cash_register_session_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};
