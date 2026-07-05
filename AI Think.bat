@echo off
title AI Think App

cd /d "%USERPROFILE%\Desktop\Code\ai_think"

if not exist .venv (
    echo Creating virtual environment...
    py -m venv .venv
    call .venv\Scripts\activate
    echo Installing dependencies...
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate
)

:: Wait a few seconds for App to start
timeout /t 4 /nobreak >nul

start "" /min python main.py

timeout /t 1 > nul
start "" /max chrome --incognito http://localhost:1111
