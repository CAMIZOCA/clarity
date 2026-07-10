<?php

namespace Tests\Unit;

use App\Services\DatabaseBackupService;
use App\Services\SystemRestoreService;
use Illuminate\Support\Facades\DB;
use PDO;
use RuntimeException;
use Tests\TestCase;

class SystemRestoreServiceTest extends TestCase
{
    public function test_it_inspects_system_sqlite_backup(): void
    {
        $path = $this->systemSqlitePath();

        $summary = (new SystemRestoreService($this->createStub(DatabaseBackupService::class)))->inspectSqlite($path);

        $this->assertSame('system_backup', $summary['source_type']);
        $this->assertSame('sqlite', $summary['driver']);
        $this->assertSame(1, $summary['migrations']);
        $this->assertSame(2, $summary['patients']);
        $this->assertSame(1, $summary['consultations']);
    }

    public function test_it_rejects_non_system_sqlite_backup(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'non-system-').'.sqlite';
        $pdo = new PDO('sqlite:'.$path);
        $pdo->exec('create table CLIENTES (Id text)');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('No es un backup del sistema actual.');

        (new SystemRestoreService($this->createStub(DatabaseBackupService::class)))->inspectSqlite($path);
    }

    public function test_it_rejects_mismatched_migrations_for_cross_driver_restore(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('El backup no corresponde al mismo esquema de migraciones');

        (new SystemRestoreService($this->createStub(DatabaseBackupService::class)))->assertMatchingMigrations(
            ['0001_01_01_000000_create_users_table', '2026_03_27_200002_create_patients_table'],
            ['0001_01_01_000000_create_users_table']
        );
    }

    public function test_it_plans_copyable_and_skipped_sqlite_tables(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'restore-plan-').'.sqlite';
        $pdo = new PDO('sqlite:'.$path);
        $pdo->exec('create table patients (id integer primary key)');
        $pdo->exec('create table consultations (id integer primary key)');
        $pdo->exec('create table source_only (id integer primary key)');

        $plan = (new SystemRestoreService($this->createStub(DatabaseBackupService::class)))
            ->planSqliteRestoreTables($pdo, ['patients', 'consultations']);

        $this->assertSame(['patients', 'consultations'], $plan['copy_tables']);
        $this->assertSame(['source_only'], $plan['skipped_tables']);
    }

    public function test_it_copies_sqlite_rows_by_chunks_and_preserves_ids(): void
    {
        $connection = DB::connection();
        $connection->statement('drop table if exists restore_samples');
        $connection->statement('drop table if exists target_only');
        $connection->statement('create table restore_samples (id integer primary key, name varchar(255), qty integer)');
        $connection->statement('create table target_only (id integer primary key, name varchar(255))');
        $connection->table('restore_samples')->insert(['id' => 99, 'name' => 'old', 'qty' => 9]);
        $connection->table('target_only')->insert(['id' => 77, 'name' => 'stale']);

        $path = tempnam(sys_get_temp_dir(), 'restore-copy-').'.sqlite';
        $source = new PDO('sqlite:'.$path);
        $source->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $source->exec('create table restore_samples (id integer primary key, name text, qty integer)');
        $source->exec("insert into restore_samples (id, name, qty) values (1, 'first', 10), (2, 'second', 20), (3, 'third', 30)");

        $result = (new SystemRestoreService($this->createStub(DatabaseBackupService::class)))
            ->copySqliteTablesToConnection($source, $connection, ['restore_samples'], ['restore_samples', 'target_only'], 2);

        $this->assertSame(['restore_samples'], $result['copied_tables']);
        $this->assertSame(['restore_samples' => 3], $result['copied_rows']);
        $this->assertSame(
            [
                ['id' => 1, 'name' => 'first', 'qty' => 10],
                ['id' => 2, 'name' => 'second', 'qty' => 20],
                ['id' => 3, 'name' => 'third', 'qty' => 30],
            ],
            $connection->table('restore_samples')->orderBy('id')->get()->map(fn (object $row): array => (array) $row)->all()
        );
        $this->assertSame(0, $connection->table('target_only')->count());
    }

    private function systemSqlitePath(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'system-service-').'.sqlite';
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
