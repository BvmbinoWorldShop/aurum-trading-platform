@echo off
title Aurum Trading Backend
cd /d "%~dp0backend"
if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate.bat
)
echo Starting Aurum FastAPI Server on port 8000...
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
