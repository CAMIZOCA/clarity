<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Los triggers del indice FTS5 de pacientes (solo SQLite) daban por hecho que un
 * paciente eliminado no volvia a tocarse. Al restaurarlo, `patients_fts_update`
 * mandaba un 'delete' de una fila que ya no estaba en el indice, y FTS5 con
 * contenido externo responde a eso corrompiendo la base ("database disk image
 * is malformed").
 *
 * Ahora cada trigger mira tambien el estado anterior: solo se borra del indice
 * lo que estaba indexado, y restaurar vuelve a insertar la fila.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            return;
        }

        $this->dropTriggers();

        DB::statement("CREATE TRIGGER patients_fts_update
            AFTER UPDATE ON patients
            WHEN old.deleted_at IS NULL AND new.deleted_at IS NULL BEGIN
                INSERT INTO patients_fts(patients_fts, rowid, nombre, cedula)
                VALUES ('delete', old.id, COALESCE(old.nombre,''), COALESCE(old.cedula,''));
                INSERT INTO patients_fts(rowid, nombre, cedula)
                VALUES (new.id, COALESCE(new.nombre,''), COALESCE(new.cedula,''));
            END");

        DB::statement("CREATE TRIGGER patients_fts_soft_delete
            AFTER UPDATE ON patients
            WHEN old.deleted_at IS NULL AND new.deleted_at IS NOT NULL BEGIN
                INSERT INTO patients_fts(patients_fts, rowid, nombre, cedula)
                VALUES ('delete', old.id, COALESCE(old.nombre,''), COALESCE(old.cedula,''));
            END");

        DB::statement("CREATE TRIGGER patients_fts_restore
            AFTER UPDATE ON patients
            WHEN old.deleted_at IS NOT NULL AND new.deleted_at IS NULL BEGIN
                INSERT INTO patients_fts(rowid, nombre, cedula)
                VALUES (new.id, COALESCE(new.nombre,''), COALESCE(new.cedula,''));
            END");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            return;
        }

        $this->dropTriggers();

        DB::statement("CREATE TRIGGER patients_fts_update
            AFTER UPDATE ON patients
            WHEN new.deleted_at IS NULL BEGIN
                INSERT INTO patients_fts(patients_fts, rowid, nombre, cedula)
                VALUES ('delete', old.id, COALESCE(old.nombre,''), COALESCE(old.cedula,''));
                INSERT INTO patients_fts(rowid, nombre, cedula)
                VALUES (new.id, COALESCE(new.nombre,''), COALESCE(new.cedula,''));
            END");

        DB::statement("CREATE TRIGGER patients_fts_soft_delete
            AFTER UPDATE OF deleted_at ON patients
            WHEN new.deleted_at IS NOT NULL BEGIN
                INSERT INTO patients_fts(patients_fts, rowid, nombre, cedula)
                VALUES ('delete', old.id, COALESCE(old.nombre,''), COALESCE(old.cedula,''));
            END");
    }

    private function dropTriggers(): void
    {
        foreach (['patients_fts_update', 'patients_fts_soft_delete', 'patients_fts_restore'] as $trigger) {
            DB::statement("DROP TRIGGER IF EXISTS {$trigger}");
        }
    }
};
