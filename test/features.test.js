"use strict";
// Pruebas de la v2.15: idioma, varias versiones, resumen, «Mejorar con Copilot» y acciones rápidas.
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  detectLanguage, splitVersions, stripCodeFences, buildComposedPrompt, buildSummaryPrompt, buildImprovePrompt,
  parseCreateReply, IMPROVE_ACTIONS, QUICK_ACTIONS, copilotErrorText
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
  assert.match(copilotErrorText("cookies"), /cookies desactivadas.*Privacidad y seguridad/);
  assert.match(copilotErrorText("login"), /cookies/);
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

test("buildComposedPrompt: indicaciones del usuario, prioritarias y antes del correo", () => {
  const p = buildComposedPrompt({ author: "Ana", subject: "Reunión" }, "¿Os viene bien el martes?", { instructions: "Acepta, pero propón el jueves" });
  assert.match(p, /INDICACIONES DEL USUARIO PARA ESTA RESPUESTA[^\n]*\nAcepta, pero propón el jueves/);
  assert.ok(p.indexOf("Acepta, pero") < p.indexOf("¿Os viene bien"));
  assert.doesNotMatch(buildComposedPrompt({}, "x", { instructions: "   " }), /INDICACIONES DEL USUARIO/);
});

test("copilotErrorText explica que Copilot está ocupado con otra petición", () => {
  assert.match(copilotErrorText("busy"), /otra petición/);
});

test("attachmentBlocker: tipos que acepta Copilot y tope de tamaño", () => {
  const { attachmentBlocker, UPLOAD_MAX_BYTES } = require("../common.js");
  assert.equal(attachmentBlocker({ name: "Informe.PDF", size: 1000 }), "");
  assert.equal(attachmentBlocker({ name: "datos.xlsx", size: UPLOAD_MAX_BYTES }), "");
  assert.match(attachmentBlocker({ name: "datos.xlsx", size: UPLOAD_MAX_BYTES + 1 }), /Supera/);
  assert.match(attachmentBlocker({ name: "programa.exe", size: 10 }), /no admite/);
  assert.match(attachmentBlocker({ name: "sin-extension", size: 10 }), /no admite/);
});

test("attachmentModes: texto en local para Office/OpenDocument/texto, subida para PDF e imágenes", () => {
  const { attachmentModes } = require("../common.js");
  assert.deepEqual(attachmentModes({ name: "a.docx", size: 100 }), { text: true, upload: true, why: "" });
  assert.equal(attachmentModes({ name: "a.pdf", size: 100 }).text, false);
  assert.equal(attachmentModes({ name: "a.odt", size: 100 }).text, true);
  assert.equal(attachmentModes({ name: "a.odt", size: 100 }).upload, false);
  assert.equal(attachmentModes({ name: "foto.png", size: 100 }).upload, true);
});

test("buildComposedPrompt: los adjuntos en texto van como datos, tras el correo", () => {
  const { buildComposedPrompt } = require("../common.js");
  const p = buildComposedPrompt({ author: "a@b.c", subject: "S" }, "Cuerpo", {
    attachments: [{ name: "informe.docx", text: "# Informe\n\nTexto", truncated: true }, { name: "vacio.txt", text: "  " }]
  });
  assert.match(p, /ADJUNTOS DEL CORREO[\s\S]*--- ADJUNTO: informe\.docx ---\n# Informe[\s\S]*\[adjunto recortado\]\n--- FIN ADJUNTO ---/);
  assert.ok(p.indexOf("Cuerpo") < p.indexOf("ADJUNTOS DEL CORREO"));
  assert.doesNotMatch(p, /vacio\.txt/);
});

test("attachments.js: ZIP (stored y deflate), texto Windows-1252, compactado y tabla", async () => {
  const zlib = require("node:zlib");
  const { readZip, decodeText, compactText, mdTable, colIndex } = require("../attachments.js");
  // ZIP mínimo escrito a mano: una entrada sin comprimir y otra con deflate.
  const files = [["a.txt", Buffer.from("hola"), 0], ["b.xml", Buffer.from("<x>ñandú</x>".repeat(20)), 8]];
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, raw, method] of files) {
    const data = method ? zlib.deflateRawSync(raw) : raw;
    const n = Buffer.from(name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, n, data); centrals.push(ch, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  const zipBuf = Buffer.concat([...locals, cd, end]);
  const zip = readZip(zipBuf.buffer.slice(zipBuf.byteOffset, zipBuf.byteOffset + zipBuf.length));
  assert.deepEqual(zip.names, ["a.txt", "b.xml"]);
  assert.equal(await zip.text("a.txt"), "hola");
  assert.equal(await zip.text("b.xml"), "<x>ñandú</x>".repeat(20));
  assert.equal(await zip.text("no.txt"), null);

  assert.equal(decodeText(new Uint8Array([0x63, 0x61, 0xf1, 0x61])), "caña");
  assert.equal(compactText("a   b  \r\n\r\n\r\n\r\n  - c "), "a b\n\n  - c");
  assert.equal(mdTable([["Nombre", "Edad", ""], ["Ana", "30"], [], ["B|C", ""]]), "Nombre | Edad\n--- | ---\nAna | 30\nB\\|C | ");
  assert.equal(colIndex("A1"), 0);
  assert.equal(colIndex("AB12"), 27);
});

test("bodyImages: imágenes incrustadas en el orden de las marcas, con nombre y aviso de pequeñas", () => {
  const { bodyImages } = require("../common.js");
  const full = { contentType: "multipart/related", parts: [
    { contentType: "text/html", partName: "1.1", body: "<p>x</p>" },
    { contentType: "image/png", partName: "1.2", size: 50000, headers: { "content-id": ["<Captura@01>"] } },
    { contentType: "image/jpeg", partName: "1.3", size: 2000, headers: { "content-id": ["<logo@01>"] } },
    { contentType: "image/png", partName: "1.4", size: 9000 },
    { contentType: "image/x-emf", partName: "1.5", size: 30000, headers: { "content-id": ["<raro@01>"] } }
  ] };
  const imgs = bodyImages(full, ["logo@01", "no-esta@01", "captura@01", "raro@01"]);
  assert.deepEqual(imgs.map((i) => [i.n, i.name, i.partName, i.small]), [
    [1, "imagen-1.jpg", "1.3", true], [3, "imagen-3.png", "1.2", false], [4, "imagen-4.img", "1.5", false]
  ]);
});

test("isNewerVersion compara X.Y.Z por números", () => {
  const { isNewerVersion } = require("../common.js");
  assert.equal(isNewerVersion("2.25.2", "2.25.1"), true);
  assert.equal(isNewerVersion("2.10.0", "2.9.9"), true);
  assert.equal(isNewerVersion("2.25.1", "2.25.1"), false);
  assert.equal(isNewerVersion("2.24.9", "2.25.0"), false);
  assert.equal(isNewerVersion(undefined, "2.25.0"), false);
});

// Las actualizaciones automáticas (v2.25) conservan storage.local porque el id del complemento no
// cambia; ningún código puede borrar las preferencias del usuario ni cambiar ese id.
test("ninguna versión borra las preferencias del usuario al actualizar", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.join(__dirname, "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.equal(manifest.browser_specific_settings.gecko.id, "cothunder@local");
  const files = ["", "popup", "options", "pages"].flatMap((d) => fs.readdirSync(path.join(root, d))
    .filter((f) => f.endsWith(".js")).map((f) => path.join(root, d, f)));
  for (const f of files) {
    assert.doesNotMatch(fs.readFileSync(f, "utf8"), /storage\.local\.(clear|remove)\s*\(|localStorage\.clear\s*\(/, f);
  }
});
