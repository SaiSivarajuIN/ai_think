#!/bin/bash

# This script installs Ollama and pulls specified models for Linux and macOS.

# Exit immediately if a command exits with a non-zero status.
set -e

echo "🔍 Checking for Ollama installation..."
if ! command -v ollama &> /dev/null; then
    echo "⬇️ Ollama not found. Installing..."
    curl -fsSL https://ollama.ai/install.sh | sh
else
    echo "✅ Ollama is already installed."
fi

echo ""
echo "📦 Pulling recommended models (this may take some time)..."

# Pull standard models
# ollama pull llama3:latest
# ollama pull gemma:latest
# ollama pull mistral:latest

# Pull GGUF model from Hugging Face
ollama pull hf.co/janhq/Jan-v1-4B-GGUF:Q4_K_M
# ollama pull hf.co/unsloth/gpt-oss-20b-GGUF:Q4_K_M


echo ""
echo "✅ Setup complete! Available models:"
ollama list
echo ""
