@echo off
setlocal

echo --- Ollama Installer for Windows ---
echo This script will download and run the official Ollama installer.

:: Check if curl is available
where /q curl
if %errorlevel% neq 0 (
    echo.
    echo ERROR: curl is not found in your PATH.
    echo Please install curl or install Ollama manually from https://ollama.com/download
    exit /b 1
)

:: Download the installer
echo.
echo Downloading Ollama installer...
curl -fL -o OllamaSetup.exe https://ollama.com/download/OllamaSetup.exe
if %errorlevel% neq 0 (
    echo ERROR: Failed to download Ollama installer.
    exit /b 1
)

:: Run the installer and wait for it to complete
echo.
echo Running Ollama installer. Please follow the on-screen instructions.
start /wait "" OllamaSetup.exe
del OllamaSetup.exe

echo.
echo Ollama installation finished.
echo NOTE: You may need to open a new terminal for the 'ollama' command to be available.
echo.

echo Pulling recommended models (this may take some time)...
ollama pull llama3.1
ollama pull gemma2
ollama pull mistral
ollama pull hf.co/janhq/Jan-v1-4B-GGUF:Q4_K_M

echo.
echo Setup complete! You can see your models with 'ollama list'.
ollama list
endlocal