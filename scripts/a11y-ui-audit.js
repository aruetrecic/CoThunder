// Auditoría de accesibilidad de una página de UI (popup, opciones): contraste WCAG AA de cada
// texto (también placeholders), campos sin etiqueta, botones sin nombre e imágenes sin alt.
// Uso: cargar al final de la página (p. ej. desde la consola) y leer document.title.
(() => {
  const parse = (c) => { const k = c.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/); if (k) return [k[1] * 255, k[2] * 255, k[3] * 255, k[4] != null ? Number(k[4]) : 1]; const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].split(",").map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (t, u) => [0, 1, 2].map((i) => t[i] * t[3] + u[i] * (1 - t[3])).concat(1);
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const canvas = dark ? [30, 30, 30, 1] : [255, 255, 255, 1];   // fondo de ventana del sistema
  const bgOf = (el) => { const L = []; for (let n = el; n; n = n.parentElement) L.push(parse(getComputedStyle(n).backgroundColor)); let b = canvas; for (let i = L.length - 1; i >= 0; i--) b = over(L[i], b); return b; };
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const out = [];
  document.querySelectorAll("body *").forEach((el) => {
    if (!visible(el)) return;
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" ");
    const isField = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    const text = own || (isField ? (el.value || el.placeholder || "") : "");
    if (text) {
      const cs = getComputedStyle(el);
      let fg = parse(cs.color);
      if (isField && !el.value && el.placeholder) fg = parse(getComputedStyle(el, "::placeholder").color);
      const bg = bgOf(el), f = over(fg, bg);
      const op = Number(cs.opacity) * (el.parentElement ? 1 : 1);
      let o = 1; for (let n = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
      const fEff = [0, 1, 2].map((i) => f[i] * o + bg[i] * (1 - o)).concat(1);
      const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
      const min = (size >= 24 || (bold && size >= 18.66)) ? 3 : 4.5;
      const disabled = el.disabled || el.closest("[disabled]");
      const r = ratio(fEff, bg);
      if (r < min && !disabled) out.push("contraste " + el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + " «" + text.slice(0, 25) + "» " + hex(fEff) + "/" + hex(bg) + " = " + r.toFixed(2));
    }
    if (isField && el.type !== "hidden") {
      const named = el.labels && el.labels.length || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.title;
      if (!named) out.push("campo sin etiqueta: " + el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""));
    }
    if (el.tagName === "BUTTON" && !(el.textContent.trim() || el.getAttribute("aria-label") || el.title)) out.push("botón sin nombre: " + (el.id || el.outerHTML.slice(0, 40)));
    if (el.tagName === "IMG" && !el.hasAttribute("alt")) out.push("imagen sin alt: " + el.src.split("/").pop());
  });
  document.title = (out.length ? "FALLOS " + out.length : "OK") + " | " + [...new Set(out)].join(" | ");
})();
