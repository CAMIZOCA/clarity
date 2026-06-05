<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        // MySQL FULLTEXT index para búsqueda optimizada
        if ($driver === 'mysql') {
            // Asegurar que las columnas existan y tengan el tipo correcto
            Schema::table('patients', function (Blueprint $table) {
                // El índice FULLTEXT en MySQL requiere columnas TEXT o VARCHAR
                // Ya existen: nombre (string), cedula (string), telefono (string), email (string)
            });

            // Crear índice FULLTEXT directamente con SQL
            try {
                DB::statement('ALTER TABLE patients ADD FULLTEXT INDEX patients_fulltext_search (nombre, cedula, telefono, email, codigo_interno)');
            } catch (\Exception $e) {
                // El índice ya existe, ignorar
            }
        }

        // Agregar columnas de CRM/ventas a patients si no existen
        Schema::table('patients', function (Blueprint $table) {
            if (!Schema::hasColumn('patients', 'customer_type')) {
                $table->enum('customer_type', ['particular', 'convenio', 'empresa'])->default('particular')->after('email');
            }
            if (!Schema::hasColumn('patients', 'company_name')) {
                $table->string('company_name')->nullable()->after('customer_type');
            }
            if (!Schema::hasColumn('patients', 'company_ruc')) {
                $table->string('company_ruc', 20)->nullable()->after('company_name');
            }
            if (!Schema::hasColumn('patients', 'last_purchase_at')) {
                $table->timestamp('last_purchase_at')->nullable()->after('company_ruc');
            }
            if (!Schema::hasColumn('patients', 'total_spent')) {
                $table->decimal('total_spent', 10, 2)->default(0)->after('last_purchase_at');
            }
            if (!Schema::hasColumn('patients', 'visit_count')) {
                $table->unsignedInteger('visit_count')->default(0)->after('total_spent');
            }
            if (!Schema::hasColumn('patients', 'preferred_contact')) {
                $table->enum('preferred_contact', ['whatsapp', 'email', 'phone'])->default('whatsapp')->after('visit_count');
            }
            if (!Schema::hasColumn('patients', 'internal_notes')) {
                $table->text('internal_notes')->nullable()->after('preferred_contact');
            }
            if (!Schema::hasColumn('patients', 'branch_id')) {
                $table->unsignedBigInteger('branch_id')->nullable()->after('internal_notes');
            }
        });

        // Preparar users para multi-sucursal y comisiones
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'branch_id')) {
                $table->unsignedBigInteger('branch_id')->nullable()->after('firma_digital');
            }
            if (!Schema::hasColumn('users', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('branch_id');
            }
            if (!Schema::hasColumn('users', 'commission_pct')) {
                $table->decimal('commission_pct', 5, 2)->default(0)->after('is_active');
            }
            if (!Schema::hasColumn('users', 'phone')) {
                $table->string('phone', 20)->nullable()->after('commission_pct');
            }
        });
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            try {
                DB::statement('ALTER TABLE patients DROP INDEX patients_fulltext_search');
            } catch (\Exception $e) {
            }
        }

        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumnIfExists('customer_type');
            $table->dropColumnIfExists('company_name');
            $table->dropColumnIfExists('company_ruc');
            $table->dropColumnIfExists('last_purchase_at');
            $table->dropColumnIfExists('total_spent');
            $table->dropColumnIfExists('visit_count');
            $table->dropColumnIfExists('preferred_contact');
            $table->dropColumnIfExists('internal_notes');
            $table->dropColumnIfExists('branch_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumnIfExists('branch_id');
            $table->dropColumnIfExists('is_active');
            $table->dropColumnIfExists('commission_pct');
            $table->dropColumnIfExists('phone');
        });
    }
};
