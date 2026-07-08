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

    public function test_admin_can_queue_backup_and_download_completed_backup(): void
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
            ->assertJsonPath('message', 'Solo se permiten archivos SQLite (.sqlite, .sqlite3, .db).');
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
        $path = tempnam(sys_get_temp_dir(), 'legacy-import-').'.sqlite';
        $pdo = new PDO('sqlite:'.$path);
        $pdo->exec('create table CLIENTES (Id text)');
        $pdo->exec('create table "HISTORIAL OPTAMOLOGIA" (Id text)');
        $pdo->exec('create table MEDICOS (Id text)');

        return new UploadedFile($path, 'optica_andina.sqlite', 'application/octet-stream', null, true);
    }
}
