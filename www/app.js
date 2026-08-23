/* Добрина — една добра работа неделно, кажана на глас и испратена додека има кому.
   Текстот стои во localStorage, гласот и сликите во IndexedDB. Ништо не излегува од уредот
   освен кога корисникот сам притисне „Испрати“. */

const KEY = "dobrina.v1";
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ══════════ состојба ══════════ */
const EMPTY = {
  people: [],   // {id, name, relation, avatarId, birth:"MM-DD", slava, slavaMd, receive, createdAt}
  goods:  [],   // {id, personId, ts, kind, prompt, text, season, audioId, photoId, sentAt}
  settings: { onboarded: false, day: 0, promptOffset: 0, personOffset: 0, seenSurprise: null }
};

let S = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const p = JSON.parse(raw);
    return { ...structuredClone(EMPTY), ...p, settings: { ...EMPTY.settings, ...(p.settings || {}) } };
  } catch { return structuredClone(EMPTY); }
}
function save() { localStorage.setItem(KEY, JSON.stringify(S)); }

/* ══════════ медиуми (IndexedDB) ══════════ */
const DB_NAME = "dobrina", DB_STORE = "media";
let _db = null;

function open(version) {
  return new Promise((res, rej) => {
    const r = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(DB_STORE)) r.result.createObjectStore(DB_STORE);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
/* Ако базата постои но складот недостасува (прекинато прво отворање),
   се отвора повторно со поголема верзија за да се создаде. Гласовите
   што се тука не се повторливи — не смее да се потпираме на среќа. */
async function db() {
  if (_db) return _db;
  let d = await open();
  if (!d.objectStoreNames.contains(DB_STORE)) {
    const v = d.version + 1;
    d.close();
    d = await open(v);
  }
  return (_db = d);
}
function idb(mode, fn) {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(DB_STORE, mode);
    const req = fn(t.objectStore(DB_STORE));
    t.oncomplete = () => res(req ? req.result : undefined);
    t.onerror = () => rej(t.error);
  }));
}
const putMedia = (id, blob) => idb("readwrite", s => s.put(blob, id));
const getMedia = (id) => idb("readonly",  s => s.get(id));
const delMedia = (id) => idb("readwrite", s => s.delete(id));

/* Еднаш направен objectURL се чува — списоците се пре-исцртуваат често. */
const _urls = new Map();
async function mediaURL(id) {
  if (!id) return null;
  if (_urls.has(id)) return _urls.get(id);
  const b = await getMedia(id).catch(() => null);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  _urls.set(id, u);
  return u;
}

/* ══════════ помошни ══════════ */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const kindById = (id) => KINDS.find(k => k.id === id) || KINDS[0];
const personById = (id) => S.people.find(p => p.id === id) || null;
const goodsOf = (pid) => S.goods.filter(g => g.personId === pid).sort((a, b) => b.ts - a.ts);

const DAYS  = ["недела", "понеделник", "вторник", "среда", "четврток", "петок", "сабота"];
const DAYS3 = ["нед", "пон", "вто", "сре", "чет", "пет", "саб"];
const MONTHS = ["јануари", "февруари", "март", "април", "мај", "јуни", "јули", "август", "септември", "октомври", "ноември", "декември"];
const MON3  = ["јан", "фев", "мар", "апр", "мај", "јун", "јул", "авг", "сеп", "окт", "ное", "дек"];

const DAY_MS = 86400000;
const dayOf = (ts) => new Date(ts).toISOString().slice(0, 10);
const weekIndex = () => Math.floor(Date.now() / (7 * DAY_MS));

function relTime(ts) {
  const d = new Date(ts), diff = Date.now() - ts;
  if (diff < DAY_MS && dayOf(ts) === dayOf(Date.now())) return "денес";
  if (dayOf(ts) === dayOf(Date.now() - DAY_MS)) return "вчера";
  if (diff < 7 * DAY_MS) return Math.floor(diff / DAY_MS) + " дена";
  return `${d.getDate()} ${MON3[d.getMonth()]} ${d.getFullYear()}`;
}

/* Македонски: броевите на 1 (освен 11) одат со еднина. */
function plu(n, one, many) {
  const a = Math.abs(n);
  return (a % 10 === 1 && a % 100 !== 11) ? one : many;
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), 2600);
}

function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

/* Сликите се смалуваат пред да се зачуваат — телефоните немаат бескрајно место. */
async function shrinkImage(file, max = 1280, quality = 0.82) {
  const bmp = await loadBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return new Promise(res => c.toBlob(b => res(b || file), "image/jpeg", quality));
}
function loadBitmap(file) {
  if (window.createImageBitmap) return createImageBitmap(file);
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

const blobToDataURL = (b) => new Promise(res => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.readAsDataURL(b);
});

function extOf(mime) {
  if (!mime) return "bin";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  return mime.split("/")[1] || "bin";
}
const slug = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "dobrina";

/* Дава датотека на корисникот: прво преку споделување (Viber, WhatsApp…),
   ако нема — како преземање. */
async function deliverFile(blob, filename, text) {
  const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return "shared"; }
    catch (e) { if (e.name === "AbortError") return "cancel"; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20000);
  return "downloaded";
}

/* ══════════ онбординг ══════════ */
let obStep = 0;
const OB_LAST = 2;

function initOnboarding() {
  fillRelations($("#obRel"));
  $("#obDays").innerHTML = DAYS.map((d, i) =>
    `<button class="chip${i === 0 ? " on" : ""}" data-day="${i}">${d}</button>`).join("");
  $("#obDays").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    $$("#obDays .chip").forEach(c => c.classList.remove("on"));
    b.classList.add("on");
  });
  $$(".ob-next").forEach(b => b.addEventListener("click", () => gotoStep(obStep + 1)));
  $("#obDone").addEventListener("click", finishOnboarding);
}
function gotoStep(n) {
  if (n === 2 && !$("#obName").value.trim()) { toast("Напиши едно име."); return; }
  obStep = Math.max(0, Math.min(OB_LAST, n));
  $$(".ob-step").forEach(s => s.classList.toggle("hidden", +s.dataset.step !== obStep));
  $("#obBar").style.width = ((obStep + 1) / (OB_LAST + 1) * 100) + "%";
  window.scrollTo(0, 0);
}
function finishOnboarding() {
  const name = $("#obName").value.trim();
  if (!name) { toast("Напиши едно име."); return; }
  S.people.push({
    id: uid(), name, relation: $("#obRel").value, avatarId: null,
    birth: "", slava: "", slavaMd: "", receive: true, createdAt: Date.now()
  });
  S.settings.day = +($("#obDays .chip.on")?.dataset.day || 0);
  S.settings.onboarded = true;
  save();
  scheduleWeekly();
  $("#onboarding").classList.add("hidden");
  $("#app").classList.remove("hidden");
  renderAll();
}

function fillRelations(sel) {
  sel.innerHTML = RELATIONS.map(r => `<option value="${r}">${r}</option>`).join("");
}

/* ══════════ прашање на неделата ══════════ */
function orderedPeople() {
  // Оној што најдолго не бил спомнат оди прв.
  return [...S.people].sort((a, b) => {
    const la = goodsOf(a.id)[0]?.ts || 0;
    const lb = goodsOf(b.id)[0]?.ts || 0;
    return la - lb;
  });
}
function weeklyPick() {
  const ppl = orderedPeople();
  if (!ppl.length) return null;
  const wk = weekIndex();
  const po = S.settings.promptOffset | 0;
  const so = S.settings.personOffset | 0;
  const person = ppl[Math.abs(so) % ppl.length];
  const kind = KINDS[Math.abs(wk + po) % KINDS.length];
  const list = PROMPTS[kind.id];
  const prompt = list[Math.abs(wk * 3 + po) % list.length].replaceAll("{}", person.name);
  return { person, kind, prompt };
}

function renderWeekly() {
  const pick = weeklyPick();
  const card = $("#weeklyCard");
  if (!pick) {
    card.innerHTML = `<span class="kicker">Почни</span>
      <p class="weekly-q">Уште никого немаш додадено.</p>
      <button class="btn primary big" id="btnFirstPerson">Додај го првиот човек</button>`;
    $("#btnFirstPerson").addEventListener("click", () => openPersonSheet(null));
    return;
  }
  $("#weeklyPerson").innerHTML =
    `<span>${pick.kind.emoji}</span><span>${esc(pick.person.name)}</span>
     <button class="btn ghost small" id="btnSwapPerson" style="margin-left:auto">↻ друг</button>`;
  $("#weeklyQ").textContent = pick.prompt;
  $("#btnSwapPerson").addEventListener("click", () => {
    S.settings.personOffset = (S.settings.personOffset | 0) + 1;
    save(); renderWeekly();
  });
}

/* ══════════ изненадување ══════════ */
function renderSurprise() {
  const card = $("#surpriseCard");
  const old = S.goods.filter(g => Date.now() - g.ts > 21 * DAY_MS);
  if (!old.length) { card.classList.add("hidden"); return; }
  const seed = Math.floor(Date.now() / DAY_MS);
  const g = old[seed % old.length];
  $("#surpriseLead").textContent = SURPRISE_LEADS[seed % SURPRISE_LEADS.length];
  $("#surpriseBody").innerHTML = goodHTML(g, { compact: true });
  card.classList.remove("hidden");
  hydrate(card);
  wireGoodActions(card);
}

/* ══════════ приказ на добрина ══════════ */
function goodHTML(g, opt = {}) {
  const p = personById(g.personId);
  const k = kindById(g.kind);
  const season = g.season ? ` · ${esc(g.season)}` : "";
  const sent = g.sentAt ? `<span class="badge-sent">✓ испратено</span>` : "";
  const acts = opt.compact ? "" : `
    <div class="good-acts">
      <button class="btn ghost small" data-send="${g.id}">${p && p.receive ? "Испрати" : "Сподели"}</button>
      <button class="btn ghost small" data-del="${g.id}">Избриши</button>
      ${sent}
    </div>`;
  return `
    <article class="good" data-good="${g.id}">
      <div class="good-top">
        <span>${k.emoji}</span>
        <span class="good-kind">${esc(p ? p.name : "—")}</span>
        <span>· ${esc(k.name)} · ${relTime(g.ts)}${season}</span>
      </div>
      ${g.prompt ? `<p class="good-q">„${esc(g.prompt)}“</p>` : ""}
      ${g.text ? `<p class="good-text">${esc(g.text)}</p>` : ""}
      ${g.audioId ? `<audio controls preload="none" data-media="${g.audioId}"></audio>` : ""}
      ${g.photoId ? `<img class="gp hidden" data-media="${g.photoId}" alt="" />` : ""}
      ${acts}
    </article>`;
}

async function hydrate(root) {
  for (const el of $$("[data-media]", root)) {
    const url = await mediaURL(el.dataset.media);
    if (!url) continue;
    el.src = url;
    el.classList.remove("hidden");
  }
}

function wireGoodActions(root) {
  root.onclick = async (e) => {
    const s = e.target.closest("[data-send]");
    if (s) { const g = S.goods.find(x => x.id === s.dataset.send); if (g) await shareGood(g); return; }
    const d = e.target.closest("[data-del]");
    if (d) {
      const g = S.goods.find(x => x.id === d.dataset.del);
      if (!g) return;
      if (!confirm("Да се избрише оваа добрина?")) return;
      if (g.audioId) await delMedia(g.audioId);
      if (g.photoId) await delMedia(g.photoId);
      S.goods = S.goods.filter(x => x.id !== g.id);
      save(); renderAll(); toast("Избришано.");
    }
  };
}

/* ══════════ споделување на една добрина ══════════ */
function composeText(g, p) {
  const k = kindById(g.kind);
  const head = p.receive ? `${p.name}, ова е за тебе ${k.emoji}` : `За ${p.name} ${k.emoji}`;
  const body = g.text ? `\n\n${g.text}` : (g.prompt ? `\n\n„${g.prompt}“` : "");
  return head + body;
}

async function shareGood(g) {
  const p = personById(g.personId);
  if (!p) return;
  const text = composeText(g, p);
  const files = [];
  const base = `dobrina-${slug(p.name)}`;

  if (g.audioId) {
    const b = await getMedia(g.audioId);
    if (b) files.push(new File([b], `${base}.${extOf(b.type)}`, { type: b.type }));
  }
  if (g.photoId) {
    const b = await getMedia(g.photoId);
    if (b) files.push(new File([b], `${base}.jpg`, { type: b.type || "image/jpeg" }));
  }

  try {
    if (files.length && navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({ files, text });
    } else if (navigator.share) {
      await navigator.share({ text, title: "Добрина" });
    } else {
      await navigator.clipboard.writeText(text);
      toast("Копирано — залепи го во Viber.");
    }
    g.sentAt = Date.now();
    save(); renderAll();
  } catch (e) {
    if (e.name !== "AbortError") toast("Не успеа споделувањето.");
  }
}

/* ══════════ снимач ══════════ */
let recCtx = null;   // {personId, kind, prompt, season, audioBlob, photoBlob}
let rec = null;      // {mr, chunks, stream, t0, timer}

const AUDIO_MIMES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const pickMime = () => (window.MediaRecorder && AUDIO_MIMES.find(m => MediaRecorder.isTypeSupported(m))) || "";

function openRecorder(personId, preset) {
  const p = personById(personId);
  if (!p) { toast("Прво додај човек."); return; }
  const pick = preset || weeklyPick();
  recCtx = {
    personId,
    kind: (pick && pick.person.id === personId ? pick.kind.id : "dobro"),
    prompt: (pick && pick.person.id === personId ? pick.prompt : freshPrompt("dobro", p.name)),
    season: "", audioBlob: null, photoBlob: null
  };

  $("#recFor").textContent = "за " + p.name;
  $("#recQ").textContent = recCtx.prompt;
  $("#recKinds").innerHTML = KINDS.map(k =>
    `<button class="chip${k.id === recCtx.kind ? " on" : ""}" data-kind="${k.id}">${k.emoji} ${k.name}</button>`).join("");
  $("#recSeasons").innerHTML = SEASONS.map(s =>
    `<button class="chip" data-season="${esc(s)}">${esc(s)}</button>`).join("");

  $("#recText").value = "";
  $("#recPreview").classList.add("hidden");
  $("#recRedo").classList.add("hidden");
  $("#recPhotoPrev").classList.add("hidden");
  $("#recPhotoClear").classList.add("hidden");
  $("#recTime").textContent = "0:00";
  $("#recHint").textContent = "допри за да снимаш глас";
  $("#recBtn").classList.remove("rec");

  $("#recSheet").classList.remove("hidden");
}

function freshPrompt(kindId, name) {
  const list = PROMPTS[kindId];
  return list[Math.floor(Math.random() * list.length)].replaceAll("{}", name);
}

function closeRecorder() {
  stopStream();
  $("#recSheet").classList.add("hidden");
  recCtx = null;
}
function stopStream() {
  if (rec) {
    clearInterval(rec.timer);
    if (rec.mr && rec.mr.state === "recording") rec.mr.stop();
    rec.stream?.getTracks().forEach(t => t.stop());
    rec = null;
  }
}

async function toggleRecord() {
  if (rec) {                       // стоп
    rec.mr.stop();
    return;
  }
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    toast("Овој уред не дозволува снимање. Напиши го со збор.");
    return;
  }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { toast("Нема пристап до микрофонот."); return; }

  const mime = pickMime();
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  mr.onstop = () => {
    const blob = new Blob(chunks, { type: mime || "audio/webm" });
    recCtx.audioBlob = blob;
    const a = $("#recPreview");
    a.src = URL.createObjectURL(blob);
    a.classList.remove("hidden");
    $("#recRedo").classList.remove("hidden");
    $("#recHint").textContent = "снимено — слушни, па зачувај";
    $("#recBtn").classList.remove("rec");
    clearInterval(rec?.timer);
    stream.getTracks().forEach(t => t.stop());
    rec = null;
  };

  rec = { mr, chunks, stream, t0: Date.now(), timer: null };
  rec.timer = setInterval(() => {
    const s = Math.floor((Date.now() - rec.t0) / 1000);
    $("#recTime").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    if (s >= 180) mr.stop();          // три минути е повеќе од доволно
  }, 250);

  mr.start();
  $("#recBtn").classList.add("rec");
  $("#recHint").textContent = "снимам… допри за да запреш";
}

async function saveGood() {
  if (!recCtx) return;
  const text = $("#recText").value.trim();
  if (!recCtx.audioBlob && !text && !recCtx.photoBlob) {
    toast("Кажи, напиши или сликај нешто.");
    return;
  }
  stopStream();

  const g = {
    id: uid(), personId: recCtx.personId, ts: Date.now(),
    kind: recCtx.kind, prompt: recCtx.prompt, text,
    season: recCtx.season, audioId: null, photoId: null, sentAt: null
  };
  if (recCtx.audioBlob) { g.audioId = "a-" + g.id; await putMedia(g.audioId, recCtx.audioBlob); }
  if (recCtx.photoBlob) { g.photoId = "p-" + g.id; await putMedia(g.photoId, recCtx.photoBlob); }

  S.goods.push(g);
  S.settings.promptOffset = (S.settings.promptOffset | 0) + 1;   // следната недела друго прашање
  save();

  $("#recSheet").classList.add("hidden");
  recCtx = null;
  renderAll();
  openSend(g);
}

/* ══════════ испраќање ══════════ */
let sendGoodId = null;
function openSend(g) {
  sendGoodId = g.id;
  const p = personById(g.personId);
  $("#sendWho").textContent = p && p.receive
    ? `Нека го чуе ${p.name} — денес, не еден ден.`
    : `Сподели го со оние што го сакаат ${p ? p.name : "него"}.`;
  $("#btnSendNow").textContent = p && p.receive ? "Испрати сега" : "Сподели сега";
  $("#sendSheet").classList.remove("hidden");
}

/* ══════════ екрани ══════════ */
let curView = "Home";
let curPersonId = null;

function show(view) {
  curView = view;
  $$(".view").forEach(v => v.classList.toggle("hidden", v.id !== "view" + view));
  $$(".tab").forEach(t => t.classList.toggle("on", t.dataset.view === view));
  window.scrollTo(0, 0);
}

function renderAll() {
  renderHome();
  renderPeople();
  renderAllList();
  if (curPersonId) renderPerson(curPersonId);
}

function renderHome() {
  const h = new Date().getHours();
  const greet = h < 11 ? "Добро утро" : h < 18 ? "Добар ден" : "Добра вечер";
  const isDay = new Date().getDay() === S.settings.day;
  const thisWeek = S.goods.filter(g => Date.now() - g.ts < 7 * DAY_MS).length;
  $("#homeGreet").textContent = isDay && !thisWeek
    ? `${greet}. Денес е ${DAYS[S.settings.day]} — денот за едно добро.`
    : `${greet}.`;

  renderWeekly();
  renderSurprise();

  const n = S.goods.length, np = S.people.length;
  const sent = S.goods.filter(g => g.sentAt).length;
  $("#homeStats").innerHTML = `
    <div class="stat"><b>${n}</b><span>${plu(n, "добрина", "добрини")}</span></div>
    <div class="stat"><b>${np}</b><span>${plu(np, "човек", "луѓе")}</span></div>
    <div class="stat"><b>${sent}</b><span>${plu(sent, "испратена", "испратени")}</span></div>`;

  const recent = [...S.goods].sort((a, b) => b.ts - a.ts).slice(0, 5);
  const box = $("#homeRecent");
  box.innerHTML = recent.length
    ? recent.map(g => goodHTML(g)).join("")
    : `<p class="empty">Тука ќе стојат добрите работи што ќе ги кажеш.</p>`;
  hydrate(box);
  wireGoodActions(box);
}

function renderPeople() {
  const box = $("#peopleList");
  box.innerHTML = S.people.length
    ? S.people.map(p => {
        const n = goodsOf(p.id).length;
        return `<div class="person-row" data-person="${p.id}">
          <div class="av" data-media="${p.avatarId || ""}">${p.avatarId ? "" : esc(initials(p.name))}</div>
          <div>
            <div class="pr-name">${esc(p.name)}</div>
            <div class="pr-sub">${esc(p.relation)}${p.receive ? "" : " · само семејно"}</div>
          </div>
          <div class="pr-n">${n}</div>
        </div>`;
      }).join("")
    : `<p class="empty">Додај го првиот човек.</p>`;

  // Аватарите се <div>, па сликата оди како позадина.
  $$("[data-media]", box).forEach(async el => {
    if (!el.dataset.media) return;
    const u = await mediaURL(el.dataset.media);
    if (!u) return;
    el.style.background = `url(${u}) center/cover`;
    el.textContent = "";
  });

  box.onclick = (e) => {
    const row = e.target.closest("[data-person]");
    if (row) { curPersonId = row.dataset.person; renderPerson(curPersonId); show("Person"); }
  };

  renderUpcoming();
}

/* Роденден и слава — само она што доаѓа, без ниту еден датум на тага. */
function nextOccurrence(md) {
  if (!md || !/^\d{2}-\d{2}$/.test(md)) return null;
  const [m, d] = md.split("-").map(Number);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let dt = new Date(now.getFullYear(), m - 1, d);
  if (dt < now) dt = new Date(now.getFullYear() + 1, m - 1, d);
  return { dt, days: Math.round((dt - now) / DAY_MS) };
}
function renderUpcoming() {
  const items = [];
  for (const p of S.people) {
    for (const [md, what] of [[p.birth, "роденден"], [p.slavaMd, p.slava || "слава"]]) {
      const nx = nextOccurrence(md);
      if (nx && nx.days <= 60) items.push({ p, what, ...nx });
    }
  }
  items.sort((a, b) => a.days - b.days);
  $("#upcoming").innerHTML = items.length
    ? `<h3 class="sect">Наскоро</h3>` + items.map(i =>
        `<div class="up-item"><b>${i.days === 0 ? "денес" : "за " + i.days + " " + plu(i.days, "ден", "дена")}</b>
         · ${esc(i.p.name)} — ${esc(i.what)} (${i.dt.getDate()} ${MONTHS[i.dt.getMonth()]})</div>`).join("")
    : "";
}

let allFilter = "";
function renderAllList() {
  $("#allFilter").innerHTML =
    `<button class="chip${allFilter ? "" : " on"}" data-f="">сè</button>` +
    KINDS.map(k => `<button class="chip${allFilter === k.id ? " on" : ""}" data-f="${k.id}">${k.emoji} ${k.name}</button>`).join("");
  $("#allFilter").onclick = (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    allFilter = b.dataset.f; renderAllList();
  };
  const list = [...S.goods].filter(g => !allFilter || g.kind === allFilter).sort((a, b) => b.ts - a.ts);
  const box = $("#allList");
  box.innerHTML = list.length ? list.map(g => goodHTML(g)).join("") : `<p class="empty">Уште ништо тука.</p>`;
  hydrate(box);
  wireGoodActions(box);
}

function renderPerson(pid) {
  const p = personById(pid);
  if (!p) { show("People"); return; }
  const gs = goodsOf(pid);
  $("#personHead").innerHTML = `
    <div class="av lg" data-media="${p.avatarId || ""}">${p.avatarId ? "" : esc(initials(p.name))}</div>
    <div>
      <div class="ph-name">${esc(p.name)}</div>
      <div class="ph-sub">${esc(p.relation)} · ${gs.length} ${plu(gs.length, "добрина", "добрини")}</div>
      <button class="btn ghost small" id="btnEditPerson" style="margin-top:.4em">Уреди</button>
    </div>`;
  $$("[data-media]", $("#personHead")).forEach(async el => {
    if (!el.dataset.media) return;
    const u = await mediaURL(el.dataset.media);
    if (!u) return;
    el.style.background = `url(${u}) center/cover`;
    el.textContent = "";
  });
  $("#btnEditPerson").addEventListener("click", () => openPersonSheet(p.id));

  const box = $("#personWall");
  box.innerHTML = gs.length
    ? gs.map(g => goodHTML(g)).join("")
    : `<p class="empty">Ѕидот е празен. Кажи една добра работа за ${esc(p.name)}.</p>`;
  hydrate(box);
  wireGoodActions(box);
}

/* ══════════ книга ══════════ */
function bookEntriesHTML(p, gs, forExport) {
  return gs.slice().reverse().map(g => {
    const k = kindById(g.kind);
    return `<div class="book-entry">
      <div class="be-kind">${k.emoji} ${esc(k.name)}${g.season ? " · " + esc(g.season) : ""}</div>
      ${g.prompt ? `<div class="be-q">„${esc(g.prompt)}“</div>` : ""}
      ${g.text ? `<p>${esc(g.text)}</p>` : ""}
      ${g.audioId ? (forExport ? `<audio controls src="__A_${g.audioId}__"></audio>` : `<audio controls preload="none" data-media="${g.audioId}"></audio>`) : ""}
      ${g.photoId ? (forExport ? `<img src="__A_${g.photoId}__" alt="" />` : `<img class="gp hidden" data-media="${g.photoId}" alt="" />`) : ""}
      <div class="be-date">${relTime(g.ts)}</div>
    </div>`;
  }).join("");
}

function renderBook(pid) {
  const p = personById(pid);
  const gs = goodsOf(pid);
  $("#bookBody").innerHTML = `
    <h1>Книга на доброто</h1>
    <div class="book-sub">${esc(p.name)} · ${gs.length} ${plu(gs.length, "запис", "записи")}</div>
    ${gs.length ? bookEntriesHTML(p, gs, false) : `<p class="empty">Нема уште ништо за книгата.</p>`}`;
  hydrate($("#bookBody"));
}

/* ══════════ вечен извоз ══════════ */
async function buildExportHTML(people) {
  const parts = [];
  for (const p of people) {
    const gs = goodsOf(p.id);
    if (!gs.length) continue;
    let html = bookEntriesHTML(p, gs, true);
    // Медиумите се вградуваат како data: URI — датотеката мора да работи сама за себе.
    for (const g of gs) {
      for (const id of [g.audioId, g.photoId]) {
        if (!id) continue;
        const b = await getMedia(id);
        html = html.replaceAll(`__A_${id}__`, b ? await blobToDataURL(b) : "");
      }
    }
    let avatar = "";
    if (p.avatarId) {
      const b = await getMedia(p.avatarId);
      if (b) avatar = `<img class="av" src="${await blobToDataURL(b)}" alt="" />`;
    }
    parts.push(`<section class="person">
      <header>${avatar}<h2>${esc(p.name)}</h2><div class="rel">${esc(p.relation)}</div></header>
      ${html}
    </section>`);
  }

  return `<!DOCTYPE html><html lang="mk"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Книга на доброто</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; background: #fdf6ec; color: #3a2c22;
         max-width: 720px; margin: 0 auto; padding: 2.5rem 1.2rem 4rem; line-height: 1.6; }
  h1 { font-size: 2rem; margin: 0 0 .1em; }
  .lead { color: #8a7460; margin: 0 0 2.5rem; }
  section.person { margin: 3rem 0; }
  section.person header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;
                          border-bottom: 2px solid #c75b2a; padding-bottom: .8rem; }
  section.person h2 { margin: 0; font-size: 1.5rem; }
  .rel { color: #8a7460; font-size: .9rem; margin-left: auto; }
  img.av { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; }
  .book-entry { padding: 1.1rem 0; border-top: 1px solid #e8d9c5; }
  .be-kind { font-family: system-ui, sans-serif; font-size: .72rem; letter-spacing: .1em;
             text-transform: uppercase; color: #c75b2a; font-weight: 700; }
  .be-q { font-style: italic; color: #8a7460; font-size: .92rem; margin: .3em 0 .5em; }
  .be-date { font-family: system-ui, sans-serif; font-size: .78rem; color: #8a7460; margin-top: .5em; }
  .book-entry p { white-space: pre-wrap; margin: .3em 0 .6em; }
  .book-entry img { max-width: 100%; border-radius: 8px; display: block; margin: .6em 0; }
  audio { width: 100%; margin: .5em 0; }
  footer { margin-top: 4rem; color: #8a7460; font-size: .82rem; border-top: 1px solid #e8d9c5; padding-top: 1rem; }
  @media print { body { background: #fff } audio { display: none } }
</style></head><body>
<h1>Книга на доброто</h1>
<p class="lead">Сè што е тука беше кажано наглас, на човекот на кого се однесува.<br />
Составено ${new Date().getDate()} ${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}.</p>
${parts.join("\n")}
<footer>Оваа датотека е целосна сама за себе — сликите и гласовите се внатре во неа.
Не ѝ треба интернет, ниту апликација. Чувај копија на друго место.</footer>
</body></html>`;
}

async function exportPeople(people, filename) {
  toast("Се составува…");
  const html = await buildExportHTML(people);
  const blob = new Blob([html], { type: "text/html" });
  const mb = (blob.size / 1048576).toFixed(1);
  const how = await deliverFile(blob, filename, "Книга на доброто");
  if (how !== "cancel") toast(`Готово · ${mb} MB`);
}

/* ══════════ личност: лист ══════════ */
let editingId = null;
let pendingAvatar = null;

function openPersonSheet(id) {
  editingId = id;
  pendingAvatar = null;
  const p = id ? personById(id) : null;
  $("#personSheetTitle").textContent = p ? "Уреди" : "Нова личност";
  $("#pName").value = p ? p.name : "";
  fillRelations($("#pRel"));
  $("#pRel").value = p ? p.relation : RELATIONS[0];
  $("#pBirth").value = p && p.birth ? p.birth.split("-").reverse().join(".") : "";
  $("#pSlava").innerHTML = `<option value="">—</option>` +
    SLAVI.map(s => `<option value="${s.md}">${s.name}</option>`).join("");
  $("#pSlava").value = p ? (p.slavaMd || "") : "";
  $("#pReceive").checked = p ? !!p.receive : true;
  $("#pDelete").classList.toggle("hidden", !p);
  $("#pPhotoPrev").classList.add("hidden");
  if (p && p.avatarId) mediaURL(p.avatarId).then(u => {
    if (u) { $("#pPhotoPrev").src = u; $("#pPhotoPrev").classList.remove("hidden"); }
  });
  $("#personSheet").classList.remove("hidden");
}

async function savePerson() {
  const name = $("#pName").value.trim();
  if (!name) { toast("Треба име."); return; }
  const birthRaw = $("#pBirth").value.trim();
  const bm = birthRaw.match(/^(\d{1,2})[.\/-](\d{1,2})$/);
  const birth = bm ? `${String(bm[2]).padStart(2, "0")}-${String(bm[1]).padStart(2, "0")}` : "";
  if (birthRaw && !bm) { toast("Роденденот оди како дд.мм"); return; }

  const slavaMd = $("#pSlava").value;
  const slava = slavaMd ? (SLAVI.find(s => s.md === slavaMd)?.name || "") : "";

  let p = editingId ? personById(editingId) : null;
  if (!p) {
    p = { id: uid(), avatarId: null, createdAt: Date.now() };
    S.people.push(p);
  }
  Object.assign(p, { name, relation: $("#pRel").value, birth, slava, slavaMd, receive: $("#pReceive").checked });

  if (pendingAvatar) {
    if (p.avatarId) { await delMedia(p.avatarId); _urls.delete(p.avatarId); }
    p.avatarId = "av-" + p.id + "-" + Date.now().toString(36);
    await putMedia(p.avatarId, pendingAvatar);
  }
  save();
  $("#personSheet").classList.add("hidden");
  renderAll();
  toast("Зачувано.");
}

async function deletePerson() {
  const p = personById(editingId);
  if (!p) return;
  if (!confirm(`Да се избрише ${p.name} и сите добрини за него/неа?`)) return;
  for (const g of goodsOf(p.id)) {
    if (g.audioId) await delMedia(g.audioId);
    if (g.photoId) await delMedia(g.photoId);
  }
  if (p.avatarId) await delMedia(p.avatarId);
  S.goods = S.goods.filter(g => g.personId !== p.id);
  S.people = S.people.filter(x => x.id !== p.id);
  save();
  $("#personSheet").classList.add("hidden");
  curPersonId = null;
  show("People");
  renderAll();
}

/* ══════════ резерва ══════════ */
async function backupJSON() {
  const media = {};
  for (const g of S.goods) {
    for (const id of [g.audioId, g.photoId]) {
      if (!id) continue;
      const b = await getMedia(id);
      if (b) media[id] = await blobToDataURL(b);
    }
  }
  for (const p of S.people) {
    if (!p.avatarId) continue;
    const b = await getMedia(p.avatarId);
    if (b) media[p.avatarId] = await blobToDataURL(b);
  }
  const blob = new Blob([JSON.stringify({ v: 1, state: S, media })], { type: "application/json" });
  await deliverFile(blob, "dobrina-rezerva.json", "Резерва од Добрина");
}

async function restoreJSON(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data.state || !Array.isArray(data.state.people)) throw new Error("bad");
    if (!confirm("Ова ќе го замени сè што е сега во апликацијата. Да продолжам?")) return;
    for (const [id, durl] of Object.entries(data.media || {})) {
      const b = await (await fetch(durl)).blob();
      await putMedia(id, b);
    }
    S = { ...structuredClone(EMPTY), ...data.state, settings: { ...EMPTY.settings, ...(data.state.settings || {}) } };
    save();
    _urls.clear();
    renderAll();
    toast("Вратено.");
  } catch { toast("Датотеката не е валидна резерва."); }
}

/* ══════════ потсетник (само на Android, ако постои приклучокот) ══════════ */
async function scheduleWeekly() {
  const LN = window.Capacitor?.Plugins?.LocalNotifications;
  if (!LN) return;
  try {
    const perm = await LN.requestPermissions();
    if (perm.display !== "granted") return;
    await LN.cancel({ notifications: [{ id: 1 }] });
    const at = new Date();
    at.setHours(19, 0, 0, 0);
    while (at.getDay() !== S.settings.day || at <= new Date()) at.setDate(at.getDate() + 1);
    await LN.schedule({
      notifications: [{
        id: 1,
        title: "Една добра работа",
        body: "Триесет секунди. Некој чека да го чуе.",
        schedule: { at, repeats: true, every: "week" }
      }]
    });
  } catch { /* нема потсетник — апликацијата и понатаму работи */ }
}

/* ══════════ жици ══════════ */
function wire() {
  $$(".tab").forEach(t => t.addEventListener("click", () => show(t.dataset.view)));
  $("#btnSettings").addEventListener("click", () => { renderSettings(); show("Settings"); });
  $("#btnBackSettings").addEventListener("click", () => show("Home"));
  $("#btnBackPerson").addEventListener("click", () => show("People"));
  $("#btnBackBook").addEventListener("click", () => show("Person"));

  $("#btnAnswer").addEventListener("click", () => {
    const pick = weeklyPick();
    if (!pick) { openPersonSheet(null); return; }
    openRecorder(pick.person.id, pick);
  });
  $("#btnOtherQ").addEventListener("click", () => {
    S.settings.promptOffset = (S.settings.promptOffset | 0) + 1;
    save(); renderWeekly();
  });

  $("#btnAddPerson").addEventListener("click", () => openPersonSheet(null));
  $("#btnPersonAdd").addEventListener("click", () => openRecorder(curPersonId));
  $("#btnPersonBook").addEventListener("click", () => { renderBook(curPersonId); show("Book"); });
  $("#btnBookSave").addEventListener("click", () => {
    const p = personById(curPersonId);
    exportPeople([p], `kniga-na-dobroto-${slug(p.name)}.html`);
  });

  // снимач
  $("#recClose").addEventListener("click", closeRecorder);
  $("#recBtn").addEventListener("click", toggleRecord);
  $("#recRedo").addEventListener("click", () => {
    recCtx.audioBlob = null;
    $("#recPreview").classList.add("hidden");
    $("#recRedo").classList.add("hidden");
    $("#recTime").textContent = "0:00";
    $("#recHint").textContent = "допри за да снимаш глас";
  });
  $("#recSave").addEventListener("click", saveGood);
  $("#recSwapQ").addEventListener("click", () => {
    const p = personById(recCtx.personId);
    recCtx.prompt = freshPrompt(recCtx.kind, p.name);
    $("#recQ").textContent = recCtx.prompt;
  });
  $("#recKinds").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    $$("#recKinds .chip").forEach(c => c.classList.remove("on"));
    b.classList.add("on");
    recCtx.kind = b.dataset.kind;
    const p = personById(recCtx.personId);
    recCtx.prompt = freshPrompt(recCtx.kind, p.name);
    $("#recQ").textContent = recCtx.prompt;
  });
  $("#recSeasons").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    const was = b.classList.contains("on");
    $$("#recSeasons .chip").forEach(c => c.classList.remove("on"));
    if (!was) { b.classList.add("on"); recCtx.season = b.dataset.season; }
    else recCtx.season = "";
  });
  $("#recPhoto").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    recCtx.photoBlob = await shrinkImage(f);
    $("#recPhotoPrev").src = URL.createObjectURL(recCtx.photoBlob);
    $("#recPhotoPrev").classList.remove("hidden");
    $("#recPhotoClear").classList.remove("hidden");
    e.target.value = "";
  });
  $("#recPhotoClear").addEventListener("click", () => {
    recCtx.photoBlob = null;
    $("#recPhotoPrev").classList.add("hidden");
    $("#recPhotoClear").classList.add("hidden");
  });

  // испраќање
  $("#btnSendNow").addEventListener("click", async () => {
    const g = S.goods.find(x => x.id === sendGoodId);
    $("#sendSheet").classList.add("hidden");
    if (g) await shareGood(g);
  });
  $("#btnSendLater").addEventListener("click", () => $("#sendSheet").classList.add("hidden"));

  // личност
  $("#personClose").addEventListener("click", () => $("#personSheet").classList.add("hidden"));
  $("#pSave").addEventListener("click", savePerson);
  $("#pDelete").addEventListener("click", deletePerson);
  $("#pPhoto").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    pendingAvatar = await shrinkImage(f, 512);
    $("#pPhotoPrev").src = URL.createObjectURL(pendingAvatar);
    $("#pPhotoPrev").classList.remove("hidden");
    e.target.value = "";
  });

  // поставки
  $("#btnExportAll").addEventListener("click", () => exportPeople(S.people, "kniga-na-dobroto.html"));
  $("#btnBackup").addEventListener("click", backupJSON);
  $("#fileRestore").addEventListener("change", e => {
    const f = e.target.files[0];
    if (f) restoreJSON(f);
    e.target.value = "";
  });

  // затворање на листовите со допир надвор
  $$(".sheet").forEach(sh => sh.addEventListener("click", e => {
    if (e.target === sh) {
      if (sh.id === "recSheet") closeRecorder();
      else sh.classList.add("hidden");
    }
  }));
}

function renderSettings() {
  $("#setDays").innerHTML = DAYS3.map((d, i) =>
    `<button class="chip${i === S.settings.day ? " on" : ""}" data-day="${i}">${d}</button>`).join("");
  $("#setDays").onclick = (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    S.settings.day = +b.dataset.day;
    save(); renderSettings(); scheduleWeekly();
    toast("Прашањето доаѓа во " + DAYS[S.settings.day] + ".");
  };
  if (navigator.storage?.estimate) {
    navigator.storage.estimate().then(e => {
      const mb = (e.usage / 1048576).toFixed(1);
      $("#storageInfo").textContent = `Зафатено: ${mb} MB · ${S.goods.length} ${plu(S.goods.length, "запис", "записи")}.`;
    });
  } else {
    $("#storageInfo").textContent = `${S.goods.length} ${plu(S.goods.length, "запис", "записи")}.`;
  }
}

/* ══════════ старт ══════════ */
function start() {
  initOnboarding();
  wire();
  if (S.settings.onboarded) {
    $("#app").classList.remove("hidden");
    renderAll();
    scheduleWeekly();
  } else {
    $("#onboarding").classList.remove("hidden");
    gotoStep(0);
  }
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
start();
