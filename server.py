"""마음상담 '윤슬' — 기억하는 AI 심리상담 앱 서버 (Google Gemini 사용)."""

import json
import os
import threading
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import errors, types
from pydantic import BaseModel

import store
import tests
from prompts import (
    INTAKE_ITEMS, INTERP_INSTRUCTIONS, INTERP_SCHEMA, PERSONA, REVIEW_INSTRUCTIONS, REVIEW_SCHEMA,
    SCT_STEMS, SCT_TARGET, SESSION_START_CUE, build_system,
)

load_dotenv()
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
REVIEW_EVERY = 6  # 회기 중 이 횟수만큼 대화할 때마다 기억을 중간 갱신

# 상담에서는 자해·학대 같은 주제를 피하지 않고 다뤄야 하므로, 명백히 위험한 경우만 차단한다
SAFETY = [
    types.SafetySetting(category=c, threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH)
    for c in (
        types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        types.HarmCategory.HARM_CATEGORY_HARASSMENT,
        types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    )
]
BLOCKED_REPLY = ("지금 이 이야기는 제가 이 자리에서 충분히 다루기 어려운 것 같아요. 혹시 지금 안전하지 않다고 느끼신다면 "
                 "자살예방상담전화 109나 정신건강위기상담 1577-0199로 바로 연락해 주세요. 괜찮으시다면, 지금 마음에서 "
                 "가장 크게 느껴지는 것부터 다시 천천히 이야기해 볼까요?")

app = FastAPI()
STATIC = Path(__file__).parent / "static"


@app.middleware("http")
async def no_stale_files(request, call_next):
    # 앱을 고친 뒤에도 브라우저가 예전 화면 파일을 쓰지 않도록 매번 확인하게 한다
    response = await call_next(request)
    response.headers.setdefault("Cache-Control", "no-cache")
    return response
_client = None


def _api_key() -> str:
    # .env를 매번 다시 읽어, 키를 넣은 뒤 서버를 재시작하지 않아도 되게 한다
    load_dotenv(override=True)
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
    # 웹페이지에서 복사할 때 딸려 오는 보이지 않는 문자(폭 없는 공백 등)를 지운다
    return "".join(ch for ch in key if 33 <= ord(ch) < 127)


def _log_error(where: str, e: Exception) -> None:
    """오류를 기록하되 API 키는 남기지 않는다."""
    msg = str(e)
    for secret in (os.getenv("GEMINI_API_KEY"), os.getenv("GOOGLE_API_KEY"), _api_key()):
        if secret:
            msg = msg.replace(secret, "[API 키]")
    if isinstance(e, UnicodeError):
        msg = "키나 요청에 영문이 아닌 문자가 섞여 있어요"
    print(f"{where}: {type(e).__name__}: {msg[:300]}")


def _has_key() -> bool:
    return bool(_api_key())


def _gemini() -> genai.Client:
    global _client
    key = _api_key()
    if _client is None or _client[0] != key:
        _client = (key, genai.Client(api_key=key))
    return _client[1]


def _gemini_error(e: Exception) -> str:
    if isinstance(e, errors.APIError):
        if e.code in (400, 401, 403) and "key" in str(e).lower():
            return "Gemini API 키가 올바르지 않아요. .env 파일의 GEMINI_API_KEY를 확인해 주세요."
        if e.code == 429:
            return "오늘 무료 사용량을 넘었거나 요청이 많아요. 잠시 후 다시 시도해 주세요."
        if e.code == 404:
            return f"'{MODEL}' 모델을 찾을 수 없어요. .env의 GEMINI_MODEL을 확인해 주세요."
        if isinstance(e, errors.ServerError):
            return "Gemini 서버가 잠시 불안정해요. 조금 뒤에 다시 시도해 주세요."
        return f"Gemini 오류 ({e.code}): {e.message}"
    return "인터넷 연결을 확인해 주세요."


def _contents(messages: list[dict]) -> list[dict]:
    """대화 기록을 Gemini 형식으로 바꾼다 (같은 역할이 연달아 오면 합친다)."""
    out: list[dict] = []
    for m in messages:
        role = "model" if m["role"] == "assistant" else "user"
        if out and out[-1]["role"] == role:
            out[-1]["parts"][0]["text"] += "\n\n" + m["content"]
        else:
            out.append({"role": role, "parts": [{"text": m["content"]}]})
    return out


# ---------- 공용 ----------

def _get(client_id: str) -> dict:
    c = store.load(client_id)
    if c is None:
        raise HTTPException(404, "내담자를 찾을 수 없어요")
    return c


def _public(c: dict) -> dict:
    covered = c["profile"].get("intake_covered", {})
    return {
        "id": c["id"],
        "nickname": c["profile"].get("nickname", ""),
        "formulation": c.get("formulation", {}),
        "intake": c["profile"].get("intake", {}),
        "sct": c["sct"],
        "sessions": [
            {k: s.get(k) for k in ("number", "date", "title", "summary", "homework")}
            for s in c["sessions"]
        ],
        "active": c["active"],
        "tests": [{k: r[k] for k in ("test", "title", "short", "score", "max", "level", "date",
                                     "higher_is_better", "flags", "dims") if k in r}
                  for r in c.get("tests", [])],
        "interpretation": {k: v for k, v in (c.get("interpretation") or {}).items()
                           if k != "counselor_notes"} or None,
        "progress": {
            "intake": sum(1 for i in INTAKE_ITEMS if covered.get(i)),
            "intake_total": len(INTAKE_ITEMS),
            "sct": len(c["sct"]),
            "sct_total": SCT_TARGET,
        },
    }


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _stream_reply(client_id: str):
    """현재 회기 기록으로 상담사 답변을 스트리밍하고, 끝나면 저장한다."""
    c = _get(client_id)
    if not _has_key():
        yield _sse("error", "아직 Gemini API 키가 없어요. 소나무 폴더의 .env 파일에 GEMINI_API_KEY를 넣고 저장한 뒤 다시 눌러 주세요.")
        return
    yield _sse("status", "thinking")
    text = ""
    blocked = False
    try:
        stream = _gemini().models.generate_content_stream(
            model=MODEL,
            contents=_contents(c["active"]["messages"]),
            config=types.GenerateContentConfig(
                system_instruction=PERSONA + "\n\n" + build_system(c),
                temperature=0.8,
                safety_settings=SAFETY,
            ),
        )
        for chunk in stream:
            if chunk.text:
                text += chunk.text
                yield _sse("delta", chunk.text)
            cand = chunk.candidates[0] if chunk.candidates else None
            if cand and cand.finish_reason and cand.finish_reason.name not in ("STOP", "MAX_TOKENS", "FINISH_REASON_UNSPECIFIED"):
                blocked = True
            if chunk.prompt_feedback and chunk.prompt_feedback.block_reason:
                blocked = True
    except errors.APIError as e:
        yield _sse("error", _gemini_error(e))
        return
    except Exception as e:  # 네트워크 오류 등
        _log_error("Gemini 호출 실패", e)
        yield _sse("error", _gemini_error(e))
        return

    clean = text.strip()
    if blocked or not clean:
        clean = BLOCKED_REPLY
        yield _sse("replace", clean)

    def append(cl):
        cl["active"]["messages"].append({"role": "assistant", "content": clean, "at": _now()})
    c = store.update(client_id, append)
    yield _sse("done", {"progress": _public(c)["progress"]})

    user_turns = sum(1 for m in c["active"]["messages"] if m["role"] == "user" and not m.get("hidden"))
    if user_turns and user_turns % REVIEW_EVERY == 0:
        threading.Thread(target=_review_safe, args=(client_id,), daemon=True).start()


# ---------- 기억 갱신 (회기 검토) ----------

def _review_safe(client_id: str):
    try:
        _review(client_id, final=False)
    except Exception as e:  # 중간 갱신 실패는 상담을 방해하지 않는다
        _log_error("중간 기억 갱신 실패", e)


def _review(client_id: str, final: bool) -> dict | None:
    c = store.load(client_id)
    if not c or not c["active"]:
        return None
    transcript = "\n".join(
        f"{'상담사' if m['role'] == 'assistant' else '내담자'}: {m['content']}"
        for m in c["active"]["messages"] if not m.get("hidden")
    )
    prompt = (
        f"{build_system(c)}\n\n# 기본 정보 항목 목록\n" + "\n".join(f"- {i}" for i in INTAKE_ITEMS)
        + f"\n\n# 기존 사례개념화(JSON)\n{json.dumps(c.get('formulation', {}), ensure_ascii=False)}"
        + f"\n\n# 이번 회기 대화\n{transcript}"
    )
    resp = _gemini().models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=REVIEW_INSTRUCTIONS,
            temperature=0.2,
            response_mime_type="application/json",
            response_json_schema=REVIEW_SCHEMA,
            safety_settings=SAFETY,
        ),
    )
    try:
        result = json.loads(resp.text or "")
    except json.JSONDecodeError:
        return None
    f = result.get("formulation") or {}

    def apply(cl):
        prof = cl["profile"]
        if result.get("nickname") and not prof.get("nickname"):
            prof["nickname"] = result["nickname"][:20]
        for u in result.get("intake_updates", []):
            item = u.get("item", "")
            content = u.get("content", "").strip()
            if not content:
                continue
            item = item if item in INTAKE_ITEMS else next(
                (i for i in INTAKE_ITEMS if item and (item in i or i in item)), None)
            if not item:
                continue
            prev = prof["intake"].get(item)
            prof["intake"][item] = f"{prev} / {content}" if prev and content not in prev else content
            prof["intake_covered"][item] = True
        if f:
            cl["formulation"] = {k: v for k, v in f.items() if isinstance(v, list)}
        if final and cl["active"]:
            cl["sessions"].append({
                "number": cl["active"]["number"],
                "date": cl["active"]["started"][:10],
                "title": result.get("session_title", ""),
                "summary": result.get("summary", ""),
                "homework": result.get("homework", ""),
                "open_threads": result.get("open_threads", ""),
                "messages": cl["active"]["messages"],
            })
            cl["active"] = None
    return store.update(client_id, apply)


# ---------- API ----------

class NewClient(BaseModel):
    nickname: str = ""


class UserMessage(BaseModel):
    text: str
    sct_stem: str | None = None


@app.get("/api/health")
def health():
    if not _has_key():
        return {"ok": False, "model": MODEL,
                "problem": "Gemini API 키가 아직 없어요. README 안내대로 .env 파일에 GEMINI_API_KEY를 넣어 주세요."}
    return {"ok": True, "model": MODEL}


@app.get("/api/clients")
def clients():
    return store.list_clients()


@app.post("/api/clients")
def create_client(body: NewClient):
    return _public(store.new_client(body.nickname.strip()[:20]))


@app.get("/api/clients/{client_id}")
def get_client(client_id: str):
    return _public(_get(client_id))


@app.delete("/api/clients/{client_id}")
def delete_client(client_id: str):
    store.delete(client_id)
    return {"ok": True}


@app.post("/api/clients/{client_id}/session/start")
def start_session(client_id: str):
    c = _get(client_id)
    if c["active"] and len(c["active"]["messages"]) > 1:
        raise HTTPException(409, "이미 진행 중인 회기가 있어요")

    def begin(cl):
        cl["active"] = {
            "number": len(cl["sessions"]) + 1,
            "started": _now(),
            "messages": [{"role": "user", "content": SESSION_START_CUE, "hidden": True, "at": _now()}],
        }
    store.update(client_id, begin)
    return StreamingResponse(_stream_reply(client_id), media_type="text/event-stream")


@app.post("/api/clients/{client_id}/message")
def send_message(client_id: str, body: UserMessage):
    c = _get(client_id)
    if not c["active"]:
        raise HTTPException(409, "진행 중인 회기가 없어요")
    text = body.text.strip()[:4000]
    if not text:
        raise HTTPException(400, "빈 메시지예요")

    def add(cl):
        entry = {"role": "user", "content": text, "at": _now()}
        if body.sct_stem:
            stem = body.sct_stem.strip()
            sct = next((s for s in SCT_STEMS if s["stem"] == stem), {"id": stem, "domain": "기타"})
            entry["content"] = f"「{stem}」 → {text}"
            entry["sct"] = {"stem": stem, "answer": text}
            if not any(r["id"] == sct["id"] for r in cl["sct"]):
                cl["sct"].append({"id": sct["id"], "domain": sct["domain"], "stem": stem,
                                  "answer": text, "session": cl["active"]["number"]})
        msgs = cl["active"]["messages"]
        # 직전 답변이 실패해 user 메시지가 연달아 쌓이면 하나로 합친다 (숨은 시작 신호는 따로 둔다)
        if msgs and msgs[-1]["role"] == "user" and not msgs[-1].get("hidden"):
            msgs[-1]["content"] += "\n\n" + entry["content"]
        else:
            msgs.append(entry)
    store.update(client_id, add)
    return StreamingResponse(_stream_reply(client_id), media_type="text/event-stream")


class TestAnswers(BaseModel):
    answers: list[int]


@app.get("/api/tests")
def list_tests():
    return tests.public_tests()


class SctAnswers(BaseModel):
    texts: list[str]


@app.post("/api/clients/{client_id}/tests/sct")
def submit_sct(client_id: str, body: SctAnswers):
    _get(client_id)
    if len(body.texts) != len(SCT_STEMS):
        raise HTTPException(400, "응답 수가 올바르지 않아요")

    def save(cl):
        by_id = {r["id"]: r for r in cl["sct"]}
        for s, text in zip(SCT_STEMS, body.texts):
            text = text.strip()[:500]
            if text:  # 다시 쓰면 새 응답으로 바꾼다
                by_id[s["id"]] = {"id": s["id"], "domain": s["domain"], "stem": s["stem"],
                                  "answer": text, "session": 0, "date": _now()[:10]}
        cl["sct"] = list(by_id.values())
    c = store.update(client_id, save)
    return {"answered": sum(1 for t in body.texts if t.strip()), "total": len(c["sct"])}


@app.post("/api/clients/{client_id}/interpretation")
def interpret(client_id: str):
    """지금까지의 검사 결과를 묶어 해석을 만든다."""
    c = _get(client_id)
    if not c.get("tests") and not c["sct"]:
        raise HTTPException(400, "해석할 검사 결과가 아직 없어요")
    if not _has_key():
        raise HTTPException(400, "Gemini API 키가 없어 해석을 만들 수 없어요.")
    material = "\n".join([
        f"# 내담자: {c['profile'].get('nickname') or '(이름 없음)'}",
        "# 검사 결과", *tests.describe_for_counselor(c.get("tests", [])),
        "# 기질·성격 차원의 의미",
        *[f"- {name}({group}): {meaning}" for name, group, meaning in tests.TCI_DIMS.values()],
        "# 문장완성 응답",
        *[f"- [{r['domain']}] 「{r['stem']}」 → {r['answer']}" for r in c["sct"]],
    ])
    try:
        resp = _gemini().models.generate_content(
            model=MODEL,
            contents=material,
            config=types.GenerateContentConfig(
                system_instruction=INTERP_INSTRUCTIONS,
                temperature=0.5,
                response_mime_type="application/json",
                response_json_schema=INTERP_SCHEMA,
                safety_settings=SAFETY,
            ),
        )
        result = json.loads(resp.text or "")
    except json.JSONDecodeError:
        raise HTTPException(502, "해석을 만들지 못했어요. 다시 시도해 주세요.")
    except Exception as e:
        _log_error("해석 실패", e)
        raise HTTPException(502, _gemini_error(e))
    result["date"] = _now()[:10]
    c = store.update(client_id, lambda cl: cl.__setitem__("interpretation", result))
    return _public(c)["interpretation"]


@app.post("/api/clients/{client_id}/tests/{test_id}")
def submit_test(client_id: str, test_id: str, body: TestAnswers):
    _get(client_id)
    if test_id not in tests.TESTS:
        raise HTTPException(404, "없는 검사예요")
    try:
        result = tests.score(test_id, body.answers)
    except ValueError as e:
        raise HTTPException(400, str(e))
    result["date"] = _now()[:10]
    store.update(client_id, lambda cl: cl.setdefault("tests", []).append(result))
    return {k: v for k, v in result.items() if k != "answers"}


@app.post("/api/clients/{client_id}/session/end")
def end_session(client_id: str):
    c = _get(client_id)
    if not c["active"]:
        raise HTTPException(409, "진행 중인 회기가 없어요")
    real = [m for m in c["active"]["messages"] if not m.get("hidden")]
    if not any(m["role"] == "user" for m in real):
        store.update(client_id, lambda cl: cl.__setitem__("active", None))
        return _public(_get(client_id))
    try:
        updated = _review(client_id, final=True)
    except Exception as e:
        _log_error("회기 정리 실패", e)
        raise HTTPException(502, _gemini_error(e))
    if updated is None:
        raise HTTPException(502, "회기 정리에 실패했어요. 다시 시도해 주세요.")
    return _public(updated)


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


app.mount("/static", StaticFiles(directory=STATIC), name="static")
