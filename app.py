import os
import time
import uuid
import psutil 
import GPUtil 
import chromadb
import logging
import secrets
import sqlite3
import requests
import httpx
from uuid import uuid4
from langfuse import Langfuse
from datetime import datetime
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from collections import defaultdict
from logging.handlers import TimedRotatingFileHandler
from flask import Flask, jsonify, render_template, request, session, redirect, url_for, current_app
from flask import Response, stream_with_context

load_dotenv()

app = Flask(__name__)

# --- Logging Setup ---
def setup_logging(app_instance):
    """Configures file and stream logging for the application."""
    log_dir = 'logger'
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    # File Handler for daily logs
    # The main log file is app.log, rotated files get a date suffix.
    log_file = os.path.join(log_dir, 'app.log')
    file_handler = TimedRotatingFileHandler(
        log_file, when='midnight', interval=1, backupCount=30, encoding='utf-8'
    )
    # This will create rotated files like 'app.log.2024-08-15.txt'
    file_handler.suffix = "%Y-%m-%d.txt"
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))

    # Clear existing handlers and add the new one
    app_instance.logger.handlers.clear()
    app_instance.logger.addHandler(file_handler)
    app_instance.logger.setLevel(logging.INFO)
    app_instance.logger.propagate = False

setup_logging(app)

app.secret_key = secrets.token_hex(32)

@app.before_request
def log_request_info():
    """Log information about each incoming request."""
    current_app.logger.info(
        f"Request: {request.method} {request.path} from {request.remote_addr}"
    )

# Ollama Configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", " ")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", " ")

# Default settings
DEFAULT_SETTINGS = {
    'num_predict': os.getenv("NUM_PREDICT", " "),
    'temperature': os.getenv("TEMPERATURE", " "),
    'top_p': os.getenv("TOP_P", " "),
    'top_k': os.getenv("TOP_K", " "),
    'system_prompt': os.getenv("OLLAMA_SYSTEM_PROMPT", " ")
}

CHROMA_COLLECTION_NAME = "chat_history"

chroma_client = None    
chroma_collection = None
chroma_connected = False

# Initialize SQLite database
DATABASE = 'chat.db'

def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    with app.app_context():
        db = get_db()
        db.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                sender TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                num_predict INTEGER NOT NULL,
                temperature REAL NOT NULL,
                top_p REAL NOT NULL,
                top_k INTEGER NOT NULL
            )
        ''') # This was the original schema

        # Add columns if they don't exist (for migration)
        cursor = db.cursor()
        table_info = cursor.execute("PRAGMA table_info(settings)").fetchall()
        column_names = [info[1] for info in table_info]

        if 'langfuse_public_key' not in column_names:
            cursor.execute('ALTER TABLE settings ADD COLUMN langfuse_public_key TEXT')
        if 'langfuse_secret_key' not in column_names:
            cursor.execute('ALTER TABLE settings ADD COLUMN langfuse_secret_key TEXT')
        if 'langfuse_host' not in column_names:
            cursor.execute('ALTER TABLE settings ADD COLUMN langfuse_host TEXT')
        if 'system_prompt' not in column_names:
            cursor.execute('ALTER TABLE settings ADD COLUMN system_prompt TEXT')
        if 'chroma_api_key' not in column_names:
            cursor.execute('ALTER TABLE settings ADD COLUMN chroma_api_key TEXT')
        if 'chroma_tenant' not in column_names:
            cursor.execute('ALTER TABLE settings ADD COLUMN chroma_tenant TEXT')
        if 'chroma_database' not in column_names:
            cursor.execute('ALTER TABLE settings ADD COLUMN chroma_database TEXT')
        if 'langfuse_enabled' not in column_names:
            cursor.execute('ALTER TABLE settings ADD COLUMN langfuse_enabled BOOLEAN DEFAULT 0')
        if 'chromadb_enabled' not in column_names:
            cursor.execute('ALTER TABLE settings ADD COLUMN chromadb_enabled BOOLEAN DEFAULT 0')

        cursor = db.cursor()
        cursor.execute('SELECT id FROM settings WHERE id = 1')
        if cursor.fetchone() is None:
            # First time setup, insert with defaults.
            # Credentials are now managed exclusively via the UI.
            public_key = ""
            secret_key = ""
            host = "https://us.cloud.langfuse.com"
            chroma_api_key = os.getenv("CHROMA_API_KEY", "")
            chroma_tenant = os.getenv("CHROMA_TENANT", "")
            chroma_database = os.getenv("CHROMA_DATABASE", "")
            db.execute('INSERT INTO settings (id, num_predict, temperature, top_p, top_k, langfuse_public_key, langfuse_secret_key, langfuse_host, system_prompt, chroma_api_key, chroma_tenant, chroma_database, langfuse_enabled, chromadb_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                       (1, DEFAULT_SETTINGS['num_predict'], DEFAULT_SETTINGS['temperature'], DEFAULT_SETTINGS['top_p'], DEFAULT_SETTINGS['top_k'], public_key, secret_key, host, DEFAULT_SETTINGS['system_prompt'], chroma_api_key, chroma_tenant, chroma_database, 0, 0))
        else:
            # For existing installations, ensure langfuse columns have default values if they are NULL
            db.execute("UPDATE settings SET chroma_api_key = '' WHERE chroma_api_key IS NULL")
            db.execute("UPDATE settings SET chroma_tenant = '' WHERE chroma_tenant IS NULL")
            db.execute("UPDATE settings SET chroma_database = '' WHERE chroma_database IS NULL")
            db.execute("UPDATE settings SET langfuse_public_key = '' WHERE langfuse_public_key IS NULL")
            db.execute("UPDATE settings SET langfuse_secret_key = '' WHERE langfuse_secret_key IS NULL")
            db.execute("UPDATE settings SET langfuse_host = 'https://us.cloud.langfuse.com' WHERE langfuse_host IS NULL OR langfuse_host = ''")
            db.execute("UPDATE settings SET langfuse_enabled = 0 WHERE langfuse_enabled IS NULL")
            db.execute("UPDATE settings SET chromadb_enabled = 0 WHERE chromadb_enabled IS NULL")
            db.execute("UPDATE settings SET system_prompt = ? WHERE system_prompt IS NULL", (DEFAULT_SETTINGS['system_prompt'],))

        db.commit()
        app.logger.info("Database initialized")

# --- Langfuse Initialization ---
langfuse = None
langfuse_enabled = False

def get_settings():
    """Fetches settings from SQLite."""
    db = get_db()
    settings_row = db.execute('SELECT * FROM settings WHERE id = 1').fetchone()
    if settings_row:
        return dict(settings_row)
    
    # This should ideally not be reached if init_db works, but as a safeguard:
    app.logger.warning("Settings not found in SQLite, returning hardcoded defaults.")
    return {
        'num_predict': int(DEFAULT_SETTINGS['num_predict']),
        'temperature': float(DEFAULT_SETTINGS['temperature']),
        'top_p': float(DEFAULT_SETTINGS['top_p']),
        'top_k': int(DEFAULT_SETTINGS['top_k']),
        'langfuse_public_key': '',
        'langfuse_secret_key': '',
        'langfuse_host': 'https://us.cloud.langfuse.com',
        'system_prompt': DEFAULT_SETTINGS['system_prompt'],
        'chroma_api_key': '',
        'chroma_tenant': '',
        'chroma_database': '',
        'langfuse_enabled': False,
        'chromadb_enabled': False
    }

def save_settings(settings_dict):
    """Saves settings to SQLite."""
    typed_settings = {
        'num_predict': int(settings_dict['num_predict']),
        'temperature': float(settings_dict['temperature']),
        'top_p': float(settings_dict['top_p']),
        'top_k': int(settings_dict['top_k']),
        'langfuse_public_key': str(settings_dict.get('langfuse_public_key', '')),
        'langfuse_secret_key': str(settings_dict.get('langfuse_secret_key', '')),
        'langfuse_host': str(settings_dict.get('langfuse_host', '')),
        'system_prompt': str(settings_dict.get('system_prompt', '')),
        'chroma_api_key': str(settings_dict.get('chroma_api_key', '')),
        'chroma_tenant': str(settings_dict.get('chroma_tenant', '')),
        'chroma_database': str(settings_dict.get('chroma_database', '')),
        'langfuse_enabled': bool(settings_dict.get('langfuse_enabled', False)),
        'chromadb_enabled': bool(settings_dict.get('chromadb_enabled', False))
    }

    # Always save to SQLite as the primary fallback
    try:
        db = get_db()
        db.execute(
            'UPDATE settings SET num_predict = ?, temperature = ?, top_p = ?, top_k = ?, langfuse_public_key = ?, langfuse_secret_key = ?, langfuse_host = ?, system_prompt = ?, chroma_api_key = ?, chroma_tenant = ?, chroma_database = ?, langfuse_enabled = ?, chromadb_enabled = ? WHERE id = 1',
            (
                typed_settings['num_predict'], typed_settings['temperature'], typed_settings['top_p'], typed_settings['top_k'],
                typed_settings['langfuse_public_key'], typed_settings['langfuse_secret_key'], typed_settings['langfuse_host'],
                typed_settings['system_prompt'], typed_settings['chroma_api_key'], typed_settings['chroma_tenant'],
                typed_settings['chroma_database'], typed_settings['langfuse_enabled'], typed_settings['chromadb_enabled']
            )
        )
        db.commit()
        app.logger.info("Settings saved to SQLite.")
    except Exception as e:
        app.logger.error(f"Failed to save settings to SQLite: {e}")

def initialize_langfuse():
    """Initializes or re-initializes the Langfuse client from DB settings."""
    global langfuse, langfuse_enabled

    # Shutdown existing instance and reset resource manager to allow re-init with new keys
    if langfuse:
        langfuse.shutdown()
    # LangfuseResourceManager is a singleton, reset it to allow re-initialization
    from langfuse._client.resource_manager import LangfuseResourceManager
    LangfuseResourceManager.reset()
    langfuse = None
    langfuse_enabled = False

    with app.app_context():
        settings = get_settings()

        if not settings:
            app.logger.warning("Could not load settings from DB for Langfuse initialization.")
            return

        public_key = settings['langfuse_public_key']
        secret_key = settings['langfuse_secret_key']
        host = settings['langfuse_host']

        if settings.get('langfuse_enabled'):
            if public_key and secret_key:
                langfuse = Langfuse(
                    public_key=public_key,
                    secret_key=secret_key,
                    host=host or "https://us.cloud.langfuse.com",
                )

                if langfuse.auth_check():
                    langfuse_enabled = True
                    app.logger.info("Langfuse initialized and authenticated successfully from DB.")
                else:
                    app.logger.warning("Langfuse authentication failed using DB credentials. Tracing will be disabled.")
                    langfuse_enabled = False
            else:
                app.logger.warning("Langfuse is enabled in settings, but keys are not provided. Tracing remains disabled.")
                langfuse_enabled = False
        else:
            langfuse_enabled = False
            app.logger.info("Langfuse is disabled in settings.")

def initialize_chroma():
    """Initializes the ChromaDB client and collection."""
    global chroma_client, chroma_collection, chroma_connected
    with app.app_context():
        settings = get_settings()
        api_key = settings.get('chroma_api_key')
        tenant = settings.get('chroma_tenant')
        database = settings.get('chroma_database')

    if not settings.get('chromadb_enabled'):
        chroma_connected = False
        app.logger.info("ChromaDB is disabled in settings. Falling back to SQLite.")
        return

    if api_key and tenant and database: # Now also checks if it's enabled
        try:
            app.logger.info("Attempting to connect to ChromaDB Cloud...")
            chroma_client = chromadb.CloudClient(
                api_key=api_key,
                tenant=tenant,
                database=database
            )
            chroma_client.heartbeat()  # Check connection
            chroma_collection = chroma_client.get_or_create_collection(name=CHROMA_COLLECTION_NAME)
            chroma_connected = True
            app.logger.info("Successfully connected to ChromaDB Cloud.")
        except httpx.ConnectError as e:
            app.logger.warning(f"Could not connect to ChromaDB Cloud. Please ensure your credentials are correct and the service is accessible. Error: {e}. Falling back to SQLite.")
            chroma_connected = False
        except Exception as e:
            app.logger.warning(f"Failed to initialize ChromaDB, possibly due to invalid credentials or configuration. Error: {e}. Falling back to SQLite.")
            chroma_connected = False
    else:
        app.logger.warning("ChromaDB is enabled in settings, but credentials are not fully provided. Falling back to SQLite.")
        chroma_connected = False

init_db()
initialize_langfuse() # Initial call on startup
initialize_chroma() # Initialize ChromaDB

def check_ollama_connection():
    """Check if Ollama is running and accessible"""
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False

def get_ollama_models():
    """Fetch the list of available models from the Ollama API."""
    if not check_ollama_connection():
        current_app.logger.warning("Cannot fetch Ollama models, connection failed.")
        return []
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        response.raise_for_status()
        models_data = response.json().get("models", [])
        return sorted([model['name'] for model in models_data])
    except (requests.exceptions.RequestException, ValueError) as e:
        current_app.logger.error(f"Could not fetch models from Ollama: {e}")
        return []

def ollama_chat(messages, model, session_id=None, max_retries=3):
    """Send chat messages to Ollama API and get response with Langfuse tracing"""
    
    settings = get_settings()
    system_prompt = settings.get('system_prompt', '').strip()
    
    for attempt in range(max_retries):
        try:
            # Prepend system prompt if it exists
            final_messages = []
            if system_prompt:
                final_messages.append({"role": "system", "content": system_prompt})
            final_messages.extend(messages)
            
            payload = {
                "model": model,
                "messages": final_messages,
                "stream": False,
                "options": {
                    "num_predict": int(settings.get('num_predict')),
                    "temperature": float(settings.get('temperature')),
                    "top_p": float(settings.get('top_p')),
                    "top_k": int(settings.get('top_k'))
                }
            }
            
            # Create Langfuse trace if enabled
            if langfuse_enabled:
                with langfuse.start_as_current_span(
                    name=f"{model}::chat_generation",
                    input={"messages": final_messages}
                ) as span:
                    span.update_trace(
                        user_id="new-ollama-user", 
                        session_id=session_id or str(uuid4())
                    )
                    
                    with langfuse.start_as_current_generation(
                        name=f"{model}::generation",
                        model=model,
                        input=final_messages,
                        model_parameters=payload.get("options", {})
                    ) as gen:
                        # Make the API call with longer timeout
                        response = requests.post(
                            f"{OLLAMA_BASE_URL}/api/chat", 
                            json=payload, 
                            timeout=300,  # Increased to 5 minutes
                            headers={'Content-Type': 'application/json'}
                        )
                        response.raise_for_status()
                        
                        data = response.json()
                        assistant_response = data.get("message", {}).get("content", "Sorry, I couldn't generate a response.")
                        usage = {
                            "prompt_tokens": data.get("prompt_eval_count", 0),
                            "completion_tokens": data.get("eval_count", 0),
                        }
                        
                        # Update Langfuse generation with output
                        gen.update(output=assistant_response, usage_details=usage)
                        
                    # Update span with final output
                    span.update(output={"generated_text": assistant_response})
                    
                    return {"content": assistant_response, "usage": usage}
            else:
                # Make the API call without Langfuse tracing
                response = requests.post(
                    f"{OLLAMA_BASE_URL}/api/chat", 
                    json=payload, 
                    timeout=300,  # Increased to 5 minutes
                    headers={'Content-Type': 'application/json'}
                )
                response.raise_for_status()
                
                data = response.json()
                assistant_response = data.get("message", {}).get("content", "Sorry, I couldn't generate a response.")
                usage = {
                    "prompt_tokens": data.get("prompt_eval_count", 0),
                    "completion_tokens": data.get("eval_count", 0),
                }
                return {"content": assistant_response, "usage": usage}
            
        except requests.exceptions.Timeout as e:
            current_app.logger.warning(f"Attempt {attempt + 1} timed out: {e}")
            if attempt == max_retries - 1:
                return {"content": f"Request timed out after {max_retries} attempts. The model might be overloaded or the request too complex.", "usage": {}}
        except requests.exceptions.RequestException as e:
            current_app.logger.error(f"Ollama API error on attempt {attempt + 1}: {e}")
            if attempt == max_retries - 1:
                return {"content": f"Error connecting to Ollama after {max_retries} attempts: {str(e)}", "usage": {}}
        except Exception as e:
            current_app.logger.error(f"Unexpected error on attempt {attempt + 1}: {e}")
            if attempt == max_retries - 1:
                return {"content": f"An unexpected error occurred after {max_retries} attempts.", "usage": {}}
        
        # Wait before retrying (exponential backoff)
        if attempt < max_retries - 1:
            wait_time = 2 ** attempt  # 1s, 2s, 4s
            current_app.logger.info(f"Retrying in {wait_time} seconds...")
            time.sleep(wait_time)
    
    return {"content": "Maximum retry attempts reached.", "usage": {}}


class ThreadManager:
    def __init__(self):
        self.session_id = str(uuid4())

    def new_thread(self):
        self.session_id = str(uuid4())
        return self.session_id

thread_manager = ThreadManager()

@app.route('/')
def index():
    ollama_status = "Connected" if check_ollama_connection() else "Disconnected"
    available_models = get_ollama_models()
    return render_template(
        'index.html', 
        page_title="AI Think | Ollama Chat",
        page_id="chat",
        header_title="💬 AI Think",
        nav_links=[
            {"href": "/history", "title": "Chat History", "icon": "history"},
            {"href": "/models", "title": "Models Hub", "icon": "hub"},
        ],
        model_id=OLLAMA_MODEL, 
        available_models=available_models,
        ollama_status=ollama_status,
        langfuse_enabled=langfuse_enabled
    )

@app.route('/generate', methods=['POST'])
def generate():
    if not check_ollama_connection():
        return jsonify({"error": "Ollama is not available"}), 503

    data = request.get_json()
    if not data or 'messages' not in data:
        return jsonify({"error": "Missing 'messages'"}), 400

    model = data.get('model', OLLAMA_MODEL)
    messages = data['messages']
    user_message = messages[-1]['content'] if messages else ""
    current_app.logger.info(f"User message received for generation: '{user_message[:80]}...'")
    
    # Use session ID from Flask session (or generate new if not exists)
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    session_id = session['session_id']

    start_time = time.time()

    db = None
    if not chroma_connected:
        db = get_db()

    # Save user message to database
    if chroma_connected:
        try:
            chroma_collection.add(
                documents=[user_message],
                metadatas=[{
                    "sender": "user", 
                    "session_id": session_id, 
                    "timestamp": datetime.now(ZoneInfo("UTC")).isoformat()
                }],
                ids=[str(uuid.uuid4())]
            )
        except Exception as e:
            current_app.logger.error(f"Failed to save user message to ChromaDB: {e}")
    else:
        db.execute(
            'INSERT INTO messages (session_id, sender, content) VALUES (?, ?, ?)',
            (session_id, 'user', user_message)
        )
        db.commit()

    try:
        # Get AI response from Ollama with Langfuse tracing
        assistant_response_data = ollama_chat(messages, model, session_id)
        assistant_response = assistant_response_data['content']
        current_app.logger.info(f"Assistant response generated: '{assistant_response[:80]}...'")
        usage = assistant_response_data['usage']

        # Save assistant message to database
        if chroma_connected:
            try:
                chroma_collection.add(
                    documents=[assistant_response],
                    metadatas=[{"sender": "assistant", "session_id": session_id, "timestamp": datetime.now(ZoneInfo("UTC")).isoformat()}],
                    ids=[str(uuid.uuid4())]
                )
            except Exception as e:
                current_app.logger.error(f"Failed to save assistant message to ChromaDB: {e}")
        else:
            db.execute(
                'INSERT INTO messages (session_id, sender, content) VALUES (?, ?, ?)',
                (session_id, 'assistant', assistant_response)
            )
            db.commit()

        elapsed = time.time() - start_time

        return jsonify({
            "message": {
                "role": "assistant",
                "content": assistant_response
            },
            "usage": usage,
            "generation_time_seconds": round(elapsed, 2),
            "langfuse_enabled": langfuse_enabled
        })

    except Exception as e:
        current_app.logger.error(f"Error during generation: {e}")
        return jsonify({"error": "Internal generation error"}), 500

@app.route('/new-thread', methods=['POST'])
def new_thread():
    thread_id = thread_manager.new_thread()
    return jsonify({"success": True, "thread_id": thread_id})

@app.route('/reset_thread', methods=['POST'])
def reset_thread():
    old_session_id = session.get('session_id', 'N/A')
    current_app.logger.info(f"User reset chat thread. Old session ID: {old_session_id}")
    session.pop('session_id', None)
    return jsonify({"status": "New thread started"})

@app.route('/history')
def history():
    threads = defaultdict(list)
    session_start = {}
    utc_tz = ZoneInfo("UTC")

    if chroma_connected:
        try:
            results = chroma_collection.get(include=["metadatas", "documents"])
            chroma_messages = []
            for i, doc_id in enumerate(results['ids']):
                meta = results['metadatas'][i]
                chroma_messages.append({
                    'id': doc_id,
                    'session_id': meta['session_id'],
                    'sender': meta['sender'],
                    'content': results['documents'][i],
                    'timestamp': datetime.fromisoformat(meta['timestamp'])
                })
            
            sorted_messages = sorted(chroma_messages, key=lambda x: x['timestamp'])

            for msg in sorted_messages:
                session_id = msg['session_id']
                threads[session_id].append(msg)
                if session_id not in session_start:
                    session_start[session_id] = msg['timestamp']

        except Exception as e:
            current_app.logger.error(f"Failed to fetch history from ChromaDB: {e}")
            threads = defaultdict(list)
    else:
        db = get_db()
        messages = db.execute('SELECT id, session_id, sender, content, timestamp FROM messages ORDER BY timestamp ASC').fetchall()
        
        for msg in messages:
            session_id = msg['session_id']
            timestamp_str = msg['timestamp']
            # Create a naive datetime, then make it timezone-aware (UTC)
            naive_timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
            utc_timestamp = naive_timestamp.replace(tzinfo=utc_tz)
            
            threads[session_id].append({
                'id': msg['id'],
                'sender': msg['sender'],
                'content': msg['content'],
                'timestamp': utc_timestamp
            })
            
            if session_id not in session_start:
                session_start[session_id] = utc_timestamp

    # Sort threads by the timestamp of the LAST message in each thread
    sorted_threads = sorted(
        threads.items(),
        key=lambda item: item[1][-1]['timestamp'],
        reverse=True
    )

    # Add serial numbers
    total_threads = len(sorted_threads)
    threads_with_sn = [
        {
            'session_id': session_id,
            'messages': messages,
            'serial_number': total_threads - i
        }
        for i, (session_id, messages) in enumerate(sorted_threads)
    ]

    return render_template(
        'history.html',
        threads=threads_with_sn,
        session_start=session_start,
        newest_session_id=sorted_threads[0][0] if sorted_threads else None
    )

@app.route('/delete_message/<string:message_id>', methods=['DELETE'])
def delete_message(message_id):
    try:
        if chroma_connected:
            chroma_collection.delete(ids=[message_id])
            current_app.logger.info(f"User deleted message with ID from ChromaDB: {message_id}")
        else:
            db = get_db()
            # The original route used int, so we cast it back for sqlite
            db.execute('DELETE FROM messages WHERE id = ?', (int(message_id),))
            db.commit()
            current_app.logger.info(f"User deleted message with ID from SQLite: {message_id}")

        return jsonify({"success": True})
    except Exception as e:
        current_app.logger.error(f"Error deleting message: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/delete_thread/<string:session_id>', methods=['DELETE'])
def delete_thread(session_id):
    """Deletes all messages associated with a session_id."""
    try:
        if chroma_connected:
            # ChromaDB deletion by metadata filter
            chroma_collection.delete(where={"session_id": session_id})
            current_app.logger.info(f"User deleted thread with session ID from ChromaDB: {session_id}")
        else:
            # SQLite deletion
            db = get_db()
            db.execute('DELETE FROM messages WHERE session_id = ?', (session_id,))
            db.commit()
            current_app.logger.info(f"User deleted thread with session ID from SQLite: {session_id}")

        return jsonify({"success": True, "message": f"Thread {session_id} deleted."})
    except Exception as e:
        current_app.logger.error(f"Error deleting thread {session_id}: {e}")
        # It's good practice to return a more specific error message if possible,
        # but for security, we'll keep it generic for the user.
        return jsonify({"success": False, "error": "An internal error occurred while deleting the thread."}), 500


def get_component_status(usage, total, threshold=0.9):
    """Return 'critical', 'warning', or 'stable' for a usage/total pair."""
    if usage / total >= threshold:
        return 'critical'
    elif (total - usage) / total < 0.1:
        return 'warning'
    else:
        return 'stable'

def get_gpu_status(gpus):
    """Return 'critical', 'warning', or 'stable' for GPU(s)."""
    if not gpus:
        return 'stable'
    
    status = 'stable'
    for gpu in gpus:
        load = float(gpu['load'].rstrip('%'))
        mem_used = int(float(gpu['memory_used'].rstrip('MB')))
        mem_total = int(float(gpu['memory_total'].rstrip('MB')))
        temp = float(gpu['temperature'].rstrip('°C'))
        
        if load >= 90 or (mem_total > 0 and mem_used / mem_total >= 0.9) or temp > 85:
            status = 'critical'
            break
        elif load >= 80 or (mem_total > 0 and mem_used / mem_total >= 0.8) or temp > 75:
            status = 'warning'
    
    return status

def get_overall_status(cpu, memory, disk, gpu_info):
    """Determine overall system status from component checks."""
    cpu_status = get_component_status(cpu['percent'], 100)
    mem_status = get_component_status(memory['percent'], 100)
    disk_status = get_component_status(disk['percent'], 100)
    
    if isinstance(gpu_info, str):
        gpu_status = 'warning'
    else:
        gpu_status = get_gpu_status(gpu_info)
    
    statuses = [cpu_status, mem_status, disk_status, gpu_status]
    
    if 'critical' in statuses:
        return 'critical'
    elif 'warning' in statuses:
        return 'warning'
    else:
        return 'stable'

@app.route('/health', methods=['GET'])
def health():
    cpu_percent = psutil.cpu_percent(interval=0.1)
    cpu_count = psutil.cpu_count()
    mem = psutil.virtual_memory()
    
    def b2g(b): 
        return round(b / (1024**3), 2)
    
    memory = {
        "total": f"{b2g(mem.total)} GB",
        "available": f"{b2g(mem.available)} GB",
        "used": f"{b2g(mem.used)} GB",
        "percent": mem.percent
    }
    
    du = psutil.disk_usage('/')
    disk = {
        "total": f"{b2g(du.total)} GB",
        "used": f"{b2g(du.used)} GB",
        "free": f"{b2g(du.free)} GB",
        "percent": du.percent
    }
    
    try:
        g = GPUtil.getGPUs()
        gpu_info = [] if not g else [{
            "id": gpu.id,
            "name": gpu.name,
            "load": f"{gpu.load*100:.1f}%",
            "memory_used": f"{gpu.memoryUsed}MB",
            "memory_total": f"{gpu.memoryTotal}MB",
            "temperature": f"{gpu.temperature}°C"
        } for gpu in g]
    except Exception as e:
        gpu_info = f"Unavailable: {e}"
    
    overall_status = get_overall_status(
        {"percent": cpu_percent},
        {"percent": mem.percent},
        {"percent": du.percent},
        gpu_info
    )
    
    # Check Ollama status
    ollama_status = "Connected" if check_ollama_connection() else "Disconnected"
    
    return render_template(
        'health.html',
        status=overall_status,
        page_title="System Health | Ollama Chat",
        page_id="health",
        header_title="🏥 System Health Dashboard",
        cpu={"count": cpu_count, "percent": cpu_percent},
        memory=memory,
        disk=disk,
        gpu_info=gpu_info,
        ollama_status=ollama_status,
        ollama_model=OLLAMA_MODEL,
        langfuse_enabled=langfuse_enabled,
        chroma_connected=chroma_connected
    )

@app.route('/models')
def models_hub():
    """Render the models hub page."""
    ollama_status = "Connected" if check_ollama_connection() else "Disconnected"
    return render_template(
        'models.html',
        page_title="Models Hub | Ollama Chat",
        page_id="models",
        header_title="📦 Models Hub",
        ollama_status=ollama_status
    )

@app.route('/api/models', methods=['GET'])
def api_get_models():
    """API endpoint to get local Ollama models."""
    if not check_ollama_connection():
        return jsonify({"error": "Ollama service is not available."}), 503
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags")
        response.raise_for_status()
        return jsonify(response.json())
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/models/pull', methods=['POST'])
def api_pull_model():
    """API endpoint to pull a model. Streams the response."""
    data = request.get_json()
    model_name = data.get('name')
    if not model_name:
        return Response('{"error": "Model name is required."}', status=400, mimetype='application/json')

    def generate():
        try:
            # Use stream=True to get a streaming response from Ollama
            pull_request = requests.post(
                f"{OLLAMA_BASE_URL}/api/pull",
                json={"name": model_name, "stream": True},
                stream=True
            )
            pull_request.raise_for_status()
            for line in pull_request.iter_lines():
                if line:
                    yield line.decode('utf-8') + '\n' # Yield each line of the JSON stream
        except requests.RequestException as e:
            yield f'{{"error": "Failed to pull model: {str(e)}"}}\n'

    return Response(stream_with_context(generate()), mimetype='application/x-ndjson')

@app.route('/api/models/delete', methods=['POST'])
def api_delete_model():
    """API endpoint to delete a local model."""
    data = request.get_json()
    model_name = data.get('name')
    if not model_name:
        return jsonify({"error": "Model name is required."}), 400
    try:
        response = requests.delete(f"{OLLAMA_BASE_URL}/api/delete", json={"name": model_name})
        # Check if the response has content before trying to parse it as JSON
        if response.text:
            return jsonify(response.json()), response.status_code
        else:
            return jsonify({"status": "success"}), response.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 500

@app.route('/settings', methods=['GET', 'POST'])
def settings():
    if request.method == 'POST':
        settings_to_save = {
            'num_predict': request.form['num_predict'],
            'temperature': request.form['temperature'],
            'top_p': request.form['top_p'],
            'top_k': request.form['top_k'],
            'langfuse_public_key': request.form.get('langfuse_public_key', ''),
            'langfuse_secret_key': request.form.get('langfuse_secret_key', ''),
            'langfuse_host': request.form.get('langfuse_host', ''),
            'system_prompt': request.form.get('system_prompt', ''),
            'langfuse_enabled': 'langfuse_enabled' in request.form,
            'chroma_api_key': request.form.get('chroma_api_key', ''),
            'chroma_tenant': request.form.get('chroma_tenant', ''),
            'chroma_database': request.form.get('chroma_database', ''),
            'chromadb_enabled': 'chromadb_enabled' in request.form
        }
        save_settings(settings_to_save)
        current_app.logger.info(f"Settings updated: {request.form.to_dict()}")
        # Re-initialize services with new settings
        initialize_langfuse()
        initialize_chroma()
        return redirect(url_for('settings'))

    # Get current settings
    current_settings = get_settings()
    
    return render_template('settings.html', settings=current_settings)

# Langfuse flush on app shutdown
@app.teardown_appcontext
def flush_langfuse(error):
    if langfuse_enabled:
        try:
            langfuse.flush()
        except Exception as e:
            current_app.logger.warning(f"Error flushing Langfuse: {e}")
