<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        // Default values
        DB::table('settings')->insert([
            ['key' => 'clinic_name', 'value' => 'Clínica Optométrica', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'clinic_tagline', 'value' => 'Cuidando tu visión', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'clinic_address', 'value' => '', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'clinic_phone', 'value' => '', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'clinic_logo', 'value' => '', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'required_fields', 'value' => '["optometrista_id","motivo_consulta"]', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
