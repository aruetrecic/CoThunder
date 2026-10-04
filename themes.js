"use strict";
// themes.js — temas de correo de CoThunder (CSS de cada preset). Fichero compartido:
// lo cargan el compose script (antes de content-compose.js, mismo scope) y la página de
// Opciones, para que el CSS de cada tema exista una sola vez.

// Preset corporativo UPO: CSS completo de docs/screenshots/upo.css (verbatim),
// ya escrito con selectores ".markdown-here-wrapper ..." — se aplica tal cual.
const UPO_CSS = `/*
 * Markdown Here – Tema corporativo UPO
 * Colores:
 * Amarillo UPO: #FCC100
 * Azul UPO: #003772
 * Enfoque: documento limpio, profesional, apto para email
 */

.markdown-here-wrapper {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  font-size: 14.5px;
  line-height: 1.6;
  color: #1f2937;
}

/* Enlaces */
.markdown-here-wrapper a {
  color: #003772;
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* Párrafos */
.markdown-here-wrapper p {
  margin: 0 0 1.1em 0 !important;
}

/* Separación bloques */
.markdown-here-wrapper table,
.markdown-here-wrapper pre,
.markdown-here-wrapper dl,
.markdown-here-wrapper blockquote,
.markdown-here-wrapper ul,
.markdown-here-wrapper ol,
.markdown-here-wrapper hr {
  margin: 1.1em 0;
}

/* Títulos */
.markdown-here-wrapper h1,
.markdown-here-wrapper h2,
.markdown-here-wrapper h3,
.markdown-here-wrapper h4,
.markdown-here-wrapper h5,
.markdown-here-wrapper h6 {
  margin: 1.3em 0 0.6em;
  font-weight: 700;
  line-height: 1.25;
  color: #003772;
}

.markdown-here-wrapper h1 {
  font-size: 1.7em;
  padding-bottom: 0.3em;
  border-bottom: 3px solid #FCC100;
}

.markdown-here-wrapper h2 {
  font-size: 1.4em;
  padding-bottom: 0.25em;
  border-bottom: 2px solid #003772;
}

.markdown-here-wrapper h3 { font-size: 1.2em; }
.markdown-here-wrapper h4 { font-size: 1.05em; }
.markdown-here-wrapper h5 { font-size: 1em; }
.markdown-here-wrapper h6 { font-size: 0.95em; color: #4b5563; }

/* Listas */
.markdown-here-wrapper ul,
.markdown-here-wrapper ol {
  padding-left: 1.6em;
}

.markdown-here-wrapper li {
  margin: 0.35em 0;
}

.markdown-here-wrapper li p {
  margin: 0.35em 0 !important;
}

/* Línea horizontal */
.markdown-here-wrapper hr {
  border: 0;
  border-top: 1px solid #003772;
  opacity: 0.2;
}

/* Citas */
.markdown-here-wrapper blockquote {
  margin: 1.2em 0;
  padding: 0.4em 0.8em;
  background: #f5f9fc;
  border-left: 5px solid #003772;
  color: #374151;
}

.markdown-here-wrapper blockquote blockquote {
  border-left-color: #FCC100;
  background: #fff9e6;
}

/* Código inline */
.markdown-here-wrapper code {
  margin: 0 0.15em;
  padding: 0.15em 0.35em;
  font-size: 0.95em;
  font-weight: 600;
  background-color: #fff4cc;
  border: 1px solid #FCC100;
  border-radius: 6px;
  white-space: pre-wrap;
  font-family: Consolas, Menlo, Monaco, monospace;
}

/* Bloques de código */
.markdown-here-wrapper pre {
  font-size: 0.95em;
  line-height: 1.45;
  background: #003772;
}

.markdown-here-wrapper pre code {
  display: block;
  padding: 0.9em 1em;
  white-space: pre;
  overflow: auto;
  background: #003772;
  color: #ffffff;
  border: 2px solid #FCC100;
  border-radius: 10px;
  font-weight: 500;
}

/* Tablas */
.markdown-here-wrapper table {
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #003772;
  font-size: 0.98em;
}

.markdown-here-wrapper table th,
.markdown-here-wrapper table td {
  border: 1px solid #d1d5db;
  padding: 0.55em 0.75em;
  vertical-align: top;
}

.markdown-here-wrapper table th {
  background: #003772;
  color: #ffffff;
  font-weight: 700;
}

.markdown-here-wrapper table tr:nth-child(even) td {
  background: #f9fafb;
}

/* Definiciones */
.markdown-here-wrapper dl dt {
  font-weight: 700;
  color: #003772;
}

.markdown-here-wrapper dl dd {
  margin: 0.3em 0 0.9em;
  padding-left: 0.8em;
}

/* Imágenes */
.markdown-here-wrapper img {
  max-width: 100%;
  height: auto;
  border: 0;
}

/* Checkboxes */
.markdown-here-wrapper input[type="checkbox"] {
  margin-right: 0.4em;
  vertical-align: middle;
}

/* Resaltado de sintaxis, legible sobre el fondo #003772 de los bloques de código */
.markdown-here-wrapper .cthl-comment { color: #9fb6cf; }
.markdown-here-wrapper .cthl-string { color: #ffd479; }
.markdown-here-wrapper .cthl-number { color: #8be9fd; }
.markdown-here-wrapper .cthl-keyword { color: #fcc100; }

/* Resaltado de texto (==marca==) y admonitions (cajas ¡NOTA!/tip/etc.) */
.markdown-here-wrapper .cothunder-mark { background-color: #FCC100; color: #1f2937; }
.markdown-here-wrapper .cothunder-adm-note, .markdown-here-wrapper .cothunder-adm-tip, .markdown-here-wrapper .cothunder-adm-important, .markdown-here-wrapper .cothunder-adm-warning, .markdown-here-wrapper .cothunder-adm-caution { background: #f5f9fc; color: #374151; }
`;

// Genera el CSS de un tema "famoso" a partir de una paleta de colores, con
// el MISMO juego de selectores (prefijo ".markdown-here-wrapper", igual que
// upo.css) para que todos cubran los mismos elementos de forma consistente.
// "accent" es el color del borde inferior de h1/h2; "border" es el color de
// los bordes de tabla/celdas (en algunos temas oscuros difieren de "accent").
function buildThemeCss(p) {
  const markCss = p.markText
    ? "color: " + p.markText + "; background-color: " + p.mark + ";"
    : "background-color: " + p.mark + ";";
  return [
    ".markdown-here-wrapper { background: " + p.bg + "; color: " + p.text +
      "; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Arial, sans-serif; line-height: 1.6; }",
    ".markdown-here-wrapper a { color: " + p.link + "; }",
    ".markdown-here-wrapper h1, .markdown-here-wrapper h2, .markdown-here-wrapper h3, " +
      ".markdown-here-wrapper h4, .markdown-here-wrapper h5, .markdown-here-wrapper h6 { color: " + p.headings + "; }",
    ".markdown-here-wrapper h1 { border-bottom: 3px solid " + p.accent + "; padding-bottom: 0.3em; }",
    ".markdown-here-wrapper h2 { border-bottom: 2px solid " + p.accent + "; padding-bottom: 0.25em; }",
    ".markdown-here-wrapper blockquote { border-left: 4px solid " + p.bqBorder + "; background: " + p.bqBg +
      "; color: " + p.bqText + "; padding: 0.4em 0.8em; }",
    ".markdown-here-wrapper code { background-color: " + p.codeBg + "; color: " + p.codeText +
      "; border: 1px solid " + p.codeBorder + "; border-radius: 4px; padding: 0.15em 0.35em; " +
      "font-family: Consolas, Menlo, Monaco, monospace; }",
    ".markdown-here-wrapper pre { background: " + p.preBg + "; }",
    ".markdown-here-wrapper pre code { display: block; background: " + p.preBg + "; color: " + p.preText +
      "; padding: 0.9em 1em; border-radius: 8px; white-space: pre; overflow: auto; }",
    ".markdown-here-wrapper table { border-collapse: collapse; border: 1px solid " + p.border + "; width: 100%; }",
    ".markdown-here-wrapper th, .markdown-here-wrapper td { border: 1px solid " + p.border + "; padding: 0.5em 0.75em; }",
    ".markdown-here-wrapper th { background: " + p.thBg + "; color: " + p.thText + "; }",
    ".markdown-here-wrapper tr:nth-child(even) td { background: " + p.evenRow + "; }",
    ".markdown-here-wrapper hr { border: 0; border-top: 2px solid " + p.hr + "; }",
    ".markdown-here-wrapper p { margin: 0 0 1.1em; }",
    ".markdown-here-wrapper ul, .markdown-here-wrapper ol { padding-left: 1.6em; }",
    ".markdown-here-wrapper li { margin: 0.35em 0; }",
    ".markdown-here-wrapper dl dt { font-weight: 700; color: " + p.headings + "; }",
    ".markdown-here-wrapper dl dd { margin: 0.3em 0 0.9em; padding-left: 0.8em; }",
    ".markdown-here-wrapper img { max-width: 100%; height: auto; }",
    ".markdown-here-wrapper mark { " + markCss + " }",
    ".markdown-here-wrapper .cothunder-mark { background-color: " + p.mark + "; color: " + p.markText + "; }",
    ".markdown-here-wrapper .cothunder-adm-note, .markdown-here-wrapper .cothunder-adm-tip, " +
      ".markdown-here-wrapper .cothunder-adm-important, .markdown-here-wrapper .cothunder-adm-warning, " +
      ".markdown-here-wrapper .cothunder-adm-caution { background: " + p.admBg + "; color: " + p.admText + "; }",
    ".markdown-here-wrapper .cthl-comment { color: " + p.hlComment + "; }",
    ".markdown-here-wrapper .cthl-string { color: " + p.hlString + "; }",
    ".markdown-here-wrapper .cthl-number { color: " + p.hlNumber + "; }",
    ".markdown-here-wrapper .cthl-keyword { color: " + p.hlKeyword + "; }",
  ].join("\n");
}

// Paletas de los temas "famosos" (claro/oscuro), un color por elemento.
const THEME_PALETTES = [
  { id: "github-light", name: "GitHub (claro)",
    bg: "#ffffff", text: "#1f2328", headings: "#1f2328", accent: "#d0d7de", link: "#0969da",
    codeBg: "#f6f8fa", codeText: "#1f2328", codeBorder: "#d0d7de",
    preBg: "#f6f8fa", preText: "#1f2328",
    bqBorder: "#d0d7de", bqBg: "#f6f8fa", bqText: "#57606a",
    border: "#d0d7de", thBg: "#f6f8fa", thText: "#1f2328", evenRow: "#f6f8fa",
    hr: "#d0d7de", mark: "#fff8c5", markText: "#1f2328",
    hlComment: "#6e7781", hlString: "#0a3069", hlNumber: "#0550ae", hlKeyword: "#cf222e",
    admBg: "#f6f8fa", admText: "#1f2328" },
  { id: "github-dark", name: "GitHub (oscuro)",
    bg: "#0d1117", text: "#c9d1d9", headings: "#e6edf3", accent: "#30363d", link: "#2f81f7",
    codeBg: "#161b22", codeText: "#c9d1d9", codeBorder: "#30363d",
    preBg: "#161b22", preText: "#c9d1d9",
    bqBorder: "#30363d", bqBg: "#161b22", bqText: "#8b949e",
    border: "#30363d", thBg: "#161b22", thText: "#e6edf3", evenRow: "#161b22",
    hr: "#30363d", mark: "#92650a", markText: "#ffffff",
    hlComment: "#8b949e", hlString: "#a5d6ff", hlNumber: "#79c0ff", hlKeyword: "#ff7b72",
    admBg: "#161b22", admText: "#c9d1d9" },
  { id: "solarized-light", name: "Solarized (claro)",
    bg: "#fdf6e3", text: "#455a5f", headings: "#586e75", accent: "#93a1a1", link: "#268bd2",
    codeBg: "#eee8d5", codeText: "#455a5f", codeBorder: "#93a1a1",
    preBg: "#eee8d5", preText: "#455a5f",
    bqBorder: "#268bd2", bqBg: "#eee8d5", bqText: "#455a5f",
    border: "#93a1a1", thBg: "#1a6091", thText: "#fdf6e3", evenRow: "#eee8d5",
    hr: "#93a1a1", mark: "#b58900", markText: "#002b36",
    hlComment: "#6b7f80", hlString: "#0f6f66", hlNumber: "#d33682", hlKeyword: "#5f6b00",
    admBg: "#eee8d5", admText: "#073642" },
  { id: "solarized-dark", name: "Solarized (oscuro)",
    bg: "#002b36", text: "#93a1a1", headings: "#93a1a1", accent: "#073642", link: "#268bd2",
    codeBg: "#073642", codeText: "#93a1a1", codeBorder: "#586e75",
    preBg: "#073642", preText: "#93a1a1",
    bqBorder: "#268bd2", bqBg: "#073642", bqText: "#93a1a1",
    border: "#586e75", thBg: "#1a6091", thText: "#fdf6e3", evenRow: "#073642",
    hr: "#586e75", mark: "#b58900", markText: "#002b36",
    hlComment: "#6c8383", hlString: "#2aa198", hlNumber: "#e07fb0", hlKeyword: "#859900",
    admBg: "#073642", admText: "#93a1a1" },
  { id: "monokai", name: "Monokai (oscuro)",
    bg: "#272822", text: "#f8f8f2", headings: "#a6e22e", accent: "#f92672", link: "#66d9ef",
    codeBg: "#3e3d32", codeText: "#f8f8f2", codeBorder: "#75715e",
    preBg: "#1e1f1c", preText: "#f8f8f2",
    bqBorder: "#fd971f", bqBg: "#3e3d32", bqText: "#cfcfc2",
    border: "#75715e", thBg: "#b81750", thText: "#ffffff", evenRow: "#3e3d32",
    hr: "#75715e", mark: "#e6db74", markText: "#272822",
    hlComment: "#75715e", hlString: "#e6db74", hlNumber: "#ae81ff", hlKeyword: "#f92672",
    admBg: "#3e3d32", admText: "#f8f8f2" },
  { id: "dracula", name: "Dracula (oscuro)",
    bg: "#282a36", text: "#f8f8f2", headings: "#bd93f9", accent: "#ff79c6", link: "#8be9fd",
    codeBg: "#44475a", codeText: "#f8f8f2", codeBorder: "#6272a4",
    preBg: "#21222c", preText: "#f8f8f2",
    bqBorder: "#ff79c6", bqBg: "#44475a", bqText: "#f8f8f2",
    border: "#6272a4", thBg: "#bd93f9", thText: "#282a36", evenRow: "#44475a",
    hr: "#6272a4", mark: "#f1fa8c", markText: "#282a36",
    hlComment: "#6272a4", hlString: "#f1fa8c", hlNumber: "#bd93f9", hlKeyword: "#ff79c6",
    admBg: "#44475a", admText: "#f8f8f2" },
  { id: "nord", name: "Nord (oscuro)",
    bg: "#2e3440", text: "#d8dee9", headings: "#88c0d0", accent: "#5e81ac", link: "#88c0d0",
    codeBg: "#3b4252", codeText: "#eceff4", codeBorder: "#4c566a",
    preBg: "#3b4252", preText: "#eceff4",
    bqBorder: "#5e81ac", bqBg: "#3b4252", bqText: "#d8dee9",
    border: "#4c566a", thBg: "#4c6a8f", thText: "#eceff4", evenRow: "#3b4252",
    hr: "#4c566a", mark: "#ebcb8b", markText: "#2e3440",
    hlComment: "#8290ad", hlString: "#a3be8c", hlNumber: "#b48ead", hlKeyword: "#81a1c1",
    admBg: "#3b4252", admText: "#d8dee9" },
  { id: "onedark", name: "One Dark (oscuro)",
    bg: "#282c34", text: "#abb2bf", headings: "#61afef", accent: "#3e4451", link: "#61afef",
    codeBg: "#3e4451", codeText: "#abb2bf", codeBorder: "#5c6370",
    preBg: "#21252b", preText: "#abb2bf",
    bqBorder: "#c678dd", bqBg: "#3e4451", bqText: "#abb2bf",
    border: "#5c6370", thBg: "#61afef", thText: "#282c34", evenRow: "#2c313a",
    hr: "#3e4451", mark: "#e5c07b", markText: "#282c34",
    hlComment: "#6b7689", hlString: "#98c379", hlNumber: "#d19a66", hlKeyword: "#c678dd",
    admBg: "#3e4451", admText: "#abb2bf" },
  { id: "upo-light", name: "UPO claro",
    bg: "#ffffff", text: "#1f2937", headings: "#003772", accent: "#FCC100", link: "#003772",
    codeBg: "#fff4cc", codeText: "#663c00", codeBorder: "#FCC100",
    preBg: "#f5f9fc", preText: "#1f2937",
    bqBorder: "#003772", bqBg: "#f5f9fc", bqText: "#374151",
    border: "#d1d5db", thBg: "#003772", thText: "#ffffff", evenRow: "#f5f9fc",
    hr: "#003772", mark: "#FCC100", markText: "#1f2937",
    hlComment: "#6e7781", hlString: "#0a3069", hlNumber: "#0550ae", hlKeyword: "#cf222e",
    admBg: "#f5f9fc", admText: "#374151" },
  { id: "upo-dark", name: "UPO oscuro",
    bg: "#001a33", text: "#dce7f0", headings: "#FCC100", accent: "#FCC100", link: "#7dc4f0",
    codeBg: "#002b4d", codeText: "#ffe9a8", codeBorder: "#FCC100",
    preBg: "#00284a", preText: "#e6eef5",
    bqBorder: "#FCC100", bqBg: "#002b4d", bqText: "#cbd8e5",
    border: "#24557f", thBg: "#003772", thText: "#ffffff", evenRow: "#002b4d",
    hr: "#FCC100", mark: "#FCC100", markText: "#1f2937",
    hlComment: "#7f9cb5", hlString: "#ffd479", hlNumber: "#8be9fd", hlKeyword: "#FCC100",
    admBg: "#002b4d", admText: "#dce7f0" },
  { id: "upo-mixed", name: "UPO mixto",
    bg: "#ffffff", text: "#1f2937", headings: "#003772", accent: "#FCC100", link: "#003772",
    codeBg: "#fff4cc", codeText: "#663c00", codeBorder: "#FCC100",
    preBg: "#003772", preText: "#ffffff",
    bqBorder: "#003772", bqBg: "#f5f9fc", bqText: "#374151",
    border: "#d1d5db", thBg: "#003772", thText: "#ffffff", evenRow: "#f5f9fc",
    hr: "#003772", mark: "#FCC100", markText: "#1f2937",
    hlComment: "#9fb6cf", hlString: "#ffd479", hlNumber: "#8be9fd", hlKeyword: "#FCC100",
    admBg: "#f5f9fc", admText: "#374151" },
];

// Lista de presets: { id (valor guardado en Opciones), name (español), css }. La usan el
// compose script (para aplicar el tema) y Opciones (para descargar/editar cualquier tema).
const EMAIL_THEME_PRESETS = [
  { id: "default", name: "Por defecto", css: "" },
  { id: "upo", name: "UPO corporativo", css: UPO_CSS },
].concat(THEME_PALETTES.map((p) => ({ id: p.id, name: p.name, css: buildThemeCss(p) })));
