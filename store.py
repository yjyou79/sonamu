"""내담자 기록의 모양을 정한다.

기록은 사용자의 브라우저(localStorage)에 저장되고, 요청마다 서버로 함께 온다.
서버는 기록을 보관하지 않는다. (예전 버전이 이 컴퓨터의 data/clients/에 남긴 기록은
브라우저로 옮길 수 있도록 읽기만 한다.)
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

LEGACY_DIR = Path(__file__).parent / "data" / "clients"


def new_record(nickname: str = "") -> dict:
    return normalize({
        "id": uuid.uuid4().hex[:12],
        "created": datetime.now().isoformat(timespec="seconds"),
        "profile": {"nickname": nickname},
    })


def normalize(c: dict) -> dict:
    """브라우저에서 온 기록에 빠진 칸을 채운다."""
    if not isinstance(c, dict) or not isinstance(c.get("id"), str):
        raise ValueError("기록 형식이 올바르지 않아요")
    prof = c.setdefault("profile", {})
    prof.setdefault("nickname", "")
    prof.setdefault("intake", {})
    prof.setdefault("intake_covered", {})
    c.setdefault("formulation", {})
    c.setdefault("sct", [])
    c.setdefault("tests", [])  # 마음 점검 결과 (검사할 때마다 쌓여 변화를 볼 수 있다)
    c.setdefault("sessions", [])
    c.setdefault("active", None)  # 진행 중인 회기: {"number", "started", "messages": [...]}
    c.setdefault("interpretation", None)
    return c


def load_legacy(client_id: str) -> dict | None:
    if not client_id.isalnum():
        return None
    p = LEGACY_DIR / f"{client_id}.json"
    if not p.exists():
        return None
    return normalize(json.loads(p.read_text(encoding="utf-8")))
