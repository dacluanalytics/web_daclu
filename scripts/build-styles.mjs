import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const root = '/Users/esteban/Documents/DACLu/Pagina web';
const pages = [
  ['index.html', 'home'],
  ['servicios.html', 'servicios'],
  ['notas.html', 'notas'],
  ['nota-punto-de-reorden.html', 'article'],
  ['politica-de-datos.html', 'policy'],
];

const renames = {
  'index.html': [
    [/\.card(?![\w-])/g, '.ring-card'],
    [/\.stage(?![\w-])/g, '.hero-stage'],
  ],
  'notas.html': [
    [/\.card(?![\w-])/g, '.note-card'],
    [/\.stage(?![\w-])/g, '.notes-stage'],
    [/\.grid(?![\w-])/g, '.notes-grid'],
  ],
  'servicios.html': [
    [/\.grid(?![\w-])/g, '.svc-grid'],
    [/\.sheet(?![\w-])/g, '.paper-sheet'],
    [/\.flow(?![\w-])/g, '.svc-flow'],
  ],
  'nota-punto-de-reorden.html': [[/\.sheet(?![\w-])/g, '.article-pad']],
  'politica-de-datos.html': [[/\.sheet(?![\w-])/g, '.article-pad']],
};

function extractCss(html) {
  return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
}
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}
function parseDecls(body) {
  const parts = [];
  let s = '';
  let str = null;
  let depth = 0;
  for (let k = 0; k < body.length; k++) {
    const c = body[k];
    if (str) {
      s += c;
      if (c === '\\') { s += body[++k] || ''; continue; }
      if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'") { str = c; s += c; continue; }
    if (c === '(') { depth++; s += c; continue; }
    if (c === ')') { depth--; s += c; continue; }
    if (c === ';' && depth === 0) { parts.push(s); s = ''; continue; }
    s += c;
  }
  if (s.trim()) parts.push(s);
  const out = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t || t.startsWith('@')) continue;
    const idx = t.indexOf(':');
    if (idx < 0) continue;
    out.push([t.slice(0, idx).trim().toLowerCase(), t.slice(idx + 1).trim().replace(/\s+/g, ' ')]);
  }
  return out;
}
function parseCss(css) {
  css = stripComments(css);
  const rules = [];
  let i = 0;
  const len = css.length;
  function skip() { while (i < len && /\s/.test(css[i])) i++; }
  function parseList(context) {
    while (i < len) {
      skip();
      if (i >= len || css[i] === '}') return;
      const start = i;
      let depth = 0;
      let inStr = null;
      while (i < len) {
        const c = css[i];
        if (inStr) {
          if (c === '\\') { i += 2; continue; }
          if (c === inStr) inStr = null;
          i++;
          continue;
        }
        if (c === '"' || c === "'") { inStr = c; i++; continue; }
        if (c === '(') { depth++; i++; continue; }
        if (c === ')') { depth--; i++; continue; }
        if (depth === 0 && (c === '{' || c === ';' || c === '}')) break;
        i++;
      }
      const prelude = css.slice(start, i).trim();
      if (i >= len || css[i] === '}') return;
      if (css[i] === ';') { i++; continue; }
      i++;
      const bodyStart = i;
      let d = 1;
      let str = null;
      while (i < len && d > 0) {
        const c = css[i];
        if (str) {
          if (c === '\\') { i += 2; continue; }
          if (c === str) str = null;
          i++;
          continue;
        }
        if (c === '"' || c === "'") { str = c; i++; continue; }
        if (c === '{') d++;
        else if (c === '}') d--;
        if (d > 0) i++;
      }
      const body = css.slice(bodyStart, i);
      i++;
      const head = prelude;
      if (head.startsWith('@media') || head.startsWith('@supports')) {
        const end = bodyStart + body.length;
        const ctx = context.concat(head.replace(/\s+/g, ' '));
        i = bodyStart;
        parseList(ctx);
        i = end + 1;
      } else if (head.startsWith('@font-face')) {
        continue;
      } else if (head.startsWith('@keyframes') || head.startsWith('@-webkit-keyframes')) {
        rules.push({ kind: 'keyframes', name: head.replace(/@(-webkit-)?keyframes\s+/, '').trim(), body: body.trim(), context });
      } else if (!head.startsWith('@')) {
        rules.push({ kind: 'rule', context, selector: head.replace(/\s+/g, ' ').trim(), decls: parseDecls(body) });
      }
    }
  }
  parseList([]);
  return rules;
}

function renameSel(sel, file) {
  let out = sel;
  for (const [re, to] of renames[file] || []) out = out.replace(re, to);
  return out;
}
function isDead(part, file) {
  if (file === 'index.html') {
    if (/\.(bento|cell|c[1-6]|out|flow|rail|step|board|det)(?![\w-])/.test(part)) return true;
    if (/(^|[^\w-])\.li(?![\w-])/.test(part) && part.includes('.links')) return true;
  }
  if (file === 'notas.html') {
    if (/\.feat(?![\w-])/.test(part)) return true;
    if (/\.go(?![\w-])/.test(part)) return true;
    if (/\.mono(?![\w-])/.test(part)) return true;
    if (/\.sn(?![\w-])/.test(part)) return true;
    if (/\.hero(?![\w-])/.test(part)) return true;
    if (/\.hm(?![\w-])/.test(part)) return true;
  }
  if (file === 'servicios.html') {
    if (/\.hm(?![\w-])/.test(part)) return true;
    if (part.trim() === '.ic') return true;
  }
  return false;
}
function isHeader(sel) {
  return /^(nav\b|\.brand\b|\.links\b|\.menu\b|\.skip\b)/.test(sel);
}
function isRoot(sel) {
  return sel === ':root' || sel.startsWith(':root');
}
function dropDeadLonghands(decls) {
  const fontAt = decls.findIndex(([p]) => p === 'font');
  if (fontAt < 0) return decls;
  const killed = new Set(['font-style', 'font-variant', 'font-weight', 'font-stretch', 'font-size', 'line-height', 'font-family']);
  return decls.filter(([p], i) => i > fontAt || !killed.has(p));
}
function pillFix(sel, decls) {
  if (sel === '.pill span') {
    return decls.map(([p, v]) => [p, p === 'padding' && v === '0 34px' ? '0 30px' : v]);
  }
  return decls;
}
function mergeDecls(list) {
  const order = [];
  const vals = new Map();
  for (const decls of list) {
    for (const [p, v] of decls) {
      if (!vals.has(p)) order.push(p);
      else {
        order.splice(order.indexOf(p), 1);
        order.push(p);
      }
      vals.set(p, v);
    }
  }
  return order.map((p) => [p, vals.get(p)]);
}
function declKey(decls) {
  return decls.map(([p, v]) => `${p}:${v}`).join(';');
}
function bucket(sel) {
  const tests = [
    [/\.cvb\b/, 'components/detect.css'],
    [/\.pill-note\b|\.fmt\b|\.steps\b|(^|[^\w-])\.st\b|\.mk-|\.bars\b|(^|[^\w-])\.kp\b|(^|[^\w-])\.al\b|(^|[^\w-])\.ic\b|#como\b|\.how\b|\.stage-v\b/, 'sections/como.css'],
    [/\.paper-sheet\b/, 'components/sheet.css'],
    [/\.ring-card\b|\.ring\b|\.sec-head\b|\.nav3d\b|\.dots3d\b/, 'sections/sectores.css'],
    [/#story\b|\.pin\b|#gl\b|#hud\b|\.copy\b|\.hero-stage\b|\.ticks\b|\.scan\b/, 'sections/hero.css'],
    [/\.chips\b/, 'components/chips.css'],
    [/\.tagp\b|\.kick\b|\.eyebrow\b/, 'components/tag.css'],
    [/\.svc\b|\.svc-grid\b|\.svc-flow\b|\.xcard\b|\.xgrid\b|#extra\b|\.fl(?![\w-])|\.art\b|\.hero\b|\.morph\b|#contacto\b/, 'sections/servicios.css'],
    [/\.notes-stage\b|\.frame\b|\.mast\b|\.ttl\b|\.pager\b|(^|[^\w-])\.np\b|\.nx\b|(^|[^\w-])\.sc\b|(^|[^\w-])\.fc\b|\.shade\b|(^|[^\w-])\.bg\b|\.kk\b|\.mm\b|(^|[^\w-])\.au\b|\.cats\b|\.msrch\b|\.mcta\b|\.swap\b/, 'sections/notes-cover.css'],
    [/\.paper\b|\.note-card\b|\.notes-grid\b|\.feat-row\b|\.fs(?![\w-])|\.li(?![\w-])|\.tr(?![\w-])|\.sh(?![\w-])|\.fnav\b|\.fdots\b|\.lt(?![\w-])|\.soon|\.empty\b|\.notas-h\b|#lista\b|#chips\b|few-notes|\.tools\b|\.ctrl\b|\.srch\b|\.meta\b|\.tagp\b/, 'sections/notes-list.css'],
    [/\.article-pad\b|\.prose\b|^pre\b|^table\b|^th\b|^td\b|\.pedir\b|(^|[^\w-])\.by\b|\.addr\b|\.table-wrap\b/, 'sections/article.css'],
    [/#agendar\b|\.found\b|\.ask\b|\.cta\b|\.who\b|\.founder\b|\.safe\b|\.faq\b|#datos\b|#faq\b|#quien\b|\.eyebrow\b/, 'sections/home-rest.css'],
    [/(^|[^\w-])\.pill\b/, 'components/pill.css'],
    [/\.reveal\b/, 'components/reveal.css'],
    [/^footer\b|\.fcon\b|\.legal\b/, 'components/footer.css'],
    [/^\.kick\b|\.tag\b/, 'components/tag.css'],
    [/^\.wrap\b|^section\.s\b|^main\b/, 'layout.css'],
    [/^\.display\b|^\.h\b|^\.lead\b|^\*$|^a$|^body\b|^:focus-visible\b|^html\b/, 'base.css'],
  ];
  for (const [re, file] of tests) if (re.test(sel)) return file;
  return 'sections/misc.css';
}

const dropped = [];
const collected = [];
const keyframes = [];
let order = 0;

for (const [file] of pages) {
  const html = execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' });
  const parsed = parseCss(extractCss(html));
  for (const rule of parsed) {
    if (rule.kind === 'keyframes') {
      keyframes.push({ ...rule, file, order: order++ });
      continue;
    }
    const selector = renameSel(rule.selector, file);
    const parts = selector.split(',').map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (isRoot(part)) continue;
      if (isDead(part, file)) { dropped.push(`${file} ${part}`); continue; }
      if (isHeader(part)) continue;
      const decls = dropDeadLonghands(pillFix(part, rule.decls));
      if (!decls.length) continue;
      collected.push({ file, selector: part, context: rule.context.join(' || '), decls, order: order++ });
    }
  }
}

const merged = collected;

const kfNorm = new Map();
for (const kf of keyframes) {
  if (!kfNorm.has(kf.name)) kfNorm.set(kf.name, []);
  kfNorm.get(kf.name).push(kf);
}
const kfRename = new Map();
for (const [name, list] of kfNorm) {
  const bodies = new Set(list.map((k) => k.body.replace(/\s+/g, ' ')));
  if (bodies.size === 1) continue;
  for (const kf of list) {
    const alias = { 'index.html': 'hero', 'servicios.html': 'svc', 'notas.html': 'notes' }[kf.file] || kf.file;
    kfRename.set(`${kf.file}:${name}`, `${alias}-${name}`);
  }
}
function renameAnim(file, value) {
  let out = value;
  for (const [key, name] of kfRename) {
    const [kfFile, oldName] = key.split(':');
    if (kfFile !== file) continue;
    out = out.replace(new RegExp(`(^|[^\\w-])${oldName}(?![\\w-])`, 'g'), `$1${name}`);
  }
  return out;
}
for (const rule of merged) {
  rule.decls = rule.decls.map(([p, v]) => [p, renameAnim(rule.file, v)]);
}

const cross = new Map();
for (const rule of merged) {
  const k = `${rule.context}${rule.selector}`;
  if (!cross.has(k)) cross.set(k, []);
  cross.get(k).push(rule);
}

const emitted = [];
for (const group of cross.values()) {
  const variants = new Map();
  for (const rule of group) {
    const key = declKey(rule.decls);
    if (!variants.has(key)) variants.set(key, []);
    variants.get(key).push(rule);
  }
  const pageFiles = new Set(group.map((r) => r.file));
  const shared = variants.size === 1 && pageFiles.size === pages.length;
  if (shared) {
    const rule = group[0];
    emitted.push({ ...rule, selector: rule.selector, origin: rule.selector, scoped: false, order: Math.max(...group.map((r) => r.order)) });
  } else {
    for (const rules of variants.values()) {
      const classes = [...new Set(rules.map((r) => pages.find((p) => p[0] === r.file)[1]))];
      const sel = rules[0].selector;
      const scoped = classes.map((c) => scopeSel(sel, c)).join(',\n');
      emitted.push({ ...rules[0], selector: scoped, origin: rules[0].selector, scoped: true, order: Math.max(...rules.map((r) => r.order)) });
    }
  }
}

function scopeSel(sel, c) {
  if (sel === 'body') return `body.${c}`;
  if (sel.startsWith('body')) return sel.replace(/^body/, `body.${c}`);
  if (/^(html|:root)\b/.test(sel)) return sel.replace(/^(html|:root)((?:\.[^\s{]+)?)/, `$1$2 body.${c}`);
  return `:where(body.${c}) ${sel}`;
}
function fmtDecls(decls, pad) {
  return decls.map(([p, v]) => `${pad}${p}: ${v};`).join('\n');
}
function fmtRule(rule) {
  const body = fmtDecls(rule.decls, rule.context ? '    ' : '  ');
  const sel = rule.selector;
  if (!rule.context) return `${sel} {\n${body}\n}\n`;
  const media = rule.context.split(' || ');
  let block = `${'  '.repeat(media.length)}${sel} {\n${fmtDecls(rule.decls, '  '.repeat(media.length + 1))}\n${'  '.repeat(media.length)}}`;
  for (let n = media.length - 1; n >= 0; n--) {
    const indent = '  '.repeat(n);
    block = `${indent}${media[n]} {\n${block}\n${indent}}`;
  }
  return `${block}\n`;
}

const files = new Map();
function add(file, text, order) {
  if (!files.has(file)) files.set(file, []);
  files.get(file).push({ text, order });
}
for (const rule of emitted) {
  const file = bucket(rule.origin || rule.selector);
  add(file, fmtRule(rule), rule.order);
}

const kfOut = new Map();
for (const kf of keyframes) {
  const name = kfRename.get(`${kf.file}:${kf.name}`) || kf.name;
  const css = `@keyframes ${name} {\n  ${kf.body.replace(/\s+/g, ' ')}\n}\n`;
  const id = `${name}:${kf.body.replace(/\s+/g, ' ')}`;
  if (kfOut.has(id)) continue;
  const users = merged.filter((r) => r.decls.some(([, v]) => new RegExp(`(^|[^\\w-])${name}(?![\\w-])`).test(v)));
  const file = users.length ? bucket(users[0].selector) : 'sections/hero.css';
  kfOut.set(id, true);
  add(file, css, kf.order);
}

const header = `nav {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 20;
  height: 76px;
  display: flex;
  align-items: center;
  transition: background-color 300ms ease;
}

nav.solid {
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

nav .wrap {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  font-family: Anton, sans-serif;
  font-size: 24px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.brand svg {
  width: 30px;
  height: 30px;
}

.links {
  display: flex;
  gap: 36px;
  font-size: 15px;
  color: var(--ink-2);
}

.links a {
  text-decoration: none;
  transition: color 200ms ease;
}

.links a[aria-current="page"] {
  color: var(--ink);
}

.links a[aria-current="page"]::after {
  content: "";
  display: block;
  height: 2px;
  background: var(--acc);
  border-radius: 2px;
  margin-top: 4px;
}

@media (hover: hover) and (pointer: fine) {
  .links a:hover {
    color: var(--ink);
  }
}

.menu {
  display: none;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ink);
  box-shadow: inset 0 0 0 1.5px var(--line);
  place-items: center;
  align-content: center;
  gap: 5px;
  cursor: pointer;
}

.menu span {
  display: block;
  width: 16px;
  height: 1.5px;
  background: currentcolor;
  border-radius: 1px;
}

.skip {
  position: absolute;
  left: -999px;
  top: 8px;
  background: var(--acc);
  color: var(--on-acc);
  padding: 8px 14px;
  border-radius: 999px;
  z-index: 50;
}

.skip:focus {
  left: 16px;
}

@media (max-width: 900px) {
  nav {
    right: auto;
    width: 100vw;
  }

  .menu {
    display: grid;
  }

  .links {
    display: none;
    position: absolute;
    top: 76px;
    left: 0;
    right: 0;
    flex-direction: column;
    gap: 0;
    padding: 8px var(--gutter) 20px;
    background: color-mix(in srgb, var(--bg) 94%, transparent);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  .links.open {
    display: flex;
  }

  .links a {
    padding: 14px 0;
    font-size: 18px;
    border-bottom: 1px solid var(--line);
  }
}
`;

const tokens = `:root {
  --bg: #070809;
  --bg-2: #121417;
  --bg-3: #191b1f;
  --ink: #ededea;
  --ink-2: #8e9196;
  --line: rgba(237, 237, 234, 0.12);
  --acc: #ffb000;
  --acc-ink: #ffb000;
  --on-acc: #14110a;
  --paper: #edede8;
  --paper-2: #f4f4f0;
  --ink-dark: #0e0f11;
  --white: #fff;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --dur-fast: 160ms;
  --dur: 300ms;
  --dur-slow: 700ms;
  --r: 18px;
  --gutter: 40px;
  --panel-inset: 16px;
  --shadow-card: 0 30px 70px rgba(14, 15, 17, 0.12);
}

@media (max-width: 900px) {
  :root {
    --gutter: 16px;
    --panel-inset: 8px;
  }
}
`;

const fonts = `@font-face {
  font-family: PhFill;
  src: url("/assets/fonts/phosphor-fill.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: block;
}
`;

const known = new Map([
  ['#070809', 'var(--bg)'],
  ['#121417', 'var(--bg-2)'],
  ['#191b1f', 'var(--bg-3)'],
  ['#ededea', 'var(--ink)'],
  ['#8e9196', 'var(--ink-2)'],
  ['#ffb000', 'var(--acc)'],
  ['#14110a', 'var(--on-acc)'],
  ['#edede8', 'var(--paper)'],
  ['#f4f4f0', 'var(--paper-2)'],
  ['#0e0f11', 'var(--ink-dark)'],
  ['#ffffff', 'var(--white)'],
  ['#fff', 'var(--white)'],
]);

function mapHex(hex) {
  const low = hex.toLowerCase();
  const full = low.length === 4 ? `#${low[1]}${low[1]}${low[2]}${low[2]}${low[3]}${low[3]}` : low;
  return known.get(low) || known.get(full) || low;
}
function swapKnown(css) {
  const flipped = new Set(['var(--ink)', 'var(--ink-2)', 'var(--bg-2)', 'var(--bg-3)']);
  return css.replace(/([^{}]+)\{([^{}]*)\}/g, (block, sel, body) => {
    const insidePaper = /\.paper\b/.test(sel);
    const next = body.replace(/#[0-9a-fA-F]{3,8}\b/g, (hex) => {
      const mapped = mapHex(hex);
      if (insidePaper && flipped.has(mapped)) return hex.toLowerCase();
      return mapped;
    });
    return `${sel}{${next}}`;
  });
}

const outRoot = path.join(root, 'styles');
fs.rmSync(outRoot, { recursive: true, force: true });
const written = [];
function write(rel, css) {
  const abs = path.join(outRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const body = rel === 'tokens.css' ? css : swapKnown(css);
  fs.writeFileSync(abs, body.trim() + '\n');
  written.push(rel);
}

const scrollCue = `.scroll-cue {
  position: absolute;
  z-index: 2;
  left: 50%;
  bottom: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--acc);
  text-decoration: none;
  transform: translateX(-50%);
  transition: opacity 400ms var(--ease-out);
}

.scroll-cue.is-gone {
  opacity: 0;
  pointer-events: none;
}

.scroll-cue svg {
  display: block;
  width: 34px;
  height: 22px;
  margin-top: -9px;
  animation: scroll-cue-fall 1.8s var(--ease-out) infinite;
}

.scroll-cue svg:first-child {
  margin-top: 0;
}

.scroll-cue svg:nth-child(2) {
  animation-delay: 180ms;
}

.scroll-cue svg:nth-child(3) {
  animation-delay: 360ms;
}

@keyframes scroll-cue-fall {
  0% {
    opacity: 0.12;
    transform: translateY(0);
  }

  45% {
    opacity: 0.75;
    transform: translateY(6px);
  }

  100% {
    opacity: 0.12;
    transform: translateY(0);
  }
}

@media (max-width: 900px) {
  .scroll-cue {
    bottom: 14px;
  }

  .scroll-cue svg {
    width: 26px;
    height: 17px;
    margin-top: -7px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .scroll-cue svg {
    animation: none;
    opacity: 0.45;
    transform: none;
  }
}
`;

write('tokens.css', tokens);
write('fonts.css', fonts);
write('components/header.css', header);
write('components/scroll-cue.css', scrollCue);

const importOrder = [
  'tokens.css',
  'fonts.css',
  'base.css',
  'layout.css',
  'components/header.css',
  'components/footer.css',
  'components/pill.css',
  'components/tag.css',
  'components/chips.css',
  'components/detect.css',
  'components/sheet.css',
  'components/reveal.css',
  'components/scroll-cue.css',
  'sections/hero.css',
  'sections/sectores.css',
  'sections/como.css',
  'sections/servicios.css',
  'sections/notes-cover.css',
  'sections/notes-list.css',
  'sections/article.css',
  'sections/home-rest.css',
  'sections/misc.css',
  'pages/overrides.css',
];

for (const [file, chunks] of files) {
  chunks.sort((a, b) => a.order - b.order);
  write(file, chunks.map((c) => c.text).join('\n'));
}
for (const rel of importOrder) {
  if (!fs.existsSync(path.join(outRoot, rel))) write(rel, '/* reservado */\n');
}

const layerOf = (rel) => {
  if (rel === 'tokens.css') return 'tokens';
  if (rel === 'fonts.css' || rel === 'base.css') return 'base';
  if (rel === 'layout.css') return 'layout';
  if (rel.startsWith('components/')) return 'components';
  if (rel.startsWith('sections/')) return 'sections';
  if (rel.startsWith('pages/')) return 'pages';
  return 'utilities';
};
const imports = ['tokens.css', 'fonts.css', ...importOrder.filter((f) => !['tokens.css', 'fonts.css'].includes(f) && fs.readFileSync(path.join(outRoot, f), 'utf8').trim() !== '/* reservado */')];
const index = `@layer reset, tokens, base, layout, components, sections, pages, utilities;\n\n${imports.map((f) => `@import url("${f}") layer(${layerOf(f)});`).join('\n')}\n`;
fs.writeFileSync(path.join(outRoot, 'index.css'), index);

fs.appendFileSync(path.join(outRoot, 'sections/servicios.css'), `
.svc-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}
`);
fs.appendFileSync(path.join(outRoot, 'sections/notes-list.css'), `
.note-card .tagp {
  align-self: flex-start;
}

.sr {
  position: absolute;
  left: -9999px;
}
`);

function walkCss(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) walkCss(abs, out);
    else if (name.endsWith('.css') && path.basename(abs) !== 'tokens.css') out.push(abs);
  }
  return out;
}
const hexFiles = walkCss(outRoot);
const hexes = new Set();
for (const f of hexFiles) {
  for (const h of fs.readFileSync(f, 'utf8').match(/#[0-9a-fA-F]{3,8}\b/g) || []) hexes.add(h.toLowerCase());
}
let tokenCss = fs.readFileSync(path.join(outRoot, 'tokens.css'), 'utf8');
const extraDecls = [...hexes].sort().filter((hex) => !tokenCss.includes(`--c-${hex.slice(1)}:`)).map((hex) => `  --c-${hex.slice(1)}: ${hex};`);
if (extraDecls.length) {
  tokenCss = tokenCss.replace(':root {', `:root {\n${extraDecls.join('\n')}`);
  fs.writeFileSync(path.join(outRoot, 'tokens.css'), tokenCss);
}
for (const f of hexFiles) {
  const css = fs.readFileSync(f, 'utf8').replace(/#[0-9a-fA-F]{3,8}\b/g, (hex) => `var(--c-${hex.toLowerCase().slice(1)})`);
  fs.writeFileSync(f, css);
}

const leftovers = [...files.keys()];
console.log('files', leftovers.join(', '));
console.log('dropped', dropped.length);
console.log(dropped.slice(0, 80).join('\n'));
console.log('kf rename', [...kfRename.entries()].map(([a, b]) => `${a} -> ${b}`).join(', '));
const overrides = fs.existsSync(path.join(outRoot, 'pages/overrides.css')) ? fs.readFileSync(path.join(outRoot, 'pages/overrides.css'), 'utf8') : '';
console.log('override selectors', [...overrides.matchAll(/^[^@/\s][^{]+\{/gm)].map((m) => m[0].replace(/\s+/g, ' ').slice(0, 140)).slice(0, 40));
const hex = new Set();
for (const rel of fs.readdirSync(outRoot, { recursive: true })) {
  const abs = path.join(outRoot, rel);
  if (!abs.endsWith('.css') || rel === 'tokens.css') continue;
  const css = fs.readFileSync(abs, 'utf8');
  for (const h of css.match(/#[0-9a-fA-F]{3,8}\b/g) || []) hex.add(h.toLowerCase());
}
console.log('hex left', [...hex].sort().join(' '));
console.log('bytes', [...fs.readdirSync(outRoot, { recursive: true })].filter((f) => String(f).endsWith('.css')).reduce((n, f) => n + fs.statSync(path.join(outRoot, f)).size, 0));
