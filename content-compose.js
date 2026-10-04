"use strict";
// content-compose.js — compose script: editor Markdown con preview en vivo.
//
// PLAN B (§8 del spec): NO se inyecta ningún textarea. El editor NATIVO de
// Thunderbird es la fuente Markdown (el usuario escribe ahí, a la izquierda);
// a la derecha un preview NO editable renderiza en vivo. renderMarkdown viene
// de markdown.js (inyectado antes, mismo scope). Selectores centralizados.
(function () {
  // Puede llegar dos veces (registro de scripting.compose + inyección de resguardo
  // desde el background): solo la primera carga se monta.
  if (window.__cothunderComposeLoaded) return;
  window.__cothunderComposeLoaded = true;

  const SELECTORS = { body: "body" };
  const IDS = { preview: "cothunder-md-preview", style: "cothunder-md-style", toolbar: "cothunder-md-toolbar" };

  // Barra Markdown: botones { label, title, kind... } y menús { menu, title, items }.
  // "wrap" rodea la selección, "prefix" antepone al inicio de línea (v1: caret al inicio de línea)
  // y "block" inserta una plantilla en su propio bloque. Lo menos usado va en menús para que
  // la barra quepa en una línea. Los menús son botones propios, no <select>: dentro del
  // editor de Thunderbird un <select> nativo no se despliega.
  const TOOLBAR_ITEMS = [
    { menu: "H", title: "Títulos", items: [
      { label: "H1", title: "Título 1 (Ctrl+1)", kind: "prefix", value: "# " },
      { label: "H2", title: "Título 2 (Ctrl+2)", kind: "prefix", value: "## " },
      { label: "H3", title: "Título 3 (Ctrl+3)", kind: "prefix", value: "### " },
      { label: "H4", title: "Título 4 (Ctrl+4)", kind: "prefix", value: "#### " },
      { label: "H5", title: "Título 5 (Ctrl+5)", kind: "prefix", value: "##### " },
      { label: "H6", title: "Título 6 (Ctrl+6)", kind: "prefix", value: "###### " },
    ] },
    // Énfasis
    { label: "B", title: "Negrita (Ctrl+B)", kind: "wrap", before: "**", after: "**" },
    { label: "I", title: "Cursiva (Ctrl+I)", kind: "wrap", before: "*", after: "*" },
    { label: "S", title: "Tachado", kind: "wrap", before: "~~", after: "~~" },
    { label: "🖍", title: "Resaltado", kind: "wrap", before: "==", after: "==" },
    { label: "</>", title: "Código en línea (Ctrl+E)", kind: "wrap", before: "`", after: "`" },
    { menu: "Aa", title: "Más formato", items: [
      { label: "B+I", title: "Negrita y cursiva", kind: "wrap", before: "***", after: "***" },
      { label: "x₂", title: "Subíndice", kind: "wrap", before: "~", after: "~" },
      { label: "x²", title: "Superíndice", kind: "wrap", before: "^", after: "^" },
    ] },
    // Enlaces y multimedia
    { label: "🔗", title: "Enlace (Ctrl+K)", kind: "link" },
    { label: "🖼", title: "Imagen", kind: "image" },
    { label: "😀", title: "Emoji", kind: "insert", value: ":smile:" },
    // Listas y cita
    { label: "❝", title: "Cita", kind: "prefix", value: "> " },
    { label: "•", title: "Lista", kind: "prefix", value: "- " },
    { label: "1.", title: "Lista numerada", kind: "prefix", value: "1. " },
    { label: "☑", title: "Tarea", kind: "prefix", value: "- [ ] " },
    { menu: "▦", title: "Insertar bloque", items: [
      { label: "▦", title: "Tabla", kind: "block", template: "| Col 1 | Col 2 |\n| --- | --- |\n|  |  |" },
      { label: "{}", title: "Bloque de código", kind: "block", template: "```\n\n```" },
      { label: "―", title: "Regla horizontal", kind: "block", template: "---" },
      { label: "Def", title: "Lista de definición", kind: "block", template: "término\n: definición" },
      { label: "†", title: "Nota al pie (añade «[^1]: ...» al final)", kind: "insert", value: "[^1]" },
    ] },
    { menu: "ℹ", title: "Avisos (admonitions)", items: [
      { label: "ℹ", title: "Nota", kind: "block", template: "> [!NOTE]\n> " },
      { label: "💡", title: "Consejo", kind: "block", template: "> [!TIP]\n> " },
      { label: "❗", title: "Importante", kind: "block", template: "> [!IMPORTANT]\n> " },
      { label: "⚠", title: "Advertencia", kind: "block", template: "> [!WARNING]\n> " },
      { label: "🛑", title: "Precaución", kind: "block", template: "> [!CAUTION]\n> " },
    ] },
  ];

  let active = false;
  let bodyEl = null;
  let previewEl = null;
  let toolbarEl = null;
  let timer = null;
  let emailAccent = "#0969da";
  // Tema CSS del correo (§ motor de temas): "default" sin CSS extra, el resto
  // de ids busca su CSS en el array PRESETS de abajo, "custom" usa el CSS del
  // usuario en emailCustomCss.
  let emailTheme = "default";
  let emailCustomCss = "";
  // Menú de estilo de la barra: cambia el tema SOLO de este correo (no toca Opciones).
  let themeMenu = null;
  let toolbarObserver = null;

  // --- Inserción de Markdown en el editor nativo (contenteditable) ---

  function selectedText() {
    const s = window.getSelection();
    return s && s.rangeCount ? s.toString() : "";
  }

  function insertMd(text) {
    bodyEl.focus();
    document.execCommand("insertText", false, text);
    scheduleRender();
  }

  function wrap(before, after) {
    insertMd(before + selectedText() + after);
  }

  // Antepone el prefijo al INICIO de la línea del cursor (Selection.modify, Gecko). Si es un
  // título (#…) y la línea ya lo era, sustituye el nivel en vez de acumular almohadillas.
  // Sin Selection.modify, cae a insertar en el cursor (comportamiento v1).
  function prefixLine(prefix) {
    bodyEl.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || typeof sel.modify !== "function") { insertMd(prefix + selectedText()); return; }
    sel.collapseToStart();
    sel.modify("move", "backward", "lineboundary");
    let replaceLen = 0;
    if (/^#{1,6} $/.test(prefix)) {
      for (let i = 0; i < 7; i++) sel.modify("extend", "forward", "character");
      const m = sel.toString().match(/^#{1,6} /);
      sel.collapseToStart();
      if (m) replaceLen = m[0].length;
    }
    for (let i = 0; i < replaceLen; i++) sel.modify("extend", "forward", "character");
    insertMd(prefix);
  }

  function insertBlock(template) {
    insertMd("\n" + template + "\n");
  }

  // --- Pegado de HTML como Markdown ---
  // Al pegar contenido con "flavor" HTML (copiado de otro correo o de una web),
  // lo convertimos a Markdown para mantener el editor consistente con el modelo
  // "Markdown como fuente". El pegado de texto plano sigue el comportamiento
  // por defecto del navegador (no se toca).

  function collapseWs(s) {
    return s.replace(/\s+/g, " ");
  }

  function nodeToMd(node) {
    let out = "";
    for (const child of node.childNodes) {
      out += childToMd(child);
    }
    return out;
  }

  function childToMd(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return collapseWs(node.textContent);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.nodeName.toLowerCase();
    const inner = () => nodeToMd(node);

    switch (tag) {
      case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
        const level = Number(tag[1]);
        return "\n" + "#".repeat(level) + " " + inner().trim() + "\n\n";
      }
      case "strong": case "b":
        return "**" + inner() + "**";
      case "em": case "i":
        return "*" + inner() + "*";
      case "del": case "s": case "strike":
        return "~~" + inner() + "~~";
      case "code":
        // Si está dentro de <pre>, el propio <pre> ya genera el bloque.
        return node.closest && node.closest("pre") ? node.textContent : "`" + node.textContent + "`";
      case "pre":
        return "\n```\n" + node.textContent + "\n```\n\n";
      case "a":
        return "[" + inner() + "](" + (node.getAttribute("href") || "") + ")";
      case "img":
        return "![" + (node.getAttribute("alt") || "") + "](" + (node.getAttribute("src") || "") + ")";
      case "br":
        return "\n";
      case "hr":
        return "\n---\n\n";
      case "p": case "div":
        return "\n" + inner() + "\n\n";
      case "blockquote": {
        const lines = inner().split("\n").map((l) => (l.trim() ? "> " + l : l));
        return "\n" + lines.join("\n") + "\n\n";
      }
      case "ul": {
        let md = "\n";
        node.querySelectorAll(":scope > li").forEach((li) => {
          md += "- " + nodeToMd(li).trim() + "\n";
        });
        return md + "\n";
      }
      case "ol": {
        let md = "\n";
        node.querySelectorAll(":scope > li").forEach((li) => {
          md += "1. " + nodeToMd(li).trim() + "\n";
        });
        return md + "\n";
      }
      case "table": {
        const rows = Array.from(node.querySelectorAll("tr"));
        if (!rows.length) return inner();
        let md = "\n";
        rows.forEach((tr, i) => {
          const cells = Array.from(tr.querySelectorAll("th,td")).map((c) => nodeToMd(c).trim());
          md += "| " + cells.join(" | ") + " |\n";
          if (i === 0) {
            md += "| " + cells.map(() => "---").join(" | ") + " |\n";
          }
        });
        return md + "\n";
      }
      default:
        return inner();
    }
  }

  function htmlToMarkdown(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return nodeToMd(doc.body).replace(/\n{3,}/g, "\n\n").trim();
  }

  function onPaste(e) {
    const html = e.clipboardData && e.clipboardData.getData("text/html");
    if (!html) return; // sin HTML: pegado normal (texto plano)
    e.preventDefault();
    const md = htmlToMarkdown(html);
    insertMd(md);
  }

  const BTN_CSS = "cursor:pointer;border:1px solid #d0d7de;background:#fff;color:#1f2328;border-radius:4px;" +
    "padding:2px 5px;font:13px sans-serif;white-space:nowrap;";

  function runSpec(spec) {
    switch (spec.kind) {
      case "wrap": wrap(spec.before, spec.after); break;
      case "prefix": prefixLine(spec.value); break;
      case "link": insertMd("[" + selectedText() + "](url)"); break;
      case "image": insertMd("![" + selectedText() + "](url)"); break;
      case "block": insertBlock(spec.template); break;
      case "insert": insertMd(spec.value); break;
    }
  }

  function makeButton(label, title, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.style.cssText = BTN_CSS;
    // No robar la selección del editor al pulsar el botón.
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", onClick);
    return btn;
  }

  function closeMenus(except) {
    if (!toolbarEl) return;
    toolbarEl.querySelectorAll("[data-cothunder-popup]").forEach((p) => {
      if (p !== except) p.style.display = "none";
    });
  }

  // Menú desplegable propio: botón "label ▾" + panel de botones. Devuelve { wrap, setItems, setLabel }.
  function makeMenu(label, title) {
    const wrapEl = document.createElement("span");
    wrapEl.style.cssText = "position:relative;display:inline-flex;";
    const popup = document.createElement("div");
    popup.setAttribute("data-cothunder-popup", "");
    popup.setAttribute("role", "menu");
    popup.style.cssText =
      "display:none;position:absolute;top:100%;left:0;margin-top:2px;z-index:20;flex-direction:column;" +
      "min-width:max-content;max-height:60vh;overflow:auto;padding:3px;gap:1px;background:#fff;" +
      "border:1px solid #d0d7de;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.18);";
    const btn = makeButton(label + " ▾", title, () => {
      const open = popup.style.display !== "none";
      closeMenus(popup);
      if (open) { popup.style.display = "none"; return; }
      popup.style.display = "flex";
      // Si se sale por la derecha de la barra, se alinea a la derecha del botón.
      popup.style.left = "0"; popup.style.right = "auto";
      const bar = toolbarEl.getBoundingClientRect(), r = popup.getBoundingClientRect();
      if (r.right > bar.right) { popup.style.left = "auto"; popup.style.right = "0"; }
    });
    btn.setAttribute("aria-haspopup", "menu");
    wrapEl.append(btn, popup);
    const setItems = (items) => {
      popup.replaceChildren();
      for (const it of items) {
        const item = makeButton(it.text, it.title || it.text, () => { popup.style.display = "none"; it.onClick(); });
        item.setAttribute("role", "menuitem");
        item.style.cssText = BTN_CSS + "border-color:transparent;text-align:left;";
        item.addEventListener("mouseenter", () => { item.style.background = "#eaeef2"; });
        item.addEventListener("mouseleave", () => { item.style.background = "#fff"; });
        popup.appendChild(item);
      }
    };
    const setLabel = (text, t) => { btn.textContent = text + " ▾"; btn.title = t; btn.setAttribute("aria-label", t); };
    return { wrap: wrapEl, setItems, setLabel };
  }

  function buildToolbar() {
    const toolbar = document.createElement("div");
    toolbar.id = IDS.toolbar;
    // No editable ni revisado por el corrector: la barra vive dentro del cuerpo editable.
    toolbar.contentEditable = "false";
    toolbar.spellcheck = false;
    toolbar.style.cssText =
      "position:fixed;top:0;left:0;width:50%;box-sizing:border-box;display:flex;align-items:center;" +
      "flex-wrap:wrap;gap:2px;padding:4px;background:#f6f8fa;border-bottom:1px solid #d0d7de;z-index:10;";

    TOOLBAR_ITEMS.forEach((spec) => {
      if (spec.menu) {
        const m = makeMenu(spec.menu, spec.title);
        m.setItems(spec.items.map((it) => ({ text: it.label + "  " + it.title, title: it.title, onClick: () => runSpec(it) })));
        toolbar.appendChild(m.wrap);
      } else {
        toolbar.appendChild(makeButton(spec.label, spec.title, () => runSpec(spec)));
      }
    });

    themeMenu = makeMenu("🎨", "Estilo de este correo");
    themeMenu.wrap.style.marginLeft = "auto";
    toolbar.appendChild(themeMenu.wrap);
    fillThemeMenu();
    return toolbar;
  }

  // Menú "🎨 Estilo": presets de themes.js (+ "Personalizado" si hay CSS propio). Cambia el
  // estilo de ESTE correo al momento (preview y envío); el tema por defecto sigue siendo el
  // de Opciones.
  function fillThemeMenu() {
    if (!themeMenu) return;
    const list = PRESETS.map((p) => ({ id: p.id, name: p.name }));
    if (emailCustomCss.trim() || emailTheme === "custom") list.push({ id: "custom", name: "Personalizado" });
    const current = list.find((t) => t.id === emailTheme) || list[0];
    themeMenu.setLabel("🎨", "Estilo de este correo: " + (current ? current.name : "") +
      " (el tema por defecto se elige en Opciones)");
    themeMenu.setItems(list.map((t) => ({
      text: (current && t.id === current.id ? "✓ " : "\u2003") + t.name,
      onClick: () => { emailTheme = t.id; fillThemeMenu(); renderPreview(); }
    })));
  }

  // Bloques que NO son Markdown del usuario y se conservan tal cual (HTML original): la firma
  // de Thunderbird y la cita/reenvío del correo original. Si se pasaran por innerText perderían
  // su formato (negritas, colores, tamaños de la firma corporativa).
  const PRESERVED_SELECTOR = ".moz-signature, blockquote[type=cite], .moz-cite-prefix, .moz-forward-container";

  // Texto Markdown de una serie de nodos: los clona en un contenedor oculto, convierte las
  // imágenes insertadas a sintaxis ![alt](src) —innerText las descartaría— y lee el texto.
  // Trabaja sobre un clon para no tocar el cursor del editor.
  function nodesToMarkdown(nodes) {
    const holder = document.createElement("div");
    for (const n of nodes) holder.appendChild(n.cloneNode(true));
    holder.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      const alt = img.getAttribute("alt") || "";
      img.replaceWith(document.createTextNode("![" + alt + "](" + src + ")"));
    });
    holder.style.cssText = "position:absolute;left:-99999px;top:0;";
    document.body.appendChild(holder);   // innerText necesita estar en el documento
    const text = holder.innerText || "";
    holder.remove();
    return text;
  }

  // Trocea el cuerpo en orden: tramos de Markdown ({ md }) y bloques conservados ({ html }).
  function bodySegments() {
    if (!bodyEl) return [];
    const segs = [];
    let run = [];
    const flush = () => { if (run.length) { segs.push({ md: nodesToMarkdown(run) }); run = []; } };
    for (const child of bodyEl.childNodes) {
      if (child === previewEl || child === toolbarEl) continue;
      if (child.nodeType === 1 && child.matches(PRESERVED_SELECTOR)) {
        flush();
        segs.push({ html: child.outerHTML });
      } else {
        run.push(child);
      }
    }
    flush();
    return segs;
  }

  // HTML del correo: cada tramo Markdown se renderiza (con tema si withTheme) y los bloques
  // conservados se intercalan sin tocar.
  function buildHtml(withTheme) {
    return bodySegments().map((seg) => {
      if (seg.html !== undefined) return seg.html;
      if (!seg.md.trim()) return "";
      const html = styleEmail(renderMarkdown(seg.md), { accent: emailAccent });
      return withTheme ? inlineCss(html, activeThemeCss()) : html;
    }).join("");
  }

  // --- Motor de temas CSS -------------------------------------------------
  // Los clientes de correo eliminan CSS externo/clases, así que un tema se
  // aplica como estilos EN LÍNEA sobre el HTML ya maquetado (parseCss viene
  // de markdown.js, mismo scope). Se ejecuta DESPUÉS de styleEmail: setProperty
  // fusiona/pisa sus estilos base regla a regla, en el orden del CSS de entrada.
  function inlineCss(html, css) {
    if (!css) return html;
    const rules = parseCss(css);
    const doc = new DOMParser().parseFromString(html, "text/html");
    // Envuelve el contenido en un contenedor con la clase de Markdown Here, para
    // que los temas MDHR (con selectores ".markdown-here-wrapper ...", como tu
    // upo.css) funcionen TAL CUAL; los selectores planos (h1, table...) también
    // casan como descendientes. La clase se retira al final: en el correo solo
    // quedan los estilos EN LÍNEA (los clientes eliminan clases/CSS externo).
    const wrapper = doc.createElement("div");
    wrapper.className = "markdown-here-wrapper";
    while (doc.body.firstChild) wrapper.appendChild(doc.body.firstChild);
    doc.body.appendChild(wrapper);
    for (const rule of rules) {
      let els;
      try { els = doc.querySelectorAll(rule.selector); } catch (e) { continue; }
      els.forEach((el) => {
        for (const d of rule.decls) {
          // RGPD: un tema "custom" pegado por el usuario no debe poder disparar una
          // petición saliente (p. ej. background-image:url(...) como tracking pixel).
          if (/url\s*\(/i.test(d.value)) continue;
          el.style.setProperty(d.prop, d.value, d.priority || "");
        }
      });
    }
    wrapper.removeAttribute("class");
    return doc.body.innerHTML;
  }

  // Presets de tema: vienen de themes.js (inyectado antes, mismo scope).
  const PRESETS = typeof EMAIL_THEME_PRESETS !== "undefined" ? EMAIL_THEME_PRESETS : [];

  // Devuelve el CSS activo según el tema elegido en Opciones: "custom" usa el
  // CSS del usuario (emailCustomCss); el resto busca el preset por id ("" si
  // no se encuentra, p. ej. "default").
  function activeThemeCss() {
    if (emailTheme === "custom") return emailCustomCss;
    const preset = PRESETS.find((p) => p.id === emailTheme);
    return preset ? preset.css : "";
  }

  function finalHtml() {
    if (!active) return null;
    try {
      return buildHtml(true);
    } catch (e) {
      // Degrada con gracia: si el tema/inliner falla, envía al menos el HTML base.
      try { return buildHtml(false); } catch (e2) { return null; }
    }
  }

  function renderPreview() {
    if (!previewEl) return;
    try {
      // DOMParser: convierte nuestra cadena segura en nodos sin ejecutar scripts.
      const doc = new DOMParser().parseFromString(buildHtml(true), "text/html");
      previewEl.replaceChildren(...doc.body.childNodes);
    } catch (e) {
      previewEl.textContent = "[CoThunder preview] " + (e && e.message);
    }
  }

  // Debounce: no re-renderizar en cada tecla.
  function scheduleRender() {
    if (timer) return;
    timer = setTimeout(function () { timer = null; renderPreview(); }, 150);
  }

  // Cierra los menús de la barra al pulsar fuera de ellos o con Escape.
  function onOutsideMenu(e) {
    if (toolbarEl && !toolbarEl.contains(e.target)) closeMenus(null);
  }
  // Atajos Markdown: sustituyen a los de formato de Thunderbird (cuya negrita/cursiva HTML se
  // perdería al convertir el correo). Ctrl+B/I/K/E y Ctrl+1…6 para títulos.
  const SHORTCUTS = {
    b: () => wrap("**", "**"),
    i: () => wrap("*", "*"),
    k: () => insertMd("[" + selectedText() + "](url)"),
    e: () => wrap("`", "`"),
  };
  function onShortcut(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const key = e.key.toLowerCase();
    let action = SHORTCUTS[key];
    if (!action && /^[1-6]$/.test(key)) action = () => prefixLine("#".repeat(Number(key)) + " ");
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    action();
  }

  function onMenuKey(e) {
    if (e.key === "Escape") closeMenus(null);
  }

  function activate() {
    if (active) return;
    bodyEl = document.querySelector(SELECTORS.body);
    if (!bodyEl) return;

    // Reserva la mitad derecha del área de edición para el preview, y arriba el alto real
    // de la barra (si no cabe en una línea y baja a dos, el texto no queda tapado).
    const style = document.createElement("style");
    style.id = IDS.style;
    const layout = (h) =>
      "body{margin-right:50% !important;margin-top:" + h + "px !important;}" +
      "#" + IDS.preview + "{position:fixed;top:" + h + "px;right:0;width:50%;height:calc(100% - " + h + "px);" +
      "overflow:auto;box-sizing:border-box;border-left:1px solid #bbb;" +
      "background:#fff;color:#111;padding:10px;}" +
      "#" + IDS.preview + " img{max-width:100%;height:auto;}";
    style.textContent = layout(40);
    (document.head || document.documentElement).appendChild(style);

    previewEl = document.createElement("div");
    previewEl.id = IDS.preview;
    previewEl.contentEditable = "false";
    bodyEl.appendChild(previewEl);

    toolbarEl = buildToolbar();
    bodyEl.appendChild(toolbarEl);
    const fit = () => {
      if (!toolbarEl) return;
      style.textContent = layout(Math.max(40, Math.ceil(toolbarEl.getBoundingClientRect().height) + 6));
    };
    fit();
    if (typeof ResizeObserver === "function") {
      toolbarObserver = new ResizeObserver(fit);
      toolbarObserver.observe(toolbarEl);
    }
    document.addEventListener("mousedown", onOutsideMenu, true);
    document.addEventListener("keydown", onMenuKey, true);

    bodyEl.addEventListener("input", scheduleRender);
    bodyEl.addEventListener("paste", onPaste);
    bodyEl.addEventListener("keydown", onShortcut, true);
    active = true;
    renderPreview();
  }

  // Apaga el preview y restaura el editor nativo a ancho completo; el texto Markdown
  // fuente permanece intacto (no se renderiza ni se sustituye el cuerpo).
  function deactivate() {
    if (!active) return;
    if (previewEl) previewEl.remove();
    if (toolbarEl) toolbarEl.remove();
    const style = document.getElementById(IDS.style);
    if (style) style.remove();
    if (bodyEl) {
      bodyEl.removeEventListener("input", scheduleRender);
      bodyEl.removeEventListener("paste", onPaste);
      bodyEl.removeEventListener("keydown", onShortcut, true);
    }
    if (toolbarObserver) { toolbarObserver.disconnect(); toolbarObserver = null; }
    document.removeEventListener("mousedown", onOutsideMenu, true);
    document.removeEventListener("keydown", onMenuKey, true);
    previewEl = null;
    toolbarEl = null;
    themeMenu = null;
    active = false;
  }

  function toggle() {
    active ? deactivate() : activate();
  }

  messenger.runtime.onMessage.addListener((msg, sender, respond) => {
    if (msg && msg.type === "cothunder-ping") { respond({ ok: true }); return true; }
    if (msg && msg.type === "cothunder-finalize") { respond({ html: finalHtml() }); return true; }
    if (msg && msg.type === "cothunder-toggle") { toggle(); respond({ active }); return true; }
  });

  // Encendido por defecto según el ajuste de Opciones (activable/desactivable con el botón o el atajo).
  messenger.storage.local.get({ mdEditorDefault: true }).then((s) => {
    if (s.mdEditorDefault) activate();
  });

  // Color de acento y tema CSS configurables en Opciones, aplicados al preview/envío.
  messenger.storage.local.get({ emailAccent: "#0969da", emailTheme: "default", emailCustomCss: "" }).then((s) => {
    emailAccent = s.emailAccent || "#0969da";
    emailTheme = s.emailTheme || "default";
    emailCustomCss = s.emailCustomCss || "";
    fillThemeMenu();
    if (active) renderPreview();
  });

  // Aplica EN VIVO los cambios de tema/acento hechos en Opciones, sin tener que
  // reabrir la redacción: si no, una ventana ya abierta se quedaría con el tema
  // que tenía al abrirse (p. ej. seguiría en UPO tras cambiar a Dracula).
  messenger.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.emailAccent) emailAccent = changes.emailAccent.newValue || "#0969da";
    if (changes.emailTheme) emailTheme = changes.emailTheme.newValue || "default";
    if (changes.emailCustomCss) emailCustomCss = changes.emailCustomCss.newValue || "";
    if (changes.emailTheme || changes.emailCustomCss) fillThemeMenu();
    if (active && (changes.emailAccent || changes.emailTheme || changes.emailCustomCss)) renderPreview();
  });
})();
