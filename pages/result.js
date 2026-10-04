"use strict";
// Ventana de resultados: muestra un resumen o las versiones de una respuesta para elegir una.
// Los datos los deja el background en storage.session (result_<id>). El Markdown se pinta con
// markdown.js (cadena escapada) y se inserta con DOMParser, sin innerHTML.
(async () => {
  const $ = (id) => document.getElementById(id);
  const id = new URLSearchParams(location.search).get("id");
  const key = "result_" + id;
  const data = (await messenger.storage.session.get({ [key]: null }))[key];
  const say = (t) => { $("msg").textContent = t; };
  if (!data) {
    $("title").textContent = "El resultado ya no está disponible";
    say("Vuelve a pedirlo a Copilot.");
    $("copy").hidden = true;
    $("close").addEventListener("click", () => window.close());
    return;
  }

  const show = (md) => {
    const doc = new DOMParser().parseFromString(styleEmail(renderMarkdown(md), {}), "text/html");
    $("paper").replaceChildren(...doc.body.childNodes);
  };

  let current = 0;
  const texts = data.kind === "versions" ? data.versions : [data.text || ""];
  document.title = (data.kind === "versions" ? "Elige una versión" : "Resumen") + " · CoThunder";
  $("title").textContent = data.kind === "versions"
    ? "Elige una versión" + (data.title ? ": " + data.title : "")
    : (data.title || "Resumen");

  if (data.kind === "versions") {
    // Pestañas accesibles: flechas, Inicio y Fin; solo la activa entra en el orden de tabulación.
    $("tabs").hidden = false;
    $("paper").classList.remove("single");
    $("paper").setAttribute("role", "tabpanel");
    const tabs = texts.map((_, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.id = "tab" + i;
      b.textContent = "Versión " + (i + 1);
      b.addEventListener("click", () => select(i, false));
      b.addEventListener("keydown", (e) => {
        const go = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: texts.length - 1 }[e.key];
        if (go === undefined) return;
        e.preventDefault();
        select((go + texts.length) % texts.length, true);
      });
      $("tabs").appendChild(b);
      return b;
    });
    const select = (i, focus) => {
      current = i;
      tabs.forEach((t, j) => { t.setAttribute("aria-selected", String(i === j)); t.tabIndex = i === j ? 0 : -1; });
      $("paper").setAttribute("aria-labelledby", tabs[i].id);
      show(texts[i]);
      if (focus) tabs[i].focus();
    };
    select(0, false);
    $("use").hidden = false;
    $("use").addEventListener("click", async () => {
      $("use").disabled = true;
      say("Abriendo la respuesta…");
      const res = await messenger.runtime.sendMessage({ type: "useVersion", id, index: current }).catch(() => null);
      if (res && res.ok) window.close();
      else { $("use").disabled = false; say("No se pudo abrir la respuesta."); }
    });
  } else {
    show(texts[0]);
    const ids = data.messageIds || [];
    if (ids.length === 1) {
      $("reply").hidden = false;
      $("reply").addEventListener("click", () => {
        messenger.runtime.sendMessage({ type: "openReplyWindow", messageId: ids[0] }).catch(() => {});
      });
    }
  }

  $("copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(texts[current]); say("Copiado (Markdown)."); }
    catch (_) { say("No se pudo copiar."); }
  });
  $("close").addEventListener("click", () => window.close());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") window.close(); });
})();
