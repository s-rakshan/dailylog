/* Tiny offline .docx writer: uncompressed ZIP + WordprocessingML. Dynamic column tables. */
(function () {
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const enc = new TextEncoder();

  function zip(files, type) {
    const parts = [], cen = []; let off = 0; const d = new Date();
    const dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    for (const f of files) {
      const nm = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, tm, true); h.setUint16(12, dt, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true);
      h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nm, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      cen.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + data.length;
    }
    const cs = cen.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], { type: type || 'application/zip' });
  }

  const x = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const run = (t, o = {}) => {
    const rp = (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.color ? `<w:color w:val="${o.color}"/>` : '') + (o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : '');
    return String(t ?? '').split('\n').map((ln, i) => (i ? '<w:r><w:br/></w:r>' : '') + `<w:r>${rp ? `<w:rPr>${rp}</w:rPr>` : ''}<w:t xml:space="preserve">${x(ln)}</w:t></w:r>`).join('');
  };
  const para = (t, o = {}) => `<w:p><w:pPr>${o.keep ? '<w:keepNext/>' : ''}<w:spacing w:before="${o.before || 0}" w:after="${o.after ?? 80}"/>${o.align ? `<w:jc w:val="${o.align}"/>` : ''}</w:pPr>${run(t, o)}</w:p>`;

  // A4 usable width ≈ 9638 twips (2 cm margins). Day col fixed; rest share.
  function widths(n) {
    const total = 9638, day = 900;
    if (n <= 1) return [total];
    const rest = total - day, each = Math.floor(rest / (n - 1));
    const w = [day];
    for (let i = 1; i < n; i++) w.push(each);
    w[w.length - 1] += rest - each * (n - 1);
    return w;
  }
  const cell = (t, w, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}</w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/>${o.align ? `<w:jc w:val="${o.align}"/>` : ''}</w:pPr>${run(t, o)}</w:p></w:tc>`;
  const trow = (cells, W, o = {}, G = new Set()) => `<w:tr><w:trPr><w:cantSplit/>${o.head ? '<w:tblHeader/>' : ''}</w:trPr>${cells.map((c, i) => cell(c, W[i] || W[W.length - 1], G.has(i) ? { ...o, color: '8C8C8C', fill: o.head ? 'E3E3E3' : 'F2F2F2' } : o)).join('')}</w:tr>`;
  const table = (head, rows, grey) => {
    const G = new Set(grey || []);
    const W = widths(head.length);
    const bd = s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="${W.reduce((a, b) => a + b)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(bd).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${W.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`
      + trow(head, W, { head: 1, b: 1, fill: 'F2F2F2' }, G) + rows.map(r => trow(r, W, {}, G)).join('') + '</w:tbl>';
  };

  /* model: { title, subtitle, note?, months:[{ title, head:[], rows:[[]], note? }] } */
  window.makeDocx = function (m) {
    let body = para(m.title, { b: 1, sz: 36, after: 40 }) + para(m.subtitle, { color: '666666', after: 160 });
    if (m.note) body += para(m.note, { after: 200, color: '444444' });
    (m.months || []).forEach((mo, idx) => {
      if (idx) body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      body += para(mo.title, { b: 1, sz: 26, before: 240, after: 80, keep: 1 });
      if (mo.note) body += para(mo.note, { after: 80, color: '666666', i: 1 });
      body += table(mo.head, mo.rows, mo.grey) + para('', { after: 0 });
    });
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-IN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    return zip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
      { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(m.title)}</dc:title><dc:creator>Daily Log</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>` },
      { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'word/document.xml', data: doc },
      { name: 'word/styles.xml', data: styles },
    ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  };
})();
