<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Services\ReceptionFeedService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReceptionFeedController extends Controller
{
    use ApiResponses;

    public function __construct(
        protected ReceptionFeedService $feed,
    ) {}

    /**
     * Consultas completadas de hoy y los dias anteriores, con su resumen.
     * GET /api/reception/consultations?days=3
     */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can(Permission::CONSULTATIONS_HANDOFF->value)) {
            return $this->forbidden();
        }

        $days = (int) $request->input('days', ReceptionFeedService::DEFAULT_DAYS);

        return $this->ok($this->feed->feed($days));
    }
}
