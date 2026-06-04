<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(User::with('roles')->orderBy('name')->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|string|min:8',
            'role' => 'required|in:admin,optometra,recepcionista',
            'codigo' => 'nullable|string|max:50',
            'registro_senescyt' => 'nullable|string|max:100',
        ]);

        $role = $data['role'];
        $data['password'] = Hash::make($data['password']);

        $user = User::create($data);
        $user->assignRole($role);

        return response()->json(array_merge($user->toArray(), [
            'firma_digital_url' => $user->firma_digital_url,
            'roles' => $user->getRoleNames(),
        ]), 201);
    }

    public function show(User $user): JsonResponse
    {
        $user->load('roles');
        return response()->json(array_merge($user->toArray(), [
            'firma_digital_url' => $user->firma_digital_url,
            'roles' => $user->getRoleNames(),
        ]));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:8',
            'role' => 'sometimes|in:admin,optometra,recepcionista',
            'codigo' => 'nullable|string|max:50',
            'registro_senescyt' => 'nullable|string|max:100',
        ]);

        if (isset($data['password']) && $data['password']) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        if (isset($data['role'])) {
            $user->syncRoles([$data['role']]);
        }

        $user->update($data);

        return response()->json(array_merge($user->fresh()->toArray(), [
            'firma_digital_url' => $user->firma_digital_url,
            'roles' => $user->getRoleNames(),
        ]));
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

        $path = $request->file('firma')->store("firmas", 'public');
        $user->update(['firma_digital' => $path]);

        return response()->json([
            'firma_digital' => $path,
            'firma_digital_url' => $user->firma_digital_url,
        ]);
    }
}
