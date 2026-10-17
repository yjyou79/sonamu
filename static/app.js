const $ = (s) => document.querySelector(s);
const SCT_RE = /\[\[문장완성:\s*(.+?)\]\]/;
let state = null;   // 서버의 내담자 상태
let busy = false;

const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
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

// ---------- 입장 ----------

async function showWelcome() {
  $("#room").hidden = true;
  $("#welcome").hidden = false;
  const [clients, health] = await Promise.all([
    api("/api/clients").then((r) => r.json()),
    api("/api/health").then((r) => r.json()),
  ]);
  $("#keyWarn").hidden = health.ok;
  $("#keyWarn").textContent = health.problem || "";
  const list = $("#clientList");
  list.innerHTML = "";
  $("#returning").hidden = clients.length === 0;
  for (const c of clients) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.innerHTML = `<span></span><small>${c.sessions ? `${c.sessions}회기 함께함` : "첫 상담 전"}</small>`;
    b.firstChild.textContent = c.nickname;
    b.onclick = () => enter(c.id);
    li.append(b);
    list.append(li);
  }
}

$("#newForm").onsubmit = async (e) => {
  e.preventDefault();
  const c = await api("/api/clients", { method: "POST", body: JSON.stringify({ nickname: $("#nickname").value }) }).then((r) => r.json());
  enter(c.id);
};

async function enter(id) {
  try {
    state = await api(`/api/clients/${id}`).then((r) => r.json());
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

function renderMode() {
  // 시작 인사가 실패해 대화가 비어 있으면 다시 시작할 수 있게 한다
  const active = !!state.active && state.active.messages.some((m) => !m.hidden);
  $("#composer").hidden = !active;
  $("#endBtn").hidden = !active;
  $("#log").hidden = !active;
  $("#startPane").hidden = active;
  const n = state.sessions.length + 1;
  const name = state.nickname ? `${state.nickname}님, ` : "";
  $("#startText").textContent = n === 1
    ? `${name}반가워요. 이곳에서는 서두르지 않아도 괜찮아요. 준비되면 첫 상담을 시작해요.`
    : `${name}다시 와 주셨네요. 지난 ${n - 1}번의 이야기를 기억하고 있어요. ${n}번째 상담을 시작할까요?`;
  $("#startBtn").textContent = n === 1 ? "첫 상담 시작하기" : `${n}번째 상담 시작하기`;
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

async function streamFrom(path, body) {
  busy = true;
  setStatus("thinking");
  document.querySelectorAll(".sct-card").forEach((c) => c.remove());
  const bubble = addCounselor();
  bubble.innerHTML = `<span class="typing"><i></i><i></i><i></i></span>`;
  scrollDown();
  let text = "";
  let failed = false;
  try {
    const res = await api(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
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
          state.progress = data.progress;
          renderProgress();
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
  // 기록 동기화 (중간 기억 갱신 반영)
  const fresh = await api(`/api/clients/${state.id}`).then((r) => r.json()).catch(() => null);
  if (fresh) { state = fresh; renderMemory(); }
  if (!failed) $("#input").focus();
}

async function send(text, stem) {
  addClient(text, stem);
  await streamFrom(`/api/clients/${state.id}/message`, { text, sct_stem: stem || null });
}

$("#startBtn").onclick = async () => {
  state.active = { number: state.sessions.length + 1, started: new Date().toISOString(), messages: [] };
  renderMode();
  renderLog();
  await streamFrom(`/api/clients/${state.id}/session/start`);
};

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
    state = await api(`/api/clients/${state.id}/session/end`, { method: "POST" }).then((r) => r.json());
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

function renderMemory() {
  renderProgress();
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
    sb.innerHTML = "<h3>문장완성</h3>";
    const ul = document.createElement("ul"); ul.className = "sct-list";
    for (const r of state.sct) { const li = document.createElement("li"); li.innerHTML = "<b></b> "; li.firstChild.textContent = r.stem; li.append(r.answer); ul.append(li); }
    sb.append(ul);
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
$("#leave").onclick = () => { storage.del("clientId"); state = null; showWelcome(); };
$("#forget").onclick = async () => {
  if (!confirm("윤슬이 기억하는 모든 기록(상담 내용, 문장완성, 이해한 것들)을 지울까요? 되돌릴 수 없어요.")) return;
  await api(`/api/clients/${state.id}`, { method: "DELETE" });
  storage.del("clientId");
  state = null;
  showWelcome();
};

// ---------- 시작 ----------
const saved = storage.get("clientId");
if (saved) enter(saved); else showWelcome();
