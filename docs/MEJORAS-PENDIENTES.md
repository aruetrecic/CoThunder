# Mejoras pendientes

Propuestas tras la v2.12.0 (4 de octubre de 2026; actualizado el 5 de octubre con la v2.14.0), ordenadas por prioridad. Esfuerzo: **B** bajo, **M** medio, **A** alto.

## 1. Primero: verificar en Thunderbird real

Todo lo de las versiones 2.7–2.12 se ha probado en Edge headless, no dentro de Thunderbird. Antes de seguir construyendo:

- [x] **Lista de comprobación manual** (`docs/PRUEBAS-THUNDERBIRD.md`) y pasarla una vez: menús de la barra (se abren y se cierran), 🎨 Estilo, 📄 Plantillas con la carpeta real, **⇥ Ordenar + Ctrl+Z**, atajos (que Ctrl+B no aplique además la negrita de Thunderbird), firma de la UPO intacta en vista previa y en el correo enviado, lista escrita con Enter = una sola lista, ventana al 50 % de alto, pestañas y Ctrl+Enter. **B**
- [x] **Firma fuera del prompt (v2.13.2):** responder a un correo que cite tu firma y comprobar en la pestaña 📜 Prompt que no aparece (ni el logo ni el aviso legal), y que «Cómo escribo» ya no tiene el «Firmo así: …». **B**
- [ ] **Límite real del prompt de Copilot:** el aviso usa 16.000 caracteres como estimación. Medirlo y ajustar `PROMPT_MAX`. **B**

## 2. Accesibilidad y robustez del correo (alta)

- [x] **Menús de la barra accesibles con el teclado:** hoy no tienen `aria-expanded` ni se manejan con las flechas. Añadir flechas arriba/abajo, Enter, Escape, devolver el foco al editor y un atajo para enfocar la barra (por ejemplo Alt+F10). Es un fallo de accesibilidad (WCAG 2.1.1). **M**
- [ ] **Temas oscuros a prueba de Outlook:** algunos clientes quitan el fondo del contenedor y el texto claro queda sobre blanco. Usar el patrón seguro de correo: envolver el cuerpo en una `<table>` con `bgcolor` y fondo en línea, y probarlo con la misma batería de contraste. **M**
- [x] **Barra y vista previa en tema oscuro:** la barra del editor es siempre clara (#f6f8fa) aunque Thunderbird esté en oscuro. Usar colores del sistema (`Canvas`/`CanvasText`) y pasar el auditor de interfaz. **B**
- [ ] **Pruebas del editor en el CI:** como el banco de contraste, una página headless que pruebe los botones y menús, `prefixLine`, Ordenar (idempotente, firma intacta) y `bodySegments`. Evita regresiones como la de «Saludos--». **M**

## 3. Editor Markdown (media)

- [ ] **«Usar siempre este estilo»** como última opción del menú 🎨, para guardarlo como predeterminado sin ir a Opciones. **B**
- [ ] **Pegar desde Excel o Calc → tabla Markdown** (el portapapeles trae texto separado por tabuladores), ya alineada. **M**
- [ ] **Ordenar con imágenes:** hoy se salta los tramos con imágenes insertadas; conservar los `<img>` al reescribir. Renumerar también las listas numeradas (1., 2., 3.). **M**
- [ ] **Scroll sincronizado** entre el texto y la vista previa en correos largos. **M**
- [ ] **Plantillas «Prompt» en el menú 📄** como opción (desactivada por defecto). **B**

## 4. Ventana de Copilot y Opciones (media)

- [ ] **Vista previa del tema en Opciones:** un correo de ejemplo que cambia al elegir tema o editar el CSS personalizado. **M**
- [ ] **Botón «Probar conexión con Copilot»:** comprueba que los selectores del DOM siguen funcionando y avisa si Microsoft ha cambiado la interfaz. **M**
- [ ] **Prompts recientes:** recuperar los últimos textos de «¿Qué quieres crear?». **M**

## 5. Mantenimiento (baja, rápido)

- [x] **Cabecera de la especificación desfasada:** dice «Versión 2.4.0»; ponerla en 2.12 con un resumen de las secciones §22–§28. **B**
- [x] **Clasificación de plantillas duplicada:** `popup.js` repite las expresiones de `formatTemplates()` (`common.js`); unificarlas. **B**
- [x] **Saltos de línea:** tras el `.gitattributes`, normalizar la copia de trabajo a LF para que desaparezcan los avisos CRLF en cada commit. **B**
- [x] **Scripts de construcción:** pasar la construcción del `.xpi` a `scripts/build.sh` (hoy está en la skill y en `release.yml`), con la lista blanca en un solo sitio. **B**

## Por dónde empezar mañana

1. Lista de comprobación en Thunderbird (punto 1) y corregir lo que salga.
2. Menús accesibles con el teclado y barra en tema oscuro (punto 2).
3. Paquete rápido de mantenimiento (punto 5).

## 6. Propuestas del 5 de octubre (hechas en la v2.15.0)

- [x] «Mejorar con Copilot» en el editor.
- [x] Acciones de un clic (menú contextual).
- [x] Varias versiones para elegir.
- [x] Responder en el idioma del remitente.
- [x] Resumen de varios correos.
- [ ] **Texto de los adjuntos** (`.txt`, `.md`, `.csv`) tras una casilla desactivada por defecto. Pendiente de decisión: cambia lo que viaja a Copilot (RGPD). **A**
- [x] Progreso por pasos con «Cancelar».
- [x] Iconos SVG en la barra del editor.
- [x] Asistente de primera vez.
- [x] Ventana más compacta («Más opciones»).
- [x] Aviso de sesión caducada.
- [x] Diagnóstico exportable.
- [x] Ayuda integrada con todas las funciones.

## 7. Usabilidad (análisis del 5 de octubre)

- [x] Campo «Indicaciones» al responder (v2.19.0).
- [x] Que Copilot no tape la ventana al enviar (v2.19.0).
- [x] Errores completos junto a Enviar, con acción (v2.19.0).
- [x] Un solo indicador de estado y un solo «Abrir Copilot» (v2.19.0).
- [ ] Pestaña Prompt: resumen de lo que se envía y el texto completo plegado. **M**
- [ ] Iconos SVG en lugar de emoji en las etiquetas de la ventana (aspecto profesional). Los emoji, para el texto de los usuarios. **B**
- [ ] «Más opciones» plegado con el resumen de lo elegido («Formal · Breve · Inglés»). **B**
- [ ] Atajos de teclado globales: preguntar a Copilot y resumir el correo abierto. **B**
- [ ] Cerrar la ventana sola al abrirse la respuesta (opcional). **B**
- [ ] Opciones con guardado automático, sin botón Guardar. **B**
- [ ] «Guardar como prompt» desde la ventana (crea la plantilla con el prefijo correcto). **M**
- [ ] Progreso y Cancelar también en las acciones de un clic. **M**
- [ ] Aviso de «Novedades» tras actualizar. **B**
- [ ] Editor: ocultar la vista previa o cambiar el reparto en pantallas pequeñas. **B**
