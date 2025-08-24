#!/bin/bash

# This script installs Ollama and pulls specified models for Linux and macOS.

# Exit immediately if a command exits with a non-zero status.
set -e

echo "Installing Ollama..."
if ! command -v ollama &> /dev/null; then
    echo "Ollama not found. Installing..."
    curl -fsSL https://ollama.ai/install.sh | sh
else
    echo "Ollama is already installed."
fi

echo ""
echo "Pulling recommended models (this may take some time)..."
# ollama pull llama3.1
# ollama pull gemma2
# ollama pull mistral
ollama pull hf.co/janhq/Jan-v1-4B-GGUF:Q4_K_M

echo ""
echo "Setup complete! You can see your models with 'ollama list'."
ollama list