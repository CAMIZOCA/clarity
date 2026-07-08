<?php

namespace App\Services;

use App\Models\MaintenanceOperation;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Symfony\Component\Process\Process;

class DatabaseBackupService
{
    public function generate(MaintenanceOperation $operation, string $reason = 'manual'): MaintenanceOperation
    {
        $operation->update([
            'status' => 'processing',
            'mode' => $reason,
            'started_at' => now(),
            'error_message' => null,
        ]);

        $driver = DB::connection()->getDriverName();
        $path = match ($driver) {
            'sqlite' => $this->backupSqlite($operation),
            'mysql', 'mariadb' => $this->backupMysql($operation),
            default => throw new RuntimeException("Driver de base de datos no soportado para backup: {$driver}"),
        };

        $absolutePath = Storage::disk('local')->path($path);

        $operation->update([
            'status' => 'completed',
            'disk' => 'local',
            'path' => $path,
            'original_filename' => basename($path),
            'file_size' => filesize($absolutePath) ?: null,
            'sha256' => hash_file('sha256', $absolutePath),
            'summary' => [
                'driver' => $driver,
                'reason' => $reason,
                'filename' => basename($path),
            ],
            'finished_at' => now(),
            'expires_at' => now()->addDays(7),
        ]);

        $this->audit($operation, 'Backup generado');

        return $operation;
    }

    private function backupSqlite(MaintenanceOperation $operation): string
    {
        $database = Config::get('database.connections.'.Config::get('database.default').'.database');
        if (is_string($database) && $database !== ':memory:' && ! is_file($database)) {
            $database = base_path($database);
        }

        if (! is_string($database) || $database === ':memory:' || ! is_file($database)) {
            throw new RuntimeException('No se puede generar backup SQLite: ruta de base invalida.');
        }

        $path = $this->backupPath($operation, 'sqlite.gz');
        Storage::disk('local')->put($path, gzencode(file_get_contents($database), 9));

        return $path;
    }

    private function backupMysql(MaintenanceOperation $operation): string
    {
        $connection = Config::get('database.connections.'.Config::get('database.default'));
        $path = $this->backupPath($operation, 'sql.gz');
        $absolutePath = Storage::disk('local')->path($path);
        $directory = dirname($absolutePath);

        if (! is_dir($directory)) {
            mkdir($directory, 0755, true);
        }

        $host = $connection['host'] ?? '127.0.0.1';
        $port = (string) ($connection['port'] ?? 3306);
        $database = $connection['database'] ?? '';
        $username = $connection['username'] ?? '';
        $password = $connection['password'] ?? '';

        $command = sprintf(
            'mysqldump --single-transaction --quick --skip-lock-tables -h%s -P%s -u%s --password=%s %s | gzip -9 > %s',
            escapeshellarg($host),
            escapeshellarg($port),
            escapeshellarg($username),
            escapeshellarg($password),
            escapeshellarg($database),
            escapeshellarg($absolutePath)
        );

        $process = Process::fromShellCommandline($command, base_path());
        $process->setTimeout(1800);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new RuntimeException(trim($process->getErrorOutput()) ?: 'mysqldump fallo al generar el backup.');
        }

        return $path;
    }

    private function backupPath(MaintenanceOperation $operation, string $extension): string
    {
        return sprintf(
            'backups/backup-%s-%s.%s',
            now()->format('Ymd-His'),
            $operation->id,
            $extension
        );
    }

    private function audit(MaintenanceOperation $operation, string $message): void
    {
        if (function_exists('activity')) {
            activity('maintenance')
                ->causedBy($operation->user)
                ->performedOn($operation)
                ->withProperties([
                    'type' => $operation->type,
                    'status' => $operation->status,
                    'path' => $operation->path,
                    'sha256' => $operation->sha256,
                ])
                ->log($message);
        }
    }
}
