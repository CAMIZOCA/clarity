<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Jobs\AnalyzeLegacyImportJob;
use App\Jobs\GenerateDatabaseBackupJob;
use App\Jobs\RunLegacyImportJob;
use App\Models\MaintenanceOperation;
use App\Services\DatabaseBackupService;
use App\Services\LegacyImportService;
use App\Services\SystemRestoreService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class SystemMaintenanceController extends Controller
{
    use ApiResponses;

    public function backups(Request $request): JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }

        return response()->json([
            'data' => MaintenanceOperation::with('user:id,name,email')
                ->where('type', 'backup')
                ->latest()
                ->limit(50)
                ->get()
                ->map(fn (MaintenanceOperation $operation) => $this->operationPayload($operation)),
        ]);
    }

    public function createBackup(Request $request, DatabaseBackupService $backups): JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }

        $operation = MaintenanceOperation::create([
            'type' => 'backup',
            'status' => 'pending',
            'user_id' => $request->user()->id,
            'mode' => 'manual',
            'expires_at' => now()->addDays(7),
        ]);

        if ($this->shouldGenerateImmediately()) {
            try {
                $backups->generate($operation, 'manual');
            } catch (Throwable $e) {
                $operation->update([
                    'status' => 'failed',
                    'error_message' => $e->getMessage(),
                    'finished_at' => now(),
                ]);

                return $this->error($e->getMessage() ?: 'No se pudo generar el backup.', 500);
            }

            return $this->created($this->operationPayload($operation->fresh()), 'Backup generado.');
        }

        GenerateDatabaseBackupJob::dispatch($operation->id, 'manual');

        return $this->created($this->operationPayload($operation), 'Backup en cola.');
    }

    private function shouldGenerateImmediately(): bool
    {
        if (DB::connection()->getDriverName() !== 'sqlite') {
            return false;
        }

        $database = config('database.connections.'.config('database.default').'.database');

        return is_string($database) && $database !== ':memory:';
    }

    public function downloadBackup(Request $request, MaintenanceOperation $operation): BinaryFileResponse|JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }

        if ($operation->type !== 'backup' || $operation->status !== 'completed' || ! $operation->fileExists()) {
            return $this->notFound('Backup no disponible.');
        }

        return response()->download(
            Storage::disk($operation->disk)->path($operation->path),
            $operation->original_filename ?: basename((string) $operation->path)
        );
    }

    public function uploadImport(Request $request, LegacyImportService $imports, SystemRestoreService $restores): JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }

        $request->validate([
            'file' => ['required', 'file', 'max:204800'],
        ]);

        $file = $request->file('file');
        $originalFilename = $file->getClientOriginalName();
        $extension = $this->sqliteImportExtension($originalFilename);

        if ($extension === null) {
            return $this->error('Solo se permiten archivos SQLite (.sqlite, .sqlite3, .db, .sqlite.gz, .sqlite3.gz, .db.gz).');
        }

        $filename = 'legacy-import-'.now()->format('Ymd-His').'-'.Str::uuid().'.'.$extension;
        $path = 'imports/'.$filename;
        $absolutePath = Storage::disk('local')->path($path);

        try {
            if (str_ends_with(strtolower($originalFilename), '.gz')) {
                $this->storeDecompressedGzip($file->getPathname(), $absolutePath);
            } else {
                $file->storeAs('imports', $filename, 'local');
            }

            [$type, $summary] = $this->classifyImportFile($absolutePath, $imports, $restores);
        } catch (Throwable $e) {
            Storage::disk('local')->delete($path);

            return $this->error($e->getMessage());
        }

        $operation = MaintenanceOperation::create([
            'type' => $type,
            'status' => 'uploaded',
            'user_id' => $request->user()->id,
            'disk' => 'local',
            'path' => $path,
            'original_filename' => $originalFilename,
            'file_size' => filesize($absolutePath) ?: $file->getSize(),
            'sha256' => hash_file('sha256', $absolutePath),
            'summary' => array_merge($summary, [
                'source_compressed' => str_ends_with(strtolower($originalFilename), '.gz'),
            ]),
            'expires_at' => now()->addDays(7),
        ]);

        $this->audit($operation, $type === 'system_restore' ? 'Backup del sistema subido' : 'Archivo legacy subido');

        return $this->created($this->operationPayload($operation), 'Archivo validado y cargado.');
    }

    private function classifyImportFile(string $absolutePath, LegacyImportService $imports, SystemRestoreService $restores): array
    {
        try {
            $systemSummary = $restores->inspectSqlite($absolutePath);

            return ['system_restore', $systemSummary];
        } catch (Throwable $systemException) {
            try {
                $counts = $imports->validateSqlite($absolutePath);

                return ['legacy_import', [
                    'source_type' => 'legacy_optica_andina',
                    'source_counts' => $counts,
                ]];
            } catch (Throwable $legacyException) {
                throw new \RuntimeException($legacyException->getMessage().' '.$systemException->getMessage());
            }
        }
    }

    private function sqliteImportExtension(string $filename): ?string
    {
        $lower = strtolower($filename);

        foreach (['sqlite', 'sqlite3', 'db'] as $extension) {
            if (str_ends_with($lower, '.'.$extension)) {
                return $extension;
            }

            if (str_ends_with($lower, '.'.$extension.'.gz')) {
                return $extension;
            }
        }

        return null;
    }

    private function storeDecompressedGzip(string $sourcePath, string $destinationPath): void
    {
        if ($sourcePath === '' || ! is_file($sourcePath)) {
            throw new \RuntimeException('No se pudo leer el archivo temporal subido.');
        }

        $source = gzopen($sourcePath, 'rb');
        if ($source === false) {
            throw new \RuntimeException('No se pudo leer el archivo comprimido.');
        }

        $directory = dirname($destinationPath);
        if (! is_dir($directory)) {
            mkdir($directory, 0755, true);
        }

        $destination = fopen($destinationPath, 'wb');
        if ($destination === false) {
            gzclose($source);

            throw new \RuntimeException('No se pudo guardar el SQLite descomprimido.');
        }

        try {
            while (! gzeof($source)) {
                fwrite($destination, gzread($source, 1024 * 1024));
            }
        } finally {
            fclose($destination);
            gzclose($source);
        }
    }

    public function analyzeImport(Request $request, MaintenanceOperation $operation): JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }

        if ($operation->type !== 'legacy_import' || ! $operation->fileExists()) {
            return $this->notFound('Importacion no disponible.');
        }

        $operation->update(['status' => 'queued_analysis']);
        AnalyzeLegacyImportJob::dispatch($operation->id);

        return $this->ok(['data' => $this->operationPayload($operation->fresh())], 'Analisis en cola.');
    }

    public function runImport(Request $request, MaintenanceOperation $operation): JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'rewrite_legacy' => ['required', 'boolean'],
            'confirm_backup' => ['accepted'],
        ]);

        if ($operation->type !== 'legacy_import' || ! $operation->fileExists()) {
            return $this->notFound('Importacion no disponible.');
        }

        $errors = data_get($operation->summary, 'errors', []);
        if ($operation->status !== 'analyzed' || ! empty($errors) || (int) data_get($operation->summary, 'stats.errors', 0) > 0) {
            return $this->error('Debe ejecutar un dry-run exitoso antes de importar.');
        }

        $operation->update([
            'status' => 'queued_import',
            'options' => ['rewrite_legacy' => (bool) $data['rewrite_legacy']],
        ]);

        RunLegacyImportJob::dispatch($operation->id, (bool) $data['rewrite_legacy']);

        return $this->ok(['data' => $this->operationPayload($operation->fresh())], 'Importacion en cola.');
    }

    public function restoreSystemBackup(Request $request, MaintenanceOperation $operation, SystemRestoreService $restores): JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }

        $request->validate([
            'confirm_restore' => ['accepted'],
        ]);

        if ($operation->type !== 'system_restore' || ! $operation->fileExists()) {
            return $this->notFound('Restauracion no disponible.');
        }

        try {
            $summary = $restores->restore($operation);
        } catch (Throwable $e) {
            $operation->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'finished_at' => now(),
            ]);

            return $this->error($e->getMessage(), 500);
        }

        $payload = $this->operationPayload($operation->forceFill([
            'status' => 'completed',
            'summary' => array_merge($operation->summary ?? [], $summary),
            'finished_at' => now(),
        ]));

        return $this->ok(['data' => $payload], 'Backup restaurado. Es posible que deba iniciar sesion nuevamente.');
    }

    public function showImport(Request $request, MaintenanceOperation $operation): JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }

        if (! in_array($operation->type, ['legacy_import', 'system_restore'], true)) {
            return $this->notFound('Operacion no encontrada.');
        }

        return $this->ok(['data' => $this->operationPayload($operation->load('backupOperation'))]);
    }

    private function allowed(Request $request): bool
    {
        return $request->user()?->hasRole('admin')
            || $request->user()?->can(Permission::SYSTEM_MAINTENANCE->value);
    }

    private function operationPayload(MaintenanceOperation $operation): array
    {
        return [
            'id' => $operation->id,
            'type' => $operation->type,
            'status' => $operation->status,
            'mode' => $operation->mode,
            'original_filename' => $operation->original_filename,
            'file_size' => $operation->file_size,
            'sha256' => $operation->sha256,
            'summary' => $operation->summary,
            'log' => $operation->log,
            'error_message' => $operation->error_message,
            'backup_operation_id' => $operation->backup_operation_id,
            'backup_operation' => $operation->relationLoaded('backupOperation') && $operation->backupOperation
                ? $this->operationPayload($operation->backupOperation)
                : null,
            'created_by' => $operation->user ? [
                'id' => $operation->user->id,
                'name' => $operation->user->name,
                'email' => $operation->user->email,
            ] : null,
            'started_at' => $operation->started_at?->toIso8601String(),
            'finished_at' => $operation->finished_at?->toIso8601String(),
            'expires_at' => $operation->expires_at?->toIso8601String(),
            'created_at' => $operation->created_at?->toIso8601String(),
        ];
    }

    private function audit(MaintenanceOperation $operation, string $message): void
    {
        if (function_exists('activity')) {
            activity('maintenance')
                ->causedBy($operation->user)
                ->performedOn($operation)
                ->withProperties([
                    'type' => $operation->type,
                    'filename' => $operation->original_filename,
                    'sha256' => $operation->sha256,
                    'file_size' => $operation->file_size,
                ])
                ->log($message);
        }
    }
}
