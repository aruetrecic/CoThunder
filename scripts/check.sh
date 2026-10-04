#!/usr/bin/env bash
# Comprobación completa de CoThunder: manifest, sintaxis de todos los JS, ficheros
# referenciados y tests. La usan el hook de pre-commit, el CI y la release.
# Uso: bash scripts/check.sh   (o: npm run check)
set -euo pipefail
cd "$(dirname "$0")/.."

# En Windows sin Node en el PATH, se relanza dentro de WSL si está disponible.
if ! command -v node >/dev/null 2>&1; then
  if command -v wsl.exe >/dev/null 2>&1 && command -v cygpath >/dev/null 2>&1; then
    win_dir="$(cygpath -w "$PWD")"
    exec wsl.exe bash -lc "cd \"\$(wslpath '$win_dir')\" && bash scripts/check.sh"
  fi
  echo "check: no se encuentra node; instala Node.js para validar" >&2
  exit 1
fi

node -e '
const m = JSON.parse(require("fs").readFileSync("manifest.json"));
if (!/^\d+\.\d+\.\d+$/.test(m.version)) throw new Error("version no SemVer: " + m.version);
console.log("manifest OK, version " + m.version);
'

fail=0
while IFS= read -r f; do
  node --check "$f" || { echo "FALLA sintaxis: $f"; fail=1; }
done < <(find . -name '*.js' -not -path './node_modules/*' -not -path './.*' -not -path './docs/*')
[ "$fail" -eq 0 ] && echo "sintaxis JS OK"

# Todo fichero que referencian el manifest, el background y las páginas HTML existe.
node -e '
const fs = require("fs"), path = require("path");
const m = JSON.parse(fs.readFileSync("manifest.json"));
const refs = new Set([...(m.background?.scripts || []), m.options_ui?.page, ...Object.values(m.icons || {})].filter(Boolean));
const bg = fs.readFileSync("background.js", "utf8").match(/COMPOSE_SCRIPT = \{[^}]*\}/);
if (bg) for (const f of bg[0].match(/"[\w./-]+\.(js|css)"/g) || []) refs.add(f.slice(1, -1));
for (const html of ["popup/popup.html", "options/options.html", ...fs.readdirSync("pages").filter((f) => f.endsWith(".html")).map((f) => "pages/" + f)]) {
  for (const [, src] of fs.readFileSync(html, "utf8").matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg))"/g)) {
    refs.add(path.normalize(path.join(path.dirname(html), src)).replace(/\\/g, "/"));
  }
}
const missing = [...refs].filter((r) => !fs.existsSync(r));
if (missing.length) { console.error("FALTAN: " + missing.join(", ")); process.exit(1); }
console.log("referencias OK (" + refs.size + ")");
'

out="$(node --test 2>&1)" || fail=1
if [ "$fail" -ne 0 ]; then echo "$out" | grep -E "^not ok|^# (pass|fail)|Error|expected|actual" | head -30; else echo "$out" | grep -E "^# (pass|fail)"; fi
[ "$fail" -eq 0 ] && echo "check OK"
[ "$fail" -eq 0 ]
