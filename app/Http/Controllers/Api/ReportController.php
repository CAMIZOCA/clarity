<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Consultation;
use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function dashboard(): JsonResponse
    {
        $cacheKey = 'dashboard_stats_' . now()->format('Y-m-d-H-i');

        $data = Cache::remember($cacheKey, 60, function () {
            $today = now()->toDateString();

            $totalPacientes = Patient::count();

            $consultasHoy = Consultation::whereDate('fecha_consulta', $today)->count();

            $citasPendientes = Appointment::where('estado', 'pendiente')
                ->where('fecha_hora_inicio', '>=', now()->startOfDay())
                ->where('fecha_hora_inicio', '<=', now()->addDays(7)->endOfDay())
                ->count();

            $ultimasConsultas = Consultation::with(['patient:id,nombre', 'optometrista:id,name'])
                ->orderByDesc('fecha_consulta')
                ->limit(5)
                ->get(['id', 'numero_consulta', 'patient_id', 'optometrista_id', 'fecha_consulta', 'estado', 'diagnostico_cie10', 'diagnostico_descripcion']);

            $proximasCitas = Appointment::with(['patient:id,nombre'])
                ->where('estado', 'pendiente')
                ->where('fecha_hora_inicio', '>=', now()->startOfDay())
                ->orderBy('fecha_hora_inicio')
                ->limit(5)
                ->get(['id', 'patient_id', 'titulo', 'fecha_hora_inicio', 'estado']);

            return compact('totalPacientes', 'consultasHoy', 'citasPendientes', 'ultimasConsultas', 'proximasCitas');
        });

        return response()->json($data);
    }

    public function consultations(Request $request): JsonResponse
    {
        $from = $request->input('from', now()->startOfMonth()->toDateString());
        $to = $request->input('to', now()->toDateString());

        $query = Consultation::whereBetween('fecha_consulta', [$from, $to]);

        if ($id = $request->input('optometrista_id')) {
            $query->where('optometrista_id', $id);
        }

        $total = $query->count();
        $completadas = (clone $query)->where('estado', 'completada')->count();

        // Per day grouped
        $porDia = (clone $query)
            ->select(DB::raw('DATE(fecha_consulta) as dia'), DB::raw('count(*) as total'))
            ->groupBy('dia')
            ->orderBy('dia')
            ->get();

        return response()->json(compact('total', 'completadas', 'porDia'));
    }

    public function diagnoses(Request $request): JsonResponse
    {
        $from = $request->input('from', now()->startOfYear()->toDateString());
        $to = $request->input('to', now()->toDateString());

        $diagnoses = Consultation::whereBetween('fecha_consulta', [$from, $to])
            ->whereNotNull('diagnostico_cie10')
            ->select('diagnostico_cie10', 'diagnostico_descripcion', DB::raw('count(*) as total'))
            ->groupBy('diagnostico_cie10', 'diagnostico_descripcion')
            ->orderByDesc('total')
            ->limit(15)
            ->get();

        return response()->json($diagnoses);
    }

    public function patients(Request $request): JsonResponse
    {
        $from = $request->input('from', now()->startOfMonth()->toDateString());
        $to = $request->input('to', now()->toDateString());

        // Patients with their FIRST consultation in this period = new
        $nuevos = Patient::whereBetween('created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])->count();

        // Patients with consultations in range
        $conConsulta = Consultation::whereBetween('fecha_consulta', [$from, $to])
            ->distinct('patient_id')
            ->count('patient_id');

        $controles = max(0, $conConsulta - $nuevos);

        return response()->json(compact('nuevos', 'controles', 'conConsulta'));
    }

    public function exportCsv(Request $request): Response
    {
        $from = $request->input('from', now()->startOfMonth()->toDateString());
        $to = $request->input('to', now()->toDateString());

        $consultations = Consultation::with(['patient:id,nombre,cedula', 'optometrista:id,name'])
            ->whereBetween('fecha_consulta', [$from, $to])
            ->orderBy('fecha_consulta')
            ->get();

        $lines = [];
        $lines[] = implode(',', [
            'ID', 'N° Consulta', 'Fecha', 'Paciente', 'Cédula', 'Optómetra',
            'Diagnóstico CIE-10', 'Descripción', 'Estado',
        ]);

        foreach ($consultations as $c) {
            $lines[] = implode(',', [
                $c->id,
                $c->numero_consulta,
                $c->fecha_consulta->format('Y-m-d'),
                '"' . str_replace('"', '""', $c->patient?->nombre ?? '') . '"',
                $c->patient?->cedula ?? '',
                '"' . str_replace('"', '""', $c->optometrista?->name ?? '') . '"',
                $c->diagnostico_cie10 ?? '',
                '"' . str_replace('"', '""', $c->diagnostico_descripcion ?? '') . '"',
                $c->estado,
            ]);
        }

        $csv = implode("\n", $lines);

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="consultas_' . $from . '_' . $to . '.csv"',
        ]);
    }
}
