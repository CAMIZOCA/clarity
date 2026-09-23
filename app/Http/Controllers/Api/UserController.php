<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class UserController extends Controller
{
    use ApiResponses;

    public function index(): JsonResponse
    {
        $users = User::with('roles')->orderBy('name')->paginate(20);

        return response()->json(UserResource::collection($users)->response()->getData(true));
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $data = $request->validated();
        $role = $data['role'];

        $data['password'] = Hash::make($data['password']);
        unset($data['password_confirmation']);
        $data = $this->withoutNullDefaults($data);

        $user = User::create($data);  // $data['role'] is stored as a denormalized column
        $user->syncRoles([$role]);    // also assign via Spatie for permission checks
        $user->load('roles');

        return (new UserResource($user))
            ->response()
            ->setStatusCode(201);
    }

    public function show(User $user): JsonResponse
    {
        $user->load('roles');

        return (new UserResource($user))->response();
    }

    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $data = $request->validated();

        // `users.role` es la copia desnormalizada del rol de Spatie: se
        // actualiza junto con syncRoles o el listado sigue mostrando el viejo.
        if (isset($data['role'])) {
            $user->syncRoles([$data['role']]);
        }

        if (isset($data['password']) && $data['password']) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        unset($data['password_confirmation']);
        $data = $this->withoutNullDefaults($data);

        $user->update($data);
        $user->load('roles');

        return (new UserResource($user->fresh()))->response();
    }

    /**
     * `commission_pct` e `is_active` son NOT NULL con default: un null
     * explicito aborta el insert en modo strict en vez de caer al default.
     */
    private function withoutNullDefaults(array $data): array
    {
        foreach (['commission_pct', 'is_active'] as $column) {
            if (array_key_exists($column, $data) && $data[$column] === null) {
                unset($data[$column]);
            }
        }

        return $data;
    }

    public function destroy(User $user): JsonResponse
    {
        $user->delete();

        return response()->json(['message' => 'Usuario eliminado.']);
    }

    public function uploadFirma(Request $request, User $user): JsonResponse
    {
        $request->validate(['firma' => 'required|image|max:2048']);

        if ($user->firma_digital) {
            Storage::delete($user->firma_digital);
        }

        $path = $request->file('firma')->store('firmas', 'public');
        $user->update(['firma_digital' => $path]);

        return response()->json([
            'firma_digital' => $path,
            'firma_digital_url' => $user->firma_digital_url,
        ]);
    }
}
