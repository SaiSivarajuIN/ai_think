This document provides detailed technical information about the Ollama Chat application, its setup, features, and recent changes. The application is a web-based chat interface built with Flask that connects to a local Ollama instance to provide generative AI responses.

## Table of Contents

- [1. Installation and Setup](#1-installation-and-setup)
  - [1.1 Prerequisites](#11-prerequisites)
  - [1.2 Application Setup](#12-application-setup)
  - [1.3 Ollama Setup](#13-ollama-setup)
  - [1.4 Environment Configuration](#14-environment-configuration)
  - [1.5 Database and Logging](#15-database-and-logging)
- [2. Running the Application](#2-running-the-application)
- [3. Features and Technical Details](#3-features-and-technical-details)
  - [3.1 Settings Page (`/settings`)](#31-settings-page-settings)
  - [3.2 Cloud Model Management](#32-cloud-model-management)
  - [3.3 Langfuse Tracing Integration](#33-langfuse-tracing-integration)
  - [3.4 ChromaDB Integration for Persistent Storage](#34-chromadb-integration-for-persistent-storage)
  - [3.5 System Health Page (`/health`)](#35-system-health-page-health)
  - [3.6 Models Hub (`/models`)](#36-models-hub-models)
  - [3.7 SearXNG Integration for Web Search](#37-searxng-integration-for-web-search)
  - [3.8 Prompts Hub (`/prompts`)](#38-prompts-hub-prompts)
  - [3.9 History Page (`/history`)](#39-history-page-history)
  - [3.10 Stability and Error Handling](#310-stability-and-error-handling)
  - [3.11 File Upload and Contextual Chat](#311-file-upload-and-contextual-chat)
  - [3.12 User Interface Overview](#312-user-interface-overview)
  - [3.13 Response Interruption](#313-response-interruption)
  - [3.14 Incognito Mode](#314-incognito-mode)
- [4. File Structure](#4-file-structure)
- [5. API Endpoints](#5-api-endpoints)
- [6. Frontend](#6-frontend)

## 1. Installation and Setup

Follow these steps to get the application running locally.

### 1.1. Prerequisites

- Python 3.10+
- `pip` for package management
- A running Ollama instance (see section 1.3)

### 1.2. Application Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/SaiSivarajuIN/ai_think.git
    cd ai_think
    ```
2.  **Create and Activate a Virtual Environment:**
    ```bash
    # For Windows
    python -m venv .venv
    .venv\Scripts\activate

    # For macOS/Linux
    python3 -m venv .venv
    source .venv/bin/activate
    ```
3.  **Install Dependencies:**
    (Based on `requirements.txt`)
    ```bash
    pip install -r requirements.txt
    ```

### 1.3. Ollama Setup

The application requires a running Ollama instance to function.

1.  **Download and Install Ollama:** Visit the Ollama website and follow the installation instructions for your operating system.
2.  **Pull a Model:** Once Ollama is running, you need to pull a model for the chat application to use. Open your terminal and run:
    ```bash
    ollama pull llama3
    ```
    You can replace `llama3` with any other model you prefer (e.g., `mistral`, `gemma`).
3.  **Ensure Ollama is running:** The Ollama service should be running in the background. You can verify this by checking your system's task manager or by running `ollama list` in the terminal.

### 1.4. Environment Configuration

The application is configured using a `.env` file in the project root.

1.  **Create a `.env` file:**
    ```
    touch .env
    ```
2.  **Add the following configuration variables:**
    ```env
    # URL of your running Ollama instance
    OLLAMA_BASE_URL=http://localhost:11434

    # The default model to use for chat (e.g., llama3, llama3.1)
    OLLAMA_MODEL=llama3

    # Default model parameters (these can be changed in the UI)
    NUM_PREDICT=1024
    TEMPERATURE=0.7
    TOP_P=0.9
    TOP_K=40

    # Optional: Langfuse credentials for tracing
    LANGFUSE_SECRET_KEY=your_langfuse_secret_key
    LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
    LANGFUSE_HOST=https://cloud.langfuse.com

    # Optional: ChromaDB Cloud credentials for persistent vector storage
    CHROMA_API_KEY=
    CHROMA_TENANT=
    CHROMA_DATABASE=
    ```

### 1.5. Database and Logging

The application uses an SQLite database (`chat.db`).

- The database and its tables (`messages`, `settings`) are created and initialized automatically the first time you run the application via `init_db()`.
- The system handles database migrations automatically. For example, when Langfuse support was added, the `langfuse_public_key`, `langfuse_secret_key`, and `langfuse_host` columns were added to the `settings` table without manual intervention.
- On first run, it populates the `settings` table with values from the `.env` file.
- **Logging:** The application's logging uses a `TimedRotatingFileHandler`.
    - **Location:** Logs are stored in the `logger/` directory.
    - **Rotation:** A new log file (`app.log.YYYY-MM-DD.txt`) is created every day at midnight. Old logs are kept for 30 days (`backupCount=30`).
    - **Content:** Logs include detailed information about incoming requests, application events, and errors, with timestamps and file/line numbers for easier debugging.

## 2. Running the Application

1.  Ensure your virtual environment is activated and you are in the project root directory.
2.  Run the Flask application:
    ```bash
    python app.py
    ```
3.  Open your web browser and navigate to `http://localhost:5000`.

## 3. Features and Technical Details

### 3.1. Settings Page (`/settings`)
A new settings page has been added to provide runtime configuration of the application.

- **Access:** Click the "Settings" icon (⚙️) on the main chat page or navigate to `/settings`.
- **Implementation:**
    - A `GET` request to `/settings` fetches the current configuration from the `settings` table in `chat.db` and renders `settings.html`.
    - A `POST` request updates the `settings` table with the form data.
    - **Dynamic Re-initialization**: After saving, `initialize_langfuse()` is called immediately to apply the new Langfuse credentials without restarting the server.
- **Features:**
    - **Model Parameters:** You can now dynamically adjust the model's behavior. These values are fetched from the database in the `ollama_chat` function for every generation request.
        - `Tokens to Predict` (`num_predict`)
        - `Temperature` (`temperature`)
        - `Top P` (`top_p`)
        - `Top K` (`top_k`)
    - **Langfuse Tracing:** Configure credentials for observability.

### 3.2. Cloud Model Management

The application allows users to integrate external AI models by connecting to services such as Perplexity, OpenAI, DeepSeek, or Google Gemini via their respective APIs.

-   **Access:** Click the "Cloud Model" icon (☁️) on the main chat page or navigate to `/cloud_models`.
-   **Implementation:**
    -   A new `cloud_models` table in the SQLite database stores the configuration for each external model.
    -   The `/cloud_models` page provides a UI to view, add, edit, and remove model configurations.
    -   API endpoints under `/api/cloud_models` handle the CRUD operations.
-   **Configuration Fields:**
    -   **Service Name:** A dropdown to select the provider (e.g., OpenAI, Perplexity).
    -   **Base URL:** The API base URL for the service.
    -   **API Key:** The authentication key for the service.
    -   **Model Name:** The specific model identifier (e.g., `gpt-4`, `llama-3-sonar-large-32k-online`).
-   **Usage:** Once configured, cloud models appear in the model selector on the main chat page and can be used for generation just like local Ollama models.

### 3.3. Langfuse Tracing Integration

The application is now integrated with Langfuse for detailed tracing and observability of chat interactions.

- **How it works:** When enabled, every call to `ollama_chat` is wrapped in a Langfuse trace. A parent `span` is created for the overall chat generation, and a nested `generation` is created specifically for the Ollama API call. This logs the input prompt, the generated response, model parameters, token usage, and generation time.
- **Initialization (`initialize_langfuse`)**:
    - This function reads credentials from the `settings` table.
    - It performs an `auth_check()` to verify credentials. If they are invalid or missing, tracing is disabled (`langfuse_enabled = False`).
    - To allow for runtime updates, it correctly shuts down and resets the Langfuse client singleton before re-initializing.
- **Status:** The Langfuse connection status (`langfuse_enabled`) is displayed on the main chat page and the health page.

### 3.4. ChromaDB Integration for Persistent Storage

The application now supports ChromaDB as an optional, more scalable backend for storing chat history and application settings.

- **How it works:** If a `CHROMA_API_KEY` is provided in the `.env` file, the application will attempt to connect to a ChromaDB Cloud instance.
- **Fallback Mechanism:** If the API key is missing or the connection fails, the application gracefully falls back to using the local SQLite database (`chat.db`) for all operations. This ensures the application remains functional without a ChromaDB connection.
- **Data Storage:**
    - **Chat History:** All messages are stored in a collection named `chat_history`.
    - **Application Settings:** Model parameters and Langfuse credentials are saved to a `app_settings` collection, ensuring they persist across application restarts.
- **Status Indicator:** The connection status to ChromaDB is clearly displayed on the `/health` page.

### 3.5. System Health Page (`/health`)

A comprehensive health monitoring page is now available.

- **Access:** Navigate directly to the `/health` endpoint.
- **Implementation:** The `/health` route uses `psutil` to get CPU, memory, and disk stats, and `GPUtil` for GPU stats. It then determines an overall status (`ok`, `warning`, `critical`) based on predefined thresholds.
- **Metrics Displayed:**
    - **Overall Status:** A color-coded status for a quick system overview.
    - **CPU:** Core count and current usage percentage.
    - **Memory:** Total, used, and available RAM.
    - **Disk:** Total, used, and free disk space for the root partition.
    - **GPU:** Detailed information for each available GPU, including name, load, memory usage, and temperature (requires `GPUtil` and NVIDIA drivers).
    - **Ollama Status:** Indicates whether the application can connect to the Ollama server via `check_ollama_connection()`.
    - **Langfuse Status:** Shows whether the application is connected to Langfuse.
    - **SearXNG Status:** Shows whether the application is connected to SearXNG.
    - **Active Model**: The 'Active Model' field in the Health dashboard now dynamically reflects the currently selected model from the model-selector dropdown in the main chat interface.
        - This ensures real-time accuracy of system status information.
        - The backend passes a map of model IDs to display names, and JavaScript on the health page uses `localStorage` to retrieve and display the correct name.
    - **ChromaDB Status:** Shows whether the app is connected to ChromaDB or using the SQLite fallback.

### 3.6. Models Hub (`/models`)
A new page has been added to manage local Ollama models directly from the UI.

- **Access:** Click the "Models Hub" icon (📦) on the main chat page or navigate to `/models`.
- **Implementation:**
    - The page is rendered by the `/models` endpoint.
    - It uses a set of API endpoints under `/api/models` to interact with the Ollama service.
    - `GET /api/models`: Fetches and lists all models currently available in the local Ollama instance.
    - `POST /api/models/pull`: Streams the download progress of a new model from the Ollama library. The UI shows the status and a progress bar.
    - `POST /api/models/delete`: Deletes a specified local model.
    - `POST /api/models/delete/all`: Deletes all local models from the Ollama instance.
- **Features:**
    - **View Local Models:** See a list of all downloaded models, their size, and when they were last modified.
    - **Pull New Models:** Enter a model name (e.g., `llama3:8b`) to download it from the Ollama library.
    - **Delete Models:** Remove individual models or use the "Delete All" button to clear all local models from your Ollama instance, freeing up disk space.

### 3.7. SearXNG Integration for Web Search

The application now supports web search capabilities through SearXNG, allowing the model to answer questions with up-to-date information from the internet.

-   **Setup**:
    1.  Clone the `searxng-docker` repository and follow its `README.md` to start the SearXNG service.
    2.  Navigate to the **Settings** page (`/settings`) in the AI Think application.
    3.  Enable the "Enable SearXNG" toggle.
    4.  Ensure the SearXNG URL is correct (default is `http://localhost:8080`).
    5.  Save the settings. The connection status will be reflected on the `/health` page.
-   **Usage**:
    -   The 'Web Search' button in the main chat interface is now automatically disabled when SearXNG is disabled in the Settings page.
    -   This provides clearer visual feedback about available features based on configuration.
    -   To perform a web search, click the 🔍 icon or type `/search` followed by your query in the chat input (e.g., `/search latest AI news`).
    -   The backend will use the configured SearXNG instance to fetch search results.
    -   The results are then formatted and prepended to your original query as context for the LLM, which will use them to formulate an answer.
-   .
    - The backend will use the configured SearXNG instance to fetch search results.
    - The results are then formatted and prepended to your original query as context for the LLM, which will use them to formulate an answer.


### 3.8. Prompts Hub (`/prompts`)

A centralized hub for creating, managing, and using reusable prompts.

-   **Access:** Click the "Prompt Hub" icon (🚀) on the main chat page or navigate to `/prompts`.
-   **Implementation:**
    -   The page is rendered by the `/prompts` endpoint.
    -   It uses a set of API endpoints under `/api/prompts` to interact with the `prompts` table in the SQLite database.
    -   `GET /api/prompts`: Fetches all saved prompts.
    -   `POST /api/prompts/create`: Creates a new prompt.
    -   `POST /api/prompts/update/<id>`: Updates an existing prompt.
    -   `DELETE /api/prompts/delete/<id>`: Deletes a prompt.
-   **Features:**
    -   **Create and Edit Prompts:** A modal form allows users to create or edit prompts, giving them a title, type (e.g., Code, Research), and content.
    -   **Use Prompts in Chat:** On the main chat page, a "Select a Prompt" dropdown allows users to instantly load a prompt's content as a system message for the current conversation.

### 3.9. History Page (`/history`)

The chat history page has been improved for better usability and correctness.

- **Delete Messages:** You can now delete individual messages from a conversation. This is handled by the `DELETE /delete_message/<int:message_id>` endpoint, which removes the corresponding row from the `messages` table.
- **Improved Sorting:** Threads are now sorted by the timestamp of the **most recent message** in each thread, ensuring the latest conversations appear first.
- **Delete All Sessions:** A "Delete All" button on the history page allows for the complete removal of all chat sessions from the database. This is handled by the `DELETE /delete_all_threads` endpoint.
- **Timezone Handling:** All timestamps are now correctly handled and displayed in UTC for consistency, using Python's `zoneinfo` library.
- **Session Management via URL**: The application now uses a `session_id` in the URL to manage and load chat history.
    - When a new chat is started or a message is sent in a new session, the `/generate` endpoint returns a `session_id`.
    - The frontend JavaScript (`static/script.js`) updates the browser's URL to include `?session_id=<uuid>`.
    - When a page with a `session_id` in the URL is loaded, the `initializeChat()` function fetches the corresponding history from the `/api/session/<session_id>` endpoint.

### 3.10. Stability and Error Handling

- **Pagination**: The history page now supports pagination, displaying 10 chat threads per page.
    - **Navigation**: Bootstrap-styled pagination controls with icons are provided at the bottom of the history page for easy navigation.
    - **Information**: The pagination component also displays the total number of threads and the range of threads currently being shown (e.g., "Showing 1-10 of 25 threads").
    - **Grouping**: Chat sessions are organized by date into collapsible groups like "Today," "Yesterday," "Previous 7 Days," "This Month," and then by previous months and years.
    - **Default Expansion**: Only the most recent chat session is expanded by default on the first page; all others remain collapsed for a cleaner view.


- **API Retries:** The `ollama_chat` function now includes a retry mechanism with exponential backoff. If a request fails (e.g., due to a temporary network issue or model loading), the application will automatically retry up to 3 times (waiting 1s, 2s, then 4s).
- **Longer Timeout:** The timeout for Ollama API requests has been increased to 300 seconds (5 minutes) to accommodate slower models or long-running generation tasks.
- **Model Deletion Fix:** The `/api/models/delete` endpoint was fixed to handle empty responses from the Ollama API upon successful deletion. This prevents a JSON parsing error on the frontend.

### 3.11. File Upload and Contextual Chat

The application now supports uploading `.txt` files to provide context for a conversation.

- **Implementation:**
    - The main chat page (`/`) now includes an upload button that triggers a hidden file input.
    - The `POST /upload` endpoint handles the file, reads its content, and stores it as a special "system" message in the database (SQLite or ChromaDB) associated with the current `session_id`.
    - In the `POST /generate` endpoint, if it's the first user message of a session that contains a file, the backend automatically prepends the file's content to the user's question, creating a contextual prompt for the model (e.g., "Based on the content of document X, answer question Y").
- **User Experience:** The user receives a confirmation message in the chat when a file is successfully uploaded and can then ask questions about its content.

### 3.12. User Interface Overview

- **Chat Page (`/`):** The main interface for interacting with the model. You can select different models from the dropdown if they are available in your Ollama instance.
- **History Page (`/history`):** View and manage past conversations.
- **Settings Page (`/settings`):** Configure model and integration settings.
- **Models Hub (`/models`):** View, pull, and delete local Ollama models.
- **Health Page (`/health`):** Monitor system and service status.
- **History Sidebar**: A collapsible sidebar on the main chat page that lists recent conversations for quick access.
- **Keyboard Shortcuts**: Use `Alt + S` to toggle the main sidebar and `Alt + H` to toggle the history sidebar.

## 4. File Structure

### 3.14. Incognito Mode

The application includes an "Incognito Mode" for private, temporary chat sessions.

-   **Access:** Toggle the incognito button (👁️) in the header of the main chat page.
-   **Implementation:**
    -   A state variable (`isIncognito`) is managed in the frontend JavaScript.
    -   When a message is sent, this state is passed to the `/generate` endpoint.
    -   The backend checks for the `incognito` flag and conditionally bypasses database storage and Langfuse tracing.
-   **Behavior When Enabled:**
    -   **No Persistence:** Chat messages are not saved to the database (neither SQLite nor ChromaDB).
    -   **No Tracing:** Langfuse tracing is disabled for the duration of the incognito session.
    -   **Ephemeral URL:** The URL does not update with a `session_id`, behaving like a temporary, non-shareable chat.
    -   **Temporary Session:** The chat starts when incognito is enabled and is completely cleared when it is disabled.


```
.
├── .env                    # Application configuration (you must create this)
├── .venv/                  # Python virtual environment
├── readme.md               # Project description and instructions
├── ollamaSetup.sh          # Installer for macOS/Linux
├── ollamaSetup.bat         # Installer for Windows
├── app.py                  # Main Flask application file
├── main.py                 # Run this to start the application
├── SECURITY.md             # SECURITY information
├── chat.db                 # SQLite database for messages and settings
├── LICENSE                 # License information
├── logger/                 # Directory for log files
│   └── app.log             # Current log file
├── static/                 # Static assets (CSS, JS, images)
│   ├── style.css
|   ├── script.js
│   ├── cloud_models.js
│   └── models.js
└── templates/              # HTML templates
    ├── about.html
    ├── base.html
    ├── cloud_models.html
    ├── feedback.html
    ├── health.html
    ├── history.html
    ├── index.html
    ├── models.html
    ├── models.html
    ├── cloud_models.html
    ├── prompts.html    
    └── settings.html
```

## 5. API Endpoints

| Method | Path                        | Description                                                                                             |
|--------|-----------------------------|---------------------------------------------------------------------------------------------------------|
| `GET`  | `/`                         | Renders the main chat page (`index.html`). Passes model info and connection status to the template.     |
| `POST` | `/generate`                 | The main API for generating chat responses. It receives messages, saves the user's message, calls `ollama_chat`, saves the assistant's response to the active database (ChromaDB or SQLite), and returns the response as JSON. |
| `POST` | `/new-thread`, `/reset_thread` | Manages the chat session by generating a new `session_id`.                                              |
| `GET`  | `/history`                  | Renders the `history.html` page, displaying all past conversations from the active database (ChromaDB or SQLite), grouped by `session_id`.             |
| `DELETE`| `/delete_message/<id>`      | Deletes a specific message from the active database (ChromaDB or SQLite) by its ID.                                                 |
| `GET`  | `/health`                   | Renders the `health.html` page. It uses `psutil` and `GPUtil` to gather and display real-time system metrics (CPU, Memory, Disk, GPU). |
| `GET`  | `/api/sessions`             | Fetches a summary of all chat sessions, sorted by the most recent, for display in the history sidebar. |
| `GET`  | `/api/session/<session_id>` | Fetches the full message history for a specific session ID.                                             |
| `DELETE`| `/delete_all_threads`       | Deletes all chat sessions from the active database.                                                     |
| `GET`, `POST` | `/settings`                 | Renders `settings.html`. On `POST`, it updates settings in the active database (ChromaDB and SQLite) and triggers `initialize_langfuse` to apply changes. |
| `GET`  | `/api/models`               | Fetches and lists all models currently available in the local Ollama instance.                          |
| `POST` | `/api/models/pull`          | Streams the download progress of a new model from the Ollama library.                                   |
| `POST` | `/api/models/delete`        | Deletes a specified local model.                                                                        |
| `POST` | `/api/models/delete/all`    | Deletes all local models.                                                                               |
| `GET`  | `/api/prompts`              | Fetches all saved prompts from the database.                                                            |
| `POST` | `/api/prompts/create`       | Creates a new prompt in the database.                                                                   |
| `POST` | `/api/prompts/update/<id>`  | Updates an existing prompt by its ID.                                                                   |
| `DELETE`| `/api/prompts/delete/<id>`  | Deletes a specific prompt from the database by its ID.                                                  |
| `GET`  | `/api/cloud_models`         | Fetches all configured cloud models.                                                                    |
| `POST` | `/api/cloud_models/create`  | Creates a new cloud model configuration.                                                                |
| `POST` | `/api/cloud_models/update/<id>` | Updates an existing cloud model configuration.                                                        |
| `DELETE`| `/api/cloud_models/delete/<id>` | Deletes a cloud model configuration.                                                                  |
| `POST` | `/api/cloud_models/toggle_active/<id>` | Toggles the active state of a cloud model.                                                      |
| `POST` | `/api/local_models/toggle_active` | Toggles the active state of a local model.                                                        |

## 6. Frontend

The frontend is built with standard HTML, CSS, and vanilla JavaScript.

### HTML (`templates/`)

-   **`index.html`**: The main chat interface. It contains the chatbox, the message input area, and navigation links.
-   **`history.html`**: Displays past conversations grouped by session. Each session is a collapsible `<details>` element with a serial number.
-   **`health.html`**: A dashboard that displays system health metrics fetched from the `/health` endpoint.
-   **`settings.html`**: A simple form to adjust and save model parameters.

### JavaScript (`static/script.js`)

This file manages all the dynamic behavior of the chat interface.

-   **`sendMessage()`**: Triggered when the user sends a message. It captures the input, adds it to the UI, sends the conversation history to the `/generate` endpoint, and handles the response.
-   **`handleBotResponse()`**: Processes the JSON response from `/generate`. It updates the "Thinking..." placeholder with the bot's final message and adds a footer with generation time and action buttons.
-   **`addMessage()`**: A utility function to create and append a new message bubble (either user or bot) to the chatbox.
-   **`regenerateResponse()`**: Triggered by the "regenerate" button. It removes the last bot message from the history and the UI, then calls `/generate` again with the shortened history.
-   **`initializeChat()`**: Checks for a `session_id` in the URL on page load and fetches the corresponding chat history.
-   **`fetchHistorySidebar()`**: Fetches and renders the list of recent conversations in the sidebar on the main chat page.
-   **Event Delegation**: A single event listener on the `chatbox` handles clicks for both the "Copy" and "Regenerate" buttons, improving performance.
-   **Copy Functionality**: When the copy button is clicked, it copies the raw, un-rendered content of the bot's message from a `data-raw-content` attribute to the clipboard.
-   **History Page Logic**: The script on `history.html` formats timestamps to the user's local timezone and handles message deletion.

### 3.13. Response Interruption

- The 'Send' button now transforms into a 'Stop' button while the bot is generating a response.
- Users can click the 'Stop' button to immediately halt the bot's response generation.
- When generation is stopped via the frontend, the backend catches a `ClientDisconnected` exception. This prevents the user's message and the bot's partial response from being saved to the database or logged in Langfuse.
- The frontend JavaScript then removes the optimistic user message and the "Thinking..." indicator from the UI, leaving the chat in a clean state.

### 3.14. Incognito Mode

The application includes an "Incognito Mode" for private, temporary chat sessions.

-   **Access:** Toggle the incognito button (👁️) in the header of the main chat page.
-   **Implementation:**
    -   A state variable (`isIncognito`) is managed in the frontend JavaScript.
    -   When a message is sent, this state is passed to the `/generate` endpoint.
    -   The backend checks for the `incognito` flag and conditionally bypasses database storage and Langfuse tracing.
-   **Behavior When Enabled:**
    -   **No Persistence:** Chat messages are not saved to the database (neither SQLite nor ChromaDB).
    -   **No Tracing:** Langfuse tracing is disabled for the duration of the incognito session.
    -   **Ephemeral URL:** The URL does not update with a `session_id`, behaving like a temporary, non-shareable chat.
    -   **Temporary Session:** The chat starts when incognito is enabled and is completely cleared when it is disabled.

This file provides all the styling for the application.

### CSS (`static/style.css`)

-   **Layout**: Uses Flexbox and Grid for modern, responsive layouts.
-   **Theming**: Supports both light and dark themes using CSS variables.
-   **Message Bubbles**: Styles for user and bot messages to create a familiar chat look.
-   **Responsiveness**: Includes media queries to ensure the application is usable on mobile devices.

-   **Icons**: Uses Material Icons for a clean and consistent icon set.
