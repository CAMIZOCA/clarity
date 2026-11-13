# Prompt para construir la web comercial de Clarity

Actúa como estratega de producto, copywriter B2B, diseñador de interfaces y desarrollador frontend. Diseña la página comercial de **Clarity**, un sistema web de gestión para ópticas, optómetras y centros optométricos en Ecuador. Usa este documento como fuente de producto y como guion para el primer HTML. Las decisiones sobre precio, prueba, marca y canales comerciales que siguen abiertas se deben poder ajustar sin rehacer la página.

## 1. Objetivo y posicionamiento

La acción principal es **Solicitar una demostración**. La acción secundaria es **Explorar el sistema**, que lleva a una galería del producto. Para clientes actuales, ofrece **Iniciar sesión** en la navegación si existe una URL confirmada.

La promesa de Clarity es conectar la atención optométrica con la operación de la óptica. Muestra qué sucede cuando recepción encuentra la ficha, el optómetra termina la consulta y el equipo continúa con la venta, la orden de trabajo y la entrega. Este recorrido debe ocupar un lugar central en la página.

| Audiencia | Lo que quiere resolver | Qué mostrarle |
| --- | --- | --- |
| Propietario o gerente de óptica | Saber qué se vendió, qué falta en bodega y qué trabajos siguen pendientes | Reportes, stock, laboratorio y operación por sucursal |
| Optómetra independiente | Recuperar la receta anterior, documentar la consulta y emitir un certificado | Ficha del paciente, historial de refracción, consulta y documentos |
| Equipo de recepción, ventas y caja | Continuar la atención, registrar abonos y responder por el estado de un trabajo | Citas, consultas completadas, punto de venta, saldos y órdenes |
| Encargado de laboratorio | Identificar prioridades, proveedor, fecha estimada y trabajos listos | Tablero de órdenes e historial de estados |

Escribe en español de Ecuador. Usa términos como **historia clínica, receta optométrica, armazones, lunas, bodega y abonos** donde ayuden a entender el producto. Usa verbos concretos. Por ejemplo, «Consulta el saldo de una venta antes de la entrega» expresa una ventaja que se puede mostrar en una pantalla.

## 2. Estructura de la página y copy

### Navegación

Logo Clarity · Cómo funciona · Módulos · En uso · Precio · Preguntas frecuentes · **Solicitar demo**. Coloca **Iniciar sesión** como enlace secundario. En móvil, mantén a mano la acción de demo y usa un menú accesible.

### Inicio

**Texto de contexto**  
Software para ópticas y optómetras en Ecuador

**H1**  
De la consulta a la entrega, toda tu óptica conectada.

**Bajada**  
Gestiona historias clínicas, recetas, ventas, inventario y órdenes de laboratorio desde Clarity. Cada persona de tu equipo puede retomar la atención con la información que necesita.

**Acciones**  
Solicitar una demostración · Explorar el sistema

**Visual**  
Una vista amplia de Clarity con la ficha de un paciente ficticio como punto de partida. Muestra la receta, la venta y el estado de la orden en una composición única. Pie provisional de imagen «Vista ilustrativa del sistema».

### Flujo de trabajo · `#como-funciona`

**H2**  
Cada equipo sabe qué sigue.

**Bajada**  
Encuentra la receta de una consulta anterior, revisa el abono de una venta y confirma cuándo está listo el trabajo, según el rol de cada persona.

1. **Agenda y recibe.** Programa la cita, busca al paciente por sus datos y abre su ficha.
2. **Examina y prescribe.** Revisa el historial, registra el examen visual y guarda la receta final. Recepción puede consultar las atenciones completadas según sus permisos.
3. **Registra la venta y el trabajo.** Selecciona los productos, registra el pago o abono y vincula la orden de laboratorio cuando corresponda.
4. **Da seguimiento hasta la entrega.** Consulta el proveedor, el estado, la fecha estimada y el historial de la orden.

Usa la misma atención ficticia a lo largo de los cuatro pasos para que se entienda cómo viaja la información.

### Módulos · `#modulos`

**H2**  
Herramientas para atender pacientes y gestionar tu óptica.

Usa cuatro grupos de lectura. Da espacio visual a pacientes, consulta, ventas, inventario y laboratorio. Presenta las funciones complementarias en subsecciones compactas con texto rastreable en HTML.

#### Atención optométrica

| Módulo | Qué incluye | Copy comercial |
| --- | --- | --- |
| Pacientes e historia clínica | Registro, búsqueda, antecedentes, citas, consultas, historial de recetas y ventas asociadas | **Abre la ficha y recupera el contexto.** Revisa cómo ha cambiado la receta y qué atenciones quedaron registradas. |
| Consulta y refracción | Examen visual por ojo, queratometría, retinoscopía, recetas en uso, subjetivo, RX final y visión de cerca. Diagnósticos, recomendaciones y campos avanzados según configuración | **Documenta la consulta como la realizas.** Consulta recetas anteriores y registra medidas, diagnósticos y recomendaciones en el mismo flujo. |
| Lentes de contacto y evaluación especializada | Adaptación de lentes de contacto, registro de lentes especiales, oftalmoscopía, pruebas motoras, binoculares y acomodativas y registro de tratamiento | **Conserva el detalle de cada evaluación.** Deja documentados los hallazgos que necesitarás revisar en la próxima visita. |
| Agenda y recepción | Calendario de citas, consultas completadas visibles para recepción y recordatorios de cita por correo con el servicio configurado | **Prepara la jornada y continúa la atención.** Consulta quién tiene cita y qué pacientes ya terminaron su examen. |
| Documentos y servicios complementarios | Certificados visuales en PDF y Word, órdenes de trabajo en PDF, informes de garantía, referencias oftalmológicas, brigadas y catálogos clínicos | **Ten a mano los documentos que pide tu operación.** Emite un certificado visual, registra una referencia o da seguimiento a una garantía. |

#### Ventas, caja, inventario y laboratorio

| Módulo | Qué incluye | Copy comercial |
| --- | --- | --- |
| Ventas y punto de venta | Registro e historial de ventas, productos, descuentos, pagos, abonos, saldos y cancelaciones | **Responde cuánto pagó y cuánto queda pendiente.** Consulta el historial de la venta y los pagos asociados. |
| Caja | Aperturas, cierres, sesiones, gastos y diferencias de caja | **Revisa cómo cerró tu jornada.** Consulta los movimientos de caja y contrasta el efectivo registrado con el cierre. |
| Inventario y proveedores | Productos, variantes, códigos de barras, existencias por bodega, ajustes, transferencias, alertas de stock bajo y proveedores | **Confirma qué armazón tienes y dónde está.** Revisa existencias por bodega y consulta los movimientos antes de reponer o transferir productos. |
| Órdenes de laboratorio | Asociación con paciente, consulta o venta según el flujo, proveedor, medidas, notas técnicas, prioridad, fecha estimada y estados | **Contesta «¿ya están listos mis lentes?» con el estado de la orden.** Consulta trabajos pendientes, fechas estimadas y cambios de estado. |

#### Seguimiento de pacientes

| Módulo | Qué incluye | Copy comercial |
| --- | --- | --- |
| CRM y recordatorios | Campañas, plantillas y recordatorios. WhatsApp puede abrirse con el mensaje preparado para que el equipo pulse enviar. Los avisos de cita por correo pueden programarse con la configuración correspondiente | **Retoma el contacto con el paciente.** Usa una plantilla para preparar un recordatorio y sigue el proceso desde recepción. |

#### Dirección y administración

| Módulo | Qué incluye | Copy comercial |
| --- | --- | --- |
| Reportes clínicos y comerciales | Paneles de gestión, reportes de ventas, inventario, caja y laboratorio. Exportación a Excel en ventas e inventario | **Encuentra qué necesita atención.** Revisa el ticket promedio, el stock bajo o las órdenes atrasadas para decidir qué resolver primero. |
| Sucursales y bodegas | Configuración por ubicación, existencias y reportes por sucursal en los flujos que lo admiten | **Revisa cada local con sus propios datos.** Consulta existencias y resultados por ubicación. |
| Usuarios, roles y configuración | Accesos para administración, optometría, recepción, ventas, caja y laboratorio. Configuración del menú y herramientas administrativas de respaldo | **Dale a cada persona acceso a su trabajo.** Configura los permisos del equipo según su función en la óptica. |

### En uso en Ecuador · `#en-uso`

**H2**  
Un sistema en uso, adaptado a la operación óptica ecuatoriana.

**Bajada**  
Clarity ya se usa en una operación óptica en Ecuador. Su registro de pacientes contempla documentos como cédula, RUC y pasaporte, y su flujo reúne la receta, las lunas, el trabajo de laboratorio y el seguimiento de la entrega.

**Subsección opcional cuando se apruebe el caso**  
«Así usa Clarity Óptica Andina». Cuenta qué proceso necesitaba ordenar, cómo lo trabaja hoy y muestra una pantalla con datos ficticios. Confirma autorización antes de publicar nombre, logo, imágenes o testimonios. Usa resultados cuantitativos únicamente si hay mediciones que la empresa autorice publicar. Hasta entonces, usa el texto general de la sección.

### Galería · `#explorar`

**H2**  
Mira cómo se trabaja en Clarity.

**Bajada**  
Explora las pantallas que usa tu equipo durante una jornada.

| Vista | Qué debe poder leerse en el mockup | Pie de imagen |
| --- | --- | --- |
| Ficha del paciente | Últimas consultas y acceso al historial de recetas | Encuentra la receta anterior desde la ficha. |
| Consulta optométrica | Ojo derecho e izquierdo, RX final y recomendación de lunas | Documenta medidas y recomendaciones en la misma consulta. |
| Agenda y recepción | Citas del día y consultas completadas | Revisa quién está por llegar y quién terminó su atención. |
| Ventas y caja | Productos, abono y saldo de una venta | Consulta qué se cobró y qué queda por pagar. |
| Inventario | Armazón, variante y existencias por bodega | Confirma disponibilidad antes de ofrecer un producto. |
| Laboratorio | Estado de la orden, proveedor y fecha estimada | Revisa el avance del trabajo antes de responder al paciente. |
| Reportes | Indicadores de ventas, stock u órdenes pendientes | Consulta los indicadores que orientan el trabajo del equipo. |

Presenta una pantalla principal y permite cambiar de vista con controles visibles y navegables por teclado. En móvil, recorta el detalle relevante o usa una vista vertical para que los datos sigan siendo legibles. Usa imágenes o interfaces de ejemplo con datos sintéticos. Deja las rutas, textos alternativos y pies preparados para sustituir las imágenes por capturas del producto. Una fotografía discreta de una óptica puede acompañar el bloque de uso en Ecuador. La interfaz de Clarity es el visual principal.

### Precio · `#precio`

**H2**  
Un solo plan para tu óptica.

**Bajada**  
La misma modalidad comercial para optómetras independientes, ópticas y centros optométricos.

| Concepto | Propuesta para la maqueta |
| --- | --- |
| Instalación inicial | **USD 600** · pago único |
| Mantenimiento del sistema | **USD 69 al mes** |

**CTA**  
Solicitar una demostración

En la revisión interna identifica los valores como propuesta. Antes de publicarlos, confirma impuestos, unidad de cobro, momento de inicio de la mensualidad y alcance de ambos conceptos. Redacta dos listas cortas de servicios incluidos cuando se acuerden instalación, alojamiento, actualizaciones, respaldos, soporte, capacitación y migración. El plan único puede tener condiciones acordadas de usuarios y sucursales. Evita inferir que son ilimitados o presentar módulos o servicios adicionales como incluidos hasta confirmarlo.

### Demostración y prueba · `#demo`

**H2 inicial**  
Mira cómo funcionaría Clarity en tu óptica.

**Bajada**  
Cuéntanos qué quieres ver. Podemos recorrer una consulta, registrar una venta o seguir una orden hasta la entrega.

**Formulario**  
Nombre, nombre de la óptica o consultorio, correo y teléfono. Ciudad, cantidad de sucursales, módulos de interés y mensaje opcionales. Incluye un enlace al aviso de privacidad y una aceptación para usar los datos de contacto al responder la solicitud. El formulario es comercial y solo pide información sobre el negocio y la persona de contacto.

**Botón**  
Enviar solicitud

**Confirmación tras un envío real**  
Recibimos tu solicitud. Te contactaremos para coordinar la demostración.

**Variante cuando se habilite la prueba de 60 días**  
«Practica durante 60 días con una ficha de ejemplo. Registra una cita, guarda una receta, simula una venta y sigue una orden de laboratorio». Usa **Solicitar prueba de 60 días** si el equipo entrega el acceso después de recibir la solicitud. Usa **Empezar prueba de 60 días** si el flujo entrega acceso de inmediato. Explica cuándo empiezan los 60 días, qué acceso recibe el prospecto, si hay algún cargo y qué ocurre al finalizar.

### Preguntas frecuentes · `#preguntas`

**¿Para quién está hecho Clarity?**  
Para ópticas, optómetras independientes y centros optométricos en Ecuador que necesitan organizar las consultas y, cuando aplica, las ventas, el inventario y el laboratorio.

**¿Puedo consultar recetas anteriores?**  
Sí. Desde la ficha del paciente puedes revisar su historial. En consulta puedes recuperar una receta anterior como referencia al registrar la receta en uso.

**¿Puedo trabajar con varias sucursales?**  
Sí. Clarity admite sucursales y bodegas. Puedes consultar el inventario por ubicación y dar acceso al equipo según su función.

**¿Puedo registrar una venta con abonos?**  
Sí. El punto de venta permite registrar pagos y consultar el saldo pendiente.

**¿Puedo ver cuándo están listos unos lentes?**  
Puedes consultar el estado de la orden de laboratorio y revisar su proveedor, fecha estimada e historial.

**¿Cómo funcionan los recordatorios?**  
Con el correo configurado puedes enviar recordatorios de cita. En el flujo de WhatsApp, Clarity abre el chat con el mensaje preparado para que el equipo lo envíe.

**¿Puedo emitir certificados visuales?**  
Sí. Puedes generar certificados visuales en PDF y Word desde la información guardada en la consulta.

**¿Puedo traer datos de otro sistema?**  
Publica esta pregunta cuando esté definido el servicio de migración. La respuesta debe indicar cómo se evalúa el archivo de origen, qué datos se pueden importar y si el servicio se cotiza aparte.

**¿Clarity se integra con Contífico o emite facturas autorizadas por el SRI?**  
Incluye esta pregunta si surge en el proceso comercial. Describe la sincronización de datos de contacto como clientes de Contífico únicamente si la configuración se ha probado para la instalación. Explica que la firma y autorización en producción del SRI están pendientes en el sistema actual si necesitas hablar de facturación.

**¿Cuánto cuesta instalar y mantener Clarity?**  
Tras confirmar la oferta, publica «El plan tiene un pago único de USD 600 por instalación y USD 69 al mes por mantenimiento». Añade las condiciones de cobro confirmadas.

**¿Cómo puedo probarlo?**  
«Solicita una demostración y cuéntanos qué parte de tu operación quieres revisar». Actualiza la respuesta cuando esté habilitada la prueba y enlaza al formulario.

### Cierre y pie de página

Coloca el cierre de venta cerca del formulario si el orden final de la página lo permite. Evita pedirle al visitante que recorra dos formularios.

**H2 de cierre**  
Ve cómo se conectan la consulta y la venta en tu óptica.

**Bajada**  
Elige qué quieres revisar en la demo. Recorremos ese proceso contigo, desde la ficha del paciente hasta la entrega.

**CTA**  
Solicitar una demostración

El pie incluye Clarity, navegación breve, contacto comercial confirmado, acceso al sistema si corresponde, aviso de privacidad y términos cuando estén disponibles.

## 3. Dirección visual y de interacción

- Diseña una página de producto con la claridad de una interfaz de Apple como referencia. Usa fondos blancos y gris suave, texto grafito, un acento azul, espacio generoso y una sola pantalla dominante en la portada. Usa la marca propia de Clarity y compón la portada a todo el ancho con el texto y los controles alineados.
- Usa **Inter** para toda la interfaz o **Geist** si encaja mejor con la marca. Define una escala fluida con `clamp()`, limita el ancho de lectura y diferencia con claridad títulos, texto, acciones y pies de imagen.
- Alterna una vista amplia, un flujo ilustrado y bloques con capturas y texto. Usa líneas, espacio y columnas para agrupar módulos. Mantén el precio en un único bloque con una lectura directa del pago inicial y la mensualidad.
- Anima la entrada inicial de texto y producto con una transición breve. En escritorio, deja la pantalla fija durante el recorrido de cuatro pasos si el contenido gana claridad. En la galería, cambia la captura con una transición corta. Respeta `prefers-reduced-motion` y evita el avance automático. En móvil, conserva el mismo orden narrativo con scroll natural.
- Usa HTML semántico, navegación por teclado, foco visible, contraste legible, formularios etiquetados y mensajes de error y confirmación accesibles. La información y las acciones principales deben ser utilizables sin animaciones.

## 4. SEO para Ecuador y opción multidioma

| Elemento | Propuesta |
| --- | --- |
| Título HTML | Software para ópticas en Ecuador \| Clarity |
| Meta descripción | Gestiona historias clínicas, recetas optométricas, ventas, inventario y laboratorio con Clarity, software para ópticas y optómetras en Ecuador. |
| Consulta principal | software para ópticas en Ecuador |
| Variantes comerciales | sistema de gestión para ópticas, software para optómetras, sistema para ópticas y centros optométricos, software de optometría en Ecuador |
| Búsquedas por función | historia clínica optométrica digital, agenda para optómetras, inventario para ópticas, punto de venta para ópticas, órdenes de laboratorio óptico, sistema para ópticas con sucursales |

- Trata esas consultas como hipótesis de búsqueda. Usa cada expresión donde ayude a describir una función. Valida consultas y páginas con Search Console una vez publicado. Escribe títulos y descripciones propios para cada página con contenido independiente. [Guía de SEO de Google Search Central](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).
- Entrega el contenido y los metadatos en el HTML inicial. Usa un H1 principal, H2 por sección, H3 por grupo y enlaces rastreables. Configura la URL canónica y las etiquetas Open Graph cuando exista dominio confirmado. Usa WebP o AVIF, dimensiones explícitas, carga diferida fuera de la portada y textos alternativos descriptivos. [Guía de SEO para sitios con JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
- Empieza con una página en `es-EC`. Si hay contenido suficiente para ampliar el sitio, considera páginas propias como `/historia-clinica-optometrica/`, `/inventario-para-opticas/` y `/ordenes-de-laboratorio-optico/`. Añade al sitemap las URL públicas y canónicas que existan. Verifica que las páginas previstas para indexación estén disponibles en producción.
- Si se aprueba inglés, publica una versión completa en una URL propia, por ejemplo `/en/`. Traduce copy, metadatos, formularios y mensajes. Enlaza las versiones equivalentes con `hreflang` recíproco y canónica propia en cada idioma. Muestra un selector cuando exista una segunda versión navegable. [Guía de versiones localizadas](https://developers.google.com/search/docs/specialty/international/localized-versions).
- Mantén precios, condiciones y datos estructurados consistentes con el texto público. Si se decide usar `SoftwareApplication`, revisa los requisitos de Google para su resultado enriquecido y usa datos comprobables. [Documentación de datos estructurados para software](https://developers.google.com/search/docs/appearance/structured-data/software-app).

## 5. Lo que existe y condiciona la implementación

- En el repositorio, el producto se presenta como **Clarity**. Ya existe una página React y un formulario conectado a Laravel. `POST /demo-request` valida y guarda solicitudes. La entrega de accesos temporales, el vencimiento de la prueba y los cobros requieren definir su flujo. El correo que figura en el contenido actual usa el dominio `.local` y hace falta un destino comercial válido para publicarlo.
- El sistema tiene una base de facturación y generación de XML de prueba. La firma y el envío a producción del SRI están pendientes. Contífico se orienta a crear o vincular un cliente con los datos de contacto del paciente cuando está configurado. Evita promocionarlo como sincronización contable o de facturas.
- La migración depende del sistema de origen y del alcance contratado. Presenta respaldos y permisos como funciones de administración. Incluye en el copy las condiciones de alojamiento, recuperación o soporte después de confirmarlas.
- Si tienes acceso al repositorio, contrasta funciones con `docs/estado-del-sistema.md`, `resources/js/data/landingContent.js`, `resources/js/pages/LandingPage.jsx`, `resources/js/data/menuOptions.js` y `routes/api.php`. Revisa `routes/web.php`, `app/Http/Requests/StoreDemoRequest.php` y `app/Http/Controllers/DemoRequestController.php` para conectar el formulario.

## 6. Preguntas antes de construir

En tu primera respuesta pregunta solo lo que falte de este bloque, priorizando las decisiones que cambian el primer HTML. Con las respuestas disponibles, desarrolla la versión navegable y documenta las decisiones pendientes en las notas de entrega.

1. **Sitio y tecnología.** ¿Quieres un HTML independiente para iterar, una nueva versión de la portada Laravel/React o un sitio separado? ¿En qué dominio se publicaría? ¿Tienes un stack preferido?
2. **Marca y prueba de uso.** ¿Clarity es el nombre comercial definitivo? ¿Hay logo, colores y material de marca? ¿Podemos mencionar a Óptica Andina como caso de uso?
3. **Plan único.** ¿Los USD 600 y USD 69 incluyen impuestos? ¿El cobro es por empresa, instalación o sucursal? ¿Qué cubre cada pago y cuándo se empieza a cobrar la mensualidad?
4. **Demo y prueba.** ¿Empezamos con una demostración coordinada o lanzamos también la prueba de 60 días? ¿Quién habilita el acceso, qué incluye la prueba y qué pasa al finalizar?
5. **Contacto.** ¿Qué correo o WhatsApp atenderá las solicitudes? ¿Se usa el formulario actual, una agenda, un CRM u otro destino? ¿Cuál es la URL del aviso de privacidad?
6. **Idiomas e imágenes.** ¿El lanzamiento es solo en español de Ecuador? ¿Qué pantallas se pueden capturar primero y qué datos ficticios o material de muestra están disponibles?

## 7. Entrega esperada

Si el usuario pide el prototipo antes de cerrar las decisiones, genera `index.html`, `styles.css`, `script.js` y una carpeta `assets/` con las imágenes de ejemplo. Haz que se pueda abrir localmente y que cada sección se pueda editar sin tocar el resto. Usa español de Ecuador, el nombre Clarity, la estructura completa de este documento y los valores propuestos en la versión privada. El primer CTA será **Solicitar una demostración**. En una maqueta sin destino configurado, muestra el estado de prototipo al interactuar con el formulario. Confirma el envío solo después de que el servidor lo acepte.

Si se elige trabajar dentro del producto actual, reutiliza el contenido, componentes y formulario pertinentes. Mantén funcional el acceso de los clientes y entrega la portada con metadatos disponibles en su respuesta HTML. Si la web se aloja en otro dominio, define la conexión del formulario con el destino que corresponda a esa arquitectura.

Comprueba la página en escritorio y móvil. Recorre navegación, CTA, galería, preguntas frecuentes y formulario con ratón y teclado. Verifica acentos, anclajes, sustitución de imágenes, reducción de movimiento y estados de envío. Para publicación, verifica enlaces, dominio, indexación prevista, condiciones comerciales, aviso de privacidad y funcionamiento real de la solicitud.
