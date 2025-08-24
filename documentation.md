This document provides detailed technical information about the Ollama Chat application, its setup, features, and recent changes. The application is a web-based chat interface built with Flask that connects to a local Ollama instance to provide generative AI responses.

## 1. Installation & Setup

Follow these steps to get the application running locally.

### 1.1. Prerequisites

- Python 3.10+
- `pip` for package management
- A running Ollama instance (see section 1.3)

### 1.2. Application Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Create and activate a virtual environment:**
    ```bash
    # For Windows
    python -m venv .venv
    .venv\Scripts\activate

    # For macOS/Linux
    python3 -m venv .venv
    source .venv/bin/activate
    ```
3.  **Install dependencies:**
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

### 1.4. Application Configuration

The application is configured using a `.env` file in the project root.

1.  **Create a `.env` file:**
    ```
    touch .env
    ```
2.  **Add the following configuration variables:**
    ```env
    # URL of your running Ollama instance
    OLLAMA_BASE_URL=http://localhost:11434

    # The default model to use for chat
    OLLAMA_MODEL=llama3

    # Default model parameters (these can be changed in the UI)
    NUM_PREDICT=1024
    TEMPERATURE=0.7
    TOP_P=0.9
    TOP_K=40

    # Optional: Langfuse credentials for tracing
    LANGFUSE_PUBLIC_KEY=
    LANGFUSE_SECRET_KEY=
    LANGFUSE_HOST=https://us.cloud.langfuse.com

    # Optional: ChromaDB Cloud credentials for persistent vector storage
    CHROMA_API_KEY=
    CHROMA_TENANT=
    CHROMA_DATABASE=
    ```

### 1.5. Database Initialization

The application uses an SQLite database (`chat.db`).

- The database and its tables (`messages`, `settings`) are created and initialized automatically the first time you run the application via `init_db()`.
- The system handles database migrations automatically. For example, when Langfuse support was added, the `langfuse_public_key`, `langfuse_secret_key`, and `langfuse_host` columns were added to the `settings` table without manual intervention.
- On first run, it populates the `settings` table with values from the `.env` file.

## 2. New Features and Changes (Technical View)

### 2.1. Settings Page (`/settings`)

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

### 2.2. Langfuse Tracing Integration

The application is now integrated with Langfuse for detailed tracing and observability of chat interactions.

- **How it works:** When enabled, every call to `ollama_chat` is wrapped in a Langfuse trace. A parent `span` is created for the overall chat generation, and a nested `generation` is created specifically for the Ollama API call. This logs the input prompt, the generated response, model parameters, token usage, and generation time.
- **Initialization (`initialize_langfuse`)**:
    - This function reads credentials from the `settings` table.
    - It performs an `auth_check()` to verify credentials. If they are invalid or missing, tracing is disabled (`langfuse_enabled = False`).
    - To allow for runtime updates, it correctly shuts down and resets the Langfuse client singleton before re-initializing.
- **Status:** The Langfuse connection status (`langfuse_enabled`) is displayed on the main chat page and the health page.

### 2.3. System Health Page (`/health`)
### 2.3. ChromaDB Integration for Persistent Storage

The application now supports ChromaDB as an optional, more scalable backend for storing chat history and application settings.

- **How it works:** If a `CHROMA_API_KEY` is provided in the `.env` file, the application will attempt to connect to a ChromaDB Cloud instance.
- **Fallback Mechanism:** If the API key is missing or the connection fails, the application gracefully falls back to using the local SQLite database (`chat.db`) for all operations. This ensures the application remains functional without a ChromaDB connection.
- **Data Storage:**
    - **Chat History:** All messages are stored in a collection named `chat_history`.
    - **Application Settings:** Model parameters and Langfuse credentials are saved to a `app_settings` collection, ensuring they persist across application restarts.
- **Status Indicator:** The connection status to ChromaDB is clearly displayed on the `/health` page.

### 2.4. System Health Page (`/health`)

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
    - **Langfuse Status:** Indicates if tracing is enabled and authenticated.
    - **ChromaDB Status:** Shows whether the app is connected to ChromaDB or using the SQLite fallback.

### 2.5. Enhanced History Page (`/history`)

The chat history page has been improved for better usability and correctness.

- **Delete Messages:** You can now delete individual messages from a conversation. This is handled by the `DELETE /delete_message/<int:message_id>` endpoint, which removes the corresponding row from the `messages` table.
- **Improved Sorting:** Threads are now sorted by the timestamp of the **most recent message** in each thread, ensuring the latest conversations appear first.
- **Timezone Handling:** All timestamps are now correctly handled and displayed in UTC for consistency, using Python's `zoneinfo` library.

### 2.6. Improved Stability and Error Handling

- **API Retries:** The `ollama_chat` function now includes a retry mechanism with exponential backoff. If a request fails (e.g., due to a temporary network issue or model loading), the application will automatically retry up to 3 times (waiting 1s, 2s, then 4s).
- **Longer Timeout:** The timeout for Ollama API requests has been increased to 300 seconds (5 minutes) to accommodate slower models or long-running generation tasks.

### 2.7. Advanced Logging

The application's logging has been upgraded to use a `TimedRotatingFileHandler`.

- **Location:** Logs are stored in the `logger/` directory.
- **Rotation:** A new log file (`app.log.YYYY-MM-DD.txt`) is created every day at midnight. Old logs are kept for 30 days (`backupCount=30`).
- **Content:** Logs include detailed information about incoming requests, application events, and errors, with timestamps and file/line numbers for easier debugging.

## 3. Application Usage

### 3.1. Running the Application

1.  Ensure your virtual environment is activated and you are in the project root directory.
2.  Run the Flask application:
    ```bash
    python app.py
    ```
3.  Open your web browser and navigate to `http://localhost:5000`.

### 3.2. User Interface

- **Chat Page (`/`):** The main interface for interacting with the model. You can select different models from the dropdown if they are available in your Ollama instance.
- **History Page (`/history`):** View and manage past conversations.
- **Settings Page (`/settings`):** Configure model and integration settings.
- **Health Page (`/health`):** Monitor system and service status.

## 4. File Structure

```
.
├── .env                    # Application configuration (you must create this)
├── .venv/                  # Python virtual environment
├── app.py                  # Main Flask application file
├── chat.db                 # SQLite database for messages and settings
├── ollamaSetup/            # Scripts to install & setup Ollama and models
│   ├── install.bat         # Installer for Windows
│   └── install.sh          # Installer for macOS/Linux
├── logger/                 # Directory for log files
│   └── app.log             # Current log file
├── static/                 # Static assets (CSS, JS, images)
│   └── style.css
└── templates/              # HTML templates
    ├── health.html
    ├── history.html
    ├── index.html
    └── settings.html
```
        ```bash
        py -m venv .venv
        .venv\Scripts\activate
        ```
    -   **Linux & macOS:**
        ```bash
        python3 -m venv .venv
        source .venv/bin/activate
        ```

3.  **Install Python dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure Environment Variables:**
    Create a `.env` file in the root directory and add the following variables.

    ```env
    # URL of your running Ollama instance
    OLLAMA_BASE_URL=http://localhost:11434

    # The Ollama model to use for chat
    OLLAMA_MODEL=llama3.1

    # Optional: Langfuse credentials for tracing
    LANGFUSE_SECRET_KEY=your_langfuse_secret_key
    LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
    LANGFUSE_HOST=https://cloud.langfuse.com
    ```

5.  **Run the application:**
    ```bash
    python main.py
    ```
    The application will be available at `http://localhost:5000`.

## 4. Backend (`app.py`)

This is the core of the application, handling all server-side logic.

### Key Components

-   **Flask App Initialization**: Sets up the Flask app, logging, and secret key.
-   **Logging**: The `setup_logging` function configures a `TimedRotatingFileHandler` to create a new log file in the `logger/` directory every day. All important actions (requests, errors, generations) are logged.
-   **Database (`chat.db`)**: An SQLite database is used to persist:
    -   `messages`: Stores all user and bot messages with a `session_id`.
    -   `settings`: Stores the current model parameters and acts as a fallback if ChromaDB is not connected.
-   **ChromaDB Integration**: If configured, ChromaDB is used as the primary data store for chat history and settings, offering a more robust and scalable solution. The application falls back to SQLite if ChromaDB is unavailable.
-   **Langfuse Integration**: If Langfuse keys are provided in `.env`, it traces all LLM interactions, providing observability into model performance.
-   **Ollama Interaction (`ollama_chat`)**: This function is responsible for communicating with the Ollama API. It constructs the payload, sends the request, and handles retries with exponential backoff. It returns the bot's response and token usage.

### API Routes

-   `GET /`: Renders the main chat page (`index.html`).
-   `POST /generate`: The primary endpoint for chat. It receives the conversation history, gets a response from `ollama_chat`, saves both user and bot messages to the primary database (ChromaDB or SQLite), and returns the bot's response along with generation time.
-   `GET /history`: Fetches all messages from the primary database, groups them by session, sorts them by the most recent activity, and renders the history page (`history.html`).
-   `DELETE /delete_message/<id>`: Deletes a specific message from the primary database.
-   `POST /reset_thread`: Clears the current session ID, effectively starting a new conversation.
-   `GET /health`: Gathers system statistics (CPU, memory, disk, GPU) and checks the connection to Ollama. Renders the health dashboard (`health.html`).
-   `GET /settings`, `POST /settings`: Renders the settings page and handles updates to the model parameters in the database.

# API Endpoints (Tabular)

| Method | Path                        | Description                                                                                             |
|--------|-----------------------------|---------------------------------------------------------------------------------------------------------|
| `GET`  | `/`                         | Renders the main chat page (`index.html`). Passes model info and connection status to the template.     |
| `POST` | `/generate`                 | The main API for generating chat responses. It receives messages, saves the user's message, calls `ollama_chat`, saves the assistant's response to the active database (ChromaDB or SQLite), and returns the response as JSON. |
| `POST` | `/new-thread`, `/reset_thread` | Manages the chat session by generating a new `session_id`.                                              |
| `GET`  | `/history`                  | Renders the `history.html` page, displaying all past conversations from the active database (ChromaDB or SQLite), grouped by `session_id`.             |
| `DELETE`| `/delete_message/<id>`      | Deletes a specific message from the active database (ChromaDB or SQLite) by its ID.                                                 |
| `GET`  | `/health`                   | Renders the `health.html` page. It uses `psutil` and `GPUtil` to gather and display real-time system metrics (CPU, Memory, Disk, GPU). |
| `GET`, `POST` | `/settings`                 | Renders the `settings.html` page. On `POST`, it updates the settings in the active database (ChromaDB and SQLite) and triggers `initialize_langfuse` to apply changes. |


## 5. Frontend

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
-   **Event Delegation**: A single event listener on the `chatbox` handles clicks for both the "Copy" and "Regenerate" buttons, improving performance.
-   **Copy Functionality**: When the copy button is clicked, it copies the raw, un-rendered content of the bot's message from a `data-raw-content` attribute to the clipboard.
-   **History Page Logic**: The script on `history.html` formats timestamps to the user's local timezone and handles message deletion.

### CSS (`static/style.css`)

This file provides all the styling for the application.

-   **Layout**: Uses Flexbox and Grid for modern, responsive layouts.
-   **Theming**: Supports both light and dark themes using CSS variables.
-   **Message Bubbles**: Styles for user and bot messages to create a familiar chat look.
-   **Responsiveness**: Includes media queries to ensure the application is usable on mobile devices.
-   **Icons**: Uses Material Icons for a clean and consistent icon set.