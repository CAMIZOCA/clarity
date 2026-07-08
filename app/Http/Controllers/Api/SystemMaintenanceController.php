<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Jobs\AnalyzeLegacyImportJob;
use App\Jobs\GenerateDatabaseBackupJob;
use App\Jobs\RunLegacyImportJob;
use App\Models\MaintenanceOperation;
use App\Services\LegacyImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

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

    public function createBackup(Request $request): JsonResponse
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

        GenerateDatabaseBackupJob::dispatch($operation->id, 'manual');

        return $this->created($this->operationPayload($operation), 'Backup en cola.');
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

    public function uploadImport(Request $request, LegacyImportService $imports): JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }

        $request->validate([
            'file' => ['required', 'file', 'max:204800'],
        ]);

        $file = $request->file('file');
        $extension = strtolower($file->getClientOriginalExtension());
        if (! in_array($extension, ['sqlite', 'sqlite3', 'db'], true)) {
            return $this->error('Solo se permiten archivos SQLite (.sqlite, .sqlite3, .db).');
        }

        $filename = 'legacy-import-'.now()->format('Ymd-His').'-'.Str::uuid().'.'.$extension;
        $path = $file->storeAs('imports', $filename, 'local');
        $absolutePath = Storage::disk('local')->path($path);

        try {
            $counts = $imports->validateSqlite($absolutePath);
        } catch (\Throwable $e) {
            Storage::disk('local')->delete($path);

            return $this->error($e->getMessage());
        }

        $operation = MaintenanceOperation::create([
            'type' => 'legacy_import',
            'status' => 'uploaded',
            'user_id' => $request->user()->id,
            'disk' => 'local',
            'path' => $path,
            'original_filename' => $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'sha256' => hash_file('sha256', $absolutePath),
            'summary' => ['source_counts' => $counts],
            'expires_at' => now()->addDays(7),
        ]);

        $this->audit($operation, 'Archivo legacy subido');

        return $this->created($this->operationPayload($operation), 'Archivo validado y cargado.');
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

    public function showImport(Request $request, MaintenanceOperation $operation): JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }

        if ($operation->type !== 'legacy_import') {
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
