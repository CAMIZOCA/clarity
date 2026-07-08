<?php

namespace Tests\Unit;

use App\Services\LegacyImportService;
use PDO;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class LegacyImportServiceTest extends TestCase
{
    public function test_it_returns_counts_for_required_legacy_tables(): void
    {
        $path = $this->sqlitePath();
        $pdo = new PDO('sqlite:'.$path);
        $pdo->exec('create table CLIENTES (Id text)');
        $pdo->exec('create table "HISTORIAL OPTAMOLOGIA" (Id text)');
        $pdo->exec('create table MEDICOS (Id text)');
        $pdo->exec("insert into CLIENTES values ('1'), ('2')");
        $pdo->exec("insert into \"HISTORIAL OPTAMOLOGIA\" values ('10')");

        $counts = (new LegacyImportService)->validateSqlite($path);

        $this->assertSame(2, $counts['CLIENTES']);
        $this->assertSame(1, $counts['HISTORIAL OPTAMOLOGIA']);
        $this->assertSame(0, $counts['MEDICOS']);
    }

    public function test_it_rejects_sqlite_without_required_tables(): void
    {
        $path = $this->sqlitePath();
        $pdo = new PDO('sqlite:'.$path);
        $pdo->exec('create table CLIENTES (Id text)');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('La tabla requerida no existe en el backup: HISTORIAL OPTAMOLOGIA');

        (new LegacyImportService)->validateSqlite($path);
    }

    private function sqlitePath(): string
    {
        return tempnam(sys_get_temp_dir(), 'legacy-service-').'.sqlite';
    }
}
