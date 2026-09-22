<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Soporte de esfera "neutra" (N): la esfera sigue siendo decimal|null y este
 * flag boolean indica que el valor mostrado debe ser el literal "N", no un
 * cero. Son columnas boolean (1 byte), no afectan el limite de fila de
 * `consultations` (ver CLAUDE.md, gotcha de las ~145 columnas / 8126 bytes).
 */
return new class extends Migration
{
    private array $sections = ['rx_uso', 'subj', 'rx_final', 'vc'];

    public function up(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            foreach ($this->sections as $section) {
                foreach (['od', 'oi'] as $eye) {
                    $table->boolean("{$section}_esfera_{$eye}_neutral")->default(false);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            foreach ($this->sections as $section) {
                foreach (['od', 'oi'] as $eye) {
                    $table->dropColumn("{$section}_esfera_{$eye}_neutral");
                }
            }
        });
    }
};
