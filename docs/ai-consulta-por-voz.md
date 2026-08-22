# Consulta por voz — diseño técnico

Estado: **configuración implementada, captura y transcripción pendientes.**

El objetivo es que el optómetra dicte los datos de la consulta mientras explora al
paciente, sin soltar el equipo ni mirar la pantalla, y que el formulario de
`/consulta` se rellene solo.

---

## Qué ya está implementado

| Pieza | Ubicación |
|---|---|
| Clave de API cifrada en `settings` | `app/Services/OpenAiService.php` (`storeApiKey` / `apiKey`) |
| Enmascarado en la respuesta (`__stored__`) | `app/Http/Controllers/Api/SettingController.php` |
| Pestaña "Inteligencia artificial" | `resources/js/pages/settings/SettingsPage.jsx` |
| Verificación de credenciales | `POST /api/ai/test-openai` → `AiController::testOpenAi` |

La clave se guarda con `Crypt::encryptString` y **nunca** vuelve al frontend. Esto
es deliberadamente distinto de `mail_password`, que quedó en texto plano en la
tabla `settings`; ese caso conviene migrar al mismo esquema más adelante.

---

## Flujo propuesto

```
[Micrófono en la barra de consulta]
        │  MediaRecorder → Blob audio/webm
        ▼
POST /api/ai/transcribe          (multipart, máx. 25 MB)
        │  OpenAI whisper-1, language: "es"
        ▼
   texto plano en español
        │
        ▼
POST /api/ai/extract-consultation
        │  AiService::callClaude() con el catálogo de campos
        ▼
   { campo: valor, ... } + confianza por campo
        │
        ▼
[Modal de previsualización]  ← el médico acepta o descarta campo por campo
        │
        ▼
   setValue() sobre el formulario abierto
```

### 1. Captura de audio (frontend)

- Botón de micrófono en la barra sticky de `ConsultationForm.jsx`, junto a
  "Guardar borrador".
- `navigator.mediaDevices.getUserMedia({ audio: true })` + `MediaRecorder`.
- Formato `audio/webm;codecs=opus` (soportado por Whisper y por Chrome/Edge, que
  es lo que usa la óptica). En Safari hay que caer a `audio/mp4`.
- Indicador de grabación y duración; corte automático a los 5 minutos.
- Requiere contexto seguro (HTTPS). En producción ya lo hay.

### 2. Transcripción — `POST /api/ai/transcribe`

Nuevo método en `OpenAiService`:

```php
public function transcribe(UploadedFile $audio): string
```

- Cliente: `openai-php/client ^0.19.2`, **ya declarado en `composer.json` y sin uso**.
- Modelo `whisper-1`, `language: 'es'`, `response_format: 'text'`.
- Validación: `mimetypes:audio/webm,audio/mp4,audio/mpeg,audio/wav`, `max:25600` (25 MB).
- El archivo temporal se borra en un `finally`, pase lo que pase.
- Permiso requerido: `consultations.create`.
- Timeout de 120 s; audios largos tardan.

### 3. Extracción estructurada — `POST /api/ai/extract-consultation`

**Reutiliza `AiService::callClaude()`** (`app/Services/AiService.php:305`), que ya
está montado, probado y con el SDK de Anthropic configurado. No conviene abrir un
segundo camino hacia otro proveedor sólo para esto.

- Entrada: el texto transcrito + la lista de campos admitidos.
- Salida: JSON `{ campo: valor }` restringido a una lista blanca de nombres de
  campo del formulario (los mismos que ya valida `StoreConsultationRequest`).
- Cualquier clave fuera de la lista blanca se descarta en el servidor.
- Los valores numéricos se normalizan igual que en
  `StoreConsultationRequest::prepareForValidation()` (coma decimal → punto).

Campos candidatos para la primera versión — los de dictado natural:

```
motivo_consulta, observaciones, lente_anterior, diagnostico_adicional,
rx_final_esfera_od|oi, rx_final_cilindro_od|oi, rx_final_eje_od|oi,
rx_final_add_od|oi, avsc_od|oi, avcc_od|oi
```

Deliberadamente **fuera** de la primera versión: diagnósticos con código de
catálogo, recomendaciones y los módulos anidados (lentes de contacto,
oftalmoscopía). Son estructuras relacionales y el margen de error es alto.

### 4. Previsualización obligatoria

**Nunca escribir directo sobre el formulario.** Esto es una historia clínica: un
valor de esfera mal transcrito acaba en una receta.

El modal muestra, por cada campo detectado: etiqueta, valor actual, valor
propuesto y una casilla marcada por defecto. "Aplicar seleccionados" hace
`setValue()` sólo sobre los aceptados. El fragmento de transcripción queda
visible para poder contrastar.

Tras aplicar, el guardado sigue el camino normal (`doSave`), con la validación
clínica del backend intacta.

---

## Riesgos y límites

| Riesgo | Mitigación |
|---|---|
| Transcripción errónea de cifras ("menos dos veinticinco") | Previsualización obligatoria; nunca autoguardar |
| Datos de salud enviados a un tercero | Documentarlo con la clínica antes de activar; la función queda apagada mientras no haya API key |
| Coste por minuto de audio | Corte a 5 min; contador de uso en la pestaña de configuración |
| Audio grande sobre conexión lenta | Límite de 25 MB y aviso de progreso durante la subida |
| Clave de API filtrada | Cifrada en base de datos y enmascarada en la API |

## Orden sugerido de implementación

1. `OpenAiService::transcribe()` + endpoint + test con un audio corto de ejemplo.
2. Botón de grabación y subida (sin extracción): mostrar el texto transcrito en
   un panel. Ya es útil por sí solo para pegar en "Observaciones".
3. Extracción estructurada + modal de previsualización.
4. Métricas de uso y de coste.
