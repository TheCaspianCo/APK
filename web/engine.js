// PDF engine (browser + Node). Same idea as the Windows version:
// edited text is ALWAYS written with a complete embedded font, so every character the
// font contains can be typed, displayed, saved and extracted again.
import * as mupdf from "./lib/mupdf.js";

export { mupdf };

/** The browser build of MuPDF accepts ArrayBuffer but not Uint8Array; Node accepts both. */
export const toAB = b => (b instanceof ArrayBuffer ? b : b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));

// ----------------------------------------------------------------- fonts
export const FONT_FILES = {
  "Liberation Sans": ["LiberationSans-Regular", "LiberationSans-Bold", "LiberationSans-Italic", "LiberationSans-BoldItalic"],
  "Liberation Serif": ["LiberationSerif-Regular", "LiberationSerif-Bold", "LiberationSerif-Italic", "LiberationSerif-BoldItalic"],
  "Liberation Mono": ["LiberationMono-Regular", "LiberationMono-Bold", "LiberationMono-Italic", "LiberationMono-BoldItalic"],
  "DejaVu Sans": ["DejaVuSans", "DejaVuSans-Bold", "DejaVuSans-Oblique", "DejaVuSans-BoldOblique"],
};
export const FALLBACK = "DejaVu Sans";
const STYLE_IDX = { "00": 0, "10": 1, "01": 2, "11": 3 };

// family -> [regular, bold, italic, boldItalic] ArrayBuffers (filled by loadFonts / addFont)
const fontData = {};
const fontObjs = new Map();   // "family|b|i" -> mupdf.Font (for metrics)
const unicodeMaps = new Map();

export async function loadFonts(fetchBytes) {
  for (const [fam, files] of Object.entries(FONT_FILES)) {
    fontData[fam] = [];
    for (let i = 0; i < files.length; i++) fontData[fam][i] = await fetchBytes(files[i] + ".ttf");
  }
}
export function addUserFont(name, bytes) { fontData[name] = [bytes]; return name; }
export function fontFamilies() { return Object.keys(fontData); }

function styleBytes(family, bold, italic) {
  const arr = fontData[family] || fontData[FALLBACK];
  const want = (bold ? 1 : 0) + (italic ? 2 : 0);
  for (const i of [want, bold ? 1 : 0, italic ? 2 : 0, 0]) if (arr[i]) return { bytes: arr[i], idx: i, family: fontData[family] ? family : FALLBACK };
  return { bytes: arr[0], idx: 0, family };
}
function fontKey(family, bold, italic) {
  const s = styleBytes(family, bold, italic);
  return `${s.family}|${s.idx}`;
}
function metricFont(family, bold, italic) {
  const k = fontKey(family, bold, italic);
  let f = fontObjs.get(k);
  if (!f) { f = new mupdf.Font("M" + fontObjs.size, toAB(styleBytes(family, bold, italic).bytes)); fontObjs.set(k, f); }
  return f;
}
export function missingChars(family, bold, italic, text) {
  const f = metricFont(family, bold, italic);
  const out = new Set();
  for (const ch of text) { if (ch === "\n" || ch === "\r" || ch === "\t") continue; if (!f.encodeCharacter(ch.codePointAt(0))) out.add(ch); }
  return [...out];
}
/** Family to use: requested one, or DejaVu if it lacks a character but DejaVu has it. */
export function chooseFamily(family, bold, italic, text) {
  if (!missingChars(family, bold, italic, text).length) return family;
  if (fontData[FALLBACK] && !missingChars(FALLBACK, bold, italic, text).length) return FALLBACK;
  return family;
}
export function guessFamily(pdfName, isMono, isSerif) {
  const n = (pdfName || "").split("+").pop().toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const fam of fontFamilies()) if (n.includes(fam.toLowerCase().replace(/[^a-z0-9]/g, ""))) return fam;
  if (n.includes("courier") || n.includes("mono") || n.includes("consol") || isMono) return "Liberation Mono";
  if (n.includes("times") || n.includes("serif") && !n.includes("sans") || n.includes("georgia") || (isSerif && !n.includes("arial") && !n.includes("helvet"))) return "Liberation Serif";
  return "Liberation Sans";
}

// ------------------------------------------------------------- document
export function openDocument(bytes, password) {
  const d = mupdf.Document.openDocument(toAB(bytes), "application/pdf");
  if (d.needsPassword()) {
    if (!password || !d.authenticatePassword(password)) { const e = new Error("password"); e.code = "PASSWORD"; throw e; }
  }
  const pdf = d.asPDF();
  if (!pdf) throw new Error("Not a PDF file");
  return pdf;
}
export function snapshot(doc) { return new Uint8Array(doc.saveToBuffer("compress=yes,garbage=deduplicate").asUint8Array()); }
export function reload(doc) { const data = snapshot(doc); return { doc: openDocument(data), data }; }
export function newDocument(w = 595, h = 842) {
  const d = new mupdf.PDFDocument();
  const page = d.addPage([0, 0, w, h], 0, {}, "");
  d.insertPage(-1, page);
  return d;
}
export function isReadOnly(doc) { try { return !doc.hasPermission("edit"); } catch (e) { return false; } }
export function pageCount(doc) { return doc.countPages(); }
export function pageSize(doc, i) { const b = doc.loadPage(i).getBounds(); return [b[2] - b[0], b[3] - b[1]]; }

export function renderPage(doc, i, scale) {
  const page = doc.loadPage(i);
  const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
  const w = pix.getWidth(), h = pix.getHeight(), n = pix.getNumberOfComponents(), stride = pix.getStride();
  const src = pix.getPixels(), out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    let s = y * stride, d = y * w * 4;
    for (let x = 0; x < w; x++, s += n, d += 4) { out[d] = src[s]; out[d + 1] = src[s + 1]; out[d + 2] = src[s + 2]; out[d + 3] = 255; }
  }
  return { w, h, rgba: out };
}

// -------------------------------------------------------------- objects
const inRect = (r, x, y, pad) => x >= r[0] - pad && x <= r[2] + pad && y >= r[1] - pad && y <= r[3] + pad;
const unionRect = (a, b) => a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b.slice();
const quadRect = q => [Math.min(q[0], q[2], q[4], q[6]), Math.min(q[1], q[3], q[5], q[7]), Math.max(q[0], q[2], q[4], q[6]), Math.max(q[1], q[3], q[5], q[7])];

export function getObjects(doc, pageIndex, paragraph = false) {
  const page = doc.loadPage(pageIndex);
  const st = page.toStructuredText("preserve-whitespace,preserve-images");
  const lines = [], images = [];
  let cur = null, blk = -1;
  st.walk({
    beginTextBlock() { blk++; },
    beginLine(bbox, wmode, dir) { cur = { bbox: bbox.slice(), dir, chars: [], blk }; },
    onChar(c, origin, font, size, quad, color) {
      cur.chars.push({ c, origin, size, color, name: font.getName(), bold: font.isBold(), italic: font.isItalic(), mono: font.isMono(), serif: font.isSerif() });
    },
    endLine() { if (cur && cur.chars.length) lines.push(cur); cur = null; },
    onImageBlock(bbox, transform, image) { images.push({ kind: "image", rect: bbox.slice(), image, transform }); },
  });
  const textLines = [];
  for (const L of lines) {
    const ang = Math.atan2(L.dir[1], L.dir[0]) * 180 / Math.PI;
    const q = Math.round(ang / 90) * 90;
    if (Math.abs(ang - q) > 3) continue;
    const text = L.chars.map(c => c.c).join("").replace(/\s+$/, "");
    if (!text.trim()) continue;
    const counts = new Map();
    for (const c of L.chars) { const k = c.size + "|" + c.name + "|" + c.color.join(","); counts.set(k, (counts.get(k) || 0) + (c.c.trim() ? 1 : 0)); }
    const domKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const dom = L.chars.find(c => (c.size + "|" + c.name + "|" + c.color.join(",")) === domKey);
    const col = dom.color.length === 3 ? dom.color : dom.color.length === 1 ? [dom.color[0], dom.color[0], dom.color[0]] : [0, 0, 0];
    textLines.push({
      kind: "text", rect: L.bbox, text, origin: L.chars[0].origin.slice(), dir: L.dir.slice(), angle: ((q % 360) + 360) % 360,
      size: Math.round(dom.size * 100) / 100, color: col,
      family: guessFamily(dom.name, dom.mono, dom.serif),
      bold: dom.bold || /bold/i.test(dom.name), italic: dom.italic || /italic|oblique/i.test(dom.name), blk: L.blk,
      lines: [{ rect: L.bbox, origin: L.chars[0].origin.slice() }],
    });
  }
  let out = textLines;
  if (paragraph) {
    out = [];
    const groups = new Map();
    for (const t of textLines) { if (!groups.has(t.blk)) groups.set(t.blk, []); groups.get(t.blk).push(t); }
    for (const g of groups.values()) {
      if (new Set(g.map(x => x.angle)).size !== 1) { out.push(g[0]); continue; }
      const first = g[0];
      let rect = null;
      for (const x of g) rect = unionRect(rect, x.rect);
      out.push({ ...first, rect, text: g.map(x => x.text).join("\n"), lines: g.map(x => x.lines[0]) });
    }
  }
  const annots = [];
  try {
    for (const a of page.getAnnotations()) {
      const t = a.getType();
      if (["Square", "Circle", "Line", "Ink", "FreeText", "Polygon", "PolyLine"].includes(t)) annots.push({ kind: "annot", rect: a.getBounds().slice(), annot: a, type: t });
    }
  } catch (e) { /* ignore */ }
  return [...out, ...annots, ...images.filter(i => (i.rect[2] - i.rect[0]) > 2 && (i.rect[3] - i.rect[1]) > 2)];
}

export function hitObject(objs, x, y, pad = 2) {
  const prio = { text: 0, annot: 1, image: 2 };
  let best = null, bk = null;
  for (const o of objs) {
    if (!inRect(o.rect, x, y, pad)) continue;
    const k = [prio[o.kind], (o.rect[2] - o.rect[0]) * (o.rect[3] - o.rect[1])];
    if (!best || k[0] < bk[0] || (k[0] === bk[0] && k[1] < bk[1])) { best = o; bk = k; }
  }
  return best;
}

// -------------------------------------------------------------- editing
function removeRect(page, rect, { text = true, images = false, art = false } = {}) {
  const a = page.createAnnotation("Redact");
  a.setRect(rect);
  page.applyRedactions(false,
    images ? mupdf.PDFPage.REDACT_IMAGE_REMOVE : mupdf.PDFPage.REDACT_IMAGE_NONE,
    art ? mupdf.PDFPage.REDACT_LINE_ART_REMOVE_IF_TOUCHED : mupdf.PDFPage.REDACT_LINE_ART_NONE,
    text ? mupdf.PDFPage.REDACT_TEXT_REMOVE : mupdf.PDFPage.REDACT_TEXT_NONE);
}
function shrink(r, fx = -0.03, fy = 0.22) {
  const dx = (r[2] - r[0]) * fx, dy = (r[3] - r[1]) * fy;
  return [r[0] + dx, r[1] + dy, r[2] - dx, r[3] - dy];
}

function unicodeCMap(family, bold, italic) {
  const key = fontKey(family, bold, italic);
  if (unicodeMaps.has(key)) return unicodeMaps.get(key);
  const f = metricFont(family, bold, italic);
  const ranges = [[0x20, 0x24F], [0x370, 0x58F], [0x2000, 0x23FF], [0x2500, 0x27BF], [0xFB00, 0xFB06]];
  const map = new Map();
  for (const [a, b] of ranges) for (let cp = a; cp <= b; cp++) { const g = f.encodeCharacter(cp); if (g && !map.has(g)) map.set(g, cp); }
  const hex = (n, w = 4) => n.toString(16).toUpperCase().padStart(w, "0");
  const lines = [];
  const entries = [...map.entries()].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    lines.push(`${chunk.length} beginbfchar`);
    for (const [g, cp] of chunk) lines.push(`<${hex(g)}> <${cp > 0xFFFF ? hex(0xD800 + ((cp - 0x10000) >> 10)) + hex(0xDC00 + ((cp - 0x10000) & 0x3FF)) : hex(cp)}>`);
    lines.push("endbfchar");
  }
  const cmap = "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n" + lines.join("\n") + "\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend";
  unicodeMaps.set(key, cmap);
  return cmap;
}

/** Find or embed the complete font on this document; returns the resource name on the page. */
function fontResource(doc, page, family, bold, italic) {
  const key = fontKey(family, bold, italic);
  const baseName = "PE" + key.replace(/[^A-Za-z0-9]/g, "");
  const pageObj = page.getObject();
  let res = pageObj.getInheritable("Resources");
  if (!res || res.isNull()) { res = doc.newDictionary(); pageObj.put("Resources", res); }
  let fonts = res.get("Font");
  if (!fonts || fonts.isNull()) { fonts = doc.newDictionary(); res.put("Font", fonts); }
  let found = null;
  fonts.forEach((val, k) => {
    if (found) return;
    try {
      const d = val.get("DescendantFonts", 0);
      const bf = (d && !d.isNull() ? d.get("BaseFont") : val.get("BaseFont")).asName();
      if (bf.endsWith(baseName) || bf === baseName) found = String(k);
    } catch (e) { /* not ours */ }
  });
  if (found) return found;
  const s = styleBytes(family, bold, italic);
  const mf = new mupdf.Font(baseName, toAB(s.bytes));
  const fontObj = doc.addFont(mf);
  try {
    const tu = doc.addStream(unicodeCMap(family, bold, italic), doc.newDictionary());
    fontObj.put("ToUnicode", tu);
  } catch (e) { /* extraction still works for most viewers */ }
  const alias = "PEF" + Math.floor(Math.random() * 1e9).toString(36);
  fonts.put(alias, fontObj);
  return alias;
}

function appendContent(doc, page, text) {
  const pageObj = page.getObject();
  const stream = doc.addStream(text, doc.newDictionary());
  const q = doc.addStream("q\n", doc.newDictionary());
  const Q = doc.addStream("\nQ\n", doc.newDictionary());
  const arr = doc.newArray();
  arr.push(q);
  const old = pageObj.get("Contents");
  if (old && !old.isNull()) {
    if (old.isArray()) old.forEach(o => arr.push(o)); else arr.push(old);
  }
  arr.push(Q);
  arr.push(stream);
  pageObj.put("Contents", arr);
}

const f4 = n => (Math.round(n * 10000) / 10000).toString();
function glyphHex(font, text) {
  let s = "";
  for (const ch of text) s += (font.encodeCharacter(ch.codePointAt(0)) || 0).toString(16).toUpperCase().padStart(4, "0");
  return `<${s}>`;
}

/** Write (multi-line) text. origin/dir/step are in VIEW space (y down). */
export function writeText(doc, page, text, origin, dir, step, family, size, bold, italic, color) {
  const fam = chooseFamily(family, bold, italic, text);
  const alias = fontResource(doc, page, fam, bold, italic);
  const mf = metricFont(fam, bold, italic);
  const T = page.getTransform();
  const inv = mupdf.Matrix.invert(T);
  const out = ["BT"];
  let ops = "";
  let o = origin.slice();
  for (const ln of text.split("\n")) {
    if (ln) {
      // text space (y up) -> view: [dx dy dy -dx ox oy]; then view -> content
      const Tv = [dir[0], dir[1], dir[1], -dir[0], o[0], o[1]];
      const Tc = mupdf.Matrix.concat(Tv, inv);
      ops += `q ${Tc.map(f4).join(" ")} cm BT /${alias} ${f4(size)} Tf ${color.map(f4).join(" ")} rg 0 0 Td ${glyphHex(mf, ln)} Tj ET Q\n`;
    }
    o = [o[0] + step[0], o[1] + step[1]];
  }
  appendContent(doc, page, ops);
  return missingChars(fam, bold, italic, text);
}

function stepFor(obj) {
  if (obj.lines.length > 1) return [obj.lines[1].origin[0] - obj.lines[0].origin[0], obj.lines[1].origin[1] - obj.lines[0].origin[1]];
  return [-obj.dir[1] * obj.size * 1.2, obj.dir[0] * obj.size * 1.2];
}

export function editTextObject(doc, pageIndex, obj, text, st) {
  const page = doc.loadPage(pageIndex);
  for (const l of obj.lines) removeRect(page, shrink(l.rect), { text: true });
  return writeText(doc, page, text, obj.lines[0].origin, obj.dir, stepFor(obj), st.family, st.size, st.bold, st.italic, st.color);
}

export function addText(doc, pageIndex, x, y, text, st) {
  const page = doc.loadPage(pageIndex);
  const fam = chooseFamily(st.family, st.bold, st.italic, text);
  const asc = (fam && 0.9) || 0.9;
  return writeText(doc, page, text, [x, y + asc * st.size], [1, 0], [0, st.size * 1.2], st.family, st.size, st.bold, st.italic, st.color);
}

export function deleteObject(doc, pageIndex, obj) {
  const page = doc.loadPage(pageIndex);
  if (obj.kind === "text") for (const l of obj.lines) removeRect(page, shrink(l.rect), { text: true });
  else if (obj.kind === "image") removeRect(page, shrink(obj.rect, 0.02, 0.02), { text: false, images: true });
  else if (obj.kind === "annot") page.deleteAnnotation(obj.annot);
}

export function imagePng(obj) { return obj.image.toPixmap().asPNG(); }

export function placeImage(doc, pageIndex, rect, bytes) {
  const page = doc.loadPage(pageIndex);
  const img = new mupdf.Image(toAB(bytes));
  const ref = doc.addImage(img);
  const pageObj = page.getObject();
  let res = pageObj.getInheritable("Resources");
  if (!res || res.isNull()) { res = doc.newDictionary(); pageObj.put("Resources", res); }
  let xo = res.get("XObject");
  if (!xo || xo.isNull()) { xo = doc.newDictionary(); res.put("XObject", xo); }
  const alias = "PEI" + Math.floor(Math.random() * 1e9).toString(36);
  xo.put(alias, ref);
  const inv = mupdf.Matrix.invert(page.getTransform());
  const w = rect[2] - rect[0], h = rect[3] - rect[1];
  // unit square (y up) -> view rect (image top = rect top) -> content
  const Tv = [w, 0, 0, -h, rect[0], rect[3]];
  const Tc = mupdf.Matrix.concat(Tv, inv);
  appendContent(doc, page, `q ${Tc.map(f4).join(" ")} cm /${alias} Do Q\n`);
}

export function imageSize(bytes) { const im = new mupdf.Image(toAB(bytes)); return [im.getWidth(), im.getHeight()]; }

export function moveObject(doc, pageIndex, obj, dx, dy) {
  const page = doc.loadPage(pageIndex);
  if (obj.kind === "text") {
    for (const l of obj.lines) removeRect(page, shrink(l.rect), { text: true });
    writeText(doc, page, obj.text, [obj.lines[0].origin[0] + dx, obj.lines[0].origin[1] + dy], obj.dir, stepFor(obj), obj.family, obj.size, obj.bold, obj.italic, obj.color);
  } else if (obj.kind === "image") {
    const png = imagePng(obj);
    removeRect(page, shrink(obj.rect, 0.02, 0.02), { text: false, images: true });
    placeImage(doc, pageIndex, [obj.rect[0] + dx, obj.rect[1] + dy, obj.rect[2] + dx, obj.rect[3] + dy], png);
  } else if (obj.kind === "annot") {
    const r = obj.annot.getRect();
    obj.annot.setRect([r[0] + dx, r[1] + dy, r[2] + dx, r[3] + dy]);
    obj.annot.update();
  }
}

export function pasteText(doc, pageIndex, obj, x, y) {
  const dx = x - obj.rect[0], dy = y - obj.rect[1];
  const page = doc.loadPage(pageIndex);
  return writeText(doc, page, obj.text, [obj.lines[0].origin[0] + dx, obj.lines[0].origin[1] + dy], obj.dir, stepFor(obj), obj.family, obj.size, obj.bold, obj.italic, obj.color);
}

export function addShape(doc, pageIndex, kind, a, b, style) {
  const page = doc.loadPage(pageIndex);
  const r = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  let ann;
  if (kind === "line") {
    ann = page.createAnnotation("Line");
    ann.setLine(a, b);
    ann.setColor(style.stroke);
  } else {
    ann = page.createAnnotation(kind === "ellipse" ? "Circle" : "Square");
    ann.setRect(r);
    ann.setColor(style.stroke);
    if (style.fill) ann.setInteriorColor(style.fill);
  }
  ann.setBorderWidth(style.width);
  ann.update();
}

// ------------------------------------------------------------ page ops
export function rotatePages(doc, idxs, delta) {
  for (const i of idxs) {
    const po = doc.findPage(i);
    const cur = po.getInheritable("Rotate");
    const v = cur && !cur.isNull() ? cur.asNumber() : 0;
    po.put("Rotate", (((v + delta) % 360) + 360) % 360);
  }
}
export function insertBlankPage(doc, at, like) {
  let mb = [0, 0, 595, 842];
  if (like != null && like >= 0 && like < doc.countPages()) { const b = doc.loadPage(like).getBounds(); mb = [0, 0, b[2] - b[0], b[3] - b[1]]; }
  doc.insertPage(at, doc.addPage(mb, 0, {}, ""));
}
export function deletePages(doc, idxs) {
  const s = [...new Set(idxs)].sort((a, b) => b - a);
  if (s.length >= doc.countPages()) throw new Error("A document must keep at least one page.");
  for (const i of s) doc.deletePage(i);
}
export function movePage(doc, src, dst) {
  if (src === dst) return;
  const obj = doc.findPage(src);
  if (dst > src) { doc.insertPage(dst + 1, obj); doc.deletePage(src); }
  else { doc.insertPage(dst, obj); doc.deletePage(src + 1); }
}
export function extractPages(doc, idxs) {
  const out = new mupdf.PDFDocument();
  [...new Set(idxs)].sort((a, b) => a - b).forEach(i => out.graftPage(-1, doc, i));
  return new Uint8Array(out.saveToBuffer("compress=yes,garbage=deduplicate").asUint8Array());
}
export function importPages(doc, bytes, at, password) {
  const src = openDocument(bytes, password);
  const n = src.countPages();
  for (let j = 0; j < n; j++) doc.graftPage(at + j, src, j);
  return n;
}
export function search(doc, needle) {
  const hits = [];
  for (let i = 0; i < doc.countPages(); i++) {
    for (const group of doc.loadPage(i).search(needle, {})) { let r = null; for (const q of group) r = unionRect(r, quadRect(q)); if (r) hits.push({ page: i, rect: r }); }
  }
  return hits;
}
export function getOutline(doc) {
  const out = [];
  const walk = (items, lvl) => { for (const it of items || []) { out.push({ title: it.title, level: lvl, page: it.page ?? -1 }); if (it.down) walk(it.down, lvl + 1); } };
  try { walk(doc.loadOutline(), 0); } catch (e) { /* none */ }
  return out;
}
export function getMeta(doc) {
  const g = k => doc.getMetaData(k) || "";
  return { title: g("info:Title"), author: g("info:Author"), subject: g("info:Subject"), keywords: g("info:Keywords") };
}
export function setMeta(doc, m) {
  const map = { title: "info:Title", author: "info:Author", subject: "info:Subject", keywords: "info:Keywords" };
  for (const [k, v] of Object.entries(m)) doc.setMetaData(map[k], v);
}
export function saveBytes(doc, optimize = false, password = null) {
  let opts = optimize ? "compress=yes,garbage=deduplicate,clean=yes" : "compress=yes,garbage=deduplicate";
  if (password) opts += `,encrypt=aes-256,user-password=${password},owner-password=${password}`;
  return new Uint8Array(doc.saveToBuffer(opts).asUint8Array());
}
