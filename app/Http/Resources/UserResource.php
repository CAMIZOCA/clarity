<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'roles' => $this->whenLoaded('roles', fn () => $this->roles->pluck('name')),
            'permissions' => $this->when(
                $request->routeIs('users.show') || $request->is('api/me') || $request->is('me'),
                fn () => $this->getAllPermissions()->pluck('name')
            ),
            'codigo' => $this->codigo,
            'registro_senescyt' => $this->registro_senescyt,
            'firma_digital_url' => $this->firma_digital
                                    ? asset('storage/'.$this->firma_digital)
                                    : null,
            'is_active' => $this->when(isset($this->is_active), $this->is_active ?? true),
            'phone' => $this->when(isset($this->phone), $this->phone),
            'branch_id' => $this->when(isset($this->branch_id), $this->branch_id),
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
