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

**No relajar los rangos de `ValidOpticalPrescription`**: hay un test que fija esa intencion
clinica a proposito (`tests/Unit/ValidOpticalPrescriptionTest.php`).

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

### 14. Las consultas importadas no guardan lo que dicen sus columnas

El sistema anterior de Optica Andina escribia las dioptrias sin punto ("+300" es +3.00) y usaba
varios campos para otra cosa. La importacion lo copio literal, asi que en las consultas con
`legacy_id`:

- esfera, cilindro y ADD de `rx_final_*`, `subj_*` y `vc_*` estan multiplicados por 100;
- en RX en uso la esfera esta en `eje`, y `esfera` trae un 20 residual (de una AV "20/20");
- `ark_*` (rotulado "Queratometria") trae la refraccion, que aqui es la Retinoscopia, y
  `retinoscopia_*` trae el cover test ("ORTHO", "X").

`php artisan consultations:repair-legacy-import` lo corrige (`LegacyConsultationRepairService`).
Correr siempre primero con `--dry-run`: imprime ejemplos antes/despues para validar con la
optica. Cada cambio queda en `consultation_legacy_repairs` con el valor anterior; eso permite
`--revert` y evita que una segunda pasada divida dos veces (2500 -> 25.00 -> 0.25). La regla
`subj` (esfera del subjetivo en la columna cilindro) no esta confirmada y solo corre con
`--only=subj`. **No esta aplicado en ninguna instancia todavia**: hasta entonces la BD local
sigue mostrando esferas de -500.

Los importadores leen esas columnas con `App\Support\LegacyOpticalParser`; una importacion
nueva no debe volver a usar `decimal()` sobre una medida optica.

### 15. El service worker no puede cachear datos

`public/sw.js` solo se registra con build de produccion y en contexto seguro (HTTPS o
`localhost`), asi que en `http://sistemaclinico.test` no corre y el fallo no se ve en desarrollo.
Aplicaba "cache primero" a **todo** GET del mismo origen, `/api/*` y `/me` incluidos: cada
pantalla mostraba la respuesta anterior (una consulta recien guardada se reabria con los valores
viejos, y guardarla otra vez los reescribia) y `/me` devolvia un usuario despues de cerrar sesion.

`/api/`, `/sanctum/`, `/storage/`, `/me`, `/login` y `/logout` van siempre a la red
(`isNetworkOnly`). Un endpoint de datos fuera de `/api/` hay que agregarlo ahi, y cualquier
cambio de estrategia exige subir `CACHE_NAME` para purgar lo ya guardado en los navegadores.

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
- **La consulta se abre desde el paciente**: no hay item "Consulta" en el menu. Las rutas
  `/consulta?paciente=ID` y `/consulta/:id` siguen existiendo y son las que usa la ficha.
- **El alta de paciente empieza por la cedula**: `PatientFormPage` no habilita el resto del
  formulario hasta que `GET /api/patients/lookup?cedula=` responde `nuevo`
  (`PatientService::lookupByDocument`). La comparacion no es literal porque la importacion dejo la
  misma cedula escrita de varias formas (sin cero inicial, RUC = cedula + `001`, con letra o un
  digito menos al final); los nombres parecidos (`findSimilarByName`) son la segunda red para los
  importados con codigo provisional `HIST-`/`IMPORT-`. El indice unico de `patients.cedula` cuenta
  tambien a los eliminados, asi que las reglas `unique` de cedula no llevan `whereNull('deleted_at')`.
- **Autocompletado del alta (EcuadorAPI)**: con la cedula en `nuevo`, el formulario pide
  `GET /api/patients/identity` en segundo plano y llena nombre, apellido y fecha de nacimiento
  solo en los campos vacios (`EcuadorApiService`, key en `ECUADORAPI_KEY`). Es pago por consulta
  y **nunca muestra errores**: sin key, sin saldo o con la API caida responde `encontrado: false`.
  Un 401/402/403/429 pausa las consultas hasta una hora (`ecuadorapi:paused` en cache) para no
  sumar espera a cada alta. Solo consulta cedulas validas y sin registrar, y no se loguea la
  cedula ni el mensaje de la excepcion (trae la URL con la cedula).
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
