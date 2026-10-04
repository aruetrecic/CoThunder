"use strict";
// Ayuda: búsqueda que oculta las secciones sin el texto buscado (sin distinguir tildes ni
// mayúsculas) y botones para ir a Opciones o al asistente de bienvenida.
(() => {
  const $ = (id) => document.getElementById(id);
  const fold = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const sections = Array.from(document.querySelectorAll("main section"));
  const links = Array.from(document.querySelectorAll("nav.toc a"));

  $("q").addEventListener("input", () => {
    const q = fold($("q").value.trim());
    let shown = 0;
    for (const s of sections) {
      const hit = !q || fold(s.textContent).includes(q);
      s.hidden = !hit;
      if (hit) shown++;
    }
    for (const a of links) {
      const target = document.getElementById(a.getAttribute("href").slice(1));
      a.parentElement.hidden = !!(target && target.hidden);
    }
    $("noresults").hidden = shown > 0;
  });

  $("openOptions").addEventListener("click", () => { messenger.runtime.openOptionsPage().catch(() => {}); });
  $("openWelcome").addEventListener("click", () => { location.href = "welcome.html"; });

  // Con un ancla en la URL (#editor, #ventana…), la sección queda a la vista y con el foco.
  const target = location.hash && document.getElementById(location.hash.slice(1));
  if (target) {
    const h = target.querySelector("h2");
    if (h) { h.tabIndex = -1; h.focus(); }
  }
})();
