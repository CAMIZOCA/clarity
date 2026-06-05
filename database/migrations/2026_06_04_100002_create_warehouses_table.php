<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('warehouses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->onDelete('restrict');
            $table->string('name', 100);
            $table->string('code', 20)->nullable(); // BOD-001
            $table->enum('type', ['principal', 'consignacion', 'exhibicion', 'defectuosos'])->default('principal');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false); // Bodega por defecto para ventas
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('branch_id');
            $table->index(['branch_id', 'is_active']);
            $table->index('is_default');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('warehouses');
    }
};
