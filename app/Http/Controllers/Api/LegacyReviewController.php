<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Models\LegacyReviewBatch;
use App\Services\LegacyReview\LegacyReviewCase;
use App\Services\LegacyReview\LegacyReviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * "Revision de datos heredados": consultas importadas con datos en el campo
 * equivocado, para que la optica los vea y los reubique. Logica en
 * `LegacyReviewService`; cada tipo de problema es un `LegacyReviewCase`.
 */
class LegacyReviewController extends Controller
{
    use ApiResponses;

    public function __construct(private readonly LegacyReviewService $service) {}

    public function cases(Request $request): JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }

        return response()->json(['data' => $this->service->cases()]);
    }

    public function index(Request $request, string $case): JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }
        $reviewCase = $this->service->find($case);
        if ($reviewCase === null) {
            return $this->notFound('Caso de revisión no encontrado.');
        }

        $filters = $request->validate($this->filterRules());

        return response()->json([
            ...$this->service->list($reviewCase, $filters, (int) $request->integer('page', 1), (int) min(max($request->integer('per_page', 25), 10), 100)),
            'case' => $this->service->caseInfo($reviewCase),
        ]);
    }

    public function preview(Request $request, string $case): JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }
        $reviewCase = $this->service->find($case);
        if ($reviewCase === null) {
            return $this->notFound('Caso de revisión no encontrado.');
        }

        return response()->json(['data' => $this->service->preview($reviewCase, $this->selection($request))]);
    }

    public function apply(Request $request, string $case): JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }
        $reviewCase = $this->service->find($case);
        if ($reviewCase === null) {
            return $this->notFound('Caso de revisión no encontrado.');
        }

        $request->validate(['confirm' => ['accepted']]);

        try {
            $batch = $this->service->apply($reviewCase, $this->selection($request), $request->user());
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage());
        }

        return $this->created([
            'id' => $batch->id,
            'consultations' => $batch->consultations,
            'changes' => $batch->changes,
            'backup_operation_id' => $batch->backup_operation_id,
        ], "Se corrigieron {$batch->consultations} consultas.");
    }

    public function batches(Request $request): JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }

        return response()->json(['data' => $this->service->batches()]);
    }

    public function revert(Request $request, LegacyReviewBatch $batch): JsonResponse
    {
        if (! $this->allowed($request)) {
            return $this->forbidden();
        }

        try {
            $batch = $this->service->revert($batch, $request->user());
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage());
        }

        return $this->ok(['data' => [
            'id' => $batch->id,
            'revert_summary' => $batch->revert_summary,
        ]], 'Cambios deshechos.');
    }

    private function allowed(Request $request): bool
    {
        // El SPA deja pasar a admin por su rol (`can()` de AuthContext); el servidor debe
        // hacer lo mismo o, en una BD donde aun no corrio la migracion del permiso, el
        // admin ve el menu y recibe 403.
        $user = $request->user();

        return (bool) ($user?->hasRole('admin') || $user?->can(Permission::LEGACY_REVIEW->value));
    }

    private function filterRules(string $prefix = ''): array
    {
        return [
            "{$prefix}search" => ['nullable', 'string', 'max:100'],
            "{$prefix}from" => ['nullable', 'date_format:Y-m-d'],
            "{$prefix}to" => ['nullable', 'date_format:Y-m-d'],
            "{$prefix}status" => ['nullable', Rule::in(LegacyReviewService::STATUS_FILTERS)],
        ];
    }

    /** @return array{ids?: list<int>, all?: bool, except?: list<int>, include?: list<int>, filters?: array} */
    private function selection(Request $request): array
    {
        return $request->validate([
            'all' => ['sometimes', 'boolean'],
            'ids' => ['required_without:all', 'array', 'max:5000'],
            'ids.*' => ['integer'],
            'except' => ['sometimes', 'array'],
            'except.*' => ['integer'],
            'include' => ['sometimes', 'array', 'max:5000'],
            'include.*' => ['integer'],
            'filters' => ['sometimes', 'array'],
            ...$this->filterRules('filters.'),
        ]);
    }
}
