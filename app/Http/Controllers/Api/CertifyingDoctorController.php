<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Models\CertifyingDoctor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class CertifyingDoctorController extends Controller
{
    use ApiResponses;

    /**
     * Listar doctores certificadores.
     * GET /api/certifying-doctors
     */
    public function index(): JsonResponse
    {
        $doctors = CertifyingDoctor::orderByDesc('is_default')
            ->orderBy('nombre')
            ->get();

        return $this->ok($doctors);
    }

    /**
     * Crear doctor certificador.
     * POST /api/certifying-doctors
     */
    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->can(Permission::SETTINGS_EDIT->value)) {
            return $this->forbidden();
        }

        $data = $this->validateData($request);
        $doctor = DB::transaction(function () use ($data) {
            $doctor = CertifyingDoctor::create($data);
            $this->ensureSingleDefault($doctor);

            return $doctor;
        });

        return $this->created($doctor->fresh(), 'Doctor certificador creado.');
    }

    /**
     * Actualizar doctor certificador.
     * PUT /api/certifying-doctors/{certifyingDoctor}
     */
    public function update(Request $request, CertifyingDoctor $certifyingDoctor): JsonResponse
    {
        if (! $request->user()->can(Permission::SETTINGS_EDIT->value)) {
            return $this->forbidden();
        }

        $data = $this->validateData($request);
        DB::transaction(function () use ($certifyingDoctor, $data) {
            $certifyingDoctor->update($data);
            $this->ensureSingleDefault($certifyingDoctor);
        });

        return $this->ok($certifyingDoctor->fresh(), 'Doctor certificador actualizado.');
    }

    /**
     * Eliminar doctor certificador.
     * DELETE /api/certifying-doctors/{certifyingDoctor}
     */
    public function destroy(Request $request, CertifyingDoctor $certifyingDoctor): JsonResponse
    {
        if (! $request->user()->can(Permission::SETTINGS_EDIT->value)) {
            return $this->forbidden();
        }

        if ($certifyingDoctor->firma_path) {
            Storage::disk('public')->delete($certifyingDoctor->firma_path);
        }

        $certifyingDoctor->delete();

        return $this->noContent();
    }

    /**
     * Subir imagen de firma del doctor.
     * POST /api/certifying-doctors/{certifyingDoctor}/firma
     */
    public function uploadFirma(Request $request, CertifyingDoctor $certifyingDoctor): JsonResponse
    {
        if (! $request->user()->can(Permission::SETTINGS_EDIT->value)) {
            return $this->forbidden();
        }

        $request->validate(['firma' => 'required|image|max:2048']);

        if ($certifyingDoctor->firma_path) {
            Storage::disk('public')->delete($certifyingDoctor->firma_path);
        }

        $path = $request->file('firma')->store('firmas', 'public');
        $certifyingDoctor->update(['firma_path' => $path]);

        return $this->ok([
            'firma_path' => $path,
            'firma_url' => $certifyingDoctor->firma_url,
        ], 'Firma actualizada.');
    }

    private function validateData(Request $request): array
    {
        return $request->validate([
            'nombre' => ['required', 'string', 'max:150'],
            'titulo' => ['nullable', 'string', 'max:100'],
            'registro_senescyt' => ['nullable', 'string', 'max:100'],
            'codigo' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
        ]);
    }

    /**
     * Garantizar que solo un doctor quede marcado como predeterminado.
     */
    private function ensureSingleDefault(CertifyingDoctor $doctor): void
    {
        if ($doctor->is_default) {
            CertifyingDoctor::where('id', '!=', $doctor->id)
                ->where('is_default', true)
                ->update(['is_default' => false]);
        }
    }
}
