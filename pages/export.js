"use strict";
// Exportar a Markdown: vista maquetada y código (editable), descarga del .md, copiar y pasar el
// correo a Copilot o a un agente con una petición. Los datos los deja el background en
// storage.session (result_<id>). El Markdown se pinta con markdown.js y DOMParser, sin innerHTML.
(async () => {
  const $ = (id) => document.getElementById(id);
  const id = new URLSearchParams(location.search).get("id");
  const key = "result_" + id;
  const data = (await messenger.storage.session.get({ [key]: null }))[key];
  const say = (t) => { $("msg").textContent = t; setTimeout(() => { if ($("msg").textContent === t) $("msg").textContent = ""; }, 4000); };
  if (!data) {
    $("title").textContent = "El correo ya no está disponible";
    document.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    return;
  }
  $("title").textContent = "Markdown: " + data.title;
  document.title = data.title + " · Markdown";
  $("source").value = data.markdown;

  const render = () => {
    const doc = new DOMParser().parseFromString(styleEmail(renderMarkdown($("source").value), {}), "text/html");
    $("view").replaceChildren(...doc.body.childNodes);
  };
  render();

  // Pestañas Vista / Markdown (flechas izquierda y derecha).
  const tabs = [$("tab-view"), $("tab-source")];
  const select = (i, focus) => {
    tabs.forEach((t, j) => {
      t.setAttribute("aria-selected", String(i === j));
      t.tabIndex = i === j ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = i !== j;
    });
    if (i === 0) render();
    if (focus) tabs[i].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(i, false));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      select(1 - i, true);
    });
  });

  $("download").addEventListener("click", () => {
    const blob = new Blob([$("source").value], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = data.fileName || "correo.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    say("Descargado: " + a.download);
  });
  $("copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("source").value); say("Copiado."); }
    catch (_) { say("No se pudo copiar."); }
  });

  // Agentes: los añadidos a mano (Opciones) y los detectados en Copilot.
  const prefs = await messenger.storage.local.get({ agents: [], customAgents: [], lastAgentId: "", newChatByDefault: true });
  const seen = new Set();
  for (const a of [...(prefs.customAgents || []), ...(prefs.agents || [])]) {
    if (!a || !a.id || seen.has(a.id)) continue;
    seen.add(a.id);
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = a.label;
    opt.dataset.label = a.label;
    $("agent").appendChild(opt);
  }
  if (seen.has(prefs.lastAgentId)) $("agent").value = prefs.lastAgentId;
  $("newChat").checked = prefs.newChatByDefault !== false;

  // Envío a Copilot con progreso y Cancelar.
  let token = null;
  const STAGE_TEXT = { opening: "Abriendo Copilot…", typing: "Escribiendo…", waiting: "Copilot está respondiendo…", done: "Respuesta recibida: se abre en una ventana." };
  const finish = () => { $("ask").disabled = false; $("cancel").hidden = true; };
  messenger.runtime.onMessage.addListener((m) => {
    if (!m || m.type !== "copilotProgress" || !token || m.token !== token) return;
    if (m.stage === "error") { $("askStatus").textContent = copilotErrorText(m.reason); finish(); return; }
    if (m.stage === "cancelled") { $("askStatus").textContent = "Cancelado."; finish(); return; }
    $("askStatus").textContent = STAGE_TEXT[m.stage] || "";
    if (m.stage === "done") finish();
  });
  $("ask").addEventListener("click", async () => {
    $("ask").disabled = true;
    $("cancel").hidden = false;
    $("askStatus").textContent = "Enviando…";
    token = "a" + Date.now() + Math.floor(Math.random() * 1e6);
    const opt = $("agent").selectedOptions[0];
    const res = await messenger.runtime.sendMessage({
      type: "askCopilot", id, token, question: $("question").value, newChat: $("newChat").checked,
      agentId: $("agent").value, agentLabel: opt && $("agent").value ? opt.dataset.label : ""
    }).catch((e) => ({ ok: false, reason: e && e.message }));
    if (!res || !res.ok) {
      $("askStatus").textContent = res && res.reason === "cancelled" ? "Cancelado." : copilotErrorText(res && res.reason);
      finish();
    }
  });
  $("cancel").addEventListener("click", () => {
    if (token) messenger.runtime.sendMessage({ type: "cancelCopilot", token }).catch(() => {});
  });
})();
