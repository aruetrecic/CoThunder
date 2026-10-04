---
name: empaquetado-xpi
description: Validación y empaquetado de la extensión de Thunderbird como fichero .xpi instalable. Usar siempre que el usuario pida empaquetar, generar el xpi, hacer release, subir versión, publicar o entregar la extensión, y también como paso final tras completar un conjunto de cambios listos para probar en Thunderbird.
---

# Empaquetado .xpi

Proceso completo de release. Ejecutar los pasos en orden; si uno falla, parar y corregir.

## 1. Precondición

Ejecutar primero la skill `revision-mailextension`. No se empaqueta código sin revisar.

## 2. Versión

Subir la versión en `manifest.json` según SemVer:

- Corrección de fallo sin cambio de comportamiento: patch.
- Funcionalidad nueva compatible: minor.
- Cambio de permisos, de formato de configuración o de comportamiento visible: major, y anotar la migración en `docs/ESPECIFICACION.md`.

Si el usuario no indica el tipo de cambio, deducirlo del diff y decir qué versión se eligió y por qué.

## 3. Validación previa

Un único script valida todo (manifest SemVer, sintaxis de **todos** los JS, que existan los ficheros referenciados por el manifest, el compose script y las páginas HTML, y los tests). Es el mismo que ejecutan el hook de pre-commit, el CI y la release:

```bash
bash scripts/check.sh      # o: npm run check
```

En Windows sin Node en el PATH se relanza solo dentro de WSL. Si no termina en `check OK`, parar y corregir.

## 4. Empaquetar

Solo entra en el paquete lo que Thunderbird necesita, con **lista blanca**: nada de `test/`, `scripts/`, `docs/`, `spec/`, `package.json` ni ficheros ocultos. La lista vive **solo** en `scripts/build.sh`, que también usa `.github/workflows/release.yml`:

```bash
bash scripts/build.sh      # o: npm run build
```

Borra los `.xpi` anteriores, comprueba que existe cada fichero de la lista, empaqueta, valida el manifest del paquete y muestra el listado. Revisarlo: manifest.json, los JS de la raíz, compose.css, icon.svg, popup/ y options/, y nada más. Si se añade un fichero de runtime nuevo, incluirlo en el array `FILES` de `scripts/build.sh`.

## 5. Verificación del paquete

```bash
VERSION=$(node -p "JSON.parse(require('fs').readFileSync('manifest.json')).version")
mkdir -p /tmp/xpi-check && rm -rf /tmp/xpi-check/* && unzip -q "cothunder-${VERSION}.xpi" -d /tmp/xpi-check
node -e "JSON.parse(require('fs').readFileSync('/tmp/xpi-check/manifest.json')); console.log('paquete OK')"
```

## 6. Cierre

Informar de: versión generada, tamaño del fichero, contenido del paquete y ruta del `.xpi`. Recordar la instalación: Thunderbird, Herramientas, Complementos y temas, engranaje, Instalar complemento desde archivo. Si el repo tiene remoto con releases (GitLab, Gitea, GitHub), proponer etiquetar el commit con `v${VERSION}` y adjuntar el `.xpi` a la release.
