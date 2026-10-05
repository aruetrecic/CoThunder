"use strict";

// Selectores reales del chat de M365 Copilot (descubiertos en el spike, 2026-07-06).
const SELECTORS = {
  editor: "#m365-chat-editor-target-element",                 // editor Lexical (contenteditable)
  sendButton: "button.fai-SendButton, button.fai-ChatInput__send",
  newChat: '[data-testid="newChatButton"]',
  reply: '[data-testid="markdown-reply"]',                    // texto de la respuesta del asistente (el último)
  loading: '[data-testid="loading-message"]',                // presente mientras Copilot genera
  // Botón "Detener" mientras genera (para Cancelar). Si no se encuentra, se deja terminar.
  stopButton: 'button[data-testid="stopGeneratingButton"], button.fai-StopButton, button[aria-label*="Detener"], button[aria-label*="Stop"]',
  // Indicios de que no hay sesión: botón o enlace de inicio de sesión de Microsoft en la página.
  signIn: 'a[href*="login.microsoftonline.com"], a[href*="login.live.com"], button[data-testid="signInButton"], #mectrl_headerPicture[aria-label*="Iniciar"]',
  // Agentes (varias señales, porque Microsoft cambia el DOM a menudo):
  // 1) elementos del panel lateral (clase del spike de julio; se filtran por id de agente);
  agentNavItems: ".fai-CopilotNavSubItem",
  // 2) enlaces a un agente: llevan su id en la URL (?titleId=T_…, ?agentId=…, /agent/…);
  agentLinks: 'a[href*="titleId="], a[href*="agentId="], a[href*="/agents/"], a[href*="/agent/"]',
  // 3) elementos cuyo id o data-testid es de agente.
  agentMarked: '[id^="T_"], [id^="P_"], [data-testid*="agent" i] a, [data-testid*="agent" i] [role="link"], [data-testid*="agent" i][role="link"]'
};

// Avisos al background y a la ventana de CoThunder: progreso de una petición y diagnóstico técnico
// (solo qué paso o selector falló; nunca el texto del correo ni de la respuesta).
function progress(token, stage, extra) {
  messenger.runtime.sendMessage(Object.assign({ type: "copilotProgress", token, stage }, extra || {})).catch(() => {});
}
function diag(ev, detail) {
  messenger.runtime.sendMessage({ type: "diag", ev, detail: String(detail || "").slice(0, 120) }).catch(() => {});
}
// Tokens cancelados por el usuario: la espera de la respuesta se corta y no se abre nada.
const cancelled = new Set();
const signInVisible = () => !!document.querySelector(SELECTORS.signIn);

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function placeCaretAtEnd(el) {
  el.focus();
  const sel = window.getSelection();
  sel.removeAllRanges();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.addRange(range);
}

function clearEditor(el) {
  el.focus();
  const sel = window.getSelection();
  sel.removeAllRanges();
  const range = document.createRange();
  range.selectNodeContents(el);
  sel.addRange(range);
  document.execCommand("delete", false);
}

// Inserta el texto en el editor Lexical reintentando y verificando que entró (al cambiar de agente
// el editor se rehace y tarda en estar listo; un único intento no basta).
async function typeIntoEditor(text, attempts = 4) {
  const probe = (text || "").slice(0, Math.min(8, (text || "").length));
  for (let i = 0; i < attempts; i++) {
    const el = document.querySelector(SELECTORS.editor);
    if (el) {
      clearEditor(el);
      placeCaretAtEnd(el);
      // Lexical registra el texto con un ÚNICO evento beforeinput; añadir 'input' lo duplica.
      el.dispatchEvent(new InputEvent("beforeinput", { inputType: "insertText", data: text, bubbles: true, cancelable: true }));
      await delay(300);
      const check = document.querySelector(SELECTORS.editor);
      if (check && check.textContent && check.textContent.includes(probe)) return true;
    }
    await delay(500);
  }
  return false;
}

function clickSend() {
  const btn = document.querySelector(SELECTORS.sendButton);
  if (!btn) return false;
  btn.click();
  return true;
}

async function startNewChat() {
  const btn = document.querySelector(SELECTORS.newChat);
  if (!btn) return false;
  btn.click();
  await delay(800);
  return true;
}

// Agentes de Copilot. Los chats del historial comparten clase con los agentes, así que se
// filtra por el id: los agentes empiezan por P_/T_ o contienen "agent"/"gpt"; las conversaciones
// del historial son GUID sueltos. Cada agente guarda su enlace si lo tiene: con él, el background
// puede abrir el agente aunque no esté visible en el panel.
function isAgentId(id) {
  return !!id && (/^[PT]_/.test(id) || /agent|gpt/i.test(id));
}

const cleanLabel = (t) => String(t || "").trim().replace(/\s+/g, " ");

function agentFromLink(href) {
  try {
    const u = new URL(href, location.href);
    if (u.host !== location.host) return null;
    const id = u.searchParams.get("titleId") || u.searchParams.get("agentId") ||
      (u.pathname.match(/\/agents?\/([^/?#]+)/) || [])[1] || "";
    return id ? { id, url: u.href } : null;
  } catch (_) {
    return null;
  }
}

// Devuelve { agents: [{ id, label, url }], counts } con lo encontrado por cada señal (para el diagnóstico).
function scanAgents() {
  const found = new Map();
  const counts = { nav: 0, links: 0, marked: 0 };
  const add = (id, label, url, kind) => {
    label = cleanLabel(label);
    if (!label || label.length > 80 || !(id || url)) return;
    const key = id || url;
    const prev = found.get(key);
    if (prev) { if (!prev.url && url) prev.url = url; return; }
    found.set(key, { id: id || "", label, url: url || "" });
    counts[kind]++;
  };
  for (const el of document.querySelectorAll(SELECTORS.agentNavItems)) {
    if (!isAgentId(el.id)) continue;
    const link = el.closest("a") || el.querySelector("a");
    add(el.id, el.getAttribute("aria-label") || el.textContent, link && link.href, "nav");
  }
  for (const el of document.querySelectorAll(SELECTORS.agentLinks)) {
    const ag = agentFromLink(el.getAttribute("href"));
    if (ag) add(ag.id, el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent, ag.url, "links");
  }
  for (const el of document.querySelectorAll(SELECTORS.agentMarked)) {
    const id = isAgentId(el.id) ? el.id : "";
    const link = el.closest("a") || (el.matches("a") ? el : el.querySelector("a"));
    const ag = link ? agentFromLink(link.getAttribute("href")) : null;
    if (id || ag) add(id || ag.id, el.getAttribute("aria-label") || el.textContent, ag && ag.url, "marked");
  }
  return { agents: [...found.values()], counts };
}

function listAgents() {
  return scanAgents().agents;
}

// Guarda la lista de agentes para que el popup pueda ofrecerla (la SPA tarda: se intenta varias
// veces y al cambiar el panel lateral).
let lastAgentsKey = "";
function saveAgents() {
  const agents = listAgents();
  const key = JSON.stringify(agents);
  if (!agents.length || key === lastAgentsKey) return;
  lastAgentsKey = key;
  messenger.storage.local.set({ agents }).catch(() => {});
}
setTimeout(saveAgents, 3000);
setTimeout(saveAgents, 8000);
setTimeout(saveAgents, 20000);
setInterval(saveAgents, 60000); // refresco periódico por si el usuario crea agentes nuevos
// Cambios en la página (el panel lateral se carga tarde o se despliega): se vuelve a mirar, con calma.
let agentsTimer = null;
try {
  new MutationObserver(() => {
    if (agentsTimer) return;
    agentsTimer = setTimeout(() => { agentsTimer = null; saveAgents(); }, 2000);
  }).observe(document.documentElement, { childList: true, subtree: true });
} catch (_) {}

// Selecciona un agente por id (estable) o, en su defecto, por nombre. Si no está en la página,
// devuelve false y el background lo abrirá por su enlace.
function selectAgent(id, label) {
  let el = id ? document.getElementById(id) : null;
  if (!el && id) {
    el = [...document.querySelectorAll(SELECTORS.agentLinks)].find((a) => {
      const ag = agentFromLink(a.getAttribute("href"));
      return ag && ag.id === id;
    }) || null;
  }
  if (!el && label) {
    el = [...document.querySelectorAll(SELECTORS.agentNavItems + ", " + SELECTORS.agentLinks)]
      .find((n) => cleanLabel(n.getAttribute("aria-label") || n.textContent) === label) || null;
  }
  if (el) { el.click(); return true; }
  return false;
}

// Recorre el DOM de la respuesta usando textContent (funciona aunque la ventana de Copilot esté en
// segundo plano, a diferencia de innerText, que necesita layout). Cada línea del bloque de código
// se trata como UNA línea (un salto por línea, sin duplicar) y se conservan las líneas en blanco.
// Ignora botones y los espacios de formato entre bloques (que causaban saltos de más).
const REPLY_BLOCK = /^(P|DIV|LI|TR|H[1-6]|BLOCKQUOTE|PRE|UL|OL|TABLE|THEAD|TBODY|SECTION|ARTICLE)$/;
function domToText(root) {
  const isBlock = (el) => el.nodeType === 1 && REPLY_BLOCK.test(el.tagName);
  const hasBlockChild = (el) => Array.prototype.some.call(el.children || [], isBlock);
  let out = "";
  const nl = () => { if (out && !out.endsWith("\n")) out += "\n"; };
  (function walk(node) {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {                                            // nodo de texto
        if (hasBlockChild(node) && /^\s*$/.test(child.nodeValue)) continue;  // espacios entre bloques
        out += child.nodeValue;
      } else if (child.nodeType === 1) {                                     // elemento
        const tag = child.tagName;
        if (tag === "BUTTON" || child.getAttribute("role") === "toolbar") continue;
        if (tag === "BR") { out += "\n"; continue; }
        if (isBlock(child)) {
          nl();                 // abre línea/bloque
          walk(child);          // recurre siempre (así se saltan botones anidados)
          out += "\n";          // cierra línea/bloque
        } else {
          walk(child);          // inline: sigue dentro
        }
      }
    }
  })(root);
  return out;
}

// Extrae el texto de la respuesta conservando los saltos de línea reales (un salto por línea).
function extractReplyText(el) {
  let raw = domToText(el);
  let text = raw
    .replace(/ /g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // Quita caracteres invisibles (BOM, zero-width) que romperían el anclado ^ de los filtros.
  text = text.replace(/[﻿​‌‍⁠]/g, "").trim();
  // CABECERA del bloque de código: etiqueta del lenguaje ("Markdown"/"md") y botón "Copiar",
  // que innerText incluye porque son parte visible del bloque. Se barren las primeras líneas.
  for (let i = 0; i < 5; i++) {
    const before = text;
    text = text.replace(/^\s*markdown\b[^\n]*\n/i, "");                          // "Markdown" (aunque lleve "Copiar" al lado)
    text = text.replace(/^\s*(md|plaintext|text)\s*\n/i, "");                    // otras etiquetas de lenguaje, si van solas
    text = text.replace(/^\s*(copiar código|copiar|copy code|copy)\s*\n/i, ""); // botón de copiar en su propia línea
    text = text.replace(/^`{2,}[^\n]*\n/, "");                                   // comillas de apertura si aparecieran
    if (text === before) break;
  }
  // PIE del bloque de código: botón "Mostrar más/menos líneas" y "Copiar". Se barren las últimas líneas.
  for (let i = 0; i < 5; i++) {
    const before = text;
    text = text.replace(/\n[^\n]*mostrar (más|mas|menos) l[íi]neas\s*$/i, "");
    text = text.replace(/\n[^\n]*show (more|less) lines?\s*$/i, "");
    text = text.replace(/\n\s*(copiar código|copiar|copy code|copy)\s*$/i, "");
    text = text.replace(/\n\s*`{1,}\s*$/, "");
    if (text === before) break;
  }
  return text.trim();
}

// Espera a que la respuesta del asistente aparezca (nodo nuevo o texto cambiado) y su texto se estabilice.
function waitForReply(baselineCount, baselineText, token, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const start = Date.now();
    let last = "";
    let stableSince = Date.now();
    let appeared = false;
    const finish = () => {
      const n = document.querySelectorAll(SELECTORS.reply);
      const e = n[n.length - 1];
      return appeared && e ? extractReplyText(e) : "";
    };
    const tick = setInterval(() => {
      if (cancelled.has(token)) { clearInterval(tick); resolve(null); return; }
      const nodes = document.querySelectorAll(SELECTORS.reply);
      const el = nodes[nodes.length - 1];
      const text = el ? el.textContent.trim() : "";
      if (nodes.length > baselineCount || (text && text !== baselineText)) appeared = true;
      if (appeared && text && text === last) {
        if (Date.now() - stableSince > 2000) { clearInterval(tick); resolve(finish()); }
      } else {
        last = text;
        stableSince = Date.now();
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(tick);
        diag("timeout-respuesta", appeared ? "texto sin estabilizar" : "sin respuesta nueva (" + SELECTORS.reply + ")");
        resolve(finish());
      }
    }, 500);
  });
}

// Protocolo con el background: escribir (opcional nuevo chat), enviar y capturar la respuesta.
messenger.runtime.onMessage.addListener(async (msg) => {
  if (!msg) return;
  if (msg.type === "getAgents") {
    const { agents, counts } = scanAgents();
    if (agents.length) messenger.storage.local.set({ agents }).catch(() => {});
    diag("agentes-detectados", agents.length + " (panel " + counts.nav + ", enlaces " + counts.links + ", marcados " + counts.marked + ")");
    return { agents, counts };
  }
  if (msg.type === "cancelPrompt") {
    cancelled.add(msg.token);
    const stop = document.querySelector(SELECTORS.stopButton);
    if (stop) stop.click();
    return { ok: true };
  }
  if (msg.type === "checkSession") {
    return { ok: true, editor: !!document.querySelector(SELECTORS.editor), signIn: signInVisible() };
  }
  if (msg.type !== "sendPrompt") return;
  const token = msg.messageId;
  progress(token, "typing");
  if (msg.agentId || msg.agentLabel) {
    if (!selectAgent(msg.agentId, msg.agentLabel)) {
      // No está en la página: si el background conoce su enlace, que lo abra y vuelva a entregar.
      if (msg.agentUrl) return { ok: false, reason: "agent-navigate" };
      diag("agente-no-encontrado", msg.agentId || "por nombre");
    }
    await delay(1500);
  } else if (msg.newChat) {
    if (!(await startNewChat())) diag("selector-no-encontrado", "newChat " + SELECTORS.newChat);
  }
  if (cancelled.has(token)) return { ok: false, reason: "cancelled" };
  if (!(await typeIntoEditor(msg.prompt))) {
    // Sin editor: o no hay sesión (página de inicio de sesión) o Microsoft ha cambiado la interfaz.
    if (signInVisible()) { diag("sin-sesion", "aviso de inicio de sesión en la página"); return { ok: false, reason: "login" }; }
    diag("selector-no-encontrado", "editor " + SELECTORS.editor);
    return { ok: false, reason: "no-editor" };
  }
  const baseNodes = document.querySelectorAll(SELECTORS.reply);
  const baseline = baseNodes.length;
  const baselineText = baseline ? baseNodes[baseline - 1].textContent.trim() : "";
  await delay(300);
  if (cancelled.has(token)) return { ok: false, reason: "cancelled" };
  if (!clickSend()) { diag("selector-no-encontrado", "enviar " + SELECTORS.sendButton); return { ok: false, reason: "no-send" }; }
  progress(token, "waiting");
  // Fase 2: en segundo plano, espera la respuesta y la devuelve con su token (para no cruzar correos).
  const started = Date.now();
  waitForReply(baseline, baselineText, token).then((text) => {
    if (text === null) { progress(token, "cancelled"); return; }
    if (text) diag("ok", "respuesta en " + Math.round((Date.now() - started) / 1000) + " s");
    else if (!document.querySelector(SELECTORS.reply)) diag("selector-no-encontrado", "respuesta " + SELECTORS.reply);
    progress(token, text ? "done" : "error", text ? null : { reason: "capture" });
    messenger.runtime.sendMessage({ type: "copilotReply", text, messageId: token }).catch(() => {});
  });
  return { ok: true };
});
