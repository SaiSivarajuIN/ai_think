#!/bin/bash

# This script installs Ollama, pulls specified models, and starts necessary services for Linux and macOS.

# Exit immediately if a command exits with a non-zero status.
set -e

# Function to check and install Ollama
install_ollama() {
    echo "🔍 Checking for Ollama installation..."
    if ! command -v ollama &> /dev/null; then
        echo "⬇️ Ollama not found. Installing..."
        curl -fsSL https://ollama.com/install.sh | sh
    else
        echo "✅ Ollama is already installed."
    fi
}

# Function to set up the database
setup_database() {
    echo "⚙️  Setting up database..."
    mkdir -p "instance"
    echo "    - Directory 'instance' ensured."
    touch "instance/chat.db"
    echo "    - Database file 'instance/chat.db' ensured."
}

# Function to start Ollama server
start_ollama_server() {
    echo "🚀 Starting Ollama server in the background..."
    ollama serve &

    # Wait for a few seconds to allow the server to initialize
    sleep 5

    # Check if the server is running
    ollama ps > /dev/null 2>&1 || { echo "❌ Ollama server failed to start."; exit 1; }
    echo "✅ Ollama server is running."
}

# Function to pull the models
pull_models() {
    echo "📦 Pulling recommended models (this may take some time)..."
    
    # Pull standard models
    ollama pull llama3:latest
    
    # Pull GGUF model from Hugging Face
    # ollama pull hf.co/ss-lab/Llama-3.2-1B-Instruct-bnb-4bit-GGUF:Q3_K_M
    # ollama pull hf.co/ss-lab/EXAONE-4.0-1.2B-GGUF:Q4_K_M

}

# Function to handle SearXNG services
start_searxng_services() {
    if [ -d "searxng-docker" ]; then
        echo "Navigating to searxng-docker directory..."
        cd searxng-docker || { echo "❌ Failed to navigate to searxng-docker"; exit 1; }

        echo "Stopping and starting SearXNG services..."
        docker compose up -d

        echo "Navigating back to the project root..."
        cd - > /dev/null || { echo "❌ Failed to navigate back to the project root"; exit 1; }
    else
        echo "⚠️ SearXNG directory not found. Skipping SearXNG setup."
    fi
}

# Function to start the AI Think application
start_ai_think_app() {
    echo "Starting the AI Think application..."
    python main.py
}

# Main execution
install_ollama
setup_database

# Wait for Ollama to be available
until command -v ollama &> /dev/null; do
    echo "⏳ Waiting for Ollama to be available..."
    sleep 2
done
echo "✅ Ollama is available."

start_ollama_server
pull_models

# Display available models
echo "✅ Setup complete! Available models:"
ollama list
echo ""

start_searxng_services
#start_ai_think_app
