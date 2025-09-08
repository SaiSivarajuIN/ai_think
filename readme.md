# AI Think | Ollama Chat

AI Think is a web-based chat application that provides a user-friendly interface for interacting with large language models (LLMs) hosted by a local Ollama instance. It features persistent chat history, real-time system health monitoring, configurable model parameters, web search capabilities, and optional integration with Langfuse for tracing and observability.

## ✨ Features

- **Intuitive Chat Interface**: Clean and simple UI for chatting with your local LLMs.
- **Model Selection**: Easily switch between any of the models available in your Ollama instance.
- **Models Hub**: Manage your local Ollama models directly from the UI—pull new models and delete old ones.
- **Persistent Chat History**: Your conversations are saved using a local SQLite database, with optional support for a more scalable [ChromaDB](https://www.trychroma.com/) cloud instance.
- **Web Search**: Get up-to-date answers from the internet by integrating with a local [SearXNG](https://github.com/searxng/searxng-docker) instance.
- **System Health Dashboard**: Monitor real-time CPU, memory, disk, and GPU usage, along with connection statuses for all integrated services.
- **Dynamic Configuration**: Adjust model parameters (temperature, top-p, etc.) and integration settings on the fly without restarting the server.
- **Langfuse Integration**: Optional, powerful tracing and observability for your LLM interactions[Langfuse](https://us.cloud.langfuse.com/).
- **Markdown Rendering**: Responses are rendered with support for markdown, including code blocks with syntax highlighting.

## 🚀 Setup and Installation

Follow these steps to get the application running on your local machine.

### 1. Prerequisites

- Python 3.10+
- [Ollama](https://ollama.com) installed and running.

### 2. Install Ollama

You can either follow the manual instructions below or use the automated scripts.

#### Automated Installation (Recommended)

The `ollamaSetup.sh` script will install Ollama and download recommended models (`llama3`, `gemma`, `mistral`).

- **For macOS & Linux**:
  Open a terminal, make the script executable, and run it:

  ```bash
  chmod +x ./ollamaSetup.sh
  ./ollamaSetup.sh
  ```

#### Manual Installation

If you prefer to install manually:

- **Linux & macOS**:
  ```bash
  curl -fsSL https://ollama.ai/install.sh | sh
  ```
- **Windows & macOS**:
  Download from the [official Ollama website](https://ollama.com/download).

### 3. Pull Models

Once Ollama is running, pull the models you want to use. Here are some examples:

```bash
ollama pull llama3.1
ollama pull gemma2
ollama pull mistral
```

#### Additional Recommended Models

For more advanced use cases, consider these powerful models available from Hugging Face:

```bash
ollama pull hf.co/unsloth/gpt-oss-20b-GGUF:Q6_K_XL
ollama pull hf.co/janhq/Jan-v1-4B-GGUF:Q4_K_M
ollama pull hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M
```

### 4. Set Up Python Environment

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

### 5. Install Dependencies

Install the required Python packages from `requirements.txt`:

```bash
pip install -r requirements.txt
```

### 6. Configure the Application

Create a `.env` file in the root directory.

- **Ollama**: Configure the base URL and default model.
- **ChromaDB (Optional)**: Add your credentials to enable cloud-based persistent history. If you leave these blank, the application will fall back to a local SQLite database.
- **Langfuse**: Credentials are no longer set here. They are configured through the **Settings** page in the web UI (`/settings`).

```dotenv
# .env

# --- Ollama Configuration ---
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1

# --- Default Model Parameters ---
NUM_PREDICT=2024
TEMPERATURE=0.7
TOP_P=0.8
TOP_K=20

# --- ChromaDB Configuration (Optional) ---
# If you leave these blank, the app will use a local SQLite database.
CHROMA_API_KEY=
CHROMA_TENANT=
CHROMA_DATABASE=
```

### 7. Run the Application

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
- **Web Search**: Once SearXNG is set up and enabled in Settings, click the 🔍 icon or type `/search` followed by your query in the chat input to get up-to-date answers from the web (e.g., `/search latest AI news`).



#### Manually setting up SearXNG from(Optional)

From [searxng](https://github.com/searxng/searxng-docker)

##### Manually Edit searxng/settings.yml to configure SearXNG as needed.
```bash
  url: redis://redis:6379/0
search:
  formats:
    - html
    - json
```
##### Start the SearXNG service with Docker Compose.
``` bash
docker compose up -d
```
 - <p>Your SearXNG instance will be available at http://127.0.0.1:8080 once the containers are running.</p>
 - <p>Marke sure port 8080 is open</p>

To perform a web search, click the 🔍 icon or type `/search` followed by your query in the chat input (e.g., `/search latest news on AI`).

## 📄 Documentation

For more detailed information about the application's architecture, features, and API, please see the [documentation](documentation.md).
