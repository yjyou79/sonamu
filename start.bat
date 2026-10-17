@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv (
  echo [윤슬] 처음 실행이라 준비 중이에요...
  py -m venv .venv
  .venv\Scripts\python -m pip install -q -r requirements.txt
)
if not exist .env (
  copy .env.example .env >nul
  echo [윤슬] .env 파일을 만들었어요. GEMINI_API_KEY 를 넣고 저장한 뒤 다시 실행해 주세요.
  echo [윤슬] 키 발급: https://aistudio.google.com/apikey
  notepad .env
  exit /b
)
start "" http://localhost:8000
.venv\Scripts\python -m uvicorn server:app --port 8000
