/* Ја пресликува www/ во docs/app/, за да може апликацијата да се отвори директно
   во прелистувач од GitHub Pages — без APK, и на iPhone и на компјутер.

   Постојат две копии на веб-слојот (една во APK-от, една на Pages), па оваа
   скрипта е единствениот начин втората да се обнови. selftest.js паѓа ако
   docs/app/ заостанува зад www/, за да не се случи тоа тивко.

   Изврши: node tools/sync-pages.js */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'www');
const DST = path.join(__dirname, '..', 'docs', 'app');

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  const want = new Set(fs.readdirSync(src));

  // Прво тргни го она што повеќе не постои во www/.
  for (const name of fs.readdirSync(dst)) {
    if (!want.has(name)) fs.rmSync(path.join(dst, name), { recursive: true, force: true });
  }

  let copied = 0;
  for (const name of want) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) { copied += copyTree(s, d); continue; }
    const from = fs.readFileSync(s);
    if (!fs.existsSync(d) || !fs.readFileSync(d).equals(from)) { fs.writeFileSync(d, from); copied++; }
  }
  return copied;
}

const n = copyTree(SRC, DST);
console.log(n ? `docs/app/ обновено — ${n} ${n === 1 ? 'датотека' : 'датотеки'}` : 'docs/app/ веќе е во чекор со www/');
