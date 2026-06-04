<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClinicalCatalogGroup;
use App\Models\ClinicalCatalogItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        return response()->json($item);
    }

    public function destroyItem(ClinicalCatalogItem $item): JsonResponse
    {
        $item->delete();
        return response()->json(['message' => 'Elemento eliminado.']);
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
        return response()->json($template);
    }
}
