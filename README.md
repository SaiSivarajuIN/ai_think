[![CI/CD Pipeline](https://github.com/SaiSivarajuIN/ai_think/actions/workflows/main.yml/badge.svg)](https://github.com/SaiSivarajuIN/ai_think/actions/workflows/main.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# **AI Think — Local & Cloud LLM Chat**

Lightweight, self-hosted web chat for local **Ollama** models with optional cloud integrations (**OpenAI**, **Perplexity**, **ChromaDB**, **Langfuse**, **SearXNG**).

---

## 📚 Table of Contents

* [Quick Start](#-quick-start)

  * [Prerequisites](#prerequisites)
  * [Install Ollama](#install-ollama)
  * [Environment & Dependencies](#environment--dependencies)
  * [Configuration](#configuration)
  * [Run](#run)
* [Features](#✨-features)
* [Usage](#-usage)
* [Optional SearXNG WebSearch](#-optional---searxng-websearch) 
* [Keyboard Shortcuts](#-keyboard-shortcuts)
* [Configuration Notes](#-configuration-notes)
* [Documentation & Feedback](#-documentation--feedback)

---

## 🚀 Quick Start

### Prerequisites

* Python **3.10+**
* [Ollama installed and running locally](#install-ollama)

**Clone the Repository:**
  ```bash
    git clone https://github.com/SaiSivarajuIN/ai_think.git
    cd ai_think
  ```

---

### Install Ollama

#### Automated (Recommended)

Use the bundled setup script to install and pull a model.

**macOS / Linux:**

```bash
chmod +x ./ollamaSetup.sh && ./ollamaSetup.sh
```

**Windows:**

```bash
./ollamaSetup.bat
```

#### Manual

Download from [https://ollama.com/download](https://ollama.com/download)

---

### Environment & Dependencies

**Create and activate a virtual environment:**

**Windows:**

```bash
py -m venv .venv
.venv\Scripts\activate
```

**macOS / Linux:**

```bash
python3 -m venv .venv
source .venv/bin/activate
```

**Install dependencies:**

```bash
pip install -r requirements.txt
```

---

### Configuration

Create a `.env` file in the project root with at least:

```env
# --- Ollama Settings ---
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:1b

# --- Default Model Parameters ---
NUM_PREDICT=1024
TEMPERATURE=0.7
TOP_P=0.9
TOP_K=40
```

> 🔧 Additional credentials (Langfuse, ChromaDB, etc.) can be configured via the web UI under **Settings**.

---

### Run

Start the Flask server:

```bash
python main.py
```

Then open: [http://localhost:5000](http://localhost:5000)

---

## ✨ Features

* Clean chat UI with **model selector** and **history sidebar**
* **Local Models Hub**: pull / delete models from Ollama
* **Cloud Integrations**: OpenAI, Perplexity, ChromaDB, Langfuse
* Persistent chat history (SQLite by default, optional ChromaDB Cloud)
* **Prompt Hub** for reusable system prompts
* **Health Dashboard**: CPU / RAM / Disk / GPU, Ollama / Langfuse / Chroma statuses
* **Runtime settings** (no restart required)
* **Incognito mode** for ephemeral chats
* **Interrupt responses** from the UI
* **Markdown rendering** with syntax highlighting

---

## 💬 Usage

* **Chat:** Open `/` to start chatting and switch models from the dropdown
* **New Chat:** Click “New Chat” in the header
* **History:** View previous chats at `/history`
* **Settings:** Manage model params, Langfuse keys, and SearXNG at `/settings`
* **Models Hub:** Browse, pull, and delete models via `/models`
* **Prompts:** Manage reusable prompts at `/prompts`
* **System Health:** Monitor system and API status at `/health`

**Example (via Ollama CLI):**

```bash
ollama pull hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M
```

---

## 🌐 Optional - SearXNG WebSearch

Run a local **SearXNG** instance and enable it in Settings to allow `/search` commands in chat.

### Setup (Docker)

From the [SearXNG Docker repository](https://github.com/searxng/searxng-docker#how-to-use-it):

**Edit `searxng/settings.yml`:**

```yaml
url: redis://redis:6379/0
search:
  formats:
    - html
    - json
```

**Start the service:**

```bash
docker compose up -d
```

Your instance will be available at:
👉 `http://localhost:8080`

Ensure port **8080** is open.

**Usage in Chat:**

* Click the 🔍 icon, or
* Type `/search latest AI news`

---

## ⌨️ Keyboard Shortcuts

| Shortcut  | Action                      |
| --------- | --------------------------- |
| `Alt + S` | Toggle sidebar              |
| `Alt + H` | Toggle chat history sidebar |
| `Alt + N` | Incognito mode              |

---

## ⚙️ Configuration Notes

* **Settings** are saved to SQLite (or ChromaDB if configured)
* **Langfuse** credentials apply immediately after update
* **ChromaDB** automatically switches to Cloud if `CHROMA_API_KEY` is set

---

## 📄 Documentation & Feedback

* Full developer docs: [documentation.md](documentation.md)
* Feedback form: [Google Form](https://forms.gle/5LeiKT1tRoNWmVst5)
