<?php

namespace App\Services;

use App\Models\MaintenanceOperation;
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

        if (DB::connection()->getDriverName() !== 'sqlite') {
            throw new RuntimeException('La restauracion automatica solo esta disponible para SQLite.');
        }

        $database = $this->currentSqlitePath();
        $source = Storage::disk($operation->disk)->path($operation->path);
        $summary = $this->inspectSqlite($source);

        if (realpath($database) === realpath($source)) {
            throw new RuntimeException('El backup de origen no puede ser la misma base activa.');
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

        DB::disconnect();
        DB::purge();

        if (! copy($source, $database)) {
            throw new RuntimeException('No se pudo reemplazar la base SQLite actual.');
        }

        return [
            'restored' => true,
            'source' => $summary,
            'pre_restore_backup' => [
                'id' => $backup->id,
                'path' => $backup->path,
                'sha256' => $backup->sha256,
            ],
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

    private function tableNames(PDO $pdo): array
    {
        return $pdo
            ->query("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
            ->fetchAll(PDO::FETCH_COLUMN);
    }

    private function countRows(PDO $pdo, string $table): int
    {
        $quoted = '"'.str_replace('"', '""', $table).'"';

        return (int) $pdo->query("select count(*) from {$quoted}")->fetchColumn();
    }
}
