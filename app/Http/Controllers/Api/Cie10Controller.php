<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cie10Code;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class Cie10Controller extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $q = $request->input('q', '');

        $results = Cie10Code::where('code', 'like', "%$q%")
            ->orWhere('description', 'like', "%$q%")
            ->orderBy('code')
            ->limit(20)
            ->get();

        return response()->json($results);
    }
}
