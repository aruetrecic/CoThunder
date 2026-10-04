"use strict";
// Tests de themes.js: presets bien formados, CSS parseable y sin peticiones salientes.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { parseCss } = require("../markdown.js");

// themes.js es un script de navegador (sin module.exports): se evalúa en un contexto aislado.
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "themes.js"), "utf8") +
  ";this.PRESETS = EMAIL_THEME_PRESETS; this.PALETTES = THEME_PALETTES;", ctx);
// Copia a objetos de este contexto: los del vm tienen otros prototipos y deepStrictEqual los distingue.
const PRESETS = JSON.parse(JSON.stringify(ctx.PRESETS));

test("themes: ids únicos y nombre en todos los presets", () => {
  const ids = PRESETS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of PRESETS) assert.ok(p.name && typeof p.name === "string", p.id);
  assert.equal(PRESETS[0].id, "default");
  assert.equal(PRESETS[0].css, "");
});

test("themes: los ids coinciden con el selector de Opciones", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "options", "options.html"), "utf8");
  const sel = html.match(/<select id="emailTheme">([\s\S]*?)<\/select>/)[1];
  const optionIds = [...sel.matchAll(/value="([^"]+)"/g)].map((m) => m[1]).filter((v) => v !== "custom");
  assert.deepEqual([...optionIds].sort(), PRESETS.map((p) => p.id).sort());
});

test("themes: cada CSS se parsea en reglas y no usa url()", () => {
  for (const p of PRESETS.filter((x) => x.css)) {
    const rules = parseCss(p.css);
    assert.ok(rules.length >= 10, p.id + ": pocas reglas (" + rules.length + ")");
    for (const r of rules) for (const d of r.decls) {
      assert.ok(!/url\s*\(/i.test(d.value), p.id + ": url() en " + r.selector);
      assert.ok(!/undefined/.test(d.value), p.id + ": valor undefined en " + r.selector + " " + d.prop);
    }
  }
});

// --- Contraste WCAG 2.1 AA de las paletas (1.4.3): 4.5:1 texto, 3:1 títulos (texto grande) ---
// Comprobación rápida sin navegador. La prueba completa (cada texto renderizado, también en
// modo quirks como lo ve el destinatario) es scripts/a11y-themes.sh.
const PALETTES = JSON.parse(JSON.stringify(ctx.PALETTES));
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (c) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

test("themes: contraste WCAG AA de cada pareja texto/fondo de las paletas", () => {
  const fails = [];
  for (const p of PALETTES) {
    const pairs = [
      ["texto", p.text, p.bg, 4.5], ["texto en fila par", p.text, p.evenRow, 4.5],
      ["enlace", p.link, p.bg, 4.5], ["enlace en fila par", p.link, p.evenRow, 4.5],
      ["títulos", p.headings, p.bg, 3], ["cabecera de tabla", p.thText, p.thBg, 4.5],
      ["código en línea", p.codeText, p.codeBg, 4.5], ["bloque de código", p.preText, p.preBg, 4.5],
      ["cita", p.bqText, p.bqBg, 4.5], ["aviso", p.admText, p.admBg, 4.5],
      ["resaltado", p.markText, p.mark, 4.5],
      ["comentario", p.hlComment, p.preBg, 4.5], ["cadena", p.hlString, p.preBg, 4.5],
      ["número", p.hlNumber, p.preBg, 4.5], ["palabra clave", p.hlKeyword, p.preBg, 4.5],
    ];
    for (const [what, fg, bg, min] of pairs) {
      const r = contrast(fg, bg);
      if (r < min) fails.push(p.id + " · " + what + ": " + fg + " sobre " + bg + " = " + r.toFixed(2) + " (mín. " + min + ")");
    }
  }
  assert.deepEqual(fails, []);
});

test("themes: las celdas de tabla llevan color y fondo propios (modo quirks)", () => {
  for (const p of PRESETS.filter((x) => x.css && x.id !== "upo")) {
    const td = parseCss(p.css).filter((r) => /(^|\s|,)\.markdown-here-wrapper td$/.test(r.selector.trim()) ||
      r.selector.split(",").some((sel) => sel.trim() === ".markdown-here-wrapper td"));
    const props = td.flatMap((r) => r.decls.map((d) => d.prop));
    assert.ok(props.includes("color") && props.includes("background"), p.id + ": td sin color/fondo propios");
  }
});

