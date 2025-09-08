#!/bin/bash

# This script installs Ollama and pulls specified models for Linux and macOS.

# Exit immediately if a command exits with a non-zero status.
set -e

echo "🔍 Checking for Ollama installation..."
if ! command -v ollama &> /dev/null; then
    echo "⬇️ Ollama not found. Installing..."
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "✅ Ollama is already installed."
fi

echo ""
# wait for ollama command to be available
until command -v ollama &> /dev/null; do
    echo "⏳ Waiting for Ollama to be available..."
    sleep 2
done
echo "✅ Ollama is available."

echo ""
echo "🚀 Starting Ollama server in the background..."
ollama serve &

# Wait a few seconds for the server to initialize
sleep 5

# Check if the server is running
ollama ps > /dev/null 2>&1 || (echo "❌ Ollama server failed to start." && exit 1)
echo "✅ Ollama server is running."

echo ""
echo "📦 Pulling recommended models (this may take some time)..."

# Pull standard models
# ollama pull gemma:latest
# ollama pull llama3:latest
# ollama pull mistral:latest

# Pull GGUF model from Hugging Face
ollama pull hf.co/janhq/Jan-v1-4B-GGUF:Q4_K_M
# ollama pull hf.co/unsloth/gpt-oss-20b-GGUF:Q4_K_M


echo ""
echo "✅ Setup complete! Available models:"
ollama list
echo ""
