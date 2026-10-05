"use strict";
// Pruebas de la v2.15: idioma, varias versiones, resumen, «Mejorar con Copilot» y acciones rápidas.
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  detectLanguage, splitVersions, stripCodeFences, buildComposedPrompt, buildSummaryPrompt, buildImprovePrompt,
  parseCreateReply, IMPROVE_ACTIONS, QUICK_ACTIONS
} = require("../common.js");

test("detectLanguage reconoce los idiomas habituales", () => {
  assert.equal(detectLanguage("Hola Juan, gracias por tu correo. Te confirmo que la reunión es el lunes y que no hay cambios en el orden del día."), "es");
  assert.equal(detectLanguage("Hi John, thanks for your email. I can confirm that the meeting is on Monday and that we will have the report ready."), "en");
  assert.equal(detectLanguage("Bonjour, merci pour votre message. Je vous confirme que nous serons présents à la réunion de lundi avec le dossier."), "fr");
  assert.equal(detectLanguage("Hallo, danke für die Nachricht. Ich bestätige, dass wir am Montag mit dem Bericht und den Unterlagen kommen."), "de");
});

test("detectLanguage no adivina con textos cortos o sin palabras", () => {
  assert.equal(detectLanguage("OK, gracias"), "");
  assert.equal(detectLanguage(""), "");
  assert.equal(detectLanguage("12345 67890 ##### ----- 2026-10-05 10:00 11:00 12:00"), "");
});

test("buildComposedPrompt añade el idioma elegido", () => {
  const p = buildComposedPrompt({ author: "a", subject: "s" }, "cuerpo", { language: "en" });
  assert.match(p, /Escribe la respuesta en inglés\. Write the email in English\./);
  assert.doesNotMatch(buildComposedPrompt({}, "x", {}), /Escribe la respuesta en/);
});

test("buildComposedPrompt con varias versiones cambia la directiva final", () => {
  const p = buildComposedPrompt({}, "x", { versions: 3 });
  assert.match(p, /escribe 3 versiones DISTINTAS/);
  assert.match(p, /=== VERSIÓN 1 ===/);
  assert.ok(!p.includes("IMPORTANTE: devuelve solo el cuerpo"));
  assert.doesNotMatch(buildComposedPrompt({}, "x", { versions: 1 }), /versiones DISTINTAS/);
});

test("splitVersions separa por la línea marcadora y quita las vallas", () => {
  const t = "```markdown\n=== VERSIÓN 1 ===\n# Hola\n\nUno\n=== VERSIÓN 2 ===\nDos\n\n=== VERSION 3 ===\nTres\n```";
  assert.deepEqual(splitVersions(t), ["# Hola\n\nUno", "Dos", "Tres"]);
  assert.deepEqual(splitVersions("Solo una respuesta"), ["Solo una respuesta"]);
});

test("stripCodeFences quita la valla y la cabecera del bloque", () => {
  assert.equal(stripCodeFences("```markdown\n# Hola\n```"), "# Hola");
  assert.equal(stripCodeFences("Markdown Copiar\n# Hola"), "# Hola");
  assert.equal(stripCodeFences("Copiar\nTexto"), "Texto");
  assert.equal(parseCreateReply("Asunto: Prueba\n\nMarkdown\n# Cuerpo").body, "# Cuerpo");
});

test("buildSummaryPrompt: uno o varios correos, recortados y con guarda", () => {
  const one = buildSummaryPrompt([{ author: "Ana", subject: "Plazo", body: "Necesito el informe el viernes." }]);
  assert.match(one, /SEGURIDAD ANTE INYECCIÓN/);
  assert.match(one, /Resume este correo/);
  assert.match(one, /De: Ana\nAsunto: Plazo/);
  const many = buildSummaryPrompt(Array.from({ length: 12 }, (_, i) => ({ author: "x" + i, subject: "s" + i, body: "y".repeat(4000) })));
  assert.match(many, /Resume estos 10 correos/);
  assert.match(many, /CORREO 10\n/);
  assert.doesNotMatch(many, /CORREO 11/);
  assert.match(many, /\[…\]/);
});

test("buildImprovePrompt: instrucción de la acción y fragmento delimitado", () => {
  const p = buildImprovePrompt("Hola, te escribo por lo del lunes.", "formal");
  assert.match(p, /tono más formal/);
  assert.match(p, /--- FRAGMENTO ---\nHola, te escribo por lo del lunes\.\n--- FIN FRAGMENTO ---/);
  assert.match(p, /```markdown/);
  assert.throws(() => buildImprovePrompt("x", "nada"));
  for (const k of Object.keys(IMPROVE_ACTIONS)) assert.ok(buildImprovePrompt("x", k));
});

test("QUICK_ACTIONS tienen etiqueta e instrucción", () => {
  for (const a of Object.values(QUICK_ACTIONS)) { assert.ok(a.label); assert.ok(a.instruction.length > 20); }
});

test("chatTitle: fecha, tipo y asunto recortado", () => {
  const { chatTitle, copilotErrorText } = require("../common.js");
  const d = new Date(2026, 9, 5, 9, 7);
  assert.equal(chatTitle("Preguntar", "  Reunión   del lunes ", d), "2026_10_05_09_07 Preguntar: Reunión del lunes");
  assert.equal(chatTitle("Resumen", "", d), "2026_10_05_09_07 Resumen");
  assert.equal(chatTitle("X", "a".repeat(100), d).length, "2026_10_05_09_07 X: ".length + 60);
  assert.match(copilotErrorText("login"), /iniciado sesión/);
  assert.match(copilotErrorText("raro"), /\(raro\)/);
});

test("emailToMarkdown: ficha completa y versión para Copilot sin Para/CC", () => {
  const { emailToMarkdown } = require("../common.js");
  const meta = { subject: "Reunión", author: "Ana <ana@x.es>", recipients: ["yo@x.es"], cc: ["otro@x.es"], date: "5/10/2026, 9:00",
    attachments: [{ name: "acta.pdf", size: 204800 }, { name: "", size: 1 }] };
  const md = emailToMarkdown(meta, "Hola **equipo**");
  assert.match(md, /^# Reunión\n/);
  assert.match(md, /- \*\*Para:\*\* yo@x\.es/);
  assert.match(md, /- \*\*CC:\*\* otro@x\.es/);
  assert.match(md, /- \*\*Adjuntos:\*\* acta\.pdf \(200 KB\)\n/);
  assert.match(md, /---\n\nHola \*\*equipo\*\*\n$/);
  const forCopilot = emailToMarkdown(meta, "x", { forCopilot: true });
  assert.doesNotMatch(forCopilot, /Para|CC|yo@x\.es|otro@x\.es/);
  assert.match(forCopilot, /De:\*\* Ana/);
  assert.match(emailToMarkdown({}, ""), /^# \(sin asunto\)[\s\S]*_\(correo sin texto\)_/);
});

test("markdownFileName: fecha, sin prefijos RE/RV ni caracteres prohibidos", () => {
  const { markdownFileName } = require("../common.js");
  assert.equal(markdownFileName("RE: RV: Plazo: entrega/final?", new Date(2026, 9, 5)), "2026-10-05 Plazo entrega final.md");
  assert.equal(markdownFileName("", null), "correo.md");
  assert.ok(markdownFileName("x".repeat(200), null).length <= 83);
});

test("buildAskPrompt: con y sin petición, correo delimitado y con guarda", () => {
  const { buildAskPrompt } = require("../common.js");
  const p = buildAskPrompt("# Correo\n\nTexto", "Extrae las fechas");
  assert.match(p, /SEGURIDAD ANTE INYECCIÓN/);
  assert.match(p, /PETICIÓN DEL USUARIO[^\n]*\nExtrae las fechas/);
  assert.match(p, /--- CORREO \(Markdown\) ---\n# Correo\n\nTexto\n--- FIN CORREO ---/);
  assert.match(buildAskPrompt("x", "  "), /Resúmelo en pocas líneas/);
});

test("formatBytes", () => {
  const { formatBytes } = require("../common.js");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2 KB");
  assert.equal(formatBytes(3 * 1048576 + 400000), "3,4 MB");
  assert.equal(formatBytes(undefined), "");
});
