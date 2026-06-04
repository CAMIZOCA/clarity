<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->text('motivo_consulta')->nullable()->after('estado');
            $table->date('ultimo_control')->nullable()->after('motivo_consulta');
            $table->string('doctor_license', 100)->nullable()->after('ultimo_control');
            $table->string('print_template_key', 100)->nullable()->after('doctor_license');
            $table->json('motor_binocular_data')->nullable()->after('test_hirschberg');
            $table->json('near_vision_data')->nullable()->after('vc_avcc_oi');
            $table->unsignedBigInteger('created_by')->nullable()->after('optometrista_id');
            $table->unsignedBigInteger('updated_by')->nullable()->after('created_by');
        });
    }

    public function down(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->dropColumn([
                'motivo_consulta',
                'ultimo_control',
                'doctor_license',
                'print_template_key',
                'motor_binocular_data',
                'near_vision_data',
                'created_by',
                'updated_by',
            ]);
        });
    }
};
