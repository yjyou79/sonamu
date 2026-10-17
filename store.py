"""내담자 기록을 data/clients/<id>.json 파일로 보관한다."""

import json
import threading
import uuid
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data" / "clients"
DATA_DIR.mkdir(parents=True, exist_ok=True)
_lock = threading.RLock()


def _path(client_id: str) -> Path:
    if not client_id.isalnum():
        raise ValueError("bad id")
    return DATA_DIR / f"{client_id}.json"


def new_client(nickname: str = "") -> dict:
    client = {
        "id": uuid.uuid4().hex[:12],
        "created": datetime.now().isoformat(timespec="seconds"),
        "profile": {"nickname": nickname, "intake": {}, "intake_covered": {}},
        "formulation": {},
        "sct": [],
        "tests": [],  # 마음 점검 결과 (검사할 때마다 쌓여 변화를 볼 수 있다)
        "sessions": [],
        "active": None,  # 진행 중인 회기: {"number", "started", "messages": [...]}
    }
    save(client)
    return client


def load(client_id: str) -> dict | None:
    p = _path(client_id)
    if not p.exists():
        return None
    with _lock:
        return json.loads(p.read_text(encoding="utf-8"))


def save(client: dict) -> None:
    with _lock:
        tmp = _path(client["id"]).with_suffix(".tmp")
        tmp.write_text(json.dumps(client, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(_path(client["id"]))


def update(client_id: str, fn) -> dict | None:
    """최신 기록을 읽어 fn(client)로 고친 뒤 저장한다 (동시 저장 시 덮어쓰기 방지)."""
    with _lock:
        client = load(client_id)
        if client is None:
            return None
        fn(client)
        save(client)
        return client


def delete(client_id: str) -> None:
    with _lock:
        _path(client_id).unlink(missing_ok=True)


def list_clients() -> list[dict]:
    out = []
    for p in sorted(DATA_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        c = json.loads(p.read_text(encoding="utf-8"))
        out.append({
            "id": c["id"],
            "nickname": c["profile"].get("nickname") or "이름 없는 내담자",
            "sessions": len(c["sessions"]),
        })
    return out
