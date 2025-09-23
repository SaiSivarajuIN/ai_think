[![CI/CD Pipeline](https://github.com/SaiSivarajuIN/ai_think/actions/workflows/main.yml/badge.svg)](https://github.com/SaiSivarajuIN/ai_think/actions/workflows/main.yml)

# AI Think Project with Local & Cloud Models

AI Think is a self-hosted, web-based chat application that provides a user-friendly interface for interacting with large language models (LLMs) served by a local Ollama instance. It features a clean UI, dynamic model controls, persistent chat history, system monitoring, and observability features.

## ✨ Features

- **Intuitive Chat Interface**: Clean and simple UI for chatting with your local LLMs.
- **Model Selection**: Easily switch between any of the models available in your Ollama instance.
- **Models Hub**: Manage your local Ollama models directly from the UI—pull new models and delete old ones.
- **Cloud Model Integration**: Connect to external model providers like OpenAI, Perplexity, and more via their APIs.
- **Persistent Chat History**: Conversations are saved using a local SQLite database, with optional support for a more scalable [ChromaDB](https://www.trychroma.com/) cloud instance.
- **Prompt Hub**: Create, manage, and reuse system prompts to streamline your workflows.
- **Web Search**: Get up-to-date answers from the internet by integrating with a local [SearXNG](https://github.com/searxng/searxng-docker) instance.
- **System Health Dashboard**: Monitor real-time CPU, memory, disk, and GPU usage, along with connection statuses for all integrated services.
- **Dynamic Configuration**: Adjust model parameters (temperature, top-p, etc.) and integration settings on the fly without restarting the server.
- **Langfuse Integration**: Optional, powerful tracing and observability for your LLM interactions [Langfuse](https://us.cloud.langfuse.com/).
- **Markdown Rendering**: Responses are rendered with support for markdown, including code blocks with syntax highlighting.

## 🚀 Setup and Installation

Follow these steps to get the application running on your local machine.

### 1. Prerequisites

- Python 3.10+
- [Ollama](https://ollama.com) installed and running.

### 2. Install Ollama

You can either follow the manual instructions below or use the automated scripts.

#### Automated Installation (Recommended)

The `ollamaSetup.sh && ollamaSetup.bat` script will install Ollama and download a recommended GGUF model.

- **For macOS & Linux**:
  Open a terminal, make the script executable, and run it. This will also start the Ollama server in the background.

  ```bash
  chmod +x ./ollamaSetup.sh
  ./ollamaSetup.sh
  ```

- **For Windows**:
  Open a terminal, make the script executable, and run it. This will also start the Ollama server in the background.

  ```bash
  ./ollamaSetup.bat
  ```

#### Manual Installation

If you prefer to install manually:
- **Windows & macOS**:
  Download from the [official Ollama website](https://ollama.com/download).
- **Linux**:
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ```

### 3. Pull Models

Once Ollama is running, you can pull models in two ways:

-   **Recommended**: Use the **Models Hub** in the web UI (`/models`) to easily browse, pull, and manage your local models.
-   **Alternatively**: Pull models directly from the command line. You can find models on the Ollama Library.

#### Additional Recommended Models

For more advanced use cases, consider these powerful models available from Hugging Face:

```bash
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
- **Models Hub**: Go to `/models` to pull new models or delete existing ones from your local Ollama instance.
```bash
hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M
```
- **Prompt Hub**: Go to `/prompts` to create, manage, and reuse system prompts for your conversations.
- **Web Search**: Once SearXNG is set up and enabled in Settings, click the 🔍 icon or type `/search` followed by your query in the chat input to get up-to-date answers from the web (e.g., `/search latest AI news`).



#### Manually setting up SearXNG(Optional)

From [searxng](https://github.com/searxng/searxng-docker#how-to-use-it)

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
 - Your SearXNG instance will be available at `http://localhost:8080` once the containers are running.
 - Marke sure port 8080 is open

To perform a web search, click the 🔍 icon or type `/search` followed by your query in the chat input (e.g., `/search latest news on AI`).

## ⌨️ Keyboard Shortcuts

-   **`Alt + S`**: Expand or collapse the sidebar.

## 📄 Documentation

For more detailed information about the application's architecture, features, and API, please see the [documentation](documentation.md).
