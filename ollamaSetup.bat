@echo off
setlocal

echo --- AI Think Setup for Windows ---
echo This script will install Ollama, pull recommended models, and start the application.
echo.

:: Main execution flow
call :install_ollama
call :start_ollama_server
call :pull_models
call :start_searxng_services
call :start_ai_think_app

echo.
echo --- Setup Complete! ---
endlocal
exit /b 0


:: --- Functions ---

:install_ollama
echo [1/5] Checking for Ollama installation...
where /q ollama
if %errorlevel% equ 0 (
    echo      '- Ollama is already installed.
    goto :eof
)

echo      '- Ollama not found. Installing...
where /q curl
if %errorlevel% neq 0 (
    echo      '- ERROR: curl is not found. Please install curl or install Ollama manually from https://ollama.com/download
    exit /b 1
)

echo      '- Downloading Ollama installer...
curl -fL -o OllamaSetup.exe https://ollama.com/download/OllamaSetup.exe
if %errorlevel% neq 0 (
    echo      '- ERROR: Failed to download Ollama installer.
    exit /b 1
)

echo      '- Running Ollama installer. Please follow the on-screen instructions.
start /wait "" OllamaSetup.exe
del OllamaSetup.exe

echo      '- Ollama installation finished.
echo      '- NOTE: You may need to open a new terminal for the 'ollama' command to be available.
goto :eof


:start_ollama_server
echo [2/5] Starting Ollama server...
start "Ollama Server" ollama serve
echo      '- Waiting for server to initialize...
timeout /t 5 /nobreak >nul

ollama ps >nul 2>&1
if %errorlevel% neq 0 (
    echo      '- ERROR: Ollama server failed to start.
    exit /b 1
)
echo      '- Ollama server is running.
goto :eof


:pull_models
echo [3/5] Pulling recommended models (this may take some time)...
ollama pull gemma3:1b
:: ollama pull hf.co/janhq/Jan-v1-4B-GGUF
:: ollama pull hf.co/unsloth/granite-4.0-micro-GGUF
echo      '- Models pulled. Available models:
ollama list
goto :eof


:start_searxng_services
echo [4/5] Starting SearXNG services...
if exist "searxng-docker\docker-compose.yml" (
    cd searxng-docker
    docker compose up -d
    cd ..
    echo      '- SearXNG services started.
) else (
    echo      '- SearXNG directory not found. Skipping.
)
goto :eof


:: :start_ai_think_app
:: echo [5/5] Starting the AI Think application...
:: python main.py
:: goto :eof