"use strict";

// attachments.js — texto de los adjuntos, extraído EN LOCAL para ir dentro del prompt (sin subir el
// fichero a Copilot ni dejar copia en OneDrive). Se carga en la ventana (popup) tras common.js.
// Office (docx/xlsx/pptx) y OpenDocument (odt/ods/odp) son ZIP con XML: se descomprimen con
// DecompressionStream («deflate-raw») y el XML se lee con DOMParser, nunca se ejecuta ni se inserta
// como HTML. El resultado es Markdown compacto: títulos, listas, negritas y tablas, sin relleno.

// --- ZIP mínimo: directorio central + entradas «stored» (0) o «deflate» (8). Sin ZIP64. ---
function readZip(buf) {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("no es un ZIP");
  const utf8 = new TextDecoder();
  const entries = new Map();
  let p = dv.getUint32(eocd + 16, true);
  for (let n = dv.getUint16(eocd + 10, true); n > 0 && dv.getUint32(p, true) === 0x02014b50; n--) {
    const nameLen = dv.getUint16(p + 28, true);
    entries.set(utf8.decode(new Uint8Array(buf, p + 46, nameLen)), {
      method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), local: dv.getUint32(p + 42, true)
    });
    p += 46 + nameLen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  return {
    names: [...entries.keys()],
    async text(name) {
      const e = entries.get(name);
      if (!e) return null;
      const start = e.local + 30 + dv.getUint16(e.local + 26, true) + dv.getUint16(e.local + 28, true);
      const data = new Uint8Array(buf, start, e.size);
      if (e.method === 0) return utf8.decode(data);
      if (e.method !== 8) throw new Error("compresión ZIP no admitida");
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return utf8.decode(await new Response(stream).arrayBuffer());
    }
  };
}

// Texto plano en UTF-8 o, si no lo es, Windows-1252 (ficheros guardados con Excel/Bloc de notas).
function decodeText(buf) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch (_) {}
  return new TextDecoder("windows-1252").decode(buf);
}

// Quita lo que no aporta: espacios repetidos, finales de línea y líneas en blanco de más.
function compactText(s) {
  return String(s || "").replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").replace(/([^\n ]) {2,}/g, "$1 ")
    .replace(/ +\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Une bloques con una línea en blanco, salvo elementos de lista seguidos (una sola lista).
function joinBlocks(blocks) {
  const isItem = (b) => /^ *- /.test(b);
  return blocks.filter(Boolean).reduce((acc, b, i, arr) => acc + (i ? (isItem(b) && isItem(arr[i - 1]) ? "\n" : "\n\n") : "") + b, "");
}

// Tabla Markdown sin relleno (filas = arrays de celdas); se quitan columnas vacías al final.
function mdTable(rows) {
  const clean = rows.map((r) => r.map((c) => String(c == null ? "" : c).replace(/\s+/g, " ").replace(/\|/g, "\\|").trim()))
    .filter((r) => r.some((c) => c));
  if (!clean.length) return "";
  const width = Math.max(...clean.map((r) => { let n = r.length; while (n && !r[n - 1]) n--; return n; }));
  const line = (r) => Array.from({ length: width }, (_, i) => r[i] || "").join(" | ");
  return [line(clean[0]), Array(width).fill("---").join(" | "), ...clean.slice(1).map(line)].join("\n");
}

// --- Recorrido de XML por nombre local (los prefijos w:, a:, text:… dan igual) ---
const kids = (el) => (el ? [...el.children] : []);
const kid = (el, name) => kids(el).find((c) => c.localName === name) || null;
const below = (el, name) => (el ? [...el.getElementsByTagName("*")].filter((c) => c.localName === name) : []);
const attr = (el, name) => {
  if (!el) return null;
  for (const a of el.attributes) if (a.localName === name) return a.value;
  return null;
};
const parseXml = (xml) => new DOMParser().parseFromString(xml, "application/xml");

// --- Word (.docx) ---
function docxRunsText(p) {
  let out = "";
  for (const r of below(p, "r")) {
    let t = "";
    for (const c of kids(r)) {
      if (c.localName === "t") t += c.textContent;
      else if (c.localName === "tab") t += " ";
      else if (c.localName === "br") t += "\n";
    }
    const b = kid(kid(r, "rPr"), "b");
    out += b && attr(b, "val") !== "0" && attr(b, "val") !== "false" && t.trim() ? "**" + t.trim() + "** " : t;
  }
  return out.replace(/\*\*\s*\*\*/g, " ").trim();
}
function docxParagraph(p) {
  const text = docxRunsText(p);
  if (!text) return "";
  const pPr = kid(p, "pPr");
  const style = attr(kid(pPr, "pStyle"), "val") || "";
  const h = /^(?:heading|t[ií]?tulo)\s*(\d)$/i.exec(style);
  if (h) return "#".repeat(Math.min(6, Number(h[1]))) + " " + text.replace(/\*\*/g, "");
  if (/^(?:title|t[ií]?tulo)$/i.test(style)) return "# " + text.replace(/\*\*/g, "");
  const num = kid(pPr, "numPr");
  if (num) return "  ".repeat(Number(attr(kid(num, "ilvl"), "val")) || 0) + "- " + text;
  return text;
}
function docxToMarkdown(xml) {
  const body = below(parseXml(xml), "body")[0];
  const out = [];
  for (const el of kids(body)) {
    if (el.localName === "p") out.push(docxParagraph(el));
    else if (el.localName === "tbl") {
      out.push(mdTable(kids(el).filter((r) => r.localName === "tr")
        .map((tr) => kids(tr).filter((c) => c.localName === "tc").map((tc) => below(tc, "p").map(docxRunsText).join(" ")))));
    }
  }
  return joinBlocks(out);
}

// --- Excel (.xlsx): una tabla por hoja con su nombre; textos compartidos y celdas en línea ---
const colIndex = (ref) => {
  let n = 0;
  for (const ch of String(ref || "").replace(/\d+$/, "")) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
};
async function xlsxToMarkdown(zip) {
  const shared = below(parseXml((await zip.text("xl/sharedStrings.xml")) || "<sst/>"), "si")
    .map((si) => below(si, "t").map((t) => t.textContent).join(""));
  const rels = {};
  for (const r of below(parseXml((await zip.text("xl/_rels/workbook.xml.rels")) || "<r/>"), "Relationship")) {
    rels[r.getAttribute("Id")] = "xl/" + r.getAttribute("Target").replace(/^\/?xl\//, "");
  }
  const out = [];
  for (const sh of below(parseXml((await zip.text("xl/workbook.xml")) || "<w/>"), "sheet")) {
    if (sh.getAttribute("state") === "hidden") continue;
    const xml = await zip.text(rels[attr(sh, "id")] || "");
    if (!xml) continue;
    const rows = below(parseXml(xml), "row").map((row) => {
      const cells = [];
      for (const c of below(row, "c")) {
        const t = c.getAttribute("t");
        const v = kid(c, "v") ? kid(c, "v").textContent : "";
        cells[colIndex(c.getAttribute("r"))] = t === "s" ? shared[Number(v)] || ""
          : t === "inlineStr" ? below(c, "t").map((x) => x.textContent).join("")
          : t === "b" ? (v === "1" ? "VERDADERO" : "FALSO") : v;
      }
      return cells;
    });
    const table = mdTable(rows);
    if (table) out.push("### Hoja: " + sh.getAttribute("name") + "\n\n" + table);
  }
  return out.join("\n\n");
}

// --- PowerPoint (.pptx): el texto de cada diapositiva, en orden ---
async function pptxToMarkdown(zip) {
  const slides = zip.names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const out = [];
  for (const [i, name] of slides.entries()) {
    const lines = below(parseXml(await zip.text(name)), "p")
      .map((p) => below(p, "t").map((t) => t.textContent).join("").trim()).filter(Boolean);
    if (lines.length) out.push("### Diapositiva " + (i + 1) + "\n\n" + lines.join("\n"));
  }
  return out.join("\n\n");
}

// --- OpenDocument (.odt/.ods/.odp): títulos, párrafos, listas, tablas y diapositivas ---
function odfToMarkdown(xml, isSheet) {
  const out = [];
  let slide = 0;
  const walk = (el) => {
    for (const c of kids(el)) {
      const n = c.localName;
      if (n === "h") out.push("#".repeat(Math.min(6, Number(attr(c, "outline-level")) || 1)) + " " + c.textContent.trim());
      else if (n === "p") { if (c.textContent.trim()) out.push(c.textContent.trim()); }
      else if (n === "list-item") {
        // Las sublistas se aplanan en el mismo punto.
        const t = below(c, "p").map((p) => p.textContent.trim()).filter(Boolean).join(" ");
        if (t) out.push("- " + t);
      } else if (n === "table") {
        const rows = below(c, "table-row").map((r) => {
          const cells = [];
          for (const cell of kids(r).filter((x) => x.localName === "table-cell")) {
            const t = below(cell, "p").map((p) => p.textContent.trim()).join(" ");
            // Las celdas vacías repetidas (relleno hasta la columna 1024) no se expanden.
            const rep = t ? Math.min(Number(attr(cell, "number-columns-repeated")) || 1, 50) : 1;
            for (let i = 0; i < rep; i++) cells.push(t);
          }
          return cells;
        });
        const table = mdTable(rows);
        if (table) out.push((isSheet && attr(c, "name") ? "### Hoja: " + attr(c, "name") + "\n\n" : "") + table);
      } else if (n === "page") {
        const before = out.length;
        out.push("### Diapositiva " + (++slide));
        walk(c);
        if (out.length === before + 1) out.pop();
      } else walk(c);
    }
  };
  walk(below(parseXml(xml), "body")[0]);
  return joinBlocks(out);
}

// Texto de un adjunto (File o Blob con nombre). Devuelve { text, total, truncated }: «total» es la
// longitud antes de recortar a ATTACH_TEXT_MAX, para que la ventana avise y proponga subir el fichero.
async function extractAttachmentText(file, name) {
  const ext = String(name || "").split(".").pop().toLowerCase();
  const buf = await file.arrayBuffer();
  let text;
  if (["docx", "docm"].includes(ext)) text = docxToMarkdown((await readZip(buf).text("word/document.xml")) || "");
  else if (["xlsx", "xlsm"].includes(ext)) text = await xlsxToMarkdown(readZip(buf));
  else if (ext === "pptx") text = await pptxToMarkdown(readZip(buf));
  else if (["odt", "ods", "odp"].includes(ext)) text = odfToMarkdown((await readZip(buf).text("content.xml")) || "", ext === "ods");
  else if (["html", "htm"].includes(ext)) text = typeof htmlToMarkdown === "function" ? htmlToMarkdown(decodeText(buf)) : htmlToText(decodeText(buf));
  else text = decodeText(buf);
  text = compactText(text);
  const total = text.length;
  if (total > ATTACH_TEXT_MAX) text = text.slice(0, ATTACH_TEXT_MAX);
  return { text, total, truncated: total > ATTACH_TEXT_MAX };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { readZip, decodeText, compactText, mdTable, colIndex, extractAttachmentText };
}
