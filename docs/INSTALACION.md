# Instalar CoThunder

Guía con capturas para instalar CoThunder en **Thunderbird ESR 140 o superior**. Para el uso diario, consulta el [manual de uso](MANUAL.md).

## 1. Descarga el complemento

Entra en [github.com/aruetrecic/CoThunder](https://github.com/aruetrecic/CoThunder) y pulsa **Descargar la última versión (`cothunder.xpi`)**. El fichero se guarda en tu carpeta *Descargas*.

![Enlace de descarga en la página del proyecto](instalacion/000_install_cothunder.png)

## 2. Abre «Complementos y temas»

En Thunderbird, ve a **Herramientas › Complementos y temas**.

![Menú Herramientas › Complementos y temas](instalacion/001_install_cothunder.png)

## 3. Instala desde el fichero

En el **Administrador de complementos**, pulsa el engranaje **⚙** junto a *Administre sus extensiones* y elige **Instalar complemento desde archivo…**.

![Menú del engranaje › Instalar complemento desde archivo…](instalacion/0026_install_cothunder.png)

Selecciona `cothunder.xpi` en *Descargas* y pulsa **Abrir**.

![Selección de cothunder.xpi](instalacion/002_install_cothunder.png)

## 4. Acepta los permisos

Thunderbird muestra los permisos que necesita CoThunder (acceso a Copilot en `m365.cloud.microsoft`, leer tus cuentas y mensajes, redactar y mostrar notificaciones). Pulsa **Añadir**.

![Permisos requeridos al añadir CoThunder](instalacion/003_install_cothunder.png)

Qué se hace con cada permiso: [informe de seguridad](SEGURIDAD.md).

## 5. Configuración inicial

Se abre la pantalla **Bienvenida a CoThunder**, con tres pasos:

1. **Inicia sesión en Microsoft 365 Copilot**: pulsa **Abrir Copilot**, entra con tu cuenta y deja esa ventana abierta. Luego pulsa **Comprobar**.
2. **Elige el aspecto de tus correos**: el *Tema* que da formato a lo que escribes en Markdown.
3. **Agente por defecto** (opcional): si usas agentes de Copilot, elige el que responderá por defecto. La lista se rellena al comprobar la sesión del paso 1.

![Pantalla de bienvenida](instalacion/004_install_cothunder.png)

Los temas disponibles son: Por defecto, UPO corporativo, GitHub, Solarized, Monokai, Dracula, Nord, One Dark y las variantes UPO claro, oscuro y mixto. Puedes cambiarlo después en cada correo.

![Selector de tema](instalacion/005_install_cothunder.png)

Pulsa **Empezar** y listo. Puedes volver a esta pantalla desde la ayuda.

## Actualizar

Repite los pasos 1 a 4 con la versión nueva: se conservan tus ajustes y plantillas.
