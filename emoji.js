"use strict";
// emoji.js — selector de emoji para el TEXTO de los usuarios (editor de redacción y campos de la
// ventana). Inserta el carácter real (😀), que los clientes de correo actuales muestran bien.
// Búsqueda en español por nombre y palabras clave, fila de recientes y manejo con el teclado.
// Lo usan content-compose.js (compose script) y popup.js; sin red ni dependencias.

// [emoji, nombre, palabras clave]
const EMOJI_GROUPS = [
  { name: "Habituales", items: [
    ["👍", "pulgar arriba", "ok vale de acuerdo bien me gusta"], ["🙏", "gracias", "por favor manos rezar agradecer"],
    ["😊", "sonrisa", "feliz contento amable"], ["🙂", "sonrisa leve", "cordial"], ["😉", "guiño", "broma"],
    ["👏", "aplausos", "enhorabuena bravo felicidades"], ["🎉", "fiesta", "celebrar enhorabuena felicidades"],
    ["✅", "hecho", "ok correcto listo check"], ["❌", "no", "error mal cancelar"], ["⚠️", "aviso", "advertencia atención cuidado"],
    ["📌", "importante", "fijar chincheta destacar"], ["📅", "fecha", "calendario reunión cita día"],
    ["⏰", "plazo", "hora alarma recordatorio tiempo"], ["📎", "adjunto", "clip archivo documento"],
    ["💡", "idea", "bombilla sugerencia propuesta"], ["🚀", "lanzamiento", "cohete rápido empezar"],
    ["🔥", "urgente", "fuego caliente prioridad"], ["❤️", "corazón", "amor cariño gracias"],
    ["👋", "hola", "saludo adiós mano"], ["🤝", "acuerdo", "trato colaboración apretón manos"]
  ] },
  { name: "Caras", items: [
    ["😀", "sonriente", "feliz alegre"], ["😃", "muy contento", "feliz alegría"], ["😄", "risa", "feliz"],
    ["😁", "sonrisa amplia", "dientes"], ["😅", "uf", "sudor alivio nervios"], ["😂", "carcajada", "lágrimas risa"],
    ["🤣", "revolcarse de risa", "risa"], ["😇", "angelito", "inocente bueno"], ["😍", "enamorado", "me encanta"],
    ["🤩", "alucinado", "estrellas genial"], ["😘", "beso", "cariño"], ["😋", "delicioso", "rico comida"],
    ["😎", "guay", "gafas sol genial"], ["🤓", "empollón", "gafas estudiar"], ["🧐", "examinar", "lupa monóculo revisar"],
    ["🤔", "pensando", "duda pensar hmm"], ["🤨", "escéptico", "ceja duda"], ["😐", "neutral", "sin expresión"],
    ["😶", "sin palabras", "callado"], ["🙄", "ojos en blanco", "paciencia"], ["😏", "sonrisa pícara", "pícaro"],
    ["😬", "mueca", "incómodo ups"], ["😌", "aliviado", "tranquilo"], ["😴", "dormido", "sueño cansado"],
    ["😷", "mascarilla", "enfermo"], ["🤒", "enfermo", "fiebre baja"], ["🥳", "celebración", "fiesta cumpleaños"],
    ["😕", "confundido", "duda"], ["😟", "preocupado", "preocupación"], ["😮", "sorpresa", "asombro oh"],
    ["😲", "asombrado", "sorpresa"], ["😳", "sonrojado", "vergüenza"], ["🥺", "por favor", "suplicar ojos"],
    ["😢", "triste", "lágrima pena"], ["😭", "llorando", "triste"], ["😤", "resoplido", "enfado frustración"],
    ["😠", "enfadado", "enfado"], ["🤯", "explota la cabeza", "alucinante increíble"], ["🥱", "bostezo", "aburrido cansado"],
    ["🤗", "abrazo", "cariño"], ["🤫", "silencio", "secreto"], ["🤐", "boca cerrada", "secreto confidencial"]
  ] },
  { name: "Gestos y personas", items: [
    ["👎", "pulgar abajo", "no mal"], ["👌", "perfecto", "ok bien"], ["✌️", "paz", "victoria"], ["🤞", "dedos cruzados", "suerte"],
    ["👉", "señalar", "derecha aquí"], ["👈", "señalar izquierda", "aquí"], ["👆", "arriba", "señalar"], ["👇", "abajo", "señalar"],
    ["✋", "alto", "mano parar"], ["🙌", "celebrar", "manos arriba hurra"], ["💪", "fuerza", "ánimo músculo"],
    ["🫡", "a sus órdenes", "saludo militar entendido"], ["🙋", "levantar la mano", "pregunta yo"],
    ["🤷", "no sé", "encogerse hombros"], ["🤦", "facepalm", "error vaya"], ["👀", "ojos", "mirar ver revisar"],
    ["🧑‍💻", "informático", "ordenador trabajo"], ["👩‍🏫", "profesora", "docente clase"], ["👨‍🏫", "profesor", "docente clase"],
    ["🧑‍🎓", "estudiante", "graduado alumno"], ["👥", "personas", "equipo grupo usuarios"]
  ] },
  { name: "Trabajo y oficina", items: [
    ["📧", "correo", "email mensaje"], ["✉️", "sobre", "carta correo"], ["📨", "correo entrante", "recibido"],
    ["📤", "bandeja de salida", "enviar"], ["📥", "bandeja de entrada", "recibir"], ["📞", "teléfono", "llamar llamada"],
    ["📱", "móvil", "teléfono"], ["💻", "portátil", "ordenador"], ["🖥️", "ordenador", "pantalla"], ["🖨️", "impresora", "imprimir"],
    ["📄", "documento", "página archivo"], ["📝", "nota", "escribir apuntes acta"], ["📋", "portapapeles", "lista tareas"],
    ["📊", "gráfico", "estadísticas datos barras"], ["📈", "subida", "crecimiento tendencia"], ["📉", "bajada", "descenso"],
    ["🗂️", "carpetas", "archivo organizar"], ["📁", "carpeta", "archivo"], ["🗓️", "calendario", "agenda fecha"],
    ["🕒", "reloj", "hora"], ["⏳", "en espera", "pendiente reloj arena"], ["✏️", "lápiz", "editar escribir"],
    ["🖊️", "bolígrafo", "firmar"], ["🔗", "enlace", "link vínculo"], ["🔍", "buscar", "lupa"], ["🔒", "privado", "candado seguro"],
    ["🔑", "clave", "llave contraseña acceso"], ["⚙️", "ajustes", "configuración engranaje"], ["🛠️", "herramientas", "arreglar"],
    ["🏢", "oficina", "edificio empresa"], ["🏫", "escuela", "universidad centro"], ["🎓", "graduación", "universidad título"],
    ["📚", "libros", "estudiar biblioteca"], ["💼", "maletín", "trabajo negocio"], ["💰", "dinero", "presupuesto pago"],
    ["🧾", "recibo", "factura ticket"], ["📢", "anuncio", "comunicado altavoz"], ["🔔", "notificación", "campana aviso"]
  ] },
  { name: "Símbolos", items: [
    ["✔️", "marca", "correcto sí"], ["☑️", "casilla marcada", "tarea hecha"], ["➡️", "flecha", "siguiente derecha"],
    ["⬅️", "flecha izquierda", "anterior"], ["⬆️", "flecha arriba", "subir"], ["⬇️", "flecha abajo", "bajar"],
    ["🔄", "actualizar", "repetir ciclo"], ["➕", "más", "añadir sumar"], ["➖", "menos", "restar quitar"],
    ["❓", "pregunta", "duda interrogación"], ["❗", "exclamación", "importante"], ["ℹ️", "información", "info"],
    ["🔴", "rojo", "círculo urgente"], ["🟠", "naranja", "círculo"], ["🟡", "amarillo", "círculo"], ["🟢", "verde", "círculo ok"],
    ["🔵", "azul", "círculo"], ["⭐", "estrella", "favorito destacado"], ["✨", "brillos", "nuevo novedad magia"],
    ["💯", "cien", "perfecto totalmente"], ["🆕", "nuevo", "novedad"], ["🆗", "ok", "vale"], ["🚫", "prohibido", "no"],
    ["♻️", "reciclar", "reutilizar"], ["©️", "copyright", "derechos"], ["™️", "marca registrada", "tm"]
  ] },
  { name: "Celebración y objetos", items: [
    ["🎂", "tarta", "cumpleaños"], ["🎁", "regalo", "sorpresa"], ["🎈", "globo", "fiesta"], ["🏆", "trofeo", "premio ganar"],
    ["🥇", "medalla de oro", "primero ganador"], ["🎯", "diana", "objetivo meta"], ["🧩", "pieza", "puzle encajar"],
    ["☕", "café", "descanso pausa"], ["🍕", "pizza", "comida"], ["🥂", "brindis", "celebrar copas"], ["🍀", "trébol", "suerte"],
    ["🎶", "música", "notas"], ["📷", "cámara", "foto"], ["✈️", "avión", "viaje vuelo"], ["🚗", "coche", "viaje"],
    ["🏠", "casa", "hogar"], ["🌍", "mundo", "planeta global internacional"]
  ] },
  { name: "Naturaleza y tiempo", items: [
    ["☀️", "sol", "buen tiempo"], ["🌤️", "sol y nubes", "tiempo"], ["🌧️", "lluvia", "tiempo"], ["❄️", "nieve", "frío invierno"],
    ["🌈", "arcoíris", "colores"], ["🌸", "flor", "primavera"], ["🌻", "girasol", "verano"], ["🍂", "otoño", "hojas"],
    ["🌱", "brote", "crecer nuevo"], ["🌙", "luna", "noche"], ["⚡", "rayo", "rápido energía"], ["🌊", "ola", "mar"]
  ] }
];

const EMOJI_COLS = 8;
const EMOJI_RECENT_MAX = 16;
const foldText = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Estilos del selector: una sola hoja por documento. Colores del sistema (Canvas/CanvasText),
// que siguen el esquema claro u oscuro del contenedor.
const EMOJI_CSS =
  ".ct-emoji{position:absolute;z-index:30;width:" + (EMOJI_COLS * 34 + 18) + "px;max-height:320px;display:flex;flex-direction:column;" +
  "background:Canvas;color:CanvasText;border:1px solid color-mix(in srgb,CanvasText 25%,transparent);border-radius:10px;" +
  "box-shadow:0 6px 18px rgba(0,0,0,.22);font:13px system-ui,sans-serif;}" +
  ".ct-emoji[hidden]{display:none;}" +
  ".ct-emoji input{margin:8px;padding:6px 8px;font:inherit;color:inherit;background:transparent;" +
  "border:1px solid color-mix(in srgb,CanvasText 30%,transparent);border-radius:6px;}" +
  ".ct-emoji .ct-emoji-list{overflow:auto;padding:0 8px 8px;}" +
  ".ct-emoji h3{font:600 11px system-ui,sans-serif;margin:8px 2px 4px;opacity:.85;text-transform:uppercase;letter-spacing:.03em;}" +
  ".ct-emoji .ct-emoji-grid{display:grid;grid-template-columns:repeat(" + EMOJI_COLS + ",32px);gap:2px;}" +
  ".ct-emoji .ct-emoji-grid button{width:32px;height:32px;padding:0;font-size:20px;line-height:1;border:0;border-radius:6px;" +
  "background:transparent;cursor:pointer;font-family:'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif;}" +
  ".ct-emoji .ct-emoji-grid button:hover,.ct-emoji .ct-emoji-grid button:focus-visible{background:color-mix(in srgb,CanvasText 14%,transparent);" +
  "outline:2px solid #4493f8;outline-offset:-2px;}" +
  ".ct-emoji .ct-emoji-empty{padding:8px 2px;opacity:.85;}";

function ensureEmojiStyle(doc) {
  if (doc.getElementById("ct-emoji-style")) return;
  const st = doc.createElement("style");
  st.id = "ct-emoji-style";
  st.textContent = EMOJI_CSS;
  (doc.head || doc.documentElement).appendChild(st);
}

// Crea el selector. opts: { onPick(emoji), onClose(), getRecent() → Promise<string[]>, saveRecent(list) }.
// Devuelve { el, open(), close(), isOpen() }; el se coloca donde decida quien lo usa.
function createEmojiPicker(opts) {
  const o = opts || {};
  const doc = document;
  ensureEmojiStyle(doc);
  const el = doc.createElement("div");
  el.className = "ct-emoji";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Insertar emoji");
  el.contentEditable = "false";
  const search = doc.createElement("input");
  search.type = "search";
  search.placeholder = "Buscar: gracias, reunión, ok…";
  search.setAttribute("aria-label", "Buscar emoji");
  const list = doc.createElement("div");
  list.className = "ct-emoji-list";
  el.append(search, list);
  let recent = [];
  const all = EMOJI_GROUPS.flatMap((g) => g.items);
  const byChar = new Map(all.map((it) => [it[0], it]));

  const button = (it) => {
    const b = doc.createElement("button");
    b.type = "button";
    b.textContent = it[0];
    b.title = it[1];
    b.setAttribute("aria-label", it[1]);
    b.tabIndex = -1;
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => pick(it[0]));
    return b;
  };
  const section = (title, items) => {
    if (!items.length) return [];
    const h = doc.createElement("h3");
    h.textContent = title;
    const grid = doc.createElement("div");
    grid.className = "ct-emoji-grid";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", title);
    for (const it of items) grid.appendChild(button(it));
    return [h, grid];
  };
  const render = () => {
    const q = foldText(search.value.trim());
    const parts = [];
    if (q) {
      const hits = all.filter((it) => foldText(it[1] + " " + it[2]).includes(q));
      parts.push(...section("Resultados", hits));
      if (!hits.length) {
        const p = doc.createElement("div");
        p.className = "ct-emoji-empty";
        p.textContent = "Ningún emoji con «" + search.value.trim() + "».";
        parts.push(p);
      }
    } else {
      parts.push(...section("Recientes", recent.map((c) => byChar.get(c) || [c, c, ""])));
      for (const g of EMOJI_GROUPS) parts.push(...section(g.name, g.items));
    }
    list.replaceChildren(...parts);
  };
  const buttons = () => Array.from(list.querySelectorAll(".ct-emoji-grid button"));

  function pick(ch) {
    recent = [ch, ...recent.filter((c) => c !== ch)].slice(0, EMOJI_RECENT_MAX);
    if (o.saveRecent) o.saveRecent(recent);
    close();
    if (o.onPick) o.onPick(ch);
  }
  function open() {
    el.hidden = false;
    search.value = "";
    Promise.resolve(o.getRecent ? o.getRecent() : []).then((r) => { recent = Array.isArray(r) ? r : []; render(); }).catch(render);
    render();
    search.focus();
  }
  function close() {
    if (el.hidden) return;
    el.hidden = true;
    if (o.onClose) o.onClose();
  }

  search.addEventListener("input", render);
  // Teclado: flecha abajo/Enter desde la búsqueda va al primer emoji; las flechas recorren la
  // rejilla (8 columnas, dentro de cada grupo por orden); Enter inserta; Escape cierra.
  el.addEventListener("keydown", (e) => {
    const bs = buttons();
    const i = bs.indexOf(e.target);
    let next = null;
    if (e.target === search) {
      if ((e.key === "ArrowDown" || e.key === "Enter") && bs.length) next = 0;
    } else if (i >= 0) {
      next = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + EMOJI_COLS, ArrowUp: i - EMOJI_COLS, Home: 0, End: bs.length - 1 }[e.key];
      if (e.key === "ArrowUp" && i < EMOJI_COLS) { e.preventDefault(); e.stopPropagation(); search.focus(); return; }
    }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (next === null || next === undefined) {
      if (e.key !== "Tab") e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    bs[Math.max(0, Math.min(bs.length - 1, next))].focus();
  });

  return { el, open, close, isOpen: () => !el.hidden };
}

if (typeof module !== "undefined" && module.exports) module.exports = { EMOJI_GROUPS, foldText };
