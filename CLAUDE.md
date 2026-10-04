# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es CoThunder

Extensión MailExtension para Thunderbird 115+ que lee el correo abierto, monta un prompt editable con su contenido y lo envía a la web de **Microsoft 365 Copilot** automatizando el chat con la sesión ya iniciada. No usa API ni claves: pilota la interfaz web de Copilot mediante un content script. El nombre del proyecto es **CoThunder**.

## Estado del repo: spec-first

Todavía no existe código de la extensión. La fuente de verdad es la especificación en `spec/docs/ESPECIFICACION.md`. Léela entera antes de generar o modificar código. Si el código y la especificación divergen, gana la especificación salvo indicación explícita; si un cambio amplía el comportamiento, actualiza la especificación en el mismo commit.

Guía complementaria en `spec/CLAUDE.md`. Las skills de proyecto viven en `spec/.claude/skills/`.

## Arquitectura (según la especificación)

Enfoque: en vez de llamar a una API, la extensión **automatiza la web de M365 Copilot** con la sesión ya iniciada del usuario. No se puede incrustar Copilot en un iframe (Microsoft lo bloquea con `X-Frame-Options`/CSP), así que se abre en una ventana/pestaña propia y un content script pilota su DOM.

`common.js` es la pieza compartida (configuración, `extractBody`, `buildPrompt`) y se carga **una sola vez** en el background (`background.scripts: ["common.js", "background.js"]`) y en el popup (`<script src="../common.js">`). No dupliques esta lógica.

Flujo: el botón (`message_display_action`, vía `onClicked`) abre `popup/popup.html` en una **ventana propia redimensionable** (`windows.create`, 800×800) con el `messageId` en la URL. La ventana monta el prompt editable (con selección opcional de **agente** y **plantilla**) y, al enviar, manda `sendToCopilot { prompt, newChat, messageId, agentId }` a `background.js`. El background mantiene **una única ventana** de Copilot y entrega el prompt a `content-copilot.js` con handshake por reintentos. El content script —con **selectores centralizados**— selecciona el agente, opcionalmente pulsa "Nuevo chat", escribe en el editor Lexical con un **único** evento `beforeinput` (reintentando y verificando), y envía.

Captura: el content script espera a que el texto de la respuesta se estabilice (`waitForReply`) y emite `copilotReply { text, messageId }`; el background abre composición **HTML** con `messenger.compose.beginReply(messageId, "replyToSender", { body })`. La respuesta se pide **en Markdown** (guía compartida `MARKDOWN_STYLE` + directiva de bloque ```` ```markdown ````) para que salga maquetada.

Novedades v2.1 (ver §17 del spec): desplegable de **agentes** (barra lateral de Copilot), desplegable de **plantillas** (carpetas de Plantillas de TB, `folders.query`/`messages.list`), maquetación **Markdown** siempre, ventana de UI redimensionable, y correlación por `messageId` (sin `pendingMessageId` único). Selectores del DOM de Copilot frágiles → centralizados; degradación al **portapapeles** y **notificación** si falla la captura.

## Restricciones no negociables

- **Manifest V3** con `browser_specific_settings.gecko` (no `applications`, que da advertencia en MV3) y `strict_min_version: "140.0"` (TB ESR 140, probado en 140.11.1). Background como **event page** (`background: { scripts: [...] }`): en MV3 es no persistente por definición, **no declarar `persistent`** (da advertencia). No es service worker. En MV3 no hay `content_scripts` declarativo: el content script se registra en runtime desde el background (API `scripting`/`contentScripts`), lo que es el **spike bloqueante** del proyecto (§15.1 del spec).
- API de Thunderbird siempre vía el objeto global **`messenger`**, nunca `browser` ni `chrome`.
- JavaScript vanilla con `"use strict"`. Sin frameworks, sin bundlers, sin dependencias npm en runtime. Node solo para validación y tooling.
- Permisos: `accountsRead`, `messagesRead`, `compose`, `storage`, `scripting`, `notifications` y `host_permissions` con el dominio de M365 Copilot (no `<all_urls>`; en MV3 `host_permissions` es key separado de `permissions`). Cualquier permiso nuevo se justifica en la especificación antes de añadirse.
- Sin API ni claves, sin telemetría ni terceros: el contenido de los correos solo viaja a M365 Copilot, el destino al que el usuario ya envía datos al usar Copilot. Relevante para RGPD; documentar cualquier cambio en el flujo de datos.
- Toda la dependencia del DOM de Copilot vive en `content-copilot.js` con selectores centralizados en un único objeto, para actualizarlos en un solo sitio cuando Microsoft cambie la interfaz.
- HTML de correos: procesar solo con `DOMParser` para extraer texto. Sin `eval`, `new Function` ni `innerHTML` con contenido remoto (ni de correos ni de Copilot).
- Textos de UI en español; código y nombres de variables en inglés. Prosa de commits en español, imperativo, resumen en una línea.

## Flujo de trabajo

1. Tras cualquier cambio de código, aplicar la skill `revision-mailextension` antes de dar la tarea por cerrada.
2. Para entregar, aplicar la skill `empaquetado-xpi`: valida y genera el `.xpi`.
3. Versionado SemVer en `manifest.json`; cada release sube versión y regenera el paquete.

## Comandos

```bash
# Validación completa: manifest, sintaxis de todos los JS, referencias y tests.
# Es lo que ejecutan el hook de pre-commit, el CI y la release. En Windows sin Node
# en el PATH se relanza solo dentro de WSL.
bash scripts/check.sh            # o: npm run check

# Contraste WCAG AA de los 13 temas, en el editor y como lo recibe el destinatario (Chrome/Edge)
bash scripts/a11y-themes.sh

# Activar el hook de pre-commit (una vez por clon)
git config core.hooksPath .githooks

# Empaquetar con lista blanca (ver skill empaquetado-xpi; misma lista que release.yml)
VERSION=$(node -p "JSON.parse(require('fs').readFileSync('manifest.json')).version")
zip -r "cothunder-${VERSION}.xpi" manifest.json common.js background.js content-copilot.js \
  content-compose.js markdown.js themes.js compose.css icon.svg popup options -x '*.md' -q
```
