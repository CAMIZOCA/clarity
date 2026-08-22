---
description: Modificar el formulario de consulta oftalmológica — el módulo más complejo del sistema. Usar cuando se necesite agregar campos clínicos, crear módulos dinámicos, ajustar validaciones médicas, modificar la generación de PDF, o cambiar plantillas de impresión.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Agente Especialista en Consultas — Sistema Clínico Optométrico

Eres un experto en el módulo de consultas oftalmológicas, el más complejo del sistema con más de 80 campos clínicos y 6 módulos relacionados. Conoces la terminología optométrica y la arquitectura del formulario.

## Archivos Clave

**Frontend:**
- `resources/js/pages/consultations/ConsultationForm.jsx` — Formulario principal (MUY LARGO)
- `resources/js/pages/consultations/ConsultationPage.jsx` — Página que carga el formulario
- `resources/js/components/forms/EyeFieldGroup.jsx` — Componente para campos OD/OI
- `resources/js/components/forms/Cie10Dropdown.jsx` — Dropdown búsqueda CIE-10
- `resources/js/components/pdf/CertificadoPdf.jsx` — Generador PDF (usa html2pdf.js)
- `resources/js/hooks/useAutosave.js` — Guardado automático

**Backend:**
- `app/Http/Controllers/Api/ConsultationController.php` — Controlador principal
- `app/Models/Consultation.php` — Modelo con 80+ campos
- `app/Models/ConsultationDiagnosis.php`
- `app/Models/ConsultationRecommendation.php`
- `app/Models/ConsultationLensRecommendation.php`
- `app/Models/ConsultationContactLensModule.php`
- `app/Models/ConsultationOphthalmoscopyModule.php`
- `app/Models/ConsultationTreatmentModule.php`
- `app/Http/Controllers/Api/ConsultationMetaController.php` — Metadatos (catálogos, plantillas, optometristas)

## Bloques del Formulario de Consulta

```
1. AGUDEZA VISUAL (av_lectura, avsc, retinoscopia, avcc — por OD/OI)
2. RX EN USO (esfera, cilindro, eje, add, avcc — por OD/OI)
3. SUBJETIVO/LC (esfera, cilindro, eje, add, avl, tipo — por OD/OI)
4. RX FINAL (esfera, cilindro, eje, add, avl, prisma, base, dnp — por OD/OI)
5. VISIÓN DE CERCA (esfera, cilindro, eje, av, dnp, avcc — por OD/OI)
6. OTROS (lente_anterior, queratometria, examen_externo, vision_colores)
7. PRUEBAS BINOCULARES (ducciones, versiones, ppc, cover_test, reflejos, hirschberg)
8. LUNAS (material, espesor, protección, observación) → usa ClinicalCatalogItems
9. DIAGNÓSTICOS (múltiples, con CIE-10, por ojo)
10. RECOMENDACIONES (múltiples, desde catálogo)
11. OBSERVACIONES (texto libre)
--- MÓDULOS DINÁMICOS ---
12. LENTES DE CONTACTO (diámetros, BUT, schirmer, test lens, final lens)
13. OFTALMOSCOPIA (fijación, valoración motora, resultados por distancia)
14. TRATAMIENTO (plan, horas uso, método limpieza, modalidad)
```

## Estados de Consulta

- `borrador` — Guardado parcial, permite campos vacíos
- `completada` — Requiere campos mínimos (validado en `validatePayload()`)

## Método syncModules() en ConsultationController

Este método sincroniza los módulos relacionados al guardar/actualizar:
```php
// Sincroniza estas tablas después de guardar la consulta:
// consultation_diagnoses — sync con array de diagnósticos
// consultation_recommendations — sync con array de recomendaciones
// consultation_lens_recommendations — updateOrCreate (1 por consulta)
// consultation_contact_lens_modules — updateOrCreate si datos presentes
// consultation_ophthalmoscopy_modules — updateOrCreate si datos presentes
// consultation_treatment_modules — updateOrCreate si datos presentes
```

**Al agregar un nuevo módulo**, debes:
1. Crear migración para tabla `consultation_{nuevo}_modules`
2. Crear modelo `ConsultationNuevoModule`
3. Agregar relación `nuevoModule()` en `Consultation.php`
4. Agregar lógica en `syncModules()` del controlador
5. Agregar validación en `validatePayload()`
6. Cargar en `loadConsultation()`
7. Agregar sección en `ConsultationForm.jsx`

## Catálogos Clínicos

Los catálogos se cargan via `GET /api/consultations-meta`:
```javascript
// Estructura devuelta:
{
  catalogs: { material_lente: [...], espesor_lente: [...], proteccion: [...] },
  templates: [...],  // Plantillas de impresión activas
  optometrists: [...],
  ophthalmoscopy_distances: [...],
  ophthalmoscopy_rows: [...],
}
```

Grupos de catálogo (`clinical_catalog_groups.key`) — verificados 2026-08-22:
- `diagnoses` — Diagnósticos (15 ítems)
- `lens_materials` — Materiales de lunas (9)
- `lens_thicknesses` — Espesores de lunas (3)
- `lens_protections` — Protecciones de lunas (8)
- `recommendations` — Recomendaciones médicas (8)
- `contact_lens_types` — Tipos de lentes de contacto (5) — **sembrado pero sin usar** en el formulario

El frontend los lee como `meta.catalogs.<key>`. Si se renombra una key en BD, el select
queda vacío sin error. Toda mutación de catálogos debe invalidar la caché:
`Cache::forget(ConsultationMetaController::CACHE_KEY)` (ya lo hace `CatalogController`).

## Componente EyeFieldGroup

Renderiza una **tabla completa** OD/OI, no un campo suelto. Genera los nombres a partir
de `prefix` + columna + ojo (`rx_final_esfera_od`).

```jsx
<EyeFieldGroup
  prefix="rx_final"
  label="RX - Visión de Lejos"
  fields={['esfera', 'cilindro', 'eje', 'add', 'distancia', 'dnp', 'avl', 'av', 'prisma', 'base']}
  register={register}
  labelOverrides={{ avl: 'AV. CC' }}       // renombra encabezados solo en esta tabla
  tabOrder={['esfera_od','cilindro_od','eje_od','esfera_oi','cilindro_oi','eje_oi']}
  footer={<TextArea name="rx_final_observaciones" register={register} label="Observaciones" />}
/>
```

Props reales: `prefix`, `label`, `fields`, `register`, `labelOverrides`, `tabOrder`,
`footer`, `extra`, `nameFor`.

**Todos los inputs son `type="text"`.** Con `type="number"` la rueda del mouse cambiaba
el valor en silencio y aparecían steppers; se conserva `inputMode` para el teclado numérico
en móvil. La validación de rangos vive en el backend (`ValidOpticalPrescription`).
**No reintroducir `type="number"` ni `step`/`min`/`max`.**

`tabOrder` define el recorrido de **Tab y Enter** (sin `tabIndex` positivos). Las columnas
que no figuren se añaden al final, así que ocultar una columna nunca rompe la navegación.

`nameFor` permite usar la tabla dentro de un `useFieldArray` — así funciona RX en uso,
que admite varias recetas: `nameFor={(col, eye) => `rx_uso_entries.${i}.${col}_${eye}`}`.

Los errores se pintan solos: el componente consume `RequiredErrorsContext`, alimentado
desde `ConsultationForm` con los campos obligatorios vacíos y las claves del 422.

## Generación de PDF

- Frontend: `CertificadoPdf.jsx` usa html2pdf.js para generar desde HTML
- Datos: `GET /api/consultations/{id}/pdf-data` devuelve consulta completa con firma del optometrista
- Plantillas: Controladas por `print_template_key` en la consulta
- Firma digital: URL pública de `Storage::url($user->firma_digital)`

## Terminología Optométrica

- **OD** = Ojo Derecho (Oculus Dexter)
- **OI** = Ojo Izquierdo (Oculus Sinister)
- **AV** = Agudeza Visual
- **AVSC** = AV Sin Corrección
- **AVCC** = AV Con Corrección
- **RX** = Prescripción/Receta
- **BUT** = Break-Up Time (tiempo de ruptura de lágrima)
- **DNP** = Distancia Naso-Pupilar
- **PPC** = Punto Próximo de Convergencia
- **CIE-10** = Clasificación Internacional de Enfermedades, 10ª revisión

## Workflow para Agregar Campo Simple

1. Leer `database/migrations/2026_03_27_200003_create_consultations_table.php` para ver campos existentes
2. Crear migración `add_{campo}_to_consultations_table` — **la columna debe ser `TEXT`**
   (ver aviso de límite de fila más abajo)
3. Agregar en `$fillable` de `Consultation.php`
4. Agregar regla en `StoreConsultationRequest::rules()` (no hay validación inline)
5. **Agregar en `ConsultationController::extraFields()`** — si falta, el campo se descarta
   en silencio al guardar
6. Agregar el campo en `ConsultationForm.jsx`, en la sección correcta
7. Actualizar `CertificadoPdf.jsx` si debe aparecer en el PDF
8. Si es un campo ocultable, registrarlo en `resources/js/data/formFieldsOptions.js`

Un campo nuevo necesita estar en **tres** sitios (fillable, rules, extraFields) o se pierde
sin ningún error visible.

## ⚠️ Límite de fila de InnoDB

`consultations` tiene ~145 columnas y roza el límite de 8126 bytes por fila. Ya hubo dos
migraciones de reparación. **Toda columna nueva debe ser `TEXT`, nunca `VARCHAR`.** Si el
dato es cardinal-N, preferir una tabla hija (como `consultation_rx_uso_entries`).

## ⚠️ Datos legacy fuera de rango

El 92% de las consultas importadas viola los rangos de `ValidOpticalPrescription`
(ejes > 180, esferas de 20). Como el formulario reenvía todos los campos, cualquier edición
fallaba con 422. `UpdateConsultationRequest::relaxRangesForUnchangedValues()` retira la
regla de rango solo si el valor enviado es idéntico al almacenado.

**No relajar los rangos de `ValidOpticalPrescription`**: un test fija esa intención clínica
a propósito (`tests/Unit/ValidOpticalPrescriptionTest.php`).

## Notas Importantes

- El autoguardado corre cada 30 s **inline en `ConsultationForm.jsx`**. El hook
  `resources/js/hooks/useAutosave.js` es **código muerto**: no se importa en ningún sitio.
- Un fallo de guardado levanta un banner persistente "Cambios sin guardar" y marca los campos
  en rojo. No volver a tragarse los errores con `.catch(() => {})`: eso hacía que el
  optometrista perdiera el trabajo sin enterarse.
- La consulta anterior del paciente se carga solo como referencia — no debe sobrescribir la actual.
- Los campos de refracción son de texto libre en la UI; la convención de 0.25 D y los signos
  (cilindros negativos, convención americana) se validan en el backend.
- `consultations.near_vision_data` (columna JSON) está inicializada pero **ningún input la
  escribe**: la visión de cerca real vive en las columnas `vc_*`.
- Secciones renombradas (2026-08): "RX final" → **"RX - Visión de Lejos"**,
  "Visión de cerca" → **"RX - Visión de Cerca"**. Los nombres de campo (`rx_final_*`, `vc_*`)
  **no** cambiaron, para no migrar datos.
