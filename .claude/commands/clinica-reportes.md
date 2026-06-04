---
description: Ampliar el módulo de reportes y analytics del sistema clínico — nuevos reportes, gráficos, métricas de dashboard, exportaciones. Usar cuando se necesite agregar estadísticas, nuevas visualizaciones o formatos de exportación.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Agente de Reportes y Analytics — Sistema Clínico Optométrico

Eres un experto en el módulo de reportes del sistema. Tu objetivo es ampliar las capacidades analíticas siguiendo los patrones ya establecidos.

## Archivos Clave

**Backend:**
- `app/Http/Controllers/Api/ReportController.php` — Todos los endpoints de reportes

**Frontend:**
- `resources/js/pages/reports/ReportsPage.jsx` — Página de reportes
- `resources/js/pages/dashboard/DashboardPage.jsx` — Dashboard con métricas principales

## Endpoints Existentes

```
GET /api/reports/dashboard
    → { total_patients, consultations_today, upcoming_appointments (7d),
        recent_consultations[], upcoming_appointments[] }

GET /api/reports/consultations?fecha_inicio=&fecha_fin=&optometrista_id=
    → { total, completadas, borradores, por_dia: [{fecha, total}] }

GET /api/reports/diagnoses?fecha_inicio=&fecha_fin=
    → [ {code, description, total}, ... ]  // diagnósticos más frecuentes

GET /api/reports/patients?fecha_inicio=&fecha_fin=
    → { nuevos, controles, por_dia: [{fecha, nuevos, controles}] }

GET /api/reports/export/csv?fecha_inicio=&fecha_fin=
    → CSV con consultas del período
```

## Patrones de Queries en ReportController

```php
// Reporte por período con filtro de fechas
public function nuevoReporte(Request $request): JsonResponse
{
    $query = Consultation::query()
        ->with(['patient', 'optometrista'])
        ->when($request->filled('fecha_inicio'), fn($q) => 
            $q->whereDate('fecha_consulta', '>=', $request->fecha_inicio)
        )
        ->when($request->filled('fecha_fin'), fn($q) => 
            $q->whereDate('fecha_consulta', '<=', $request->fecha_fin)
        )
        ->when($request->filled('optometrista_id'), fn($q) => 
            $q->where('optometrista_id', $request->optometrista_id)
        );
    
    // Agrupación
    $porDia = $query->clone()
        ->selectRaw('DATE(fecha_consulta) as fecha, COUNT(*) as total')
        ->groupBy('fecha')
        ->orderBy('fecha')
        ->get();
    
    return response()->json([
        'total' => $query->count(),
        'por_dia' => $porDia,
    ]);
}
```

## Queries Útiles para Diagnósticos Frecuentes

```php
// Diagnósticos más frecuentes (JOIN con tabla de diagnósticos)
DB::table('consultation_diagnoses')
    ->join('consultations', 'consultation_diagnoses.consultation_id', '=', 'consultations.id')
    ->whereNull('consultations.deleted_at')
    ->whereDate('consultations.fecha_consulta', '>=', $fechaInicio)
    ->select('consultation_diagnoses.code', 'consultation_diagnoses.description')
    ->selectRaw('COUNT(*) as total')
    ->groupBy('consultation_diagnoses.code', 'consultation_diagnoses.description')
    ->orderByDesc('total')
    ->limit(10)
    ->get();
```

## Agregar Nuevo Endpoint de Reporte

1. Agregar método en `ReportController.php`
2. Agregar ruta en `routes/api.php`:
   ```php
   Route::get('reports/nuevo-reporte', [ReportController::class, 'nuevoReporte']);
   ```
3. Agregar sección en `ReportsPage.jsx` para mostrar el reporte

## Estado de Gráficos

**IMPORTANTE:** Actualmente no hay librería de gráficos instalada. Si se necesita añadir visualizaciones:

**Opción recomendada:** Recharts (mejor integración con React)
```bash
npm install recharts
```

```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={porDia}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="fecha" />
    <YAxis />
    <Tooltip />
    <Line type="monotone" dataKey="total" stroke="#1a2a4a" strokeWidth={2} />
  </LineChart>
</ResponsiveContainer>
```

**Colores para gráficos** (usar colores del sistema):
- Principal: `#1a2a4a` (navy)
- Secundario: `#243660` (navy-light)
- Acento: `#eab308` (accent-yellow-dark)
- Éxito: `#16a34a`
- Error: `#dc2626`

## Dashboard — Métricas Existentes

En `DashboardPage.jsx`:
1. Total pacientes
2. Consultas hoy
3. Citas próximos 7 días
4. Últimas 5 consultas recientes
5. Próximas 3 citas

Para agregar nueva métrica al dashboard:
1. Actualizar `dashboard()` en `ReportController.php` para devolver el nuevo dato
2. Agregar tarjeta en `DashboardPage.jsx` siguiendo el patrón de tarjetas existentes

## Exportación CSV

La exportación CSV usa PapaParse en el frontend para parsear y descargar:
```javascript
// Patrón existente en ReportsPage.jsx
const handleExportCsv = async () => {
    const { data } = await client.get('/reports/export/csv', {
        params: { fecha_inicio, fecha_fin },
        responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `consultas_${fecha_inicio}_${fecha_fin}.csv`;
    link.click();
};
```

Para exportación Excel, se puede usar SheetJS:
```bash
npm install xlsx
```

## Consideraciones de Performance

- Los reportes que abarcan muchos registros deben usar `DB::table()` en lugar de Eloquent (más rápido)
- Para reportes pesados, considerar caché: `Cache::remember('reporte_key', 3600, fn() => ...)`
- El dashboard es consultado frecuentemente — caché de 5 minutos es aceptable
- SQLite tiene limitaciones con operaciones de fecha — usar `strftime()` si hay problemas con `DATE()`
