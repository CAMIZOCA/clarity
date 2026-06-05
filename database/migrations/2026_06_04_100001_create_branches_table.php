<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('code', 20)->unique()->nullable(); // Código interno (EC-001)
            $table->string('address', 250)->nullable();
            $table->string('city', 100)->nullable();
            $table->string('province', 100)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('ruc', 13)->nullable(); // RUC de la sucursal (para facturación)
            $table->string('sri_establishment', 3)->nullable(); // Código establecimiento SRI
            $table->boolean('is_active')->default(true);
            $table->boolean('is_main')->default(false); // Sucursal principal
            $table->json('settings')->nullable(); // Configuraciones específicas por sucursal
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('is_active');
            $table->index('is_main');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branches');
    }
};
