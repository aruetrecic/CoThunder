<div align="center">

<img src="icon.svg" alt="" width="72" height="72">

# CoThunder

**Microsoft 365 Copilot dentro de Thunderbird**, con tu sesión de siempre.<br>
Sin API, sin claves y sin telemetría.

[![Última versión](https://img.shields.io/github/v/release/aruetrecic/CoThunder?label=%C3%BAltima%20versi%C3%B3n&color=1a5fb4)](https://github.com/aruetrecic/CoThunder/releases/latest)
[![CI](https://github.com/aruetrecic/CoThunder/actions/workflows/ci.yml/badge.svg)](https://github.com/aruetrecic/CoThunder/actions/workflows/ci.yml)
[![Thunderbird 140+](https://img.shields.io/badge/Thunderbird-140%2B-0a84ff)](https://www.thunderbird.net/)
[![Licencia GPL-3.0](https://img.shields.io/badge/licencia-GPL--3.0-555)](LICENSE)

</div>

> [!TIP]
> ## ⬇️ Descargar
>
> **[Descargar la última versión (`cothunder.xpi`)](https://github.com/aruetrecic/CoThunder/releases/latest/download/cothunder.xpi)**
>
> Todas las versiones y sus notas: **[página de Releases](https://github.com/aruetrecic/CoThunder/releases)** · Qué cambia en cada una: **[CHANGELOG](CHANGELOG.md)**

---

## Índice

- [Qué hace](#qué-hace)
- [Instalar y actualizar](#instalar-y-actualizar)
- [Uso rápido](#uso-rápido)
- [Características](#características)
- [Editor Markdown en la redacción](#editor-markdown-en-la-redacción)
- [Plantillas](#plantillas)
- [Accesibilidad](#accesibilidad)
- [Privacidad y seguridad](#privacidad-y-seguridad)
- [Publicar una versión (mantenimiento)](#publicar-una-versión-mantenimiento)
- [Desarrollo](#desarrollo)

## Qué hace

| Botón | Dónde está | Para qué |
|---|---|---|
| **Preguntar a Copilot** | Barra del visor de un mensaje | Lee el correo abierto, monta un prompt editable y trae la respuesta de Copilot a una **respuesta** lista para revisar. |
| **Crear desde Copilot** | Barra principal | Redacta un **correo nuevo desde cero** (asunto y cuerpo) a partir de tus indicaciones. |
| **Editor Markdown** | Ventana de redacción | Escribes en Markdown a la izquierda y ves el correo maquetado a la derecha; sale con formato en un clic. Con **✨ Mejorar con Copilot** reescribes lo que selecciones. |
| **Menú CoThunder** | Clic derecho sobre un correo de la lista | **Resumir** (uno o varios), **responder aceptando**, **declinando**, **acusar recibo** o con tu prompt, en un clic. **Exportar a Markdown**: descarga el correo como `.md` o pásaselo a Copilot o a un agente con tu petición. |

La extensión no llama a ninguna API: pilota la web de Copilot en una ventana propia, con la sesión que ya tienes iniciada.

## Instalar y actualizar

1. **[Descarga `cothunder.xpi`](https://github.com/aruetrecic/CoThunder/releases/latest/download/cothunder.xpi)** (siempre es la última versión).
2. En Thunderbird: **Herramientas › Complementos y temas › ⚙ › Instalar complemento desde archivo…** y elige el fichero.
3. Pulsa cualquier botón de CoThunder. La primera vez, inicia sesión en Copilot en la ventana que se abre.

Para **actualizar**, repite los pasos 1 y 2 con la versión nueva: se conservan tus ajustes y plantillas. Requiere **Thunderbird ESR 140 o superior**.

## Uso rápido

- **Responder:** abre el correo › **Preguntar a Copilot** › ajusta las opciones › **Enviar a Copilot** (o **Ctrl+Enter**). Al terminar se abre la respuesta lista para revisar.
- **Crear:** **Crear desde Copilot** › describe qué quieres crear (y, si quieres, contexto, idioma y destinatarios) › **Enviar a Copilot**. Se abre un correo nuevo con el asunto y el cuerpo generados.

- **En un clic:** clic derecho sobre un correo › **CoThunder** › *Resumir*, *Responder aceptando*…

Paso a paso completo, con todos los campos: **[manual de uso](docs/MANUAL.md)**. Dentro de Thunderbird, el botón **?** (o **F1**) abre la **ayuda integrada**.

## Características

<details open>
<summary><strong>Comunes a los dos modos</strong></summary>

- **Agente**: *Copilot por defecto* o tus **agentes**: los detecta en el panel de Copilot (↻ para refrescar) y puedes **añadirlos a mano por su enlace** en Opciones.
- **Prompt** y **Formato** desde tus **plantillas de Thunderbird**; **Tono** (formal, cercano, directo, negativa cordial) y **Longitud**.
- **Incluir mi firma**: tu firma de Thunderbird (logo, datos, aviso legal) se añade **en tu equipo** al final del correo generado; Copilot nunca la ve.
- Respuesta **siempre maquetada en Markdown** y **Regenerar** para pedir otra versión.
- **Contexto «Sobre ti»** (en Opciones): nombre, cargo, organización y cómo escribes, para que Copilot adapte el tono. La firma con tus datos la pone Thunderbird: Copilot termina en la despedida.
- Ventana en **pestañas** que cabe en pantallas pequeñas o con escalado del 125-150 %; **Ctrl+Enter** para enviar.
- **Degradación segura**: si falla la escritura en Copilot, el prompt se copia al portapapeles; si no llega la respuesta, se avisa con una notificación.
- **Progreso paso a paso** (abriendo Copilot, escribiendo, esperando con los segundos, recibida) y **Cancelar**.
- **Aviso de sesión caducada**: si no has iniciado sesión en Copilot, te lo dice y deja su ventana delante.
- **Diagnóstico** en Opciones: qué paso técnico falló, sin texto de correos, para arreglar rápido si Microsoft cambia Copilot.
- **Ayuda integrada** y **asistente de bienvenida** la primera vez.

</details>

<details>
<summary><strong>Preguntar a Copilot (respuesta)</strong></summary>

- Prompt con remitente, asunto y cuerpo, limpio de CSS, espacios y caracteres invisibles.
- **Incluir el correo citado** e **Incluir el hilo** (mensajes anteriores, por `References`/`In-Reply-To`).
- **Blindaje anti-inyección** en el prompt y **detección local** de intentos de manipulación, con aviso.
- **Responde en el idioma del correo** (detectado: español, inglés, francés, alemán, portugués, italiano) o en el que elijas.
- **Varias versiones** (2 o 3) para comparar y elegir antes de abrir la respuesta.
- **Resúmenes** de uno o varios correos en una ventana, con *Copiar*.

</details>

<details>
<summary><strong>Crear desde Copilot (correo nuevo)</strong></summary>

- **¿Qué quieres crear?**, **Contexto / notas** e **Idioma** de salida.
- **Para**, **CC** y **CCO** con varias direcciones; las no válidas se marcan en rojo antes de enviar.
- Copilot genera **asunto y cuerpo**; el correo nuevo lleva también la firma y los destinatarios.
- Prompts propios de creación (`Prompt crear - …`).
- Un contador avisa si el prompt es tan largo que Copilot podría cortarlo.

</details>

## Editor Markdown en la redacción

Sustituye a Markdown Here, que dejó de funcionar en las versiones nuevas de Thunderbird. Se enciende con el botón **Editor Markdown** o **Ctrl+Alt+M** (y puede venir activado por defecto desde Opciones).

| En la barra | Qué hace |
|---|---|
| **B I S**, resaltado, `</>`, enlace, cita, listas y tarea | Formato básico, enlace, cita, listas y tareas (iconos propios, también en tema oscuro). |
| **H ▾** · **Aa ▾** | Títulos 1 a 6 · negrita+cursiva, subíndice, superíndice. |
| **Insertar ▾** | Imagen, emoji, tabla, bloque de código, regla, lista de definición, nota al pie. |
| **Avisos ▾** | Avisos: nota, consejo, importante, advertencia, precaución. |
| **Ordenar** | Alinea tablas, tabula listas y separa bloques en el código fuente, sin cambiar el resultado (**Ctrl+Shift+F**). |
| **✨ Mejorar con Copilot ▾** | Reescribe el texto seleccionado: más formal, más cercano, más corto, desarrollar, corregir o traducir (Ctrl+Z lo deshace). |
| **Plantillas ▾** | Inserta tus **plantillas de formato** en el cursor. |
| **Estilo ▾** | Cambia el **estilo** de ese correo al momento. |
| **?** | Abre la ayuda del editor. |

- **Atajos:** Ctrl+B, Ctrl+I, Ctrl+K (enlace), Ctrl+E (código) y Ctrl+1…6 (títulos). **Alt+F10** lleva a la barra, que se maneja con las flechas y Escape.
- **Firma y cita intactas:** tu firma y el correo citado se conservan con su formato original.
- **13 temas** (UPO corporativo, claro, oscuro y mixto; GitHub; Solarized; Monokai; Dracula; Nord; One Dark) más uno **personalizado**. En Opciones puedes **descargar cualquier tema** como `.css` o editarlo como base del tuyo.
- Cobertura completa de Markdown (básico y extendido), resaltado de sintaxis y estilos **en línea** para que el correo se vea igual en cualquier cliente.

## Plantillas

Al instalar se siembra una biblioteca de ejemplo en tu carpeta *Plantillas*. El tipo se distingue por el asunto:

| Asunto | Uso |
|---|---|
| `Prompt - Título` | Instrucción para Copilot al **responder**. |
| `Prompt crear - Título` | Instrucción para Copilot al **crear** un correo. |
| `Formato - Título` (o sin prefijo) | Estructura del correo: se usa como referencia en Copilot y se inserta desde el menú **Plantillas** del editor. |

Las plantillas no llevan pie con datos personales: terminan en la despedida y tu firma la añade Thunderbird.

Para crear las tuyas, redacta un mensaje (en Markdown si quieres), ponle el prefijo en el asunto y usa **Archivo › Guardar como plantilla**.

## Accesibilidad

- Los **13 temas** cumplen el contraste **WCAG 2.1 AA** (4,5:1 en texto) en todos sus elementos: texto, tablas, enlaces, código resaltado, citas y avisos. Se comprueban también **como los ve quien recibe el correo** (modo *quirks*, en el que las tablas no heredan el color), sin tocar los colores corporativos de la UPO.
- La ventana y Opciones cumplen AA en **tema claro y oscuro**, con etiquetas en todos los campos y foco visible.
- Las pruebas se ejecutan en cada push: `bash scripts/a11y-themes.sh`.

## Privacidad y seguridad

El contenido de los correos solo viaja a **Microsoft 365 Copilot**, el mismo destino al que ya envías datos al usar Copilot. Sin telemetría, sin terceros, sin claves. La ventana muestra siempre el prompt antes de enviarlo y la primera vez avisa del tratamiento. Opcionalmente, un **registro de actividad local** (solo metadatos).

**Qué le llega a Copilot y qué no**

| Le llega | No le llega |
|---|---|
| El correo que respondes (remitente, asunto, cuerpo) y, si lo marcas, el hilo | **Tu firma** de Thunderbird: se añade en tu equipo después de la respuesta |
| Tu perfil «Sobre ti» (nombre, cargo, organización, cómo escribes) | **Las firmas dentro del correo leído**: la tuya citada (aunque cambien los saltos de línea), las marcadas por Thunderbird y las de texto plano tras `-- ` |
| Las plantillas de Prompt y Formato que elijas | Contraseñas ni claves: no hay API ni servidores propios, y nada sale hacia otro destino |
| Con **Mejorar con Copilot**, solo el texto que seleccionas; con **Resumir** o **Pasárselo a Copilot**, los correos elegidos (recortados, sin Para/CC) | El **diagnóstico**, el **registro de actividad** y los **.md descargados**: se quedan en tu equipo |

Copilot tiene además la instrucción de **terminar en la despedida**, sin firma ni datos de contacto, para no duplicar tu firma.

Análisis detallado (uso en la UPO y usuario general, ENS y riesgos): **[informe de seguridad](docs/SEGURIDAD.md)**.

## Publicar una versión (mantenimiento)

> [!IMPORTANT]
> Las versiones se publican **solas** al empujar una etiqueta `vX.Y.Z`. El workflow **[Release XPI](https://github.com/aruetrecic/CoThunder/actions/workflows/release.yml)** valida, empaqueta y crea la Release con el `.xpi` y las notas del CHANGELOG.

1. Sube la versión en `manifest.json` (SemVer) y añade su entrada en `CHANGELOG.md`.
2. Comprueba que todo pasa: `bash scripts/check.sh`.
3. Haz commit, crea la etiqueta y empújala:

   ```bash
   git tag v$(node -p "require('./manifest.json').version")
   git push origin main --tags
   ```

4. En unos segundos aparece en **[Releases](https://github.com/aruetrecic/CoThunder/releases)** con dos ficheros iguales: `cothunder-X.Y.Z.xpi` y `cothunder.xpi` (nombre fijo, el que enlaza el botón de descarga).

Para **compilar sin publicar**, lanza *Release XPI* a mano desde **Actions** (`workflow_dispatch`): el `.xpi` queda como artefacto del workflow.

## Desarrollo

Manifest V3, JavaScript vanilla y sin dependencias en runtime (Node solo para validar y probar). Fuente de verdad: **[especificación](spec/docs/ESPECIFICACION.md)**.

```bash
bash scripts/check.sh               # manifest, sintaxis de todos los JS, referencias y tests (o: npm run check)
bash scripts/a11y-themes.sh         # contraste WCAG AA de los 13 temas (necesita Chrome/Edge)
git config core.hooksPath .githooks # activa el pre-commit que ejecuta check.sh
```

En Windows sin Node en el `PATH`, `check.sh` se relanza solo dentro de WSL. Para cargar sin empaquetar: `about:debugging` › Este Thunderbird › Cargar complemento temporal › `manifest.json`.
