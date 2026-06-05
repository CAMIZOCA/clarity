<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->onDelete('cascade');
            $table->unsignedBigInteger('cash_register_session_id')->nullable(); // Se llenará cuando exista la tabla
            $table->foreignId('processed_by')->constrained('users')->onDelete('restrict');

            $table->enum('method', [
                'cash',      // Efectivo
                'card',      // Tarjeta débito/crédito
                'transfer',  // Transferencia bancaria
                'credit',    // Crédito interno (cliente debe a la óptica)
                'coupon',    // Cupón de descuento
            ]);

            $table->decimal('amount', 10, 2);
            $table->string('reference', 100)->nullable(); // # de transferencia, # de voucher tarjeta
            $table->string('bank_name', 100)->nullable(); // Banco para transferencias
            $table->string('card_last_four', 4)->nullable(); // Últimos 4 dígitos de tarjeta
            $table->enum('payment_type', ['deposit', 'balance', 'full'])->default('full'); // ¿Es abono, pago de saldo o pago completo?

            $table->text('notes')->nullable();
            $table->timestamp('processed_at')->useCurrent();
            $table->timestamp('created_at')->useCurrent();

            $table->index('sale_id');
            $table->index('cash_register_session_id');
            $table->index('method');
            $table->index('processed_at');
            $table->index('processed_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
