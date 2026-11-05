/* Accent themes (shared by Daily Log and Study Log). */
const THEMES = [
  ['peach', 'Peach', '#f5a57a'], ['white', 'White', '#efede8'], ['brown', 'Brown', '#d29a69'],
  ['red', 'Red', '#f27d74'], ['amber', 'Amber', '#f2c568'], ['green', 'Green', '#85d99a'],
  ['teal', 'Teal', '#5fd4c3'], ['blue', 'Blue', '#7cb5f7'], ['purple', 'Purple', '#b198f8'],
  ['pink', 'Pink', '#f494c0'], ['grey', 'Grey', '#b3b3b3'],
];
const themeHex = id => (THEMES.find(t => t[0] === id) || THEMES[0])[2];
function applyTheme(id) {
  const h = themeHex(id), n = parseInt(h.slice(1), 16), rgb = `${n >> 16},${(n >> 8) & 255},${n & 255}`;
  const r = document.documentElement.style;
  r.setProperty('--ac', h); r.setProperty('--acr', rgb); r.setProperty('--ac-dim', `rgba(${rgb},.16)`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#121212');
}
function themePicker(cur, onPick) {
  const wrap = document.createElement('div'); wrap.className = 'themes';
  THEMES.forEach(([id, name, hex]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tdot' + (id === cur ? ' on' : ''); b.title = name; b.setAttribute('aria-label', name + ' theme');
    b.dataset.theme = id; b.style.setProperty('--c', hex);
    b.onclick = () => { wrap.querySelectorAll('.tdot').forEach(x => x.classList.toggle('on', x === b)); applyTheme(id); onPick(id); };
    wrap.append(b);
  });
  return wrap;
}
