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
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "themes.js"), "utf8") + ";this.PRESETS = EMAIL_THEME_PRESETS;", ctx);
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
