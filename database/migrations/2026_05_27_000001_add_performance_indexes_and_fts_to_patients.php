<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        // Add index only if it doesn't already exist
        $indexExists = match ($driver) {
            'mysql'  => collect(DB::select("SHOW INDEX FROM patients WHERE Key_name = 'patients_nombre_index'"))->isNotEmpty(),
            'sqlite' => collect(DB::select("PRAGMA index_list(patients)"))->contains('name', 'patients_nombre_index'),
            default  => false,
        };

        if (! $indexExists) {
            Schema::table('patients', function (Blueprint $table) {
                $table->index('nombre', 'patients_nombre_index');
            });
        }

        // FTS5 virtual tables and triggers are SQLite-only; skip on MySQL
        if ($driver === 'sqlite') {
            DB::statement("CREATE VIRTUAL TABLE IF NOT EXISTS patients_fts
                USING fts5(nombre, cedula, content='patients', content_rowid='id')");

            DB::statement("INSERT INTO patients_fts(rowid, nombre, cedula)
                SELECT id, COALESCE(nombre,''), COALESCE(cedula,'')
                FROM patients WHERE deleted_at IS NULL");

            DB::statement("CREATE TRIGGER IF NOT EXISTS patients_fts_insert
                AFTER INSERT ON patients BEGIN
                    INSERT INTO patients_fts(rowid, nombre, cedula)
                    VALUES (new.id, COALESCE(new.nombre,''), COALESCE(new.cedula,''));
                END");

            DB::statement("CREATE TRIGGER IF NOT EXISTS patients_fts_update
                AFTER UPDATE ON patients
                WHEN new.deleted_at IS NULL BEGIN
                    INSERT INTO patients_fts(patients_fts, rowid, nombre, cedula)
                    VALUES ('delete', old.id, COALESCE(old.nombre,''), COALESCE(old.cedula,''));
                    INSERT INTO patients_fts(rowid, nombre, cedula)
                    VALUES (new.id, COALESCE(new.nombre,''), COALESCE(new.cedula,''));
                END");

            DB::statement("CREATE TRIGGER IF NOT EXISTS patients_fts_soft_delete
                AFTER UPDATE OF deleted_at ON patients
                WHEN new.deleted_at IS NOT NULL BEGIN
                    INSERT INTO patients_fts(patients_fts, rowid, nombre, cedula)
                    VALUES ('delete', old.id, COALESCE(old.nombre,''), COALESCE(old.cedula,''));
                END");
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            DB::statement("DROP TRIGGER IF EXISTS patients_fts_insert");
            DB::statement("DROP TRIGGER IF EXISTS patients_fts_update");
            DB::statement("DROP TRIGGER IF EXISTS patients_fts_soft_delete");
            DB::statement("DROP TABLE IF EXISTS patients_fts");
        }

        $indexExists = match ($driver) {
            'mysql'  => collect(DB::select("SHOW INDEX FROM patients WHERE Key_name = 'patients_nombre_index'"))->isNotEmpty(),
            'sqlite' => collect(DB::select("PRAGMA index_list(patients)"))->contains('name', 'patients_nombre_index'),
            default  => false,
        };

        if ($indexExists) {
            Schema::table('patients', function (Blueprint $table) {
                $table->dropIndex('patients_nombre_index');
            });
        }
    }
};
