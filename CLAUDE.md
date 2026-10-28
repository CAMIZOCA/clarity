# CLAUDE.md

Guia rapida para trabajar en este repositorio.

Inventario completo de modulos, endpoints y estado: **[docs/estado-del-sistema.md](docs/estado-del-sistema.md)**.

## Comandos

```bash
composer dev
composer test
php artisan test --filter NombreDelTest
./vendor/bin/pint
npm run build
composer setup
```

`./vendor/bin/pint` sin argumentos reformatea ~130 archivos con deriva de estilo previa.
Pasarle solo los archivos tocados para no generar diffs enormes sin relacion.

## Arquitectura

Stack principal: Laravel 13, PHP 8.5+, React 18, Vite 8 (rolldown), Tailwind CSS 4 y SQLite por defecto.

### Directorios clave

- `routes/web.php` - rutas web, login/me y entrada de la SPA
- `routes/api.php` - API bajo `auth:sanctum`
- `app/Http/Controllers/Api/` - controladores de la API
- `app/Services/` - logica de negocio (los controladores delegan aqui)
- `app/Models/` - modelos Eloquent
- `resources/js/` - frontend React (paginas en `pages/`, router en `router/index.jsx`)
- `database/migrations/` - esquema de base de datos

### Base de datos

- SQLite es la configuracion local por defecto; **MariaDB en produccion**.
- Zona horaria: `America/Guayaquil` via `APP_TIMEZONE` (`config/app.php` y las conexiones
  mysql/mariadb de `config/database.php`). La BD guarda hora local, no UTC. Estuvo fijada en
  `'UTC'` a mano, y despues de las 19:00 locales todo `whereDate('created_at', today)` contaba
  el dia siguiente.
- Sesiones, cache y colas usan el driver de base de datos. No se requiere Redis.
- La BD local **contiene datos reales importados** (~3.500 pacientes, ~4.500 consultas).
  No borrar registros ni cambiar contraseñas para pruebas: crear un usuario temporal
  y eliminarlo al terminar.

### Frontend

- Tailwind CSS 4 via `@tailwindcss/vite`. No hay configuracion de PostCSS.
- **No existe alias `@/`**: todos los imports son rutas relativas (`../../components/ui/Toast`).
- Estilos principales en `resources/css/app.css`.

---

## Gotchas (leer antes de tocar codigo)

Cada uno de estos ya causo un bug en produccion.

### 1. Los API Resources envuelven en `data`

El proyecto **si usa** `JsonResource` (`PatientResource`, `UserResource`) y **nunca** llama a
`JsonResource::withoutWrapping()`. Un controlador que devuelve `(new PatientResource($x))->response()`
produce `{"data":{...}}`, pero uno que devuelve `response()->json(['user' => UserResource::make($x)])`
**no** envuelve. Las dos formas conviven.

En el frontend, leer siempre con el helper existente:

```js
import { getPayload } from '../../api/response';
client.get(`/patients/${id}`).then(r => setPatient(getPayload(r)));
```

Leer `r.data` directo fue la causa raiz de cinco bugs distintos (paciente que caia en
`/pacientes/undefined`, menu de Administracion que desaparecia al recargar, cabecera de
consulta vacia). `resources/js/api/response.js` ya expone `getPayload`, `getList` y `getPagination`.

### 2. `consultations` esta al limite de fila de InnoDB

La tabla tiene ~145 columnas y roza el limite de 8126 bytes por fila. Ya hubo dos migraciones
de reparacion (`2026_05_27_900000_reduce_consultations_row_size`, que convirtio 32 VARCHAR a TEXT,
y `2026_08_08_000001`, que recreo columnas que un ALTER anterior no llego a crear).

**Toda columna nueva en `consultations` debe ser `TEXT`, nunca `VARCHAR`** — TEXT solo ocupa un
puntero en la fila. Las tablas hijas no tienen esta restriccion.

Las columnas que siguen siendo VARCHAR tienen otra trampa: SQLite no impone la longitud y
MariaDB si. `retinoscopia_od/oi` eran VARCHAR(20) con `max:100` en la validacion, y una
retinoscopia de 24 caracteres abortaba el guardado solo en produccion (corregido en
`2026_10_07_000002`). El `max:` de `StoreConsultationRequest` nunca puede superar el VARCHAR.

### 3. `ConsultationController::extraFields()` es una lista blanca manual

Un campo nuevo de consulta necesita estar en **tres** sitios o se descarta en silencio al guardar:
`StoreConsultationRequest::rules()`, `Consultation::$fillable` y `ConsultationController::extraFields()`.

### 4. Campos "avanzados" que ocultan columnas

`settings.advanced_form_fields` (JSON en la tabla `settings`) oculta campos del formulario de
consulta. El default vive en `resources/js/data/formFieldsOptions.js`, pero **cambiar el default
no basta**: el valor ya esta persistido en la BD y hace falta una migracion de datos que lo
depure (ver `2026_08_22_000004_unhide_refraction_fields`).

### 5. Datos legacy fuera de rango clinico

El 92% de las consultas importadas tiene valores que violan `App\Rules\ValidOpticalPrescription`
(ejes > 180, esferas de 20). Como el formulario reenvia todos los campos, cualquier edicion
fallaba con 422. `UpdateConsultationRequest::relaxRangesForUnchangedValues()` retira la regla de
rango **solo** si el valor enviado es identico al almacenado.

`UpdateConsultationRequest::relaxNumericForUnchangedKeratometry()` hace lo mismo con la
queratometria horizontal/vertical/eje: la importacion dejo texto ("N", "NORMAL") en miles de
consultas y la regla `numeric` impedia guardar cualquier edicion. Solo se perdona un valor
identico al guardado.

**No relajar los rangos de `ValidOpticalPrescription`**: hay un test que fija esa intencion
clinica a proposito (`tests/Unit/ValidOpticalPrescriptionTest.php`).

Esa tolerancia es para lo heredado, no para un borrador: al pasar de borrador a completada
(`isCompleting()`) todo se valida menos la receta en uso, que suele copiarse del historial. Sin
eso, el autoguardado ya habia persistido el valor, llegaba "sin cambios" y la consulta se
completaba con una esfera de 99.99. Lo mismo aplica al eje obligatorio de un cilindro en la RX
Final y a los obligatorios de `settings.required_fields`, que el servidor exige solo en ese paso
(`tests/Feature/ConsultationCompletionRulesTest.php`).

### 6. Doble cache del catalogo de consulta

`GET /api/consultations-meta` se cachea 10 min en servidor y 5 min en el SPA (`api/cache.js`).
Cualquier mutacion de catalogos debe llamar a `Cache::forget(ConsultationMetaController::CACHE_KEY)`,
como ya hace `CatalogController`.

### 7. Nunca cachear Collections ni modelos Eloquent

`config/cache.php` restringe las clases deserializables (`serializable_classes`), y en
produccion el store es `database`, que serializa el valor. Un `Cache::remember()` que
devuelve una `Collection` o un modelo **escribe bien y lee corrupto**: a partir del segundo
request llega `{"__PHP_Incomplete_Class_Name": "..."}`.

Sintoma tipico: la pantalla funciona una vez y despues se vacia sola hasta que expira el TTL,
asi que parece intermitente. Vacio `/api/consultations-meta` (selects de Medico, Plantilla y
Diagnosticos en blanco) y los cinco reportes comerciales en $0.00.

**Todo closure de cache debe cerrar con `->toArray()`** y no dejar objetos Carbon sueltos
(`->toDateTimeString()`). Lo cubren `tests/Feature/ConsultationMetaCacheTest.php` y
`tests/Feature/CommercialReportsTest.php`, que fuerzan el store de base de datos porque la
suite corre con `CACHE_STORE=array` y ese store guarda objetos en memoria sin reproducir el fallo.

### 8. Columnas NOT NULL con default no aceptan `null` explicito

`sale_items.prescription_eye` e `item_type` son NOT NULL con `default()`. `SaleService::addItem()`
les pasaba `$data['x'] ?? null`, y un `null` explicito **no** cae al default: con `'strict' => true`
el insert aborta. Agregar cualquier producto en el POS respondia 500.

Al escribir una columna opcional, el fallback debe ser el default de la columna, no `null`.

Lo mismo al reves, al leer: SQLite toma un `select` de una columna que **no existe** como un
texto literal y no falla, mientras MariaDB responde 500 (`Unknown column`). `ReceptionFeedService`
pedia `rx_final_avl_*`, que la migracion `2026_09_14_000003` ya habia eliminado (hoy es
`rx_final_av_*`): las pruebas pasaban y el dashboard daba 500 en produccion. Una prueba que
recorra un `select(...)` explicito debe afirmar el **valor** de cada columna leida, no solo el 200.

### 9. Nombre del paciente

`patients.nombre` es el **nombre de pila** y `patients.apellido` el apellido. Los registros
historicos guardan el nombre completo en `nombre` con `apellido` vacio. Para mostrar, usar
siempre el accessor `nombre_completo` (esta en `$appends`, viaja en todas las serializaciones).
Al hacer eager loading hay que incluir `apellido`: `with('patient:id,nombre,apellido,cedula')`.

### 10. El catch-all de la SPA se traga las rutas `/api/*` mal escritas

`routes/web.php` termina en `Route::get('/{any}', ...)->where('any', '.*')`. Sin proteccion, un
`/api/loquesea` inexistente devuelve **200 con el HTML del index**: axios ve un 200 y entrega
HTML como si fueran datos.

`Route::fallback()` **no sirve**: Laravel ordena los fallback al final de todas las rutas, o sea
despues del catch-all de web.php. Por eso `routes/api.php` cierra con un `Route::any('{unmatched}')`
normal, que si se registra antes.

### 11. Sesion atada al vhost

`.env` tiene `SESSION_DOMAIN=sistemaclinico.test`. Servir con `php artisan serve` en
`localhost:8000` hace que la cookie nunca llegue y **todo `/api/*` responde 401**, lo que parece
un bug de la app. Probar siempre en `http://sistemaclinico.test` (vhost de Laragon).
Con Laragon apagado, la configuracion `app-sin-vhost` de `.claude/launch.json` levanta
`localhost:8000` con `SESSION_DOMAIN=null`, que si conserva la sesion.
Si sobra un `public/hot` de un `npm run dev` muerto, borrarlo o los assets dan 404.

### 12. Contifico: el token viaja en la URL

La API de Contifico recibe la API key en el header `Authorization` (sin `Bearer`) y el API token
en la query string (`?pos=`). Las excepciones del cliente HTTP incluyen la URL completa, asi que
**todo mensaje de error pasa por `ContificoService::sanitize()`** antes de guardarse en
`contifico_sync_logs` o en el log. No loguear `$e->getMessage()` crudo ni la URL.

El envio se dispara desde `PatientService::create()` **fuera** de la transaccion y dentro de un
`try/catch`: con `QUEUE_CONNECTION=sync` el job corre en el request, y un Contifico caido no debe
tumbar el alta del paciente. Los fallos de red/429/5xx lanzan `ContificoTemporaryException`
(la cola reintenta); 400/401/403 son definitivos y no se reintentan.

### 13. El autoguardado no puede recargar el formulario de consulta

`ConsultationForm` autoguarda cada 30 s. Antes cada guardado terminaba en
`reset(respuestaDelServidor)`, y eso borraba datos de dos formas:

- **Filas que el servidor descarta.** El formulario, `StoreConsultationRequest::dropEmptyModuleRows()`
  y `ConsultationService::syncModules()` deciden cada uno que fila de `sale_items` / `diagnoses` /
  `recommendations_list` esta "vacia". El servicio exigia descripcion en la venta y las otras dos
  capas no: un item con nota y precio respondia 200, se descartaba y el `reset()` lo borraba de la
  pantalla. **Los tres criterios deben coincidir** (`MODULE_ROW_CONTENT_KEYS` en el formulario).
- **`reset()` en si.** Reescribe todos los inputs (pierde lo tecleado mientras viajaba el guardado)
  y regenera los ids de `useFieldArray`, que vuelve a montar las filas y saca el foco del campo.

Ahora el autoguardado solo trae las columnas planas que el servidor asigna o normaliza
(`syncServerAssignedValues`), sin tocar el campo enfocado, lo editado despues del envio ni los
modulos/filas. El `reset()` completo queda para el guardado manual, y solo si nadie escribio
entretanto. Los guardados van en serie (`doSave` encola): dos a la vez duplicaban la consulta.

**El autoguardado solo escribe si hay cambios.** Antes hacia un `PUT` cada 30 s con cualquier
consulta abierta: leerla ya la modificaba (2.831 entradas de auditoria para 8 consultas). Ahora
compara `snapshotOf(getValues())` con la foto de lo ultimo guardado. Esa foto pasa por
`meaningfulContent()`, que descarta vacios, objetos y filas en blanco, y compara todo como texto:
react-hook-form crea `{ campo: '' }` al montar un input sin valor inicial (los modulos de una
consulta importada llegan en `null`) y eso no es un cambio del usuario. Un campo nuevo que el
formulario rellene solo al cargar debe entrar en `buildDefaultValues`, o cuenta como cambio.
Una consulta nueva nace cuando cambia algo fuera de la cabecera (`HEADER_FIELD_KEYS`), y al salir
con cambios se intenta guardar antes de preguntar (`useBlocker` + `beforeunload`).

### 14. Las consultas importadas no guardan lo que dicen sus columnas

El sistema anterior de Optica Andina escribia las dioptrias sin punto ("+300" es +3.00) y usaba
varios campos para otra cosa. La importacion lo copio literal, asi que en las consultas con
`legacy_id`:

- esfera, cilindro y ADD de `rx_final_*`, `subj_*` y `vc_*` estan multiplicados por 100;
- el subjetivo y la RX en uso son **un solo texto por ojo** en el Access
  (`RXPARCIAL_CILINDRO_*` y `RX_EN USO_EJE_*`: "+050-100x 80 20/40-", a veces con una nota:
  "prog ev gold", "No trajo"). La importacion guardo solo el primer numero: la esfera del
  subjetivo quedo en `subj_cilindro`, la de RX en uso en `rx_uso_eje`, y cilindro, eje y AV
  nunca entraron. `RX_EN USO_ESFERA_*` trae una agudeza ("20/40", "CD 3m"), de ahi el 20
  residual en `rx_uso_esfera`;
- `ark_*` (rotulado "Queratometria") trae la refraccion, que aqui es la Retinoscopia, y
  `retinoscopia_*` trae el cover test ("ORTHO", "X").

Lo corrige `LegacyConsultationRepairService` en dos pasos. Cada cambio queda en
`consultation_legacy_repairs` con el valor anterior: eso permite `--revert` y evita que una
segunda pasada divida dos veces (2500 -> 25.00 -> 0.25).

- **Sin el Access** (`decimales` y `rx_uso`): se aplican solas con la migracion
  `2026_10_13_000001`. No hay que correr nada a mano.
- **Con el Access** (`subj_origen` y `rx_uso_origen`): reparten la refraccion completa. Corren
  al importar el respaldo sin `--replace` (`import:optica-andina-sqlite`, o Mantenimiento con
  "Reescribir datos legacy" desmarcado) o con
  `consultations:repair-legacy-import --source=ruta.sqlite` (primero con `--dry-run`). Solo tocan
  un ojo que sigue como lo dejo la importacion; lo corregido a mano se respeta. Aplicado en la BD
  local el 2026-10-13; en staging y produccion falta subir el `.sqlite`.

La regla `ark` **no esta aplicada en ninguna instancia** (falta que la optica vea el
`--dry-run`), y `subj` (mover el numero a esfera a ciegas) quedo superada por `subj_origen`.

Los importadores leen esas columnas con `App\Support\LegacyOpticalParser`; una importacion
nueva no debe volver a usar `decimal()` ni `diopter()` sobre un campo que trae la refraccion
entera: para eso estan `refraction()`, `subjective()` y `rxUso()`. `refraction()` devuelve null
ante lo que no es una medida (fuera de pasos de 0.25/0.12, cilindro > 10) en vez de adivinar:
"-050-0580x 15" o un radio de lente de contacto se informan y se dejan para revision manual.

### 15. El service worker no puede cachear datos

`public/sw.js` solo se registra con build de produccion y en contexto seguro (HTTPS o
`localhost`), asi que en `http://sistemaclinico.test` no corre y el fallo no se ve en desarrollo.
Aplicaba "cache primero" a **todo** GET del mismo origen, `/api/*` y `/me` incluidos: cada
pantalla mostraba la respuesta anterior (una consulta recien guardada se reabria con los valores
viejos, y guardarla otra vez los reescribia) y `/me` devolvia un usuario despues de cerrar sesion.

`/api/`, `/sanctum/`, `/storage/`, `/me`, `/login` y `/logout` van siempre a la red
(`isNetworkOnly`). Un endpoint de datos fuera de `/api/` hay que agregarlo ahi, y cualquier
cambio de estrategia exige subir `CACHE_NAME` para purgar lo ya guardado en los navegadores.

**Aviso de version nueva sin depender del SW**: `app.blade.php` incrusta `<meta name="app-build">`
(`AppVersion::current()`, hash del manifest de Vite) y `GET /app-version.json` devuelve el actual.
`useAppUpdate` los compara al volver a la pestana, al recuperar foco/red y cada 5 min; si difieren
recarga sola (limpiando caches) salvo en pantallas de edicion (`EDITING_PATHS`), donde `UpdateModal`
pide pulsar un boton. Una pantalla de escritura nueva debe agregarse a `EDITING_PATHS`. Un chunk 404
(`vite:preloadError`) dispara lo mismo. `sessionStorage` evita recargar en bucle.

### 16. Guardar una consulta importada no puede borrarle columnas

El formulario reenvia la consulta entera, y varias columnas planas se reescriben desde un modulo
(`luna_*` desde "Recomendacion de lunas", `diagnostico_*` desde `diagnoses`, `rx_uso_*` desde la
primera receta en uso). Si el modulo llega vacio porque el formulario no muestra ese dato, la
columna se pierde: `luna_espesor` y `luna_proteccion` traen texto del sistema anterior en 752
consultas importadas (a veces notas clinicas) y cada guardado lo dejaba en `null`.

- `ConsultationService::syncLensRecommendation()` solo cambia una columna `luna_*` si se elige un
  item o se quita uno que estaba elegido; el texto heredado se muestra en el formulario como
  "Registro del sistema anterior".
- En `buildDefaultValues` los modulos anidados van **despues** del `...consultation`: la consulta
  importada los trae en `null`, y antes ese `null` pisaba el valor por defecto (se perdian en
  pantalla `luna_observacion` y las pruebas binoculares heredadas).
- Antes de mapear un modulo a columnas planas, comprobar que el formulario muestra lo que ya
  hay en ellas. Lo cubre `tests/Feature/ConsultationLensRecommendationTest.php`.

---

## Convenciones

- **Toast**: `const { addToast } = useToast(); addToast('Mensaje', 'error')`. Tipos: `success`,
  `error`, `warning`, `info`. Los errores duran 12 s y suenan; el resto 5 s (el raton encima
  pausa la cuenta). La firma es `addToast(mensaje, tipo, duracionMs?, accion?, titulo?)`;
  `accion` (`{ label, onClick }`) vuelve el aviso clicable y el titulo sale del tipo si se omite.
  Maximo 5 a la vez, arriba a la derecha; los estilos son las clases `toast-*` de `app.css`.
- **Errores de la consulta**: todo aviso de validacion lleva al campo con `goToField(nombre)`, que
  abre la seccion colapsada (`openCollapsibleSection`) y revela los campos avanzados si hace falta.
  Una seccion nueva necesita su regla en `FIELD_SECTION_RULES` (`ConsultationForm.jsx`).
  `RequiredErrorsCtx` es un `Map` campo -> mensaje: el texto sale bajo el campo (`FieldNote`) y se
  quita al editarlo. Los obligatorios llevan `*` desde el principio (`FieldLabel`).
- **Avisos de medidas**: `resources/js/utils/refractionChecks.js` marca en ambar lo que el formato
  rapido deja pasar ("25" es +25.00, cilindro sin eje, eje 0, valor que no es multiplo de 0.25,
  cambio de signo respecto a la RX en uso). No bloquean: "Completar consulta" los lista y permite
  seguir, salvo un cilindro sin eje en la RX Final, que tambien rechaza el servidor. Solo miran lo
  que cambio desde la carga, igual que la tolerancia del gotcha 5. Un chequeo nuevo va ahi, no en
  `ValidOpticalPrescription`.
- **Campos con una refraccion completa** ("Lectura computador", "Retinoscopia"): al salir del
  campo `normalizeRefractionText` deja `-125-225x2` como `-1.25 -2.25 x 2`. Nunca al cargar, y lo
  que no reconoce (una AV, una queratometria, un "ORTHO" heredado) queda como se escribio.
- **Medico de la consulta**: una consulta nueva queda a nombre de quien la crea solo si es medico
  (`User::CLINICIAN_ROLES`, lo resuelve `StoreConsultationRequest`). Al elegir medico se trae su
  registro SENESCYT a `doctor_license`, sin pisar uno escrito a mano.
- **Terapia visual (motor, binocular y acomodativo)**: la seccion del formulario (4 bloques) se
  define en `resources/js/data/motorBinocularSchema.js` (`MOTOR_BINOCULAR_BLOCKS`) y se pinta en
  `pages/consultations/MotorBinocularSection.jsx`. Se guarda en la JSON `consultations.motor_binocular_data`
  como v2 `{ bloque: { prueba: { campo: texto } } }`, sin columnas nuevas ni migracion de datos.
  `buildMotorBinocularDefaults()` convierte al mostrar la v1 (`{prueba:{od,oi,observacion}}`) y las
  columnas planas importadas (el OD/OI de versiones, cover test, PPC y Hirschberg pasa a la
  observacion de esa prueba); el PPC OBJ/Luz/FR de Oftalmoscopia rellena el PPC si esta vacio. Se
  guarda como v2 en el siguiente guardado. Un campo nuevo solo va en el schema. Sigue en "avanzados"
  (`consulta:sec_motor_binocular`) y no sale en ningun PDF.
- **Probar la consulta en el navegador**: el interceptor de escrituras se instala en otra pagina
  y se llega a la consulta navegando dentro del SPA (`history.pushState` + `popstate`). Instalarlo
  despues de cargar la consulta deja pasar el primer autoguardado.
- **Fechas**: toda fecha de calendario viaja como `YYYY-MM-DD` y se muestra `DD/MM/AAAA`.
  Usar `resources/js/utils/dates.js` (`toDisplayDate`, `toIsoDate`, `todayIso`) y el componente
  `DateInput`. **Nunca** `new Date('YYYY-MM-DD')` a secas: en UTC-5 devuelve el dia anterior.
- **Teclado en formularios**: en consulta y paciente, Enter y las flechas pasan de campo como Tab
  (`resources/js/utils/fieldNavigation.js`); se activa con `onKeyDown={handleFieldNavigation}` en
  el `<form>`. Ahi Enter ya no envia el formulario: lleva al boton de guardar. El borde ambar del
  campo activo es una regla **sin capa** en `app.css`, asi que un `focus:outline-*` de Tailwind
  no la pisa.
- **Medidas opticas**: esfera, cilindro y ADD se muestran con signo explicito y dos decimales
  ("+0.75", "-0.25"). Las columnas son `decimal` y no guardan el "+": al cargar un valor en un
  input o en un PDF usar `formatOpticalForInput` (`resources/js/utils/opticalFormat.js`). Un
  cilindro tecleado sin signo se vuelve negativo solo en el formulario; `OpticalValueNormalizer`
  (PHP) respeta el signo recibido a proposito, para no invertir un valor ya guardado.
- **Letras despues del numero ("20 CC")**: esfera, cilindro y eje de Subjetivo, RX final, RX en
  uso y Vision de cerca admiten una nota tras el numero (la optica anota "CC" junto al valor que
  comprobo con una prueba). El formulario muestra y envia `20 CC`; el servidor lo separa
  (`OpticalValueNormalizer::splitNote`, en `StoreConsultationRequest::prepareForValidation`): el
  numero va a su columna de siempre y la nota a `consultations.medidas_notas`
  (`{"subj_eje_od": "CC"}`) o a `consultation_rx_uso_entries.notas`. Al cargar,
  `applyMeasureNotes` las vuelve a unir. Las notas no se imprimen ni se copian con "Usar", y la
  ADD sigue siendo solo numero. Quien lea una medida del formulario como numero debe pasar antes
  por `splitMeasureNote` (lo hacen los `toNumber` de `refractionChecks.js` y
  `diagnosisSuggestions.js`). `splitNote` (PHP) y `splitMeasureNote` (JS) deben coincidir.
  **Texto sin numero ("COMP")**: en esfera y cilindro de Subjetivo y RX final (solo ahi, con
  `allowTextOnly`) un texto sin digitos es toda nota: la columna queda en `null` y
  `medidas_notas` guarda "COMP" (un ojo sin vision, medida compensatoria). Cuenta como dato para
  `required_fields`, y `applyMeasureNotes` lo devuelve al input. Como la columna es `null`, los
  sitios que muestran la RX final deben leer tambien `medidas_notas` (resumen de recepcion,
  `RxHistoryPicker`, `CertificadoPdf`); la orden de trabajo y la receta impresa no lo muestran.
  El Word del certificado (`CertificateDocxService`) es espejo de `CertificadoPdf.jsx`: cambiar
  diseno o datos en uno exige cambiarlo en el otro. Sus temporales van a `storage/app/phpword`,
  no a `sys_get_temp_dir()` (en Windows apunta a una carpeta sin permiso para PHP).
- **Dashboard = pantalla de recepcion**: cuando el optometra completa una consulta, el vendedor la
  ve en `/dashboard` sin abrir la historia. `GET /api/reception/consultations`
  (`ReceptionFeedService`, sin cache a proposito) devuelve las completadas de hoy (`?days=N` para
  mas) con el resumen (RX final, lente recomendado, recomendaciones, diagnostico, productos
  anotados); el dashboard lo pide al abrirse y al pulsar "Actualizar consultas recientes" (**sin
  polling**: el refresco cada 10 s saturaba), y destaca 30 min (`HIGHLIGHT_MINUTES`) la recien
  terminada. Requiere el permiso `consultations.handoff` (migracion
  `2026_10_14_000002`: los seeders no corren en bases existentes). Todo depende de
  `consultations.completed_at` (TEXT, hora local), que **solo** fija `ConsultationService` al pasar
  a `completada`: guardar cambios o autoguardar no la mueve, reabrir la anula, y no esta en
  `$fillable`/`extraFields()` para que el formulario no pueda enviarla. Las completadas sin ella
  (importadas) cuentan por `fecha_consulta` y no se destacan. "Iniciar venta" abre
  `/pos?paciente=ID&consulta=ID` y la venta queda con `consultation_id`.
- **Menu y rutas por permiso**: `MENU_ITEM_PERMISSIONS` (`data/menuOptions.js`) da el permiso de
  cada item; `Sidebar.jsx` lo oculta y `router/index.jsx` envuelve la ruta en `RequirePermission`
  ("No tiene acceso"). El ajuste global `menu_visible_*` sigue decidiendo que se ofrece; el permiso,
  quien lo ve. Un item o ruta nueva necesita su permiso ahi. Los permisos viajan en `/me` **y** en la
  respuesta de `/login` (`UserResource`): sin eso el menu salia vacio hasta recargar.
- **Reportes**: `ReportController` exige `reports.clinical` (clinicos) o cualquiera de
  `reports.sales/financial/inventory` (comerciales). `/reports/dashboard` queda abierto (dashboard y
  contador de Agenda) y `consultations-forecast` pide `consultations.handoff`.
- **Recepcion**: pacientes, consultas en lectura, agenda completa y ordenes de trabajo (ver, crear,
  editar, cambiar estado; no eliminar). Sin reportes, ventas, caja, inventario ni CRM
  (migracion `2026_10_26_000002`). Ve un mensaje de animo por dia bajo la fecha del dashboard
  (`data/dailyMessages.js`, `messageOfTheDay`).
- **Ficha de lectura de la consulta**: `/consulta/:id/ver` (`ConsultationViewPage`) muestra solo lo
  lleno, con rotulos de `data/consultationViewSchema.js`. Quien no tiene `consultations.edit` llega ahi
  desde la ficha del paciente y el dashboard (`utils/consultationLinks.js`) y `/consulta/:id` lo
  redirige. Un campo nuevo de la consulta que Recepcion deba ver se agrega al schema.
- **Consulta en solo lectura**: sin `consultations.edit` (Recepcion) la consulta se abre con
  `readOnly`: cada `CollapsibleSection` envuelve su contenido en `<fieldset disabled>` via
  `FormReadOnlyContext` (el encabezado queda fuera para poder abrirla), los avanzados se muestran
  todos, `doSave` no hace nada y no hay autoguardado ni aviso de salida; solo queda Imprimir.
  Recepcion tiene `consultations.view` y `generate_pdf`, no `create/edit/delete`, y edita solo la
  ficha del paciente. `index`/`show`/`pdf-data` exigen `consultations.view` y `destroy`
  `consultations.delete`. Un control nuevo de la consulta fuera de una seccion debe respetar `readOnly`.
- **La consulta se abre desde el paciente**: no hay item "Consulta" en el menu. Las rutas
  `/consulta?paciente=ID` y `/consulta/:id` siguen existiendo y son las que usa la ficha.
- **El alta de paciente empieza por la cedula**: `PatientFormPage` no habilita el resto del
  formulario hasta que `GET /api/patients/lookup?cedula=` responde `nuevo`
  (`PatientService::lookupByDocument`). La comparacion no es literal porque la importacion dejo la
  misma cedula escrita de varias formas (sin cero inicial, RUC = cedula + `001`, con letra o un
  digito menos al final); los nombres parecidos (`findSimilarByName`) son la segunda red para los
  importados con codigo provisional `HIST-`/`IMPORT-`. El indice unico de `patients.cedula` cuenta
  tambien a los eliminados, asi que las reglas `unique` de cedula no llevan `whereNull('deleted_at')`.
  Esa misma comparacion se repite en el servidor al guardar (`duplicateDocumentMessage`): no puede
  vivir solo en el formulario, que deja continuar cuando la verificacion no responde.
- **Tipo de documento del paciente**: el formulario envia `document_type` (`cedula` | `otro`), que
  no se guarda y solo elige la regla de `App\Rules\ValidPatientDocument`. Sin el, se exige una
  cedula: una letra ya **no** convierte el documento en pasaporte (una cedula mal tecleada se
  registraba sin digito verificador). "Otro" no admite guion a proposito, para que un `HIST-00123`
  siga sin pasar por documento valido.
- **Validar un paciente en dos sitios**: `resources/js/utils/patientValidation.js` adelanta al
  salir del campo lo que deciden `ValidPatientDocument`, `ValidEcuadorPhone` y
  `Store/UpdatePatientRequest`. Una regla que cambie en el servidor cambia tambien ahi.
- **Editar un paciente importado exige limpiar sus datos**: a diferencia de la consulta (gotcha 5),
  `UpdatePatientRequest` **no** relaja lo que no cambio. Es decision de la optica; el formulario
  lista los datos heredados invalidos al abrir en vez de fallar al guardar. El email no es unico
  (las familias lo comparten): solo se avisa.
- **Salir del formulario de paciente**: `useBlocker` pide confirmacion si hay datos escritos. Todo
  `navigate()` que sea una salida ya decidida (guardar, restaurar, "es este paciente") debe poner
  antes `allowLeave.current = true`, o el aviso aparece despues de guardar.
- **Autocompletado del alta (EcuadorAPI)**: con la cedula en `nuevo`, el formulario pide
  `GET /api/patients/identity` en segundo plano y llena nombre, apellido y fecha de nacimiento
  solo en los campos vacios (`EcuadorApiService`, key en `ECUADORAPI_KEY`). Es pago por consulta
  y **nunca muestra errores**: sin key, sin saldo o con la API caida responde `encontrado: false`.
  Un 401/402/403/429 pausa las consultas hasta una hora (`ecuadorapi:paused` en cache) para no
  sumar espera a cada alta. Solo consulta cedulas validas y sin registrar, y no se loguea la
  cedula ni el mensaje de la excepcion (trae la URL con la cedula).
- **Errores de carga y sesion vencida**: el interceptor de `api/client.js` guarda el ultimo fallo
  (`api/lastError.js`, solo metodo/ruta/codigo). Un 401 (o un 419 ya reintentado) fuera de `/me`,
  `/login` y `/logout` abre `SessionExpiredModal`, que vuelve a entrar **sin salir de la pantalla**
  (mandar a `/login` desmontaba la consulta a medio llenar); mientras esta abierto, `addToast` no
  muestra errores. Todo aviso `error` sin accion que sigue a un fallo de red/sesion/servidor recibe
  el boton "Revisar conexion" (`DiagnosisModal`, `utils/connectionDiagnosis.js`), que consulta
  `GET /session-check` (publico, sin datos del usuario, network-only en `sw.js`) y ofrece la
  solucion: reintentar, iniciar sesion, actualizar o copiar el detalle para soporte. Los avisos
  identicos se agrupan con contador en vez de apilarse. Un 5xx o una peticion sin respuesta lanza
  el diagnostico solo (max. cada 20 s) y `ConnectionBanner` avisa "servidor no disponible" hasta
  que vuelva. **Una ruta web que el SPA pida sola (foco, intervalo) no debe abrir sesion**:
  `/app-version.json` lleva `withoutMiddleware(StartSession...)` porque, si respondia despues de un
  login, reenviaba la cookie de sesion vieja y el usuario quedaba "dentro" con 401 en todo `/api`.
- **Servicios**: los controladores delegan en `app/Services/`. La logica de negocio no va en el controlador.
- **Permisos**: Spatie. Roles en `app/Enums/Role.php`, permisos en `app/Enums/Permission.php`.
  `user.roles` es un array de **strings** (`['admin']`), no de objetos.

## Codigo muerto conocido

No usar como referencia ni asumir que funcionan:
`resources/js/hooks/useAutosave.js` (el autosave esta inline en `ConsultationForm`),
`app/Http/Resources/ConsultationResource.php`, `resources/js/components/forms/Cie10Dropdown.jsx`,
y la columna JSON `consultations.near_vision_data` (ningun input la escribe).

## Notas utiles

- SPA con React Router; la ruta `/ayuda` es la documentacion para usuarios finales.
- Agentes especializados en `.claude/commands/` (`/clinica-backend`, `/clinica-consulta`, etc.).
- `admin@clinica.com` / `password` es del seeder y **no** funciona en la BD real importada.
