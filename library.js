const LS_KEY = 'libraryBooks';
let quaggaRunning = false;

function getBooks() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; }
}
function saveBooks(books) { localStorage.setItem(LS_KEY, JSON.stringify(books)); }

/* ---------- Points & badges helpers ---------- */
function getTotalPoints() {
  const books = getBooks();
  return books.reduce((sum, b) => sum + (b.readPages || 0), 0);
}

// Define your badges here (easy to extend)
const BADGES = [
  { id: 'p50',  name: '50 Pages',  threshold: 50,  emoji: '🥉' },
  { id: 'p100', name: '100 Pages', threshold: 100, emoji: '🥈' },
  // { id: 'p250', name: '250 Pages', threshold: 250, emoji: '🥇' },
];

function renderBadges() {
  const total = getTotalPoints();
  const totalEl = document.getElementById('points-total');
  if (totalEl) totalEl.textContent = String(total);

  const grid = document.getElementById('badges-grid');
  if (!grid) return;
  grid.innerHTML = '';

  BADGES.forEach(b => {
    const earned = total >= b.threshold;
    const li = document.createElement('li');
    li.className = 'card';
    li.style.opacity = earned ? '1' : '.6';
    li.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="font-size:28px;">${b.emoji}</div>
        <div>
          <div class="title">${b.name}</div>
          <div class="meta">${earned ? 'Unlocked' : `Read ${b.threshold} pages`}</div>
        </div>
      </div>
      <div class="meta" style="margin-top:6px;">
        Progress: ${Math.min(total, b.threshold)} / ${b.threshold}
      </div>
    `;
    grid.appendChild(li);
  });
}

/* ---------- Render library ---------- */
function renderBooks() {
  const grid = document.getElementById('book-grid');
  const empty = document.getElementById('empty-state');
  const books = getBooks();
  grid.innerHTML = '';
  if (!books.length) { empty.hidden = false; return; }
  empty.hidden = true;

  books.forEach((b, idx) => {
    const parts = [];
    if (b.author) parts.push(b.author);
    if (b.pages) parts.push(`${b.pages} pages`);
    if (b.isbn) parts.push(`ISBN: ${b.isbn}`);
    if (b.readPages) parts.push(`Read: ${b.readPages} pages`);
    const meta = parts.join(' · ');

    const li = document.createElement('li');
    li.className = 'card';
    li.innerHTML = `
      ${b.thumbnail ? `<img src="${b.thumbnail}" alt="${b.title}" class="cover">` : ''}
      <div class="title">${b.title || 'Untitled'}</div>
      <div class="meta">${meta}</div>
      <button class="btn log-btn" data-idx="${idx}" type="button" style="margin-top:8px;">Log reading</button>
    `;
    grid.appendChild(li);
  });
}

/* ---------- UI helpers ---------- */
function showAddPanel() {
  document.getElementById('add-panel').hidden = false;
  document.getElementById('shelf-view').hidden = false;
  document.getElementById('badges-panel').hidden = true;
  switchMethod('camera');
}
function showShelf() {
  document.getElementById('shelf-view').hidden = false;
  document.getElementById('add-panel').hidden = true;
  document.getElementById('badges-panel').hidden = true;
}
function showBadgesPanel() {
  document.getElementById('shelf-view').hidden = true;
  document.getElementById('add-panel').hidden = true;
  document.getElementById('badges-panel').hidden = false;
  renderBadges();
}

function switchMethod(method) {
  document.querySelectorAll('.lib-subtab').forEach(btn => {
    const active = btn.dataset.method === method;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  document.getElementById('method-camera').hidden = method !== 'camera';
  document.getElementById('method-upload').hidden = method !== 'upload';
  document.getElementById('method-keyboard').hidden = method !== 'keyboard';
}

/* ---------- Camera preview styling ---------- */
function ensureScannerStyles() {
  const el = document.getElementById('scanner');
  if (!el) return;
  el.style.position = 'relative';
  el.style.width = '100%';
  el.style.aspectRatio = '16 / 9';
  el.style.background = '#000';
  el.style.overflow = 'hidden';
  const fit = () => {
    el.querySelectorAll('video, canvas').forEach(n => {
      n.style.position = 'absolute';
      n.style.top = '0';
      n.style.left = '0';
      n.style.width = '100%';
      n.style.height = '100%';
      n.style.objectFit = 'cover';
    });
  };
  fit(); requestAnimationFrame(fit);
}

/* ---------- Book metadata lookups ---------- */
async function lookupGoogleBooks(isbn) {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.items || !data.items.length) return null;
    const v = data.items[0].volumeInfo || {};
    return {
      title: v.title || '',
      author: (v.authors && v.authors.join(', ')) || '',
      pages: v.pageCount || null,
      isbn,
      thumbnail: v.imageLinks?.thumbnail || '',
      description: v.description || ''
    };
  } catch { return null; }
}
async function lookupOpenLibrary(isbn) {
  try {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`);
    if (!res.ok) return null;
    const data = await res.json();
    const b = data[`ISBN:${isbn}`];
    if (!b) return null;
    return {
      title: b.title || '',
      author: (b.authors && b.authors.map(a => a.name).join(', ')) || '',
      pages: b.number_of_pages || null,
      isbn,
      thumbnail: b.cover?.medium || b.cover?.small || '',
      description: b.subtitle || ''
    };
  } catch { return null; }
}
async function lookupBookByISBN(isbn) {
  return (await lookupGoogleBooks(isbn)) || (await lookupOpenLibrary(isbn));
}

/* ---------- ISBN validation & conversion ---------- */
function isIsbn13(code) {
  return typeof code === 'string' && code.length === 13 && (code.startsWith('978') || code.startsWith('979'));
}
function ean13ToIsbn10(ean13) {
  if (!isIsbn13(ean13) || !ean13.startsWith('978')) return null;
  const core9 = ean13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * parseInt(core9[i], 10);
  let check = (11 - (sum % 11)) % 11;
  const checkChar = check === 10 ? 'X' : String(check);
  return core9 + checkChar;
}

/* ---------- QuaggaJS camera setup ---------- */
function startScanner() {
  const el = document.getElementById('scanner');
  if (!el) return;

  const isSecure =
    location.protocol === 'https:' ||
    ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

  if (!isSecure) { el.innerHTML = '<p>Camera requires HTTPS or localhost.</p>'; return; }
  if (!window.Quagga) { el.innerHTML = '<p>QuaggaJS not loaded.</p>'; return; }
  if (quaggaRunning) return;

  el.innerHTML = '';
  ensureScannerStyles();
  el.classList.add('scanning'); // visual cue

  Quagga.init({
    inputStream: {
      type: 'LiveStream',
      target: el,
      constraints: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    },
    locator: { patchSize: 'medium', halfSample: true },
    decoder: { readers: ['ean_reader'] }, // EAN-13 only
    locate: true
  }, (err) => {
    if (err) { console.error(err); el.innerHTML = '<p>Camera error.</p>'; return; }
    Quagga.start();
    quaggaRunning = true;
    ensureScannerStyles();
  });

  Quagga.onProcessed((result) => {
    const ctx = Quagga.canvas?.ctx?.overlay;
    const canvas = Quagga.canvas?.dom?.overlay;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (result?.boxes) {
      result.boxes.filter(b => b !== result.box).forEach(box => {
        ctx.beginPath();
        ctx.moveTo(box[0].x, box[0].y);
        box.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,.4)';
        ctx.stroke();
      });
    }
    if (result?.box) {
      ctx.beginPath();
      ctx.moveTo(result.box[0].x, result.box[0].y);
      result.box.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,200,255,.9)';
      ctx.stroke();
    }
  });

  Quagga.onDetected(onDetectedOnce);
}

function stopScanner() {
  const el = document.getElementById('scanner');
  if (el) el.classList.remove('scanning');
  if (quaggaRunning) { Quagga.stop(); quaggaRunning = false; }
}

/* ---------- On detection: validate ISBN, fetch metadata, save ---------- */
let lastCodeAt = 0;

async function onDetectedOnce(result) {
  const raw = result?.codeResult?.code;
  if (!raw) return;

  const now = Date.now();
  if (now - lastCodeAt < 800) return;
  lastCodeAt = now;

  const el = document.getElementById('scanner');

  // Green flash on detection
  if (el) {
    el.classList.remove('scanning');
    el.classList.add('detected');
    setTimeout(() => el.classList.remove('detected'), 1200);
  }

  if (!isIsbn13(raw)) {
    if (el) {
      el.querySelectorAll('.hint').forEach(n => n.remove());
      const hint = document.createElement('div');
      hint.className = 'hint meta';
      hint.style.position = 'absolute';
      hint.style.bottom = '8px';
      hint.style.left = '8px';
      hint.style.background = 'rgba(0,0,0,.55)';
      hint.style.padding = '4px 8px';
      hint.style.borderRadius = '8px';
      hint.textContent = 'Not a book barcode. Look for 13 digits starting 978/979.';
      el.appendChild(hint);
      setTimeout(() => hint.remove(), 1800);
    }
    return;
  }

  stopScanner();
  try { Quagga.offDetected && Quagga.offDetected(onDetectedOnce); } catch {}

  if (el) el.innerHTML = `<p class="meta">ISBN ${raw} detected. Fetching details…</p>`;

  const isbn10 = ean13ToIsbn10(raw);
  let meta = await lookupGoogleBooks(raw);
  if (!meta && isbn10) meta = await lookupGoogleBooks(isbn10);
  if (!meta) meta = await lookupOpenLibrary(raw);
  if (!meta && isbn10) meta = await lookupOpenLibrary(isbn10);

  const books = getBooks();
  if (meta) {
    books.push({
      title: meta.title || `Book (${raw})`,
      author: meta.author || '',
      pages: meta.pages || null,
      isbn: meta.isbn || raw,
      thumbnail: meta.thumbnail || '',
      description: meta.description || '',
      readPages: 0
    });
  } else {
    books.push({ title: `Book (${raw})`, author: '', pages: null, isbn: raw, readPages: 0 });
  }
  saveBooks(books);
  renderBooks();
  renderBadges(); // update points/badges immediately

  if (el) {
    const details = books[books.length - 1];
    const pagesText = details.pages ? ` · ${details.pages} pages` : '';
    const by = details.author ? ` by ${details.author}` : '';
    el.innerHTML = `<p>Added: <strong>${details.title}</strong>${by}${pagesText}</p>`;
  }
}

/* ---------- Log Reading Modal ---------- */
function ensureLogModal() {
  if (document.getElementById('log-modal')) return;
  const style = document.createElement('style');
  style.textContent = `
    #log-modal { position: fixed; inset: 0; display: none; place-items: center; background: rgba(0,0,0,.5); z-index: 50; }
    #log-modal.show { display: grid; }
    #log-modal .sheet { background: var(--card); color: var(--text); border: 1px solid var(--border);
      border-radius: 12px; padding: 16px; min-width: 280px; box-shadow: var(--shadow); }
    #log-modal .row { display: flex; gap: 10px; margin-top: 10px; }
    #log-modal input[type="number"] { flex: 1; padding: 10px; border-radius: 10px; border: 1px solid var(--border);
      background: var(--bg, #0f1220); color: var(--text); }
    #log-modal .btn { padding: 10px 14px; border-radius: 10px; }
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.id = 'log-modal';
  modal.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="log-title">
      <h3 id="log-title" style="margin:0 0 8px;">Log reading</h3>
      <div class="meta" id="log-book-meta"></div>
      <form id="log-form" class="row">
        <input id="log-pages" type="number" min="1" inputmode="numeric" placeholder="Pages read" required />
        <button class="btn" type="submit">Save</button>
        <button class="btn" type="button" id="log-cancel">Cancel</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target.id === 'log-modal') closeLogModal();
  });
  document.getElementById('log-cancel').addEventListener('click', closeLogModal);

  document.getElementById('log-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const idx = Number(document.getElementById('log-form').dataset.idx);
    const n = parseInt(document.getElementById('log-pages').value, 10);
    if (!Number.isFinite(n) || n <= 0) return;

    const books = getBooks();
    books[idx].readPages = (books[idx].readPages || 0) + n;
    saveBooks(books);
    renderBooks();
    renderBadges(); // update total points & badge progress

    try { localStorage.setItem('lastReadingDate', new Date().toISOString()); } catch {}
    closeLogModal();
  });
}

function openLogModal(idx) {
  ensureLogModal();
  const books = getBooks();
  const b = books[idx];
  document.getElementById('log-book-meta').textContent =
    `${b.title || 'Untitled'}${b.author ? ' — ' + b.author : ''}`;
  const form = document.getElementById('log-form');
  form.dataset.idx = String(idx);
  document.getElementById('log-pages').value = '';
  document.getElementById('log-modal').classList.add('show');
  setTimeout(() => document.getElementById('log-pages').focus(), 0);
}
function closeLogModal() {
  const m = document.getElementById('log-modal');
  if (m) m.classList.remove('show');
}

/* ---------- Initialization ---------- */
window.addEventListener('DOMContentLoaded', () => {
  renderBooks();
  renderBadges(); // compute initial points/badges

  // Top nav actions
  const addBtn = document.getElementById('add-trigger');
  if (addBtn) addBtn.addEventListener('click', (e) => { e.preventDefault(); showAddPanel(); });

  // If you have a "Shelf" button: data-tab="shelf"
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.lib-tab');
    if (!tab) return;
    const t = tab.dataset.tab;
    if (t === 'shelf') showShelf();
    if (t === 'add') showAddPanel();
    if (t === 'badges') showBadgesPanel();
    // (favorites tab left as-is for later)
  });

  document.querySelectorAll('.lib-subtab').forEach(btn =>
    btn.addEventListener('click', () => switchMethod(btn.dataset.method))
  );

  const manualBtn = document.getElementById('manual-add');
  if (manualBtn) manualBtn.addEventListener('click', () => {
    const title = document.getElementById('manual-title').value.trim();
    if (!title) return;
    const books = getBooks();
    books.push({ title, readPages: 0 });
    saveBooks(books);
    renderBooks();
    renderBadges();
    document.getElementById('manual-title').value = '';
  });

  const openCam = document.getElementById('open-camera');
  if (openCam) openCam.addEventListener('click', startScanner);

  // Delegate "Log reading" button
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest('.log-btn');
    if (btn) openLogModal(Number(btn.dataset.idx));
  });
});

window.addEventListener('beforeunload', stopScanner);
