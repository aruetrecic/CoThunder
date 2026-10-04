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
    { label: "svg:highlight", title: "Resaltado", kind: "wrap", before: "==", after: "==" },
    { label: "</>", title: "Código en línea (Ctrl+E)", kind: "wrap", before: "`", after: "`" },
    { menu: "Aa", title: "Más formato", items: [
      { label: "B+I", title: "Negrita y cursiva", kind: "wrap", before: "***", after: "***" },
      { label: "x₂", title: "Subíndice", kind: "wrap", before: "~", after: "~" },
      { label: "x²", title: "Superíndice", kind: "wrap", before: "^", after: "^" },
    ] },
    // Enlaces y multimedia
    { label: "svg:link", title: "Enlace (Ctrl+K)", kind: "link" },
    // Listas y cita
    { label: "svg:quote", title: "Cita", kind: "prefix", value: "> " },
    { label: "svg:list", title: "Lista", kind: "prefix", value: "- " },
    { label: "svg:olist", title: "Lista numerada", kind: "prefix", value: "1. " },
    { label: "svg:task", title: "Tarea", kind: "prefix", value: "- [ ] " },
    { menu: "svg:plus", title: "Insertar", items: [
      { label: "🖼", title: "Imagen", kind: "image" },
      { label: "😀", title: "Emoji", kind: "insert", value: ":smile:" },
      { label: "▦", title: "Tabla", kind: "block", template: "| Col 1 | Col 2 |\n| --- | --- |\n|  |  |" },
      { label: "{}", title: "Bloque de código", kind: "block", template: "```\n\n```" },
      { label: "―", title: "Regla horizontal", kind: "block", template: "---" },
      { label: "Def", title: "Lista de definición", kind: "block", template: "término\n: definición" },
      { label: "†", title: "Nota al pie (añade «[^1]: ...» al final)", kind: "insert", value: "[^1]" },
    ] },
    { menu: "svg:info", title: "Avisos (admonitions)", items: [
      { label: "ℹ", title: "Nota", kind: "block", template: "> [!NOTE]\n> " },
      { label: "💡", title: "Consejo", kind: "block", template: "> [!TIP]\n> " },
      { label: "❗", title: "Importante", kind: "block", template: "> [!IMPORTANT]\n> " },
      { label: "⚠", title: "Advertencia", kind: "block", template: "> [!WARNING]\n> " },
      { label: "🛑", title: "Precaución", kind: "block", template: "> [!CAUTION]\n> " },
    ] },
    { label: "svg:format", title: "Ordenar el Markdown: alinea tablas, tabula listas y separa bloques (Ctrl+Shift+F)", kind: "format" },
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
  // Menú de plantillas de Formato (las sembradas por CoThunder y las propias sin prefijo).
  let templateMenu = null;
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

  // Estilo de la barra: clases en la hoja propia (no en línea) para poder usar :hover, :focus-visible
  // y el tema oscuro. Los colores van en variables; data-dark las cambia cuando el editor es oscuro.
  const T = "#" + IDS.toolbar;
  const TOOLBAR_CSS =
    T + "{--ct-bar:#f6f8fa;--ct-line:#d0d7de;--ct-btn:#fff;--ct-fg:#1f2328;--ct-hover:#eaeef2;--ct-focus:#0969da;" +
    "position:fixed;top:0;left:0;width:50%;box-sizing:border-box;display:flex;align-items:center;" +
    "flex-wrap:wrap;gap:2px;padding:4px;background:var(--ct-bar);border-bottom:1px solid var(--ct-line);z-index:10;}" +
    T + "[data-dark]{--ct-bar:#161b22;--ct-line:#3d444d;--ct-btn:#21262d;--ct-fg:#e6edf3;--ct-hover:#30363d;--ct-focus:#4493f8;" +
    "color-scheme:dark;}" +
    T + " button{cursor:pointer;border:1px solid var(--ct-line);background:var(--ct-btn);color:var(--ct-fg);" +
    "border-radius:4px;padding:2px 5px;font:13px sans-serif;white-space:nowrap;}" +
    T + " button:hover{background:var(--ct-hover);}" +
    T + " button:focus-visible{outline:2px solid var(--ct-focus);outline-offset:1px;}" +
    T + " [role=menu]{display:none;position:absolute;top:100%;left:0;margin-top:2px;z-index:20;flex-direction:column;" +
    "min-width:max-content;max-height:60vh;overflow:auto;padding:3px;gap:1px;background:var(--ct-btn);" +
    "border:1px solid var(--ct-line);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.18);}" +
    T + " [role=menuitem]{border-color:transparent;text-align:left;}" +
    T + " button{display:inline-flex;align-items:center;gap:2px;min-height:24px;}" +
    T + " svg{fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round;}" +
    T + " .ct-status{flex:1 1 100%;font:12px sans-serif;color:var(--ct-fg);padding:2px 4px;}" +
    T + " .ct-status:empty{display:none;}";

  // Al entrar en la barra con el teclado se guarda el cursor del editor; las acciones lo
  // recuperan antes de escribir, para que el Markdown vaya donde estaba el usuario.
  let savedRange = null;

  function inToolbar(node) {
    return !!(toolbarEl && node && toolbarEl.contains(node));
  }

  function returnToEditor() {
    if (!inToolbar(document.activeElement)) return;
    bodyEl.focus();
    if (savedRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
  }

  function runSpec(spec) {
    returnToEditor();
    switch (spec.kind) {
      case "wrap": wrap(spec.before, spec.after); break;
      case "prefix": prefixLine(spec.value); break;
      case "link": insertMd("[" + selectedText() + "](url)"); break;
      case "image": insertMd("![" + selectedText() + "](url)"); break;
      case "block": insertBlock(spec.template); break;
      case "insert": insertMd(spec.value); break;
      case "format": formatSource(); break;
    }
  }

  // Iconos SVG propios (16×16, trazo en currentColor: siguen el tema claro/oscuro de la barra y se
  // ven igual en todos los sistemas, a diferencia de los emoji). Se crean con createElementNS.
  const SVG_NS = "http://www.w3.org/2000/svg";
  const ICONS = {
    highlight: ["M3 13.5h6", "M5 11.5l1-3 5.5-5.5 2 2L8 10.5l-3 1z"],
    link: ["M6.5 9.5l3-3", "M7.5 4.5l1-1a2.5 2.5 0 013.5 3.5l-1 1", "M8.5 11.5l-1 1A2.5 2.5 0 014 9l1-1"],
    quote: ["M3 12V9.5C3 7 4 5.5 6 4.5", "M3 9.5h3V12H3z", "M9 12V9.5c0-2.5 1-4 3-5", "M9 9.5h3V12H9z"],
    list: ["M6 4h8", "M6 8h8", "M6 12h8", "M2.5 4h.5", "M2.5 8h.5", "M2.5 12h.5"],
    olist: ["M6.5 4h7.5", "M6.5 8h7.5", "M6.5 12h7.5", "M2.5 2.5L3.5 2v4", "M2 10.5c0-.8 2.5-.8 2 .5L2 13.5h2.5"],
    task: ["M2.5 2.5h11v11h-11z", "M5 8l2 2 4-4.5"],
    plus: ["M2.5 2.5h11v11h-11z", "M8 5v6", "M5 8h6"],
    info: ["M8 1.8a6.2 6.2 0 100 12.4A6.2 6.2 0 008 1.8z", "M8 7v4.5", "M8 4.6v.1"],
    format: ["M2 3.5h12", "M5 6.5h9", "M5 9.5h9", "M2 12.5h12", "M2 6l1.5 1.5L2 9"],
    template: ["M4 1.8h5l3 3v9.4H4z", "M9 1.8v3h3", "M6 8h4", "M6 10.5h4"],
    palette: ["M8 1.8a6.2 6.2 0 000 12.4c1 0 1.5-.6 1.5-1.3 0-.9-.8-1.1-.8-2 0-.6.5-1.1 1.2-1.1H12a2.2 2.2 0 002.2-2.2C14.2 4.4 11.4 1.8 8 1.8z", "M5 7.2v.1", "M7 4.7v.1", "M10 4.9v.1"],
    sparkle: ["M8 1.8l1.4 4.3 4.3 1.4-4.3 1.4L8 13.2 6.6 8.9 2.3 7.5l4.3-1.4z", "M13 11.5v3", "M11.5 13h3"],
    help: ["M8 1.8a6.2 6.2 0 100 12.4A6.2 6.2 0 008 1.8z", "M6.2 6.2a1.9 1.9 0 113 1.6c-.7.4-1.2.8-1.2 1.6", "M8 11.4v.1"]
  };
  function iconEl(name) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    for (const d of ICONS[name] || []) {
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
    }
    return svg;
  }
  // Contenido de un botón: "svg:nombre" pinta el icono; el resto es texto. suffix va detrás (▾).
  function setButtonContent(btn, label, suffix) {
    btn.replaceChildren();
    if (String(label).startsWith("svg:")) btn.appendChild(iconEl(label.slice(4)));
    else btn.appendChild(document.createTextNode(label));
    if (suffix) btn.appendChild(document.createTextNode(suffix));
  }

  function makeButton(label, title, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    setButtonContent(btn, label);
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.tabIndex = -1;
    // No robar la selección del editor al pulsar el botón.
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", onClick);
    return btn;
  }

  const isOpen = (popup) => popup.style.display === "flex";

  function closeMenus(except) {
    if (!toolbarEl) return;
    toolbarEl.querySelectorAll("[role=menu]").forEach((p) => {
      if (p === except) return;
      p.style.display = "none";
      p.previousElementSibling.setAttribute("aria-expanded", "false");
    });
  }

  function openMenu(popup, focusIndex) {
    closeMenus(popup);
    popup.style.display = "flex";
    popup.previousElementSibling.setAttribute("aria-expanded", "true");
    // Si se sale por la derecha de la barra, se alinea a la derecha del botón.
    popup.style.left = "0"; popup.style.right = "auto";
    const bar = toolbarEl.getBoundingClientRect(), r = popup.getBoundingClientRect();
    if (r.right > bar.right) { popup.style.left = "auto"; popup.style.right = "0"; }
    if (focusIndex !== undefined) {
      const items = popup.querySelectorAll("[role=menuitem]");
      if (items.length) items[(focusIndex + items.length) % items.length].focus();
    }
  }

  // Menú desplegable propio: botón "label ▾" + panel de botones. Devuelve { wrap, setItems, setLabel }.
  let menuCount = 0;
  function makeMenu(label, title) {
    const wrapEl = document.createElement("span");
    wrapEl.style.cssText = "position:relative;display:inline-flex;";
    const popup = document.createElement("div");
    popup.id = IDS.toolbar + "-menu" + (++menuCount);
    popup.setAttribute("role", "menu");
    popup.setAttribute("aria-label", title);
    const btn = makeButton(label, title, (e) => {
      if (isOpen(popup)) { closeMenus(null); return; }
      // Abierto con Enter o espacio (sin ratón, detail 0): el foco pasa a la primera opción.
      openMenu(popup, e.detail === 0 ? 0 : undefined);
    });
    setButtonContent(btn, label, " ▾");
    btn.setAttribute("aria-haspopup", "menu");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", popup.id);
    wrapEl.append(btn, popup);
    const setItems = (items) => {
      popup.replaceChildren();
      for (const it of items) {
        const item = makeButton(it.text, it.title || it.text, () => {
          // Con el teclado el foco vuelve al botón del menú; la acción lo lleva al editor si escribe.
          if (inToolbar(document.activeElement)) btn.focus();
          closeMenus(null);
          it.onClick();
        });
        item.setAttribute("role", "menuitem");
        popup.appendChild(item);
      }
    };
    const setLabel = (text, t) => {
      setButtonContent(btn, text, " ▾"); btn.title = t; btn.setAttribute("aria-label", t); popup.setAttribute("aria-label", t);
    };
    return { wrap: wrapEl, setItems, setLabel };
  }

  // Controles de primer nivel de la barra (botones y botones de menú), en orden.
  function toolbarControls() {
    return Array.from(toolbarEl.querySelectorAll(":scope > button, :scope > span > button"));
  }

  // Foco itinerante (WAI-ARIA toolbar): solo un control de la barra está en el orden de tabulación.
  function focusControl(btn) {
    for (const b of toolbarControls()) b.tabIndex = b === btn ? 0 : -1;
    btn.focus();
  }

  // Alt+F10 desde el editor: guarda el cursor y lleva el foco al control activo de la barra.
  function enterToolbar() {
    const sel = window.getSelection();
    savedRange = sel && sel.rangeCount && bodyEl.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    const controls = toolbarControls();
    focusControl(controls.find((b) => b.tabIndex === 0) || controls[0]);
  }

  // Teclado dentro de la barra: flechas izquierda/derecha, Inicio y Fin entre controles; flechas
  // arriba/abajo, Inicio y Fin dentro de un menú; Escape cierra el menú (y, con todo cerrado,
  // vuelve al editor); Tab cierra el menú abierto.
  function onToolbarKey(e) {
    const target = e.target;
    const popup = target.closest("[role=menu]");
    if (popup) {
      const items = Array.from(popup.querySelectorAll("[role=menuitem]"));
      const i = items.indexOf(target);
      const go = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
      if (go !== undefined) items[(go + items.length) % items.length].focus();
      else if (e.key === "Escape") { closeMenus(null); focusControl(popup.previousElementSibling); }
      else if (e.key === "Tab") { closeMenus(null); return; }
      else return;
    } else {
      const controls = toolbarControls();
      const i = controls.indexOf(target);
      if (i < 0) return;
      const menu = target.getAttribute("aria-haspopup") ? target.nextElementSibling : null;
      const go = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: controls.length - 1 }[e.key];
      if (go !== undefined) { closeMenus(null); focusControl(controls[(go + controls.length) % controls.length]); }
      else if (menu && (e.key === "ArrowDown" || e.key === "ArrowUp")) openMenu(menu, e.key === "ArrowDown" ? 0 : -1);
      else if (e.key === "Escape") { if (Array.from(toolbarEl.querySelectorAll("[role=menu]")).some(isOpen)) closeMenus(null); else returnToEditor(); }
      else return;
    }
    e.preventDefault();
    e.stopPropagation();
  }

  // Tema de la barra: oscuro si el fondo real del editor es oscuro; si es transparente, el del sistema.
  function isDarkEditor() {
    for (let n = bodyEl; n && n.nodeType === 1; n = n.parentElement) {
      const m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
      if (!m || (m.length > 3 && Number(m[3]) === 0)) continue;
      const [r, g, b] = m.map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
    }
    return darkQuery.matches;
  }

  function applyToolbarTheme() {
    if (toolbarEl) toolbarEl.toggleAttribute("data-dark", isDarkEditor());
  }

  function buildToolbar() {
    const toolbar = document.createElement("div");
    toolbar.id = IDS.toolbar;
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Formato Markdown (Alt+F10 para llegar con el teclado)");
    // No editable ni revisado por el corrector: la barra vive dentro del cuerpo editable.
    toolbar.contentEditable = "false";
    toolbar.spellcheck = false;
    toolbar.addEventListener("keydown", onToolbarKey);

    TOOLBAR_ITEMS.forEach((spec) => {
      if (spec.menu) {
        const m = makeMenu(spec.menu, spec.title);
        m.setItems(spec.items.map((it) => ({ text: it.label + "  " + it.title, title: it.title, onClick: () => runSpec(it) })));
        toolbar.appendChild(m.wrap);
      } else {
        toolbar.appendChild(makeButton(spec.label, spec.title, () => runSpec(spec)));
      }
    });

    improveMenu = makeMenu("svg:sparkle", "Mejorar con Copilot el texto seleccionado");
    toolbar.appendChild(improveMenu.wrap);
    loadImproveMenu();

    templateMenu = makeMenu("svg:template", "Insertar plantilla de formato");
    toolbar.appendChild(templateMenu.wrap);
    loadTemplateMenu();

    themeMenu = makeMenu("svg:palette", "Estilo de este correo");
    themeMenu.wrap.style.marginLeft = "auto";
    toolbar.appendChild(themeMenu.wrap);
    fillThemeMenu();

    toolbar.appendChild(makeButton("svg:help", "Ayuda del editor", () => {
      messenger.runtime.sendMessage({ type: "openHelp", anchor: "editor" }).catch(() => {});
    }));

    // Avisos breves de la barra (p. ej. «Mejorando con Copilot…»), leídos por los lectores de pantalla.
    statusEl = document.createElement("div");
    statusEl.className = "ct-status";
    statusEl.setAttribute("role", "status");
    statusEl.setAttribute("aria-live", "polite");
    toolbar.appendChild(statusEl);
    toolbar.querySelector("button").tabIndex = 0;
    return toolbar;
  }

  // --- ✨ Mejorar con Copilot: reescribe la selección (más formal, más corto, corregir, traducir…) ---
  // El background pone el prompt y entrega la respuesta con "cothunder-improved"; el texto nuevo
  // sustituye la selección guardada con insertHTML, así que Ctrl+Z lo deshace.
  let improveMenu = null;
  let statusEl = null;
  let statusTimer = null;
  let improving = null; // { token, range }

  function setToolbarStatus(text, keepMs) {
    if (!statusEl) return;
    clearTimeout(statusTimer);
    statusEl.textContent = text || "";
    if (text && keepMs) statusTimer = setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, keepMs);
  }

  function loadImproveMenu() {
    if (!improveMenu) return;
    const menu = improveMenu;
    messenger.runtime.sendMessage({ type: "listImproveActions" }).then((res) => {
      if (menu !== improveMenu) return;
      const items = ((res && res.actions) || []).map((a) => ({ text: a.label, title: a.label + " (texto seleccionado)", onClick: () => improveSelection(a.id) }));
      menu.setItems(items.length ? items : [{ text: "No disponible", onClick: () => {} }]);
    }).catch(() => {});
  }

  function improveSelection(action) {
    returnToEditor();
    if (improving) { setToolbarStatus("Ya hay una mejora en curso; espera a que termine.", 4000); return; }
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed || !bodyEl.contains(sel.anchorNode) || inToolbar(sel.anchorNode)) {
      setToolbarStatus("Selecciona primero el texto que quieres mejorar.", 5000);
      return;
    }
    const range = sel.getRangeAt(0).cloneRange();
    const text = nodesToMarkdown(Array.from(range.cloneContents().childNodes));
    if (!text.trim()) { setToolbarStatus("Selecciona primero el texto que quieres mejorar.", 5000); return; }
    improving = { token: null, range };
    setToolbarStatus("Mejorando con Copilot…");
    messenger.runtime.sendMessage({ type: "improveText", action, text }).then((res) => {
      if (res && res.ok) { if (improving) improving.token = res.token; return; }
      improving = null;
      setToolbarStatus(res && res.reason === "login"
        ? "Inicia sesión en Copilot (ventana abierta) y vuelve a intentarlo."
        : "No se pudo enviar a Copilot" + (res && res.reason ? " (" + res.reason + ")" : "") + ".", 8000);
    }).catch(() => { improving = null; setToolbarStatus("No se pudo enviar a Copilot.", 6000); });
  }

  function applyImproved(token, text) {
    if (!improving || (improving.token && improving.token !== token)) return;
    const { range } = improving;
    improving = null;
    if (!text) { setToolbarStatus("No llegó la respuesta de Copilot; revísala en su ventana.", 8000); return; }
    bodyEl.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const blocks = text.replace(/\r/g, "").split(/\n{2,}/).filter((b) => b.trim());
    let ok = false;
    try { ok = document.execCommand("insertHTML", false, sourceBlocksHtml(blocks)); } catch (e) { ok = false; }
    if (!ok) insertMd(text);
    scheduleRender();
    setToolbarStatus("Texto mejorado. Ctrl+Z para deshacer.", 6000);
  }

  // Menú "📄 Plantillas": pide al background las plantillas de Formato (carpetas de Plantillas de
  // Thunderbird) e inserta en el cursor el Markdown de la elegida. "↻" recarga la lista.
  function loadTemplateMenu() {
    if (!templateMenu) return;
    const menu = templateMenu;
    menu.setItems([{ text: "Cargando plantillas…", onClick: () => {} }]);
    const reload = { text: "↻ Actualizar lista", title: "Volver a leer las carpetas de Plantillas", onClick: loadTemplateMenu };
    messenger.runtime.sendMessage({ type: "listFormatTemplates" }).then((res) => {
      if (menu !== templateMenu) return;
      const list = (res && res.templates) || [];
      const multi = new Set(list.map((t) => t.source)).size > 1;
      const items = list.map((t) => ({
        text: t.label + (multi && t.source ? " (" + t.source + ")" : ""),
        title: "Insertar «" + t.label + "»",
        onClick: () => insertTemplate(t.id)
      }));
      if (!items.length) items.push({ text: "No hay plantillas de formato", onClick: () => {} });
      items.push(reload);
      menu.setItems(items);
    }).catch(() => {
      if (menu === templateMenu) menu.setItems([{ text: "No se pudieron leer las plantillas", onClick: () => {} }, reload]);
    });
  }

  function insertTemplate(id) {
    messenger.runtime.sendMessage({ type: "getFormatTemplate", id }).then((res) => {
      if (res && res.ok && res.body) insertBlock(res.body);
    }).catch(() => {});
  }

  // Menú "🎨 Estilo": presets de themes.js (+ "Personalizado" si hay CSS propio). Cambia el
  // estilo de ESTE correo al momento (preview y envío); el tema por defecto sigue siendo el
  // de Opciones.
  function fillThemeMenu() {
    if (!themeMenu) return;
    const list = PRESETS.map((p) => ({ id: p.id, name: p.name }));
    if (emailCustomCss.trim() || emailTheme === "custom") list.push({ id: "custom", name: "Personalizado" });
    const current = list.find((t) => t.id === emailTheme) || list[0];
    themeMenu.setLabel("svg:palette", "Estilo de este correo: " + (current ? current.name : "") +
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

  // Texto de un grupo de nodos: los clona en un contenedor oculto, convierte las imágenes
  // insertadas a sintaxis ![alt](src) —innerText las descartaría— y lee el texto. Trabaja
  // sobre un clon para no tocar el cursor del editor.
  function chunkText(nodes) {
    const holder = document.createElement("div");
    for (const n of nodes) holder.appendChild(n.cloneNode(true));
    holder.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      const alt = img.getAttribute("alt") || "";
      img.replaceWith(document.createTextNode("![" + alt + "](" + src + ")"));
    });
    // Un <p> anidado no debe aportar línea en blanco extra: se lee como bloque simple.
    holder.querySelectorAll("p").forEach((pEl) => {
      const d = document.createElement("div");
      while (pEl.firstChild) d.appendChild(pEl.firstChild);
      pEl.replaceWith(d);
    });
    holder.style.cssText = "position:absolute;left:-99999px;top:0;";
    document.body.appendChild(holder);   // innerText necesita estar en el documento
    const text = holder.innerText || "";
    holder.remove();
    return text;
  }

  const BLOCK_TAGS = /^(P|DIV|H[1-6]|PRE|UL|OL|LI|TABLE|BLOCKQUOTE|HR|SECTION|ARTICLE)$/;

  // Markdown de un tramo del cuerpo. Cada bloque del editor (un <p> por cada Enter en
  // Thunderbird) es un bloque; los nodos en línea seguidos (texto, <br>…) forman otro. Se unen
  // con joinSourceBlocks: las líneas seguidas de una lista, tabla, cita o bloque de código no
  // llevan línea en blanco entre ellas; el resto son párrafos (markdown.js, mismo scope).
  function nodesToMarkdown(nodes) {
    const chunks = [];
    let inline = [];
    const flushInline = () => {
      if (!inline.length) return;
      const hasBr = inline.some((n) => n.nodeName === "BR" || (n.querySelector && n.querySelector("br")));
      const text = chunkText(inline);
      if (text.trim() || hasBr) chunks.push(text);
      inline = [];
    };
    for (const n of nodes) {
      if (n.nodeType === 1 && BLOCK_TAGS.test(n.nodeName)) {
        flushInline();
        chunks.push(chunkText([n]));
      } else {
        inline.push(n);
      }
    }
    flushInline();
    return joinSourceBlocks(chunks);
  }

  // "⇥ Ordenar": reescribe cada tramo Markdown ya ordenado (formatMarkdownBlocks), un <p> por
  // bloque y <br> entre sus líneas; las sangrías y espacios dobles van como &nbsp; para que el
  // editor no los colapse. Con execCommand("insertHTML") para que Ctrl+Z lo deshaga. Los tramos
  // con imágenes insertadas no se tocan (se perderían como imagen).
  function sourceBlocksHtml(blocks) {
    const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const keepSpaces = (line) => esc(line)
      .replace(/^ +/, (m) => "\u00a0".repeat(m.length))
      .replace(/ {2,}/g, (m) => " " + "\u00a0".repeat(m.length - 1));
    return blocks.map((b) => "<p>" + b.split("\n").map((l) => keepSpaces(l) || "").join("<br>") + "</p>").join("");
  }

  function markdownRuns() {
    const runs = [];
    let run = [];
    for (const child of Array.from(bodyEl.childNodes)) {
      if (child === previewEl || child === toolbarEl) continue;
      if (child.nodeType === 1 && child.matches(PRESERVED_SELECTOR)) {
        if (run.length) runs.push(run);
        run = [];
      } else {
        run.push(child);
      }
    }
    if (run.length) runs.push(run);
    return runs;
  }

  // Firma y cita tal cual, para comprobar que una reescritura no las ha tocado.
  function preservedSnapshot() {
    return Array.from(bodyEl.children).filter((n) => n.matches(PRESERVED_SELECTOR)).map((n) => n.outerHTML).join("\u0000");
  }

  // Sustitución directa de un tramo por el HTML ordenado (no se puede deshacer con Ctrl+Z).
  function replaceRun(run, html) {
    const tpl = new DOMParser().parseFromString(html, "text/html");
    const anchor = run[0];
    for (const n of Array.from(tpl.body.childNodes)) bodyEl.insertBefore(n, anchor);
    for (const n of run) n.remove();
  }

  function formatSource() {
    if (!bodyEl) return;
    bodyEl.focus();
    let changed = false;
    // De abajo arriba: reescribir un tramo no desplaza los nodos de los anteriores.
    for (const run of markdownRuns().reverse()) {
      if (run.some((n) => n.nodeName === "IMG" || (n.querySelector && n.querySelector("img")))) continue;
      const before = nodesToMarkdown(run);
      if (!before.trim()) continue;
      const blocks = formatMarkdownBlocks(before);
      if (blocks.join("\n\n") === before) continue;
      const html = sourceBlocksHtml(blocks);
      // Selección DENTRO del tramo (del inicio del primer nodo al final del último), sin tocar el
      // borde con la firma o la cita: así el editor no fusiona el último párrafo con ellas.
      const first = run[0], last = run[run.length - 1];
      const range = document.createRange();
      range.setStart(first, 0);
      range.setEnd(last, last.nodeType === 3 ? last.length : last.childNodes.length);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      const preservedBefore = preservedSnapshot();
      let ok = false;
      try { ok = document.execCommand("insertHTML", false, html); } catch (e) { ok = false; }
      if (ok && preservedSnapshot() !== preservedBefore) {
        // El editor tocó la firma o la cita: se deshace y se usa la sustitución directa.
        try { document.execCommand("undo"); } catch (e) { /* sin deshacer */ }
        ok = false;
      }
      if (!ok) replaceRun(markdownRuns().find((r) => r.includes(first)) || run, html);
      changed = true;
    }
    if (changed) scheduleRender();
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
    // Con el foco en la barra, sus teclas las maneja onToolbarKey (los atajos no escriben en el editor).
    if (inToolbar(e.target)) return;
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === "F10") {
      e.preventDefault();
      e.stopPropagation();
      enterToolbar();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      e.stopPropagation();
      formatSource();
      return;
    }
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const key = e.key.toLowerCase();
    let action = SHORTCUTS[key];
    if (!action && /^[1-6]$/.test(key)) action = () => prefixLine("#".repeat(Number(key)) + " ");
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    action();
  }

  // Escape con el foco en el editor cierra un menú abierto con el ratón (en la barra: onToolbarKey).
  function onMenuKey(e) {
    if (e.key === "Escape" && !inToolbar(e.target)) closeMenus(null);
  }

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function activate() {
    if (active) return;
    bodyEl = document.querySelector(SELECTORS.body);
    if (!bodyEl) return;

    // Reserva la mitad derecha del área de edición para el preview, y arriba el alto real
    // de la barra (si no cabe en una línea y baja a dos, el texto no queda tapado).
    const style = document.createElement("style");
    style.id = IDS.style;
    const layout = (h) =>
      "body{margin-right:50% !important;margin-top:" + h + "px !important;" +
      "font-family:Consolas,Menlo,'DejaVu Sans Mono',monospace !important;}" +
      "#" + IDS.preview + "{position:fixed;top:" + h + "px;right:0;width:50%;height:calc(100% - " + h + "px);" +
      "overflow:auto;box-sizing:border-box;border-left:1px solid #bbb;" +
      "background:#fff;color:#111;padding:10px;" +
      // El preview no hereda la letra monoespaciada de la zona de escritura: es el correo final.
      "font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;}" +
      "#" + IDS.preview + " img{max-width:100%;height:auto;}" + TOOLBAR_CSS;
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
    applyToolbarTheme();
    darkQuery.addEventListener("change", applyToolbarTheme);
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
    darkQuery.removeEventListener("change", applyToolbarTheme);
    previewEl = null;
    savedRange = null;
    toolbarEl = null;
    themeMenu = null;
    templateMenu = null;
    improveMenu = null;
    statusEl = null;
    improving = null;
    active = false;
  }

  function toggle() {
    active ? deactivate() : activate();
  }

  messenger.runtime.onMessage.addListener((msg, sender, respond) => {
    if (msg && msg.type === "cothunder-ping") { respond({ ok: true }); return true; }
    if (msg && msg.type === "cothunder-finalize") { respond({ html: finalHtml() }); return true; }
    if (msg && msg.type === "cothunder-toggle") { toggle(); respond({ active }); return true; }
    if (msg && msg.type === "cothunder-improved") { applyImproved(msg.token, msg.text); respond({ ok: true }); return true; }
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
