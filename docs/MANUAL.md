# Manual de uso de CoThunder

Guía paso a paso para usar CoThunder en Thunderbird 140 o superior. Para instalar, sigue la [guía de instalación](INSTALACION.md); las características están en el [README](../README.md).

## Índice

1. [Primeros pasos](#1-primeros-pasos)
2. [Responder a un correo (Preguntar a Copilot)](#2-responder-a-un-correo-preguntar-a-copilot)
3. [Crear un correo nuevo (Crear desde Copilot)](#3-crear-un-correo-nuevo-crear-desde-copilot)
4. [Agentes](#4-agentes)
5. [Prompts y Formatos (plantillas)](#5-prompts-y-formatos-plantillas)
6. [Tono, longitud y firma](#6-tono-longitud-y-firma)
7. [Editor Markdown en la redacción](#7-editor-markdown-en-la-redacción)
8. [Privacidad y registro de actividad](#8-privacidad-y-registro-de-actividad)
9. [Opciones](#9-opciones)
10. [Problemas frecuentes](#10-problemas-frecuentes)
11. [Acciones de un clic, resúmenes y versiones](#11-acciones-de-un-clic-resúmenes-y-versiones)
12. [Mejorar con Copilot](#12-mejorar-con-copilot)
13. [Progreso, sesión y diagnóstico](#13-progreso-sesión-y-diagnóstico)
14. [Exportar a Markdown y pasárselo a Copilot](#14-exportar-a-markdown-y-pasárselo-a-copilot)

## 1. Primeros pasos

La primera vez se abre un **asistente de bienvenida** que comprueba tu sesión de Copilot y te deja elegir tema y agente. La **ayuda integrada** está siempre a mano con el botón **?** (o **F1**).

CoThunder añade dos botones y un menú:

- **Preguntar a Copilot**, en la barra del **visor de un mensaje** (cuando tienes un correo abierto). Sirve para **responder**.
- **Crear desde Copilot**, en la **barra principal** de Thunderbird. Sirve para **redactar un correo nuevo desde cero**.
- **CoThunder**, en el menú del **clic derecho** sobre los correos de la lista: acciones de un clic (sección 11).

![Botones Crear desde Copilot y Preguntar a Copilot](manual/01_botones.png)

La primera vez que abras una de las dos ventanas, verás un aviso de que el contenido se envía a Microsoft 365 Copilot. Pulsa **Entendido** para continuar; no vuelve a aparecer.

Arriba de la ventana se indica si **Copilot está abierto y listo**, cargando, sin sesión o cerrado, con un botón para abrirlo. Si está cerrado, se abre solo en segundo plano (se puede desactivar en Opciones › General).

Ambas ventanas necesitan que tengas **sesión iniciada en Copilot**. La primera vez se abre una ventana de Copilot para que inicies sesión; hazlo y deja esa ventana abierta.

## 2. Responder a un correo (Preguntar a Copilot)

1. Abre el correo que quieres responder.
2. Pulsa **Preguntar a Copilot** en la barra del visor. Se abre la ventana de CoThunder con el prompt ya montado a partir del remitente, el asunto y el cuerpo.
3. Ajusta lo que quieras. La ventana tiene dos pestañas, **Opciones** y **Prompt**; el botón **Enviar a Copilot** queda siempre visible abajo:
   - **Indicaciones** (opcional): qué quieres responder, en tus palabras («acepta, pero propón el jueves»). Mandan sobre el resto de opciones.
   - **Agente** (opcional): elige un agente de Copilot para que aporte su conocimiento.
   - **Prompt** y **Formato** (opcional): elige una de tus plantillas.
   - En **Más opciones** (plegable): **Tono**, **Longitud**, **Responder en** (idioma; por defecto el del correo, detectado) y **Versiones** (una, dos o tres para elegir).
   - **Incluir mi firma**, **Incluir el correo citado**, **Incluir el hilo** (mensajes anteriores).
   - **Empezar chat nuevo**: parte de una conversación limpia en Copilot.
   - Edita el **Prompt a enviar** a mano si quieres; la mini barra Markdown ayuda a dar formato.

   ![Pestaña Opciones de Preguntar a Copilot](manual/02_responder_opciones.png)

   ![Pestaña Prompt con el prompt montado](manual/03_responder_prompt.png)
4. Pulsa **Enviar a Copilot** (o **Ctrl+Enter**). Copilot se pone delante para escribir el prompt y la ventana de CoThunder vuelve al frente con el progreso. Si algo falla, el aviso aparece completo junto al botón Enviar.

   ![Copilot recibe el prompt y genera la respuesta](manual/04_copilot.png)
5. Cuando Copilot termina, se abre una **ventana de composición** con la respuesta al remitente, lista para revisar y enviar.

   ![Respuesta abierta en el editor Markdown](manual/04_respuesta.png)
6. Si quieres otra versión, pulsa **Regenerar**: reenvía el prompt en un chat nuevo.

Si el correo contiene un intento de manipular a la IA (inyección), CoThunder lo detecta, te avisa en la ventana y añade una protección al prompt.

## 3. Crear un correo nuevo (Crear desde Copilot)

1. Pulsa **Crear desde Copilot** en la barra principal. No necesitas tener ningún correo abierto.
2. Rellena las pestañas (**Redactar**, **Destinatarios**, **Opciones** y **Prompt**; cambia entre ellas con un clic o con Ctrl+RePág/AvPág):
   - **¿Qué quieres crear?**: describe el correo (por ejemplo, "convocar una reunión de coordinación para el jueves"). Este campo crece con la ventana y tiene su propia barra Markdown.
   - **Contexto / notas** (opcional): propósito, puntos a incluir o a quién va dirigido. Enriquece el prompt; no es el destinatario.
   - **Idioma** (opcional): fuerza el idioma del correo generado.
   - **Para**, **CC** y **CCO** (opcional): los destinatarios. Cada caja admite varias direcciones, una por línea o separadas por comas. Solo se usan las válidas. Admite el formato `Nombre <correo@dominio.com>`.
   - **Agente**, **Prompt**, **Formato**, **Tono**, **Longitud** e **Incluir mi firma**, igual que en el modo respuesta.

   ![Crear desde Copilot, pestaña Redactar](manual/05_crear_redactar.png)

   ![Pestaña Destinatarios con varias direcciones](manual/06_crear_destinatarios.png)
3. Pulsa **Enviar a Copilot** (o **Ctrl+Enter**). Si alguna dirección no es válida, se marca en rojo en **Destinatarios** y CoThunder te avisa antes de enviar.
4. Cuando termina, se abre un **correo nuevo** con el **asunto** y el **cuerpo** generados, la firma (si la marcaste) y los destinatarios en Para, CC y CCO.
5. **Regenerar** pide otra versión.

En este modo, el selector **Prompt** muestra las plantillas pensadas para crear (asunto `Prompt crear - ...`).

## 4. Agentes

CoThunder detecta los agentes que Copilot muestra en su **panel lateral** y guarda su enlace. Pulsa **↻** en la ventana (o **Detectar agentes** en Opciones › General) para actualizar la lista: si Copilot no está abierto, lo abre y espera a que cargue. **Abrir Copilot**, al lado, solo abre Copilot (por ejemplo, para iniciar sesión antes). Recuerda el último agente que usaste.

![Selector de agente](manual/07_agentes.png)

**Si un agente no aparece**, añádelo a mano en **Opciones › General › Agentes de Copilot**: un nombre y su enlace. Para conseguir el enlace, abre `https://m365.cloud.microsoft/chat` en el navegador, entra en el agente desde el panel izquierdo y copia la dirección (suele contener `titleId=`). Con el enlace, CoThunder abre el agente aunque no esté visible en el panel.

## 5. Prompts y Formatos (plantillas)

Son plantillas normales de Thunderbird (carpeta *Plantillas*, de cualquier cuenta, incluida *Carpetas locales*). Se distinguen por el asunto:

- `Prompt - Título`: instrucción de **respuesta** (selector Prompt en modo respuesta).
- `Prompt crear - Título`: instrucción de **creación** (selector Prompt en modo creación).
- `Formato - Título`: estructura y formato de referencia (se comparte entre los dos modos).

![Prompts en la carpeta Plantillas](manual/08_plantillas.png)

Para crear una: redacta un mensaje (puedes escribirlo en Markdown), ponle uno de esos prefijos en el asunto y haz **Archivo → Guardar como plantilla**. Usa huecos tipo `[nombre]`, `[fecha]`, `[motivo]` para que Copilot los rellene, o escribe la plantilla como modelo de estructura y tono para que la siga.

Al instalar CoThunder se crea una **biblioteca de ejemplo** con varios Prompts, Prompts de creación y Formatos listos para usar.

## 6. Tono, longitud y firma

- **Tono**: formal, cercano, directo o negativa cordial.
- **Longitud**: breve, normal o detallada.
- **Incluir mi firma**: añade la firma configurada en tu identidad de Thunderbird.

CoThunder recuerda tus preferencias.

## 7. Editor Markdown en la redacción

La respuesta llega en Markdown (con `#`, `**`, listas, tablas, citas). CoThunder trae su **propio editor**: escribes a la izquierda y ves el correo maquetado a la derecha; al enviar sale ya con formato. Se enciende y apaga con el botón **Editor Markdown** o con **Ctrl+Alt+M**.

![Barra del editor Markdown en la redacción](manual/09_editor_markdown.png)

- **Barra de herramientas:** negrita, cursiva, tachado, resaltado, código, enlace, cita y listas, más los menús **H ▾** (títulos 1 a 6), **Aa ▾** (negrita+cursiva, subíndice, superíndice), **Insertar ▾** (imagen, tabla, bloque de código, regla, definición, nota al pie) y **Avisos ▾**.
- **Emoji:** el botón de emoji (también en los campos de texto de la ventana) abre un selector con búsqueda en español («gracias», «reunión», «ok»), categorías y recientes. Inserta el emoji en el cursor. Los botones usan iconos propios; pasa el ratón por encima para ver su nombre.
- **Ordenar** (o **Ctrl+Shift+F**): deja el código fuente limpio sin cambiar el resultado: alinea las columnas de las tablas, tabula las listas anidadas (4 espacios por nivel), deja una línea en blanco entre bloques y quita espacios sobrantes. Se deshace con Ctrl+Z. La zona de escritura usa letra monoespaciada para que la alineación se vea.
- **Listas y tablas línea a línea:** puedes escribir cada elemento de una lista o cada fila de una tabla pulsando Enter; CoThunder las une en una sola lista o tabla (antes cada Enter partía la lista).
- **✨ Mejorar con Copilot ▾:** reescribe el texto seleccionado (sección 12).
- **Plantillas ▾:** inserta en el cursor una plantilla de formato (Carta institucional, Tabla comparativa, Identidad UPO… y las tuyas sin prefijo). Las de tipo «Prompt» no aparecen: son instrucciones para Copilot, no texto del correo. «↻ Actualizar lista» relee la carpeta de Plantillas.
- **Estilo ▾:** cambia el tema de ese correo al momento. El tema por defecto se elige en Opciones.
- **Atajos:** Ctrl+B negrita, Ctrl+I cursiva, Ctrl+K enlace, Ctrl+E código, Ctrl+1 … Ctrl+6 títulos (si la línea ya era un título, cambia el nivel).
- **Barra con el teclado:** **Alt+F10** lleva a la barra. Las flechas izquierda y derecha pasan de un botón a otro; Enter o flecha abajo abre un menú y las flechas arriba y abajo recorren sus opciones. **Escape** vuelve atrás: primero al botón y luego al texto, con el cursor donde estaba. Si Thunderbird está en tema oscuro, la barra también.
- **Firma y cita intactas:** tu firma de Thunderbird y el correo citado se conservan tal cual, con su formato original; solo se convierte a Markdown lo que escribes tú.

## 8. Privacidad y registro de actividad

- El contenido solo viaja a Microsoft 365 Copilot. Sin telemetría ni terceros.
- La primera vez, la ventana te avisa del tratamiento.
- Puedes activar un **registro de actividad local** en Opciones: guarda solo metadatos (fecha, modo y número de destinatarios), nunca el asunto, las direcciones ni el cuerpo. Se puede exportar a JSON y vaciar.

## 9. Opciones

Desde **Complementos y temas → CoThunder → Opciones**. La página tiene cinco pestañas: **General** (chat nuevo, editor Markdown y, en *Avanzado*, la dirección de Copilot y la instrucción base), **Aspecto del correo** (tema, color y tu propio tema), **Sobre ti**, **Privacidad** (registro de actividad y diagnóstico) y **Ayuda**. **Guardar cambios**, siempre visible abajo, guarda las tres primeras.

![Opciones de CoThunder, pestaña General](manual/11_opciones.png)

En detalle:

- **URL del chat de Copilot** y **plantilla base del prompt**.
- **Empezar chat nuevo por defecto**.
- **Sobre ti (contexto para Copilot)**: nombre, puesto o cargo, organización, qué haces y **cómo escribes** (tratamiento de usted o tú, tono, cómo te despides). Se añade al prompt en los dos modos para que Copilot sepa quién eres y adapte el tono y el rol. Copilot termina en la despedida, **sin firma ni datos de contacto**: los pone la firma de tu identidad de Thunderbird (casilla **Incluir mi firma**). El botón **«Tomar de mi identidad de Thunderbird»** rellena nombre y organización desde tu identidad por defecto (solo los campos vacíos); revisa y pulsa Guardar. Se guarda solo en tu equipo.
- **Registro de actividad (auditoría)**: activar, ver el número de entradas, exportar y vaciar.
- **Diagnóstico**: copiar o vaciar el registro técnico (sección 13).
- Enlaces a la **ayuda** y al **asistente de bienvenida**.

## 10. Problemas frecuentes

- **No escribe en Copilot / no captura la respuesta:** comprueba que tienes sesión iniciada en Copilot en la ventana que abre CoThunder. Si la interfaz de Copilot cambió, el prompt se copia al portapapeles y se avisa; pégalo a mano mientras se actualiza CoThunder.
- **La respuesta no se ve maquetada:** activa el editor Markdown con su botón o con Ctrl+Alt+M (sección 7).
- **No aparece mi agente:** pulsa **↻** con Copilot abierto; si sigue sin salir, añádelo a mano con su enlace (sección 4).
- **La ventana se ve pequeña o los campos apretados:** puedes redimensionarla; recuerda su tamaño. Si no cabe todo, aparece una barra de scroll.
- **Acabo de recargar la extensión y otro complemento (Markdown Here) no responde:** reinicia Thunderbird; recargar una extensión temporal puede dejar otros complementos en estado inconsistente.

## 11. Acciones de un clic, resúmenes y versiones

**Menú CoThunder.** Clic derecho sobre un correo de la lista (o sobre el botón *Preguntar a Copilot* del visor) › **CoThunder**:

![Menú CoThunder en el clic derecho](manual/12_menu_contextual.png)

- **Resumir con Copilot**: se abre una ventana con el resumen (lo esencial, lo que te piden, plazos y si requiere respuesta). Con **varios correos seleccionados** (hasta 10) hace un único resumen con lo pendiente de responder. Botones **Copiar** y, si es un solo correo, **Responder…**.

  ![Ventana de resumen](manual/13_resumen.png)
- **Responder aceptando**, **Responder declinando**, **Acusar recibo** y **Responder con mi prompt** (tus plantillas `Prompt - …`): envían directamente con tus últimos ajustes (agente, tono, longitud, firma, cita) en el idioma del correo. Una notificación lo confirma y la respuesta se abre sola.

**Varias versiones.** En la ventana, *Más opciones › Versiones › Dos* o *Tres*. Se abre una ventana con una pestaña por versión; pulsa **Usar esta versión**.

## 12. Mejorar con Copilot

En el editor Markdown, selecciona un trozo de tu borrador y elige en el menú ✨ **Más formal**, **Más cercano**, **Más corto**, **Desarrollar**, **Corregir**, **Traducir al inglés** o **Traducir al español**. Al llegar, el texto nuevo sustituye a la selección; **Ctrl+Z** lo deshace. Solo se envía el texto seleccionado.

![Menú Mejorar con Copilot sobre un texto seleccionado](manual/10_mejorar.png)

## 13. Progreso, sesión y diagnóstico

- Al enviar, la ventana muestra los pasos (**Abriendo Copilot → Escribiendo → Esperando** con los segundos **→ Recibida**) y el botón **Cancelar**.
- Si no has iniciado sesión en Copilot, CoThunder lo detecta, pone su ventana delante y te lo dice.
- **Opciones › Diagnóstico** guarda qué paso técnico falló (sin texto de correos). Si algo deja de funcionar, pulsa **Copiar diagnóstico** y envíalo a quien mantiene CoThunder.

## 14. Exportar a Markdown y pasárselo a Copilot

Clic derecho sobre uno o varios correos › **CoThunder › Exportar a Markdown / preguntar a Copilot…**, o el botón **⬇ .md** de la ventana de respuesta. Se abre una ventana con:

![Menú CoThunder › Exportar a Markdown / preguntar a Copilot](manual/14_exportar.png)

- **Vista** (el correo maquetado) y **Markdown** (el código, que puedes retocar).
- **Descargar .md**: guarda el fichero con la fecha y el asunto como nombre. Incluye remitente, destinatarios, fecha, lista de adjuntos y el cuerpo con su formato.
- **Copiar Markdown**.
- **Pasárselo a Copilot**: elige el agente, escribe qué quieres (por ejemplo, «extrae fechas y tareas») o déjalo vacío para que lo resuma, y pulsa **Enviar a Copilot**. La respuesta se abre en una ventana y queda en el chat para seguir preguntando allí. Se envía sin tu firma ni las direcciones de Para y CC.
