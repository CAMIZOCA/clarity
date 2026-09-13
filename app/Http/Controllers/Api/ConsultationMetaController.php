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
    /** Cache compartida con CatalogController, que la invalida al editar catalogos. */
    public const CACHE_KEY = 'consultation_meta';

    public function __invoke(): JsonResponse
    {
        $data = Cache::remember(self::CACHE_KEY, 600, function () {
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
                ->get(['id', 'key', 'name', 'description'])
                ->values();

            // `label` y `code` son las claves que consume FormSelect en el
            // formulario de consulta; sin ellas cada <option> salia vacia.
            $optometrists = User::query()
                ->whereIn('role', ['admin', 'optometra'])
                ->orderBy('name')
                ->get(['id', 'name', 'codigo', 'registro_senescyt'])
                ->map(fn ($user) => [
                    'id' => $user->id,
                    'label' => $user->name,
                    'code' => $user->codigo,
                    'name' => $user->name,
                    'codigo' => $user->codigo,
                    'registro_senescyt' => $user->registro_senescyt,
                ])
                ->values();

            // Todo lo cacheado debe ser array puro: config/cache.php restringe las
            // clases deserializables, asi que un Collection/Model guardado aqui
            // vuelve como __PHP_Incomplete_Class en el segundo request.
            return [
                'catalogs' => $catalogs->toArray(),
                'templates' => $templates->toArray(),
                'optometrists' => $optometrists->toArray(),
                'ophthalmoscopy_distances' => ['200 mt', '6 mt', '3 mt', '1 mt', '50 cm', '40 cm', '33 cm', '20 cm'],
                'ophthalmoscopy_rows' => ['Sin Rx', 'OI con Rx', 'OI Add +3.00'],
            ];
        });

        return response()->json($data);
    }
}
