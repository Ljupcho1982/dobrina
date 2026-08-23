/* Добрина — сликата за LinkedIn (1200×630).
 *
 * Не ја прецртува апликацијата: ги вгнездува вистинските слики од docs/ што ги
 * прави make-shots.js, за да не почне сликата да лаже кога екраните ќе се сменат.
 *
 * Изврши: npm run social
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const DOCS = path.join(__dirname, '..', 'docs');
const OUT = path.join(DOCS, 'linkedin.png');
const W = 1200, H = 630;

const CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean).find((p) => fs.existsSync(p));

const b64 = (name) => {
  const f = path.join(DOCS, name);
  if (!fs.existsSync(f)) throw new Error('недостасува ' + name + ' — изврши прво: npm run shots');
  return 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
};

const page = `<!doctype html><html lang="mk"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,700&display=swap">
<style>
  :root { --bg:#fdf6ec; --card:#fffaf3; --line:#e8d9c5; --ink:#3a2c22; --dim:#8a7460;
          --accent:#c75b2a; --honey:#d9a441; }
  * { box-sizing:border-box; margin:0; }
  body { width:${W}px; height:${H}px; background:var(--bg); color:var(--ink); overflow:hidden;
    font:16px/1.5 "Segoe UI", system-ui, sans-serif; position:relative;
    display:grid; grid-template-columns:1fr 264px 264px; gap:26px; padding:52px 54px; align-items:center; }

  .glow { position:absolute; width:620px; height:620px; border-radius:50%; left:-230px; bottom:-260px;
    background:radial-gradient(circle, rgba(217,164,65,.34), rgba(217,164,65,0) 66%); pointer-events:none; }

  .left { position:relative; }
  .brand { display:flex; align-items:center; gap:11px; margin-bottom:24px; }
  .brand svg { width:38px; height:38px; }
  .brand span { font-family:Literata,Georgia,serif; font-size:24px; font-weight:700; letter-spacing:-.02em; }

  h1 { font-family:Literata,Georgia,serif; font-size:50px; font-weight:700; letter-spacing:-.035em;
       line-height:1.04; margin-bottom:18px; }
  .lead { font-size:19px; line-height:1.45; color:var(--ink); max-width:430px; }
  .lead b { color:var(--accent); }

  .chips { display:flex; gap:8px; margin-top:24px; flex-wrap:wrap; }
  .chip { border:1px solid var(--line); background:var(--card); padding:7px 14px; border-radius:999px;
    font-size:13.5px; font-weight:600; }
  .chip.hot { background:var(--accent); border-color:var(--accent); color:#fff; }

  .url { margin-top:26px; font-size:16px; font-weight:700; color:var(--accent); letter-spacing:.01em; }

  .shot { position:relative; border:1px solid var(--line); border-radius:20px; overflow:hidden;
    box-shadow:0 14px 40px rgba(90,60,30,.16); background:var(--card); }
  .shot img { width:100%; display:block; }
  .shot.a { transform:rotate(-1.6deg); }
  .shot.b { transform:rotate(1.6deg); }
</style></head><body>
  <div class="glow"></div>

  <div class="left">
    <div class="brand">
      <svg viewBox="0 0 64 64">
        <path d="M10 14h44a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H28L16 55v-11h-6a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z" fill="#c75b2a"/>
        <path d="M32 36s-9-5.4-9-11.2A5 5 0 0 1 32 21a5 5 0 0 1 9 3.8C41 30.6 32 36 32 36Z" fill="#d9a441"/>
      </svg>
      <span>Добрина</span>
    </div>

    <h1>Имаш ли снимен<br>глас на дедо ти?</h1>

    <p class="lead">Едно прашање неделно, триесет секунди глас — и апликацијата ти помага <b>да му го испратиш денес</b>. Архивата се составува сама.</p>

    <div class="chips">
      <div class="chip hot">без сметка</div>
      <div class="chip">офлајн</div>
      <div class="chip">отворен код</div>
      <div class="chip">без синтетички глас</div>
    </div>

    <div class="url">ljupcho1982.github.io/dobrina</div>
  </div>

  <div class="shot a"><img src="${b64('shot-home.png')}"></div>
  <div class="shot b"><img src="${b64('shot-wall.png')}"></div>
</body></html>`;

/* Квадратната верзија: се објавува како статус сама за себе, без текст под неа,
   па описот мора да е врз сликата. 1080×1080 оди и на LinkedIn и на Facebook. */
const S = 1080;
const square = `<!doctype html><html lang="mk"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,700&display=swap">
<style>
  :root { --bg:#fdf6ec; --card:#fffaf3; --line:#e8d9c5; --ink:#3a2c22; --dim:#8a7460;
          --accent:#c75b2a; --honey:#d9a441; }
  * { box-sizing:border-box; margin:0; }
  body { width:${S}px; height:${S}px; background:var(--bg); color:var(--ink); overflow:hidden;
    font:16px/1.5 "Segoe UI", system-ui, sans-serif; position:relative; padding:70px 68px; }

  .glow { position:absolute; width:760px; height:760px; border-radius:50%; left:-300px; bottom:-330px;
    background:radial-gradient(circle, rgba(217,164,65,.38), rgba(217,164,65,0) 66%); }
  .shot { position:absolute; right:-24px; bottom:-70px; width:236px; transform:rotate(5deg);
    border:1px solid var(--line); border-radius:22px; overflow:hidden;
    box-shadow:0 20px 56px rgba(90,60,30,.20); background:var(--card); }
  .shot img { width:100%; display:block; }

  .z { position:relative; height:100%; display:flex; flex-direction:column; }
  .brand { display:flex; align-items:center; gap:12px; margin-bottom:44px; }
  .brand svg { width:44px; height:44px; }
  .brand span { font-family:Literata,Georgia,serif; font-size:28px; font-weight:700; letter-spacing:-.02em; }

  h1 { font-family:Literata,Georgia,serif; font-size:72px; font-weight:700; letter-spacing:-.04em;
       line-height:1.02; margin-bottom:26px; }
  .desc { font-size:25px; line-height:1.45; max-width:640px; color:var(--ink); }
  .desc b { color:var(--accent); }

  .rule { width:64px; height:4px; background:var(--accent); border-radius:2px; margin:34px 0 28px; }
  .steps { display:flex; flex-direction:column; gap:12px; max-width:540px; }
  .step { display:flex; align-items:baseline; gap:14px; font-size:23px; }
  .step i { font-style:normal; font-family:Literata,Georgia,serif; font-weight:700; color:var(--accent);
    font-size:21px; min-width:26px; }

  .kicker { font-family:Literata,Georgia,serif; font-size:26px; line-height:1.4; color:var(--dim);
    max-width:520px; margin-top:38px; }
  .kicker b { color:var(--ink); font-weight:700; }
  .foot { margin-top:auto; }
  .chips { display:flex; gap:9px; flex-wrap:wrap; margin-bottom:22px; }
  .chip { border:1px solid var(--line); background:var(--card); padding:9px 17px; border-radius:999px;
    font-size:16px; font-weight:600; }
  .chip.hot { background:var(--accent); border-color:var(--accent); color:#fff; }
  .url { font-size:21px; font-weight:700; color:var(--accent); }
</style></head><body>
  <div class="glow"></div>
  <div class="shot"><img src="${b64('shot-home.png')}"></div>

  <div class="z">
    <div class="brand">
      <svg viewBox="0 0 64 64">
        <path d="M10 14h44a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H28L16 55v-11h-6a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z" fill="#c75b2a"/>
        <path d="M32 36s-9-5.4-9-11.2A5 5 0 0 1 32 21a5 5 0 0 1 9 3.8C41 30.6 32 36 32 36Z" fill="#d9a441"/>
      </svg>
      <span>Добрина</span>
    </div>

    <h1>Имаш ли снимен<br>глас на дедо ти?</h1>

    <p class="desc">Мнозинството немаат ниту една секунда. А гласот е единственото што <b>не може да се направи подоцна</b>.</p>

    <div class="rule"></div>

    <div class="steps">
      <div class="step"><i>1</i><span>Едно прашање неделно за еден човек.</span></div>
      <div class="step"><i>2</i><span>Одговараш со глас, триесет секунди.</span></div>
      <div class="step"><i>3</i><span>И му го испраќаш — денес, не еден ден.</span></div>
    </div>

    <p class="kicker">А архивата? Се составува сама — <b>како нуспојава</b>.</p>

    <div class="foot">
      <div class="chips">
        <div class="chip hot">бесплатно</div>
        <div class="chip">офлајн</div>
        <div class="chip">без сметка</div>
        <div class="chip">отворен код</div>
      </div>
      <div class="url">ljupcho1982.github.io/dobrina</div>
    </div>
  </div>
</body></html>`;

async function shoot(browser, html, w, h, out) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 500));
  await p.screenshot({ path: out });
  await p.close();
  console.log(`${path.basename(out)} — ${w}×${h} @2x, ${Math.round(fs.statSync(out).size / 1024)} KB`);
}

(async () => {
  if (!CHROME) { console.error('Не најдов Chrome. Постави CHROME_PATH.'); process.exit(1); }
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  await shoot(browser, page, W, H, OUT);
  await shoot(browser, square, S, S, path.join(DOCS, 'status.png'));
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
