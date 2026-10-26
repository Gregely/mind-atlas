// Records docs/mind-atlas-guide.mp4 by driving the real app in Chromium.
//
//   npm run build && npx vite preview --port 4173     (in one terminal)
//   node scripts/record-guide.cjs                     (in another; needs Playwright and ffmpeg)
//
// Captions, title cards and the visible cursor are injected only for the recording.
const { chromium } = require('playwright');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const demo = require('./guide-demo-data.cjs');
const URL = 'http://localhost:4173/';
const W = 1280, H = 800;

// Injected into every page load: caption bar, title cards and a visible cursor.
const OVERLAY = () => {
  const install = () => {
    if (window.__guide) return;
    const css = document.createElement('style');
    css.textContent = `
      #g-cap{position:fixed;left:50%;bottom:26px;transform:translate(-50%,12px);z-index:99998;width:min(860px,90vw);
        padding:14px 22px 16px;background:color-mix(in srgb,var(--bg-2) 94%,transparent);border:1px solid var(--line-2);
        border-top:2px solid var(--accent);box-shadow:0 20px 60px rgba(0,0,0,.35);opacity:0;transition:opacity .5s,transform .5s;pointer-events:none}
      #g-cap.on{opacity:1;transform:translate(-50%,0)}
      #g-cap .s{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent)}
      #g-cap .t{font-family:'EB Garamond',Georgia,serif;font-size:21px;line-height:1.35;color:var(--ink);margin-top:4px}
      #g-card{position:fixed;inset:0;z-index:99997;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;
        text-align:center;opacity:0;transition:opacity .7s;pointer-events:none;color:var(--ink)}
      #g-card.on{opacity:1}
      #g-card h1{font-family:'Cormorant SC',serif;font-weight:500;font-size:84px;letter-spacing:.08em;margin:18px 0 6px}
      #g-card .e{font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:.25em;text-transform:uppercase;color:var(--ink-3)}
      #g-card .sub{font-family:'EB Garamond',serif;font-style:italic;font-size:24px;color:var(--ink-2)}
      #g-card ol{list-style:none;padding:0;margin:26px 0 0;text-align:left;font-family:'EB Garamond',serif;font-size:22px;line-height:1.5;max-width:760px}
      #g-card li{padding:8px 0;border-bottom:1px dotted var(--line-2);display:grid;grid-template-columns:48px 1fr}
      #g-card li b{font-family:'IBM Plex Mono',monospace;font-weight:400;font-size:13px;color:var(--accent);padding-top:6px}
      #g-card svg{stroke:var(--line-2);fill:none}
      #g-cur{position:fixed;left:0;top:0;z-index:99999;width:18px;height:18px;margin:-9px 0 0 -9px;border:1.5px solid var(--accent);border-radius:50%;
        pointer-events:none;transition:transform .15s,opacity .4s;background:color-mix(in srgb,var(--accent) 18%,transparent)}
      #g-cur::after{content:'';position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px;border-radius:50%;background:var(--accent)}
      #g-cur.down{transform:scale(.7)}
      .g-ripple{position:fixed;z-index:99999;width:40px;height:40px;margin:-20px 0 0 -20px;border:1px solid var(--accent);border-radius:50%;
        pointer-events:none;animation:g-rip .6s ease-out forwards}
      @keyframes g-rip{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}`;
    document.head.appendChild(css);
    const cap = document.createElement('div'); cap.id = 'g-cap'; cap.innerHTML = '<div class="s"></div><div class="t"></div>';
    const card = document.createElement('div'); card.id = 'g-card';
    const cur = document.createElement('div'); cur.id = 'g-cur';
    document.body.append(card, cap, cur);
    const pos = JSON.parse(sessionStorage.getItem('g-pos') || '[640,400]');
    cur.style.left = pos[0] + 'px'; cur.style.top = pos[1] + 'px';
    addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; sessionStorage.setItem('g-pos', JSON.stringify([e.clientX, e.clientY])); }, true);
    addEventListener('mousedown', (e) => { cur.classList.add('down'); const r = document.createElement('div'); r.className = 'g-ripple'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 700); }, true);
    addEventListener('mouseup', () => cur.classList.remove('down'), true);
    window.__guide = {
      say(step, text) {
        if (!text) { cap.classList.remove('on'); return; }
        const swap = () => { cap.querySelector('.s').textContent = step; cap.querySelector('.t').textContent = text; cap.classList.add('on'); };
        if (cap.classList.contains('on')) { cap.classList.remove('on'); setTimeout(swap, 350); } else swap();
      },
      card(html) { cur.style.opacity = html ? '0' : '1'; if (html) { card.innerHTML = html; card.classList.add('on'); } else card.classList.remove('on'); },
    };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: path.join(os.tmpdir(), 'mind-atlas-guide-' + Date.now()), size: { width: W, height: H } }, acceptDownloads: true });
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();
  const wait = (ms) => page.waitForTimeout(ms);
  const say = async (step, text, ms = 0) => { await page.evaluate(([s, t]) => window.__guide.say(s, t), [step, text]); if (ms) await wait(ms); };
  const card = async (html, ms = 0) => { await page.evaluate((h) => window.__guide.card(h), html); if (ms) await wait(ms); };
  let mx = 640, my = 400;
  const moveTo = async (x, y, steps = 28) => { await page.mouse.move(x, y, { steps }); mx = x; my = y; };
  const center = async (sel) => { await page.locator(sel).first().scrollIntoViewIfNeeded(); const b = await page.locator(sel).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const point = async (sel, steps) => { const [x, y] = await center(sel); await moveTo(x, y, steps); };
  const click = async (sel, steps) => { await point(sel, steps); await wait(250); await page.mouse.down(); await wait(90); await page.mouse.up(); await wait(300); };
  const key = async (k, ms = 400) => { await page.keyboard.press(k); await wait(ms); };
  // Global shortcuts are ignored while a text field has focus, as a person would first click away.
  const shortcut = async (k, ms = 400) => { await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); await key(k, ms); };
  const type = async (text, delay = 32) => { await page.keyboard.type(text, { delay }); };

  // ---- Opening ----
  await page.goto(URL);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.mouse.move(mx, my);
  await page.evaluate(() => document.fonts.ready);
  await card(`<div class="e">A guide</div><svg width="120" height="120" viewBox="-60 -60 120 120"><circle r="56"/><circle r="36"/><circle r="4" fill="var(--accent)" stroke="none"/><circle cx="25" cy="-25" r="3" fill="var(--ink)" stroke="none"/></svg><h1>Mind Atlas</h1><div class="sub">How to keep the notebook, and how to explore it</div>`, 4800);
  await card(null, 900);

  await say('Begin', 'Mind Atlas is a notebook for one entry a day: an idea, an event, a ramble. Each entry becomes a numbered plate, stored only in this browser.', 5200);
  await say('Begin', 'Open the writing desk with the Plate button, or press N from anywhere.', 1200);
  await click('.new-plate');
  await wait(900);

  // ---- Writing ----
  await say('Writing a plate', 'The title is optional. Write the body as you would in a field notebook; a blank line starts a new paragraph.', 600);
  await click('#ed-title', 20);
  await type('Example plate');
  await click('#ed-body', 20);
  await type('This is example text for the guide. Your own words go here: an idea, an event, or a ramble.\n\nA second paragraph. Paragraphs can be annotated later, when reading back.', 22);
  await wait(800);
  await say('Writing a plate', 'Choose a register: the intellectual mode of the entry. Observation, Question, Memory, Argument or Fragment.', 600);
  await click('.reg-option:has-text("Question")');
  await wait(700);
  await click('.reg-option:has-text("Observation")');
  await wait(1200);
  await say('Writing a plate', 'Add tags with Enter or a comma. Reuse the same tags across days: shared tags are what join plates into constellations.', 600);
  await click('#ed-tags', 20);
  for (const t of ['walking', 'city', 'light']) { await type(t, 60); await key('Enter', 500); }
  await say('Writing a plate', 'The glyph in the margin is drawn from your tags and length, so every plate looks different. Ctrl + Enter catalogues it.', 1600);
  await point('.ed-glyph svg', 30);
  await wait(2600);
  await key('Control+Enter', 2400);

  // ---- The plate ----
  await say('The plate', 'Each plate has a placard with its number, date and register, your text, and an annotated specimen glyph.', 5000);
  await point('.ab-row >> nth=0', 25);
  await say('The plate', 'Hover a paragraph to add a margin note. Notes sit beside the text and travel with the plate.', 900);
  await click('.ab-row >> nth=0 >> .ab-add', 15);
  await type('A margin note, added later.', 40);
  await key('Control+Enter', 1600);
  await say('The plate', 'Link the plate to an open question here, or press E to edit it. ← and → step to neighbouring plates.', 3800);

  // ---- Demo archive ----
  await say('Demonstration archive', 'The rest of this guide uses a demonstration archive of sixty placeholder plates, so each view has something to show.', 4200);
  await page.evaluate((d) => localStorage.setItem('mind-atlas:v1', JSON.stringify(d)), demo());
  await page.goto(URL + '#/');
  await page.reload();
  await page.mouse.move(mx, my);
  await wait(1200);

  // ---- Catalogue ----
  await say('I · Catalogue', 'The Catalogue is an accession ledger: every plate, newest first, grouped by month, with its glyph and tags.', 4200);
  await moveTo(820, 500, 30);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 140); await wait(160); }
  await wait(700);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -140); await wait(120); }
  await say('I · Catalogue', 'Filter by register in the left column. Clicking a tag on any plate lists every plate with that tag.', 600);
  await click('.reg-filter:has-text("Memory")');
  await wait(2200);
  await click('.reg-filter:has-text("Memory")');
  await wait(800);

  // ---- Atlas ----
  await say('II · Atlas', 'Press 2 for the Atlas. Every plate is a body on a star chart. The oldest sit near the centre; the chart grows outward.', 300);
  await shortcut('2', 4800);
  const nodes = page.locator('.atlas-node');
  const nb = await nodes.nth(14).boundingBox();
  await say('II · Atlas', 'Hover a body for its placard. Lines join plates that share a tag; click a body to open its plate.', 300);
  await moveTo(nb.x + nb.width / 2, nb.y + nb.height / 2, 35);
  await wait(3600);
  await say('II · Atlas', 'The chart key lists constellations by size. Choose one to fly to it and light up its lines.', 300);
  await click('.legend-cons button:has-text("light")', 35);
  await wait(3400);
  await say('II · Atlas', 'Scroll to zoom and drag to pan. The graticule, scale bar and minimap follow you.', 300);
  await moveTo(700, 420, 25);
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -120); await wait(90); }
  await wait(600);
  await page.mouse.down(); await moveTo(560, 330, 40); await page.mouse.up();
  await wait(1200);
  await moveTo(1060, 640, 25);
  for (let i = 0; i < 18; i++) { await page.mouse.wheel(0, 160); await wait(70); }
  await say('II · Atlas', 'Zoom far in or far out and the chart has a few annotations of its own. Press 0 to see everything again.', 3200);
  await key('0', 2400);
  await click('.legend-cons button:has-text("light")', 20);
  await wait(800);

  // ---- Cabinet ----
  await say('III · Cabinet of Themes', 'Press 3 for the Cabinet: figures of your tags, registers and words over time. It shows patterns and never interprets them.', 300);
  await shortcut('3', 4200);
  await say('III · Cabinet of Themes', 'Fig. I is a periodic table of tags, numbered by first use. Select an element for its plates and dates.', 300);
  await click('.element >> nth=1', 30);
  await wait(3200);
  await moveTo(700, 500, 20);
  await say('III · Cabinet of Themes', 'Below: a spectrum of tag occurrence, strata of registers, the lexicon of most frequent words, and words per period.', 300);
  for (let i = 0; i < 24; i++) { await page.mouse.wheel(0, 90); await wait(150); }
  await wait(2200);

  // ---- Questions ----
  await say('IV · Open Questions', 'Press 4 to log questions you are carrying. They can stay open for as long as you like.', 300);
  await shortcut('4', 1500);
  await click('#q-new', 25);
  await type('Example question (three)', 45);
  await wait(400);
  await click('.q-log .btn');
  await wait(1200);
  await say('IV · Open Questions', 'Link plates to a question whenever you notice one bears on it. The diagram draws a line to each.', 300);
  await click('.qd-picker summary', 25);
  await wait(600);
  await click('.qd-picker li button >> nth=0', 20);
  await wait(500);
  await click('.qd-picker li button >> nth=2', 20);
  await wait(500);
  await click('.qd-picker li button >> nth=5', 20);
  await wait(2400);

  // ---- Reading back ----
  await say('V · Reading Back', 'Press 5 for Reading Back: a quiet mode that walks through your plates in date order.', 300);
  await shortcut('5', 1800);
  await click('text=Begin at Plate', 25);
  await wait(1800);
  await say('V · Reading Back', 'Turn plates with ← and →. Press A to write a margin note on what you read.', 1200);
  await key('a', 500);
  await type('A note written while reading back.', 40);
  await key('Control+Enter', 1500);
  await key('ArrowRight', 1600);
  await key('ArrowRight', 1600);
  const last = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('mind-atlas:v1')); return d.entries.sort((a, b) => (a.date < b.date ? -1 : 1)).pop().id; });
  await page.goto(URL + '#/reading/' + last);
  await wait(1400);
  await say('V · Reading Back', 'After the latest plate, → leads to Further Study: a page for what you want to pursue next.', 1400);
  await key('ArrowRight', 1400);
  await click('#fs-new', 25);
  await type('An example line of inquiry.', 45);
  await wait(300);
  await click('text=Enter in the record', 20);
  await wait(2400);

  // ---- Search, shortcuts, theme, archive ----
  await say('Search', 'Press / anywhere to search plates, margin notes, questions and Further Study.', 300);
  await shortcut('/', 700);
  await type('example question', 70);
  await wait(1800);
  await key('Escape', 500);
  await say('Shortcuts', 'Press ? for the keyboard reference card.', 300);
  await shortcut('?', 3000);
  await key('Escape', 500);
  await say('Two themes', 'Press T to switch between Ink and Paper.', 300);
  await shortcut('t', 2600);
  await say('VI · Archive', 'Press 6 for the Archive. Export JSON regularly: it is your backup, and it imports on another device. Markdown is for reading elsewhere.', 300);
  await shortcut('6', 1200);
  await point('text=Export JSON', 30);
  await wait(4200);
  await shortcut('t', 1000);
  await say('', '');

  // ---- Tips ----
  await card(`<div class="e">Using it well</div><h1 style="font-size:54px">Six habits</h1><ol>
    <li><b>01</b>Write when there is something to write. Nothing counts days or keeps score.</li>
    <li><b>02</b>Reuse your tags. Constellations and the periodic table are built from them.</li>
    <li><b>03</b>Pick the register that fits; the strata show how your modes layer over time.</li>
    <li><b>04</b>Log questions as they arise, and link plates to them later.</li>
    <li><b>05</b>Read back now and then. Annotate, and finish on Further Study.</li>
    <li><b>06</b>Export JSON from the Archive regularly. It is your only backup.</li></ol>`, 15000);
  await card(`<svg width="120" height="120" viewBox="-60 -60 120 120"><circle r="56"/><circle r="36"/><circle r="4" fill="var(--accent)" stroke="none"/><circle cx="25" cy="-25" r="3" fill="var(--ink)" stroke="none"/></svg><h1>Mind Atlas</h1><div class="sub">The atlas keeps growing.</div>`, 4500);

  const video = page.video();
  await ctx.close();
  const webm = await video.path();
  const out = path.join(__dirname, '..', 'docs', 'mind-atlas-guide.mp4');
  // Trim the blank first second, encode H.264 for broad playback.
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1.2', '-i', webm, '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', out]);
  console.log('Wrote', out);
  await browser.close();
})().catch(async (e) => { console.error(e.message.slice(0,300)); process.exit(1); });
