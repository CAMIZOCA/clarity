<?php

namespace App\Services;

use App\Models\User;

/**
 * Preferencias que cada usuario cambia sobre si mismo, sin permisos de
 * administracion de usuarios (hoy solo la plantilla de pantalla).
 */
class UserPreferenceService
{
    /**
     * @param  array{ui_template?: string|null}  $data
     */
    public function update(User $user, array $data): User
    {
        if (array_key_exists('ui_template', $data)) {
            $user->ui_template = $data['ui_template'];
        }

        if ($user->isDirty()) {
            $user->save();
        }

        return $user;
    }
}
