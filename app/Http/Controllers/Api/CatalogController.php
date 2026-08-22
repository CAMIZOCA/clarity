<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClinicalCatalogGroup;
use App\Models\ClinicalCatalogItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class CatalogController extends Controller
{
    public function groups(): JsonResponse
    {
        $groups = ClinicalCatalogGroup::with(['items' => function ($q) {
            $q->orderBy('sort_order')->orderBy('label');
        }])->get();

        return response()->json($groups);
    }

    public function storeItem(Request $request): JsonResponse
    {
        $data = $request->validate([
            'group_id'    => 'required|exists:clinical_catalog_groups,id',
            'code'        => 'nullable|string|max:50',
            'label'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'is_active'   => 'boolean',
            'sort_order'  => 'integer',
            'meta'        => 'nullable|array',
        ]);

        $item = ClinicalCatalogItem::create($data);
        $this->forgetConsultationMeta();

        return response()->json($item, 201);
    }

    public function updateItem(Request $request, ClinicalCatalogItem $item): JsonResponse
    {
        $data = $request->validate([
            'code'        => 'nullable|string|max:50',
            'label'       => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'is_active'   => 'boolean',
            'sort_order'  => 'integer',
            'meta'        => 'nullable|array',
        ]);

        $item->update($data);
        $this->forgetConsultationMeta();

        return response()->json($item);
    }

    public function destroyItem(ClinicalCatalogItem $item): JsonResponse
    {
        $item->delete();
        $this->forgetConsultationMeta();

        return response()->json(['message' => 'Elemento eliminado.']);
    }

    /**
     * El formulario de consulta lee catalogos y plantillas de una respuesta
     * cacheada 10 minutos. Sin esta invalidacion, lo que se edita aqui no
     * aparecia alla hasta que la cache expiraba.
     */
    private function forgetConsultationMeta(): void
    {
        Cache::forget(ConsultationMetaController::CACHE_KEY);
    }

    public function updateTemplate(Request $request, $id): JsonResponse
    {
        $template = \App\Models\PrintTemplate::findOrFail($id);
        $data = $request->validate([
            'name'        => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'is_active'   => 'boolean',
            'sort_order'  => 'integer',
        ]);
        $template->update($data);
        $this->forgetConsultationMeta();

        return response()->json($template);
    }
}
