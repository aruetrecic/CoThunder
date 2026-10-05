"use strict";
// Asistente de bienvenida: abre Copilot y comprueba la sesión, elige tema y agente por defecto.
(async () => {
  const $ = (id) => document.getElementById(id);
  const STATES = {
    ok: ["status-ok", "Listo: sesión iniciada en Copilot."],
    login: ["status-err", "Falta iniciar sesión: entra en la ventana de Copilot y vuelve a comprobar."],
    loading: ["", "Copilot aún está cargando. Espera unos segundos y vuelve a comprobar."],
    closed: ["", "Copilot no está abierto. Pulsa «Abrir Copilot»."]
  };
  const showState = (state) => {
    const [cls, text] = STATES[state] || ["status-err", "No se pudo comprobar."];
    $("state").className = cls;
    $("state").textContent = text;
  };

  const prefs = await messenger.storage.local.get({ emailTheme: "default", lastAgentId: "", agents: [], customAgents: [] });

  // Tema por defecto (los mismos de Opciones).
  for (const p of EMAIL_THEME_PRESETS) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    $("theme").appendChild(opt);
  }
  $("theme").value = prefs.emailTheme;
  $("theme").addEventListener("change", async () => {
    await messenger.storage.local.set({ emailTheme: $("theme").value });
    $("themeSaved").textContent = "Guardado.";
  });

  const fillAgents = (agents, selected) => {
    $("agent").length = 1;
    const seen = new Set();
    agents = [...(prefs.customAgents || []), ...(agents || [])].filter((a) => a && a.id && !seen.has(a.id) && seen.add(a.id));
    for (const a of agents) {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.label;
      $("agent").appendChild(opt);
    }
    if (selected && agents.some((a) => a.id === selected)) $("agent").value = selected;
  };
  fillAgents(prefs.agents, prefs.lastAgentId);
  $("agent").addEventListener("change", async () => {
    await messenger.storage.local.set({ lastAgentId: $("agent").value });
    $("agentSaved").textContent = "Guardado.";
  });

  const check = async () => {
    $("check").disabled = true;
    $("state").className = "";
    $("state").textContent = "Comprobando…";
    const res = await messenger.runtime.sendMessage({ type: "checkCopilot" }).catch(() => null);
    showState(res && res.state);
    if (res && res.state === "ok" && res.agents) {
      fillAgents(res.agents, $("agent").value || prefs.lastAgentId);
      if (res.agents.length) messenger.storage.local.set({ agents: res.agents }).catch(() => {});
    }
    $("check").disabled = false;
  };
  $("open").addEventListener("click", async () => {
    await messenger.runtime.sendMessage({ type: "openCopilot" }).catch(() => {});
    $("state").className = "";
    $("state").textContent = "Copilot abierto. Cuando hayas entrado, pulsa «Comprobar».";
  });
  $("check").addEventListener("click", check);

  $("done").addEventListener("click", async () => {
    try {
      const tab = await messenger.tabs.getCurrent();
      if (tab) { await messenger.tabs.remove(tab.id); return; }
    } catch (_) {}
    window.close();
  });
})();
