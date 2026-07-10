<?php

namespace Tests\Feature;

use App\Jobs\AnalyzeLegacyImportJob;
use App\Jobs\GenerateDatabaseBackupJob;
use App\Models\MaintenanceOperation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PDO;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SystemMaintenanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_queue_memory_sqlite_backup_and_download_completed_backup(): void
    {
        Queue::fake();
        Storage::fake('local');
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $this->postJson('/api/admin/maintenance/backups')
            ->assertCreated()
            ->assertJsonPath('message', 'Backup en cola.');

        Queue::assertPushed(GenerateDatabaseBackupJob::class);
        $this->assertDatabaseHas('maintenance_operations', [
            'type' => 'backup',
            'status' => 'pending',
            'user_id' => $admin->id,
        ]);

        Storage::disk('local')->put('backups/test.sql.gz', 'backup-content');
        $backup = MaintenanceOperation::create([
            'type' => 'backup',
            'status' => 'completed',
            'user_id' => $admin->id,
            'disk' => 'local',
            'path' => 'backups/test.sql.gz',
            'original_filename' => 'test.sql.gz',
            'file_size' => 14,
        ]);

        $this->get("/api/admin/maintenance/backups/{$backup->id}/download")
            ->assertOk();
    }

    public function test_non_admin_cannot_access_maintenance(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/admin/maintenance/backups')
            ->assertForbidden();
    }

    public function test_upload_rejects_non_sqlite_file(): void
    {
        Storage::fake('local');
        Sanctum::actingAs($this->adminUser());

        $this->postJson('/api/admin/maintenance/imports/upload', [
            'file' => UploadedFile::fake()->create('backup.txt', 2, 'text/plain'),
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'Solo se permiten archivos SQLite (.sqlite, .sqlite3, .db, .sqlite.gz, .sqlite3.gz, .db.gz).');
    }

    public function test_upload_accepts_valid_legacy_sqlite_and_queues_analysis(): void
    {
        Queue::fake();
        Storage::fake('local');
        Sanctum::actingAs($this->adminUser());

        $file = $this->legacySqliteUpload();

        $upload = $this->postJson('/api/admin/maintenance/imports/upload', [
            'file' => $file,
        ])->assertCreated()
            ->assertJsonPath('data.status', 'uploaded');

        $id = $upload->json('data.id');

        $this->postJson("/api/admin/maintenance/imports/{$id}/analyze")
            ->assertOk()
            ->assertJsonPath('message', 'Analisis en cola.');

        Queue::assertPushed(AnalyzeLegacyImportJob::class);
    }

    public function test_upload_accepts_valid_legacy_sqlite_gzip(): void
    {
        Storage::fake('local');
        Sanctum::actingAs($this->adminUser());

        $this->postJson('/api/admin/maintenance/imports/upload', [
            'file' => $this->legacySqliteGzipUpload(),
        ])->assertCreated()
            ->assertJsonPath('data.status', 'uploaded')
            ->assertJsonPath('data.original_filename', 'optica_andina.sqlite.gz')
            ->assertJsonPath('data.summary.source_compressed', true);

        $operation = MaintenanceOperation::where('type', 'legacy_import')->latest()->first();

        Storage::disk('local')->assertExists($operation->path);
        $this->assertStringEndsWith('.sqlite', $operation->path);
    }

    public function test_upload_detects_system_backup_sqlite_gzip(): void
    {
        Storage::fake('local');
        Sanctum::actingAs($this->adminUser());

        $this->postJson('/api/admin/maintenance/imports/upload', [
            'file' => $this->systemSqliteGzipUpload(),
        ])->assertCreated()
            ->assertJsonPath('data.type', 'system_restore')
            ->assertJsonPath('data.status', 'uploaded')
            ->assertJsonPath('data.summary.source_type', 'system_backup')
            ->assertJsonPath('data.summary.source_compressed', true);

        $operation = MaintenanceOperation::where('type', 'system_restore')->latest()->first();

        Storage::disk('local')->assertExists($operation->path);
        $this->assertStringEndsWith('.sqlite', $operation->path);
    }

    public function test_system_restore_requires_confirmation(): void
    {
        Storage::fake('local');
        Sanctum::actingAs($this->adminUser());
        Storage::disk('local')->put('imports/system.sqlite', 'placeholder');

        $operation = MaintenanceOperation::create([
            'type' => 'system_restore',
            'status' => 'uploaded',
            'disk' => 'local',
            'path' => 'imports/system.sqlite',
        ]);

        $this->postJson("/api/admin/maintenance/imports/{$operation->id}/restore")
            ->assertUnprocessable();
    }

    public function test_import_requires_successful_dry_run(): void
    {
        Storage::fake('local');
        Sanctum::actingAs($this->adminUser());
        Storage::disk('local')->put('imports/source.sqlite', 'placeholder');

        $operation = MaintenanceOperation::create([
            'type' => 'legacy_import',
            'status' => 'uploaded',
            'disk' => 'local',
            'path' => 'imports/source.sqlite',
        ]);

        $this->postJson("/api/admin/maintenance/imports/{$operation->id}/run", [
            'rewrite_legacy' => true,
            'confirm_backup' => true,
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'Debe ejecutar un dry-run exitoso antes de importar.');
    }

    private function adminUser(): User
    {
        $role = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function legacySqliteUpload(): UploadedFile
    {
        $path = $this->legacySqlitePath();

        return new UploadedFile($path, 'optica_andina.sqlite', 'application/octet-stream', null, true);
    }

    private function legacySqliteGzipUpload(): UploadedFile
    {
        $sqlitePath = $this->legacySqlitePath();
        $gzipPath = tempnam(sys_get_temp_dir(), 'legacy-import-').'.sqlite.gz';
        file_put_contents($gzipPath, gzencode((string) file_get_contents($sqlitePath), 9));
        @unlink($sqlitePath);

        return new UploadedFile($gzipPath, 'optica_andina.sqlite.gz', 'application/gzip', null, true);
    }

    private function systemSqliteGzipUpload(): UploadedFile
    {
        $sqlitePath = $this->systemSqlitePath();
        $gzipPath = tempnam(sys_get_temp_dir(), 'system-backup-').'.sqlite.gz';
        file_put_contents($gzipPath, gzencode((string) file_get_contents($sqlitePath), 9));
        @unlink($sqlitePath);

        return new UploadedFile($gzipPath, 'backup-system.sqlite.gz', 'application/gzip', null, true);
    }

    private function legacySqlitePath(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'legacy-import-').'.sqlite';
        $pdo = new PDO('sqlite:'.$path);
        $pdo->exec('create table CLIENTES (Id text)');
        $pdo->exec('create table "HISTORIAL OPTAMOLOGIA" (Id text)');
        $pdo->exec('create table MEDICOS (Id text)');

        return $path;
    }

    private function systemSqlitePath(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'system-backup-').'.sqlite';
        $pdo = new PDO('sqlite:'.$path);
        $pdo->exec('create table migrations (id integer primary key, migration text, batch integer)');
        $pdo->exec('create table users (id integer primary key)');
        $pdo->exec('create table patients (id integer primary key)');
        $pdo->exec('create table consultations (id integer primary key)');
        $pdo->exec("insert into migrations (migration, batch) values ('0001_01_01_000000_create_users_table', 1)");
        $pdo->exec('insert into users (id) values (1)');
        $pdo->exec('insert into patients (id) values (1), (2)');
        $pdo->exec('insert into consultations (id) values (1)');

        return $path;
    }
}
