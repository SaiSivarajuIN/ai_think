# backend documentation

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
- Notes & Recommendations
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

### 7.8 Frontend Experience: Typewriter Effect

The backend's ability to stream responses token-by-token via a generator is crucial for the frontend implementation of a "typewriter effect." The frontend reads this stream and appends content to the UI in real-time, creating a dynamic and engaging user experience as the assistant appears to "type" its response. This is handled by `script.js` on the client side.

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

### Bulk Configuration via `cloud_api.csv`

For easier setup, the application can read a `cloud_api.csv` file from the project root on startup to pre-populate known cloud services. This allows for defining service names and their API endpoints in bulk.

The CSV file should contain two columns: `service_name` and `api_endpoint`.

**Structure:**

*   **Column 1**: `service_name` (e.g., `OpenAI`, `Perplexity`)
*   **Column 2**: `api_endpoint` (The base URL for the service's API)

**Example `cloud_api.csv`:**

```csv
OpenAI,https://api.openai.com/v1
Perplexity,https://api.perplexity.ai
```

On startup, the application will parse this file and add these services to the database if they don't already exist. You will still need to add API keys and specific model names through the web UI.

### Service Logo Mapping via `cloud_logos.csv`

To automatically associate service providers with their brand logos in the user interface, the application can read a `cloud_logos.csv` file from the project root. This file maps a service name to a specific logo filename located in the `static/logos/` directory.

The CSV file must contain two columns: `service_name` and `logo_filename`.

**Structure:**

*   **Column 1**: `service_name` (This should match the `service_name` used in `cloud_api.csv` and the database, e.g., `OpenAI`)
*   **Column 2**: `logo_filename` (The corresponding logo file, e.g., `openai.png`)

**Example `cloud_logos.csv`:**

```csv
OpenAI,openai.png
Perplexity,perplexity.png
```

On startup, the application loads this mapping. When rendering cloud models, the system uses this information to display the correct logo next to the service name.


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

The application is designed with several layers of error handling and safeguards to ensure stability and provide a good user experience.

### 1. API & Network Resilience

- **Model Interaction Retries**: Both `ollama_chat()` and `cloud_model_chat()` implement a retry mechanism with exponential backoff. If a request to an LLM fails due to a transient error, the system automatically retries up to 3 times with increasing delays (1s, 2s, 4s).
- **Connection Timeouts**: All external API calls (Ollama, Cloud Models, SearXNG) have defined timeouts to prevent the application from hanging on unresponsive services. For example, model generation has a 5-minute timeout.
- **Service Status Checks**: The `/health` endpoint actively checks the connectivity of all dependent services. The backend uses these checks to gracefully degrade functionality. For example, if SearXNG is down, the `/search` command will return an informative message to the user instead of failing the entire request.

### 2. Database Fallbacks

- **ChromaDB to SQLite**: The application prioritizes ChromaDB if configured. However, if the ChromaDB instance becomes unavailable (detected via `initialize_chroma()` or during an operation), the system automatically and gracefully falls back to using the local SQLite database for the current session. This ensures that chat history and other features continue to function without crashing the application. The connection status is re-checked periodically.
- **Database Initialization**: On startup, `init_db()` ensures all necessary tables exist, preventing errors from missing tables.

### 3. Client-Side Request Handling

- **Generation Interruption**: The `/generate` endpoint is wrapped in a `try...except` block that specifically catches `ClientDisconnected` errors. This allows users to click the "Stop" button on the frontend to safely terminate a streaming response on the server without causing an application error.
- **Input Validation**: API endpoints perform basic validation on incoming request bodies to ensure required fields are present before processing.

### 4. File Upload Safeguards

- **Type Filtering**: The `/upload` endpoint is configured to only accept specific file types (e.g., `.txt`, `.png`, `.jpg`). Attempts to upload other file types are rejected.
- **Size Limits**: While not explicitly defined in the current implementation, it is recommended to configure the Flask application with `MAX_CONTENT_LENGTH` in a production environment to prevent denial-of-service attacks via very large file uploads.

### 5. Comprehensive Logging

- **Error Tracing**: All unhandled exceptions are caught by a global error handler, logged to the rotating log file in `logger/` with a full stack trace, and a generic "500 Internal Server Error" is returned to the user. This prevents leaking sensitive application details.
- **Log Rotation**: The logging system uses a `TimedRotatingFileHandler` to automatically rotate logs daily and keep a 30-day history, preventing log files from consuming excessive disk space.

- **Log Rotation**: The logging system uses a `TimedRotatingFileHandler` to automatically rotate logs daily and keep a 30-day history, preventing log files from consuming excessive disk space.

### 6. API Status Codes & Error Responses

For consistency, the standard API status codes, their meanings, and descriptions are defined in `error_handling.csv` in the project root. This file serves as a single source of truth for documentation and can be used by developers to ensure error responses are standardized across the application.

**Structure:**

The CSV file should contain three columns: `Status Code`, `Meaning`, and `Description`.

*   **Column 1**: `Status Code` (e.g., `404`)
*   **Column 2**: `Meaning` (e.g., `Not Found`)
*   **Column 3**: `Description` (A brief explanation of the error)

**Example `error_handling.csv`:**

```csv
Status Code,Meaning,Description
400,Bad Request,"The server could not understand the request due to invalid syntax, such as malformed JSON or missing required parameters."
404,Not Found,The requested resource could not be found on the server.
503,Service Unavailable,The server is temporarily unable to handle the request, often because a required downstream service is offline.
```


The API uses standard HTTP status codes to indicate the success or failure of a request. For client-side errors (4xx) and server-side errors (5xx), the response body will typically contain a JSON object with an `error` key describing the issue.

| Status Code | Meaning | Description |
| :--- | :--- | :--- |
| `200 OK` | Success | The request was successful. The response body contains the requested data. |
| `201 Created` | Created | The resource was successfully created (e.g., a new prompt or cloud model). |
| `400 Bad Request` | Bad Request | The server could not understand the request due to invalid syntax, such as malformed JSON or missing required parameters. |
| `404 Not Found` | Not Found | The requested resource (e.g., a specific session ID, model, or API endpoint) could not be found on the server. |
| `422 Unprocessable Entity` | Unprocessable Entity | The request was well-formed, but the server was unable to process the contained instructions (e.g., trying to pull a model that doesn't exist). |
| `500 Internal Server Error` | Internal Server Error | A generic server error occurred. The logs will contain a detailed stack trace. This prevents leaking sensitive application details. |
| `503 Service Unavailable` | Service Unavailable | The server is temporarily unable to handle the request, often because a required downstream service (like Ollama or ChromaDB) is offline. |

## Notes & Recommendations

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
