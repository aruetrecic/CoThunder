"use strict";
const EMAIL_THEME_TEMPLATE_CSS = `/* Plantilla de tema para CoThunder.
   Edita los colores y pega este CSS en «CSS personalizado», o súbelo.
   Se aplica como estilos EN LÍNEA sobre el correo (los clientes de correo
   ignoran el CSS externo y las clases), usando selectores de etiqueta. */

h1, h2, h3, h4, h5, h6 { color: #003772; }
a { color: #003772; }
table { border-collapse: collapse; }
th { background: #003772; color: #ffffff; }
th, td { border: 1px solid #d0d7de; padding: 6px 12px; }
blockquote { border-left: 4px solid #FCC100; color: #444444; }
code { background: #f6f8fa; }
mark { background-color: #FCC100; }
`;
(async () => {
  const $ = (id) => document.getElementById(id);

  // --- Pestañas: flechas, Inicio y Fin; recuerda la última abierta ---
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  const selectTab = (tab, focus) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !on;
    }
    if (focus) tab.focus();
    try { localStorage.setItem("optionsTab", tab.id); } catch (_) {}
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => selectTab(t, false));
    t.addEventListener("keydown", (e) => {
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      selectTab(tabs[(next + tabs.length) % tabs.length], true);
    });
  });
  let savedTab = null;
  try { savedTab = localStorage.getItem("optionsTab"); } catch (_) {}
  selectTab(tabs.find((t) => t.id === savedTab) || tabs[0], false);

  const cfg = await getConfig();
  $("copilotUrl").value = cfg.copilotUrl;
  $("promptTemplate").value = cfg.promptTemplate;
  $("newChatByDefault").checked = cfg.newChatByDefault;
  $("mdEditorDefault").checked = cfg.mdEditorDefault;
  $("emailAccent").value = cfg.emailAccent;
  $("emailTheme").value = cfg.emailTheme;
  $("emailCustomCss").value = cfg.emailCustomCss;
  const prof = cfg.userProfile || {};
  $("userName").value = prof.name || "";
  $("userRole").value = prof.role || "";
  $("userOrg").value = prof.org || "";
  $("userAbout").value = prof.about || "";
  $("userStyle").value = prof.style || "";

  // Autorrelleno desde la identidad por defecto de Thunderbird (nombre, organización y firma).
  $("fillFromIdentity").addEventListener("click", async () => {
    try {
      const ids = await messenger.identities.list();
      const id = ids && ids[0];
      if (!id) { $("filled").textContent = "No hay identidad configurada"; return; }
      if (id.name && !$("userName").value.trim()) $("userName").value = id.name;
      if (id.organization && !$("userOrg").value.trim()) $("userOrg").value = id.organization;
      // La firma NO se copia al perfil: la añade Thunderbird al correo, y así sus datos de
      // contacto no viajan a Copilot en cada prompt.
      $("filled").textContent = "Rellenado. Revisa y pulsa Guardar.";
      setTimeout(() => { $("filled").textContent = ""; }, 5000);
    } catch (_) {
      $("filled").textContent = "No se pudo leer la identidad.";
    }
  });
  // --- Agentes: detectados en Copilot y añadidos a mano (nombre + enlace) ---
  const renderDetected = (agents) => {
    const list = agents || [];
    $("agentsDetected").textContent = "Detectados: " + list.length;
    $("agentsList").replaceChildren(...list.map((a) => {
      const li = document.createElement("li");
      li.textContent = a.label;
      return li;
    }));
  };
  renderDetected((await messenger.storage.local.get({ agents: [] })).agents);
  $("detectAgents").addEventListener("click", async () => {
    $("detectAgents").disabled = true;
    $("detectMsg").textContent = "Buscando…";
    const res = await messenger.runtime.sendMessage({ type: "refreshAgents" }).catch(() => null);
    if (res && res.ok) {
      renderDetected(res.agents);
      $("detectMsg").textContent = res.agents.length ? "Listo." : "Copilot no muestra agentes en su panel: añádelos a mano.";
    } else {
      $("detectMsg").textContent = "Abre Copilot (botón «Preguntar a Copilot») y vuelve a intentarlo.";
    }
    $("detectAgents").disabled = false;
  });

  const addAgentRow = (a) => {
    const row = document.createElement("div");
    row.className = "agentRow";
    const n = $("customAgents").children.length + 1;
    const name = document.createElement("input");
    name.type = "text"; name.placeholder = "Nombre"; name.value = (a && a.label) || "";
    name.setAttribute("aria-label", "Nombre del agente " + n);
    const url = document.createElement("input");
    url.type = "url"; url.placeholder = "https://m365.cloud.microsoft/chat/?titleId=…"; url.value = (a && a.url) || "";
    url.setAttribute("aria-label", "Enlace del agente " + n);
    const del = document.createElement("button");
    del.type = "button"; del.textContent = "Quitar";
    del.setAttribute("aria-label", "Quitar el agente " + n);
    del.addEventListener("click", () => row.remove());
    row.append(name, url, del);
    $("customAgents").appendChild(row);
    return name;
  };
  ((await messenger.storage.local.get({ customAgents: [] })).customAgents || []).forEach(addAgentRow);
  $("addAgent").addEventListener("click", () => addAgentRow(null).focus());

  // Lee las filas: { ok, agents } o { ok: false, error }. El id es estable a partir del enlace.
  const readCustomAgents = () => {
    const agents = [];
    for (const row of $("customAgents").children) {
      const [nameEl, urlEl] = row.querySelectorAll("input");
      const label = nameEl.value.trim(), link = urlEl.value.trim();
      if (!label && !link) continue;
      let host = "";
      try { host = new URL(link).host; } catch (_) {}
      if (!label || host !== "m365.cloud.microsoft") {
        return { ok: false, error: !label ? "Falta el nombre de un agente." : "El enlace de «" + label + "» debe empezar por https://m365.cloud.microsoft/." };
      }
      let h = 0;
      for (const ch of link) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      agents.push({ id: "u_" + h.toString(36), label, url: link });
    }
    return { ok: true, agents };
  };

  $("save").addEventListener("click", async () => {
    const custom = readCustomAgents();
    $("agentsMsg").textContent = custom.ok ? "" : custom.error;
    if (!custom.ok) {
      $("saved").textContent = "No guardado: revisa los agentes en General.";
      setTimeout(() => { $("saved").textContent = ""; }, 5000);
      return;
    }
    await messenger.storage.local.set({ customAgents: custom.agents });
    const url = $("copilotUrl").value.trim();
    // Guarda SIEMPRE, aunque la URL de Copilot esté vacía o mal formada: así los
    // demás ajustes (tema del correo, acento, perfil...) no se bloquean por la URL.
    await messenger.storage.local.set({
      copilotUrl: url,
      promptTemplate: $("promptTemplate").value,
      newChatByDefault: $("newChatByDefault").checked,
      mdEditorDefault: $("mdEditorDefault").checked,
      emailAccent: $("emailAccent").value,
      emailTheme: $("emailTheme").value,
      emailCustomCss: $("emailCustomCss").value,
      userProfile: {
        name: $("userName").value.trim(),
        role: $("userRole").value.trim(),
        org: $("userOrg").value.trim(),
        about: $("userAbout").value.trim(),
        style: $("userStyle").value.trim()
      }
    });
    let host = "";
    try { host = new URL(url).host; } catch (_) {}
    $("saved").textContent = (!url || host === "m365.cloud.microsoft")
      ? "Guardado"
      : "Guardado. Aviso: solo el dominio m365.cloud.microsoft tiene permiso; otro dominio no se inyectará";
    setTimeout(() => { $("saved").textContent = ""; }, 4000);
  });

  // --- Tema del correo: subir CSS desde fichero y descargar plantilla ---
  $("emailCssFile").addEventListener("change", () => {
    const file = $("emailCssFile").files && $("emailCssFile").files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      $("emailCustomCss").value = String(reader.result || "");
      $("emailTheme").value = "custom";
    };
    reader.readAsText(file);
  });
  // Plantillas de partida: la genérica comentada y cualquier tema de themes.js (salvo
  // "Por defecto", que no lleva CSS).
  for (const p of EMAIL_THEME_PRESETS) {
    if (!p.css) continue;
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    $("emailCssBase").appendChild(opt);
  }
  const baseCss = () => {
    const p = EMAIL_THEME_PRESETS.find((x) => x.id === $("emailCssBase").value);
    if (!p) return { file: "cothunder-tema.css", css: EMAIL_THEME_TEMPLATE_CSS };
    const header = "/* Tema «" + p.name + "» de CoThunder, como base para tu tema.\n" +
      "   Edita los colores y pégalo en «CSS personalizado», o súbelo con «Subir .css».\n" +
      "   Se aplica como estilos EN LÍNEA sobre el correo; url(...) se ignora. */\n\n";
    return { file: "cothunder-tema-" + p.id + ".css", css: header + p.css + "\n" };
  };
  // Si ya hay CSS personalizado, pide un segundo clic antes de sustituirlo (sin confirm(),
  // que la página de opciones embebida puede no mostrar).
  let editArmed = null;
  $("emailCssEdit").addEventListener("click", () => {
    const btn = $("emailCssEdit");
    if ($("emailCustomCss").value.trim() && !editArmed) {
      btn.textContent = "Pulsa otra vez para sustituir tu CSS";
      editArmed = setTimeout(() => { editArmed = null; btn.textContent = "Editar como personalizado"; }, 4000);
      return;
    }
    clearTimeout(editArmed); editArmed = null;
    btn.textContent = "Editar como personalizado";
    $("emailCustomCss").value = baseCss().css;
    $("emailTheme").value = "custom";
    $("emailCustomCss").closest("details").open = true;
    $("emailCustomCss").focus();
    $("cssHint").textContent = "Copiada a «CSS personalizado»: retócala y pulsa Guardar.";
  });
  $("emailCssDownload").addEventListener("click", () => {
    const { file, css } = baseCss();
    const blob = new Blob([css], { type: "text/css" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // --- Ayuda y bienvenida ---
  const openPage = (page) => messenger.tabs.create({ url: messenger.runtime.getURL("pages/" + page) }).catch(() => {});
  $("openHelp").addEventListener("click", () => openPage("help.html"));
  $("openWelcome").addEventListener("click", () => openPage("welcome.html"));

  // --- Diagnóstico técnico (sin contenido de correos) ---
  const renderDiag = async () => {
    const { diagLog } = await messenger.storage.local.get({ diagLog: [] });
    const n = Array.isArray(diagLog) ? diagLog.length : 0;
    $("diagCount").textContent = n + (n === 1 ? " entrada" : " entradas");
    return Array.isArray(diagLog) ? diagLog : [];
  };
  await renderDiag();
  $("diagCopy").addEventListener("click", async () => {
    const log = await renderDiag();
    const head = "CoThunder " + messenger.runtime.getManifest().version + " · " + navigator.userAgent + "\n";
    const text = head + log.map((e) => [e.ts, "v" + e.v, e.ev, e.detail].filter(Boolean).join("  ")).join("\n");
    try { await navigator.clipboard.writeText(text); $("diagMsg").textContent = "Copiado."; }
    catch (_) { $("diagMsg").textContent = "No se pudo copiar."; }
    setTimeout(() => { $("diagMsg").textContent = ""; }, 4000);
  });
  $("diagClear").addEventListener("click", async () => {
    await messenger.storage.local.set({ diagLog: [] });
    await renderDiag();
  });

  // --- Registro de actividad (auditoría local, opcional) ---
  const renderAuditCount = async () => {
    const { auditLog } = await messenger.storage.local.get({ auditLog: [] });
    $("auditCount").textContent = (Array.isArray(auditLog) ? auditLog.length : 0) + " entradas";
  };
  const { auditEnabled } = await messenger.storage.local.get({ auditEnabled: false });
  $("auditEnabled").checked = auditEnabled;
  await renderAuditCount();
  $("auditEnabled").addEventListener("change", () => {
    messenger.storage.local.set({ auditEnabled: $("auditEnabled").checked }).catch(() => {});
  });
  $("auditClear").addEventListener("click", async () => {
    await messenger.storage.local.set({ auditLog: [] });
    await renderAuditCount();
  });
  $("auditExport").addEventListener("click", async () => {
    const { auditLog } = await messenger.storage.local.get({ auditLog: [] });
    const blob = new Blob([JSON.stringify(auditLog || [], null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cothunder-auditoria.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
