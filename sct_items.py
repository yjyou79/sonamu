"""문장완성검사(SCT) 문항. 마음 점검(따로 쓰기)과 상담 대화(한 문항씩 건네기)에서 함께 쓴다.

Sacks SCT의 영역(가족, 자기개념, 대인관계, 두려움, 죄책감, 과거·미래, 목표 등)을 참고해 다듬은 문항이다.
"""

SCT_STEMS = [
    {"id": "self_1", "domain": "자기개념", "stem": "나는 가끔"},
    {"id": "self_2", "domain": "자기개념", "stem": "사람들은 나를"},
    {"id": "self_3", "domain": "자기개념", "stem": "내가 가장 싫어하는 나의 모습은"},
    {"id": "self_4", "domain": "자기개념", "stem": "나의 가장 큰 장점은"},
    {"id": "family_1", "domain": "가족", "stem": "우리 엄마는"},
    {"id": "family_2", "domain": "가족", "stem": "우리 아버지는"},
    {"id": "family_3", "domain": "가족", "stem": "어렸을 때 우리 집은"},
    {"id": "family_4", "domain": "가족", "stem": "우리 가족이 나에 대해서"},
    {"id": "rel_1", "domain": "대인관계", "stem": "내가 정말 믿을 수 있는 사람은"},
    {"id": "rel_2", "domain": "대인관계", "stem": "사람들과 함께 있을 때 나는"},
    {"id": "rel_3", "domain": "대인관계", "stem": "윗사람이 다가오면 나는"},
    {"id": "intimacy_1", "domain": "친밀감", "stem": "누군가 나에게 가까이 다가오면"},
    {"id": "fear_1", "domain": "두려움", "stem": "내가 가장 두려운 것은"},
    {"id": "fear_2", "domain": "두려움", "stem": "나를 가장 불안하게 만드는 것은"},
    {"id": "guilt_1", "domain": "죄책감", "stem": "잊고 싶은 일은"},
    {"id": "guilt_2", "domain": "죄책감", "stem": "내가 저지른 가장 큰 잘못은"},
    {"id": "past_1", "domain": "과거", "stem": "어렸을 때 나는"},
    {"id": "future_1", "domain": "미래", "stem": "언젠가 나는"},
    {"id": "future_2", "domain": "미래", "stem": "나의 앞날은"},
    {"id": "goal_1", "domain": "목표", "stem": "내가 정말 바라는 것은"},
    {"id": "work_1", "domain": "일·학업", "stem": "일(공부)을 할 때 나는"},
    {"id": "anger_1", "domain": "감정", "stem": "나를 화나게 하는 것은"},
    {"id": "sad_1", "domain": "감정", "stem": "나는 ___ 때 가장 외롭다"},
    {"id": "happy_1", "domain": "감정", "stem": "내가 가장 행복했던 때는"},
]
