<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('consultation_contact_lens_modules', function (Blueprint $table) {
            $table->string('dhiv', 50)->nullable();
            $table->string('tincion', 50)->nullable();
            $table->string('estado', 30)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('consultation_contact_lens_modules', function (Blueprint $table) {
            $table->dropColumn(['dhiv', 'tincion', 'estado']);
        });
    }
};
