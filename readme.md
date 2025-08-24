# AI Think | Ollama Chat

AI Think is a web-based chat application that provides a user-friendly interface for interacting with large language models (LLMs) hosted by Ollama. It features chat history, real-time system health monitoring, configurable model parameters, and optional integration with Langfuse for tracing and observability.
## ✨ Features

- **Intuitive Chat Interface**: Clean and simple UI for chatting with your local LLMs.
- **Model Selection**: Easily switch between any of the models available in your Ollama instance.
- **Chat History**: Browse and review past conversations, organized by thread.
- **System Health Dashboard**: Monitor real-time CPU, memory, disk, and GPU usage.
- **Configurable Parameters**: Adjust model parameters like temperature, top-p, and top-k through the settings page.
- **Langfuse Integration**: Optional, powerful tracing and observability for your LLM interactions. Just add your credentials.
- **Markdown & LaTeX Rendering**: Responses are rendered with support for markdown, including code blocks and LaTeX for mathematical notation.

##  Prerequisites

- Python 3.8+
- [Ollama](https://ollama.com) installed and running.

## 🚀 Setup and Installation

Follow these steps to get the application running on your local machine.

### 1. Install Ollama and Pull Models

You can either follow the manual instructions below or use the automated scripts.

#### Automated Installation (Recommended)

Navigate to the `ollamaSetup` directory and run the appropriate script for your OS. These scripts will install Ollama and download the recommended models (`llama3.1`, `gemma2`, `mistral`).

- **For Windows**:
  Open Command Prompt and run:
  ```batch
  ollamaSetup/install.bat
  ```
- **For macOS & Linux**:
  Open a terminal, make the script executable, and run it:
  ```bash
  chmod +x ollamaSetup/install.sh
  ./ollamaSetup/install.sh
  ```

#### Manual Installation

If you prefer to install manually:

- **Linux & macOS**:
  ```bash
  curl -fsSL https://ollama.ai/install.sh | sh
  ```
- **Windows & macOS**:
  Download from the [official Ollama website](https://ollama.com/download).

Once Ollama is running, pull the models you want to use. Here are some examples:

```bash
ollama pull llama3.1
ollama pull gemma2
ollama pull mistral
ollama pull gpt-oss:20b
ollama pull hf.co/janhq/Jan-v1-4B-GGUF:Q4_K_M
ollama pull hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M
```

### 2. Set Up Python Environment

It's recommended to use a virtual environment.

- **On Windows**:
  ```bash
  py -m venv .venv
  .venv\Scripts\activate
  ```
- **On macOS & Linux**:
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  ```

### 3. Install Dependencies

Install the required Python packages from `requirements.txt`:

```bash
pip install -r requirements.txt
```

### 4. Configure the Application

Create a `.env` file in the root directory for basic Ollama configuration. Langfuse credentials are now configured through the **Settings** page in the web UI (`/settings`).

```dotenv
# .env

# --- Ollama Configuration ---
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1

# --- Default settings ---
NUM_PREDICT=2024
TEMPERATURE=0.7
TOP_P=0.8
TOP_K=20
```

### 5. Run the Application

Start the Flask server:

```bash
python main.py
```

The application will be available at `http://localhost:5000`.

## 📖 Usage

- **Chat**: Open your browser to `http://localhost:5000` to start chatting. Select your desired model from the dropdown.
- **New Chat**: Click the "New Chat" icon in the header to start a fresh conversation thread.
- **History**: Visit `/history` to see all your past conversations.
- **System Health**: Go to `/health` to monitor system resources and the status of the Ollama service.
- **Settings**: Navigate to `/settings` to configure default model parameters and set up Langfuse credentials.

## 📄 Documentation

For more detailed information about the application's architecture, features, and API, please see the [documentation](documentation.md).
