<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('ruc', 13)->nullable()->unique();
            $table->string('contact_name', 100)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('address', 250)->nullable();
            $table->string('city', 100)->nullable();
            $table->enum('type', ['armazones', 'lunas', 'lentes_contacto', 'accesorios', 'laboratorio', 'mixto'])->default('mixto');
            $table->string('payment_terms', 100)->nullable(); // "30 días", "contado", etc.
            $table->unsignedTinyInteger('credit_days')->default(0); // Días de crédito
            $table->decimal('credit_limit', 10, 2)->default(0); // Límite de crédito
            $table->string('bank_name', 100)->nullable();
            $table->string('bank_account', 30)->nullable();
            $table->string('bank_account_type', 20)->nullable(); // corriente/ahorros
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('is_active');
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suppliers');
    }
};
