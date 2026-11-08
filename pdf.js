/* Offline PDF (PDF 1.4, standard fonts). No network, no embedded files from elsewhere. */
(function () {
  const enc = new TextEncoder();
  const PW = 595.28, PH = 841.89, MX = 40, MY = 36, FOOT = 22;
  const WIN = { '\u2013': 0x96, '\u2014': 0x97, '\u2018': 0x91, '\u2019': 0x92, '\u201C': 0x93, '\u201D': 0x94, '\u2022': 0x95, '\u00B7': 0xB7, '\u2026': 0x85 };

  function pdfLiteral(s) {
    const bytes = [];
    for (const ch of String(s ?? '')) {
      const c = ch.codePointAt(0);
      if (c === 10 || c === 13) continue;
      if (c >= 32 && c <= 126) bytes.push(c);
      else if (WIN[ch]) bytes.push(WIN[ch]);
      else if (c >= 160 && c <= 255) bytes.push(c);
    }
    let out = '(';
    for (const b of bytes) {
      if (b === 0x28 || b === 0x29 || b === 0x5C) out += '\\' + String.fromCharCode(b);
      else if (b < 32 || b > 126) out += '\\' + b.toString(8).padStart(3, '0');
      else out += String.fromCharCode(b);
    }
    return out + ')';
  }
  const num = n => (Math.round(n * 100) / 100).toString();
  function wrap(text, width, size) {
    const max = Math.max(8, Math.floor(width / (size * 0.5)));
    const words = String(text ?? '').split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (next.length > max && cur) { lines.push(cur); cur = w; }
      else cur = next;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 10);
  }
  function fit(s, width, size) {
    const max = Math.max(1, Math.floor((width - 6) / (size * 0.5)));
    const t = String(s ?? '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    return t.slice(0, Math.max(1, max - 1));
  }
  function colWidths(n, total) {
    if (n <= 1) return [total];
    const day = Math.min(58, total * 0.18);
    const each = (total - day) / (n - 1);
    const w = [day];
    for (let i = 1; i < n; i++) w.push(each);
    return w;
  }

  function layout(model) {
    const pages = [];
    const totalW = PW - MX * 2;
    let ops, y;
    const bottom = () => MY + FOOT;
    function startPage() { ops = []; y = PH - MY; pages.push(ops); }
    function text(font, size, x, baseline, str, rgb) {
      if (!str) return;
      ops.push(`${num(rgb[0])} ${num(rgb[1])} ${num(rgb[2])} rg\nBT /${font} ${size} Tf 1 0 0 1 ${num(x)} ${num(baseline)} Tm ${pdfLiteral(str)} Tj ET\n`);
    }
    function fill(x, top, w, h, rgb) {
      ops.push(`${num(rgb[0])} ${num(rgb[1])} ${num(rgb[2])} rg\n${num(x)} ${num(top - h)} ${num(w)} ${num(h)} re f\n`);
    }
    function stroke(x, top, w, h) {
      ops.push(`0.75 0.75 0.75 RG\n0.6 w\n${num(x)} ${num(top - h)} ${num(w)} ${num(h)} re S\n`);
    }
    function mark(kind, x, top, h, grey) {
      const c = grey ? '0.55 0.55 0.55' : '0.15 0.15 0.15';
      const x0 = x + 4, y0 = top - h + 3.5;
      if (kind === '✓') ops.push(`${c} RG\n1.15 w\n1 J\n1 j\n${num(x0)} ${num(y0 + 3)} m\n${num(x0 + 2.6)} ${num(y0)} l\n${num(x0 + 8)} ${num(y0 + 7)} l\nS\n`);
      else ops.push(`${c} RG\n1.15 w\n1 J\n${num(x0 + 1)} ${num(y0 + 1)} m\n${num(x0 + 7)} ${num(y0 + 7)} l\nS\n${num(x0 + 7)} ${num(y0 + 1)} m\n${num(x0 + 1)} ${num(y0 + 7)} l\nS\n`);
    }
    startPage();
    text('F2', 16, MX, y - 16, model.title || 'Daily Log', [0.1, 0.1, 0.1]);
    y -= 22;
    wrap(model.subtitle || '', totalW, 9).forEach(ln => { text('F1', 9, MX, y - 9, ln, [0.4, 0.4, 0.4]); y -= 12; });
    y -= 8;

    (model.months || []).forEach(mo => {
      const head = mo.head || ['Day'];
      const rows = mo.rows || [];
      const grey = new Set(mo.grey || []);
      const W = colWidths(head.length, totalW);
      const noteLines = mo.note ? wrap(mo.note, totalW, 9) : [];
      const headH = 18, rowH = 15;
      function drawHead() {
        let x = MX;
        head.forEach((h, i) => {
          const g = grey.has(i);
          fill(x, y, W[i], headH, g ? [0.89, 0.89, 0.89] : [0.949, 0.949, 0.949]);
          stroke(x, y, W[i], headH);
          text('F2', 8, x + 3, y - 12, fit(String(h).toUpperCase(), W[i], 8), g ? [0.45, 0.45, 0.45] : [0.25, 0.25, 0.25]);
          x += W[i];
        });
        y -= headH;
      }
      const intro = 16 + noteLines.length * 12 + (noteLines.length ? 4 : 0) + headH + rowH;
      if (y - intro < bottom() && y < PH - MY - 40) startPage();
      text('F2', 12, MX, y - 12, mo.title || '', [0.1, 0.1, 0.1]);
      y -= 16;
      noteLines.forEach(ln => {
        if (y - 12 < bottom()) startPage();
        text('F3', 9, MX, y - 9, ln, [0.35, 0.35, 0.35]);
        y -= 12;
      });
      if (noteLines.length) y -= 4;
      if (y - headH - rowH < bottom()) startPage();
      drawHead();
      rows.forEach((r, ri) => {
        if (y - rowH < bottom()) {
          startPage();
          text('F2', 10, MX, y - 11, fit((mo.title || 'Month') + ' (continued)', totalW, 10), [0.2, 0.2, 0.2]);
          y -= 16;
          drawHead();
        }
        let x = MX;
        const zebra = ri % 2 === 1;
        head.forEach((_, i) => {
          const g = grey.has(i);
          const cell = r[i];
          if (g) fill(x, y, W[i], rowH, [0.949, 0.949, 0.949]);
          else if (zebra) fill(x, y, W[i], rowH, [0.965, 0.96, 0.95]);
          stroke(x, y, W[i], rowH);
          const t = cell == null ? '' : String(cell);
          if (i && (t === '✓' || t === '✗')) mark(t, x, y, rowH, g);
          else text(i === 0 ? 'F2' : 'F1', 8, x + 3, y - 11, fit(t, W[i], 8), g ? [0.45, 0.45, 0.45] : [0.1, 0.1, 0.1]);
          x += W[i];
        });
        y -= rowH;
      });
      y -= 14;
    });

    pages.forEach((pops, i) => {
      const label = (i + 1) + ' / ' + pages.length;
      pops.push(`0.55 0.55 0.55 rg\nBT /F1 8 Tf 1 0 0 1 ${num(MX)} 20 Tm ${pdfLiteral('Daily Log')} Tj ET\n`);
      pops.push(`0.55 0.55 0.55 rg\nBT /F1 8 Tf 1 0 0 1 ${num(PW - MX - 36)} 20 Tm ${pdfLiteral(label)} Tj ET\n`);
    });
    return pages;
  }

  function makePdf(model) {
    const pageOps = layout(model || {});
    const n = pageOps.length || 1;
    if (!pageOps.length) pageOps.push([]);
    const parts = [
      { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
      { id: 2, body: `<< /Type /Pages /Count ${n} /Kids [${Array.from({ length: n }, (_, i) => (7 + i * 2) + ' 0 R').join(' ')}] >>` },
      { id: 3, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' },
      { id: 4, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>' },
      { id: 5, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>' },
    ];
    pageOps.forEach((ops, i) => {
      const stream = ops.join('');
      const len = enc.encode(stream).length;
      parts.push({ id: 6 + i * 2, body: `<< /Length ${len} >>\nstream\n${stream}endstream` });
      parts.push({
        id: 7 + i * 2,
        body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${6 + i * 2} 0 R >>`,
      });
    });
    const chunks = [];
    let off = 0;
    const push = bytes => { chunks.push(bytes); off += bytes.length; };
    push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xFF, 0xFF, 0xFF, 0xFF, 0x0A]));
    const offsets = [0];
    parts.forEach(part => {
      offsets[part.id] = off;
      push(enc.encode(`${part.id} 0 obj\n${part.body}\nendobj\n`));
    });
    const xrefAt = off;
    const size = parts.length + 1;
    let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
    for (let i = 1; i < size; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    push(enc.encode(xref));
    push(enc.encode(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`));
    const out = new Uint8Array(off);
    let p = 0;
    chunks.forEach(b => { out.set(b, p); p += b.length; });
    return new Blob([out], { type: 'application/pdf' });
  }

  window.makePdf = makePdf;
})();
