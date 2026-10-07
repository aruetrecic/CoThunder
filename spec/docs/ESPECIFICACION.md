# Especificación: CoThunder

Extensión MailExtension para Thunderbird 140 o superior. Lee el correo abierto, monta un prompt editable con su contenido y lo envía a la web de **Microsoft 365 Copilot** automatizando el chat con la sesión que el usuario ya tiene iniciada. No usa ninguna API ni clave: pilota la interfaz web de Copilot mediante un content script.

Versión de esta especificación: 2.20.0. Corresponde a la versión 2.20.0 de la extensión. La 1.x se basaba en llamadas directas a una API compatible OpenAI/Azure; se sustituyó por completo por automatización de Copilot web al no disponer de acceso a API. La 2.1 añadió selección de agente, plantillas de Thunderbird, respuesta maquetada en Markdown y una ventana de UI redimensionable (ver §17). La 2.2 separa Prompts y Formatos, añade tono/longitud, firma/cita/hilo, blindaje anti-inyección, una biblioteca de plantillas sembrada al instalar y un rediseño de la ventana (ver §18, novedades v2.2). La 2.3 añade el botón "Crear desde Copilot" para redactar correos nuevos desde cero (ver §19). La 2.4 añade la sección "Sobre ti" (perfil del usuario) como contexto del autor en el prompt (ver §21). La 2.7 reorganiza la ventana en pestañas (ver §23). La 2.8 permite descargar cualquier tema y cambiar el estilo desde el editor (ver §24). La 2.9 conserva firma y cita, añade atajos y avisos previos al envío, y unifica la validación (ver §25). La 2.10 añade al editor un menú para insertar plantillas de formato (ver §26). La 2.11 lee el código fuente por bloques y añade «Ordenar» (ver §27). La 2.12 garantiza contraste WCAG AA en temas e interfaz (ver §28). La 2.13 quita los pies con datos personales de plantillas y prompts (ver §29). La 2.14 hace la barra del editor manejable con el teclado y la adapta al tema oscuro (ver §30). La 2.15 añade acciones de un clic, resúmenes, varias versiones, idioma de respuesta, «Mejorar con Copilot», progreso con Cancelar, aviso de sesión caducada, diagnóstico, iconos SVG, asistente de bienvenida y ayuda integrada (ver §31). La 2.16 reorganiza la página de Opciones en pestañas (ver §32). La 2.17 exporta correos a Markdown (descarga o envío a Copilot/agente) y mejora la detección de agentes, con alta manual por enlace (ver §33). La 2.18 muestra el estado de Copilot al abrir la ventana y lo abre automáticamente (ver §34). La 2.19 mejora la usabilidad de la ventana: indicaciones libres, foco de vuelta tras enviar, mensajes completos y un solo estado (ver §35). La 2.20 usa iconos Fluent en la interfaz y añade un selector de emoji para el texto (ver §36).

Plataforma objetivo: Thunderbird ESR 140 (probado en 140.11.1), **Manifest V3**. Decisión explícita del proyecto; ver §2 y el riesgo asociado en §15.

## 1. Alcance

Qué hace:

- Para el correo mostrado, monta un prompt (instrucción + remitente + asunto + cuerpo) que el usuario puede editar antes de enviar, en una **ventana propia redimensionable** que abre el botón del visor.
- Permite elegir un **agente** de Copilot (además de Copilot por defecto) y una **plantilla** de las carpetas de Plantillas de Thunderbird (§17).
- Abre Microsoft 365 Copilot dentro de Thunderbird, escribe el prompt y lo envía, seleccionando antes el agente elegido y opcionalmente empezando un chat nuevo.
- Captura la respuesta de Copilot y abre una ventana de composición HTML con ella como respuesta al remitente, **maquetada en Markdown** (§17).

Qué no hace:

- No usa ninguna API ni clave. No hay endpoints, ni Azure, ni tokens.
- No envía correos automáticamente. La decisión final es siempre del usuario.
- No inicia sesión por ti. Reutiliza la sesión de Copilot ya iniciada en el perfil de Thunderbird; la primera vez puede requerir login manual.
- No incrusta Copilot en un iframe: Microsoft lo bloquea con `X-Frame-Options`/CSP. Por eso se usa una ventana/pestaña propia con content script, no un iframe.
- No soporta adjuntos ni imágenes: solo el cuerpo textual del mensaje.

## 2. Requisitos de plataforma

- Thunderbird ESR 140.0 o superior. `strict_min_version: "140.0"`.
- **Manifest V3** con bloque `browser_specific_settings.gecko` (no `applications`, deprecado y con advertencia en MV3), id `cothunder@local`.
- API WebExtension de Thunderbird via el objeto global `messenger`.
- Background como **event page** (`background: { scripts: [...] }`; Thunderbird/Firefox usan event pages en MV3, no service workers). En MV3 el background es no persistente por definición: **no declarar `persistent`** (da advertencia). Consecuencia: el estado en memoria (p. ej. el id de la ventana de Copilot) puede perderse cuando el background se descarga; hay que persistirlo (`storage.session`/`storage.local`) y reconstruirlo.
- **Registro del content script en runtime**, no declarativo: en MV3 no existe el key `content_scripts`. Se registra desde el background con la API de scripting disponible en la plataforma (`scripting.registerContentScripts` o, en su defecto, `contentScripts.register`). Requiere el permiso correspondiente (`scripting`) y el host permission de Copilot. **A validar en el spike (§15.1).**
- Permisos: `accountsRead` (carpetas/plantillas), `messagesRead`, `compose`, `storage`, `scripting`, `notifications` (aviso si falla la captura), `menus` (menú contextual «CoThunder», §31.1), y `host_permissions` con el dominio de Microsoft 365 Copilot (no `<all_urls>`: el destino es un dominio fijo y configurable). En MV3 `host_permissions` es un key separado de `permissions`.
- El content script solo actúa sobre páginas cargadas en **pestañas**; Copilot debe abrirse como pestaña o como ventana que aloje una pestaña web (ver §8.1).
- JavaScript vanilla, `"use strict"` en todos los ficheros. Sin dependencias externas en runtime.

## 3. Estructura de ficheros

```
manifest.json
common.js
background.js
content-copilot.js
icon.svg
popup/
  popup.html
  popup.css
  popup.js
options/
  options.html
  options.js
```

`common.js` se carga en el background (via `background.scripts`) y en el popup (via `<script src="../common.js">`), de modo que la configuración, la extracción del cuerpo y la construcción del prompt existen una sola vez. `content-copilot.js` se inyecta únicamente en el dominio de Copilot via `content_scripts`.

## 4. manifest.json

- `manifest_version`: 3
- `name`: "CoThunder"
- `description`: descripción breve en español del comportamiento.
- `version`: SemVer, empieza en "2.0.0".
- `browser_specific_settings.gecko`: id `cothunder@local`, `strict_min_version: "140.0"`.
- `background`: `{ "scripts": ["common.js", "background.js"] }` (event page; sin `persistent` en MV3).
- `message_display_action`: botón en la barra del visor de mensajes. `default_title` "Preguntar a Copilot", `default_popup` "popup/popup.html".
- `permissions`: `["messagesRead", "compose", "storage", "scripting"]`.
- `host_permissions`: `[<patrón del dominio de M365 Copilot>]` (key separado en MV3).
- `options_ui`: `options/options.html`, `open_in_tab: false`.
- `icons`: 32 y 64 apuntando a `icon.svg`.

**Sin key `content_scripts`** (no existe en MV3). El content script `content-copilot.js` se registra en runtime desde el background (§8), con `matches` al dominio de Copilot. Como Microsoft cambia esas URLs, el patrón por defecto se documenta aquí y la URL de apertura es configurable (§10); al registrarse en runtime, el patrón puede recomputarse desde la configuración sin tocar el manifest. El host permission sí es estático en el manifest.

## 5. Configuración (common.js)

Objeto `DEFAULTS` con estas claves, persistido en `messenger.storage.local`:

| Clave | Tipo | Por defecto | Significado |
|---|---|---|---|
| copilotUrl | string | URL del chat de M365 Copilot | Página que se abre en la ventana lateral |
| promptTemplate | string | ver abajo | Plantilla del prompt con marcadores |
| newChatByDefault | boolean | true | Estado inicial del check "Empezar chat nuevo" |

Plantilla por defecto (`promptTemplate`), con marcadores que `buildPrompt` sustituye:

```
Redacta una respuesta profesional y cordial a este correo, en el mismo idioma del mensaje. Responde solo con el cuerpo del correo, sin asunto ni explicaciones.

De: {{author}}
Asunto: {{subject}}

{{body}}
```

`getConfig()` devuelve `messenger.storage.local.get(DEFAULTS)`, de forma que las claves ausentes toman el valor por defecto.

## 6. Extracción del cuerpo (common.js)

Función `extractBody(messageId)`:

1. Obtiene el mensaje completo con `messenger.messages.getFull(messageId)`.
2. Recorre recursivamente `parts` buscando primero `text/plain`; si no hay, toma `text/html` y lo convierte a texto.
3. La conversión HTML a texto usa `DOMParser`, elimina nodos `style`, `script` y `head`, y devuelve `textContent` del body normalizando espacios.
4. Trunca el resultado a un máximo razonable (orden de 12000 caracteres) para no desbordar el contexto del modelo. El truncado corta por el final e indica "[correo truncado]".
5. Devuelve cadena vacía si no hay parte textual legible; el llamador decide el mensaje de error.

## 7. Construcción del prompt (common.js)

Función `buildPrompt(message, body, template)`:

1. Sustituye en `template` los marcadores `{{author}}` (`message.author`), `{{subject}}` (`message.subject`) y `{{body}}` (cuerpo extraído).
2. Devuelve el texto resultante. No hace ninguna llamada de red: solo compone la cadena que el usuario verá y podrá editar.

## 8. Background (background.js)

Gestiona la ventana lateral de Copilot y hace de puente entre el popup y el content script.

- **Registro del content script:** al arrancar (y tras cambios de configuración de la URL), registra `content-copilot.js` sobre el dominio de Copilot mediante la API de scripting (§2). Idempotente: comprueba/actualiza el registro, no lo duplica.
- **Event page no persistente:** el background puede descargarse entre eventos. El id de la ventana de Copilot y el `messageId` en vuelo (fase 2) se persisten (`storage.session`) y se reconstruyen; no se confía en variables de módulo entre invocaciones.
- **Ventana lateral única:** mantiene el id de la ventana/pestaña de Copilot. Al recibir una petición, si no existe la crea (§8.1) y si existe la enfoca. No abre múltiples instancias.
- **Handshake:** la SPA de Copilot tarda en cargar. El background no asume que el content script está listo: le manda el prompt con reintentos (p. ej. cada 500 ms hasta ~30 s) hasta recibir confirmación, o bien el content script anuncia "listo" al cargar y el background entrega en cuanto lo esté. Si se agota el tiempo, informa al popup.
- **Listener `runtime.onMessage`:**
  - `sendToCopilot { prompt, newChat }`: asegura la ventana, entrega el prompt al content script, devuelve el resultado (ok / error legible).
  - **Fase 2** `copilotReply { text }` (emitido por el content script): abre `messenger.compose.beginReply(...)` con el texto capturado (§11).

### 8.1 Apertura de la ventana lateral

Preferencia: `messenger.windows.create({ type: "popup", url: copilotUrl, ... })` colocada a un lado. Fallback: `messenger.tabs.create({ url: copilotUrl })` reutilizando la pestaña. El spike confirmó que `messenger.tabs.create` con la URL externa de Copilot funciona en TB 140 y el content script se inyecta; queda por confirmar la variante `windows.create` popup, pero el content script y el protocolo de mensajes son iguales en ambas.

## 9. Content script (content-copilot.js)

Se inyecta solo en el dominio de Copilot. Toda la dependencia del DOM de Copilot vive aquí y con **selectores centralizados** en un único objeto `SELECTORS` al principio del fichero, para poder actualizarlos en un solo sitio cuando Microsoft cambie la interfaz.

Selectores reales descubiertos en el spike (M365 Copilot, 2026-07-06), sujetos a cambio por Microsoft:

```js
const SELECTORS = {
  editor: "#m365-chat-editor-target-element",                 // editor Lexical (contenteditable, id estable)
  sendButton: "button.fai-SendButton, button.fai-ChatInput__send",  // solo existe cuando hay texto
  newChat: '[data-testid=\"newChatButton\"]',
  reply: '[data-testid=\"markdown-reply\"]',                  // texto limpio de la respuesta (el último)
  loading: '[data-testid=\"loading-message\"]'                // presente mientras Copilot genera
};
```

Al recibir del background `{ prompt, newChat }`:

1. Si `newChat`, localiza y pulsa `SELECTORS.newChat` y espera (~800 ms) a que el editor quede listo.
2. Escribe en el editor Lexical. **Método validado:** colocar el cursor al final y disparar **un único** evento `beforeinput` con `{ inputType: "insertText", data: prompt }`. Disparar además `input` duplica el texto; asignar `textContent` no lo registra; `execCommand("insertText")` y un evento `paste` sintético no funcionaron de forma fiable. Conviene limpiar antes el editor (seleccionar todo + `execCommand("delete")`).
3. Pulsa `SELECTORS.sendButton` (que solo aparece una vez hay texto).
4. Responde al background con éxito. **Fase 2:** guarda el número de elementos `SELECTORS.reply` antes de enviar (baseline) y, en segundo plano, espera a que aparezca uno nuevo, desaparezca `SELECTORS.loading` y el texto del último se estabilice (~1,5 s sin cambios); entonces extrae `textContent` del último `SELECTORS.reply` y emite `copilotReply { text }`. Timeout de seguridad (~120 s).

Degradación robusta (§12): si no encuentra el editor o el botón (interfaz cambiada, o sesión no iniciada), no falla en silencio: lo comunica al background con un motivo, y el flujo cae al portapapeles.

## 10. Popup (popup/) — botón del visor

UI compacta (~420 px) con:

- Textarea editable, prellenado con `buildPrompt(...)` del correo mostrado.
- Check "Empezar chat nuevo", inicializado con `newChatByDefault`.
- Botón primario "Enviar a Copilot".
- Línea de estado (enviando / enviado / error) con punto de color.

Comportamiento (popup.js):

1. Al abrir, localiza la pestaña activa y usa `messenger.messageDisplay.getDisplayedMessages(tab.id)` (plural; en TB 140 el singular `getDisplayedMessage` ya no existe), cogiendo el primer mensaje de la lista. Sin mensaje: estado de error "No hay ningún correo abierto en esta pestaña" y sin botón de envío.
2. Extrae el cuerpo, construye el prompt con la plantilla de la configuración y lo muestra editable.
3. "Enviar a Copilot": manda `sendToCopilot { prompt, newChat }` al background con el texto actual del textarea (ediciones incluidas). Estado enviando; al confirmar, enviado y cierra; si error, estado de error con el motivo.

Estilos (popup.css): `color-scheme: light dark`, fuente system-ui ~13 px, bordes con `color-mix` sobre `currentColor` para tema claro y oscuro, acento #1a5fb4.

## 11. Composición (fase 2)

Al recibir `copilotReply { text }`, el background abre `messenger.compose.beginReply(messageId, "replyToSender", { body })` en **composición HTML** (para conservar la barra de formato y los complementos activos, que no aparecen en texto plano). El texto de Copilot se pega "tal cual": escapado y con los saltos de línea convertidos a `<br>` (los signos Markdown quedan literales, sin renderizar). El usuario revisa, edita y decide enviar. Requiere retener el `messageId` de origen desde el envío del prompt hasta que llega la respuesta. Alternativa no implementada: renderizar el Markdown a HTML real (§16).

## 12. Seguridad y protección de datos

- El contenido de los correos solo viaja a Microsoft 365 Copilot, el mismo destino al que el usuario ya envía datos al usar Copilot. Ninguna otra red, ninguna telemetría, ningún tercero.
- **Relevante para RGPD:** enviar el cuerpo de correos a Copilot implica un tratamiento por parte de Microsoft sujeto a los acuerdos de tu organización. Documentar cualquier cambio en el flujo de datos. La ventana muestra siempre lo que se envía (prompt editable) antes de enviarlo.
- Sin `eval`, sin `new Function`. En la UI propia (popup/options) no se usa `innerHTML` con contenido de correos ni de Copilot: el cuerpo se procesa solo con `DOMParser` para extraer texto y se muestra en un `textarea` (`value`, no HTML).
- El content script interactúa con el DOM de Copilot mediante selectores y eventos; no inyecta HTML remoto en páginas propias.
- **Degradación segura:** si la automatización falla (interfaz cambiada, sin sesión), el prompt se copia al portapapeles y se enfoca la ventana de Copilot para pegar a mano. Nunca se pierde el trabajo ni se queda en silencio.

## 13. Empaquetado

El entregable es `cothunder-<version>.xpi`: zip de la raíz del proyecto excluyendo ficheros ocultos, `docs/`, `CLAUDE.md`, `.claude/` y cualquier `.xpi` previo. El manifest debe validar como JSON y todos los JS deben pasar `node --check` antes de empaquetar. Instalación: Herramientas, Complementos, Instalar complemento desde archivo.

## 14. Criterios de aceptación

1. La extensión instala en Thunderbird 115+ sin advertencias de manifest.
2. Sin correo abierto, el popup muestra un error claro, no una excepción silenciosa.
3. Con sesión de Copilot iniciada, pulsar el botón en un correo abre (o enfoca) la ventana lateral de Copilot, escribe el prompt y lo envía; la respuesta aparece en esa ventana.
4. El check "Empezar chat nuevo" controla si Copilot arranca conversación nueva o continúa la actual.
5. Un correo solo HTML produce un prompt con texto limpio, sin restos de etiquetas ni estilos.
6. Si la automatización no encuentra el cuadro de chat (sesión no iniciada o interfaz cambiada), el prompt acaba en el portapapeles y se avisa al usuario; no hay fallo silencioso.
7. **Fase 2:** al terminar Copilot, se abre composición en texto plano al remitente con la respuesta capturada.

## 15. Riesgos conocidos

### 15.1 Registro del content script en MV3 (spike bloqueante) — RESUELTO EN VERDE

En MV3 no hay `content_scripts` declarativo y la API `scripting` no aparece en la documentación de APIs soportadas de Thunderbird. El spike lo validó en TB 140.11.1 (2026-07-06): **`messenger.scripting.registerContentScripts` funciona**, el content script se inyecta en el chat de Copilot, y `messenger.tabs.create` abre la URL externa dentro de Thunderbird. URL real del chat: `https://m365.cloud.microsoft/chat/`. No hace falta recurrir a `contentScripts.register` ni reconsiderar MV2. Observación: el content script se inyecta más de una vez por los redirects de carga de la página; los manejadores deben ser idempotentes.

### 15.2 Otros riesgos

1. **Alojar Copilot en ventana popup** (§8.1): el content script solo actúa sobre páginas en pestañas; a validar con spike si la ventana popup aloja una pestaña web válida. Fallback a pestaña normal.
2. **Selectores del DOM de M365 Copilot**: no documentados y cambiantes. Centralizados en `content-copilot.js` para actualización rápida. Es la fragilidad intrínseca del enfoque.
3. **SSO corporativo**: la primera vez puede exigir login manual en la ventana; después las cookies del perfil de Thunderbird persisten la sesión.
4. **Captura de respuesta (fase 2)**: depende de detectar el fin del streaming; sujeta a la misma fragilidad de selectores.
5. **Event page no persistente**: perder estado en memoria si el background se descarga; mitigado persistiendo en `storage.session` (§8).

## 16. Mejoras candidatas (no incluidas)

- ~~Selección de tono por correo (formal, breve, negativa cordial).~~ Implementado en v2.2 (§18.2).
- ~~Soporte de hilos (incluir mensajes anteriores en el prompt).~~ Implementado en v2.2 (§18.3).
- Atajo de teclado e internacionalización de la UI con `_locales`.
- **Imágenes reales** en el prompt: no factible con la inyección de texto actual (solo se incluye el `alt` de las imágenes); requeriría pegar datos de imagen en Copilot.
- **Panel completo de agentes**: hoy solo se listan los agentes fijados en la barra lateral (id estable); los del panel "Ver más" no tienen id y su selección sería frágil (§17).
- **Renderizado propio de Markdown**: red de seguridad si Copilot no coopera con el formato; hoy se confía en el prompt y en el complemento del usuario.

## 17. Novedades v2.1

### 17.1 Ventana de UI del botón

El botón `message_display_action` ya no abre un popup (limitado a 800×600 y no redimensionable): usa `messageDisplayAction.onClicked`, obtiene el `messageId` del correo mostrado y abre `popup/popup.html` en una **ventana propia** con `messenger.windows.create({ type: "popup", width: 800, height: 800, allowScriptsToClose: true })`, pasando `?messageId=` en la URL. La UI llena la ventana (flex column) y solo el `textarea` hace scroll. El popup obtiene el correo con `messenger.messages.get(messageId)`.

### 17.2 Agentes

El content script enumera los agentes **fijados en la barra lateral** de Copilot: `document.querySelectorAll(".fai-CopilotNavSubItem")`, filtrando por id de agente (`/^[PT]_/` o que contenga `agent`/`gpt`) para descartar el historial de chats, que comparte clase. Guarda `[{id, label, source}]` en `storage.local` (al cargar, a los 3 y 8 s, y cada 60 s), y responde a `getAgents`. El popup rellena el desplegable (recordando `lastAgentId`), con un botón de refresco que dispara `refreshAgents` (background → `getAgents`). Al enviar, el content script selecciona el agente con `document.getElementById(id)` (o por `aria-label`) antes de escribir; la escritura reintenta y verifica, porque al cambiar de agente el editor se rehace. El panel completo "Ver más" se descarta por frágil (§16).

### 17.3 Plantillas

Lee las plantillas de las carpetas de tipo templates de Thunderbird: `messenger.folders.query({ specialUse: ["templates"] })` (todas las cuentas, incluida Carpetas locales) y `messenger.messages.list(folderId)` con paginación por `continueList`. Cada plantilla es un mensaje (`subject` = nombre, cuerpo = contenido). Requiere el permiso `accountsRead`. Al elegir una, el popup lee su cuerpo conservando el Markdown fuente (`extractTemplateBody`, prioriza texto plano) y monta un prompt (`buildTemplatePrompt`) que combina el **correo original + la plantilla en Markdown + el conocimiento del agente**: rellena huecos/marcadores o sigue el formato de la plantilla.

### 17.4 Maquetación Markdown

Una guía compartida (`MARKDOWN_STYLE`) y una directiva (`MARKDOWN_INSTRUCTION`) se añaden **siempre** en `buildPrompt` y `buildTemplatePrompt` (no dentro de la plantilla editable, para que una plantilla guardada antigua no las anule). Se pide devolver el cuerpo como código fuente Markdown dentro de un bloque ```` ```markdown ```` (para capturarlo con los signos) y maquetar siempre con un mínimo concreto: saludo como encabezado, despedida en negrita, lo importante en cita, negrita para lo clave y listas en enumeraciones; creativo pero sin recargar. La respuesta se abre en composición **HTML** (`beginReply` con `body`), compatible con el complemento del usuario (p. ej. Markdown Here Revival).

### 17.5 Endurecido de la captura

Cada respuesta viaja con su `messageId` de ida (popup → background → content script) y vuelta (`copilotReply { text, messageId }`), eliminando el `pendingMessageId` único: dos envíos simultáneos ya no cruzan la respuesta de correo. Si `waitForReply` no captura texto, el background muestra una notificación (el popup ya se cerró).

## 18. Novedades v2.2

### 18.1 Ventana de UI adaptada

La ventana del botón se abre **compacta y centrada** (600×560), redimensionable, pensada para caber en 1080p y comportarse igual en pantallas de distinta resolución o con escalado del SO. `popup.js` la sitúa con `windows.getCurrent` + `windows.update` usando `screen.availWidth/Height`, y **recuerda tamaño y posición** en `storage.local` (`winBounds`), guardando con rebote al redimensionar/mover y en `pagehide`. Al reabrir, encaja los límites guardados dentro del área visible actual. Tras enviar, la ventana ya **no se cierra sola** (permite regenerar).

### 18.2 Prompt compuesto: Prompts, Formatos, tono y longitud

El prompt se arma en `buildComposedPrompt(message, body, opts)` combinando, en orden: (1) el **blindaje anti-inyección** (§18.4), (2) el **Prompt** prioritario del usuario, (3) el **hilo** anterior (§18.3), (4) la instrucción base + correo (`buildPrompt`), (5) el **Formato** de referencia, (6) **tono/longitud** (`toneLengthInstruction`) y (7) la maquetación Markdown (`MARKDOWN_INSTRUCTION` + `MARKDOWN_STYLE`). Cada bloque se separa con una **línea divisoria** (`SECTION_SEP`) para que el usuario localice y edite las partes con facilidad en el `textarea`.

Prompts y Formatos son **plantillas de Thunderbird distinguidas por el asunto**: `Prompt - Título` (instrucción prioritaria) y `Formato - Título` (referencia de estructura; también las plantillas sin prefijo). El popup las reparte en dos desplegables. Tono (formal / cercano / directo / negativa cordial) y longitud (breve / normal / detallada) se eligen en la ventana y se recuerdan en `storage.local`.

### 18.3 Firma, cita e hilo

Tres casillas controlan qué se añade a la respuesta, recordadas como preferencias:

- **Incluir mi firma**: al componer la respuesta, se añade la firma de la identidad (`identities.get`, `signature`/`signatureIsPlainText`), en vez de dejar que `beginReply` con `body` la elimine.
- **Incluir el correo citado**: añade la cita del original (del `body` de la composición, sin la `.moz-signature` para no duplicarla).
- **Incluir el hilo**: `buildThreadContext` reconstruye la conversación anterior siguiendo las cabeceras `References` e `In-Reply-To` (`messages.getFull` → `messages.query({ headerMessageId })`), toma hasta 10 ancestros (2000 caracteres cada uno), los ordena cronológicamente y los aporta como *CONTEXTO DEL HILO*. Se carga con caché al marcar la casilla, avisa si el correo no tiene hilo previo y **también se revisa contra inyección**. No requiere permisos nuevos (`messagesRead`).

### 18.4 Blindaje anti-inyección

Como la extensión lee correos recibidos de terceros, el contenido entrante se trata como **datos, nunca como instrucciones**. Dos capas, en `common.js`:

- **Píldora en el prompt** (`INJECTION_GUARD`): se antepone **siempre** (con o sin Prompt seleccionado). Ordena a Copilot ignorar y señalar cualquier intento incrustado en el correo o el hilo de cambiar su rol, anular indicaciones, revelar su *system prompt*, cambiar objetivo o formato, o plantear escenarios para saltarse límites.
- **Detección local** (`detectInjection` + `INJECTION_PATTERNS`): escanea el cuerpo y el hilo con patrones de seis categorías y severidad (rol/anulación/divulgación = crítico; override de formato/cambio de objetivo = alto; contexto hipotético = medio). El popup **avisa** antes de enviar sin bloquear la acción del usuario, que es quien revisa y decide.

### 18.5 Biblioteca de plantillas sembrada

Al instalar (`runtime.onInstalled`, `reason === "install"`), `seedTemplates` crea una biblioteca de ejemplos de Prompts y Formatos en la carpeta de plantillas (`folders.query` templates + `messages.import` de un EML con asunto codificado RFC 2047, marcado leído), deduplicando por asunto. Incluye un **Formato - Identidad UPO** adaptado a correo (estructura institucional y guía de marca: azul #003772 / amarillo #FCC100 como acento puntual, tipografía Franklin Gothic o Arial; sin inventar colores ni tipografías). Requiere el permiso `messagesImport`.

### 18.6 Rediseño de la ventana

Cabecera con **logo de Copilot + "Preguntar a Copilot"** y el estado (punto + texto) alineado a la derecha, y un botón **"?"** que abre la guía de uso en Opciones. Los campos llevan **título en negrita con icono** (🤖 Agente, ⭐ Prompt, 📄 Formato, 🎭 Tono, 📏 Longitud, ✍️ Prompt a enviar), con Prompt/Formato y Tono/Longitud en rejilla de dos columnas. Sobre el `textarea`, una **mini barra Markdown** inserta formato (negrita, cursiva, encabezado, listas, cita, código, enlace). El botón **Regenerar** reenvía el prompt en un chat nuevo para otra versión; "Enviar" (azul) y "Regenerar" (verde teal) van en color sólido con el texto en negrita.

## 19. Crear desde Copilot — Fase 1 (v2.3)

Añade un segundo botón para **redactar correos desde cero** (no una respuesta), reutilizando el popup. Es la Fase 1 de una suite de creación mayor (Fase 2: botón en la ventana de redacción con "Crear" y "Mejorar"; Fase 3: pulido), aquí solo se especifica la Fase 1.

### 19.1 Botón y modo

Un botón `action` en la **barra principal** de Thunderbird (icono de Copilot, título "Crear desde Copilot"), independiente de que haya un correo abierto. Al pulsar abre `popup/popup.html?mode=create` en la misma ventana propia (`windows.create`, redimensionable y con memoria de tamaño, como §18.1); no lleva `messageId`. Al tener más campos que el modo respuesta, **abre más alto por defecto** (≈620×760 frente a 600×560) y recuerda su tamaño **por separado** (`winBoundsCreate`, distinto de `winBounds` del modo respuesta). El popup lee `mode` de la URL (`reply` por defecto, `create` en este botón) y ajusta la UI y el flujo. **No requiere permisos nuevos**: `action` no lleva permiso propio y `compose` (para `beginNew`) ya está declarado.

### 19.2 UI en modo creación

Reutiliza tal cual: 🤖 Agente, ⭐ Prompt, 📄 Formato, 🎭 Tono, 📏 Longitud, editor Markdown, "Empezar chat nuevo", "Incluir mi firma" y "Regenerar". **Oculta** las opciones propias de respuesta ("Incluir el correo citado" e "Incluir el hilo"), que no aplican sin correo de origen. **Añade**:

- 🌐 **Idioma** de salida (Automático / Español / Inglés / …): fuerza el idioma del correo generado.
- 👤 **Contexto / notas** (texto libre): propósito, puntos a incluir o a quién va dirigido; enriquece el prompt (no es el destinatario del correo, que se fija abajo).
- ✉️ **Para**, 📋 **CC** y 🕶️ **CCO** (opcionales): tres `textarea` independientes apilados; cada uno admite **varias direcciones**, una por línea o separadas por comas/punto y coma. `parseRecipients` filtra las válidas y se fijan en `to`/`cc`/`bcc` del correo nuevo.
- 📝 **¿Qué quieres crear?** (`textarea` propio): la instrucción base de la creación; **crece con la ventana** (campo dominante en modo creación) y tiene su **propia mini barra Markdown** (independiente de la del prompt: cada barra edita su `textarea` y no le roba el foco al otro). Se mantiene el `textarea` **"Prompt a enviar"** como prompt compuesto y editable (con la separación en bloques de §18.2), en vez de reetiquetar el principal, para conservar el modelo de respuesta y la edición por bloques.

Las preferencias del modo creación (tono, longitud, idioma, firma) se recuerdan por separado de las del modo respuesta. La ventana rotula su cabecera y `document.title` como **"Crear desde Copilot"** (frente a "Preguntar a Copilot" del modo respuesta), para que se distinga claramente de la del visor.

**Plantillas específicas de creación.** El desplegable ⭐ Prompt es sensible al modo: en creación muestra solo las plantillas con asunto `Prompt crear - …`; en respuesta, las `Prompt - …`. El desplegable 📄 Formato se **comparte** entre modos (los formatos son estructurales). La biblioteca sembrada al instalar incluye un juego de `Prompt crear - …` (convocatoria, invitación, comunicado, solicitud, presentación, agradecimiento, felicitación, recordatorio, propuesta comercial, boletín) y formatos de creación (convocatoria, invitación). La siembra se ejecuta al **instalar y al actualizar** (idempotente por asunto).

### 19.3 Prompt de creación

`buildCreatePrompt` compone, en orden: la píldora anti-inyección (relajada, ya que el contenido es del propio usuario), el Prompt prioritario, la **instrucción de creación** con el contexto/idioma, el Formato de referencia, tono/longitud, y una directiva Markdown específica `MARKDOWN_INSTRUCTION_CREATE` que pide **asunto y cuerpo**: primero una línea `Asunto: …` con un asunto breve y, a continuación, el cuerpo como código fuente Markdown sin renderizar dentro de un único bloque ```` ```markdown ````. Se mantiene la separación en bloques con `SECTION_SEP` (§18.2) para editarlo con facilidad.

### 19.4 Captura y composición

El content script captura la respuesta igual que en modo respuesta (`waitForReply`, misma tubería y selectores centralizados). En modo creación, el background **separa la línea `Asunto:` del cuerpo Markdown** y abre `messenger.compose.beginNew({ subject, to, cc, bcc, isPlainText: false })` en composición **HTML**. Los destinatarios y el asunto se pasan **al abrir** (`beginNew`), porque `setComposeDetails` no los aplica de forma fiable; cada campo pasa por `parseRecipients` (varias direcciones, descarta las inválidas). El **cuerpo** y la **firma** de la identidad por defecto (si "Incluir mi firma" está marcado) se ponen después con `setComposeDetails`. La correlación de ida y vuelta usa un `requestId` generado (no hay `messageId`). Degradación idéntica a §17.5: si `waitForReply` no captura texto, se copia el prompt al portapapeles y se notifica.

### 19.5 Reutilización

Sin cambios en `content-copilot.js` ni nuevas dependencias del DOM de Copilot: la única diferencia respecto a la respuesta es la construcción del prompt (`buildCreatePrompt`) y el destino final (`beginNew` en vez de `beginReply`). El popup es el mismo, parametrizado por `mode`.

## 20. Privacidad y trazabilidad (v2.3)

Refuerzos orientados a RGPD y al Esquema Nacional de Seguridad (ENS), aplicables a los dos modos.

### 20.1 Aviso de tratamiento

La primera vez que se abre la ventana, un aviso informa de que el contenido del correo se envía a Microsoft 365 Copilot para generar la respuesta y de que no se usa ninguna otra red ni se guarda nada fuera del equipo. Al aceptarlo (`Entendido`) se marca `privacyAck` en `storage.local` y no vuelve a mostrarse. Es informativo (no bloquea), para dejar constancia del tratamiento sin añadir fricción.

### 20.2 Registro de actividad local (opcional)

Desactivado por defecto. Si se activa en Opciones (`auditEnabled`), el background registra en `storage.local` (`auditLog`, máximo 500 entradas, FIFO) solo **metadatos** por cada envío: fecha ISO, modo (`create`/`reply`), número de destinatarios en creación y resultado (`ok`/`error`). **Nunca** guarda el asunto, las direcciones ni el cuerpo. Desde Opciones se puede **exportar** a JSON y **vaciar**. Cubre la dimensión de Trazabilidad del ENS sin introducir contenido sensible en el almacenamiento.

### 20.3 Utilidades comunes y calidad

`escapeHtml`/`escapeHtmlWithBreaks` centralizan el escapado HTML (antes duplicado). `parseRecipients` admite el formato «Nombre <correo>» y deduplica. La biblioteca de plantillas se siembra una sola vez por versión (`seededVersion` / `SEED_VERSION`) para respetar las plantillas borradas por el usuario. La lógica pura se prueba con `node --test` (carpeta `test/`, fuera del paquete).

## 21. Perfil del usuario ("Sobre ti", v2.4)

El usuario de Thunderbird es el mismo que el de Copilot, así que su perfil enriquece el contexto sin coste de privacidad adicional (ya usaba Copilot).

### 21.1 Datos y persistencia

Sección "Sobre ti" en Opciones con cinco campos: **Nombre**, **Puesto o cargo**, **Organización**, **Sobre mí (qué hago)** y **Cómo escribo (estilo)**. Se guardan en `storage.local` bajo `userProfile` (`{ name, role, org, about, style }`) y persisten entre sesiones. Un botón **"Tomar de mi identidad de Thunderbird"** rellena nombre y organización (desde la v2.13 **no** copia la firma: ver §29) desde la identidad por defecto (`identities.list()[0]`), solo en los campos vacíos.

### 21.2 Inyección en el prompt

`buildUserContext(profile)` monta un bloque **"CONTEXTO DEL AUTOR"** (o `""` si no hay datos) que el popup añade en ambos modos: en `buildComposedPrompt` y `buildCreatePrompt`, justo después de la guarda anti-inyección. Indica a Copilot que use esos datos para adaptar el tono y el rol, sin copiarlos literalmente ni usarlos como firma (§29). Al ser datos del propio usuario (no del correo entrante), no son entrada no confiable.

### 21.3 Flujo de datos

El perfil viaja a Copilot como parte del prompt, igual que el resto del contexto. No se envía a ningún otro destino. Al ser información del propio usuario, no añade una nueva categoría de dato de terceros.

## 22. Editor Markdown con preview en la ventana de redacción (sustituye a Markdown Here)

Sustituye a **Markdown Here Revival** (ya no soportado en TB nuevas): un **panel dividido en la zona de escritura** de la ventana de redacción — izquierda Markdown editable, derecha preview HTML en vivo. La conversión a HTML ocurre al apagar el panel o al enviar; el correo sale maquetado. Disponible en **cualquier** ventana de redacción y, además, el flujo de Copilot la abre **ya rellena** con el Markdown de la respuesta.

Diseño consolidado (arquitectura real + backlog) en `docs/superpowers/specs/2026-07-12-editor-markdown-consolidado.md`. Resumen:

### 22.1 Arquitectura (Plan B, tras el spike)

El enfoque inicial (inyectar un `<textarea>` en el cuerpo editable) se **descartó**: el editor nativo de TB se queda con el tecleo. Enfoque adoptado (**Plan B**): el **editor nativo de Thunderbird es la fuente Markdown** (el usuario escribe ahí); un **preview NO editable** (mitad derecha, `position:fixed`, `contenteditable=false`) renderiza en vivo con debounce; `body{margin-right:50%}` reserva la izquierda. `markdownSource()` lee el texto del cuerpo (excluyendo el preview, sobre un clon oculto para no tocar el cursor) y convierte los `<img>` insertados a `![alt](src)` para conservarlos.

Superficie inyectable: el documento del cuerpo editable, vía *compose script* (`scripting.compose`, permiso `compose`). Ficheros: **`markdown.js`** (renderizador propio, cadena HTML segura escapada; preview vía `DOMParser`, sin `innerHTML` remoto), **`content-compose.js`** (compose script; dependencia del DOM del editor centralizada en `SELECTORS`), **`compose.css`**. `manifest.json` añade `compose_action` (sin permisos nuevos); `background.js` registra el compose script en runtime (idempotente) y maneja `onBeforeSend`.

### 22.2 Envío (opción 1, un clic)

Al enviar, `compose.onBeforeSend` pide el HTML final al compose script y devuelve `{ details: { body: html } }` (**sin `cancel`**): el correo sale directo, ya maquetado, en un solo clic.

### 22.3 Motor propio, cobertura e imágenes

Renderizador escrito a mano (sin marked/highlight.js), objetivo **cobertura completa** del Markdown Guide (básica + extendida). Enlaces solo `http`/`https`/`mailto`; imágenes `http`/`https`/`data`/`cid` (conserva las insertadas por TB). Restricción de correo: estilos **en línea** (los clientes ignoran CSS externo); iconos en el correo con **emoji** (el `<svg>` inline se elimina); imágenes preferentemente `cid`. Objetivo TB 150+ **retrocompatible con ESR 140**. Spike del panel: **RESUELTO** con Plan B (verificado por el usuario en TB). Sin destinos nuevos, sin permisos nuevos, sin `innerHTML` remoto.

## 23. Ventana en pestañas (v2.7)

La ventana del botón había crecido hasta no caber en resoluciones bajas ni con escalado del SO al 125-150 %. Se reorganiza en **pestañas** (patrón ARIA `tablist`/`tab`/`tabpanel`) sin cambiar campos, ids ni flujo:

| Modo | Pestañas (en orden) |
|---|---|
| Creación | ✍️ **Redactar** (¿Qué quieres crear?, Contexto, Idioma) · ✉️ **Destinatarios** (Para, CC, CCO) · ⚙️ **Opciones** · 📜 **Prompt** |
| Respuesta | ⚙️ **Opciones** · 📜 **Prompt** |

- ⚙️ **Opciones** agrupa Agente, Prompt/Formato/Tono/Longitud, Título del chat y las casillas (chat nuevo, firma, cita, hilo). 📜 **Prompt** contiene el "Prompt a enviar" editable con su barra Markdown.
- **Cabecera** (logo, título, estado), aviso de privacidad, barra de pestañas y botones **Enviar/Regenerar** son fijos; **solo hace scroll el panel activo**, de modo que el botón de envío está siempre visible.
- Las pestañas y paneles llevan `data-modes`; `popup.js` elimina los que no corresponden al modo. La pestaña activa se recuerda por modo en `localStorage` (`lastTabCreate`/`lastTabReply`; preferencia de comodidad, con `try/catch`), y por defecto se abre la primera.
- Teclado: flechas, Inicio y Fin dentro de la barra de pestañas; **Ctrl+RePág/AvPág** desde cualquier campo.
- La pestaña ✉️ Destinatarios muestra un **contador** con el número de direcciones escritas en Para/CC/CCO.
- **Alto por defecto: el 50 % del alto útil de la pantalla** (`screen.availHeight`) en ambos modos, tanto al crear la ventana en el background como al situarla el popup; el ancho no cambia (600/620 px). Con pestañas ya cabe todo, así que no hace falta abrirla más alta. El tamaño que elija el usuario se sigue recordando, ahora en `winBoundsV2`/`winBoundsCreateV2` (las claves anteriores se descartan una vez para que se aplique el nuevo alto). Sustituye a los altos fijos de §18.1 y §19.1.
- Por debajo de 560 px de ancho, la rejilla de cuatro desplegables pasa a dos columnas y la de dos, a una.

Sin cambios de permisos, de flujo de datos ni de `content-copilot.js`.

## 24. Temas: descarga de cualquier tema y cambio rápido en el editor (v2.8)

### 24.1 Fichero compartido `themes.js`

El CSS de los temas (UPO corporativo y las paletas de `buildThemeCss`) sale de `content-compose.js` a **`themes.js`**, que expone `EMAIL_THEME_PRESETS` (`{ id, name, css }`). Lo cargan el compose script (`js: ["markdown.js", "themes.js", "content-compose.js"]`, mismo scope) y la página de Opciones (`<script src="../themes.js">`), para que cada tema exista **una sola vez**. El registro del compose script se rehace solo si la lista de ficheros registrada difiere (comparando nombres de fichero), sin volver a desregistrar en cada despertar (§22, v2.6.8). Si `themes.js` faltara, el editor sigue funcionando sin presets.

### 24.2 Opciones: plantilla de partida

En «Tema del correo», un desplegable **Plantilla de partida** ofrece la **plantilla genérica comentada** y **cualquier tema** con CSS (todos salvo «Por defecto»). Dos acciones:

- **Descargar .css**: guarda `cothunder-tema-<id>.css` (o `cothunder-tema.css` para la genérica) con una cabecera que explica cómo usarlo.
- **Editar como personalizado**: copia el CSS a «CSS personalizado» y selecciona el tema «Personalizado» (hay que pulsar Guardar). Si ya había CSS propio, pide un **segundo clic** para sustituirlo (sin `confirm()`).

### 24.3 Editor: desplegable 🎨 Estilo

La barra del editor Markdown (§22) añade a la derecha un menú **🎨 ▾** con todos los presets (y «Personalizado» si hay CSS propio; el actual lleva ✓). Cambia el tema **solo de ese correo**: vista previa al instante y HTML final del envío. **No modifica** el tema por defecto guardado en Opciones; parte de él al abrir la redacción y se resincroniza si se cambia en Opciones. **Menús propios, no `<select>`**: dentro del editor de Thunderbird un `<select>` nativo no se despliega, así que los menús son un botón «X ▾» que abre un panel de botones (se cierran al elegir, al pulsar fuera o con Escape; si el panel se sale por la derecha, se alinea a la derecha). Para que la barra quepa en una línea (v2.8.1), lo menos usado se agrupa en menús: **H ▾** (títulos 1-6), **Aa ▾** (negrita+cursiva, subíndice, superíndice), **▦ ▾** (tabla, bloque de código, regla, lista de definición, nota al pie) y **ℹ ▾** (avisos: nota, consejo, importante, advertencia, precaución). Si aun así la barra baja a dos líneas, el margen superior del texto y del preview se ajusta a su alto real (`ResizeObserver`), así que nunca tapa el texto. La barra es `contenteditable="false"` y `spellcheck=false`.

Sin permisos nuevos ni cambios en el flujo de datos.

## 25. Mejoras de uso y validación (v2.9)

### 25.1 Firma y cita conservadas en el editor Markdown

`content-compose.js` trocea el cuerpo (`bodySegments`) en tramos de Markdown y **bloques conservados** (`PRESERVED_SELECTOR`: `.moz-signature`, `blockquote[type=cite]`, `.moz-cite-prefix`, `.moz-forward-container`), en orden. Solo los tramos de Markdown pasan por `renderMarkdown` + `styleEmail` + tema; los bloques conservados se intercalan con su HTML original (`outerHTML`), tanto en el preview (vía `DOMParser`) como en el HTML final del envío. Así la firma corporativa mantiene negritas, colores y tamaños, y la cita no se reinterpreta como Markdown. No es contenido remoto nuevo: es el HTML que Thunderbird ya puso en la redacción.

### 25.2 Atajos de teclado en el editor

Con el editor activo, `keydown` (fase de captura) sobre el cuerpo intercepta **Ctrl+B** (`**…**`), **Ctrl+I** (`*…*`), **Ctrl+K** (enlace), **Ctrl+E** (código en línea) y **Ctrl+1…6** (títulos), sustituyendo a los de formato HTML de Thunderbird, que se perderían al convertir. `prefixLine` lleva el cursor al inicio de la línea (`Selection.modify("move","backward","lineboundary")`) y, en títulos, sustituye un `#…` existente en vez de acumularlo; sin `Selection.modify` cae al comportamiento anterior (insertar en el cursor). Los tooltips de la barra muestran el atajo.

### 25.3 Ventana: Ctrl+Enter, destinatarios y longitud del prompt

- **Ctrl+Enter** envía desde cualquier pestaña o campo.
- **Destinatarios:** `invalidRecipients(str)` (en `common.js`, con test) lista las partes que no son una dirección válida. Cada caja las muestra en rojo bajo el campo y el contador de la pestaña cuenta solo las válidas (`parseRecipients`).
- **Longitud del prompt:** contador `n / 16.000` junto a "Prompt a enviar" (límite aproximado del chat de M365 Copilot, constante `PROMPT_MAX` en `popup.js`), en rojo si se supera.
- **Avisos previos al envío:** si hay direcciones no válidas o el prompt supera el límite, el primer clic en Enviar/Regenerar (o Ctrl+Enter) **avisa** en el estado y salta a la pestaña afectada; un segundo clic con el mismo aviso envía igualmente. No bloquea: el usuario decide.

### 25.4 Validación unificada

`scripts/check.sh` valida manifest (SemVer), sintaxis de **todos** los JS, que existan los ficheros referenciados (manifest, `COMPOSE_SCRIPT` y páginas HTML) y ejecuta los tests. Lo usan el hook `.githooks/pre-commit` (activar con `git config core.hooksPath .githooks`), el CI y la release; `npm run check` es un atajo (`package.json` solo de tooling, fuera del `.xpi`). En Windows sin Node se relanza en WSL. `test/themes.test.js` comprueba los presets (ids únicos y alineados con el selector de Opciones, CSS parseable, sin `url()`). `.gitattributes` fija LF en el repo.

Sin permisos nuevos ni cambios en el flujo de datos.

## 26. Plantillas de formato en el editor Markdown (v2.10)

La barra del editor (§22, §24.3) añade, antes de 🎨, un menú **📄 ▾** que inserta en el cursor el Markdown de una **plantilla de Formato**: las `Formato - …` (incluidas las sembradas, §18.5) y las plantillas **sin prefijo** del usuario, igual que el desplegable 📄 Formato de la ventana. Las `Prompt - …` y `Prompt crear - …` **no** aparecen: son instrucciones para Copilot, no contenido del correo. La clasificación vive en `formatTemplates()` (`common.js`, con test), que quita el prefijo y ordena por nombre; si hay varias cuentas, la etiqueta lleva la fuente entre paréntesis. El menú termina con «↻ Actualizar lista».

El compose script no tiene acceso a carpetas ni mensajes, así que lo pide al background:

- `listFormatTemplates` → `{ ok, templates: [{ id, label, source }] }` (vía `listTemplates()`, permiso `accountsRead`/`messagesRead` ya declarado).
- `getFormatTemplate { id }` → `{ ok, body }` con `extractTemplateBody(id)`. **Solo** responde si el id es una plantilla de Formato de una carpeta de Plantillas: el editor no puede leer otros correos por id.

La lista se carga al activar el editor; el cuerpo se inserta con `insertBlock` (bloque propio) y el preview lo renderiza al momento. Sin permisos nuevos ni cambios en el flujo de datos (las plantillas son locales).

## 27. Código fuente Markdown: lectura por bloques y «Ordenar» (v2.11)

### 27.1 Lectura por bloques

Thunderbird crea un `<p>` por cada Enter; leído con `innerText`, cada párrafo quedaba separado por una línea en blanco, lo que **partía las listas** (cada elemento, una lista distinta; sin anidamiento) y separaba filas de tabla, líneas de cita y de bloques de código. `nodesToMarkdown` lee ahora cada bloque del editor (`p`, `div`, `h1-6`, …) por separado (y los nodos en línea seguidos como otro bloque) y los une con `joinSourceBlocks` (`markdown.js`, con tests): **sin** línea en blanco si el bloque siguiente continúa la misma lista (incluida una sangría tras un elemento), tabla o cita, o si se está dentro de un bloque ```` ``` ````; **con** línea en blanco (párrafo nuevo) en los demás casos. Los `&nbsp;` se leen como espacios. Los párrafos normales se siguen tratando como párrafos.

`renderMarkdown` tolera además líneas en blanco **entre elementos de una lista** (estilo de Copilot, igual que ya hacía con las filas de tabla): si la siguiente línea con contenido es un marcador de lista con sangría igual o mayor, la lista continúa; si no, termina. Antes cada elemento salía como una lista aparte y las numeradas se veían «1, 1, 1…».

### 27.2 «⇥ Ordenar» (Ctrl+Shift+F)

`formatMarkdown` / `formatMarkdownBlocks` (`markdown.js`, con tests, incluido uno que verifica que **el HTML renderizado no cambia**) ordena el fuente: alinea las columnas de las tablas (respetando `:--`, `:-:`, `--:`), indenta las listas anidadas con **4 espacios** por nivel y viñeta `-` (los niveles se deducen por pila de sangrías, igual que el renderizador), deja **una** línea en blanco entre bloques y ninguna dentro de listas o tablas, quita espacios finales y blancos repetidos; el interior de los bloques de código no se toca. Es idempotente.

El botón de la barra (y el atajo) reescribe cada tramo Markdown (no la firma ni la cita, §25.1) como un `<p>` por bloque con `<br>` entre líneas y `&nbsp;` en sangrías y espacios dobles. Usa `execCommand("insertHTML")` con la selección **dentro** del tramo (para que Ctrl+Z lo deshaga y el editor no fusione el último párrafo con la firma); si aun así la firma o la cita cambian, deshace y sustituye los nodos directamente. Los tramos con imágenes insertadas no se reescriben.

### 27.3 Presentación

Con el editor activo, la zona de escritura usa letra **monoespaciada** (para ver la alineación) y el preview, letra proporcional. Para hacer sitio en la barra, **Imagen** y **Emoji** pasan al menú **▦ ▾ Insertar**.

## 28. Accesibilidad: contraste WCAG 2.1 AA (v2.12)

### 28.1 Temas del correo

**Requisito:** todo texto del correo renderizado con cualquier tema cumple **4.5:1** (3:1 en texto grande: ≥ 24 px, o ≥ 18.66 px en negrita) contra su fondo efectivo, **tanto en el preview del editor como en el correo recibido**.

- **Modo quirks.** Los correos HTML se muestran sin doctype (modo quirks), donde las **tablas no heredan el color de texto**. Los temas ponían el color solo en el contenedor, así que en los 8 temas oscuros las celdas salían en negro sobre fondo oscuro (1.1–2.3:1). `buildThemeCss` fija ahora `color` en `table` y `color` + `background` en `td` (las filas pares siguen con `evenRow`), de modo que la tabla es autosuficiente.
- **Colores ajustados** (mínimo cambio de luminosidad HSL que conserva tono y saturación hasta ≥ 4.6:1): enlaces de Solarized claro/oscuro y colores de resaltado de código de Solarized, Monokai, Dracula, Nord y One Dark; gris de comentarios del tema por defecto, GitHub claro y UPO claro (`#6e7781` → `#68717a`). **No cambia ningún color corporativo UPO** (#003772, #FCC100).
- **Pruebas.** `test/themes.test.js` comprueba, sin navegador, cada pareja texto/fondo de las paletas y que `td` lleve color y fondo propios. `scripts/a11y-themes.sh` abre `test/a11y/themes-contrast.html` en Chrome/Edge headless: renderiza un correo con todos los elementos con cada tema y mide el contraste de **cada texto** en el editor y en un iframe sin doctype (como lo ve el destinatario). Se ejecuta en el CI.

### 28.2 Interfaz (ventana y Opciones)

- `:root { color-scheme: light dark }` y `body { background: Canvas; color: CanvasText }` en Opciones (antes solo el `body` declaraba el esquema y el texto podía quedar negro sobre fondo oscuro) y en la ventana.
- `::placeholder` con `color-mix(currentColor 72%)` y opacidad 1 (el gris por defecto daba 2.4–3.6:1 en oscuro) y foco visible (`:focus-visible`).
- `scripts/a11y-ui-audit.js` audita una página (contraste de textos y placeholders, campos sin etiqueta, botones sin nombre, imágenes sin alt); pasa en ventana (crear/responder) y Opciones, en claro y oscuro.

### 28.3 Descarga con nombre fijo

La release adjunta, además de `cothunder-X.Y.Z.xpi`, una copia `cothunder.xpi`, de modo que `releases/latest/download/cothunder.xpi` (botón de descarga del README) apunta siempre a la última versión.

## 29. Sin pies de firma generados (v2.13)

La firma con los datos del usuario (nombre, cargo, organización, teléfono, correo) la gestiona **cada usuario en su identidad de Thunderbird** y la añade la casilla «Incluir mi firma» (§18.3). CoThunder no debe generar otra, para no duplicarla ni enviar esos datos a Copilot sin necesidad:

- **Plantillas sembradas** (§18.5): sin pie con datos. «Carta institucional» e «Identidad UPO» terminan en la despedida; «Correo formal con firma» pasa a **«Formato - Correo formal»**, que termina en «Un cordial saludo,». `SEED_VERSION` sube a 2 para que quien ya tenía la v1 reciba «Correo formal». La siembra deduplica por asunto y nunca modifica ni borra plantillas existentes (no hay permiso `messagesDelete`, a propósito): las copias antiguas que ya tenga un usuario se quedan como estén y puede borrarlas a mano.
- **Instrucciones a Copilot:** `MARKDOWN_STYLE` termina con «Termina en la despedida: NO añadas firma, nombre, cargo ni datos de contacto…; Thunderbird añade la firma del usuario». `buildUserContext` pide usar el perfil para el tono y el rol, **no** como firma.
- **«Tomar de mi identidad de Thunderbird»** ya no copia la firma a «Cómo escribo»: rellena solo nombre y organización. Menos datos personales en cada prompt (minimización, RGPD art. 5.1.c).
- **Limpieza de perfiles existentes (v2.13.1).** Las actualizaciones conservan `storage.local`, así que un «Firmo así: …» copiado por versiones anteriores seguiría enviándose. `cleanProfileSignature()` (background, una sola vez, marcador `profileSignatureCleaned`) aplica `stripCopiedSignature(style, firmas)` (`common.js`, con tests): si el bloque coincide con la firma actual de alguna identidad (`signatureAsText`), quita exactamente ese bloque y conserva el resto; si no coincide (la firma cambió), quita desde «Firmo así:» hasta el final del campo, que es como lo dejaba el botón. El texto anterior se guarda en `userProfileStyleBackup`. No requiere permisos nuevos (`identities.list` ya usa `accountsRead`).
- **Firmas dentro del correo leído (v2.13.2).** La firma del usuario también llegaba a Copilot **citada en el correo que responde** (quien le contesta incluye su mensaje anterior) y en el **hilo**. `extractBody` la limpia antes de montar el prompt: (1) `htmlToText` elimina los bloques `.moz-signature` (firmas marcadas por Thunderbird, también dentro de citas; incluye las de otros remitentes, cuyo nombre ya va en las cabeceras); (2) en texto plano, `stripPlainSignature` corta desde una línea `-- ` hasta el final o hasta la siguiente cita; (3) `stripOwnSignatures(texto, firmas)` busca las firmas de las identidades del usuario (`ownSignatureTexts`, vía `identities.list`) **sin depender de los saltos de línea**, junto con el `--` y las `[imagen: …]` del logo; si no aparecen enteras, quita sus líneas de **8 o más palabras** (dirección, aviso legal), nunca las cortas como el nombre, para no borrar un saludo. Todo con tests, incluido el caso real de una firma UPO citada con otros saltos.

## 30. Barra del editor: teclado y tema oscuro (v2.14)

### 30.1 Teclado (WCAG 2.1.1)

La barra del editor Markdown (§22) sigue el patrón WAI-ARIA *toolbar* + *menu button*:

- La barra tiene `role="toolbar"` y **foco itinerante**: solo un control tiene `tabindex="0"`; el resto, `-1`.
- **Alt+F10** en el editor guarda la posición del cursor y lleva el foco al último control usado de la barra.
- **Flechas izquierda/derecha**, **Inicio** y **Fin** recorren los controles (dando la vuelta). **Escape** sin menú abierto devuelve el foco al editor, con el cursor donde estaba.
- Los botones de menú llevan `aria-haspopup="menu"`, `aria-expanded` y `aria-controls`. **Enter/espacio** o **flecha abajo** abren el menú y enfocan la primera opción; **flecha arriba**, la última. Dentro: flechas arriba/abajo (dando la vuelta), Inicio y Fin; **Escape** cierra y vuelve al botón; **Tab** cierra el menú.
- Al elegir una opción que escribe Markdown, el foco vuelve al editor y el texto se inserta en la posición guardada. Con el ratón no cambia nada: los botones no toman el foco y la selección del editor se conserva.
- Con el foco en la barra, los atajos Ctrl+… (§25.2) no actúan, para no escribir en el editor sin querer.

### 30.2 Tema oscuro

Los estilos de la barra y de sus menús pasan de estilos en línea a la hoja propia del editor, con variables de color. Si el fondo real del editor es oscuro (luminancia del primer fondo no transparente desde `body`), o es transparente y el sistema está en oscuro (`prefers-color-scheme`), la barra recibe `data-dark` y usa una paleta oscura con contraste AA. Se recalcula si cambia la preferencia del sistema. La **vista previa sigue en blanco**: muestra el correo como lo verá el destinatario.

Probado en Edge headless con un editor simulado: navegación, `aria-expanded`, inserción en la posición guardada y auditoría de contraste (`scripts/a11y-ui-audit.js`) en claro y en oscuro.

### 30.3 Mantenimiento

- La clasificación de plantillas por asunto vive solo en `common.js`: `formatTemplates(list, { sort })` y `promptTemplates(list, mode)`, con tests. La usan la ventana (desplegables, en el orden de las carpetas) y el menú 📄 del editor (por orden alfabético).
- La lista blanca del `.xpi` vive solo en `scripts/build.sh` (`npm run build`), que usan la skill de empaquetado y `release.yml`.

## 31. Productividad, robustez y ayuda (v2.15)

### 31.1 Acciones de un clic (menú contextual)

Menú **CoThunder** en los contextos `message_list` (clic derecho sobre la lista de mensajes) y `message_display_action` (clic derecho sobre el botón del visor): *Resumir con Copilot*, *Responder aceptando*, *Responder declinando*, *Acusar recibo* (`QUICK_ACTIONS`, `common.js`), *Responder con mi prompt* (submenú con las plantillas `Prompt - …`, rellenado en `menus.onShown`), *Abrir la ventana de CoThunder…* y *Ayuda*. Con varios mensajes seleccionados solo queda activa la de resumir (las de respuesta se desactivan).

Las acciones no abren la ventana: `quickAction` (background) monta el prompt con los ajustes guardados (`lastAgentId`, `prefTone`, `prefLength`, `prefSignature`, `prefQuote`), el idioma detectado del correo (§31.4) y `newChatByDefault`, avisa con una notificación y la respuesta sigue el flujo normal (§17).

**Permiso nuevo: `menus`.** Solo añade entradas a menús contextuales de Thunderbird; no da acceso a datos nuevos (los mensajes se leen con `messagesRead`, como hasta ahora). El background rehace el menú en cada arranque del event page (`menus.removeAll` + `create` con ids fijos), así no hay duplicados.

### 31.2 Resúmenes

`buildSummaryPrompt(messages, opts)` (`common.js`, con tests): guarda anti-inyección, perfil del autor, instrucción de resumen (uno: lo esencial, peticiones, plazos y si requiere respuesta; varios: una línea por correo y lista «Pendiente de responder» por urgencia) y salida en un bloque ```markdown. Máximo **10 correos** (`SUMMARY_MAX_MESSAGES`) y **3.000 caracteres** por correo (`SUMMARY_MSG_CHARS`); los cuerpos pasan por `extractBody` (sin firmas, §29). El resultado se abre en `pages/result.html` (`kind: "summary"`) con *Copiar* (Markdown) y, si es un solo correo, *Responder…* (abre la ventana de CoThunder para ese mensaje). Modo de token `summary` (prefijo `s`).

### 31.3 Varias versiones

En la ventana (solo respuesta), *Más opciones › Versiones* = 1, 2 o 3. Con más de una, `buildComposedPrompt` sustituye `MARKDOWN_INSTRUCTION` por `versionsInstruction(n)`: todas las versiones en **un único** bloque de código, cada una precedida de una línea `=== VERSIÓN n ===`. Al llegar, `splitVersions` (con tests) las separa; si hay más de una, se abre `pages/result.html` (`kind: "versions"`) con una pestaña por versión (patrón *tabs* accesible) y *Usar esta versión* → `useVersion` → `openReplyWithText`. Si solo llega una, se abre directamente y se anota en el diagnóstico (`versiones-sin-separar`).

### 31.4 Idioma de la respuesta

`detectLanguage(text)` (`common.js`, con tests): cuenta palabras vacías frecuentes de es, en, fr, de, pt e it; exige al menos 8 palabras, 3 coincidencias y un 30 % de ventaja sobre el segundo idioma; si no, devuelve "" y se mantiene la instrucción base («en el mismo idioma del mensaje»). La ventana muestra *Responder en: Como el correo (inglés)* con opción de forzar otro; `buildComposedPrompt` añade «Escribe la respuesta en …» + `CREATE_LANGS`. Las acciones de un clic usan siempre el detectado. Se añaden portugués e italiano también al modo creación.

### 31.5 «Mejorar con Copilot» en el editor

Menú ✨ de la barra del editor (§22) con `IMPROVE_ACTIONS` (`common.js`): más formal, más cercano, más corto, desarrollar, corregir, traducir al inglés y al español; el editor pide la lista al background (`listImproveActions`), así hay una sola definición. Flujo: el compose script lee la selección como Markdown (`nodesToMarkdown` sobre `range.cloneContents()`), guarda el rango y envía `improveText { action, text }`; el background monta `buildImprovePrompt` (fragmento delimitado, con la orden de no obedecer instrucciones dentro del texto) y lanza la petición con token `i…` y `opts { mode: "improve", tabId }`. La respuesta vuelve a esa pestaña con `cothunder-improved { token, text }` (vallas de código quitadas con `stripCodeFences`) y sustituye el rango con `execCommand("insertHTML")` (un `<p>` por bloque, `sourceBlocksHtml`), deshacible con Ctrl+Z. Una sola mejora a la vez; estados en una línea `role="status"` de la barra.

**Flujo de datos:** solo el texto seleccionado por el usuario (su propio borrador) viaja a Copilot, el mismo destino de siempre.

### 31.6 Progreso y Cancelar

`startCopilotRequest` (background) es ahora el camino único de todas las peticiones (ventana, menú, editor). Emite `copilotProgress { token, stage }`: `opening` (background), `typing`, `waiting`, `done` (content script) y `error`/`cancelled` con `reason`. La ventana muestra los cuatro pasos, los segundos de espera y **Cancelar** → `cancelCopilot`: el background marca `cancel_<token>` en `storage.session` (corta `deliverWithRetry` y descarta la respuesta) y envía `cancelPrompt` al content script, que deja de esperar y pulsa el botón *Detener* de Copilot si lo encuentra (`SELECTORS.stopButton`). Los mensajes de error para el usuario están en `COPILOT_ERRORS` (`common.js`).

### 31.7 Sesión caducada

Dos señales: (1) en `deliverWithRetry`, si la pestaña de Copilot está `complete` pero su URL no es legible durante más de 3 s, ha salido del dominio con permiso, es decir, a la página de inicio de sesión de Microsoft; (2) en el content script, si no aparece el editor y hay un enlace o botón de inicio de sesión (`SELECTORS.signIn`). En ambos casos `reason: "login"`: se trae al frente la ventana de Copilot y se dice al usuario que inicie sesión y repita. No requiere el permiso `tabs`.

**Cookies desactivadas (v2.20.1).** Si Thunderbird bloquea las cookies, Microsoft no puede guardar la sesión: el inicio de sesión no termina o salta al navegador del sistema. El content script lo detecta con `navigator.cookieEnabled` (refleja el permiso de cookies de la página de Copilot, incluidas las excepciones por sitio; sin permisos nuevos): `checkSession` devuelve `cookies: false` y `checkCopilot` da el estado `cookies` (antes que `ok`/`login`); si falla la escritura, `sendPrompt` devuelve `reason: "cookies"`; `refreshAgents` propaga `cookies` igual que `login`. La ventana, la bienvenida y Opciones muestran cómo activarlas (Ajustes › Privacidad y seguridad › Contenido web, o excepción para `https://m365.cloud.microsoft` y `https://login.microsoftonline.com`). Si la página nunca llega a cargar en el dominio de Copilot (redirección inmediata), el content script no corre: por eso el texto de `login` también menciona las cookies.

### 31.8 Diagnóstico técnico

`diag(ev, detail)` (background) guarda en `storage.local.diagLog` (máximo 200) `{ ts, v, ev, detail }`: selector no encontrado (editor, enviar, chat nuevo, respuesta), agente no encontrado, sin sesión, envío fallido con su motivo, captura vacía, tiempo de respuesta. `detail` se recorta a 120 caracteres y **nunca** contiene asuntos, direcciones ni texto de correos o respuestas. Opciones › Diagnóstico muestra el número de entradas, lo copia al portapapeles (con versión y navegador) y lo vacía.

### 31.9 Iconos SVG en la barra del editor

Los botones con emoji pasan a iconos SVG propios de 16×16 (`ICONS`, `content-compose.js`) creados con `createElementNS`, con trazo `currentColor` (siguen el tema claro/oscuro de §30.2). Los menús siguen mostrando texto. Añade el botón **?** (ayuda del editor) y el menú ✨ (§31.5).

### 31.10 Asistente de bienvenida

`pages/welcome.html` se abre en una pestaña **solo al instalar** (`onInstalled`, `reason: "install"`) y desde la ayuda u Opciones: abre Copilot (`openCopilot`), comprueba la sesión (`checkCopilot`: `closed`/`login`/`loading`/`ok` + agentes, vía `checkSession` en el content script), elige el tema por defecto (`emailTheme`) y el agente por defecto (`lastAgentId`).

### 31.11 Ventana más compacta

En la pestaña ⚙️ Opciones, lo menos usado (tono, longitud, idioma, versiones y título del chat) va en un `<details>` **Más opciones**; la ventana recuerda si quedó abierto (`localStorage`), además del tamaño y la pestaña, como antes. El botón *Regenerar* pasa a un verde con contraste AA (#137a5f).

### 31.12 Ayuda integrada

`pages/help.html` explica todas las funciones, con índice, búsqueda sin tildes (`help.js`) y anclas por sección. Se abre desde el botón **?** de la ventana (y `F1`, en la sección del modo), el **?** del editor (`openHelp` → `#editor`), el menú contextual, Opciones y el asistente. Opciones deja de llevar la guía larga y enlaza a la ayuda.

### 31.13 Ficheros y pruebas

Nueva carpeta `pages/` (`pages.css`, `help.*`, `result.*`, `welcome.*`), incluida en la lista blanca de `scripts/build.sh`; `scripts/check.sh` comprueba sus referencias. Pruebas: `test/features.test.js` (idioma, versiones, vallas, resumen, mejorar, título del chat, errores). Todas las páginas nuevas y la ventana pasan `scripts/a11y-ui-audit.js` en claro y oscuro (Edge headless con `messenger` simulado); la barra del editor y «Mejorar» se probaron igual, incluido Ctrl+Z.

## 32. Página de Opciones reorganizada (v2.16)

La página de Opciones pasa de una lista larga a **cinco pestañas** (patrón WAI-ARIA *tabs*: flechas, Inicio y Fin; recuerda la última en `localStorage.optionsTab`):

- **General**: «Empezar un chat nuevo cada vez» y «Editor Markdown activo al redactar», como casillas grandes con explicación. La dirección de Copilot y la instrucción base del prompt van plegadas en **Avanzado**.
- **Aspecto del correo**: tema por defecto y color de acento; «Crear tu propio tema» (tema de partida, editar, descargar) con el CSS personalizado y la subida de fichero plegados.
- **Sobre ti**: el perfil, con nombre y cargo en dos columnas.
- **Privacidad**: registro de actividad y diagnóstico (se aplican al momento).
- **Ayuda**: enlaces a la ayuda y al asistente.

Una barra fija abajo con **Guardar cambios** guarda General, Aspecto y Sobre ti desde cualquier pestaña. Texto a 15 px y controles de al menos 42 px de alto. Los ids de los campos no cambian (`options.js` solo añade las pestañas y abre el CSS personalizado al usar «Editar como personalizado»). Pasa `scripts/a11y-ui-audit.js` en claro y oscuro. Sin cambios de permisos ni de datos.

## 33. Exportar a Markdown y agentes por enlace (v2.17)

### 33.1 Exportar un correo a Markdown

`htmlToMarkdown(html, { dropSignatures })` (`markdown.js`, ahora cargado también en el background: `background.scripts: ["common.js", "markdown.js", "background.js"]`) recorre el DOM de `DOMParser` y produce Markdown: títulos, énfasis, enlaces (`<url>` si el texto es la propia dirección), listas anidadas y numeradas (con `start`), citas, código (`pre` con su sangría), reglas y **tablas de datos**. Las tablas de **maquetación** (anidadas, de una fila o una columna, o `role="presentation"`) se aplanan a texto. Imágenes: `http(s)` como `![alt](src)`; `cid:`/`data:` como «[imagen: alt]»; píxeles de seguimiento (≤ 2×2) se omiten. Se descartan `style`, `script`, `head` y controles de formulario. Limpieza final: sin espacios sobrantes ni sangrías fuera de listas y código, como mucho una línea en blanco seguida.

`emailToMarkdown(meta, body, { forCopilot })` (`common.js`, con tests) monta la ficha: `# Asunto`, De, Para, CC, Fecha, Adjuntos (nombre y tamaño, de `messages.listAttachments`, sin descargarlos) y el cuerpo. `markdownFileName` da el nombre del fichero (fecha + asunto sin RE/RV ni caracteres prohibidos).

Entrada: menú contextual *Exportar a Markdown / preguntar a Copilot…* (hasta 20 correos, separados por `---`) y botón **⬇ .md** de la ventana de respuesta. Se abre `pages/export.html` con pestañas *Vista* / *Markdown* (código editable), **Descargar .md** (`Blob` + `<a download>`, sin el permiso `downloads`) y **Copiar Markdown**.

### 33.2 Pasar el correo a Copilot o a un agente

En la misma ventana: agente (añadidos a mano + detectados; recuerda `lastAgentId`), petición opcional y *Empezar chat nuevo*. `askCopilot` (background) vuelve a convertir los correos **para Copilot** (`forCopilot`: sin `.moz-signature`, sin la firma propia —`stripOwnSignatures(…, keepLayout)`—, sin Para/CC y recortado a `MAX_BODY` por correo) y monta `buildAskPrompt` (guarda anti-inyección, perfil del autor, petición del usuario o, si falta, «resúmelo y espera mis preguntas», correo delimitado y salida en Markdown). Token `a…` generado por la página (progreso y Cancelar desde el primer paso); la respuesta se abre en `pages/result.html` (modo `summary`) y queda en el chat.

**Flujo de datos:** descargar no envía nada. *Pasárselo a Copilot* envía los correos elegidos al mismo destino de siempre, con menos datos que una respuesta normal (sin direcciones de terceros).

### 33.3 Detección de agentes

`scanAgents()` (`content-copilot.js`) combina tres señales, centralizadas en `SELECTORS`: (1) `agentNavItems` (la clase del panel del spike, filtrada por id de agente `T_`/`P_`/`agent`/`gpt`, para excluir los chats del historial); (2) `agentLinks`: enlaces del propio dominio con `titleId=`, `agentId=`, `/agent/` o `/agents/`, de los que se saca id y **enlace**; (3) `agentMarked`: elementos con id de agente o `data-testid` de agente. Deduplica por id y completa el enlace si otra señal lo aporta. Se guarda a los 3, 8 y 20 s, cada minuto y, con un `MutationObserver` limitado a una pasada cada 2 s, cuando cambia la página (el panel se carga tarde). `getAgents` anota en el diagnóstico cuántos encontró cada señal.

### 33.4 Agentes por enlace y alta manual

`startCopilotRequest` resuelve el agente (`resolveAgent`: `customAgents` + `agents`) y lo entrega con su `agentUrl`. Si el content script no lo encuentra en la página, responde `agent-navigate`; el background abre el enlace en la pestaña de Copilot (`tabs.update`, espera a `complete`) y vuelve a entregar el prompt sin selección de agente ni chat nuevo. Los agentes añadidos a mano (ids `u_…`) se abren directamente por su enlace.

**Opciones › General › Agentes de Copilot**: lista de detectados con *Detectar ahora* (`refreshAgents`) y filas *nombre + enlace* para añadir agentes a mano (`customAgents`). Solo se aceptan enlaces de `m365.cloud.microsoft` (el único dominio con permiso); el id se deriva del enlace. La ventana, la bienvenida y la exportación muestran primero los añadidos a mano.

Sin permisos nuevos. Pruebas: `test/features.test.js` (ficha, nombre de fichero, prompt, tamaños) y bancos en Edge headless para el conversor (correo tipo Outlook), `scanAgents` sobre un DOM simulado, y las páginas de exportación, Opciones y ventana (con auditoría de accesibilidad en claro y oscuro).

### 33.5 Abrir Copilot antes de detectar (v2.17.1)

Junto al selector de agente de la ventana (↻) y en Opciones › General hay un botón **Abrir Copilot** (`openCopilot`). Además, `refreshAgents` con `open: true` (lo envían ↻ y *Detectar agentes*) abre Copilot si no responde o aún no muestra agentes y lo consulta cada 1,5 s durante 25 s; si detecta la página de inicio de sesión (`checkCopilot`) para y devuelve `reason: "login"`, y si se agota el tiempo, `"loading"`. Los mensajes al usuario distinguen ambos casos.

## 34. Estado de Copilot al entrar y apertura automática (v2.18)

La ventana de CoThunder (ambos modos) muestra bajo el título una barra con el estado de Copilot, obtenido con `checkCopilot` (§31.10): **listo** (punto verde, sin botón), **cargando** (ámbar), **sin sesión** (rojo, botón *Ir a Copilot*) o **cerrado** (rojo, botón *Abrir Copilot*). Se vuelve a consultar cada 3 s mientras no está listo y cada 10 s cuando lo está; el texto va en una región `role="status"`.

**Apertura automática:** si al entrar Copilot está cerrado y `autoOpenCopilot` está activo (por defecto; casilla en Opciones › General), la ventana envía `openCopilot { returnFocusTo: <su ventana> }`; el background abre Copilot (`ensureCopilotTab`) y devuelve el foco a la ventana de CoThunder para que no quede tapada. El botón manual abre Copilot dejándolo delante (para iniciar sesión). Sin permisos nuevos.

## 35. Usabilidad de la ventana (v2.19)

- **Indicaciones** (modo respuesta): textarea al principio de ⚙️ Opciones. `buildComposedPrompt` las añade como «INDICACIONES DEL USUARIO PARA ESTA RESPUESTA (prioritarias…)» tras el prompt de plantilla y antes del hilo y del correo (con test). No se recuerdan entre correos. En creación no aparece: ya está «¿Qué quieres crear?».
- **Foco tras enviar:** `sendToCopilot` y `askCopilot` llevan `returnFocusTo` (la ventana que pide). `startCopilotRequest` deja Copilot delante mientras escribe y, si la entrega sale bien, devuelve el foco a esa ventana (progreso y Cancelar a la vista). Con `login` no lo hace: Copilot debe quedar delante.
- **Mensajes junto a Enviar:** el estado de la operación sale de la cabecera a una franja de ancho completo encima del progreso (`#status`, `role="status"`), donde el texto se ajusta en varias líneas. «Listo» sin más no se muestra. Los errores (`showError`) llevan borde rojo, el texto completo de `COPILOT_ERRORS` y, con `login`, el botón *Ir a Copilot*. Al haber error se ocultan los pasos del progreso. El aviso se muestra antes de intentar copiar el prompt al portapapeles (la copia solo completa el mensaje).
- **Un solo estado y un solo botón:** arriba queda únicamente la barra de estado de Copilot (§34) con su botón; se quita el «Abrir Copilot» junto al selector de agente (↻ ya abre Copilot si hace falta).

## 36. Iconos Fluent en la interfaz y selector de emoji (v2.20)

### 36.1 Iconos

La interfaz deja los emoji decorativos (etiquetas, pestañas y botones de la ventana) y usa **Fluent UI System Icons** de Microsoft (licencia MIT, aviso incluido en `icons.js`): el estilo de Microsoft 365/Copilot. Solo los 32 que se usan, en tamaño 20 regular, **integrados** en `icons.js` como rutas SVG (`ICON_PATHS`): sin fuentes de iconos (peor nitidez y accesibilidad) ni descargas (CoThunder no usa terceros). `iconEl(name, size)` crea un `<svg>` decorativo (`aria-hidden`, `fill="currentColor"`: sigue el color y el tema); `hydrateIcons()` rellena los `<span data-icon>` del HTML. La barra del editor (§31.9) sustituye sus iconos dibujados a mano por estos. `icons.js` se carga en la ventana y en el compose script (`COMPOSE_SCRIPT.js`: markdown, themes, icons, emoji, content-compose).

### 36.2 Selector de emoji

Los emoji son para el **texto de los usuarios**. `emoji.js` (`createEmojiPicker`) ofrece unos 175 emoji en 7 grupos con nombre y palabras clave en español; búsqueda sin tildes; fila de **recientes** (`storage.local.emojiRecent`, 16); teclado (flecha abajo desde la búsqueda, flechas en la rejilla de 8 columnas, Enter, Escape); `role="dialog"`, cada emoji es un botón con su nombre. Inserta el **carácter real** (no `:código:`).

- **Editor:** botón *Emoji* en la barra (sustituye a la opción «Emoji» del menú Insertar, que insertaba `:smile:`). Guarda el cursor al abrir y lo restaura al insertar (`insertMd`, deshacible). Se cierra con Escape, al elegir o al pulsar fuera.
- **Ventana:** botón de emoji en las barras Markdown de *¿Qué quieres crear?* y *Prompt a enviar* y junto a *Indicaciones*. Un único selector, colocado junto al botón sin salirse de la ventana; inserta en el cursor del campo (`setRangeText`) y lanza `input`, así el prompt se rehace.

Sin permisos nuevos. Probado en Edge headless (editor y ventana, claro y oscuro) con auditoría de accesibilidad.
