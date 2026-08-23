/* Слики од апликацијата за страницата за преземање и за README.
   Вози врз инсталираниот Chrome (puppeteer-core, без свој Chromium — дискот е тесен),
   на 390×844 со deviceScaleFactor 2, па ги смалува 2× за остар текст.
   Состојбата се внесува пред апликацијата да се подигне, за да не се снима празна.
   Изврши: node tools/make-shots.js */

const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const WWW = path.join(__dirname, '..', 'www');
const OUT = path.join(__dirname, '..', 'docs');
const PORT = 4421;

const CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean).find((p) => fs.existsSync(p));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/* Примерок што ја покажува апликацијата како изгледа во употреба, не празна.
   Само текст — гласовите живеат во IndexedDB и не се снимаат тука. */
const SAMPLE = {
  people: [
    { id: 'p1', name: 'Дедо Ристо', relation: 'дедо', avatarId: null, birth: '', slava: 'Св. Никола', slavaMd: '12-19', receive: true, createdAt: 1 },
    { id: 'p2', name: 'Баба Цвета', relation: 'баба', avatarId: null, birth: '09-03', slava: '', slavaMd: '', receive: true, createdAt: 2 },
    { id: 'p3', name: 'Тетка Вера', relation: 'тетка', avatarId: null, birth: '', slava: '', slavaMd: '', receive: true, createdAt: 3 },
  ],
  goods: [
    { id: 'g1', personId: 'p1', ts: Date.now() - 2 * 86400000, kind: 'nauchiv',
      prompt: 'Што те научи Дедо Ристо со раце — нешто што сега го знаеш само поради него?',
      text: 'Ме научи да калемам слива. Уште држи, триесет години подоцна.',
      season: 'лето на село', audioId: null, photoId: null, sentAt: Date.now() - 2 * 86400000 },
    { id: 'g2', personId: 'p3', ts: Date.now() - 86400000, kind: 'dobro',
      prompt: 'Кога Тетка Вера ти помогна, а не мораше?',
      text: 'Ме однесе на испит со автомобил што едвај палеше. Не рече ни збор дека доцни на работа.',
      season: '', audioId: null, photoId: null, sentAt: Date.now() - 86400000 },
    { id: 'g3', personId: 'p2', ts: Date.now() - 40 * 86400000, kind: 'moment',
      prompt: 'Која работа Баба Цвета ја правеше секој ден во исто време?',
      text: 'Секое утро в шест ја отвораше портата за мачките. Сите шест ја чекаа.',
      season: 'лето на село', audioId: null, photoId: null, sentAt: null },
    { id: 'g4', personId: 'p1', ts: Date.now() - 9 * 86400000, kind: 'recept',
      prompt: 'Која зимница ја прави Дедо Ристо секоја година?',
      text: 'Ајварот се пече бавно, вели. Кој брза, јаде чад.',
      season: 'зимница', audioId: null, photoId: null, sentAt: Date.now() - 9 * 86400000 },
  ],
  settings: { onboarded: true, day: 5, promptOffset: 3, personOffset: 0, seenSurprise: null },
};

function serve() {
  return new Promise((res) => {
    const s = http.createServer((req, r) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const f = path.join(WWW, rel);
      if (!f.startsWith(WWW) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(r);
    });
    s.listen(PORT, () => res(s));
  });
}

async function shoot(page, name) {
  await new Promise((r) => setTimeout(r, 450));
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file });
  console.log('  ' + name + '.png');
}

(async () => {
  if (!CHROME) { console.error('Не најдов Chrome. Постави CHROME_PATH.'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--hide-scrollbars', '--force-device-scale-factor=2'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });

  // Онбординг — со празен склад, како првиот пат.
  await page.goto('http://localhost:' + PORT + '/index.html', { waitUntil: 'networkidle0' });
  await shoot(page, 'shot-onboarding');

  // Останатото — со внесен примерок пред апликацијата да се подигне.
  await page.evaluateOnNewDocument((s) => {
    localStorage.setItem('dobrina.v1', JSON.stringify(s));
  }, SAMPLE);

  await page.goto('http://localhost:' + PORT + '/index.html', { waitUntil: 'networkidle0' });
  await shoot(page, 'shot-home');

  await page.evaluate(() => document.querySelector('#btnAnswer').click());
  await shoot(page, 'shot-recorder');

  await page.evaluate(() => {
    document.querySelector('#recClose').click();
    document.querySelector('.tab[data-view="People"]').click();
    document.querySelector('#peopleList .person-row').click();
  });
  await shoot(page, 'shot-wall');

  await browser.close();
  server.close();
  console.log('готово → docs/');
})().catch((e) => { console.error(e); process.exit(1); });
