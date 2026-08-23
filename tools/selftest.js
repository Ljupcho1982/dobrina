/* Проверки на содржината и на кодот. Нема мрежа, нема прелистувач —
   само вчитување на data.js во празен контекст и неколку тврдења. */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const www = path.join(__dirname, "..", "www");
// `const` во vm не станува својство на контекстот, па го собираме сами на крајот.
const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(www, "data.js"), "utf8") +
  "\n;this.__ = { KINDS, PROMPTS, RELATIONS, SEASONS, SLAVI, SURPRISE_LEADS };",
  ctx
);

let failed = 0;
function ok(cond, msg) {
  if (cond) { console.log("  ok   " + msg); }
  else { console.log("  FAIL " + msg); failed++; }
}

console.log("data.js");
const { KINDS, PROMPTS, RELATIONS, SEASONS, SLAVI, SURPRISE_LEADS } = ctx.__;

ok(Array.isArray(KINDS) && KINDS.length >= 4, `KINDS: ${KINDS.length} вида`);
ok(new Set(KINDS.map(k => k.id)).size === KINDS.length, "KINDS: нема дупли id");
ok(KINDS.every(k => k.emoji && k.name && k.hint), "KINDS: секој има емоџи, име и опис");

let total = 0;
for (const k of KINDS) {
  const list = PROMPTS[k.id];
  ok(Array.isArray(list) && list.length >= 10, `PROMPTS.${k.id}: ${list ? list.length : 0} прашања`);
  if (!list) continue;
  total += list.length;
  ok(list.every(p => p.includes("{}")), `PROMPTS.${k.id}: сите содржат {}`);
  ok(new Set(list).size === list.length, `PROMPTS.${k.id}: нема дупли`);
  ok(list.every(p => p.length < 200), `PROMPTS.${k.id}: сите се кратки`);
}
ok(Object.keys(PROMPTS).every(id => KINDS.some(k => k.id === id)), "PROMPTS: нема вишок клучеви");
console.log(`  --   вкупно ${total} прашања`);

ok(RELATIONS.length >= 10 && new Set(RELATIONS).size === RELATIONS.length, `RELATIONS: ${RELATIONS.length}, без дупли`);
ok(SEASONS.length >= 5, `SEASONS: ${SEASONS.length}`);
ok(SURPRISE_LEADS.length >= 3, `SURPRISE_LEADS: ${SURPRISE_LEADS.length}`);

ok(SLAVI.every(s => /^\d{2}-\d{2}$/.test(s.md)), "SLAVI: сите датуми се MM-DD");
ok(SLAVI.every(s => { const [m, d] = s.md.split("-").map(Number); return m >= 1 && m <= 12 && d >= 1 && d <= 31; }),
   "SLAVI: датумите се во опсег");
ok(new Set(SLAVI.map(s => s.name)).size === SLAVI.length, "SLAVI: нема дупли имиња");

console.log("\nwww/");
for (const f of ["index.html", "app.js", "data.js", "styles.css", "sw.js", "manifest.json", "icon.svg", "icon-maskable.svg"]) {
  ok(fs.existsSync(path.join(www, f)), f);
}

const html = fs.readFileSync(path.join(www, "index.html"), "utf8");
const app = fs.readFileSync(path.join(www, "app.js"), "utf8");

// Секое $("#id") од app.js мора да постои — или во index.html,
// или меѓу јазлите што самиот app.js ги исцртува.
const ids = new Set([
  ...[...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]),
  ...[...app.matchAll(/id="([A-Za-z0-9_]+)"/g)].map(m => m[1])
]);
const missing = [...new Set([...app.matchAll(/\$\("#([A-Za-z0-9_]+)"\)/g)].map(m => m[1]))]
  .filter(id => !ids.has(id));
ok(missing.length === 0, "app.js: сите #id постојат во index.html" + (missing.length ? " — недостасуваат: " + missing.join(", ") : ""));

// Кешот на service worker мора да ги содржи сите датотеки.
const sw = fs.readFileSync(path.join(www, "sw.js"), "utf8");
ok(["index.html", "styles.css", "app.js", "data.js", "manifest.json"].every(f => sw.includes(f)),
   "sw.js: ги кешира сите датотеки");

const mf = JSON.parse(fs.readFileSync(path.join(www, "manifest.json"), "utf8"));
ok(mf.lang === "mk" && mf.display === "standalone", "manifest.json: mk / standalone");

console.log(failed ? `\n${failed} проверки паднаа.` : "\nСè помина.");
process.exit(failed ? 1 : 0);
