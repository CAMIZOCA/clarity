<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Productos/servicios vendidos al paciente durante la consulta (armazon,
 * lunas, lentes de contacto...). Es informativo: no impacta caja ni
 * inventario. Tabla hija de `consultations`, sin la restriccion de tamano de
 * fila de esa tabla (ver CLAUDE.md).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consultation_sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consultation_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('orden')->default(0);
            $table->string('tipo', 50)->default('otro'); // armazon|lunas|lentes_contacto|otro
            $table->text('descripcion');
            $table->decimal('precio', 10, 2)->default(0);
            $table->decimal('descuento_pct', 5, 2)->default(0);
            $table->decimal('total', 10, 2)->default(0);
            $table->text('nota')->nullable();
            $table->timestamps();
            $table->index(['consultation_id', 'orden']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consultation_sale_items');
    }
};
