# Estado del sistema

Inventario vivo del sistema clinico (Optica Andina / clarity.medio-digital.net).
Sirve para retomar el trabajo sin volver a explorar el codigo desde cero.

**Ultima auditoria: 2026-09-24.** Al cerrar un modulo o cambiar arquitectura, actualizar
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
| Consultas | `/consulta?paciente=ID` (se entra desde la ficha del paciente; sin item de menu) | `ConsultationController` | ✅ |
| Agenda / Citas | `/agenda` (FullCalendar) | `AppointmentController` | ✅ |
| Ordenes de trabajo | `/ordenes-trabajo` | `LabOrderController` | ✅ |
| Lentes especiales | `/lentes-especiales` | `SpecialContactLensController` | ✅ |
| Referencias oftalmologicas | `/referencias` | `OphthalmologyReferenceController` | ✅ |
| Brigadas | `/brigadas` | `BrigadeController` | ✅ |
| Informes de garantia | `/informes-garantia` | `GuaranteeReportController` | ✅ |
| Certificados | (en ficha de paciente) — modelos General y Escolar/Vehicular (sin RX final) | `CertificateController` | ✅ |
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
| Contifico (pacientes -> clientes) | Ajustes -> Contifico, ficha del paciente | `ContificoController` + `ContificoService` + job `SyncPatientToContifico` | ✅ (falta prueba con credenciales reales) |

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

Orden de Tab, Enter y flechas (`EyeFieldGroup::buildOrderedNames`): esfera, cilindro y eje de
OD, luego los de OI; despues cada columna restante en bloque OD -> OI, con prisma y base como
par (prisma OD, base OD, prisma OI, base OI).

Navegacion con teclado (`utils/fieldNavigation.js`, activa en consulta y paciente con
`<form onKeyDown={handleFieldNavigation}>`): Enter y Arriba/Abajo pasan de campo como Tab;
Izquierda/Derecha solo cuando el cursor esta en el borde del texto. Enter no envia el
formulario: en el ultimo campo enfoca el boton de guardar, y en un `<textarea>` sigue siendo
salto de linea. En listas, fechas y numeros las flechas navegan en vez de cambiar el valor, y
Enter sobre una casilla de diagnostico sale de la lista. El resto de formularios no lo usa.

Diagnostico (`components/forms/DiagnosisPicker.jsx`): dos listas de seleccion multiple
lado a lado (OD / OI) con todo el catalogo `diagnoses`. Marcar un item agrega la fila
`{eye, catalog_item_id, code, description}` al mismo array `diagnoses`; `notes` se muestra
como "Recomendaciones". El catalogo se ordena por probabilidad segun RX Final (o Subjetivo)
con `utils/diagnosisSuggestions.js` (umbrales OMS/IMI/AOA/AAO); nada se pre-marca. Las filas
de texto libre, ojo "general" o items desactivados se editan aparte en "Otros diagnosticos".

`rx_uso_entries` admite varias recetas; la primera se desnormaliza a las columnas planas
`rx_uso_*` para no romper PDF, reportes ni la importacion legacy.

Historial de RX (`components/forms/RxHistoryPicker.jsx`, `GET /api/patients/{id}/rx-history`):
sobre "RX en uso" se listan las ultimas 5 consultas del paciente con su RX final; el boton
"Usar" copia esa fila a la primera receta en uso vacia (o agrega otra) y deja la procedencia en
la observacion.

Formato de las medidas (`utils/opticalFormat.js`): esfera, cilindro y ADD se muestran siempre con
signo y dos decimales. Las columnas son decimales y no guardan el "+", asi que
`formatOpticalForInput` lo repone al cargar. Un cilindro tecleado sin signo se toma negativo
(convencion de optometria); eso solo ocurre en el formulario, el backend respeta el numero que
recibe.

Certificado (`components/pdf/CertificadoPdf.jsx`): lo firma el doctor certificador vinculado al
medico de la cabecera clinica (`certifying_doctors.user_id`, o el que se llama igual); el
predeterminado es solo el respaldo y se avisa cuando se usa. Con logo cargado no se imprimen el
nombre ni el eslogan de la clinica.

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
| Contifico | Listo, apagado por defecto | `ContificoService`; API key y API token **cifrados** en `settings`; historial en `contifico_sync_logs` (90 dias) |

### Contifico

Al crear un paciente con la integracion activa se encola `SyncPatientToContifico`, que lo crea
en Contifico como Persona con `es_cliente=true` (o lo enlaza si alla ya existe esa cedula/RUC).
Solo viajan nombre, identificacion, telefono, email y direccion; nunca datos clinicos.

- Endpoints bajo `/api/contifico/*`: `status`, `config`, `test`, `logs` (permiso `settings.edit`)
  y `patients/{patient}/sync` (permiso `patients.edit`, corre en el request, no en la cola).
- Sin cedula de 10 digitos o RUC de 13 el paciente se omite (`status=skipped`); pasaportes incluidos.
- No sincroniza ediciones ni hay carga masiva de los pacientes historicos: se envian uno a uno
  con el boton "Enviar a Contifico" de la ficha.
- Requiere worker de cola (`queue:work` en `docker-compose.yml`, `queue:listen` en `composer dev`).
- "Probar conexion" valida la API key con una lectura; el API token (`pos`) solo lo valida
  Contifico en la primera escritura real.

---

## Pendientes conocidos

Ordenados por impacto.

1. **Datos legacy fuera de rango** — 4.209 de 4.592 consultas tienen valores que violan los
   rangos clinicos. Hoy se toleran si no se editan (ver gotcha 5 en CLAUDE.md). La limpieza ya
   existe (`php artisan consultations:repair-legacy-import`, ver gotcha 14) y esta probada sobre
   una copia de la BD, pero **todavia no se ha aplicado**: falta que la optica valide el informe
   de `--dry-run`. Quedan fuera 4 valores imposibles y la regla `subj` (sin confirmar).
   Sin el respaldo original del sistema anterior no se pueden recuperar ~205 RX en uso que
   perdieron los decimales, ni importar "Quien le recomienda" y el diagnostico de la ficha.
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

### 2026-10-07 — Notas de la optica: flujo por paciente, historial de RX, certificado y datos importados

- **Flujo por paciente**: se quitaron "Consulta" y "Nueva consulta" del menu y del dashboard; el
  login lleva a Pacientes. La consulta se abre desde la ficha.
- **Historial de RX** en "RX en uso" con boton "Usar" (`RxHistoryPicker`, `rx-history`).
- **Certificado**: firma el medico de la cabecera clinica, segundo modelo Escolar/Vehicular sin
  RX final (`certificates.tipo`), y con logo no se imprime el nombre ni el eslogan.
- **Signo explicito** en esfera, cilindro y ADD, tambien al recargar la consulta.
- **`retinoscopia_od/oi` y `vision_colores` pasan a TEXT**: eran VARCHAR(20)/(30) con 100/50
  caracteres permitidos en la validacion; en MariaDB una retinoscopia larga abortaba el guardado.
- **Ruta de navegacion** en la consulta (`components/ui/Breadcrumbs.jsx`): Pacientes › paciente ›
  consulta. Acceso rapido "Pacientes" como primer boton del menu.
- **Service worker**: dejo de cachear `/api/*` y `/me` (servia datos viejos en produccion; ver
  gotcha 15 en CLAUDE.md). `CACHE_NAME` pasa a `clarity-shell-v2`.
- **Reparacion de la importacion** (`consultations:repair-legacy-import`, bitacora en
  `consultation_legacy_repairs`) e importadores corregidos (`LegacyOpticalParser`). Pendiente de
  aplicar en cada instancia.

### 2026-10-04 — Navegacion con Enter/flechas y campo activo visible

- Pedido de un usuario con manejo basico del teclado: en consulta y paciente, Enter y las
  flechas pasan de campo como Tab (`utils/fieldNavigation.js`). Las tablas OD/OI siguen su
  recorrido explicito tambien con flechas.
- **Enter ya no completa la consulta por accidente**: antes, en casi todos los campos disparaba
  el envio implicito del `<form>` (estado `completada`). Ahora solo lleva al boton.
- El certificado (`CertificadoPdf`) se renderiza fuera del `<form>`: Enter en su campo de correo
  tambien completaba la consulta.
- Borde ambar en el campo activo de todo el sistema (regla sin capa en `app.css`,
  `--color-field-focus`); la landing publica conserva su estilo.

### 2026-10-04 — Integracion con Contifico

- Pacientes nuevos se crean en Contifico como clientes, en cola y sin frenar el alta.
  Pestaña nueva en Configuracion: interruptor, credenciales cifradas, prueba de conexion y
  ultimos 10 envios con reintento. Cubierto por `tests/Feature/ContificoIntegrationTest.php`.
- **Fuga corregida**: `SettingController::update()` respondia con `Setting::all_map()` sin
  enmascarar y devolvia `mail_password` en claro. Ahora `index()` y `update()` comparten
  `maskedSettings()`.
- Pendiente: primera prueba con las credenciales reales de la empresa (Contifico no documenta
  sandbox, asi que el cliente de prueba se crea en la cuenta real).

### 2026-09-24 — Per-eye diagnosis checklist y fixes post-agosto

- **Diagnósticos por ojo** (a2b0c5e): UI interactiva con checklist separado para OD/OI.
  Mejora la sección de diagnósticos en `ConsultationForm.jsx`.
- **Datos del paciente completos** (573e8c6): Campo ARK (Queratometria) visible en formulario,
  integración de `nombre_completo` en Pacientes y Consultas.
- **Fix validación módulos anidados** (c9912d8): `ConsultationContactLensModule`,
  `ConsultationOphthalmoscopyModule` y `ConsultationTreatmentModule` ya sincronizaban mal.
  Corregida lógica en `validatePayload()` del controlador.

Detalle: ver commits a2b0c5e, 573e8c6, c9912d8 en `git log`.

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
