#!/usr/bin/env bash
# Prueba de contraste (WCAG AA) de todos los temas del correo con un navegador headless.
# Abre test/a11y/themes-contrast.html, que renderiza un correo de ejemplo con cada tema y
# mide el contraste de cada texto. Sale con error si algún tema no cumple.
# Uso: bash scripts/a11y-themes.sh   (necesita Chrome, Chromium o Edge)
set -euo pipefail
cd "$(dirname "$0")/.."

browser=""
for b in google-chrome chromium chromium-browser microsoft-edge \
         "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
         "/c/Program Files/Google/Chrome/Application/chrome.exe"; do
  if command -v "$b" >/dev/null 2>&1 || [ -x "$b" ]; then browser="$b"; break; fi
done
[ -n "$browser" ] || { echo "a11y: no se encuentra Chrome/Chromium/Edge" >&2; exit 1; }

page="$PWD/test/a11y/themes-contrast.html"
profile="$(mktemp -d)"
if command -v cygpath >/dev/null 2>&1; then
  url="file:///$(cygpath -m "$page")"; profile_arg="$(cygpath -w "$profile")"
else
  url="file://$page"; profile_arg="$profile"
fi

dom="$("$browser" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files \
  --user-data-dir="$profile_arg" --window-size=1300,900 --virtual-time-budget=8000 \
  --dump-dom "$url" 2>/dev/null)"
rm -rf "$profile"

report="$(printf '%s' "$dom" | tr -d '\r' | sed -n '/<pre id="report">/,/<\/pre>/p' \
  | sed -e 's/<pre id="report">//' -e 's#</pre>.*##' -e 's/&lt;/</g' -e 's/&gt;/>/g' -e 's/&amp;/\&/g')"
[ -n "$report" ] || { echo "a11y: la página no produjo informe" >&2; exit 1; }
echo "$report"
if printf '%s' "$report" | grep -q " [1-9][0-9]* fallos"; then
  echo "a11y: hay temas con contraste insuficiente" >&2
  exit 1
fi
echo "a11y OK: todos los temas cumplen WCAG AA"
