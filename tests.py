"""상담 전 마음 점검: 표준화된 자기보고식 선별 검사와 채점.

문항은 원 척도를 한국어로 옮긴 것이며, 진단이 아니라 상담의 출발점을 잡기 위한 참고 자료다.
임상 현장에서 쓰려면 타당화된 공식 한국어판 문항으로 바꿔야 한다.
"""

FREQ_2W = ["전혀 없음", "며칠 동안", "1주일 이상", "거의 매일"]

TESTS = {
    "phq9": {
        "title": "우울 (PHQ-9)",
        "short": "우울",
        "intro": "지난 2주 동안, 다음과 같은 문제들로 얼마나 자주 불편을 겪으셨나요?",
        "options": FREQ_2W,
        "items": [
            "일을 하는 것에 대한 흥미나 재미가 거의 없음",
            "기분이 가라앉거나, 우울하거나, 희망이 없다고 느낌",
            "잠들기 어렵거나 자꾸 깸, 혹은 너무 많이 잠",
            "피곤하다고 느끼거나 기운이 거의 없음",
            "식욕이 줄었거나 혹은 너무 많이 먹음",
            "내 자신이 실패자로 여겨지거나, 자신과 가족을 실망시켰다고 느낌",
            "신문을 읽거나 TV를 보는 것과 같은 일상적인 일에 집중하기 어려움",
            "다른 사람들이 눈치챌 정도로 움직임이나 말이 느려짐, 혹은 반대로 안절부절못해 평소보다 많이 움직임",
            "차라리 죽는 것이 낫겠다는 생각, 혹은 어떤 식으로든 자신을 해치려는 생각을 함",
        ],
        "reverse": [],
        "bands": [(4, "거의 없음"), (9, "가벼운 수준"), (14, "중간 수준"), (19, "약간 심한 수준"), (27, "심한 수준")],
    },
    "gad7": {
        "title": "불안 (GAD-7)",
        "short": "불안",
        "intro": "지난 2주 동안, 다음과 같은 문제들로 얼마나 자주 불편을 겪으셨나요?",
        "options": FREQ_2W,
        "items": [
            "초조하거나 불안하거나 조마조마하게 느낌",
            "걱정하는 것을 멈추거나 조절할 수가 없음",
            "여러 가지 것들에 대해 걱정을 너무 많이 함",
            "편하게 있기가 어려움",
            "너무 안절부절못해서 가만히 있기가 힘듦",
            "쉽게 짜증이 나거나 쉽게 성을 냄",
            "마치 끔찍한 일이 생길 것처럼 두렵게 느껴짐",
        ],
        "reverse": [],
        "bands": [(4, "거의 없음"), (9, "가벼운 수준"), (14, "중간 수준"), (21, "심한 수준")],
    },
    "pss10": {
        "title": "스트레스 (PSS-10)",
        "short": "스트레스",
        "intro": "지난 한 달 동안, 다음과 같은 느낌이나 생각을 얼마나 자주 하셨나요?",
        "options": ["전혀 없었다", "거의 없었다", "때때로 있었다", "자주 있었다", "매우 자주 있었다"],
        "items": [
            "예상치 못한 일이 생겨서 기분이 나빠진 적이 얼마나 있었나요?",
            "중요한 일들을 통제할 수 없다고 느낀 적이 얼마나 있었나요?",
            "초조하거나 스트레스가 쌓인다고 느낀 적이 얼마나 있었나요?",
            "개인적인 문제를 다루는 능력에 대해 자신감을 느낀 적이 얼마나 있었나요?",
            "일이 내 뜻대로 진행되고 있다고 느낀 적이 얼마나 있었나요?",
            "해야 할 모든 일에 제대로 대처할 수 없다고 느낀 적이 얼마나 있었나요?",
            "일상의 짜증나는 일들을 잘 다스릴 수 있었던 적이 얼마나 있었나요?",
            "내가 상황을 잘 장악하고 있다고 느낀 적이 얼마나 있었나요?",
            "내가 통제할 수 없는 일 때문에 화가 난 적이 얼마나 있었나요?",
            "어려운 일들이 너무 많이 쌓여서 극복할 수 없다고 느낀 적이 얼마나 있었나요?",
        ],
        "reverse": [3, 4, 6, 7],  # 0부터 센 문항 번호
        "bands": [(13, "낮은 수준"), (26, "중간 수준"), (40, "높은 수준")],
    },
    "rses": {
        "title": "자아존중감 (RSES)",
        "short": "자존감",
        "intro": "평소 자신에 대해 어떻게 느끼시는지, 각 문장에 얼마나 동의하시나요?",
        "options": ["전혀 그렇지 않다", "그렇지 않다", "그렇다", "매우 그렇다"],
        "items": [
            "나는 내가 다른 사람들처럼 가치 있는 사람이라고 생각한다.",
            "나는 내가 자랑스러워할 것이 별로 없다고 느낀다.",
            "나는 좋은 성품을 가졌다고 생각한다.",
            "나는 대부분의 다른 사람들과 같이 일을 잘 할 수가 있다.",
            "나는 때때로 내가 쓸모없는 사람이라고 느낀다.",
            "나는 내 자신을 좀 더 존중할 수 있었으면 좋겠다.",
            "대체로 나는 실패한 사람이라는 느낌이 든다.",
            "나는 나 자신에 대해 긍정적인 태도를 가지고 있다.",
            "나는 때때로 내가 좋지 않은 사람이라고 생각한다.",
            "대체로 나는 나 자신에 대해 만족한다.",
        ],
        "reverse": [1, 4, 5, 6, 8],
        "bands": [(14, "낮은 편"), (25, "보통 범위"), (30, "높은 편")],
        "higher_is_better": True,
    },
}

for _t in TESTS.values():
    _t["kind"] = "scale"

# ---------- 기질·성격 (TCI 7차원 모델 참고) ----------
# Cloninger의 기질·성격 모델(TCI)의 7차원을 재기 위해 이 앱에서 새로 만든 문항이다.
# 공식 TCI 문항이 아니며 규준(또래 평균)이 없어, 점수는 '응답자 안에서의 상대적 경향'으로만 해석한다.

TCI_DIMS = {
    "NS": ("자극추구", "기질", "새로움과 보상에 끌려 활발히 움직이려는 경향"),
    "HA": ("위험회피", "기질", "위험과 불확실성 앞에서 조심하고 걱정하는 경향"),
    "RD": ("사회적 민감성", "기질", "다른 사람의 반응과 정서적 교류에 민감한 경향"),
    "PS": ("인내력", "기질", "보상이 없어도 꾸준히 지속하려는 경향"),
    "SD": ("자율성", "성격", "스스로 목표를 세우고 책임지며 자신을 받아들이는 힘"),
    "CO": ("연대감", "성격", "다른 사람을 수용하고 공감하며 협력하는 힘"),
    "ST": ("자기초월", "성격", "자신을 넘어선 더 큰 의미와 연결을 느끼는 힘"),
}
# (차원, 문항, 역채점 여부) — 차원이 섞이도록 돌아가며 배치
_TCI_RAW = {
    "NS": [("새롭고 낯선 일을 해 보는 것에 쉽게 끌린다.", False),
           ("기분에 따라 충동적으로 결정할 때가 많다.", False),
           ("계획 없이 돈을 쓰고 나중에 후회하곤 한다.", False),
           ("정해진 규칙이나 반복되는 일상은 금방 지루해진다.", False),
           ("익숙하고 검증된 방식을 고수하는 편이다.", True)],
    "HA": [("앞으로 일이 잘못될까 봐 미리 걱정하는 편이다.", False),
           ("낯선 사람을 만나면 긴장되고 수줍어진다.", False),
           ("불확실한 상황에서는 쉽게 결정을 내리지 못한다.", False),
           ("다른 사람보다 쉽게 지치고, 회복하는 데 시간이 오래 걸린다.", False),
           ("위험이 있어도 대체로 낙관적으로 생각하는 편이다.", True)],
    "RD": [("다른 사람의 인정이나 칭찬이 나에게 큰 힘이 된다.", False),
           ("슬픈 영화나 이야기에 쉽게 마음이 움직인다.", False),
           ("가까운 사람들과 속마음을 나누는 것이 중요하다.", False),
           ("다른 사람의 거절이나 비판에 오래 마음이 쓰인다.", False),
           ("혼자 지내는 것이 편하고 사람들과의 교류가 크게 필요하지 않다.", True)],
    "PS": [("힘들고 지쳐도 시작한 일은 끝까지 해내려 한다.", False),
           ("당장 보상이 없어도 목표를 위해 꾸준히 노력할 수 있다.", False),
           ("남들이 만족할 수준이어도 더 잘하려고 계속 애쓴다.", False),
           ("일이 잘 풀리지 않으면 쉽게 포기하는 편이다.", True),
           ("실패해도 다시 도전하는 편이다.", False)],
    "SD": [("내 행동과 그 결과에 스스로 책임을 지는 편이다.", False),
           ("나에게는 분명한 삶의 목표와 방향이 있다.", False),
           ("어려운 문제가 생겨도 해결할 방법을 찾아낼 수 있다고 믿는다.", False),
           ("내 단점이나 한계를 받아들이기가 어렵다.", True),
           ("일이 잘못되면 상황이나 남 탓을 하게 될 때가 많다.", True)],
    "CO": [("나와 생각이 다른 사람도 너그럽게 받아들이는 편이다.", False),
           ("다른 사람의 입장에서 그 마음을 헤아려 보려고 한다.", False),
           ("대가가 없어도 다른 사람을 기꺼이 돕는다.", False),
           ("나에게 상처 준 사람에게는 되갚아 주고 싶다.", True),
           ("함께 일할 때 내 이익보다 모두에게 공정한 것을 중시한다.", False)],
    "ST": [("무언가에 몰두하면 시간 가는 줄 모르고 나를 잊는다.", False),
           ("자연이나 세상과 깊이 연결되어 있다고 느낄 때가 있다.", False),
           ("삶에는 눈에 보이는 것 이상의 의미가 있다고 느낀다.", False),
           ("과학적으로 설명할 수 없는 것은 믿지 않는다.", True),
           ("나보다 더 큰 무언가를 위해 살고 싶다는 마음이 있다.", False)],
}
_TCI_ITEMS = [(dim, *_TCI_RAW[dim][i]) for i in range(5) for dim in TCI_DIMS]

TESTS["tci"] = {
    "kind": "profile",
    "title": "기질·성격 탐색 (TCI 모델 참고)",
    "short": "기질·성격",
    "intro": "평소의 나를 떠올리며, 각 문장이 나와 얼마나 비슷한지 골라 주세요.",
    "options": ["전혀 아니다", "아니다", "보통이다", "그렇다", "매우 그렇다"],
    "items": [text for _, text, _ in _TCI_ITEMS],
    "dims": [dim for dim, _, _ in _TCI_ITEMS],
    "reverse": [i for i, (_, _, rev) in enumerate(_TCI_ITEMS) if rev],
}

# ---------- 문장완성검사 ----------
from sct_items import SCT_STEMS  # noqa: E402  (상담 대화에서도 같은 문항을 쓴다)

TESTS["sct"] = {
    "kind": "text",
    "title": "문장완성검사",
    "short": "문장완성",
    "intro": "앞부분을 보고 가장 먼저 떠오르는 대로 문장을 이어 써 주세요. 정답은 없어요. 쓰기 어려운 문장은 건너뛰어도 괜찮아요.",
    "items": [s["stem"] for s in SCT_STEMS],
}

GROUPS = [
    {"id": "mood", "title": "지금의 마음 상태", "desc": "우울 · 불안 · 스트레스 · 자존감", "minutes": 5,
     "tests": ["phq9", "gad7", "pss10", "rses"]},
    {"id": "tci", "title": "기질과 성격", "desc": "타고난 기질과 살아오며 자란 성격 (TCI 모델 참고)", "minutes": 5,
     "tests": ["tci"]},
    {"id": "sct", "title": "문장완성", "desc": "문장을 이어 쓰며 마음 깊은 곳 들여다보기", "minutes": 10,
     "tests": ["sct"]},
]
ORDER = ["phq9", "gad7", "pss10", "rses"]  # 점수형 검사


def public_tests() -> dict:
    out = []
    for tid, t in TESTS.items():
        d = {"id": tid, **{k: t[k] for k in ("kind", "title", "short", "intro", "items") if k in t}}
        if "options" in t:
            d["options"] = t["options"]
        out.append(d)
    return {"groups": GROUPS, "tests": out}


def score_profile(answers: list[int]) -> dict:
    t = TESTS["tci"]
    if len(answers) != len(t["items"]) or any(not (0 <= a <= 4) for a in answers):
        raise ValueError("응답 수나 값이 올바르지 않아요")
    sums: dict[str, list[int]] = {d: [] for d in TCI_DIMS}
    for i, a in enumerate(answers):
        sums[t["dims"][i]].append(4 - a if i in t["reverse"] else a)
    dims = {}
    for code, vals in sums.items():
        pct = round(sum(vals) / (4 * len(vals)) * 100)
        name, group, meaning = TCI_DIMS[code]
        dims[code] = {"name": name, "group": group, "meaning": meaning, "pct": pct,
                      "level": "높은 편" if pct >= 65 else "낮은 편" if pct <= 35 else "중간"}
    return {"test": "tci", "title": t["title"], "short": t["short"], "dims": dims,
            "answers": answers, "flags": []}


def score(test_id: str, answers: list[int]) -> dict:
    if test_id == "tci":
        return score_profile(answers)
    t = TESTS[test_id]
    top = len(t["options"]) - 1
    if len(answers) != len(t["items"]) or any(not (0 <= a <= top) for a in answers):
        raise ValueError("응답 수나 값이 올바르지 않아요")
    total = sum(top - a if i in t["reverse"] else a for i, a in enumerate(answers))
    level = next(label for limit, label in t["bands"] if total <= limit)
    result = {"test": test_id, "title": t["title"], "short": t["short"], "score": total,
              "max": len(t["items"]) * top, "level": level,
              "higher_is_better": t.get("higher_is_better", False), "answers": answers, "flags": []}
    if test_id == "phq9" and answers[8] > 0:
        result["flags"].append("self_harm_thoughts")
    return result


def describe_for_counselor(results: list[dict]) -> list[str]:
    """검사별 최신 결과와 이전 대비 변화를 상담사가 읽을 문장으로."""
    lines = []
    for tid in ORDER:
        rs = [r for r in results if r["test"] == tid]
        if not rs:
            continue
        cur = rs[-1]
        line = f"- {cur['title']} ({cur['date']}): {cur['score']}/{cur['max']}점, {cur['level']}"
        if len(rs) > 1:
            diff = cur["score"] - rs[-2]["score"]
            line += f" (이전 {rs[-2]['date']} {rs[-2]['score']}점 대비 {'+' if diff >= 0 else ''}{diff})"
        t = TESTS[tid]
        top = len(t["options"]) - 1
        # 증상 쪽으로 강하게 응답한 문항 (예: '1주일 이상', '자주 있었다' 이상)
        high = [t["items"][i] for i, a in enumerate(cur["answers"])
                if (top - a if i in t["reverse"] else a) >= top - 1]
        if high and not t.get("higher_is_better"):
            line += f" — 특히 높게 응답한 문항: {'; '.join(high[:4])}"
        lines.append(line)
        if "self_harm_thoughts" in cur.get("flags", []):
            lines.append(f"  ⚠ PHQ-9 9번(죽음·자해 생각) 응답: '{t['options'][cur['answers'][8]]}'. "
                         "이번 회기 초반에 부드럽지만 직접적으로 안전을 확인할 것.")
    tci = [r for r in results if r["test"] == "tci"]
    if tci:
        cur = tci[-1]
        dims = " / ".join(f"{d['name']} {d['pct']}({d['level']})" for d in cur["dims"].values())
        lines.append(f"- 기질·성격 탐색 ({cur['date']}, 0~100 상대 경향, 규준 없음): {dims}")
    return lines
