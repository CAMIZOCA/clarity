<?php

namespace App\Http\Controllers\Api\Concerns;

use Illuminate\Http\JsonResponse;

trait ApiResponses
{
    protected function ok(mixed $data, string $message = ''): JsonResponse
    {
        $response = is_array($data) ? $data : ['data' => $data];
        if ($message) {
            $response['message'] = $message;
        }
        return response()->json($response, 200);
    }

    protected function created(mixed $data, string $message = 'Recurso creado exitosamente.'): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => $message], 201);
    }

    protected function noContent(): JsonResponse
    {
        return response()->json(null, 204);
    }

    protected function notFound(string $message = 'Recurso no encontrado.'): JsonResponse
    {
        return response()->json(['message' => $message], 404);
    }

    protected function forbidden(string $message = 'No tiene permiso para realizar esta acción.'): JsonResponse
    {
        return response()->json(['message' => $message], 403);
    }

    protected function error(string $message, int $status = 422, mixed $errors = null): JsonResponse
    {
        $body = ['message' => $message];
        if ($errors !== null) {
            $body['errors'] = $errors;
        }
        return response()->json($body, $status);
    }

    protected function serverError(string $message = 'Error interno del servidor.'): JsonResponse
    {
        return response()->json(['message' => $message], 500);
    }
}
