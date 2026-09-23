# Estado del sistema

Inventario vivo del sistema clinico (Optica Andina / clarity.medio-digital.net).
Sirve para retomar el trabajo sin volver a explorar el codigo desde cero.

**Ultima auditoria: 2026-08-22.** Al cerrar un modulo o cambiar arquitectura, actualizar
este archivo (`/clinica-docs` automatiza la revision).

Los gotchas del sistema estan en [CLAUDE.md](../CLAUDE.md). Aqui va el *que existe*, no el *como*.

---

## Resumen

| Metrica | Valor |
|---|---|
| Rutas API | 160 |
| Controladores API | 29 |
| Modelos Eloquent | 47 |
| Servicios | 14 |
| Paginas frontend (carpetas) | 23 |
| Tests | 58 pasando |
| Datos reales en BD local | 3.579 pacientes / 4.592 consultas |

## Modulos

Estado: ✅ completo · 🟡 parcial · ⚠️ sin UI

### Clinico

| Modulo | Frontend | Backend | Estado |
|---|---|---|---|
| Dashboard | `/dashboard` | `ReportController@dashboard` | ✅ |
| Dashboard gerencial | `/dashboard-gerencial` | `ReportController` | ✅ |
| Pacientes | `/pacientes` | `PatientController` | ✅ |
| Consultas | `/consulta` | `ConsultationController` | ✅ |
| Agenda / Citas | `/agenda` (FullCalendar) | `AppointmentController` | ✅ |
| Ordenes de trabajo | `/ordenes-trabajo` | `LabOrderController` | ✅ |
| Lentes especiales | `/lentes-especiales` | `SpecialContactLensController` | ✅ |
| Referencias oftalmologicas | `/referencias` | `OphthalmologyReferenceController` | ✅ |
| Brigadas | `/brigadas` | `BrigadeController` | ✅ |
| Informes de garantia | `/informes-garantia` | `GuaranteeReportController` | ✅ |
| Certificados | (en ficha de paciente) | `CertificateController` | ✅ |
| Catalogos clinicos | `/catalogos` | `CatalogController` | ✅ |
| Plantillas de impresion | ⚠️ sin UI de gestion | `PrintTemplate` + `updateTemplate` | 🟡 |
| CIE-10 | ⚠️ componente huerfano | `Cie10Controller` | 🟡 |

### Comercial y operacion

| Modulo | Frontend | Backend | Estado |
|---|---|---|---|
| Punto de venta (POS) | `/pos` | `SaleController` | ✅ |
| Historial de ventas | `/ventas` | `SaleController` | ✅ |
| Caja | `/caja` | `CashRegisterController` | ✅ |
| Facturacion | (dentro de ventas) | `InvoiceController` | ✅ |
| Laboratorio | `/laboratorio` | `LabOrderController` | ✅ |
| Inventario — productos | `/inventario/productos` | `ProductController` | ✅ |
| Inventario — stock | `/inventario/stock` | `InventoryController` | ✅ |
| Inventario — movimientos | `/inventario/movimientos` | `InventoryController` | ✅ |
| Proveedores | (en inventario) | `SupplierController` | ✅ |
| CRM — campañas | `/crm/campanas` | `CrmController` | ✅ |
| CRM — plantillas | `/crm/plantillas` | `CrmController` | ✅ |
| CRM — recordatorios | `/crm/recordatorios` | `CrmController` | ✅ |
| Reportes clinicos | `/reportes` | `ReportController` | ✅ |
| Reportes comerciales | `/reportes-comerciales` | `ReportController` | ✅ |

### Administracion

| Modulo | Frontend | Backend | Estado |
|---|---|---|---|
| Usuarios | `/usuarios` | `UserController` | ✅ |
| Configuracion | `/configuracion` | `SettingController` | ✅ |
| Sucursales | `/admin/sucursales` | `BranchController` | ✅ |
| Bodegas | `/admin/bodegas` | `WarehouseController` | ✅ |
| Backups / mantenimiento | `/admin/mantenimiento` | `SystemMaintenanceController` | ✅ |
| Auditoria | ⚠️ sin UI | `AuditController` (spatie/activitylog) | 🟡 |
| Asistente IA (Claude) | boton flotante global | `AiController` + `AiService` | ✅ |
| IA por voz (OpenAI) | solo config en Ajustes | `OpenAiService` | 🟡 |

---

## Modulo de consulta

El mas complejo: ~145 columnas en `consultations` mas 7 tablas relacionadas.

| Tabla | Cardinalidad | Contenido |
|---|---|---|
| `consultation_rx_uso_entries` | 1:N | Recetas en uso, cada una con observacion |
| `consultation_diagnoses` | 1:N | Diagnosticos por ojo |
| `consultation_recommendations` | 1:N | Recomendaciones medicas |
| `consultation_lens_recommendations` | 1:1 | Material / espesor / proteccion |
| `consultation_contact_lens_modules` | 1:1 | Adaptacion de lentes de contacto |
| `consultation_ophthalmoscopy_modules` | 1:1 | Oftalmoscopia por distancias |
| `consultation_treatment_modules` | 1:1 | Plan de tratamiento |

Secciones de refraccion (todas usan `EyeFieldGroup`):

| Seccion | Prefijo | Columnas |
|---|---|---|
| Examen visual | `<campo>_od/oi` | Lectura computador, Queratometria (`ark_*`), AV.SC lejos, Retinoscopia, AV Retinoscopia VL (`avcc_*`) |
| RX en uso | `rx_uso_entries.N.` | Esfera, Cilindro, Eje, AV.CC, ADD + observacion |
| Subjetivo | `subj_` | Esfera, Cilindro, Eje, AVL |
| RX FINAL | `rx_final_` | Esfera, Cilindro, Eje, Prisma, Base, AV, ADD, DP, Distancia + observaciones |
| RX - Vision de Cerca | `vc_` | Esfera, Cilindro, Eje, AV.CC, DNP/DP |

Orden de Tab/Enter (`EyeFieldGroup::buildOrderedNames`): esfera, cilindro y eje de OD, luego
los de OI; despues cada columna restante en bloque OD -> OI, con prisma y base como par
(prisma OD, base OD, prisma OI, base OI).

Diagnostico (`components/forms/DiagnosisPicker.jsx`): dos listas de seleccion multiple
lado a lado (OD / OI) con todo el catalogo `diagnoses`. Marcar un item agrega la fila
`{eye, catalog_item_id, code, description}` al mismo array `diagnoses`; `notes` se muestra
como "Recomendaciones". El catalogo se ordena por probabilidad segun RX Final (o Subjetivo)
con `utils/diagnosisSuggestions.js` (umbrales OMS/IMI/AOA/AAO); nada se pre-marca. Las filas
de texto libre, ojo "general" o items desactivados se editan aparte en "Otros diagnosticos".

`rx_uso_entries` admite varias recetas; la primera se desnormaliza a las columnas planas
`rx_uso_*` para no romper PDF, reportes ni la importacion legacy.

Grupos de catalogo (`clinical_catalog_groups.key`): `diagnoses`, `lens_materials`,
`lens_thicknesses`, `lens_protections`, `recommendations`, `contact_lens_types`
(este ultimo sembrado pero sin consumir en el formulario).

---

## Roles y permisos

Spatie. Roles en `app/Enums/Role.php`: `admin`, `optometra`, `recepcionista`, `vendedor`,
`cajero`, `encargado_lab`. Permisos en `app/Enums/Permission.php`.

El menu lateral se filtra por rol **y** por los settings `menu_visible_sections` /
`menu_visible_items`, editables en Configuracion.

---

## Integraciones

| Servicio | Estado | Donde |
|---|---|---|
| Anthropic (Claude) | Activo | `AiService`, key en `.env` (`ANTHROPIC_API_KEY`), gate `AI_FEATURES_ENABLED` |
| OpenAI | Solo configuracion | `OpenAiService`, key **cifrada** en `settings.openai_api_key` |
| SMTP | Activo | `MailConfigService`, credenciales en `settings` (⚠️ `mail_password` en texto plano) |
| WhatsApp | Servicio presente | `WhatsAppService`, `SendWhatsAppMessage` job |

---

## Pendientes conocidos

Ordenados por impacto.

1. **Datos legacy fuera de rango** — 4.209 de 4.592 consultas tienen valores que violan los
   rangos clinicos. Hoy se toleran si no se editan (ver gotcha 5 en CLAUDE.md). Una limpieza
   real necesita una migracion de saneamiento revisada con la clinica.
2. **IA por voz** — diseñado y con la configuracion lista; falta captura, transcripcion y
   autocompletado. Especificacion completa en [ai-consulta-por-voz.md](ai-consulta-por-voz.md).
3. **`mail_password` en texto plano** en `settings`. `openai_api_key` ya usa `Crypt::encryptString`
   y sirve de patron para migrarla.
4. **Sin UI**: gestion de plantillas de impresion, log de auditoria.
5. **Codigo muerto**: `useAutosave.js`, `ConsultationResource.php`, `Cie10Dropdown.jsx`,
   columna `near_vision_data`.
6. **Reorden de tabs por usuario** — el orden de tabulacion de RX es fijo. Hacerlo configurable
   requiere preferencias por usuario, que hoy no existen (`settings` es global).
7. **`axios` esta en `devDependencies`** aunque es dependencia de runtime: un
   `npm ci --omit=dev` romperia el build.

---

## Historial de cambios relevantes

### 2026-08-22 — Lote de 12 correcciones

- **Causa raiz compartida**: cinco bugs venian de leer `res.data` donde el API devuelve
  `{data:{...}}`. Corregido con `getPayload` (menu de Administracion, primer guardado de
  paciente, cabecera de consulta).
- Paciente: `nombre` + `apellido` separados, `nombre_completo`, `fecha_registro`,
  `como_nos_conocio`, fechas DD/MM/AAAA (`DateInput` + `utils/dates.js`).
- Listado de pacientes ordenado por ultima consulta, con selector A-Z.
- RX: sin steppers (`type="text"`), todas las columnas visibles, orden de tabulacion explicito
  (Tab y Enter), multiples RX en uso, RX final renombrado a "RX - Vision de Lejos" con
  Distancia/AV/observaciones, Vision de Cerca sin AV.
- Errores de guardado: toast de 12 s con sonido, campos en rojo, auto-scroll, banner de
  cambios sin guardar, detector de conexion.
- `PatientAutocomplete` acepta `onSelect` y `onChange` (arreglaba 5 modulos a la vez).
- Catalogos: invalidacion de cache y select de optometra que salia en blanco.
- Configuracion de OpenAI cifrada + `POST /api/ai/test-openai`.

Detalle de decisiones y verificacion: ver el commit correspondiente.
