<?php

namespace Tests\Unit;

use App\Services\DatabaseBackupService;
use App\Services\SystemRestoreService;
use PDO;
use PHPUnit\Framework\TestCase;
use RuntimeException;

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
