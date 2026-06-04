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

Grupos de catálogo existentes (tabla `clinical_catalog_groups`):
- `material_lente` — Materiales de lunas
- `espesor_lente` — Espesores de lunas
- `proteccion_lente` — Protecciones (UV, filtros, etc.)
- (verificar en DB para lista completa)

## Componente EyeFieldGroup

```jsx
// Para crear campos duales OD/OI con etiquetas
<EyeFieldGroup
  label="Esfera"
  nameOD="esfera_od"
  nameOI="esfera_oi"
  type="number"
  step="0.25"
  register={register}
  errors={errors}
/>
```

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
2. Crear migración: `add_{campo}_to_consultations_table`
3. Agregar en `$fillable` de `Consultation.php`
4. Agregar validación en `validatePayload()` del controlador
5. Agregar en `extractConsultationAttributes()` del controlador
6. Agregar campo en `ConsultationForm.jsx` en la sección correcta
7. Actualizar `CertificadoPdf.jsx` si debe aparecer en PDF

## Notas Importantes

- El formulario tiene autoguardado via `useAutosave.js` — no romper este hook al agregar campos
- La consulta anterior del paciente se carga y muestra para referencia — los datos de la consulta actual no deben sobreescribir los de la anterior
- Los campos numéricos de refracción usan `step="0.25"` (incrementos de 0.25 D)
- Algunos campos tienen valor positivo/negativo (cilindros negativos en convención americana)
