# AI Think Chat - Developer Documentation

## Overview

AI Think Chat is a Flask-based web application that provides an intelligent chat interface with support for both local Ollama models and cloud-based AI services. The application features conversation management, file uploads (text and image), web search integration, and comprehensive monitoring capabilities.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Architecture](#architecture)
- [Logging System](#logging-system)
- [ChromaDB Integration](#chromadb-integration)
- [Langfuse Tracing](#langfuse-tracing)
- [API Endpoints](#api-endpoints)
- [Core Functions](#core-functions)
- [File Upload Pipeline](#file-upload-pipeline)
- [/generate Endpoint (Core Chat Logic)](#generate-endpoint-core-chat-logic)
- [Chat Session System](#chat-session-system)
- [Prompts System](#prompts-system)
- [Cloud Model Management](#cloud-model-management)
- [Local Model (Ollama) Management](#local-model-ollama-management)
- [System Health Dashboard](#system-health-dashboard)
- [Search Integration](#search-integration)
- [Settings System](#settings-system)
- [History Page (`/history`)](#history-page-history)
- Error Handling & Safeguards
- Developer Notes & Recommendations
- API Reference --- Complete List of All API Endpoints

## Prerequisites

- Python 3.8 or higher
- Virtual environment (recommended)
- Ollama installed and running locally
- SQLite (comes bundled with Python)
- SQLite (for development) or PostgreSQL (for production)
- Optional: ChromaDB Cloud account for distributed storage
- Optional: Langfuse account for tracing
- Optional: SearXNG instance for web search

## Installation and Setup

For quick installation and setup, please refer to the main [README.md](../README.md) file.

### Step 1: Database Initialization

The database initializes automatically on first run. The `init_db()` function creates all necessary tables and performs automatic migrations.

### Step 2: Running the Application

Execute the Flask application:

    python app.py

The application will start on `http://localhost:1111`.

## Architecture

### Database Schema

The application uses SQLite with the following core tables:

**messages**: Stores chat conversation history
- `id`: Primary key
- `session_id`: Groups messages by conversation
- `sender`: Either 'user', 'assistant', or 'system'
- `content`: Message content
- `timestamp`: Creation timestamp
- `generation_time`: Response generation time
- `model_used`: Model identifier
- `tokens_per_second`: Performance metric

**session_summaries**: Custom session titles
- `session_id`: Primary key
- `summary`: Custom name for the session
- `timestamp`: Creation time

**settings**: Application configuration
- Model parameters (temperature, top_p, top_k, num_predict)
- Integration credentials (Langfuse, ChromaDB, SearXNG)
- Feature toggles

**prompts**: Reusable prompt templates
- `id`: Primary key
- `title`: Prompt name
- `type`: Category (e.g., Code, Research)
- `content`: Prompt text

**cloud_models**: External AI service configurations
- `service`: Provider name
- `base_url`: API endpoint
- `api_key`: Authentication key
- `model_name`: Specific model identifier
- `active`: Visibility toggle

**local_models**: Ollama model registry
- `name`: Model identifier
- `active`: Visibility toggle

**api_usage_metrics**: Token consumption tracking
- `model`: Model used
- `session_id`: Associated conversation
- `input_tokens_per_message`: Prompt tokens
- `output_tokens_per_message`: Completion tokens
- `timestamp`: Usage time

### Logging System

The application implements rotating file logs stored in the `logger/` directory:

- **Rotation Schedule**: Daily at midnight
- **Retention**: 30 days
- **Format**: `app.log.YYYY-MM-DD.txt`
- **Content**: Request logs, application events, error stack traces
- **Implementation**: Uses `TimedRotatingFileHandler`

### ChromaDB Integration

ChromaDB serves as an optional distributed storage backend:

- **Fallback Mechanism**: Automatically falls back to SQLite if unavailable
- **Collection**: `chat_history`
- **Configuration**: Requires API key, tenant, and database name
- **Status Check**: Available on `/health` endpoint

### Langfuse Tracing

Provides observability for chat interactions:

- **Initialization**: Dynamic credential validation via `initialize_langfuse()`
- **Trace Structure**: Parent span for chat generation, nested span for API call
- **Logged Data**: Input prompts, responses, model parameters, token usage
- **Authentication**: Verified with `auth_check()` before enabling
- **Incognito Support**: Tracing disabled in incognito mode

## API Endpoints

### Chat Operations

`GET /`: Main chat interface
- Returns the chat page with available models
- Parameters: Optional `session_id` in URL
- Template: `index.html`

`POST /generate`: Generate AI responses
- Request body: `messages`, `newMessage`, `model`, `incognito`, `is_regeneration`
- Returns: Assistant response, usage statistics, session ID
- Features: Retry logic with exponential backoff, web search support
- Error handling: Catches `ClientDisconnected` for stop functionality

`POST /upload`: File upload for context
- Accepts: `.txt`, `.png`, `.jpg` files
- Stores text content or Base64-encoded image data as a 'system' message
- Returns: Success confirmation with filename

`POST /reset_thread`: Start new conversation
- Clears current session ID
- Returns: Status confirmation

### Session Management

`GET /api/sessions`: List all chat sessions
- Returns: Sessions grouped by date (Today, Yesterday, etc.)
- Includes custom summaries if available
- Sorted by most recent message

`GET /api/session/<session_id>`: Fetch specific conversation
- Returns: Full message history for the session
- Includes metadata (generation time, model used, tokens/second)
- Ordered by timestamp

`DELETE /delete_message/<id>`: Remove individual message
- Deletes from active database (ChromaDB or SQLite)

`DELETE /delete_all_threads`: Clear all conversations
- Removes all sessions from database

### Model Management

`GET /api/models`: List local Ollama models
- Syncs with Ollama API
- Includes active status from database
- Sorted alphabetically

`POST /api/models/pull`: Download new model
- Streams progress from Ollama
- Request body: `model` name

`POST /api/models/delete`: Remove local model
- Handles empty responses correctly
- Request body: `model` name

`POST /api/models/delete/all`: Remove all local models

`POST /api/local_models/toggle_active`: Toggle model visibility
- Request body: `name`, `active` (boolean)

`POST /api/local_models/toggle_all_active`: Toggle all local models
- Request body: `active` (boolean)

### Cloud Models

`GET /api/cloud_models`: List configured cloud models
- Returns all cloud service configurations
- Includes active status

`POST /api/cloud_models/create`: Add new cloud model
- Request body: `service`, `base_url`, `api_key`, `model_names` (array)
- Supports multiple models per service

`POST /api/cloud_models/update/<id>`: Modify configuration
- Request body: Same as create
- Handles model list changes (add/remove)

`DELETE /api/cloud_models/delete/<id>`: Remove configuration

`POST /api/cloud_models/toggle_active/<id>`: Toggle service group
- Affects all models in the same service/base_url group
- Request body: `active` (boolean)

`POST /api/cloud_models/toggle_all_active`: Toggle all cloud models
- Request body: `active` (boolean)

### Prompt Management

`GET /api/prompts`: List all saved prompts
- Ordered by title

`POST /api/prompts/create`: Create new prompt
- Request body: `title`, `type`, `content`

`POST /api/prompts/update/<id>`: Update existing prompt
- Request body: `title`, `type`, `content`

`DELETE /api/prompts/delete/<id>`: Remove prompt

### Settings & Monitoring

`GET /settings`: Settings page
- Displays current configuration

`POST /settings`: Update configuration
- Updates database and reinitializes integrations
- Returns to settings page

`GET /health`: System health dashboard
- CPU, memory, disk, GPU metrics
- Service status (Ollama, Langfuse, SearXNG, ChromaDB)
- Active model display

`GET /history`: Full conversation history
- Groups sessions by date
- Collapsible session view
- Supports session renaming

`GET /dashboard`: API usage statistics
- Time range filtering (1h, 1d, 7d, 28d, 90d)
- Token consumption metrics
- Per-model usage breakdown
- Session linking

## Core Functions

### `ollama_chat(messages, model, session_id, max_retries, is_incognito)`

Handles local Ollama model interactions:

- **Retry Logic**: Up to 3 attempts with exponential backoff (1s, 2s, 4s)
- **Timeout**: 300 seconds (5 minutes)
- **Langfuse Integration**: Wraps in trace/generation spans
- **Incognito Support**: Skips tracing when enabled
- **Returns**: Dictionary with `content` and `usage` keys

### `cloud_model_chat(messages, model_config, session_id, max_retries, is_incognito)`

Manages cloud API requests:
- **Endpoint Construction**: Appends `/chat/completions` to base URL
- **Authentication**: Bearer token from configuration
- **Format**: OpenAI-compatible request/response
- **Langfuse Integration**: Same structure as Ollama
- **Returns**: Dictionary with `content` and `usage` keys

### `search_searxng(query)`

Performs web searches using SearXNG:
- **Configuration Check**: Verifies SearXNG is enabled
- **Results**: Returns top 5 formatted results
- **Format**: Title, URL, snippet for each result
- **Error Handling**: Returns descriptive error messages

### `get_settings()`

Fetches configuration from database:
- **Fallback**: Returns hardcoded defaults if database fails
- **Source**: SQLite settings table

### `save_settings(settings_dict)`

Persists configuration changes:
- **Type Conversion**: Ensures correct data types
- **Primary Storage**: Always saves to SQLite

### `initialize_langfuse()`

Sets up Langfuse tracing client:
- **Reset Mechanism**: Shuts down and resets singleton before reinit
- **Authentication**: Validates credentials with `auth_check()`
- **Global State**: Updates `langfuse_enabled` flag

### `initialize_chroma()`

Establishes ChromaDB connection:
- **Configuration**: Uses credentials from settings
- **Heartbeat Check**: Verifies connection health
- **Collection**: Creates or retrieves `chat_history`
- **Fallback**: Disables on connection failure

### `check_ollama_connection()`

Tests Ollama availability:
- **Endpoint**: `GET /api/tags`
- **Timeout**: 5 seconds
- **Returns**: Boolean status

### `check_searxng_connection()`

Validates SearXNG access:
- **Configuration Check**: Returns False if disabled
- **Endpoint**: Base URL
- **Timeout**: 3 seconds
- **Returns**: Boolean status

## File Upload Pipeline

Route: `/upload`

| Type   | Handling |
|--------|----------|
| `.txt` | Stored directly as text into SQLite/Chroma |
| Images | Converted to Base64, stored as special multimodal content |

File context is automatically prepended on the next `/generate` call.

Multimodal support:

```

[
{"type": "text", "text": "..."},

```
{"type": "image_url", "image_url": {"url": "data:<mime>;base64,<data>"}}
```

]

```

## /generate Endpoint (Core Chat Logic)

The **heart of the entire backend**.

Workflow:

### 7.1 Input Extraction

- `messages` (existing conversation)
- `newMessage`
- `model` (local or cloud)
- `incognito`
- `is_regeneration`

### 7.2 Regeneration

Deletes the last user/assistant message pair (SQLite only).

### 7.3 File Context Injection

If first user message:

- Load recent file context from SQLite/Chroma
- For TXT → prepend document content
- For Image → add to multimodal payload

### 7.4 Search Command

If user enters:

    /search <text>

Results from SearXNG are injected into the prompt.

### 7.5 Model Execution

Routes either to:

    cloud_model_chat()
    ollama_chat()

### 7.6 Save Results

If not incognito:

- Save to SQLite or Chroma
- Save timing
- Save token metrics

### 7.7 Response

Returns:

- Assistant message
- Modified user message
- Token usage
- Timing
- Model used
- Session ID
- Tokens per second

## Chat Session System

### ThreadManager

Generates `session_id` for conversations.

### `/api/session/<id>`

Return full ordered message list.

### `/api/sessions`

Returns grouped sessions:

- Today
- Yesterday
- Previous 7 days
- Previous 30 days

### Custom Summaries

Stored in `session_summaries`.

### Reset Thread

Route: `/reset_thread`
Clears session ID.

## Prompts System

CRUD for prompts:

- `/api/prompts`
- `/api/prompts/create`
- `/api/prompts/update/<id>`
- `/api/prompts/delete/<id>`

Stored in SQLite.

## Cloud Model Management

### Endpoints:

- `/api/cloud_models`
- `/api/cloud_models/create`
- `/api/cloud_models/update/<id>`
- `/api/cloud_models/<id>`...

Fields stored:

- service
- base_url
- api_key
- model_name
- active


## Local Model (Ollama) Management

Routes:

- `/api/models` → list
- `/api/models/pull` → pull with streaming
- `/api/models/delete`
- `/api/models/delete/all`

Also maintains:

    local_models table


## System Health Dashboard

Route: `/health`

Uses:

- `psutil`
- `GPUtil`
- Checks for:
    - CPU
    - RAM
    - Disk
    - GPU
    - Ollama
    - SearXNG

Classifies statuses as:

- stable
- warning
- critical

## Search Integration

Function: `search_searxng()`

Triggered on:

    /search query

Returns:

- Top 5 results
- Title
- URL
- Snippet

Injected into LLM prompt automatically.

## Settings System

Global settings stored in:

    settings table

Fields include:

- num_predict
- temperature
- top_p
- top_k
- langfuse keys
- chroma keys
- searxng settings
- toggles for each subsystem

Reinitialization triggers:

- `initialize_langfuse()`
- `initialize_chroma()`

## History Page (`/history`)

Provides full UI rendering of:

- sessions
- messages
- timestamps
- grouping
- custom summaries

Used by the frontend to populate the chat history sidebar.


## Error Handling & Safeguards

### Built-In Protection:

- Exponential backoff for models
- Graceful fallback to SQLite
- Chroma failures don't crash the app
- Incognito mode (no DB writes, no Langfuse)
- ClientDisconnected handling
- Logging with rotation
- Schema migration safety

## Developer Notes & Recommendations

### Suggested Modular Refactor 

This file is monolithic; recommended modules:

    /services
     - ollama_service.py
     - cloud_service.py
     - chroma_service.py
     - settings_service.py
     - prompts_service.py
     - models_service.py

    /routes
     - chat_routes.py
     - model_routes.py
     - history_routes.py
     - settings_routes.py
     - health_routes.py

### Testing

- Unit tests for model routing and database
- Integration tests for `/generate`
- Mock SearXNG and Langfuse in CI

### Security

- Mask API keys in logs
- Use HTTPS in production
- Limit file upload size


## API Reference --- Complete List of All API Endpoints

This table includes:

* Method
* Route
* Purpose
* Request Body (if applicable)
* Response Summary

---

## **1. Chat & Session APIs**

| Method     | Route                         | Purpose                                   | Request Body                                                      | Response                             |
| ---------- | ----------------------------- | ----------------------------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| **POST**   | `/generate`                   | Main chat generation with local/cloud LLM | `messages`, `newMessage`, `model`, `incognito`, `is_regeneration` | Assistant message, usage, TPS, model |
| **POST**   | `/new-thread`                 | Create a new chat session/thread          | *none*                                                            | `{session_id}`                       |
| **DELETE** | `/delete_message/<id>`        | Delete a single message                   | *none*                                                            | Status JSON                          |
| **DELETE** | `/delete_thread/<session_id>` | Delete entire session                     | *none*                                                            | Status JSON                          |
| **GET**    | `/history`                    | Returns grouped chat history              | *none*                                                            | HTML page                            |
| **GET**    | `/api/session/<id>`           | Get message list for a session            | *none*                                                            | `{messages: [...]}`                  |
| **POST**   | `/reset_thread`               | Reset current session ID                  | *none*                                                            | Redirect                             |

---

## **2. File & Image Upload APIs**

| Method   | Route     | Purpose              | Request Body | Response                   |
| -------- | --------- | -------------------- | ------------ | -------------------------- |
| **POST** | `/upload` | Upload text or image | `file`       | Stored message, session ID |

---

## **3. LLM Model Management — Local (Ollama)**

| Method   | Route                    | Purpose                      | Request Body  | Response             |
| -------- | ------------------------ | ---------------------------- | ------------- | -------------------- |
| **GET**  | `/api/models`            | List installed Ollama models | *none*        | `{models: [...]}`    |
| **POST** | `/api/models/pull`       | Pull new Ollama model        | `{modelName}` | Streamed pull output |
| **POST** | `/api/models/delete`     | Delete one local model       | `{modelName}` | Status               |
| **POST** | `/api/models/delete/all` | Delete all local models      | *none*        | Status               |

---

## **4. LLM Model Management — Cloud Models**

| Method   | Route                           | Purpose                                     | Request Body                                       | Response          |
| -------- | ------------------------------- | ------------------------------------------- | -------------------------------------------------- | ----------------- |
| **GET**  | `/api/cloud_models`             | List all configured cloud LLMs              | *none*                                             | `{models: [...]}` |
| **POST** | `/api/cloud_models/create`      | Add new cloud model                         | `{service, base_url, api_key, model_name, active}` | Status            |
| **POST** | `/api/cloud_models/update/<id>` | Update config (all models in service group) | `{service, base_url, api_key}`                     | Status            |
| **GET**  | `/api/cloud_models/<id>`        | Get single cloud model including full key   | *none*                                             | `{model: {...}}`  |

---

## **5. Prompt Hub APIs**

| Method     | Route                      | Purpose                | Request Body       | Response           |
| ---------- | -------------------------- | ---------------------- | ------------------ | ------------------ |
| **GET**    | `/api/prompts`             | List all prompts       | *none*             | `{prompts: [...]}` |
| **POST**   | `/api/prompts/create`      | Create prompt          | `{title, content}` | Status             |
| **POST**   | `/api/prompts/update/<id>` | Update existing prompt | `{title, content}` | Status             |
| **DELETE** | `/api/prompts/delete/<id>` | Delete prompt          | *none*             | Status             |

---

## **6. Settings APIs**

| Method   | Route       | Purpose           | Request Body                                          | Response  |
| -------- | ----------- | ----------------- | ----------------------------------------------------- | --------- |
| **GET**  | `/settings` | View app settings | *none*                                                | HTML page |
| **POST** | `/settings` | Update settings   | `{temperature, top_p, model defaults, keys, toggles}` | Status    |

---

## **7. Dashboard APIs**

| Method   | Route             | Purpose            | Request Body                   | Response                            |
| -------- | ----------------- | ------------------ | ------------------------------ | ----------------------------------- |
| **GET**  | `/dashboard`      | Load dashboard UI  | *none*                         | HTML                                |
| **POST** | `/dashboard/data` | Get analytics data | `{time_range}`, optional dates | Usage JSON (tokens, models, counts) |

---

## **8. Search & Utilities**

| Method  | Route                      | Purpose                                | Request Body | Response                        |
| ------- | -------------------------- | -------------------------------------- | ------------ | ------------------------------- |
| **GET** | `/api/search` *(internal)* | SearXNG query (used by `/generate`)    | `q`          | Search results JSON             |
| **GET** | `/health`                  | System health (CPU/GPU/RAM/app status) | *none*       | `{status, metrics, components}` |

---

## **9. Frontend Routes (Pages)**

| Method  | Route      | Purpose           |
| ------- | ---------- | ----------------- |
| **GET** | `/`        | Main chat UI      |
| **GET** | `/about`   | About page        |
| **GET** | `/history` | History list view |
