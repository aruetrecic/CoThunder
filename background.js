"use strict";

// --- Editor Markdown en la ventana de redacción -------------------------------
const COMPOSE_SCRIPT = { id: "cothunder-compose", js: ["markdown.js", "themes.js", "icons.js", "emoji.js", "content-compose.js"], css: ["compose.css"] };

// Registro idempotente: solo registra si falta. NO desregistra en cada despertar del
// event page: ese hueco entre unregister y register dejaba sin editor a las redacciones
// que se abrían justo entonces (el despertar lo provoca a menudo la propia redacción).
async function registerComposeScript() {
  try {
    const existing = await messenger.scripting.compose.getRegisteredScripts({ ids: [COMPOSE_SCRIPT.id] });
    if (existing && existing.length) {
      // Un registro de una versión anterior con otra lista de ficheros se rehace (solo entonces).
      const files = (existing[0].js || []).map((f) => String(f).split("/").pop());
      if (files.join() === COMPOSE_SCRIPT.js.join()) return;
      await messenger.scripting.compose.unregisterScripts({ ids: [COMPOSE_SCRIPT.id] });
    }
    await messenger.scripting.compose.registerScripts([COMPOSE_SCRIPT]);
  } catch (e) {
    console.error("[CoThunder] registro compose script:", e);
  }
}

// ¿Tiene ya la pestaña de redacción el compose script cargado?
async function composeScriptLoaded(tabId) {
  try {
    const res = await messenger.tabs.sendMessage(tabId, { type: "cothunder-ping" });
    return !!(res && res.ok);
  } catch (e) {
    return false;
  }
}

// Resguardo: el registro solo se aplica a redacciones abiertas DESPUÉS de registrar
// (doc. de scripting.compose). Si a una redacción no le llegó, se inyecta a mano.
// content-compose.js se protege contra la doble carga.
async function ensureComposeScript(tabId) {
  if (await composeScriptLoaded(tabId)) return true;
  try {
    await messenger.scripting.insertCSS({ target: { tabId }, files: COMPOSE_SCRIPT.css }).catch(() => {});
    await messenger.scripting.executeScript({ target: { tabId }, files: COMPOSE_SCRIPT.js });
    return true;
  } catch (e) {
    console.error("[CoThunder] inyección compose script:", e);
    return false;
  }
}

// Al arrancar: registra y cubre las redacciones que ya estuvieran abiertas.
(async () => {
  await registerComposeScript();
  for (const t of await messenger.tabs.query({ type: "messageCompose" }).catch(() => [])) {
    ensureComposeScript(t.id);
  }
})();

// Cada redacción nueva (nuevo, responder, responder a todos, reenviar...) despierta el
// event page; si el registro no llegó a aplicarse, se inyecta cuando el editor esté listo.
messenger.tabs.onCreated.addListener((tab) => {
  if (tab.type !== "messageCompose") return;
  let tries = 0;
  const check = async () => {
    if (await composeScriptLoaded(tab.id)) return;
    if (++tries < 5) { setTimeout(check, 1000); return; }
    ensureComposeScript(tab.id);
  };
  setTimeout(check, 1000);
});

// Alterna el panel Markdown en la pestaña de redacción del botón (composeAction) o la
// activa (atajo de teclado); refleja el estado en el título del botón.
async function toggleMarkdownPanel(clickedTab) {
  let tab = clickedTab && clickedTab.id != null ? clickedTab : null;
  if (!tab) [tab] = await messenger.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.type !== "messageCompose") return;
  if (!(await ensureComposeScript(tab.id))) return;
  try {
    const res = await messenger.tabs.sendMessage(tab.id, { type: "cothunder-toggle" });
    const on = !!(res && res.active);
    messenger.composeAction.setTitle({ tabId: tab.id, title: on ? "Editor Markdown (activo)" : "Editor Markdown" });
  } catch (e) {
    console.error("[CoThunder] alternar editor Markdown:", e);
  }
}
messenger.composeAction.onClicked.addListener((tab) => toggleMarkdownPanel(tab));
messenger.commands.onCommand.addListener((name) => { if (name === "toggle-markdown") toggleMarkdownPanel(null); });

// Al enviar con el panel activo: pide el HTML final al compose script y lo pone
// como cuerpo del correo. Opción 1 (un solo clic): sin cancel, el envío sale
// directo ya maquetado.
messenger.compose.onBeforeSend.addListener(async (tab) => {
  try {
    const res = await messenger.tabs.sendMessage(tab.id, { type: "cothunder-finalize" });
    if (res && res.html != null) {
      return { details: { body: res.html } };
    }
  } catch (e) {
    console.error("[CoThunder] onBeforeSend Markdown falló:", e);
    // Resguardo: si la finalización falla, quita el andamiaje del editor del cuerpo enviado.
    try {
      const details = await messenger.compose.getComposeDetails(tab.id);
      const doc = new DOMParser().parseFromString(details.body || "", "text/html");
      doc.querySelectorAll("#cothunder-md-preview, #cothunder-md-toolbar, #cothunder-md-style").forEach((n) => n.remove());
      return { details: { body: doc.body.innerHTML } };
    } catch (e2) { /* si tampoco se puede, se envía tal cual */ }
  }
});

// Registra el content script de Copilot en runtime, a partir de la URL configurada.
async function registerCopilotScript() {
  try {
    const { copilotUrl } = await getConfig();
    const match = matchPatternFromUrl(copilotUrl); // puede lanzar si la URL es inválida
    await messenger.scripting.unregisterContentScripts({ ids: ["copilot"] }).catch(() => {});
    await messenger.scripting.registerContentScripts([{
      id: "copilot",
      matches: [match],
      js: ["content-copilot.js"],
      runAt: "document_idle"
    }]);
  } catch (e) {
    console.error("[CoThunder] registro content script:", e);
  }
}
registerCopilotScript();
// Solo re-registrar cuando cambia la URL de Copilot (no en cada escritura de storage.session).
messenger.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.copilotUrl) registerCopilotScript();
});

// Alto inicial de la ventana de UI: el 50 % del alto útil de la pantalla (el popup lo afina
// y recuerda el tamaño que elija el usuario).
const halfScreenHeight = () => {
  try { if (screen && screen.availHeight) return Math.round(screen.availHeight * 0.5); } catch (_) {}
  return 540;
};

// El botón del visor abre la UI en una ventana propia (redimensionable), pasándole el messageId.
messenger.messageDisplayAction.onClicked.addListener(async (tab) => {
  let messageId = null;
  try {
    const displayed = await messenger.messageDisplay.getDisplayedMessages(tab.id);
    const messages = Array.isArray(displayed) ? displayed : (displayed && displayed.messages) || [];
    if (messages[0]) messageId = messages[0].id;
  } catch (_) {}
  await openReplyWindow(messageId);
});

// El botón de la barra principal abre la UI en modo creación (correo nuevo, sin messageId).
messenger.action.onClicked.addListener(async () => {
  const url = messenger.runtime.getURL("popup/popup.html") + "?mode=create";
  await messenger.windows.create({ url, type: "popup", width: 620, height: halfScreenHeight(), allowScriptsToClose: true });
});

// Mantiene una única ventana de Copilot: si existe la enfoca, si no la crea.
async function ensureCopilotTab() {
  const { copilotUrl } = await getConfig();
  const { copilotTabId } = await messenger.storage.session.get({ copilotTabId: null });
  if (copilotTabId != null) {
    try {
      const t = await messenger.tabs.get(copilotTabId);
      await messenger.windows.update(t.windowId, { focused: true });
      return copilotTabId;
    } catch (_) {
      // la pestaña ya no existe; se recrea abajo
    }
  }
  const win = await messenger.windows.create({ type: "popup", url: copilotUrl, width: 1200, height: 860 });
  const tabId = win.tabs[0].id;
  await messenger.storage.session.set({ copilotTabId: tabId });
  return tabId;
}

// --- Diagnóstico técnico local ---------------------------------------------------
// Qué paso o selector falló y cuándo, para arreglar rápido cuando Microsoft cambie la interfaz
// de Copilot. NUNCA guarda asuntos, direcciones ni texto de correos o respuestas. Se copia desde
// Opciones › Diagnóstico. Solo en storage.local (no sale del equipo).
const DIAG_MAX = 200;
let diagQueue = Promise.resolve();
function diag(ev, detail) {
  diagQueue = diagQueue.then(async () => {
    const { diagLog } = await messenger.storage.local.get({ diagLog: [] });
    const log = Array.isArray(diagLog) ? diagLog : [];
    log.push({ ts: new Date().toISOString(), v: messenger.runtime.getManifest().version, ev, detail: String(detail || "").slice(0, 120) });
    if (log.length > DIAG_MAX) log.splice(0, log.length - DIAG_MAX);
    await messenger.storage.local.set({ diagLog: log });
  }).catch(() => {});
}

function notify(message) {
  messenger.notifications.create({
    type: "basic", iconUrl: messenger.runtime.getURL("icon.svg"), title: "CoThunder", message
  }).catch(() => {});
}

// Progreso de una petición hacia las páginas de CoThunder (la ventana muestra los pasos).
function broadcastProgress(token, stage, extra) {
  messenger.runtime.sendMessage(Object.assign({ type: "copilotProgress", token, stage }, extra || {})).catch(() => {});
}

const isCancelled = async (token) =>
  !!(await messenger.storage.session.get({ ["cancel_" + token]: false }))["cancel_" + token];

// Entrega el payload al content script reintentando hasta que responda (la SPA tarda en cargar).
// Si la pestaña acaba en un dominio que no es el de Copilot (su URL deja de ser legible para la
// extensión, que solo tiene permiso sobre Copilot), es la página de inicio de sesión de Microsoft.
async function deliverWithRetry(tabId, payload, token, timeoutMs = 30000) {
  const start = Date.now();
  let foreignSince = 0;
  while (Date.now() - start < timeoutMs) {
    if (token != null && await isCancelled(token)) return { ok: false, reason: "cancelled" };
    try {
      const res = await messenger.tabs.sendMessage(tabId, payload);
      if (res) return res;
    } catch (_) {
      // content script aún no inyectado; reintentar
    }
    try {
      const t = await messenger.tabs.get(tabId);
      if (t.status === "complete" && !t.url) {
        foreignSince = foreignSince || Date.now();
        if (Date.now() - foreignSince > 3000) return { ok: false, reason: "login" };
      } else {
        foreignSince = 0;
      }
    } catch (_) {
      return { ok: false, reason: "closed" };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { ok: false, reason: "timeout" };
}

// Ids de pestañas/ventanas donde está cargado Copilot (id guardado, pestañas y ventanas popup).
async function findCopilotTabIds() {
  const ids = new Set();
  const { copilotTabId } = await messenger.storage.session.get({ copilotTabId: null });
  if (copilotTabId != null) ids.add(copilotTabId);
  for (const t of await messenger.tabs.query({})) {
    if ((t.url || "").includes("m365.cloud.microsoft")) ids.add(t.id);
  }
  try {
    for (const w of await messenger.windows.getAll({ populate: true })) {
      for (const t of w.tabs || []) {
        if ((t.url || "").includes("m365.cloud.microsoft")) ids.add(t.id);
      }
    }
  } catch (_) {}
  return [...ids];
}

// Registro local de actividad (trazabilidad, opcional). Guarda SOLO metadatos (fecha, modo, número de
// destinatarios, resultado), nunca el asunto, las direcciones ni el cuerpo. Se activa en Opciones.
const AUDIT_MAX = 500;
async function logActivity(entry) {
  try {
    const { auditEnabled, auditLog } = await messenger.storage.local.get({ auditEnabled: false, auditLog: [] });
    if (!auditEnabled) return;
    const log = Array.isArray(auditLog) ? auditLog : [];
    log.push(entry);
    if (log.length > AUDIT_MAX) log.splice(0, log.length - AUDIT_MAX);
    await messenger.storage.local.set({ auditLog: log });
  } catch (_) {}
}

// Arranca una petición a Copilot: guarda las opciones del token (para cuando llegue la respuesta),
// abre o enfoca Copilot y le entrega el prompt. Lo usan la ventana, el menú contextual y el editor.
// req: { token, prompt, newChat, agentId, agentLabel, opts }.
// Agentes conocidos: los detectados en Copilot (agents) y los añadidos a mano en Opciones
// (customAgents, ids "u_…", siempre con enlace). Devuelve { id, label, url } o null.
async function resolveAgent(agentId, agentLabel) {
  if (!agentId && !agentLabel) return null;
  const { agents, customAgents } = await messenger.storage.local.get({ agents: [], customAgents: [] });
  const all = [...(customAgents || []), ...(agents || [])];
  return all.find((a) => agentId && a.id === agentId) || all.find((a) => agentLabel && a.label === agentLabel) ||
    { id: agentId || "", label: agentLabel || "", url: "" };
}

// Abre una dirección (un agente) en la pestaña de Copilot y espera a que termine de cargar.
async function navigateCopilot(tabId, url, timeoutMs = 20000) {
  await messenger.tabs.update(tabId, { url });
  const start = Date.now();
  await new Promise((r) => setTimeout(r, 800));
  while (Date.now() - start < timeoutMs) {
    try { if ((await messenger.tabs.get(tabId)).status === "complete") return; } catch (_) { return; }
    await new Promise((r) => setTimeout(r, 400));
  }
}

async function startCopilotRequest(req) {
  const token = String(req.token);
  await messenger.storage.session.set({ ["opts_" + token]: req.opts });
  await messenger.storage.session.remove("cancel_" + token);
  broadcastProgress(token, "opening");
  let res;
  try {
    const tabId = await ensureCopilotTab();
    const agent = await resolveAgent(req.agentId, req.agentLabel);
    const payload = {
      type: "sendPrompt", prompt: req.prompt, newChat: req.newChat,
      agentId: agent ? agent.id : "", agentLabel: agent ? agent.label : "", agentUrl: agent ? agent.url : "", messageId: token
    };
    // Un agente añadido a mano no está en el panel de Copilot: se abre directamente por su enlace.
    const byUrl = agent && agent.url && /^u_/.test(agent.id);
    if (byUrl) await navigateCopilot(tabId, agent.url);
    res = await deliverWithRetry(tabId, byUrl ? Object.assign(payload, { agentId: "", agentLabel: "", newChat: false }) : payload, token);
    if (res && res.reason === "agent-navigate" && agent && agent.url) {
      // El agente no estaba visible en el panel: se abre por su enlace (ya es un chat nuevo) y se reintenta.
      diag("agente-por-enlace", agent.id);
      await navigateCopilot(tabId, agent.url);
      res = await deliverWithRetry(tabId, Object.assign(payload, { agentId: "", agentLabel: "", newChat: false }), token);
    }
    if (res && res.reason === "login") {
      // Deja la ventana de Copilot delante para que el usuario inicie sesión.
      messenger.tabs.get(tabId).then((t) => messenger.windows.update(t.windowId, { focused: true })).catch(() => {});
    }
  } catch (e) {
    console.error("[CoThunder] startCopilotRequest:", e);
    res = { ok: false, reason: e && e.message ? e.message : String(e) };
  }
  // Enviado: la ventana que lo pidió vuelve al frente (progreso y Cancelar a la vista). Si falta
  // iniciar sesión no se hace: Copilot debe quedar delante.
  if (res && res.ok && req.returnFocusTo != null) {
    messenger.windows.update(req.returnFocusTo, { focused: true }).catch(() => {});
  }
  if (!res || !res.ok) {
    const reason = (res && res.reason) || "desconocido";
    if (reason !== "cancelled") diag("envio-fallido", reason);
    messenger.storage.session.remove("opts_" + token).catch(() => {});
    broadcastProgress(token, reason === "cancelled" ? "cancelled" : "error", { reason });
  }
  return res || { ok: false };
}

// Cancela una petición: marca el token (corta la entrega o la espera) y avisa a Copilot.
async function cancelCopilotRequest(token) {
  token = String(token);
  await messenger.storage.session.set({ ["cancel_" + token]: true });
  for (const id of await findCopilotTabIds()) {
    messenger.tabs.sendMessage(id, { type: "cancelPrompt", token }).catch(() => {});
  }
  messenger.storage.session.remove("opts_" + token).catch(() => {});
  broadcastProgress(token, "cancelled");
}

// Firma de la identidad de una redacción, como HTML, si se pidió incluirla.
async function signatureHtml(details, include) {
  if (!include) return "";
  try {
    const identity = details.identityId ? await messenger.identities.get(details.identityId) : null;
    if (identity && identity.signature) {
      return "<br><br>" + (identity.signatureIsPlainText ? escapeHtmlWithBreaks(identity.signature) : identity.signature);
    }
  } catch (_) {}
  return "";
}

// Abre la respuesta al correo original con el texto de Copilot (beginReply necesita el id numérico).
async function openReplyWithText(messageId, opts, text) {
  try {
    const tab = await messenger.compose.beginReply(Number(messageId), "replyToSender");
    const details = await messenger.compose.getComposeDetails(tab.id);
    const signature = await signatureHtml(details, opts.includeSignature);
    // Cita del original (el cuerpo por defecto de la respuesta, sin la firma que Thunderbird pudiera añadir).
    let quote = "";
    if (opts.includeQuote && details.body) {
      try {
        const doc = new DOMParser().parseFromString(details.body, "text/html");
        doc.querySelectorAll(".moz-signature").forEach((n) => n.remove());
        quote = "<br><br>" + (doc.body ? doc.body.innerHTML : "");
      } catch (_) {
        quote = "<br><br>" + details.body;
      }
    }
    await messenger.compose.setComposeDetails(tab.id, { body: escapeHtmlWithBreaks(text) + signature + quote });
    logActivity({ ts: new Date().toISOString(), mode: "reply", result: "ok" });
  } catch (e) {
    console.error("[CoThunder] beginReply falló:", e);
    logActivity({ ts: new Date().toISOString(), mode: "reply", result: "error" });
    notify("No se pudo abrir la ventana de respuesta con el texto de Copilot.");
  }
}

// Modo creación: abre un correo nuevo (beginNew) separando Asunto + cuerpo.
async function openNewWithText(opts, text) {
  try {
    const { subject, body } = parseCreateReply(text);
    // Destinatarios Para/CC/CCO: cada campo admite varias direcciones (por líneas o comas); se filtran las válidas.
    const to = parseRecipients(opts.to), cc = parseRecipients(opts.cc), bcc = parseRecipients(opts.bcc);
    // Los destinatarios y el asunto se fijan en beginNew: setComposeDetails no los aplica de forma fiable.
    const initial = { isPlainText: false };
    if (subject) initial.subject = subject;
    if (to.length) initial.to = to;
    if (cc.length) initial.cc = cc;
    if (bcc.length) initial.bcc = bcc;
    const tab = await messenger.compose.beginNew(initial);
    const details = await messenger.compose.getComposeDetails(tab.id);
    const signature = await signatureHtml(details, opts.includeSignature);
    await messenger.compose.setComposeDetails(tab.id, { body: escapeHtmlWithBreaks(body) + signature });
    logActivity({ ts: new Date().toISOString(), mode: "create", to: to.length, cc: cc.length, bcc: bcc.length, result: "ok" });
  } catch (e) {
    console.error("[CoThunder] beginNew falló:", e);
    logActivity({ ts: new Date().toISOString(), mode: "create", result: "error" });
    notify("No se pudo abrir el correo nuevo con el texto de Copilot.");
  }
}

// Ventana de resultados (resumen o elección entre versiones). Los datos viajan por storage.session.
async function openResultWindow(data) {
  const id = "r" + Date.now() + Math.floor(Math.random() * 1e6);
  await messenger.storage.session.set({ ["result_" + id]: data });
  const height = (() => { try { return Math.round(screen.availHeight * 0.7); } catch (_) { return 700; } })();
  await messenger.windows.create({
    url: messenger.runtime.getURL("pages/result.html") + "?id=" + id,
    type: "popup", width: 680, height, allowScriptsToClose: true
  });
}

// Llega la respuesta capturada: según el modo del token, abre respuesta, correo nuevo, la
// ventana de resultados o devuelve el texto al editor.
async function handleCopilotReply(msg) {
  const token = String(msg.messageId);
  const optsKey = "opts_" + token;
  const store = await messenger.storage.session.get({ [optsKey]: null });
  // Sin opciones guardadas (p. ej. se perdió storage.session): si el token es un id de correo,
  // se responde con los valores por defecto, como antes; si no, no hay a dónde llevar la respuesta.
  const opts = store[optsKey] || (/^\d+$/.test(token) ? { mode: "reply", includeSignature: true, includeQuote: false } : null);
  messenger.storage.session.remove(optsKey).catch(() => {});
  if (await isCancelled(token)) return;
  if (!opts) return;
  if (!msg.text) {
    diag("captura-vacia", opts.mode || "reply");
    if (opts.mode === "improve") {
      messenger.tabs.sendMessage(opts.tabId, { type: "cothunder-improved", token, text: "" }).catch(() => {});
    } else {
      notify(copilotErrorText("capture"));
    }
    return;
  }
  switch (opts.mode) {
    case "create":
      return openNewWithText(opts, msg.text);
    case "improve":
      try {
        await messenger.tabs.sendMessage(opts.tabId, { type: "cothunder-improved", token, text: stripCodeFences(msg.text) });
        logActivity({ ts: new Date().toISOString(), mode: "improve", result: "ok" });
      } catch (_) {
        notify("No se pudo devolver el texto al correo (¿se cerró la redacción?). Lo tienes en la ventana de Copilot.");
      }
      return;
    case "summary":
      logActivity({ ts: new Date().toISOString(), mode: "summary", result: "ok" });
      return openResultWindow({ kind: "summary", title: opts.title, text: stripCodeFences(msg.text), messageIds: opts.messageIds || [] });
    default: {
      if (opts.versions > 1) {
        const versions = splitVersions(msg.text);
        if (versions.length > 1) {
          return openResultWindow({ kind: "versions", title: opts.title, versions, messageId: token, opts });
        }
        diag("versiones-sin-separar", "llegó 1 de " + opts.versions);
      }
      return openReplyWithText(token, opts, msg.text);
    }
  }
}

// --- Exportar correos a Markdown (descargar, copiar o pasárselos a Copilot) ---
// forCopilot: sin firmas (marcadas y propias), sin Para/CC y recortado a MAX_BODY por correo.
async function messageToMarkdown(id, forCopilot) {
  const m = await messenger.messages.get(id);
  const full = await messenger.messages.getFull(id);
  const html = findPart(full, "text/html");
  let body = html ? htmlToMarkdown(html, { dropSignatures: forCopilot }) : String(findPart(full, "text/plain") || "").replace(/\r/g, "");
  if (forCopilot) {
    if (!html) body = stripPlainSignature(body);
    body = stripOwnSignatures(body, await ownSignatureTexts(), true);
    if (body.length > MAX_BODY) body = body.slice(0, MAX_BODY) + "\n\n[correo truncado]";
  }
  let attachments = [];
  try { attachments = (await messenger.messages.listAttachments(id)) || []; } catch (_) {}
  return emailToMarkdown({
    subject: m.subject, author: m.author, recipients: m.recipients || [], cc: m.ccList || [],
    date: m.date ? new Date(m.date).toLocaleString("es-ES") : "",
    attachments: attachments.map((a) => ({ name: a.name, size: a.size }))
  }, body, { forCopilot });
}

const EXPORT_MAX_MESSAGES = 20;
async function openExportWindow(messageIds) {
  const ids = (messageIds || []).filter((id) => id != null).slice(0, EXPORT_MAX_MESSAGES);
  if (!ids.length) { notify("Selecciona un correo primero."); return; }
  try {
    const parts = [];
    for (const id of ids) parts.push(await messageToMarkdown(id, false));
    const first = await messenger.messages.get(ids[0]);
    const title = ids.length > 1 ? ids.length + " correos" : (first.subject || "(sin asunto)");
    const fileName = ids.length > 1 ? markdownFileName(ids.length + " correos", Date.now()) : markdownFileName(first.subject, first.date);
    const id = "x" + Date.now() + Math.floor(Math.random() * 1e6);
    await messenger.storage.session.set({ ["result_" + id]: { kind: "export", ids, title, fileName, markdown: parts.join("\n---\n\n") } });
    const height = (() => { try { return Math.round(screen.availHeight * 0.8); } catch (_) { return 760; } })();
    await messenger.windows.create({
      url: messenger.runtime.getURL("pages/export.html") + "?id=" + id, type: "popup", width: 760, height, allowScriptsToClose: true
    });
  } catch (e) {
    console.error("[CoThunder] exportar a Markdown:", e);
    notify("No se pudo convertir el correo a Markdown.");
  }
}

// Pasa los correos exportados a Copilot (o a un agente) con la petición del usuario; la
// respuesta vuelve a la ventana de resultados.
async function askCopilotAbout(msg) {
  const key = "result_" + msg.id;
  const data = (await messenger.storage.session.get({ [key]: null }))[key];
  if (!data || data.kind !== "export") return { ok: false, reason: "sin-datos" };
  const cfg = await getConfig();
  const parts = [];
  for (const id of data.ids) parts.push(await messageToMarkdown(id, true));
  const token = /^a\d+$/.test(String(msg.token || "")) ? String(msg.token) : "a" + Date.now() + Math.floor(Math.random() * 1e6);
  const res = await startCopilotRequest({
    token, newChat: msg.newChat !== false, agentId: msg.agentId || "", agentLabel: msg.agentLabel || "",
    returnFocusTo: msg.returnFocusTo,
    prompt: chatTitle("Preguntar", data.title) + "\n\n" +
      buildAskPrompt(parts.join("\n---\n\n"), msg.question, { userContext: buildUserContext(cfg.userProfile) }),
    opts: { mode: "summary", title: "Copilot: " + data.title, messageIds: data.ids.length === 1 ? data.ids : [] }
  });
  logActivity({ ts: new Date().toISOString(), mode: "ask", result: res.ok ? "ok" : "error" });
  return Object.assign({ token }, res);
}

// Abre la ventana de CoThunder para un correo (botón del visor o menú contextual).
async function openReplyWindow(messageId) {
  const url = messenger.runtime.getURL("popup/popup.html") + (messageId != null ? "?messageId=" + messageId : "");
  await messenger.windows.create({ url, type: "popup", width: 600, height: halfScreenHeight(), allowScriptsToClose: true });
}

function openHelp(anchor) {
  return messenger.tabs.create({ url: messenger.runtime.getURL("pages/help.html") + (anchor ? "#" + anchor : "") });
}

// Estado de Copilot para el asistente de bienvenida: cerrado, sin sesión, cargando o listo.
async function checkCopilot() {
  const ids = await findCopilotTabIds();
  if (!ids.length) {
    const { copilotTabId } = await messenger.storage.session.get({ copilotTabId: null });
    if (copilotTabId == null) return { state: "closed" };
    try {
      const t = await messenger.tabs.get(copilotTabId);
      return { state: t.status === "complete" && !t.url ? "login" : "loading" };
    } catch (_) {
      return { state: "closed" };
    }
  }
  for (const id of ids) {
    try {
      const res = await messenger.tabs.sendMessage(id, { type: "checkSession" });
      if (!res) continue;
      if (res.cookies === false) return { state: "cookies" };
      if (res.editor) {
        const ag = await messenger.tabs.sendMessage(id, { type: "getAgents" }).catch(() => null);
        return { state: "ok", agents: (ag && ag.agents) || [] };
      }
      return { state: res.signIn ? "login" : "loading" };
    } catch (_) {}
  }
  return { state: "loading" };
}

// Petición desde la ventana de CoThunder (respuesta o creación).
async function sendFromWindow(msg) {
  // Token de correlación genérico: el messageId (respuesta) o el requestId (creación).
  const token = msg.messageId != null ? String(msg.messageId) : msg.requestId;
  return startCopilotRequest({
    token, prompt: msg.prompt, newChat: msg.newChat, agentId: msg.agentId, agentLabel: msg.agentLabel,
    returnFocusTo: msg.returnFocusTo,
    opts: {
      mode: msg.mode || "reply",
      includeSignature: msg.includeSignature !== false,
      includeQuote: !!msg.includeQuote,
      versions: Number(msg.versions) || 1,
      title: msg.title || "",
      to: (msg.to || "").trim(),
      cc: (msg.cc || "").trim(),
      bcc: (msg.bcc || "").trim()
    }
  });
}

// «Mejorar con Copilot» desde el editor: el fragmento seleccionado vuelve a la misma redacción.
async function improveFromEditor(msg, sender) {
  const tabId = sender && sender.tab ? sender.tab.id : null;
  if (tabId == null) return { ok: false, reason: "sin-pestaña" };
  const text = String(msg.text || "");
  if (!text.trim()) return { ok: false, reason: "sin-texto" };
  const cfg = await getConfig();
  const token = "i" + Date.now() + Math.floor(Math.random() * 1e6);
  const label = (IMPROVE_ACTIONS[msg.action] || {}).label || "Mejorar";
  const res = await startCopilotRequest({
    token, newChat: cfg.newChatByDefault,
    prompt: chatTitle("Mejorar", label) + "\n\n" + buildImprovePrompt(text, msg.action),
    opts: { mode: "improve", tabId }
  });
  return Object.assign({ token }, res);
}

// --- Acciones de un clic: menú contextual de la lista de mensajes y del botón del visor ---
// Usa los ajustes guardados (agente, tono, longitud, firma, cita) sin abrir la ventana. Las
// respuestas se escriben en el idioma detectado del correo.
async function quickAction(kind, messageIds, templateId) {
  const ids = (messageIds || []).filter((id) => id != null);
  if (!ids.length) { notify("Selecciona un correo primero."); return; }
  const cfg = await getConfig();
  const prefs = await messenger.storage.local.get({
    lastAgentId: "", agents: [], prefTone: "", prefLength: "", prefSignature: true, prefQuote: false
  });
  const userContext = buildUserContext(cfg.userProfile);
  let token, prompt, opts;
  try {
    if (kind === "summary") {
      const list = [];
      for (const id of ids.slice(0, SUMMARY_MAX_MESSAGES)) {
        const m = await messenger.messages.get(id);
        list.push({ author: m.author, subject: m.subject, date: m.date ? new Date(m.date).toLocaleString() : "", body: await extractBody(id) });
      }
      const title = list.length > 1 ? "Resumen de " + list.length + " correos" : "Resumen: " + (list[0].subject || "");
      token = "s" + Date.now() + Math.floor(Math.random() * 1e6);
      prompt = chatTitle("Resumen", list.length > 1 ? list.length + " correos" : list[0].subject) + "\n\n" +
        buildSummaryPrompt(list, { userContext });
      opts = { mode: "summary", title, messageIds: list.length === 1 ? [ids[0]] : [] };
    } else {
      const message = await messenger.messages.get(ids[0]);
      const body = await extractBody(message.id);
      const promptBody = templateId != null ? await extractTemplateBody(templateId) : (QUICK_ACTIONS[kind] || {}).instruction;
      token = String(message.id);
      prompt = chatTitle("Preguntar", message.subject) + "\n\n" + buildComposedPrompt(message, body, {
        userContext, template: cfg.promptTemplate, promptBody,
        tone: prefs.prefTone, length: prefs.prefLength, language: detectLanguage(body)
      });
      opts = { mode: "reply", includeSignature: prefs.prefSignature, includeQuote: prefs.prefQuote, versions: 1 };
    }
  } catch (e) {
    console.error("[CoThunder] quickAction:", e);
    notify("No se pudo leer el correo seleccionado.");
    return;
  }
  notify(kind === "summary" ? "Pidiendo el resumen a Copilot…" : "Preguntando a Copilot; se abrirá la respuesta.");
  const res = await startCopilotRequest({
    token, prompt, newChat: cfg.newChatByDefault,
    agentId: prefs.lastAgentId || "", opts
  });
  if (!res.ok && res.reason !== "cancelled") notify(copilotErrorText(res.reason));
}

// Un único listener con ramas para no competir por la respuesta al popup.
messenger.runtime.onMessage.addListener(async (msg, sender) => {
  if (!msg) return;
  if (msg.type === "sendToCopilot") return sendFromWindow(msg);
  if (msg.type === "cancelCopilot") { await cancelCopilotRequest(msg.token); return { ok: true }; }
  if (msg.type === "copilotReply") {
    if (msg.messageId == null) return;
    await handleCopilotReply(msg);
    return { ok: true };
  }
  if (msg.type === "diag") { diag(msg.ev, msg.detail); return; }
  if (msg.type === "improveText") return improveFromEditor(msg, sender);
  if (msg.type === "listImproveActions") {
    return { actions: Object.entries(IMPROVE_ACTIONS).map(([id, a]) => ({ id, label: a.label })) };
  }
  if (msg.type === "openHelp") { await openHelp(msg.anchor); return { ok: true }; }
  if (msg.type === "openCopilot") {
    await ensureCopilotTab();
    // Apertura automática: la ventana que lo pidió vuelve al frente para no quedar tapada.
    if (msg.returnFocusTo != null) messenger.windows.update(msg.returnFocusTo, { focused: true }).catch(() => {});
    return { ok: true };
  }
  if (msg.type === "checkCopilot") return checkCopilot();
  if (msg.type === "openReplyWindow") { await openReplyWindow(msg.messageId); return { ok: true }; }
  if (msg.type === "exportMarkdown") { await openExportWindow(msg.ids); return { ok: true }; }
  if (msg.type === "askCopilot") return askCopilotAbout(msg);
  // Ventana de resultados: usar una de las versiones como respuesta.
  if (msg.type === "useVersion") {
    const key = "result_" + msg.id;
    const data = (await messenger.storage.session.get({ [key]: null }))[key];
    if (!data || data.kind !== "versions" || !data.versions[msg.index]) return { ok: false };
    await openReplyWithText(data.messageId, data.opts, data.versions[msg.index]);
    return { ok: true };
  }
  // Plantillas de Formato para el menú 📄 del editor Markdown (el compose script no tiene acceso
  // a carpetas ni mensajes). Solo se sirve el cuerpo de mensajes que ESTÁN en una carpeta de
  // plantillas: el editor no puede pedir otros correos por id.
  if (msg.type === "listFormatTemplates") {
    try { return { ok: true, templates: formatTemplates(await listTemplates()) }; }
    catch (e) { return { ok: false, templates: [] }; }
  }
  if (msg.type === "getFormatTemplate") {
    try {
      const allowed = formatTemplates(await listTemplates()).some((t) => t.id === msg.id);
      if (!allowed) return { ok: false };
      return { ok: true, body: await extractTemplateBody(msg.id) };
    } catch (e) {
      return { ok: false };
    }
  }

  if (msg.type === "refreshAgents") return refreshAgents(!!msg.open);
});

// Pide los agentes a la ventana de Copilot. Respondió sin agentes -> lista vacía (no error);
// nadie respondió -> Copilot no está cargado.
async function askAgents() {
  let responded = false;
  for (const id of await findCopilotTabIds()) {
    try {
      const res = await messenger.tabs.sendMessage(id, { type: "getAgents" });
      if (res && res.agents) {
        responded = true;
        if (res.agents.length) return { ok: true, agents: res.agents };
      }
    } catch (_) {}
  }
  return responded ? { ok: true, agents: [] } : { ok: false, reason: "no-copilot" };
}

// Con open: si Copilot no está abierto (o aún no muestra agentes), lo abre y espera hasta 25 s a que
// cargue su panel. Si no lo consigue, dice por qué (sin sesión o aún cargando).
async function refreshAgents(open) {
  let res = await askAgents();
  if (!open || (res.ok && res.agents.length)) return res;
  await ensureCopilotTab();
  const start = Date.now();
  while (Date.now() - start < 25000) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await askAgents();
    if (res.ok && res.agents.length) return res;
    const st = await checkCopilot();
    if (st.state === "login" || st.state === "cookies") return { ok: false, reason: st.state };
  }
  if (res.ok) return res;
  const last = (await checkCopilot()).state;
  return { ok: false, reason: last === "login" || last === "cookies" ? last : "loading" };
}

// Menú contextual «CoThunder» en la lista de mensajes y en el botón del visor. Se rehace en cada
// arranque del event page (removeAll + create: ids fijos, sin duplicados) y el submenú de
// plantillas se rellena al mostrarse.
const MENU_CONTEXTS = ["message_list", "message_display_action"];
const MENU_PARENT = "cothunder";
let menuTemplateIds = [];
async function buildMenus() {
  try {
    await messenger.menus.removeAll();
    const add = (props) => messenger.menus.create(Object.assign({ contexts: MENU_CONTEXTS }, props));
    add({ id: MENU_PARENT, title: "CoThunder" });
    add({ id: "qa-summary", parentId: MENU_PARENT, title: "Resumir con Copilot" });
    add({ id: "qa-sep1", parentId: MENU_PARENT, type: "separator" });
    for (const [k, a] of Object.entries(QUICK_ACTIONS)) add({ id: "qa-" + k, parentId: MENU_PARENT, title: a.label });
    add({ id: "qa-tpl", parentId: MENU_PARENT, title: "Responder con mi prompt" });
    add({ id: "qa-tpl-none", parentId: "qa-tpl", title: "(cargando…)", enabled: false });
    add({ id: "qa-sep2", parentId: MENU_PARENT, type: "separator" });
    add({ id: "qa-export", parentId: MENU_PARENT, title: "Exportar a Markdown / preguntar a Copilot…" });
    add({ id: "qa-window", parentId: MENU_PARENT, title: "Abrir la ventana de CoThunder…" });
    add({ id: "qa-help", parentId: MENU_PARENT, title: "Ayuda de CoThunder" });
    menuTemplateIds = [];
  } catch (e) {
    console.error("[CoThunder] menús:", e);
  }
}
const menusReady = buildMenus();

// Mensajes a los que se refiere un clic de menú: la selección de la lista o el correo del visor.
async function menuMessageIds(info, tab) {
  const sel = info && info.selectedMessages;
  if (sel && sel.messages && sel.messages.length) {
    const ids = sel.messages.map((m) => m.id);
    let page = sel;
    while (page.id && ids.length < SUMMARY_MAX_MESSAGES) {
      page = await messenger.messages.continueList(page.id).catch(() => null);
      if (!page) break;
      ids.push(...(page.messages || []).map((m) => m.id));
    }
    return ids;
  }
  try {
    const displayed = await messenger.messageDisplay.getDisplayedMessages(tab.id);
    const messages = Array.isArray(displayed) ? displayed : (displayed && displayed.messages) || [];
    return messages.map((m) => m.id);
  } catch (_) {
    return [];
  }
}

messenger.menus.onShown.addListener(async (info, tab) => {
  if (!info.menuIds || !info.menuIds.includes(MENU_PARENT)) return;
  await menusReady;
  const n = (info.selectedMessages && info.selectedMessages.messages || []).length;
  const many = n > 1;
  messenger.menus.update("qa-summary", { title: many ? "Resumir los " + n + " correos con Copilot" : "Resumir con Copilot" }).catch(() => {});
  messenger.menus.update("qa-export", { title: many ? "Exportar los " + n + " correos a Markdown / preguntar a Copilot…" : "Exportar a Markdown / preguntar a Copilot…" }).catch(() => {});
  for (const k of [...Object.keys(QUICK_ACTIONS), "tpl"]) messenger.menus.update("qa-" + k, { enabled: !many }).catch(() => {});
  // Plantillas «Prompt - …» del usuario como submenú.
  try {
    const list = promptTemplates(await listTemplates(), "reply");
    for (const id of menuTemplateIds) await messenger.menus.remove(id).catch(() => {});
    await messenger.menus.remove("qa-tpl-none").catch(() => {});
    menuTemplateIds = [];
    if (!list.length) {
      messenger.menus.create({ id: "qa-tpl-none", parentId: "qa-tpl", contexts: MENU_CONTEXTS, title: "(no hay plantillas «Prompt - …»)", enabled: false });
    }
    for (const t of list.slice(0, 30)) {
      const id = "qa-tpl-" + t.id;
      messenger.menus.create({ id, parentId: "qa-tpl", contexts: MENU_CONTEXTS, title: t.label });
      menuTemplateIds.push(id);
    }
  } catch (_) {}
  messenger.menus.refresh().catch(() => {});
});

messenger.menus.onClicked.addListener(async (info, tab) => {
  const id = String(info.menuItemId || "");
  if (!id.startsWith("qa-")) return;
  if (id === "qa-help") { openHelp("menu"); return; }
  const ids = await menuMessageIds(info, tab);
  if (id === "qa-window") { openReplyWindow(ids[0]); return; }
  if (id === "qa-export") { openExportWindow(ids); return; }
  if (id === "qa-summary") { quickAction("summary", ids); return; }
  if (id.startsWith("qa-tpl-")) { quickAction("template", ids, Number(id.slice("qa-tpl-".length))); return; }
  const kind = id.slice(3);
  if (QUICK_ACTIONS[kind]) quickAction(kind, ids);
});

// --- Biblioteca inicial de Prompts y Formatos, sembrada en la carpeta Plantillas al instalar ---
// Versión de la biblioteca: se siembra una sola vez por versión. Subir SOLO al añadir plantillas nuevas
// (así, si el usuario borra alguna, no reaparece en cada actualización).
// 2: plantillas sin pie con datos personales (nombre, cargo, contacto); la firma la pone
// Thunderbird. Volver a sembrar añade «Formato - Correo formal» a quien ya tenía la v1.
const SEED_VERSION = 2;
const SEED_ITEMS = [
  { subject: "Prompt - Afirmación / Aceptación", body: "Redacta una respuesta afirmativa y cordial: confirma o acepta lo solicitado, deja claros los siguientes pasos y muestra disposición a colaborar." },
  { subject: "Prompt - Negación cordial", body: "Redacta una respuesta que declina lo solicitado de forma cordial y respetuosa: agradece el mensaje, explica el motivo con tacto y, si es posible, ofrece una alternativa." },
  { subject: "Prompt - Negociación", body: "Redacta una respuesta orientada a negociar: reconoce la propuesta recibida, expón tu posición y tus condiciones, plantea una contraoferta o un punto intermedio y mantén un tono constructivo." },
  { subject: "Prompt - Investigación / Petición de datos", body: "Redacta una respuesta solicitando la información o las aclaraciones necesarias para poder avanzar. Enumera de forma clara las preguntas o los datos que faltan." },
  { subject: "Prompt - Recopilación de documentación", body: "Redacta una respuesta pidiendo que se aporte la documentación o los datos requeridos. Enuméralos con claridad e indica, si procede, el plazo y el formato de entrega." },
  { subject: "Prompt - Acuse de recibo", body: "Redacta un acuse de recibo: confirma que se ha recibido el mensaje, indica que se revisará y da un plazo aproximado de respuesta." },
  { subject: "Prompt - Reclamación", body: "Redacta una reclamación firme pero educada: expón los hechos con fechas y datos concretos, indica claramente lo que solicitas y establece un plazo de respuesta." },
  { subject: "Prompt - Agradecimiento", body: "Redacta un agradecimiento sincero y breve por lo indicado en el correo, cerrando con una nota cordial." },
  { subject: "Prompt - Seguimiento / Recordatorio", body: "Redacta un recordatorio cordial sobre un asunto pendiente: referencia el mensaje anterior, resume lo que queda por resolver y pide una actualización." },
  { subject: "Prompt - Disculpa / Incidencia", body: "Redacta una disculpa profesional: reconoce el problema o el retraso, explica brevemente qué ha pasado y propón una solución o los próximos pasos." },
  { subject: "Formato - Carta institucional", body: "# [Saludo formal]\n\n[Introducción: motivo del mensaje]\n\n[Desarrollo: expón el asunto con detalle]\n\n**[Petición o conclusión concreta]**\n\n[Despedida formal]" },
  { subject: "Formato - Respuesta breve", body: "[Saludo]\n\n[Respuesta directa en 2-3 frases]\n\n[Despedida]" },
  { subject: "Formato - Lista de puntos", body: "# [Saludo]\n\n[Frase introductoria]\n\n- [Punto 1]\n- [Punto 2]\n- [Punto 3]\n\n[Cierre]" },
  { subject: "Formato - Tabla comparativa", body: "# [Saludo]\n\n[Introducción breve]\n\n| [Concepto] | [Detalle] |\n|---|---|\n| [elemento] | [valor] |\n| [elemento] | [valor] |\n\n[Cierre]" },
  { subject: "Formato - Propuesta / Oferta", body: "# [Saludo]\n\n[Contexto de la propuesta]\n\n## Propuesta\n- **Alcance:** [descripción]\n- **Plazo:** [plazo]\n- **Condiciones:** [condiciones]\n\n> [Nota o salvedad importante]\n\n[Cierre y llamada a la acción]" },
  { subject: "Prompt - Confirmación de reunión", body: "Confirma la reunión o cita propuesta, reiterando fecha, hora, lugar o enlace y, si procede, el orden del día." },
  { subject: "Prompt - Propuesta de reunión", body: "Propón una reunión: sugiere dos o tres franjas horarias, indica el objetivo y pide que confirmen la que mejor convenga." },
  { subject: "Prompt - Delegación / Reenvío", body: "Indica que trasladas el asunto a la persona o departamento competente: di a quién, por qué y qué puede esperar el remitente a continuación." },
  { subject: "Prompt - Explicación / Aclaración", body: "Explica con claridad y de forma didáctica el asunto planteado, evitando jerga innecesaria y con ejemplos si ayudan a entenderlo." },
  { subject: "Prompt - Oferta económica / Presupuesto", body: "Redacta una respuesta con una oferta económica: detalla los conceptos, los importes, las condiciones y la validez de la oferta." },
  { subject: "Prompt - Rechazo de oferta / candidatura", body: "Comunica de forma respetuosa que no se sigue adelante con la propuesta o candidatura, agradeciendo el interés y dejando la puerta abierta si procede." },
  { subject: "Prompt - Bienvenida / Onboarding", body: "Da la bienvenida y explica los primeros pasos, los recursos disponibles y a quién dirigirse ante cualquier duda." },
  { subject: "Prompt - Escalado / Urgencia", body: "Comunica que el asunto se escala por su urgencia o gravedad: indica a qué nivel se eleva y el plazo de actuación previsto." },
  { subject: "Prompt - Resumen ejecutivo", body: "Resume el correo o el hilo en los puntos clave, las decisiones tomadas y las acciones pendientes, de forma concisa." },
  { subject: "Prompt - Traducción", body: "Traduce el contenido del correo al idioma solicitado, manteniendo el tono, el registro y el significado del original." },
  { subject: "Formato - Correo formal", body: "Estimado/a [Nombre]:\n\n[Párrafo 1]\n\n[Párrafo 2]\n\nQuedo a su disposición para cualquier aclaración.\n\nUn cordial saludo," },
  { subject: "Formato - Pasos numerados", body: "# [Título o saludo]\n\n[Contexto breve]\n\n1. [Paso 1]\n2. [Paso 2]\n3. [Paso 3]\n\n[Cierre]" },
  { subject: "Formato - Preguntas y respuestas", body: "# [Saludo]\n\n**[Pregunta 1]**\n[Respuesta 1]\n\n**[Pregunta 2]**\n[Respuesta 2]\n\n[Cierre]" },
  { subject: "Formato - Resumen con acciones", body: "# [Asunto]\n\n**Resumen:** [síntesis en 1-2 frases]\n\n## Puntos clave\n- [Punto 1]\n- [Punto 2]\n\n## Acciones pendientes\n- [ ] [Acción 1] — [responsable / plazo]\n- [ ] [Acción 2] — [responsable / plazo]" },
  { subject: "Formato - Confirmación de cita", body: "# [Saludo]\n\nConfirmo nuestra [reunión o cita]:\n\n- **Fecha:** [fecha]\n- **Hora:** [hora]\n- **Lugar / Enlace:** [lugar o enlace]\n- **Asunto:** [tema]\n\n[Cierre]" },
  { subject: "Formato - Propuesta comercial", body: "# [Saludo]\n\n[Presentación breve]\n\n## Propuesta\n| Concepto | Detalle | Importe |\n|---|---|---|\n| [elemento] | [detalle] | [importe] |\n| [elemento] | [detalle] | [importe] |\n\n**Total:** [total]\n\n**Condiciones:** [condiciones] · **Validez:** [validez]\n\n[Cierre y llamada a la acción]" },
  { subject: "Formato - Identidad UPO", body: "# [Saludo institucional]\n\n[Introducción breve y clara]\n\n[Cuerpo: desarrollo del asunto, con tono institucional]\n\n**[Idea o dato clave]**\n\n> [Nota o aviso destacado]\n\n[Despedida institucional]\n\n---\nIdentidad UPO (referencia de estilo): tono institucional, claro y cordial, con estructura de encabezado, cuerpo y despedida. Colores de marca (oficiales del MIC): azul corporativo #003772 (Pantone 281C) para títulos y acentos; amarillo #FCC100 (Pantone 123C) solo como acento puntual, nunca como fondo de texto de lectura; texto #1A1A1A sobre blanco. Tipografía Franklin Gothic (o Arial como alternativa). No inventes otros colores ni tipografías. Jerarquía: el azul manda, el amarillo resalta, el blanco respira." },
  // --- Plantillas específicas del modo "Crear desde Copilot" (correos nuevos desde cero) ---
  { subject: "Prompt crear - Convocatoria de reunión", body: "Redacta una convocatoria de reunión clara: indica el motivo y el objetivo, propón fecha, hora y lugar o enlace, incluye un orden del día breve y pide confirmación de asistencia." },
  { subject: "Prompt crear - Invitación a evento", body: "Redacta una invitación a un evento: presenta el evento y su propósito, indica fecha, hora y lugar, explica por qué merece la pena asistir y cómo confirmar o inscribirse." },
  { subject: "Prompt crear - Comunicado / Anuncio", body: "Redacta un comunicado claro y directo: anuncia la novedad o el cambio, explica en qué consiste, a quién afecta y desde cuándo, e indica a quién dirigirse para dudas." },
  { subject: "Prompt crear - Solicitud / Petición", body: "Redacta una solicitud educada y concreta: explica el contexto, formula con claridad lo que pides, justifica el motivo e indica, si procede, el plazo deseado." },
  { subject: "Prompt crear - Presentación / Primer contacto", body: "Redacta un correo de presentación: preséntate (a ti o a tu organización), explica el motivo del contacto y el valor que aportas, y propón un siguiente paso claro." },
  { subject: "Prompt crear - Agradecimiento", body: "Redacta un correo de agradecimiento sincero: expresa por qué agradeces, sé concreto sobre lo que valoras y cierra de forma cordial." },
  { subject: "Prompt crear - Felicitación", body: "Redacta una felicitación cálida y personal por el motivo indicado (logro, aniversario, ascenso…), breve y genuina." },
  { subject: "Prompt crear - Recordatorio", body: "Redacta un recordatorio cordial de un asunto o plazo pendiente: indica de qué se trata, la fecha límite y la acción concreta que se espera." },
  { subject: "Prompt crear - Propuesta comercial", body: "Redacta una propuesta comercial persuasiva: identifica la necesidad del destinatario, presenta la solución y sus beneficios, detalla condiciones y precio, y termina con una llamada a la acción." },
  { subject: "Prompt crear - Boletín / Novedades", body: "Redacta un boletín breve de novedades: un titular atractivo, 3-4 puntos destacados con su detalle o enlace, y un cierre con la próxima acción sugerida." },
  { subject: "Formato - Convocatoria de reunión", body: "# [Asunto de la convocatoria]\n\n[Motivo y objetivo de la reunión]\n\n- **Fecha:** [fecha]\n- **Hora:** [hora]\n- **Lugar / Enlace:** [lugar o enlace]\n\n## Orden del día\n1. [Punto 1]\n2. [Punto 2]\n3. [Punto 3]\n\n> Se ruega confirmar asistencia.\n\n[Despedida]" },
  { subject: "Formato - Invitación a evento", body: "# [Nombre del evento]\n\n[Frase de gancho: por qué asistir]\n\n- **Fecha:** [fecha]\n- **Hora:** [hora]\n- **Lugar:** [lugar]\n\n[Descripción breve del programa]\n\n**[Cómo confirmar o inscribirse]**\n\n[Despedida]" }
];

// Codifica el asunto en RFC 2047 (UTF-8/Base64) para permitir acentos en la cabecera.
function encodeSubject(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return "=?UTF-8?B?" + btoa(bin) + "?=";
}

// Siembra los Prompts y Formatos de ejemplo en la carpeta Plantillas (solo los que aún no existan).
async function seedTemplates() {
  try {
    const { seededVersion } = await messenger.storage.local.get({ seededVersion: 0 });
    if (seededVersion >= SEED_VERSION) return; // ya sembrado en esta versión: respeta lo que el usuario haya borrado
    const folders = await messenger.folders.query({ specialUse: ["templates"] });
    if (!folders || !folders.length) return;
    const folder = folders[0];
    const existing = new Set();
    let page = await messenger.messages.list(folder.id).catch(() => null);
    while (page) {
      for (const m of page.messages || []) existing.add((m.subject || "").trim());
      page = page.id ? await messenger.messages.continueList(page.id).catch(() => null) : null;
    }
    const date = new Date().toUTCString();
    for (const it of SEED_ITEMS) {
      if (existing.has(it.subject)) continue;
      const eml =
        "From: CoThunder <cothunder@local>\r\n" +
        "Date: " + date + "\r\n" +
        "Subject: " + encodeSubject(it.subject) + "\r\n" +
        "Content-Type: text/plain; charset=utf-8\r\n" +
        "Content-Transfer-Encoding: 8bit\r\n\r\n" +
        it.body;
      const file = new File([eml], "seed.eml", { type: "message/rfc822" });
      await messenger.messages.import(file, folder.id, { read: true })
        .catch((e) => console.error("[CoThunder] seed import:", it.subject, e));
    }
    await messenger.storage.local.set({ seededVersion: SEED_VERSION });
  } catch (e) {
    console.error("[CoThunder] seedTemplates:", e);
  }
}

// Siembra al instalar y también al actualizar (idempotente por asunto: solo añade lo que falta,
// para que las plantillas nuevas de una versión lleguen a quien ya tenía el complemento).
// Migración de una sola vez (v2.14): quita del perfil «Sobre ti» la firma que copiaba el antiguo
// «Tomar de mi identidad», para que no siga viajando a Copilot en cada prompt. Guarda el texto
// quitado en `userProfileStyleBackup` por si hiciera falta recuperarlo.
async function cleanProfileSignature() {
  try {
    const { profileSignatureCleaned, userProfile } = await messenger.storage.local.get({ profileSignatureCleaned: false, userProfile: null });
    if (profileSignatureCleaned) return;
    if (userProfile && userProfile.style) {
      const ids = await messenger.identities.list().catch(() => []);
      const sigs = (ids || []).map(signatureAsText).filter(Boolean);
      const res = stripCopiedSignature(userProfile.style, sigs);
      if (res.removed) {
        await messenger.storage.local.set({
          userProfile: Object.assign({}, userProfile, { style: res.style }),
          userProfileStyleBackup: userProfile.style
        });
      }
    }
    await messenger.storage.local.set({ profileSignatureCleaned: true });
  } catch (e) {
    console.error("[CoThunder] limpieza de la firma del perfil:", e);
  }
}
cleanProfileSignature();

messenger.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install" || details.reason === "update") seedTemplates();
  // Primera instalación: asistente de bienvenida (sesión de Copilot, tema y agente).
  if (details.reason === "install") {
    messenger.tabs.create({ url: messenger.runtime.getURL("pages/welcome.html") }).catch(() => {});
  }
});
