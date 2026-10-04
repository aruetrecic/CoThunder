#!/usr/bin/env bash
# Construye el .xpi de CoThunder con la LISTA BLANCA de ficheros de runtime (única fuente: la
# usan la skill empaquetado-xpi y la release). Comprueba que existen, empaqueta y verifica que
# el manifest del paquete es JSON válido. Imprime la ruta del .xpi en la última línea.
# Uso: bash scripts/build.sh   (requiere zip, unzip y node; no valida el código: antes, scripts/check.sh)
set -euo pipefail
cd "$(dirname "$0")/.."

# Si se añade un fichero de runtime, va aquí y en ningún otro sitio.
FILES=(manifest.json common.js background.js content-copilot.js content-compose.js markdown.js
       themes.js compose.css icon.svg popup options)

for f in "${FILES[@]}"; do
  [ -e "$f" ] || { echo "build: falta $f" >&2; exit 1; }
done

if command -v node >/dev/null 2>&1; then
  VERSION=$(node -p "JSON.parse(require('fs').readFileSync('manifest.json')).version")
else
  VERSION=$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' manifest.json | head -1)
fi
[ -n "$VERSION" ] || { echo "build: no se puede leer la versión del manifest" >&2; exit 1; }

XPI="cothunder-${VERSION}.xpi"
rm -f cothunder-*.xpi
zip -r -q "$XPI" "${FILES[@]}" -x '*.md'

# El paquete se abre y su manifest se lee como JSON.
unzip -p "$XPI" manifest.json | { if command -v node >/dev/null 2>&1; then
  node -e 'JSON.parse(require("fs").readFileSync(0, "utf8"))'; else cat >/dev/null; fi; }
unzip -l "$XPI"
echo "$XPI"
