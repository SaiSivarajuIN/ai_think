# AI Think Chat - Developer Documentation

## Overview

AI Think Chat is a Flask-based web application that provides an intelligent chat interface with support for both local Ollama models and cloud-based AI services. The application features conversation management, file uploads, web search integration, and comprehensive monitoring capabilities.[^1_1]

## Prerequisites

- Python 3.8 or higher
- Virtual environment (recommended)
- Ollama installed and running locally
- SQLite (comes bundled with Python)
- Optional: ChromaDB Cloud account for distributed storage
- Optional: Langfuse account for tracing
- Optional: SearXNG instance for web search


## Installation and Setup

For Quick Installation and Setup docs: [README.md](../README.md)


### Step 1: Database Initialization

The database initializes automatically on first run. The `init_db()` function creates all necessary tables and performs automatic migrations.[^1_2]

### Step 2: Running the Application

Execute the Flask application:

```bash
python app.py
```

The application will start on `http://localhost:5000`.[^1_1]

## Architecture

### Database Schema

The application uses SQLite with the following core tables:[^1_2]

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

The application implements rotating file logs stored in the `logger/` directory:[^1_1]

- **Rotation Schedule**: Daily at midnight
- **Retention**: 30 days
- **Format**: `app.log.YYYY-MM-DD.txt`
- **Content**: Request logs, application events, error stack traces
- **Implementation**: Uses `TimedRotatingFileHandler`[^1_2]


### ChromaDB Integration

ChromaDB serves as an optional distributed storage backend:[^1_1]

- **Fallback Mechanism**: Automatically falls back to SQLite if unavailable
- **Collection**: `chat_history`
- **Configuration**: Requires API key, tenant, and database name
- **Status Check**: Available on `/health` endpoint


### Langfuse Tracing

Provides observability for chat interactions:[^1_1]

- **Initialization**: Dynamic credential validation via `initialize_langfuse()`
- **Trace Structure**: Parent span for chat generation, nested generation for API call
- **Logged Data**: Input prompts, responses, model parameters, token usage
- **Authentication**: Verified with `auth_check()` before enabling
- **Incognito Support**: Tracing disabled in incognito mode


## API Endpoints

### Chat Operations

**`GET /`**: Main chat interface

- Returns the chat page with available models
- Parameters: Optional `session_id` in URL
- Template: `index.html`[^1_1]

**`POST /generate`**: Generate AI responses

- Request body: `messages`, `newMessage`, `model`, `incognito`, `is_regeneration`
- Returns: Assistant response, usage statistics, session ID
- Features: Retry logic with exponential backoff, web search support
- Error handling: Catches `ClientDisconnected` for stop functionality[^1_2]

**`POST /upload`**: File upload for context

- Accepts: `.txt` files
- Stores content as 'system' message
- Returns: Success confirmation with filename[^1_2]

**`POST /reset_thread`**: Start new conversation

- Clears current session ID
- Returns: Status confirmation[^1_2]


### Session Management

**`GET /api/sessions`**: List all chat sessions

- Returns: Sessions grouped by date (Today, Yesterday, etc.)
- Includes custom summaries if available
- Sorted by most recent message[^1_2]

**`GET /api/session/<session_id>`**: Fetch specific conversation

- Returns: Full message history for the session
- Includes metadata (generation time, model used, tokens/second)
- Ordered by timestamp[^1_2]

**`DELETE /delete_message/<id>`**: Remove individual message

- Deletes from active database (ChromaDB or SQLite)[^1_1]

**`DELETE /delete_all_threads`**: Clear all conversations

- Removes all sessions from database[^1_1]


### Model Management

**`GET /api/models`**: List local Ollama models

- Syncs with Ollama API
- Includes active status from database
- Sorted alphabetically[^1_2]

**`POST /api/models/pull`**: Download new model

- Streams progress from Ollama
- Request body: `model` name[^1_1]

**`POST /api/models/delete`**: Remove local model

- Handles empty responses correctly
- Request body: `model` name[^1_1]

**`POST /api/models/delete/all`**: Remove all local models[^1_1]

**`POST /api/local_models/toggle_active`**: Toggle model visibility

- Request body: `name`, `active` (boolean)[^1_2]

**`POST /api/local_models/toggle_all_active`**: Toggle all local models

- Request body: `active` (boolean)[^1_2]


### Cloud Models

**`GET /api/cloud_models`**: List configured cloud models

- Returns all cloud service configurations
- Includes active status[^1_2]

**`POST /api/cloud_models/create`**: Add new cloud model

- Request body: `service`, `base_url`, `api_key`, `model_names` (array)
- Supports multiple models per service[^1_1]

**`POST /api/cloud_models/update/<id>`**: Modify configuration

- Request body: Same as create
- Handles model list changes (add/remove)[^1_2]

**`DELETE /api/cloud_models/delete/<id>`**: Remove configuration[^1_2]

**`POST /api/cloud_models/toggle_active/<id>`**: Toggle service group

- Affects all models in the same service/base_url group
- Request body: `active` (boolean)[^1_2]

**`POST /api/cloud_models/toggle_all_active`**: Toggle all cloud models

- Request body: `active` (boolean)[^1_2]


### Prompt Management

**`GET /api/prompts`**: List all saved prompts

- Ordered by title[^1_2]

**`POST /api/prompts/create`**: Create new prompt

- Request body: `title`, `type`, `content`[^1_1]

**`POST /api/prompts/update/<id>`**: Update existing prompt

- Request body: `title`, `type`, `content`[^1_1]

**`DELETE /api/prompts/delete/<id>`**: Remove prompt[^1_1]

### Settings \& Monitoring

**`GET /settings`**: Settings page

- Displays current configuration[^1_1]

**`POST /settings`**: Update configuration

- Updates database and reinitializes integrations
- Returns to settings page[^1_1]

**`GET /health`**: System health dashboard

- CPU, memory, disk, GPU metrics
- Service status (Ollama, Langfuse, SearXNG, ChromaDB)
- Active model display[^1_1]

**`GET /history`**: Full conversation history

- Groups sessions by date
- Collapsible session view
- Supports session renaming[^1_1]

**`GET /dashboard`**: API usage statistics

- Time range filtering (1h, 1d, 7d, 28d, 90d)
- Token consumption metrics
- Per-model usage breakdown
- Session linking[^1_1]


## Core Functions

### `ollama_chat(messages, model, session_id, max_retries, is_incognito)`

Handles local Ollama model interactions:[^1_2]

- **Retry Logic**: Up to 3 attempts with exponential backoff (1s, 2s, 4s)
- **Timeout**: 300 seconds (5 minutes)
- **Langfuse Integration**: Wraps in trace/generation spans
- **Incognito Support**: Skips tracing when enabled
- **Returns**: Dictionary with `content` and `usage` keys


### `cloud_model_chat(messages, model_config, session_id, max_retries, is_incognito)`

Manages cloud API requests:[^1_2]

- **Endpoint Construction**: Appends `/chat/completions` to base URL
- **Authentication**: Bearer token from configuration
- **Format**: OpenAI-compatible request/response
- **Langfuse Integration**: Same structure as Ollama
- **Returns**: Dictionary with `content` and `usage` keys


### `search_searxng(query)`

Performs web searches using SearXNG:[^1_2]

- **Configuration Check**: Verifies SearXNG is enabled
- **Results**: Returns top 5 formatted results
- **Format**: Title, URL, snippet for each result
- **Error Handling**: Returns descriptive error messages


### `get_settings()`

Fetches configuration from database:[^1_2]

- **Fallback**: Returns hardcoded defaults if database fails
- **Source**: SQLite settings table


### `save_settings(settings_dict)`

Persists configuration changes:[^1_2]

- **Type Conversion**: Ensures correct data types
- **Primary Storage**: Always saves to SQLite


### `initialize_langfuse()`

Sets up Langfuse tracing client:[^1_2]

- **Reset Mechanism**: Shuts down and resets singleton before reinit
- **Authentication**: Validates credentials with `auth_check()`
- **Global State**: Updates `langfuse_enabled` flag


### `initialize_chroma()`

Establishes ChromaDB connection:[^1_2]

- **Configuration**: Uses credentials from settings
- **Heartbeat Check**: Verifies connection health
- **Collection**: Creates or retrieves `chat_history`
- **Fallback**: Disables on connection failure


### `check_ollama_connection()`

Tests Ollama availability:[^1_2]

- **Endpoint**: `GET /api/tags`
- **Timeout**: 5 seconds
- **Returns**: Boolean status


### `check_searxng_connection()`

Validates SearXNG access:[^1_2]

- **Configuration Check**: Returns False if disabled
- **Endpoint**: Base URL
- **Timeout**: 3 seconds
- **Returns**: Boolean status


## Frontend Architecture

### Templates

**`base.html`**: Master template with common layout[^1_1]

- Sidebar navigation
- Header structure
- CSS and JavaScript includes

**`index.html`**: Main chat interface[^1_1]

- Chatbox display area
- Message input
- Model selector dropdown
- Prompt selector dropdown
- File upload button
- Web search button
- Incognito toggle
- History sidebar with rename/delete options

**`history.html`**: Conversation archive[^1_1]

- Date-grouped sessions
- Collapsible session details
- Delete all functionality

**`health.html`**: System monitoring dashboard[^1_1]

- Real-time metrics
- Service status indicators

**`settings.html`**: Configuration form[^1_1]

- Model parameter controls
- Integration credentials
- Feature toggles

**`models.html`**: Local model management[^1_1]

- Model list with sizes
- Pull interface with progress
- Delete operations

**`cloud_models.html`**: External service configuration[^1_1]

- Service list
- Add/edit modal
- Multiple models per service

**`prompts.html`**: Prompt library[^1_1]

- Prompt list
- Create/edit modal


### JavaScript Modules

**`script.js`**: Core chat functionality[^1_1]

- Message sending (`sendMessage`)
- Response handling (`handleBotResponse`)
- Markdown/LaTeX rendering (`formatMessage`)
- History sidebar management (`fetchHistorySidebar`)
- Session initialization from URL (`initializeChat`)
- Stop generation functionality
- File upload handling
- Incognito mode management

**`models.js`**: Local model operations[^1_1]

- Model list fetching
- Pull with streaming progress
- Delete operations

**`cloud_models.js`**: Cloud service CRUD[^1_1]

- Configuration management via modals
- Multiple model support

**`prompts.js`**: Prompt management[^1_1]

- CRUD operations via modals


### Styling

**`style.css`**: Application styles[^1_1]

- **Layout**: Flexbox and Grid
- **Theming**: Light/dark mode with CSS variables
- **Components**: Buttons, forms, cards, modals
- **Responsiveness**: Media queries for mobile
- **Icons**: Material Icons


## Key Features

### Incognito Mode

Private, ephemeral chat sessions:[^1_1]

- **Activation**: Toggle button in header
- **Behavior**: No database persistence, no tracing, no URL updates
- **Implementation**: `isIncognito` flag passed to `/generate` endpoint


### Response Interruption

User-controlled generation stopping:[^1_1]

- **UI**: Send button transforms to Stop button during generation
- **Backend**: Catches `ClientDisconnected` exception
- **Cleanup**: Removes optimistic messages from UI


### File Upload Context

Document-based conversations:[^1_1]

- **Format**: `.txt` files
- **Storage**: As 'system' message in database
- **Usage**: Automatically prepended to first user message
- **Support**: Both local and cloud models


### Web Search Integration

SearXNG-powered context augmentation:[^1_1]

- **Activation**: `/search` command or button
- **Processing**: Fetches top 5 results, formats as context
- **Model Input**: Prepended to user query
- **UI**: Button disabled when SearXNG disabled


### Session Management

URL-based conversation loading:[^1_1]

- **URL Format**: `?session_id=<uuid>`
- **Backend**: `/generate` returns session_id
- **Frontend**: Updates browser URL
- **Loading**: `initializeChat()` fetches history


### Session Renaming

Custom conversation titles:[^1_1]

- **Storage**: `session_summaries` table
- **Access**: History sidebar and main history page
- **Fallback**: First user message (truncated)


### Model Synchronization

Automatic Ollama model registry:[^1_2]

- **Detection**: Compares API list with database
- **Add**: New models inserted with active=True
- **Remove**: Deleted models removed from database
- **Display**: Sorted alphabetically


### API Usage Tracking

Token consumption monitoring:[^1_1]

- **Capture**: Input and output tokens per message
- **Storage**: `api_usage_metrics` table
- **Dashboard**: Time-filtered statistics
- **Granularity**: Per-model breakdown


## Error Handling

### Retry Mechanism

Exponential backoff for API failures:[^1_1]

- **Attempts**: 3 retries maximum
- **Wait Times**: 1s, 2s, 4s
- **Triggers**: Timeout, connection errors
- **Logging**: Warns on each retry


### Database Fallback

ChromaDB to SQLite failover:[^1_1]

- **Detection**: Connection errors during initialization
- **Action**: Sets `chroma_connected = False`
- **Operations**: All DB operations check connection status
- **Transparency**: Status visible on health page


### Migration Handling

Automatic schema updates:[^1_1]

- **Detection**: `PRAGMA table_info()` checks for columns
- **Action**: `ALTER TABLE` statements for missing columns
- **Tables**: Settings, messages, cloud_models, local_models
- **Safety**: Graceful handling of existing data


### Client Disconnection

Stop button implementation:[^1_2]

- **Exception**: `ClientDisconnected` from Werkzeug
- **Prevention**: Blocks message saving to database
- **Response**: Returns 204 with cancellation status
- **Logging**: Info-level log entry


## Advanced Configuration

### Langfuse Setup

Enable detailed tracing:[^1_1]

1. Navigate to `/settings`
2. Enter public key, secret key, and host URL
3. Toggle "Enable Langfuse"
4. Save settings
5. Verify on `/health` page

### ChromaDB Setup

Configure distributed storage:[^1_1]

1. Obtain ChromaDB Cloud credentials
2. Navigate to `/settings`
3. Enter API key, tenant, and database name
4. Toggle "Enable ChromaDB"
5. Save settings
6. Verify on `/health` page

### SearXNG Setup

Enable web search:[^1_1]

1. Deploy SearXNG (docker recommended)
2. Navigate to `/settings`
3. Enter SearXNG URL (e.g., `http://localhost:8080`)
4. Toggle "Enable SearXNG"
5. Save settings
6. Use `/search` or search button in chat

### Cloud Model Setup

Add external AI services:[^1_1]

1. Navigate to `/cloud_models`
2. Click "Add Model"
3. Select service (OpenAI, Perplexity, DeepSeek, Google Gemini) or use custom
4. Enter base URL (e.g., `https://api.openai.com/v1`)
5. Enter API key
6. Add model names (e.g., `gpt-4`, `gpt-3.5-turbo`)
7. Save configuration
8. Models appear in main chat selector

## Development Best Practices

### Adding New API Endpoints

1. Define route with appropriate HTTP method decorator[^1_2]
2. Add request validation (check required fields)
3. Implement database operations with try-except blocks
4. Log operations with `current_app.logger`
5. Return JSON responses with appropriate status codes
6. Update this documentation

### Database Schema Changes

1. Add column check in `init_db()` using `PRAGMA table_info()`[^1_2]
2. Use `ALTER TABLE` for existing installations
3. Update `get_settings()` and `save_settings()` if modifying settings table
4. Test migration on existing database
5. Document changes

### Frontend Component Addition

1. Create HTML template or extend existing[^1_1]
2. Add JavaScript module in `static/` directory
3. Register route in `app.py`
4. Add navigation link in `base.html` if needed
5. Update `style.css` for component styling

### Integration Testing

1. Start Ollama service
2. Configure `.env` file
3. Run `python app.py`
4. Test endpoints with curl or Postman
5. Verify logs in `logger/app.log`
6. Check database with SQLite browser

## Performance Optimization

### Database Indexing

Add indexes for frequently queried fields:

```sql
CREATE INDEX idx_session_id ON messages(session_id);
CREATE INDEX idx_timestamp ON messages(timestamp);
```


### Caching Strategy

Implement model list caching to reduce Ollama API calls:

```python
from functools import lru_cache
from datetime import datetime, timedelta

@lru_cache(maxsize=1)
def cached_get_ollama_models(cache_key):
    return get_ollama_models()

def get_models_with_cache():
    cache_key = datetime.now() // timedelta(minutes=5)
    return cached_get_ollama_models(cache_key)
```


### Streaming Responses

For real-time response display, modify `/generate` to support streaming:

```python
@app.route('/generate', methods=['POST'])
def generate():
    # ... existing code ...
    payload['stream'] = True
    
    def generate_stream():
        response = requests.post(url, json=payload, stream=True)
        for line in response.iter_lines():
            if line:
                yield f"data: {line.decode()}\n\n"
    
    return Response(stream_with_context(generate_stream()), 
                    mimetype='text/event-stream')
```


## Security Considerations

### API Key Storage

Credentials are stored in the database. For production:

1. Encrypt API keys before storage
2. Use environment variables for sensitive defaults
3. Implement key rotation policies
4. Restrict settings page access with authentication

### Input Validation

Sanitize user inputs to prevent injection attacks:

```python
from markupsafe import escape

content = escape(request.form['content'])
```


### Rate Limiting

Implement request throttling for API endpoints:

```python
from flask_limiter import Limiter

limiter = Limiter(app, key_func=lambda: request.remote_addr)

@app.route('/generate', methods=['POST'])
@limiter.limit("10 per minute")
def generate():
    # ... existing code ...
```


## Troubleshooting

### "Ollama is not available" error

- Verify Ollama is running: `ollama list`
- Check `OLLAMA_BASE_URL` in `.env`
- Test connection: `curl http://localhost:11434/api/tags`


### "Failed to save messages to ChromaDB" error

- Check ChromaDB credentials in settings
- Verify network connectivity to ChromaDB Cloud
- Review logs in `logger/app.log`
- Confirm fallback to SQLite is working


### "Langfuse authentication failed" error

- Verify credentials in settings
- Check `LANGFUSE_HOST` URL format
- Test credentials manually with Langfuse SDK
- Confirm internet connectivity


### Model not appearing in dropdown

- Check model is pulled in Ollama: `ollama list`
- Verify active status in database: `SELECT * FROM local_models`
- Sync models by accessing `/models` page
- Check browser console for JavaScript errors


### Session history not loading

- Verify `session_id` format (valid UUID)
- Check database for session existence
- Review browser console for API errors
- Confirm `/api/session/<session_id>` returns 200
