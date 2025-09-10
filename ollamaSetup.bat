@echo off
setlocal

echo AI Think Setup for Windows
echo ==========================
echo.

REM Function to check if a command exists
goto :check_command
:command_exists
    where %1 >nul 2>nul
    exit /b %errorlevel%

:check_command

REM --- 1. Check and Install Ollama ---
echo [1/5] Checking for Ollama installation...
call :command_exists ollama
if %errorlevel% equ 0 (
    echo      - Ollama is already installed.
) else (
    echo      - Ollama not found. Please download and install it from:
    echo        https://ollama.com/download
    echo.
    echo      - After installation, please re-run this script.
    pause
    exit /b 1
)
echo.

REM --- 2. Start Ollama Server ---
echo [2/5] Starting Ollama server...
REM Check if ollama is already running by checking the default port
netstat -an | find "11434" > nul
if %errorlevel% equ 0 (
    echo      - Ollama server appears to be running already.
) else (
    echo      - Starting Ollama server in a new window...
    start "Ollama Server" ollama serve
    echo      - Waiting for the server to initialize...
    timeout /t 10 /nobreak > nul
)
echo.

REM --- 3. Pull Recommended Models ---
echo [3/5] Pulling recommended models (this may take some time)...
ollama pull gemma:latest
ollama pull hf.co/janhq/Jan-v1-4B-GGUF:Q4_K_M
echo.
echo      - Available models:
ollama list
echo.

REM --- 4. Start SearXNG Services ---
echo [4/5] Starting SearXNG services with Docker...
call :command_exists docker
if %errorlevel% neq 0 (
    echo      - Docker is not found. Please install Docker Desktop and ensure it's running.
    echo        Skipping SearXNG setup.
    goto :start_app
)

cd searxng-docker
docker compose up -d
cd ..
echo.

REM --- 5. Start the AI Think Application ---
:start_app
echo [5/5] Starting the AI Think application...
python main.py

endlocal