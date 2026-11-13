<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lotes de la pantalla "Revision de datos heredados".
 *
 * Cada vez que la optica aplica una correccion se crea un lote, y cada valor
 * cambiado queda en `consultation_legacy_repairs` con su `batch_id` y el valor
 * anterior: asi un lote se puede deshacer entero.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('legacy_review_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('case_key', 40);
            $table->unsignedInteger('consultations')->default(0);
            $table->unsignedInteger('changes')->default(0);
            $table->foreignId('backup_operation_id')->nullable()->constrained('maintenance_operations')->nullOnDelete();
            $table->timestamp('reverted_at')->nullable();
            $table->foreignId('reverted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('revert_summary')->nullable();
            $table->timestamps();

            $table->index('case_key');
        });

        Schema::table('consultation_legacy_repairs', function (Blueprint $table) {
            $table->foreignId('batch_id')->nullable()->after('rule')
                ->constrained('legacy_review_batches')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('consultation_legacy_repairs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('batch_id');
        });

        Schema::dropIfExists('legacy_review_batches');
    }
};
