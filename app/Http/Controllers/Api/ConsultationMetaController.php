<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClinicalCatalogGroup;
use App\Models\PrintTemplate;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class ConsultationMetaController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $data = Cache::remember('consultation_meta', 600, function () {
            $catalogs = ClinicalCatalogGroup::query()
                ->with(['items' => fn ($query) => $query->where('is_active', true)->orderBy('sort_order')])
                ->orderBy('name')
                ->get()
                ->keyBy('key')
                ->map(function ($group) {
                    return $group->items->map(fn ($item) => [
                        'id' => $item->id,
                        'key' => $item->key,
                        'code' => $item->code,
                        'label' => $item->label,
                        'description' => $item->description,
                        'meta' => $item->meta,
                    ])->values();
                });

            $templates = PrintTemplate::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get(['id', 'key', 'name', 'description']);

            $optometrists = User::query()
                ->whereIn('role', ['admin', 'optometra'])
                ->orderBy('name')
                ->get(['id', 'name', 'codigo', 'registro_senescyt']);

            return [
                'catalogs' => $catalogs,
                'templates' => $templates,
                'optometrists' => $optometrists,
                'ophthalmoscopy_distances' => ['200 mt', '6 mt', '3 mt', '1 mt', '50 cm', '40 cm', '33 cm', '20 cm'],
                'ophthalmoscopy_rows' => ['Sin Rx', 'OI con Rx', 'OI Add +3.00'],
            ];
        });

        return response()->json($data);
    }
}
