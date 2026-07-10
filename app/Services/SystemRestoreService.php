<?php

namespace App\Services;

use App\Models\MaintenanceOperation;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PDO;
use RuntimeException;

class SystemRestoreService
{
    private const REQUIRED_SQLITE_TABLES = ['migrations', 'users', 'patients', 'consultations'];

    public function __construct(private readonly DatabaseBackupService $backups) {}

    public function inspectSqlite(string $absolutePath): array
    {
        if (! is_file($absolutePath)) {
            throw new RuntimeException('Archivo SQLite no encontrado.');
        }

        $pdo = new PDO('sqlite:'.$absolutePath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $tables = $this->tableNames($pdo);
        $missing = array_values(array_diff(self::REQUIRED_SQLITE_TABLES, $tables));

        if ($missing !== []) {
            throw new RuntimeException('No es un backup del sistema actual. Faltan tablas: '.implode(', ', $missing).'.');
        }

        return [
            'source_type' => 'system_backup',
            'driver' => 'sqlite',
            'tables' => count($tables),
            'migrations' => $this->countRows($pdo, 'migrations'),
            'users' => $this->countRows($pdo, 'users'),
            'patients' => $this->countRows($pdo, 'patients'),
            'consultations' => $this->countRows($pdo, 'consultations'),
        ];
    }

    public function restore(MaintenanceOperation $operation, string $reason = 'manual-restore'): array
    {
        if ($operation->type !== 'system_restore' || ! $operation->fileExists()) {
            throw new RuntimeException('Restauracion no disponible.');
        }

        $target = DB::connection();
        $targetDriver = $target->getDriverName();
        if (! in_array($targetDriver, ['sqlite', 'mysql', 'mariadb'], true)) {
            throw new RuntimeException('La restauracion automatica solo esta disponible para SQLite, MySQL y MariaDB.');
        }

        $source = Storage::disk($operation->disk)->path($operation->path);
        $summary = $this->inspectSqlite($source);

        if ($targetDriver === 'sqlite') {
            $database = $this->currentSqlitePath();

            if (realpath($database) === realpath($source)) {
                throw new RuntimeException('El backup de origen no puede ser la misma base activa.');
            }
        } else {
            $sourcePdo = $this->openSqlite($source);
            $this->assertMatchingMigrations(
                $this->sourceMigrations($sourcePdo),
                $this->targetMigrations($target)
            );
        }

        $backup = MaintenanceOperation::create([
            'type' => 'backup',
            'status' => 'pending',
            'user_id' => $operation->user_id,
            'mode' => 'before-restore',
            'expires_at' => now()->addDays(7),
        ]);

        $this->backups->generate($backup, 'before-restore');

        $operation->update([
            'status' => 'restoring',
            'mode' => $reason,
            'started_at' => now(),
            'backup_operation_id' => $backup->id,
            'summary' => array_merge($operation->summary ?? [], [
                'restore_source' => $summary,
                'pre_restore_backup' => [
                    'id' => $backup->id,
                    'path' => $backup->path,
                    'sha256' => $backup->sha256,
                ],
            ]),
            'error_message' => null,
        ]);

        $restoreSummary = match ($targetDriver) {
            'sqlite' => $this->restoreSqliteFile($source, $database),
            'mysql', 'mariadb' => $this->restoreSqliteIntoConnection($source, $target),
        };

        $preRestoreBackup = [
            'id' => $backup->id,
            'path' => $backup->path,
            'sha256' => $backup->sha256,
        ];

        return [
            'restored' => true,
            'source' => $summary,
            'target' => ['driver' => $targetDriver],
            'copied_tables' => $restoreSummary['copied_tables'],
            'copied_rows' => $restoreSummary['copied_rows'],
            'skipped_tables' => $restoreSummary['skipped_tables'],
            'pre_restore_backup' => $preRestoreBackup,
        ];
    }

    public function planSqliteRestoreTables(PDO $source, array $targetTables): array
    {
        $sourceTables = $this->tableNames($source);
        $targetLookup = array_fill_keys($targetTables, true);
        $copyTables = [];
        $skippedTables = [];

        foreach ($sourceTables as $table) {
            if (isset($targetLookup[$table])) {
                $copyTables[] = $table;
            } else {
                $skippedTables[] = $table;
            }
        }

        return [
            'copy_tables' => $copyTables,
            'skipped_tables' => $skippedTables,
        ];
    }

    public function assertMatchingMigrations(array $sourceMigrations, array $targetMigrations): void
    {
        sort($sourceMigrations);
        sort($targetMigrations);

        if ($sourceMigrations !== $targetMigrations) {
            $missingInTarget = array_values(array_diff($sourceMigrations, $targetMigrations));
            $missingInSource = array_values(array_diff($targetMigrations, $sourceMigrations));

            throw new RuntimeException(
                'El backup no corresponde al mismo esquema de migraciones del ambiente destino.'
                .' Faltan en destino: '.($missingInTarget === [] ? 'ninguna' : implode(', ', $missingInTarget)).'.'
                .' Faltan en backup: '.($missingInSource === [] ? 'ninguna' : implode(', ', $missingInSource)).'.'
            );
        }
    }

    public function copySqliteTablesToConnection(PDO $source, Connection $target, array $copyTables, array $deleteTables, int $chunkSize = 500): array
    {
        $copiedTables = [];
        $copiedRows = [];

        $this->withoutForeignKeyChecks($target, function () use ($source, $target, $copyTables, $deleteTables, $chunkSize, &$copiedTables, &$copiedRows): void {
            $target->transaction(function () use ($source, $target, $copyTables, $deleteTables, $chunkSize, &$copiedTables, &$copiedRows): void {
                foreach ($deleteTables as $table) {
                    $target->table($table)->delete();
                }

                foreach ($copyTables as $table) {
                    $columns = $this->sourceColumns($source, $table);
                    $targetColumns = array_fill_keys($this->targetColumns($target, $table), true);
                    $columns = array_values(array_filter($columns, fn (string $column): bool => isset($targetColumns[$column])));

                    if ($columns === []) {
                        $copiedTables[] = $table;
                        $copiedRows[$table] = 0;

                        continue;
                    }

                    $total = 0;
                    $offset = 0;

                    do {
                        $rows = $this->sourceRows($source, $table, $columns, $chunkSize, $offset);
                        if ($rows === []) {
                            break;
                        }

                        $target->table($table)->insert($rows);
                        $count = count($rows);
                        $total += $count;
                        $offset += $count;
                    } while ($count === $chunkSize);

                    $copiedTables[] = $table;
                    $copiedRows[$table] = $total;
                }
            });
        });

        return [
            'copied_tables' => $copiedTables,
            'copied_rows' => $copiedRows,
        ];
    }

    private function currentSqlitePath(): string
    {
        $database = Config::get('database.connections.'.Config::get('database.default').'.database');
        if (is_string($database) && $database !== ':memory:' && ! is_file($database)) {
            $database = base_path($database);
        }

        if (! is_string($database) || $database === ':memory:' || ! is_file($database)) {
            throw new RuntimeException('Ruta de base SQLite actual invalida.');
        }

        if (! is_writable($database) || ! is_writable(dirname($database))) {
            throw new RuntimeException('La base SQLite actual no tiene permisos de escritura.');
        }

        return $database;
    }

    private function restoreSqliteFile(string $source, string $database): array
    {
        DB::disconnect();
        DB::purge();

        if (! copy($source, $database)) {
            throw new RuntimeException('No se pudo reemplazar la base SQLite actual.');
        }

        return [
            'copied_tables' => ['database_file'],
            'copied_rows' => [],
            'skipped_tables' => [],
        ];
    }

    private function restoreSqliteIntoConnection(string $source, Connection $target): array
    {
        $sourcePdo = $this->openSqlite($source);
        $targetTables = $this->targetTableNames($target);
        $plan = $this->planSqliteRestoreTables($sourcePdo, $targetTables);
        $copy = $this->copySqliteTablesToConnection(
            $sourcePdo,
            $target,
            $plan['copy_tables'],
            $targetTables
        );

        return [
            'copied_tables' => $copy['copied_tables'],
            'copied_rows' => $copy['copied_rows'],
            'skipped_tables' => $plan['skipped_tables'],
        ];
    }

    private function openSqlite(string $absolutePath): PDO
    {
        $pdo = new PDO('sqlite:'.$absolutePath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        return $pdo;
    }

    private function tableNames(PDO $pdo): array
    {
        return $pdo
            ->query("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
            ->fetchAll(PDO::FETCH_COLUMN);
    }

    private function targetTableNames(Connection $connection): array
    {
        $driver = $connection->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            return array_map(
                fn (object $row): string => (string) $row->name,
                $connection->select(
                    "select table_name as name from information_schema.tables where table_schema = database() and table_type = 'BASE TABLE'"
                )
            );
        }

        return array_map(
            fn (object $row): string => (string) ($row->name ?? $row->tbl_name),
            $connection->select("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
        );
    }

    private function sourceColumns(PDO $source, string $table): array
    {
        $statement = $source->query('pragma table_info('.$this->quoteSqliteIdentifier($table).')');

        return array_map(
            fn (array $row): string => (string) $row['name'],
            $statement->fetchAll(PDO::FETCH_ASSOC)
        );
    }

    private function targetColumns(Connection $target, string $table): array
    {
        $driver = $target->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            return array_map(
                fn (object $row): string => (string) $row->Field,
                $target->select('show columns from '.$this->quoteMysqlIdentifier($table))
            );
        }

        return array_map(
            fn (object $row): string => (string) $row->name,
            $target->select('pragma table_info('.$this->quoteSqliteIdentifier($table).')')
        );
    }

    private function sourceRows(PDO $source, string $table, array $columns, int $limit, int $offset): array
    {
        $selectedColumns = implode(', ', array_map($this->quoteSqliteIdentifier(...), $columns));
        $statement = $source->query(sprintf(
            'select %s from %s limit %d offset %d',
            $selectedColumns,
            $this->quoteSqliteIdentifier($table),
            $limit,
            $offset
        ));

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    private function sourceMigrations(PDO $source): array
    {
        return array_map(
            fn (string $migration): string => $migration,
            $source
                ->query('select migration from migrations order by migration')
                ->fetchAll(PDO::FETCH_COLUMN)
        );
    }

    private function targetMigrations(Connection $target): array
    {
        return array_map(
            fn (object $row): string => (string) $row->migration,
            $target->select('select migration from migrations order by migration')
        );
    }

    private function countRows(PDO $pdo, string $table): int
    {
        $quoted = '"'.str_replace('"', '""', $table).'"';

        return (int) $pdo->query("select count(*) from {$quoted}")->fetchColumn();
    }

    private function withoutForeignKeyChecks(Connection $connection, callable $callback): void
    {
        $driver = $connection->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            $connection->statement('set foreign_key_checks=0');
        } elseif ($driver === 'sqlite') {
            $connection->statement('pragma foreign_keys = off');
        }

        try {
            $callback();
        } finally {
            if (in_array($driver, ['mysql', 'mariadb'], true)) {
                $connection->statement('set foreign_key_checks=1');
            } elseif ($driver === 'sqlite') {
                $connection->statement('pragma foreign_keys = on');
            }
        }
    }

    private function quoteSqliteIdentifier(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }

    private function quoteMysqlIdentifier(string $identifier): string
    {
        return '`'.str_replace('`', '``', $identifier).'`';
    }
}
