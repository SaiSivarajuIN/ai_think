[![CI/CD Pipeline](https://github.com/SaiSivarajuIN/ai_think/actions/workflows/main.yml/badge.svg)](https://github.com/SaiSivarajuIN/ai_think/actions/workflows/main.yml)

# **AI Think — Local & Cloud LLM Chat**

Lightweight, self-hosted web chat for local **Ollama** models & cloud models like (**OpenAI**, **Perplexity**, and **more**) with optional integrations (**Langfuse**, **SearXNG**).

---

## Table of Contents

* [Quick Start](#quick-start)

  * [Prerequisites](#prerequisites)
  * [Install Ollama](#install-ollama)
  * [Environment & Dependencies](#environment--dependencies)
  * [Configuration](#configuration)
  * [Run](#run)
* [Features](#features)
* [Usage](#-usage)
* [Optional SearXNG WebSearch](#optional---searxng-websearch) 
* [Keyboard Shortcuts](#keyboard-shortcuts)
* [Configuration Notes](#configuration-notes)
* [Documentation & Feedback](#documentation--feedback)

---

## Quick Start

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

> Additional credentials for optional integrations can be configured via the web UI under **Settings**.

---

### Run

Start the Flask server:

```bash
python main.py
```

Then open: [http://localhost:1111](http://localhost:1111)

---

## Features

* Clean chat UI with **model selector** and **history sidebar**
* **Local Models Hub**: pull / delete models from Ollama
* **Cloud Integrations**: OpenAI, Perplexity, Langfuse
* Persistent chat history with SQLite
* **Prompt Hub** for reusable system prompts
* **User Dashboard**: View usage statistics like total sessions and messages
* **Health Dashboard**: CPU / RAM / Disk / GPU, Ollama / Langfuse statuses
* **Runtime settings** (no restart required)
* **Incognito mode** for ephemeral chats
* **Interrupt responses** from the UI
* **Markdown rendering** with syntax highlighting

---

## Project Structure

The project is organized as follows:

```
/
├── app.py                  # Main Flask application
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables (user-created)
├── README.md               # This file
├── ollamaSetup.sh          # Ollama setup script for macOS/Linux
├── ollamaSetup.bat         # Ollama setup script for Windows
│
├── static/                 # Static assets (CSS, JS, images)
│   ├── script.js           # Main chat interface logic
│   ├── models.js           # Logic for the local models hub
│   ├── cloud_models.js     # Logic for the cloud models page
│   └── logos/              # Service provider logos
│
├── templates/              # Flask HTML templates
│   ├── base.html           # Base layout for all pages
│   ├── index.html          # Main chat page
│   ├── history.html        # Chat history page
│   ├── models.html         # Local models management
│   ├── cloud_models.html   # Cloud models management
│   └── ...                 # Other application pages
│
├── documentation/          # Project documentation
│   └── backend.md          # Detailed backend documentation
│
└── logger/                 # Log files (created at runtime)
    └── app.log             # Main application log
```

## Usage

* **Chat:** Open `/` to start chatting and switch models from the dropdown
* **New Chat:** Click “New Chat” in the header
* **History:** View previous chats at `/history`
* **Dashboard:** See your usage stats at `/dashboard`
* **Settings:** Manage model params, Langfuse keys, and SearXNG at `/settings`
* **Models Hub:** Browse, pull, and delete models via `/models`
* **Prompts:** Manage reusable prompts at `/prompts`
* **System Health:** Monitor system and API status at `/health`

**Example (via Ollama CLI):**

```bash
ollama pull hf.co/unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M
```

---

## Optional - SearXNG WebSearch

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

* Click the 🌐 icon, or
* Type `/search latest AI news`

---

## Optional - [Tesseract OCR for PDFs](https://tesseractocr.org/)

To enable Optical Character Recognition (OCR) for image-based PDF files, you need to install Tesseract. This allows the application to extract text from PDFs that contain scanned documents or images.

### 1. Install Tesseract

**Windows:**

Download and install Tesseract from the official project page:
*   [Tesseract at UB Mannheim](https://github.com/UB-Mannheim/tesseract/wiki)

During installation on Windows, make sure to note the installation path (e.g., `C:\Program Files\Tesseract-OCR`).

**Linux**
* Install Library -- ```sudo apt install tesseract-ocr``
* Download Languages -- ```sudo apt install tesseract-ocr-all```

**macOS** 
* Install Library -- ```brew install tesseract```
* Download Languages -- ```brew install tesseract-lang```

Test Installation ```tesseract --version```


#### Windows Configure Environment Variable

After installation, add the path to the Tesseract executable to your `.env` file.

**Windows:**
```env
TESSERACT_CMD="C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
```

If Tesseract is installed in your system's `PATH`, this variable is not required. The application will automatically detect it.

---

## ⌨️ Keyboard Shortcuts

| Shortcut  | Action                      |
| --------- | --------------------------- |
| `Alt + S` | Toggle sidebar              |
| `Alt + H` | Toggle chat history sidebar |
| `Alt + N` | Incognito mode              |

---


## Configuration Notes

* **Settings** are saved to SQLite
* **Langfuse** credentials apply immediately after update

---

## Documentation & Feedback

* Developer  [Documentation](documentation/backend.md)
* Feedback [Google Form](https://forms.gle/aQKPYcT4669bTHqA9)

---

**Powered by Ollama AI, created with Gemini AI.**
