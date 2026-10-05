"use strict";
(async () => {
  const $ = (id) => document.getElementById(id);
  // Mensaje de la operación junto a Enviar. «Listo» sin más no se muestra (no aporta). action:
  // { label, run } añade un botón (p. ej. «Ir a Copilot» si falta iniciar sesión).
  const setStatus = (cls, text, action) => {
    $("dot").className = cls;
    $("status").className = "msgbar " + (cls || "");
    $("statusText").textContent = text;
    $("status").hidden = !text || (!cls && text === "Listo");
    $("statusAction").hidden = !action;
    $("statusAction").textContent = action ? action.label : "";
    $("statusAction").onclick = action ? action.run : null;
  };

  // Modo de la ventana: "create" (correo nuevo) o "reply" (respuesta). Determina UI y tamaño.
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") === "create" ? "create" : "reply";
  if (mode === "create") {
    document.body.classList.add("mode-create");
    document.title = "Crear desde Copilot";
    $("title").textContent = "Crear desde Copilot";
  }

  // --- Pestañas: se quitan las que no son de este modo y se recuerda la última por modo ---
  document.querySelectorAll("[data-modes]").forEach((el) => {
    if (!el.dataset.modes.split(" ").includes(mode)) el.remove();
  });
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  const tabKey = mode === "create" ? "lastTabCreate" : "lastTabReply";
  const selectTab = (tab, focus) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).classList.toggle("active", on);
    }
    if (focus) tab.focus();
    try { localStorage.setItem(tabKey, tab.id); } catch (_) {}
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => selectTab(t, false));
    // Navegación de teclado estándar de tablist: flechas, Inicio y Fin.
    t.addEventListener("keydown", (e) => {
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      selectTab(tabs[(next + tabs.length) % tabs.length], true);
    });
  });
  // Ctrl+PgDn / Ctrl+PgUp cambian de pestaña desde cualquier campo.
  document.addEventListener("keydown", (e) => {
    if (!e.ctrlKey || (e.key !== "PageDown" && e.key !== "PageUp")) return;
    e.preventDefault();
    const cur = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    selectTab(tabs[(cur + (e.key === "PageDown" ? 1 : -1) + tabs.length) % tabs.length], true);
  });
  let savedTab = null;
  try { savedTab = localStorage.getItem(tabKey); } catch (_) {}
  selectTab(tabs.find((t) => t.id === savedTab) || tabs[0], false);

  // Destinatarios (solo creación): contador de direcciones válidas en la pestaña y aviso de las
  // que no lo son bajo cada caja (antes se descartaban en silencio al crear el correo).
  const RECIPIENT_IDS = ["recipient-to", "recipient-cc", "recipient-bcc"];
  const invalidRecipientList = () => RECIPIENT_IDS.filter((id) => $(id))
    .flatMap((id) => invalidRecipients($(id).value));
  const countEl = $("recipients-count");
  if (countEl) {
    const updateRecipients = () => {
      let n = 0;
      for (const id of RECIPIENT_IDS) {
        n += parseRecipients($(id).value).length;
        const bad = invalidRecipients($(id).value);
        $(id).classList.toggle("invalid", bad.length > 0);
        $(id + "-hint").textContent = bad.length ? "No válida" + (bad.length > 1 ? "s" : "") + ": " + bad.join(", ") : "";
        $(id + "-hint").hidden = bad.length === 0;
      }
      countEl.textContent = String(n);
      countEl.hidden = n === 0;
    };
    RECIPIENT_IDS.forEach((id) => $(id).addEventListener("input", updateRecipients));
  }

  // Contador del prompt: Copilot corta (o rechaza) los mensajes muy largos, p. ej. con el hilo
  // incluido. Límite aproximado del chat de M365 Copilot; se avisa, no se bloquea.
  const PROMPT_MAX = 16000;
  const updatePromptCount = () => {
    const n = $("prompt").value.length;
    $("prompt-count").textContent = "· " + n.toLocaleString("es-ES") + " / " + PROMPT_MAX.toLocaleString("es-ES") +
      (n > PROMPT_MAX ? " — demasiado largo, Copilot podría cortarlo" : "");
    $("prompt-count").classList.toggle("over", n > PROMPT_MAX);
  };
  $("prompt").addEventListener("input", updatePromptCount);

  // Aviso de tratamiento la primera vez (RGPD/ENS): el contenido del correo viaja a Copilot.
  messenger.storage.local.get({ privacyAck: false }).then(({ privacyAck }) => {
    if (privacyAck || !$("privacy")) return;
    $("privacy").hidden = false;
    $("privacyOk").addEventListener("click", () => {
      $("privacy").hidden = true;
      messenger.storage.local.set({ privacyAck: true }).catch(() => {});
    });
  }).catch(() => {});

  // --- Ventana: recuerda tamaño/posición por modo; por defecto, el 50 % del alto de la pantalla
  // (con pestañas cabe todo). Claves "V2": descartan los tamaños guardados antes de este cambio.
  const boundsKey = mode === "create" ? "winBoundsCreateV2" : "winBoundsV2";
  try {
    const availW = screen.availWidth, availH = screen.availHeight;
    const def = { width: mode === "create" ? 620 : 600, height: Math.round(availH * 0.5) };
    const store = await messenger.storage.local.get({ [boundsKey]: null });
    const winBounds = store[boundsKey];
    let w, h, left, top;
    if (winBounds && winBounds.width && winBounds.height) {
      w = Math.min(winBounds.width, availW);
      h = Math.min(winBounds.height, availH);
      left = Math.min(Math.max(0, winBounds.left || 0), Math.max(0, availW - w));
      top = Math.min(Math.max(0, winBounds.top || 0), Math.max(0, availH - h));
    } else {
      w = Math.min(def.width, availW);
      h = Math.min(def.height, availH);
      left = Math.max(0, Math.round((availW - w) / 2));
      top = Math.max(0, Math.round((availH - h) / 2));
    }
    const win = await messenger.windows.getCurrent();
    await messenger.windows.update(win.id, { width: w, height: h, left, top });
  } catch (_) {}

  // Guarda tamaño/posición al redimensionar/mover (con rebote) y al cerrar, por modo.
  let saveTimer = null;
  const saveBounds = () => {
    messenger.storage.local.set({
      [boundsKey]: { width: window.outerWidth, height: window.outerHeight, left: window.screenX, top: window.screenY }
    }).catch(() => {});
  };
  window.addEventListener("resize", () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveBounds, 400); });
  window.addEventListener("pagehide", saveBounds);

  let customAgents = [];
  const populateAgents = (agents, selectedId) => {
    const sel = $("agent");
    sel.length = 1; // conserva la primera opción "Copilot por defecto"
    const seen = new Set();
    agents = [...customAgents, ...(agents || [])].filter((a) => a && a.id && !seen.has(a.id) && seen.add(a.id));
    for (const a of agents) {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.label;
      opt.dataset.label = a.label;
      sel.appendChild(opt);
    }
    if (selectedId && agents.some((a) => a.id === selectedId)) sel.value = selectedId;
  };

  // Ayuda: abre la guía completa en una pestaña (botón ? o F1), en la sección de esta ventana.
  const openHelp = () => messenger.tabs.create({ url: messenger.runtime.getURL("pages/help.html") + (mode === "create" ? "#crear" : "#ventana") }).catch(() => {});
  $("help").addEventListener("click", openHelp);
  document.addEventListener("keydown", (e) => { if (e.key === "F1") { e.preventDefault(); openHelp(); } });

  // «Más opciones» plegado o abierto como lo dejó el usuario.
  try { $("more").open = localStorage.getItem("moreOpen") === "1"; } catch (_) {}
  $("more").addEventListener("toggle", () => { try { localStorage.setItem("moreOpen", $("more").open ? "1" : "0"); } catch (_) {} });

  // Mini editor Markdown reutilizable: cablea los botones de una barra a su textarea
  // (envuelve la selección o prefija las líneas). Se usa en "Prompt a enviar" y "¿Qué quieres crear?".
  const setupMdBar = (bar, ta) => {
    if (!bar || !ta) return;
    const surround = (before, after) => {
      const s = ta.selectionStart, e = ta.selectionEnd;
      ta.setRangeText(before + ta.value.slice(s, e) + after, s, e, "select");
      ta.focus();
    };
    const prefixLines = (mk) => {
      const s = ta.selectionStart, e = ta.selectionEnd;
      const start = ta.value.lastIndexOf("\n", s - 1) + 1;
      let end = ta.value.indexOf("\n", e);
      if (end === -1) end = ta.value.length;
      const block = ta.value.slice(start, end).split("\n").map((l, i) => mk(i + 1) + l).join("\n");
      ta.setRangeText(block, start, end, "select");
      ta.focus();
    };
    const actions = {
      bold: () => surround("**", "**"),
      italic: () => surround("*", "*"),
      code: () => surround("`", "`"),
      link: () => surround("[", "](url)"),
      h: () => prefixLines(() => "# "),
      ul: () => prefixLines(() => "- "),
      ol: () => prefixLines((n) => n + ". "),
      quote: () => prefixLines(() => "> ")
    };
    bar.querySelectorAll("button").forEach((b) => {
      if (b.title) b.setAttribute("aria-label", b.title); // etiqueta para lectores de pantalla
      // Evita que el botón robe el foco al textarea: sin esto, al pulsar se enfoca el botón,
      // el textarea se desenfoca y el foco "salta" (a veces al otro editor). Con preventDefault
      // en mousedown el foco y la selección se mantienen en el textarea correcto.
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        const a = actions[b.dataset.md];
        if (a) { a(); ta.dispatchEvent(new Event("input", { bubbles: true })); }
      });
    });
  };
  setupMdBar($("prompt-mdbar"), $("prompt"));
  setupMdBar($("brief-mdbar"), $("create-brief"));

  let message, body, cfg, promptBody = null, formatBody = null, threadBody = null, detectedLang = "";
  // Idioma de la respuesta: el elegido o, con «Como el correo», el detectado en el cuerpo.
  const replyLanguage = () => ($("reply-language").value === "auto" ? detectedLang : $("reply-language").value);

  // Compone el prompt según el modo: creación (brief/contexto/idioma) o respuesta (correo + hilo).
  // El contexto del autor (perfil del usuario) se añade en ambos modos si está configurado.
  const composePrompt = () => {
    const userContext = buildUserContext(cfg && cfg.userProfile);
    return mode === "create"
      ? buildCreatePrompt({
          userContext, promptBody, formatBody,
          tone: $("tone").value, length: $("length").value,
          brief: $("create-brief").value, context: $("create-context").value, language: $("language").value
        })
      : buildComposedPrompt(message, body, {
          userContext, template: cfg.promptTemplate, promptBody, formatBody,
          instructions: $("instructions").value,
          thread: $("includeThread").checked ? threadBody : null,
          tone: $("tone").value, length: $("length").value,
          language: replyLanguage(), versions: Number($("versions").value) || 1
        });
  };
  const rebuildPrompt = () => { $("prompt").value = composePrompt(); updatePromptCount(); };

  try {
    cfg = await getConfig();
    if (mode === "reply") {
      const messageId = params.get("messageId") != null ? Number(params.get("messageId")) : null;
      if (messageId == null || Number.isNaN(messageId)) { setStatus("err", "No hay ningún correo asociado"); return; }
      message = await messenger.messages.get(messageId);
      if (!message) { setStatus("err", "No se pudo cargar el correo"); return; }
      body = await extractBody(message.id);
      detectedLang = detectLanguage(body);
      if (detectedLang) $("reply-language").options[0].textContent = "Como el correo (" + LANG_NAMES[detectedLang].toLowerCase() + ")";
    } else {
      message = null;
      body = "";
    }

    const prefs = await messenger.storage.local.get({
      lastAgentId: "", agents: [], customAgents: [], prefTone: "", prefLength: "", prefSignature: true, prefQuote: false, prefThread: false, prefLanguage: ""
    });
    $("tone").value = prefs.prefTone;
    $("length").value = prefs.prefLength;
    $("newChat").checked = cfg.newChatByDefault;
    $("includeSignature").checked = prefs.prefSignature;
    $("includeQuote").checked = prefs.prefQuote;
    $("includeThread").checked = prefs.prefThread;
    if (mode === "create") $("language").value = prefs.prefLanguage;

    rebuildPrompt();
    customAgents = prefs.customAgents || [];
    populateAgents(prefs.agents, prefs.lastAgentId);
    $("exportMd").addEventListener("click", () => {
      messenger.runtime.sendMessage({ type: "exportMarkdown", ids: [message.id] }).catch(() => {});
    });

    // Desplegables de Prompt y Formato: plantillas de Thunderbird distinguidas por el asunto
    // ("Prompt - ..." = instrucción prioritaria; "Formato - ..." o sin prefijo = referencia de formato).
    const templates = await listTemplates().catch(() => []);
    const multiSource = new Set(templates.map((t) => t.source)).size > 1;
    // "Prompt - …" son prompts de respuesta; "Prompt crear - …" son de creación (solo en modo create).
    // La clasificación es la de common.js, la misma que usa el menú 📄 del editor.
    const fill = (sel, items) => {
      for (const t of items) {
        const opt = document.createElement("option");
        opt.value = String(t.id);
        opt.textContent = multiSource ? `${t.label} (${t.source})` : t.label;
        sel.appendChild(opt);
      }
    };
    fill($("prompt-sel"), promptTemplates(templates, mode));
    // Los formatos se comparten entre modos; se excluyen ambos tipos de Prompt.
    fill($("format-sel"), formatTemplates(templates, { sort: false }));

    const onSelChange = async (sel, assign, busyMsg) => {
      $("send").disabled = true;
      setStatus("busy", busyMsg);
      try {
        assign(sel.value ? await extractTemplateBody(Number(sel.value)) : null);
        rebuildPrompt();
        setStatus("", "Listo");
      } catch (_) {
        setStatus("err", "No se pudo leer la plantilla");
      }
      $("send").disabled = false;
    };
    $("prompt-sel").addEventListener("change", () => onSelChange($("prompt-sel"), (v) => { promptBody = v; }, "Cargando prompt…"));
    $("format-sel").addEventListener("change", () => onSelChange($("format-sel"), (v) => { formatBody = v; }, "Cargando formato…"));

    $("tone").addEventListener("change", () => { rebuildPrompt(); messenger.storage.local.set({ prefTone: $("tone").value }).catch(() => {}); });
    $("length").addEventListener("change", () => { rebuildPrompt(); messenger.storage.local.set({ prefLength: $("length").value }).catch(() => {}); });
    $("includeSignature").addEventListener("change", () => messenger.storage.local.set({ prefSignature: $("includeSignature").checked }).catch(() => {}));
    $("includeQuote").addEventListener("change", () => messenger.storage.local.set({ prefQuote: $("includeQuote").checked }).catch(() => {}));
    $("reply-language").addEventListener("change", rebuildPrompt);
    $("instructions").addEventListener("input", rebuildPrompt);
    $("versions").addEventListener("change", rebuildPrompt);

    // Reconstruye el prompt al editar los campos de creación (solo existen en modo creación).
    ["create-brief", "create-context"].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener("input", rebuildPrompt);
    });
    if ($("language")) $("language").addEventListener("change", () => {
      rebuildPrompt(); messenger.storage.local.set({ prefLanguage: $("language").value }).catch(() => {});
    });

    // El hilo anterior y el aviso de inyección son solo del modo respuesta (el correo entrante son DATOS).
    if (mode === "reply") {
      // Carga (con caché) el hilo anterior; devuelve true si hay hilo, false si no lo hay o falla.
      const loadThread = async () => {
        if (threadBody != null) return threadBody.length > 0;
        threadBody = await buildThreadContext(message.id).catch(() => "");
        return threadBody.length > 0;
      };
      $("includeThread").addEventListener("change", async () => {
        const on = $("includeThread").checked;
        messenger.storage.local.set({ prefThread: on }).catch(() => {});
        if (on) {
          $("send").disabled = true; $("regen").disabled = true;
          setStatus("busy", "Cargando el hilo…");
          const has = await loadThread();
          if (!has) { $("includeThread").checked = false; setStatus("err", "El correo no tiene hilo anterior"); }
          else setStatus("", "Hilo cargado");
          $("send").disabled = false; $("regen").disabled = false;
        }
        rebuildPrompt();
      });

      // Carga inicial del hilo si la preferencia estaba activa (antes de avisar de inyección).
      if ($("includeThread").checked) {
        if (await loadThread()) rebuildPrompt(); else $("includeThread").checked = false;
      }

      // Aviso de posible inyección en el correo o el hilo (la píldora del prompt ya blinda a Copilot).
      const inj = detectInjection(body + "\n" + (threadBody || ""));
      if (inj.detected) {
        setStatus("err", inj.severity === "crit"
          ? "⚠️ Posible manipulación en el correo (protegido)"
          : "⚠️ Patrón sospechoso en el correo (protegido)");
      } else {
        setStatus("", "Listo");
      }
    } else {
      setStatus("", "Listo");
    }
    $("send").disabled = false;
  } catch (e) {
    setStatus("err", "No se pudo preparar el prompt: " + (e && e.message ? e.message : e));
    return;
  }

  // --- Estado de Copilot: se comprueba al entrar y cada pocos segundos mientras la ventana está
  // abierta. Si está cerrado y el ajuste lo permite, se abre solo, devolviendo el foco aquí. ---
  const COPILOT_STATES = {
    ok: ["Copilot abierto y listo", ""],
    login: ["Copilot está abierto, pero falta iniciar sesión", "Ir a Copilot"],
    loading: ["Copilot está cargando…", ""],
    closed: ["Copilot no está abierto", "Abrir Copilot"],
    opening: ["Abriendo Copilot en segundo plano…", ""]
  };
  const showCopilot = (state) => {
    const [text, action] = COPILOT_STATES[state] || ["No se pudo comprobar Copilot", "Abrir Copilot"];
    $("copilotBar").dataset.state = state;
    $("copilotText").textContent = text;
    $("copilotAction").textContent = action || "Abrir Copilot";
    $("copilotAction").hidden = !action;
  };
  let thisWindowId = null;
  messenger.windows.getCurrent().then((w) => { thisWindowId = w.id; }).catch(() => {});
  const openCopilot = (keepFocus) => messenger.runtime.sendMessage({
    type: "openCopilot", returnFocusTo: keepFocus ? thisWindowId : null
  }).catch(() => {});
  let copilotTimer = null;
  const pollCopilot = async () => {
    const res = await messenger.runtime.sendMessage({ type: "checkCopilot" }).catch(() => null);
    const state = (res && res.state) || "closed";
    if ($("copilotBar").dataset.state !== "opening" || state !== "closed") showCopilot(state);
    clearTimeout(copilotTimer);
    copilotTimer = setTimeout(pollCopilot, state === "ok" ? 10000 : 3000);
    return state;
  };
  $("copilotAction").addEventListener("click", () => {
    showCopilot("opening");
    openCopilot(false);
    setTimeout(pollCopilot, 1500);
  });
  pollCopilot().then(async (state) => {
    if (state !== "closed") return;
    const { autoOpenCopilot } = await messenger.storage.local.get({ autoOpenCopilot: true });
    if (!autoOpenCopilot) return;
    showCopilot("opening");
    await openCopilot(true);
    setTimeout(pollCopilot, 1500);
  });

  // Refresco manual de la lista de agentes (abre Copilot si hace falta y espera a que cargue).
  $("refreshAgents").addEventListener("click", async () => {
    const prev = $("agent").value;
    $("refreshAgents").disabled = true;
    setStatus("busy", "Buscando agentes en Copilot…");
    let res;
    try { res = await messenger.runtime.sendMessage({ type: "refreshAgents", open: true }); } catch (_) { res = { ok: false }; }
    if (res && res.ok) {
      populateAgents(res.agents || [], prev);
      setStatus("", (res.agents || []).length ? "Agentes actualizados: " + res.agents.length
        : "Copilot no muestra agentes en su panel; añádelos a mano en Opciones › General");
    } else {
      setStatus("err", res && res.reason === "login"
        ? "Inicia sesión en Copilot y vuelve a pulsar ↻"
        : "Copilot aún está cargando; vuelve a pulsar ↻ en unos segundos");
    }
    $("refreshAgents").disabled = false;
  });

  // Error de Copilot con el texto completo y, si falta iniciar sesión, el botón para ir a Copilot.
  const showError = (reason, extra) => {
    $("progress").hidden = true;   // los pasos ya no aplican: el mensaje explica qué pasó
    setStatus("err", copilotErrorText(reason) + (extra || ""),
      reason === "login" ? { label: "Ir a Copilot", run: () => openCopilot(false) } : null);
  };

  // --- Progreso de la petición en curso: pasos, segundos de espera y Cancelar ---
  const STAGES = ["opening", "typing", "waiting", "done"];
  let currentToken = null, elapsedTimer = null, waitingSince = 0;
  const stopElapsed = () => { clearInterval(elapsedTimer); elapsedTimer = null; };
  const showStage = (stage) => {
    $("progress").hidden = false;
    const at = STAGES.indexOf(stage);
    $("progress").querySelectorAll("li").forEach((li) => {
      const i = STAGES.indexOf(li.dataset.stage);
      li.classList.toggle("done", at >= 0 && (i < at || (stage === "done" && i === at)));
      li.classList.toggle("active", i === at && stage !== "done");
    });
    if (stage === "waiting" && !elapsedTimer) {
      waitingSince = Date.now();
      $("elapsed").textContent = "";
      elapsedTimer = setInterval(() => { $("elapsed").textContent = "(" + Math.round((Date.now() - waitingSince) / 1000) + " s)"; }, 1000);
    }
    if (stage !== "waiting") stopElapsed();
    $("cancel").hidden = stage === "done";
  };
  // El background y la ventana de Copilot avisan de cada paso; solo se atiende el de esta petición.
  messenger.runtime.onMessage.addListener((m) => {
    if (!m || m.type !== "copilotProgress" || m.token !== currentToken) return;
    if (m.stage === "error") {
      stopElapsed();
      $("cancel").hidden = true;
      showError(m.reason);
      return;
    }
    if (m.stage === "cancelled") {
      stopElapsed();
      $("progress").hidden = true;
      setStatus("", "Cancelado");
      $("send").disabled = false; $("regen").disabled = false;
      return;
    }
    showStage(m.stage);
    if (m.stage === "waiting") setStatus("busy", "Copilot está escribiendo…");
    if (m.stage === "done") setStatus("ok", Number($("versions").value) > 1 && mode === "reply"
      ? "Respuesta recibida: elige una versión en la ventana nueva"
      : "Respuesta recibida: se abre el correo");
  });
  $("cancel").addEventListener("click", () => {
    if (!currentToken) return;
    $("cancel").disabled = true;
    messenger.runtime.sendMessage({ type: "cancelCopilot", token: currentToken }).catch(() => {})
      .finally(() => { $("cancel").disabled = false; });
  });

  // Envío, compartido por "Enviar a Copilot" y "Regenerar" (este último fuerza chat nuevo).
  const doSend = async (forceNewChat) => {
    $("send").disabled = true;
    $("regen").disabled = true;
    setStatus("busy", "Enviando a Copilot…");
    const requestId = "c" + Date.now() + Math.floor(Math.random() * 1e6);
    currentToken = mode === "create" ? requestId : String(message.id);
    showStage("opening");
    let res;
    try {
      const agentId = $("agent").value;
      const agentLabel = agentId && $("agent").selectedOptions[0] ? $("agent").selectedOptions[0].dataset.label || "" : "";
      await messenger.storage.local.set({ lastAgentId: agentId });
      // Título del chat: el que escriba el usuario o, si lo deja vacío, el asunto (respuesta) o el brief (creación).
      const userTitle = ($("chat-title").value || "").trim();
      const asunto = userTitle || (mode === "create" ? $("create-brief").value : ((message && message.subject) || ""));
      const title = chatTitle(mode === "create" ? "Creacion" : "Preguntar", asunto);
      const base = {
        type: "sendToCopilot", prompt: title + "\n\n" + $("prompt").value,
        newChat: forceNewChat || $("newChat").checked, title: (message && message.subject) || "",
        agentId, agentLabel, includeSignature: $("includeSignature").checked,
        // Copilot se pone delante para escribir; después, esta ventana vuelve al frente (progreso y Cancelar).
        returnFocusTo: thisWindowId
      };
      if (mode === "create") {
        res = await messenger.runtime.sendMessage({
          ...base, mode: "create", requestId,
          to: ($("recipient-to").value || "").trim(),
          cc: ($("recipient-cc").value || "").trim(),
          bcc: ($("recipient-bcc").value || "").trim()
        });
      } else {
        res = await messenger.runtime.sendMessage({ ...base, mode: "reply", messageId: message.id,
          includeQuote: $("includeQuote").checked, versions: Number($("versions").value) || 1 });
      }
    } catch (e) {
      res = { ok: false, reason: e && e.message ? e.message : String(e) };
    }
    if (res && res.ok) {
      $("regen").hidden = false;
    } else if (res && res.reason === "cancelled") {
      $("progress").hidden = true;
      setStatus("", "Cancelado");
    } else {
      stopElapsed();
      $("cancel").hidden = true;
      // El error se muestra ya; la copia al portapapeles puede tardar y solo completa el mensaje.
      const reason = res && res.reason;
      showError(reason);
      navigator.clipboard.writeText($("prompt").value)
        .then(() => showError(reason, " El prompt está copiado en el portapapeles para pegarlo a mano."))
        .catch(() => {});
    }
    $("send").disabled = false;
    $("regen").disabled = false;
  };

  // Avisos previos al envío (direcciones no válidas, prompt demasiado largo): el primer clic
  // avisa y lleva a la pestaña afectada; un segundo clic con el mismo aviso envía igualmente.
  let armedWarning = null;
  const preflight = () => {
    const bad = mode === "create" ? invalidRecipientList() : [];
    if (bad.length) return { key: "rcpt:" + bad.join(), tab: "tab-recipients",
      text: "Direcciones no válidas (se ignorarán): " + bad.join(", ") + ". Pulsa Enviar otra vez para continuar." };
    const n = $("prompt").value.length;
    if (n > PROMPT_MAX) return { key: "len:" + n, tab: "tab-prompt",
      text: "El prompt es muy largo (" + n.toLocaleString("es-ES") + " caracteres) y Copilot podría cortarlo. Pulsa Enviar otra vez para continuar." };
    return null;
  };
  const trySend = (forceNewChat) => {
    if ($("send").disabled) return;
    const w = preflight();
    if (w && armedWarning !== w.key) {
      armedWarning = w.key;
      const tab = $(w.tab);
      if (tab) selectTab(tab, false);
      setStatus("err", w.text);
      return;
    }
    armedWarning = null;
    doSend(forceNewChat);
  };
  $("send").addEventListener("click", () => trySend(false));
  $("regen").addEventListener("click", () => trySend(true));
  // Ctrl+Enter envía desde cualquier pestaña o campo.
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); trySend(false); }
  });
})();
