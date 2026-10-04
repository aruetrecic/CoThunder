# Manual de uso de CoThunder

Guía paso a paso para usar CoThunder en Thunderbird 140 o superior. Para instalar y ver las características, consulta el [README](../README.md).

## Índice

1. [Primeros pasos](#1-primeros-pasos)
2. [Responder a un correo (Preguntar a Copilot)](#2-responder-a-un-correo-preguntar-a-copilot)
3. [Crear un correo nuevo (Crear desde Copilot)](#3-crear-un-correo-nuevo-crear-desde-copilot)
4. [Agentes](#4-agentes)
5. [Prompts y Formatos (plantillas)](#5-prompts-y-formatos-plantillas)
6. [Tono, longitud y firma](#6-tono-longitud-y-firma)
7. [Ver el Markdown maquetado](#7-ver-el-markdown-maquetado)
8. [Privacidad y registro de actividad](#8-privacidad-y-registro-de-actividad)
9. [Opciones](#9-opciones)
10. [Problemas frecuentes](#10-problemas-frecuentes)

## 1. Primeros pasos

CoThunder añade dos botones:

- **Preguntar a Copilot**, en la barra del **visor de un mensaje** (cuando tienes un correo abierto). Sirve para **responder**.
- **Crear desde Copilot**, en la **barra principal** de Thunderbird. Sirve para **redactar un correo nuevo desde cero**.

La primera vez que abras una de las dos ventanas, verás un aviso de que el contenido se envía a Microsoft 365 Copilot. Pulsa **Entendido** para continuar; no vuelve a aparecer.

Ambas ventanas necesitan que tengas **sesión iniciada en Copilot**. La primera vez se abre una ventana de Copilot para que inicies sesión; hazlo y deja esa ventana abierta.

## 2. Responder a un correo (Preguntar a Copilot)

1. Abre el correo que quieres responder.
2. Pulsa **Preguntar a Copilot** en la barra del visor. Se abre la ventana de CoThunder con el prompt ya montado a partir del remitente, el asunto y el cuerpo.
3. Ajusta lo que quieras. La ventana tiene dos pestañas, **⚙️ Opciones** y **📜 Prompt**; el botón **Enviar a Copilot** queda siempre visible abajo:
   - **Agente** (opcional): elige un agente de Copilot para que aporte su conocimiento.
   - **Prompt** y **Formato** (opcional): elige una de tus plantillas.
   - **Tono** y **Longitud** (opcional).
   - **Incluir mi firma**, **Incluir el correo citado**, **Incluir el hilo** (mensajes anteriores).
   - **Empezar chat nuevo**: parte de una conversación limpia en Copilot.
   - Edita el **Prompt a enviar** a mano si quieres; la mini barra Markdown ayuda a dar formato.
4. Pulsa **Enviar a Copilot** (o **Ctrl+Enter**). Se abre Copilot, escribe el prompt y lo envía.
5. Cuando Copilot termina, se abre una **ventana de composición** con la respuesta al remitente, lista para revisar y enviar.
6. Si quieres otra versión, pulsa **Regenerar**: reenvía el prompt en un chat nuevo.

Si el correo contiene un intento de manipular a la IA (inyección), CoThunder lo detecta, te avisa en la ventana y añade una protección al prompt.

## 3. Crear un correo nuevo (Crear desde Copilot)

1. Pulsa **Crear desde Copilot** en la barra principal. No necesitas tener ningún correo abierto.
2. Rellena las pestañas (**✍️ Redactar**, **✉️ Destinatarios**, **⚙️ Opciones** y **📜 Prompt**; cambia entre ellas con un clic o con Ctrl+RePág/AvPág):
   - **¿Qué quieres crear?**: describe el correo (por ejemplo, "convocar una reunión de coordinación para el jueves"). Este campo crece con la ventana y tiene su propia barra Markdown.
   - **Contexto / notas** (opcional): propósito, puntos a incluir o a quién va dirigido. Enriquece el prompt; no es el destinatario.
   - **Idioma** (opcional): fuerza el idioma del correo generado.
   - **Para**, **CC** y **CCO** (opcional): los destinatarios. Cada caja admite varias direcciones, una por línea o separadas por comas. Solo se usan las válidas. Admite el formato `Nombre <correo@dominio.com>`.
   - **Agente**, **Prompt**, **Formato**, **Tono**, **Longitud** e **Incluir mi firma**, igual que en el modo respuesta.
3. Pulsa **Enviar a Copilot** (o **Ctrl+Enter**). Si alguna dirección no es válida, se marca en rojo en **Destinatarios** y CoThunder te avisa antes de enviar.
4. Cuando termina, se abre un **correo nuevo** con el **asunto** y el **cuerpo** generados, la firma (si la marcaste) y los destinatarios en Para, CC y CCO.
5. **Regenerar** pide otra versión.

En este modo, el selector **Prompt** muestra las plantillas pensadas para crear (asunto `Prompt crear - ...`).

## 4. Agentes

CoThunder lista los agentes que tienes **fijados en la barra lateral** de Copilot. Para que uno aparezca en el selector, fíjalo en Copilot y pulsa el botón **↻** en la ventana de CoThunder para refrescar la lista. Recuerda el último agente que usaste.

## 5. Prompts y Formatos (plantillas)

Son plantillas normales de Thunderbird (carpeta *Plantillas*, de cualquier cuenta, incluida *Carpetas locales*). Se distinguen por el asunto:

- `Prompt - Título`: instrucción de **respuesta** (selector Prompt en modo respuesta).
- `Prompt crear - Título`: instrucción de **creación** (selector Prompt en modo creación).
- `Formato - Título`: estructura y formato de referencia (se comparte entre los dos modos).

Para crear una: redacta un mensaje (puedes escribirlo en Markdown), ponle uno de esos prefijos en el asunto y haz **Archivo → Guardar como plantilla**. Usa huecos tipo `[nombre]`, `[fecha]`, `[motivo]` para que Copilot los rellene, o escribe la plantilla como modelo de estructura y tono para que la siga.

Al instalar CoThunder se crea una **biblioteca de ejemplo** con varios Prompts, Prompts de creación y Formatos listos para usar.

## 6. Tono, longitud y firma

- **Tono**: formal, cercano, directo o negativa cordial.
- **Longitud**: breve, normal o detallada.
- **Incluir mi firma**: añade la firma configurada en tu identidad de Thunderbird.

CoThunder recuerda tus preferencias.

## 7. Editor Markdown en la redacción

La respuesta llega en Markdown (con `#`, `**`, listas, tablas, citas). CoThunder trae su **propio editor**: escribes a la izquierda y ves el correo maquetado a la derecha; al enviar sale ya con formato. Se enciende y apaga con el botón **Editor Markdown** o con **Ctrl+Alt+M**.

- **Barra de herramientas:** negrita, cursiva, tachado, resaltado, código, enlace, cita y listas, más los menús **H ▾** (títulos 1 a 6), **Aa ▾** (negrita+cursiva, subíndice, superíndice), **▦ ▾** (imagen, emoji, tabla, bloque de código, regla, definición, nota al pie) y **ℹ ▾** (avisos).
- **⇥ Ordenar** (o **Ctrl+Shift+F**): deja el código fuente limpio sin cambiar el resultado: alinea las columnas de las tablas, tabula las listas anidadas (4 espacios por nivel), deja una línea en blanco entre bloques y quita espacios sobrantes. Se deshace con Ctrl+Z. La zona de escritura usa letra monoespaciada para que la alineación se vea.
- **Listas y tablas línea a línea:** puedes escribir cada elemento de una lista o cada fila de una tabla pulsando Enter; CoThunder las une en una sola lista o tabla (antes cada Enter partía la lista).
- **📄 ▾ Plantillas:** inserta en el cursor una plantilla de formato (Carta institucional, Tabla comparativa, Identidad UPO… y las tuyas sin prefijo). Las de tipo «Prompt» no aparecen: son instrucciones para Copilot, no texto del correo. «↻ Actualizar lista» relee la carpeta de Plantillas.
- **🎨 ▾ Estilo:** cambia el tema de ese correo al momento. El tema por defecto se elige en Opciones.
- **Atajos:** Ctrl+B negrita, Ctrl+I cursiva, Ctrl+K enlace, Ctrl+E código, Ctrl+1 … Ctrl+6 títulos (si la línea ya era un título, cambia el nivel).
- **Firma y cita intactas:** tu firma de Thunderbird y el correo citado se conservan tal cual, con su formato original; solo se convierte a Markdown lo que escribes tú.

## 8. Privacidad y registro de actividad

- El contenido solo viaja a Microsoft 365 Copilot. Sin telemetría ni terceros.
- La primera vez, la ventana te avisa del tratamiento.
- Puedes activar un **registro de actividad local** en Opciones: guarda solo metadatos (fecha, modo y número de destinatarios), nunca el asunto, las direcciones ni el cuerpo. Se puede exportar a JSON y vaciar.

## 9. Opciones

Desde **Complementos y temas → CoThunder → Opciones** (o el botón **?** de la ventana):

- **URL del chat de Copilot** y **plantilla base del prompt**.
- **Empezar chat nuevo por defecto**.
- **Sobre ti (contexto para Copilot)**: nombre, puesto o cargo, organización, qué haces y **cómo escribes** (tratamiento de usted o tú, tono y firma). Se añade al prompt en los dos modos para que Copilot sepa quién eres y adapte el tono, el rol y la firma. El botón **«Tomar de mi identidad de Thunderbird»** rellena nombre, organización y firma desde tu identidad por defecto (solo los campos vacíos); revisa y pulsa Guardar. Se guarda solo en tu equipo.
- **Registro de actividad (auditoría)**: activar, ver el número de entradas, exportar y vaciar.
- Guía de uso resumida.

## 10. Problemas frecuentes

- **No escribe en Copilot / no captura la respuesta:** comprueba que tienes sesión iniciada en Copilot en la ventana que abre CoThunder. Si la interfaz de Copilot cambió, el prompt se copia al portapapeles y se avisa; pégalo a mano mientras se actualiza CoThunder.
- **La respuesta no se ve maquetada:** instala Markdown Here Revival (sección 7).
- **No aparece mi agente:** fíjalo en la barra lateral de Copilot y pulsa **↻**.
- **La ventana se ve pequeña o los campos apretados:** puedes redimensionarla; recuerda su tamaño. Si no cabe todo, aparece una barra de scroll.
- **Acabo de recargar la extensión y otro complemento (Markdown Here) no responde:** reinicia Thunderbird; recargar una extensión temporal puede dejar otros complementos en estado inconsistente.
