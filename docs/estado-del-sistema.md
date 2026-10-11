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
como "Nota del diagnostico" (no se imprime; el certificado toma sus RECOMENDACIONES de
"Recomendaciones medicas"). El catalogo se ordena por probabilidad segun RX Final (o Subjetivo)
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
| EcuadorAPI (datos por cedula) | Listo, apagado sin key (falta prueba con saldo) | `EcuadorApiService`, key en entorno (`ECUADORAPI_KEY`); pago por consulta, falla en silencio |

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

### 2026-10-11 — Auditoria del formulario de consulta

Revision de lo que podia perder datos, dejar pasar un dato equivocado o confundir al llenar una
consulta, respetando el formato rapido de la optica (`025` -> 0.25, `N`, Enter y flechas).

**Guardado**
- **El autoguardado solo escribe si hay cambios.** Hacia un `PUT` cada 30 s con cualquier consulta
  abierta: leerla la modificaba (filas hijas recreadas, `updated_by`, auditoria: 2.831 entradas
  para 8 consultas). Ahora compara una foto del contenido (`snapshotOf` / `meaningfulContent`).
- **Guardar una consulta importada ya no le borra `luna_espesor` / `luna_proteccion`.** Esas
  columnas traen texto del sistema anterior en 752 consultas y se reescribian desde los selectores
  de "Recomendacion de lunas", que para ellas estan vacios. Junto con el punto anterior, bastaba
  abrir la consulta 30 s para perderlo. `ConsultationService::syncLensRecommendation()` solo cambia
  la columna si se elige o se quita un item; el texto heredado se ve en el formulario. De paso,
  quitar una seleccion de material/espesor/proteccion ahora si se guarda.
- Una consulta nueva se autoguarda al cambiar cualquier dato clinico (antes solo con 12 campos:
  copiar una RX del historial no guardaba nada).
- **Aviso al salir** con cambios pendientes: primero intenta guardar y solo pregunta si falla.
- El campo enfocado viaja normalizado (un cilindro `075` a medio escribir se guardaba +0.75).
- Los datos del paciente en la cabecera ya no son campos del formulario (viajaban en cada envio).
- Sesion vencida: mensaje propio en vez de "Unauthenticated.". "Guardar borrador" pasa a
  "Guardar cambios" en una consulta completada.
- Un borrador rechaza medidas que no caben en `decimal(5,2)` (en MariaDB respondian 500).

**Medidas**
- **Avisos en ambar** (`utils/refractionChecks.js`): cilindro sin eje, eje sin cilindro, eje 0,
  valor que no es multiplo de 0.25, valor poco habitual con sugerencia ("+25.00... si quiso +0.25
  escriba 025"), cilindro positivo, cambio de signo o salto de 2.00 D frente a la RX en uso, ADD
  distinta entre ojos, AV no reconocida. "Completar consulta" los lista y deja seguir; solo
  bloquea un cilindro sin eje en la RX Final (tambien en el servidor).
- **Lectura computador y Retinoscopia se uniforman** al salir del campo: `-125-225x2` ->
  `-1.25 -2.25 x 2` (`normalizeRefractionText`). Lo que no es una refraccion queda igual.
- Placeholders con ejemplo en los campos de texto, eje `1–180` (decia 0–180), prisma sin la base,
  y `maxLength` segun la columna. El resumen de RX Final ya no muestra "±0.00" por un campo vacio.
- **Al completar un borrador se valida todo** menos la receta en uso: como el autoguardado ya
  habia guardado el valor, llegaba "sin cambios", se le quitaba la regla de rango y la consulta
  se completaba con el.

**Claridad**
- El mensaje de cada error sale bajo su campo y se quita al corregirlo; los obligatorios llevan
  `*` desde el principio y el servidor los exige en el paso a completada.
- Fechas con `DateInput` (`DD/MM/AAAA`) y aviso inmediato de fecha futura.
- "Cedula / RUC" era el registro del medico: ahora "Registro SENESCYT del medico", y se llena al
  elegirlo. El medico por defecto es quien abre la consulta solo si es medico.
- Cada cuadro de texto dice si se imprime en el certificado; la nota de un diagnostico ya no se
  llama "Recomendaciones". La segunda "Queratometria" pasa a "Queratometria detallada".
- Las pruebas binoculares heredadas (`cover_test`, `ppc`...) vuelven a verse en su tabla.
- Tildes en todo el formulario ("Edad: 7 años"), `htmlFor` / `aria-label`, estado con color.
- Venta: precio y descuento solo numericos, descuento hasta 100.

**Pendiente**: edicion simultanea (gana la ultima escritura), copia local del borrador y
confirmar con la optica el ejemplo de Base del prisma y si el DP se escribe mono o binocular.
En produccion, las consultas importadas que ya se abrieron perdieron `luna_espesor` /
`luna_proteccion`: se pueden recuperar del origen de la importacion por `legacy_id`.

### 2026-10-11 — Errores de llenado del alta de paciente

Revision de lo que podia salir mal al llenar `/pacientes/nuevo` (orden de llenado, cambiar un
dato despues de otro, salir a destiempo).

- **Tipo de documento explicito**: interruptor "Cedula / RUC" (por defecto) o "Pasaporte u otro
  documento". Antes cualquier texto con una letra pasaba como pasaporte, asi que una cedula mal
  tecleada ("17100340q5") se registraba sin digito verificador y sin encontrar al paciente que ya
  existia. Viaja como `document_type` (no se guarda) y `tipo` en el lookup; regla
  `App\Rules\ValidPatientDocument`. "Otro" admite 5-15 letras o numeros **sin guion**, para que
  un codigo `HIST-`/`IMPORT-` siga obligando a poner el documento real.
- **La barrera de duplicados tambien esta en el servidor**: `Store/UpdatePatientRequest` rechazan
  la variante de un documento ya registrado (RUC, sin cero inicial) con
  `PatientService::duplicateDocumentMessage()`. Antes solo lo comprobaba el formulario, y con
  "No se pudo verificar. Puede continuar" se registraba igual.
- **Telefono**: se aceptan el fijo local de 7 digitos (asi estan 459 importados) y numeros
  extranjeros con `+`; `max:20` por el VARCHAR(20) de la columna.
- **Email repetido ya no bloquea** (242 pacientes lo comparten con un familiar): se quito el
  `unique` y el formulario avisa con `GET /api/patients/lookup?email=` (`mismo_email`).
- **Autocompletado**: nombre y apellido se llenan juntos y solo si ambos estan vacios; si ya hay
  algo escrito se ofrece "Usar estos datos" en vez de mezclar. No toca una fecha con el foco.
- **Nombres parecidos**: basta con que coincida el nombre mas corto de los dos (el Registro Civil
  trae cuatro palabras y muchos registros guardan dos o tres).
- **No se pierde lo escrito**: "Ver ficha" abre en otra pestaña y salir con datos pide
  confirmacion (`useBlocker` + `beforeunload`). "Es este paciente" lleva lo tecleado a la edicion.
- **Restaurar un eliminado pide confirmacion** y el foco ya no cae en ese boton (cedula + Enter +
  Enter lo restauraba).
- **Verificacion**: sesion vencida o sin permiso ya no dicen "puede continuar"; la consulta tiene
  limite de 8 s.
- **Fechas**: edad junto a la fecha de nacimiento, error inmediato si es futura, y una fecha a
  medio escribir ya no se borra sola al salir del campo (`DateInput`).
- **Edicion**: el formulario no se habilita hasta cargar al paciente (vacio, "Actualizar" guardaba
  blancos). Un dato heredado invalido **sigue bloqueando** el guardado (decision de la optica: 905
  fechas de nacimiento futuras, cedulas sin verificador), pero se lista al abrir, con la
  correccion de un clic para las fechas que la importacion leyo como 20XX.
- Tests: `tests/Feature/PatientValidationTest.php`, ampliados `PatientLookupTest` y
  `ValidEcuadorPhoneTest`.
- Pendiente: una correccion posterior del paciente no se reenvia a Contifico (`syncPatient` sale
  si ya hay `contifico_id`).

### 2026-10-09 — Autocompletado del alta con EcuadorAPI

- Con la cedula o RUC en `nuevo`, `GET /api/patients/identity?cedula=` (permiso `patients.create`,
  `throttle:30,1`) trae nombre, apellido y fecha de nacimiento y el formulario llena los campos
  que sigan vacios. `EcuadorApiService` pide en paralelo `/cedulas/{id}/nombres` y
  `/cedulas/{id}/nacimiento` ($0.01 cada uno); de un RUC se consultan los primeros 10 digitos.
- **Silencioso**: sin key, sin saldo (402), con limite (429) o con la API caida el endpoint
  responde `encontrado: false` y el alta sigue a mano. Un rechazo pausa las consultas hasta 1 h.
- Resultado completo cacheado 24 h por cedula. Cubierto por `tests/Feature/PatientIdentityLookupTest.php`.
- Pendiente: probar con una key con saldo (la de prueba respondia 402) y confirmar el formato
  real de `birth_date`, que la API no documenta.

### 2026-10-09 — El alta de paciente empieza por la cedula

- **Cedula / RUC como primer campo** de `/pacientes/nuevo`: el resto del formulario se habilita
  cuando `GET /api/patients/lookup` confirma que no existe. Si existe, una tarjeta ofrece Nueva
  consulta, Ver ficha o Actualizar datos (`components/patients/PatientMatchCard.jsx`).
- **Comparacion tolerante**: encuentra la cedula sin cero inicial, el RUC de la misma persona y
  lista como "relacionadas" las que llevan letra o un digito menos. Aviso de **nombres parecidos**
  para los importados con codigo provisional; "Es este paciente" abre su edicion con la cedula nueva.
- **Paciente eliminado**: se informa y se puede restaurar (`POST /api/patients/{id}/restore`,
  permiso `patients.delete`). Antes, registrar su cedula respondia 500.
- **Errores 422 por campo** en el formulario de paciente (antes solo un toast con el primero).
- `StorePatientRequest`: `cedula` y `fecha_nacimiento` son `required` (las columnas son NOT NULL).
- Migracion `2026_10_09_000001`: los triggers FTS5 de pacientes (solo SQLite) corrompian la base al
  restaurar un eliminado.

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
