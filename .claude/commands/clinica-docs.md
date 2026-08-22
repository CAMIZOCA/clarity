---
description: Mantener actualizada la documentación técnica interna del sistema clínico — CLAUDE.md, memoria del proyecto, docblocks de código. Ejecutar después de agregar nuevos módulos, cambiar arquitectura, o mensualmente como revisión preventiva.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Agente de Documentación — Sistema Clínico Optométrico

Eres el responsable de mantener actualizada toda la documentación técnica interna del sistema. Tu objetivo es que cualquier desarrollador (o sesión futura de Claude Code) pueda entender el sistema sin necesidad de explorar el código desde cero.

## Archivos de Documentación a Mantener

| Archivo | Propósito | Frecuencia de actualización |
|---------|-----------|----------------------------|
| `docs/estado-del-sistema.md` | **Inventario vivo**: módulos, endpoints, pendientes, historial | Tras cerrar cualquier módulo |
| `D:\laragon\www\sistemaclinico\CLAUDE.md` | Guía para Claude Code: comandos y **gotchas** | Tras cambios arquitecturales |
| `.claude/commands/*.md` | Agentes especializados (documentación ejecutable) | Al cambiar un patrón o API compartida |
| `C:\Users\camiz\.claude\projects\D--laragon-www-sistemaclinico\memory\project_sistemaclinico.md` | Memoria persistente del proyecto | Tras agregar módulos |
| `C:\Users\camiz\.claude\projects\D--laragon-www-sistemaclinico\memory\MEMORY.md` | Índice de memorias | Cuando se crea/actualiza project_sistemaclinico.md |

## Workflow de Auditoría

### Paso 1: Explorar cambios recientes
```bash
# Ver cambios desde último commit de docs
git log --oneline -20
git diff HEAD~5 --name-only
```

### Paso 2: Comparar código actual con documentación
- Leer `CLAUDE.md` actual
- Listar controladores en `app/Http/Controllers/Api/`
- Listar modelos en `app/Models/`
- Listar rutas: `php artisan route:list --path=api`
- Listar migraciones nuevas

### Paso 3: Identificar brechas
Buscar discrepancias entre:
- Módulos en el código vs módulos documentados
- Rutas en `routes/api.php` vs endpoints documentados
- Dependencias en `composer.json`/`package.json` vs las mencionadas en docs
- Patrones usados en código nuevo vs patrones documentados

### Paso 4: Actualizar documentación

## Qué Incluir en CLAUDE.md

El `CLAUDE.md` debe ser conciso y accionable. Incluir:
- Comandos de desarrollo (ya tiene los correctos — no duplicar)
- Stack y versiones principales
- Directorios clave
- Patrones NO obvios o contra-intuitivos
- Gotchas específicos del proyecto

**NO incluir en CLAUDE.md:**
- Documentación exhaustiva de cada módulo (va en memoria)
- Explicaciones genéricas de Laravel/React
- Código de ejemplo extenso

## Qué Actualizar en project_sistemaclinico.md

La memoria del proyecto debe reflejar el estado actual:
```markdown
## Módulos implementados
- [lista actualizada de todos los módulos con su estado]

## Endpoints API principales
- [lista con método + URL + descripción breve]

## Stack técnico
- [versiones actuales]

## Patrones clave
- [patrones no obvios usados en el sistema]
```

## Qué Documentar en Código (docblocks)

Solo agregar docblocks donde el comportamiento NO es obvio:

```php
/**
 * Sincroniza los módulos relacionados con la consulta.
 * 
 * Usa updateOrCreate para módulos 1:1 (lentes, oftalmoscopia, tratamiento)
 * y sync() para relaciones 1:N (diagnósticos, recomendaciones).
 * Debe ejecutarse DESPUÉS de guardar la consulta principal.
 */
private function syncModules(Consultation $consultation, array $data): void
```

**NO agregar docblocks en:**
- Métodos CRUD estándar (index, store, show, update, destroy)
- Getters/setters simples
- Métodos cuyo nombre describe completamente su función

## Checklist Post-Módulo Nuevo

Después de implementar un módulo completo, verificar y actualizar:

- [ ] `CLAUDE.md` — ¿Se cambió algún patrón? ¿Nuevo comando? ¿Nueva dependencia?
- [ ] `project_sistemaclinico.md` — Agregar módulo a lista, agregar endpoints
- [ ] `MEMORY.md` — Actualizar si project_sistemaclinico.md cambió significativamente
- [ ] Docblocks — Solo para métodos complejos del módulo nuevo

## Checklist Mensual

- [ ] Verificar que todos los módulos del código están en la memoria
- [ ] Verificar que los comandos en CLAUDE.md funcionan (`composer dev`, `composer test`, etc.)
- [ ] Verificar que las versiones de dependencias en docs son correctas
- [ ] Eliminar referencias a código que ya no existe

## Fuente de verdad del inventario

**El inventario de módulos vive en `docs/estado-del-sistema.md`, no en este archivo.**
Antes se duplicaba aquí y quedó desactualizado (llegó a afirmar que Catálogos no tenía UI
cuando `/catalogos` ya existía, y le faltaban ~10 módulos: POS, inventario, CRM, caja,
laboratorio, facturación, sucursales, bodegas, certificados, mantenimiento).

Al auditar:

1. Regenerar el inventario real:
   ```bash
   ls app/Http/Controllers/Api/*.php | xargs -n1 basename
   ls -d resources/js/pages/*/ | xargs -n1 basename
   php artisan route:list --path=api
   ```
2. Contrastar contra `docs/estado-del-sistema.md` y corregir ese archivo.
3. Actualizar la fecha de "Última auditoría" y la sección "Historial de cambios relevantes".
4. Revisar que los **gotchas** de `CLAUDE.md` sigan siendo ciertos.
5. Revisar que los otros agentes de `.claude/commands/` no describan APIs que ya cambiaron.

## Los agentes también se documentan

Los archivos de `.claude/commands/` son documentación ejecutable: si describen mal una API,
generan código roto. Errores reales encontrados en la auditoría de 2026-08-22:

- `clinica-frontend` documentaba `showToast` (la función real es `addToast`) e imports con
  alias `@/`, que **no existe** en este proyecto.
- `clinica-backend` afirmaba "validación inline, no API Resources", cuando sí hay Form Requests
  y `PatientResource`/`UserResource` envuelven en `data` — justo la causa de cinco bugs.
- `clinica-consulta` describía una API de `EyeFieldGroup` (`nameOD`/`nameOI`/`type="number"`)
  que nunca existió, y claves de catálogo inventadas (`material_lente` en vez de `lens_materials`).

Al tocar un componente o patrón compartido, **verificar si algún agente lo describe** y
actualizarlo en el mismo cambio:

```bash
grep -rn "NombreDelComponente\|nombreDeLaFuncion" .claude/commands/
```
