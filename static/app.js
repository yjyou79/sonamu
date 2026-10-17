const $ = (s) => document.querySelector(s);
const SCT_RE = /\[\[문장완성:\s*(.+?)\]\]/;
let state = null;   // 화면용 내담자 상태 (서버가 기록에서 만들어 준 모양)
let record = null;  // 전체 기록. 이 브라우저에만 저장되고 요청마다 서버로 보낸다
let busy = false;

const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!res.ok) {
    let msg = "문제가 생겼어요.";
    try { msg = (await res.json()).detail || msg; } catch {}
    throw new Error(msg);
  }
  return res;
}

// ---------- 기록 (이 브라우저에만 저장) ----------

const RECORDS_KEY = "yunseul.records";

function loadRecords() {
  try { return JSON.parse(storage.get(RECORDS_KEY)) || {}; } catch { return {}; }
}

function saveRecord(rec) {
  const all = loadRecords();
  all[rec.id] = { ...rec, savedAt: new Date().toISOString() };
  if (!storage.set(RECORDS_KEY, JSON.stringify(all))) {
    alert("이 브라우저에 기록을 저장하지 못했어요. 시크릿 창이거나 저장 공간이 부족하면 상담 내용이 남지 않아요.");
  }
}

function removeRecord(id) {
  const all = loadRecords();
  delete all[id];
  storage.set(RECORDS_KEY, JSON.stringify(all));
}

// 서버 응답({client, view})을 받아 저장하고 화면 상태를 바꾼다
function accept(res) {
  record = res.client;
  state = res.view;
  saveRecord(record);
}

// 지금 기록을 함께 보내는 요청
function post(path, extra = {}) {
  return api(path, { method: "POST", body: JSON.stringify({ client: record, ...extra }) }).then((r) => r.json());
}

// ---------- 입장 ----------

async function showWelcome() {
  $("#room").hidden = true;
  $("#welcome").hidden = false;
  const clients = Object.values(loadRecords()).sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
  const list = $("#clientList");
  list.innerHTML = "";
  $("#returning").hidden = clients.length === 0;
  for (const c of clients) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    const n = c.sessions?.length || 0;
    b.innerHTML = `<span></span><small>${n ? `${n}회기 함께함` : "첫 상담 전"}</small>`;
    b.firstChild.textContent = c.profile?.nickname || "이름 없는 내담자";
    b.onclick = () => enter(c.id);
    li.append(b);
    list.append(li);
  }
  const health = await api("/api/health").then((r) => r.json()).catch(() => ({ ok: false, problem: "서버에 연결하지 못했어요." }));
  $("#keyWarn").hidden = health.ok;
  $("#keyWarn").textContent = health.problem || "";
}

$("#newForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const res = await api("/api/new-client", { method: "POST", body: JSON.stringify({ nickname: $("#nickname").value }) }).then((r) => r.json());
    accept(res);
    enter(record.id);
  } catch (err) {
    alert(err.message);
  }
};

async function enter(id) {
  try {
    record = loadRecords()[id];
    // 예전 버전이 이 컴퓨터에 저장한 기록이면 브라우저로 옮겨 온다
    if (!record) accept(await api(`/api/legacy/${id}`).then((r) => r.json()));
    else accept(await post("/api/view"));
  } catch {
    storage.del("clientId");
    return showWelcome();
  }
  storage.set("clientId", id);
  $("#welcome").hidden = true;
  $("#room").hidden = false;
  renderMemory();
  renderLog();
  renderMode();
}

// ---------- 상담실 ----------

// 상담실 가운데 영역에 보일 화면: start | chat | test | result
function show(view) {
  $("#startPane").hidden = view !== "start";
  $("#log").hidden = view !== "chat";
  $("#composer").hidden = view !== "chat";
  $("#testPane").hidden = view !== "test";
  $("#resultPane").hidden = view !== "result";
  $("#endBtn").hidden = !isActive();
}

// 시작 인사가 실패해 대화가 비어 있으면 다시 시작할 수 있게 한다
function isActive() { return !!state.active && state.active.messages.some((m) => !m.hidden); }

function renderMode() {
  show(isActive() ? "chat" : "start");
  const n = state.sessions.length + 1;
  const name = state.nickname ? `${state.nickname}님, ` : "";
  const tested = state.tests.length > 0 || !!state.interpretation;
  $("#startText").textContent = n === 1
    ? `${name}반가워요. 이곳에서는 서두르지 않아도 괜찮아요. ` +
      (tested ? "마음 점검 결과와 해석을 바탕으로 상담을 시작할게요."
              : "상담 전에 마음 상태, 기질과 성격, 문장완성을 점검하면 윤슬이 결과를 해석해 드리고, 그 해석에서 상담을 시작할 수 있어요.")
    : `${name}다시 와 주셨네요. 지난 ${n - 1}번의 이야기를 기억하고 있어요. ${n}번째 상담을 시작할까요?`;
  $("#startBtn").textContent = n === 1 ? "첫 상담 시작하기" : `${n}번째 상담 시작하기`;
  // 첫 상담 전에는 점검 → 해석 → 상담 흐름을 보여 준다
  $("#startSteps").hidden = n !== 1;
  $("#step1").classList.toggle("done", state.tests.length > 0 || state.sct.length > 0);
  $("#step2").classList.toggle("done", !!state.interpretation);
  // 첫 상담 전 점검을 아직 안 했다면 점검을 먼저 권한다
  const suggestTest = n === 1 && !tested;
  $("#testBtn").textContent = tested ? "마음 점검 다시 하기" : "마음 점검 먼저 하기 · 약 20분";
  $("#testBtn").className = suggestTest ? "primary" : "ghost";
  $("#startBtn").className = suggestTest ? "ghost" : "primary";
  $("#startActions").prepend(suggestTest ? $("#testBtn") : $("#startBtn"));
}

function renderLog() {
  const log = $("#log");
  log.innerHTML = "";
  if (!state.active) return;
  const div = document.createElement("div");
  div.className = "session-divider";
  div.textContent = `${state.active.number}번째 상담 · ${state.active.started.slice(0, 10)}`;
  log.append(div);
  const msgs = state.active.messages.filter((m) => !m.hidden);
  msgs.forEach((m, i) => {
    if (m.role === "assistant") addCounselor(m.content, i === msgs.length - 1);
    else addClient(m.sct ? m.sct.answer : m.content, m.sct?.stem);
  });
  scrollDown();
}

function addClient(text, stem) {
  const el = document.createElement("div");
  el.className = "msg client";
  const b = document.createElement("div");
  b.className = "bubble";
  if (stem) {
    const tag = document.createElement("span");
    tag.className = "sct-tag";
    tag.textContent = `문장완성 「${stem}」`;
    b.append(tag, document.createTextNode(stem.includes("___") || text.startsWith(stem) ? text : `${stem} ${text}`));
  } else b.textContent = text;
  el.append(b);
  $("#log").append(el);
  scrollDown();
}

function addCounselor(text = "", withCard = false) {
  const el = document.createElement("div");
  el.className = "msg counselor";
  el.innerHTML = `<img src="/static/counselor.svg" class="avatar" alt=""><div class="bubble"></div>`;
  $("#log").append(el);
  const bubble = el.querySelector(".bubble");
  setCounselorText(bubble, text, withCard);
  return bubble;
}

function setCounselorText(bubble, text, withCard) {
  const m = text.match(SCT_RE);
  bubble.textContent = text.replace(SCT_RE, "").trim();
  if (m && withCard) addSctCard(m[1].trim(), bubble.closest(".msg"));
}

function addSctCard(stem, after) {
  const card = $("#sctTpl").content.firstElementChild.cloneNode(true);
  // "나는 ___ 때 가장 외롭다"처럼 빈칸이 가운데 있으면 문장 전체를 쓰도록 안내
  const blank = stem.includes("___");
  const stemEl = card.querySelector(".stem");
  stemEl.textContent = stem;
  stemEl.hidden = blank;
  const input = card.querySelector(".sct-input");
  input.placeholder = blank ? stem : "이어서 떠오르는 대로";
  card.onsubmit = (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v || busy) return;
    card.remove();
    send(v, stem);
  };
  card.querySelector(".skip").onclick = () => { card.remove(); $("#input").focus(); };
  after.after(card);
  setTimeout(() => input.focus(), 50);
  scrollDown();
}

function scrollDown() { const l = $("#log"); l.scrollTop = l.scrollHeight; }

function setStatus(s) {
  $("#status").textContent = { idle: "곁에 있어요", thinking: "생각하며 듣고 있어요…", writing: "이야기하는 중이에요" }[s];
  $("#sendBtn").disabled = s !== "idle";
}

async function streamFrom(path, extra = {}) {
  const body = { client: record, ...extra };
  let reviewDue = false;
  busy = true;
  setStatus("thinking");
  document.querySelectorAll(".sct-card").forEach((c) => c.remove());
  const bubble = addCounselor();
  bubble.innerHTML = `<span class="typing"><i></i><i></i><i></i></span>`;
  scrollDown();
  let text = "";
  let failed = false;
  try {
    const res = await api(path, { method: "POST", body: JSON.stringify(body) });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, i); buf = buf.slice(i + 2);
        const ev = raw.match(/^event: (.*)$/m)?.[1];
        const data = JSON.parse(raw.match(/^data: (.*)$/m)?.[1] ?? "null");
        if (ev === "delta") {
          if (!text) setStatus("writing");
          text += data;
          setCounselorText(bubble, text, false);
          scrollDown();
        } else if (ev === "replace") {
          text = data;
          setCounselorText(bubble, text, false);
        } else if (ev === "error") {
          failed = true;
          bubble.closest(".msg").classList.add("error");
          bubble.textContent = data;
        } else if (ev === "done") {
          // 답변까지 들어간 기록을 이 브라우저에 저장한다
          accept(data);
          reviewDue = data.review_due;
        }
      }
    }
  } catch (e) {
    failed = true;
    bubble.closest(".msg").classList.add("error");
    bubble.textContent = e.message;
  }
  if (!failed) setCounselorText(bubble, text, true);
  busy = false;
  setStatus("idle");
  renderMemory();
  if (reviewDue) reviewInBackground();
  if (!failed) $("#input").focus();
  return failed ? bubble.textContent : null;
}

// 몇 번 주고받을 때마다 윤슬의 기억(기본 정보, 사례개념화)을 중간 갱신한다
async function reviewInBackground() {
  const id = record.id;
  try {
    const r = await post("/api/review");
    // 그 사이 대화가 이어졌을 수 있어, 최신 기록에 바뀐 칸만 합친다
    if (record.id !== id) return;
    record = { ...record, profile: r.profile, formulation: r.formulation };
    accept(await post("/api/view"));
    renderMemory();
  } catch { /* 중간 갱신 실패는 상담을 방해하지 않는다 */ }
}

async function send(text, stem) {
  addClient(text, stem);
  await streamFrom("/api/message", { text, sct_stem: stem || null });
}

$("#startBtn").onclick = () => startSession();

async function startSession() {
  if (busy) return;
  $("#startError").hidden = true;
  state.active = { number: state.sessions.length + 1, started: new Date().toISOString(), messages: [] };
  renderLog();
  // 첫 인사를 받는 동안 대화 화면을 보여 준다
  show("chat");
  $("#composer").hidden = true;
  const error = await streamFrom("/api/session/start");
  if (error) {
    // 시작에 실패하면 시작 화면으로 돌아가 이유를 보여 준다
    renderMode();
    $("#startError").textContent = error;
    $("#startError").hidden = false;
  } else {
    renderMode();
  }
}

// ---------- 마음 점검 ----------

let defs = null;  // { groups, tests }
const run = { queue: [], ti: 0, qi: 0, answers: [], finished: 0 };
const testById = (id) => defs.tests.find((t) => t.id === id);

async function startTests() {
  if (busy) return;
  defs ??= await api("/api/tests").then((r) => r.json());
  // 어떤 점검을 할지 고르기: 아직 안 한 것은 기본으로 선택
  const list = $("#groupList");
  list.innerHTML = "";
  for (const g of defs.groups) {
    const done = g.tests.every((id) => id === "sct" ? state.sct.length > 0 : state.tests.some((r) => r.test === id));
    const label = document.createElement("label");
    label.className = "group-card";
    label.innerHTML = `<input type="checkbox"><div><strong></strong><span></span></div><em></em>`;
    label.querySelector("input").checked = !done;
    label.querySelector("input").value = g.id;
    label.querySelector("strong").textContent = g.title;
    label.querySelector("span").textContent = g.desc;
    label.querySelector("em").textContent = done ? "완료 · 다시 하기" : `약 ${g.minutes}분`;
    list.append(label);
  }
  $("#testPick").hidden = false;
  $("#testQuestion").hidden = true;
  show("test");
}

$("#pickStart").onclick = () => {
  const chosen = [...document.querySelectorAll("#groupList input:checked")].map((i) => i.value);
  if (!chosen.length) return finishTests(false);
  const queue = defs.groups.filter((g) => chosen.includes(g.id)).flatMap((g) => g.tests.map(testById));
  Object.assign(run, { queue, ti: 0, qi: 0, answers: [], finished: 0 });
  $("#testPick").hidden = true;
  $("#testQuestion").hidden = false;
  renderQuestion();
};
$("#pickCancel").onclick = () => renderMode();

function renderQuestion() {
  const t = run.queue[run.ti];
  const total = run.queue.reduce((s, x) => s + x.items.length, 0);
  const done = run.queue.slice(0, run.ti).reduce((s, x) => s + x.items.length, 0) + run.qi;
  $("#testName").textContent = `${run.ti + 1}/${run.queue.length} · ${t.title}`;
  $("#testCount").textContent = `${run.qi + 1} / ${t.items.length}`;
  $("#testBar").style.width = `${(done / total) * 100}%`;
  $("#testIntro").textContent = t.intro;
  const text = t.kind === "text";
  const stem = t.items[run.qi];
  $("#testQ").textContent = text ? (stem.includes("___") ? stem : `${stem} …`) : stem;
  $("#testOptions").hidden = text;
  $("#testText").hidden = !text;
  if (text) {
    const input = $("#testTextInput");
    input.value = run.answers[run.qi] || "";
    setTimeout(() => input.focus(), 30);
  } else {
    const box = $("#testOptions");
    box.innerHTML = "";
    t.options.forEach((label, v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "option" + (run.answers[run.qi] === v ? " chosen" : "");
      b.textContent = label;
      b.onclick = () => answer(v);
      box.append(b);
    });
  }
  $("#testBack").disabled = run.qi === 0;
}

async function answer(v) {
  if (busy) return;
  const t = run.queue[run.ti];
  run.answers[run.qi] = v;
  if (run.qi < t.items.length - 1) { run.qi++; return renderQuestion(); }
  // 한 검사를 마치면 바로 저장해, 중간에 그만둬도 마친 검사는 남는다
  busy = true;
  try {
    const body = t.kind === "text"
      ? { texts: t.items.map((_, i) => run.answers[i] || "") }
      : { answers: run.answers };
    accept(await post(`/api/tests/${t.id}`, body));
    run.finished++;
  } catch (e) {
    busy = false;
    return alert(e.message);
  }
  busy = false;
  if (run.ti < run.queue.length - 1) {
    Object.assign(run, { ti: run.ti + 1, qi: 0, answers: [] });
    renderQuestion();
  } else {
    finishTests(true);
  }
}

$("#testText").onsubmit = (e) => { e.preventDefault(); answer($("#testTextInput").value.trim()); };
$("#testTextInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("#testText").requestSubmit(); }
});
$("#testSkip").onclick = () => answer("");
$("#testBack").onclick = () => {
  const t = run.queue[run.ti];
  if (t.kind === "text") run.answers[run.qi] = $("#testTextInput").value.trim();
  if (run.qi > 0) { run.qi--; renderQuestion(); }
};
$("#testQuit").onclick = () => finishTests(run.finished > 0);
$("#testBtn").onclick = () => startTests();

async function finishTests(reinterpret) {
  renderMemory();
  if (!state.tests.length && !state.sct.length) return renderMode();
  showResults(reinterpret);
}

// 검사별 최신 결과 + 해석. reinterpret이면 해석을 새로 만든다
async function showResults(reinterpret) {
  const latest = {};
  for (const r of state.tests) latest[r.test] = r;

  const list = $("#resultList");
  list.innerHTML = "";
  for (const r of Object.values(latest)) {
    if (r.test === "tci") continue;
    const row = document.createElement("div");
    row.className = "result-row";
    row.innerHTML = `<div class="result-head"><strong></strong><span class="level"></span></div>
      <div class="bar"><i></i></div><small></small>`;
    row.querySelector("strong").textContent = r.title;
    row.querySelector(".level").textContent = r.level;
    row.querySelector("i").style.width = `${(r.score / r.max) * 100}%`;
    row.querySelector("small").textContent = `${r.score} / ${r.max}점` + (r.higher_is_better ? " · 높을수록 자신을 긍정적으로 봐요" : "");
    list.append(row);
  }
  if (state.sct.length) {
    const row = document.createElement("div");
    row.className = "result-row";
    row.innerHTML = `<div class="result-head"><strong>문장완성</strong><span class="level"></span></div>`;
    row.querySelector(".level").textContent = `${state.sct.length}문장 작성`;
    list.append(row);
  }

  const tci = latest.tci;
  $("#tciBox").hidden = !tci;
  if (tci) {
    const box = $("#tciBox");
    box.innerHTML = `<h3>기질과 성격</h3><p class="note">이 앱의 자체 문항(TCI 모델 참고)으로 본 상대적 경향이에요. 높고 낮음에 좋고 나쁨은 없어요.</p>`;
    for (const group of ["기질", "성격"]) {
      const sec = document.createElement("div");
      sec.className = "tci-group";
      sec.innerHTML = `<span class="tci-label"></span>`;
      sec.firstChild.textContent = group;
      for (const d of Object.values(tci.dims).filter((d) => d.group === group)) {
        const row = document.createElement("div");
        row.className = "tci-row";
        row.title = d.meaning;
        row.innerHTML = `<span></span><div class="bar"><i></i></div><em></em>`;
        row.querySelector("span").textContent = d.name;
        row.querySelector("i").style.width = `${d.pct}%`;
        row.querySelector("em").textContent = d.level;
        sec.append(row);
      }
      box.append(sec);
    }
  }

  $("#resultCrisis").hidden = !latest.phq9?.flags.includes("self_harm_thoughts");
  $("#resultGo").textContent = isActive() ? "상담으로 돌아가기" : "이 해석을 바탕으로 상담 시작하기";
  show("result");

  const box = $("#interpBox");
  box.hidden = false;
  if (!reinterpret && state.interpretation) return renderInterpretation(state.interpretation);
  box.innerHTML = `<div class="interp-loading"><span class="typing"><i></i><i></i><i></i></span> 윤슬이 결과를 함께 읽고 해석하고 있어요…</div>`;
  $("#resultGo").disabled = true;
  try {
    accept(await post("/api/interpretation"));
    renderInterpretation(state.interpretation);
    renderMemory();
  } catch (e) {
    box.innerHTML = `<p class="warn"></p><button class="link" id="interpRetry">다시 해석하기</button>`;
    box.querySelector("p").textContent = e.message;
    $("#interpRetry").onclick = () => showResults(true);
  }
  $("#resultGo").disabled = false;
}

function renderInterpretation(it) {
  const box = $("#interpBox");
  box.innerHTML = "";
  const add = (title, body) => {
    if (!body || (Array.isArray(body) && !body.length)) return;
    const sec = document.createElement("section");
    const h = document.createElement("h3");
    h.textContent = title;
    sec.append(h);
    if (Array.isArray(body)) {
      const ul = document.createElement("ul");
      for (const b of body) { const li = document.createElement("li"); li.textContent = b; ul.append(li); }
      sec.append(ul);
    } else {
      const p = document.createElement("p");
      p.textContent = body;
      sec.append(p);
    }
    box.append(sec);
  };
  add("윤슬의 해석", it.overview);
  add("지금의 마음", it.mood);
  add("타고난 기질", it.temperament);
  add("살아오며 자란 성격", it.character);
  if (it.sct_themes?.length) {
    const sec = document.createElement("section");
    sec.innerHTML = "<h3>문장완성에서 보이는 이야기</h3>";
    for (const th of it.sct_themes) {
      const d = document.createElement("div");
      d.className = "theme";
      d.innerHTML = "<strong></strong><blockquote></blockquote><p></p>";
      d.querySelector("strong").textContent = th.theme;
      d.querySelector("blockquote").textContent = th.quotes.map((q) => `「${q.replace(/^「|」$/g, "")}」`).join("  ");
      d.querySelector("p").textContent = th.meaning;
      sec.append(d);
    }
    box.append(sec);
  }
  add("당신의 힘", it.strengths);
  add("성장의 실마리", it.growth_points);
  add("상담에서 함께 살펴보고 싶은 것", it.counseling_focus);
  const foot = document.createElement("p");
  foot.className = "note";
  foot.textContent = `${it.date} 해석 · 진단이 아닌 가설이에요. 상담하며 함께 고쳐 나가요.`;
  box.append(foot);
}

$("#resultGo").onclick = () => (isActive() ? renderMode() : startSession());

$("#composer").onsubmit = (e) => {
  e.preventDefault();
  const t = $("#input").value.trim();
  if (!t || busy) return;
  $("#input").value = "";
  autoGrow();
  send(t);
};
$("#input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("#composer").requestSubmit(); }
});
function autoGrow() { const t = $("#input"); t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 180) + "px"; }
$("#input").addEventListener("input", autoGrow);

$("#endBtn").onclick = async () => {
  if (busy) return;
  if (!confirm("오늘 상담을 마칠까요? 윤슬이 오늘 이야기를 정리해 기억해 둘게요.")) return;
  busy = true;
  $("#endBtn").disabled = true;
  setStatus("thinking");
  $("#status").textContent = "오늘 이야기를 정리하고 있어요…";
  try {
    accept(await post("/api/session/end"));
    renderMemory();
    renderMode();
    if (window.innerWidth <= 860) $("#memory").classList.add("open");
  } catch (e) {
    alert(e.message);
  }
  busy = false;
  $("#endBtn").disabled = false;
  setStatus("idle");
};

// ---------- 기억 패널 ----------

const LABELS = {
  presenting_concerns: "지금 마음을 무겁게 하는 것",
  recurring_patterns: "반복되는 흐름",
  core_beliefs: "마음 깊은 곳의 믿음 (가설)",
  triggers: "흔들리게 하는 순간",
  relationships: "관계 속의 나",
  coping: "버텨 온 방식",
  strengths: "당신의 힘",
  goals: "함께 정한 방향",
};

function renderProgress() {
  const p = state.progress;
  $("#barIntake").style.width = `${Math.min(100, (p.intake / p.intake_total) * 100)}%`;
  $("#barSct").style.width = `${Math.min(100, (p.sct / p.sct_total) * 100)}%`;
  $("#numIntake").textContent = `${p.intake}/${p.intake_total}`;
  $("#numSct").textContent = `${Math.min(p.sct, p.sct_total)}/${p.sct_total}`;
}

function renderTests() {
  const box = $("#testsBox");
  box.innerHTML = "<h3>마음 점검</h3>";
  // 검사별 최신 결과와 직전 결과
  const byTest = {};
  for (const r of state.tests) (byTest[r.test] ??= []).push(r);
  const ul = document.createElement("ul");
  ul.className = "test-list";
  for (const rs of Object.values(byTest)) {
    const cur = rs[rs.length - 1], prev = rs[rs.length - 2];
    const li = document.createElement("li");
    li.innerHTML = "<span></span><b></b>";
    li.querySelector("span").textContent = cur.short;
    let txt = "완료";
    if (cur.test !== "tci") {
      txt = `${cur.level} · ${cur.score}점`;
      if (prev) { const d = cur.score - prev.score; txt += ` (${d >= 0 ? "+" : ""}${d})`; }
    }
    li.querySelector("b").textContent = txt;
    ul.append(li);
  }
  if (state.sct.length) {
    const li = document.createElement("li");
    li.innerHTML = `<span>문장완성</span><b></b>`;
    li.querySelector("b").textContent = `${state.sct.length}문장`;
    ul.append(li);
  }
  if (ul.children.length) box.append(ul);
  else box.insertAdjacentHTML("beforeend", `<p class="empty">아직 점검 전이에요.</p>`);
  const actions = document.createElement("div");
  actions.className = "link-row";
  if (state.interpretation) {
    const v = document.createElement("button");
    v.className = "link";
    v.textContent = "해석 다시 보기";
    v.onclick = () => { $("#memory").classList.remove("open"); showResults(false); };
    actions.append(v);
  }
  const b = document.createElement("button");
  b.className = "link";
  b.textContent = state.tests.length || state.sct.length ? "다시 점검하기" : "점검하기";
  b.onclick = () => { $("#memory").classList.remove("open"); startTests(); };
  actions.append(b);
  box.append(actions);
}

function renderMemory() {
  renderProgress();
  renderTests();
  const f = state.formulation || {};
  const fb = $("#formulationBox");
  fb.innerHTML = "<h3>지금까지의 이해</h3>";
  const dl = document.createElement("dl");
  for (const [k, label] of Object.entries(LABELS)) {
    if (!f[k]?.length) continue;
    const dt = document.createElement("dt"); dt.textContent = label; dl.append(dt);
    for (const v of f[k]) { const dd = document.createElement("dd"); dd.textContent = v; dl.append(dd); }
  }
  if (dl.children.length) fb.append(dl);
  else fb.insertAdjacentHTML("beforeend", `<p class="empty">이야기를 나누다 보면 이곳에 조금씩 채워져요.</p>`);

  const sb = $("#sctBox");
  sb.innerHTML = "";
  if (state.sct.length) {
    // 길어지기 쉬워 접어 둔다
    const det = document.createElement("details");
    det.innerHTML = "<summary></summary>";
    det.firstChild.textContent = `문장완성 ${state.sct.length}개`;
    const ul = document.createElement("ul"); ul.className = "sct-list";
    for (const r of state.sct) { const li = document.createElement("li"); li.innerHTML = "<b></b> "; li.firstChild.textContent = r.stem; li.append(r.answer); ul.append(li); }
    det.append(ul);
    sb.append(det);
  }

  const hb = $("#sessionsBox");
  hb.innerHTML = "";
  if (state.sessions.length) {
    hb.innerHTML = "<h3>지난 상담</h3>";
    for (const s of [...state.sessions].reverse()) {
      const d = document.createElement("div"); d.className = "session-item";
      d.innerHTML = "<strong></strong><p></p>";
      d.querySelector("strong").textContent = `${s.number}회기 · ${s.title || s.date}`;
      d.querySelector("p").textContent = s.homework ? `가져간 것: ${s.homework}` : s.date;
      hb.append(d);
    }
  }
}

$("#openMemory").onclick = () => $("#memory").classList.add("open");
$("#closeMemory").onclick = () => $("#memory").classList.remove("open");
$("#scrim").onclick = () => $("#memory").classList.remove("open");
$("#leave").onclick = () => { storage.del("clientId"); state = record = null; showWelcome(); };
$("#forget").onclick = async () => {
  if (!confirm("윤슬이 기억하는 모든 기록(상담 내용, 문장완성, 이해한 것들)을 이 브라우저에서 지울까요? 되돌릴 수 없어요.")) return;
  removeRecord(state.id);
  storage.del("clientId");
  state = record = null;
  showWelcome();
};

// ---------- 시작 ----------
const saved = storage.get("clientId");
if (saved) enter(saved); else showWelcome();
