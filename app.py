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
from werkzeug.exceptions import ClientDisconnected

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
SEARXNG_URL = os.getenv("SEARXNG_URL", " ")

# Langfuse Configuration
LANGFUSE_HOST = os.getenv("LANGFUSE_HOST", " ")

# Default settings
DEFAULT_SETTINGS = {
    'num_predict': os.getenv("NUM_PREDICT", " "),
    'temperature': os.getenv("TEMPERATURE", " "),
    'top_p': os.getenv("TOP_P", " "),
    'top_k': os.getenv("TOP_K", " "),
    'system_prompt': os.getenv("OLLAMA_SYSTEM_PROMPT", " "),
    'searxng_url': SEARXNG_URL
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
            CREATE TABLE IF NOT EXISTS prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS cloud_models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key TEXT NOT NULL,
                model_name TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                active BOOLEAN DEFAULT 1
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS local_models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                active BOOLEAN DEFAULT 1,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
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
        if 'searxng_url' not in column_names:
            cursor.execute('ALTER TABLE settings ADD COLUMN searxng_url TEXT')
        if 'searxng_enabled' not in column_names:
            cursor.execute('ALTER TABLE settings ADD COLUMN searxng_enabled BOOLEAN DEFAULT 0')
        if 'active' not in [info[1] for info in cursor.execute("PRAGMA table_info(cloud_models)").fetchall()]:
            cursor.execute('ALTER TABLE cloud_models ADD COLUMN active BOOLEAN DEFAULT 1')
        if 'name' not in [info[1] for info in cursor.execute("PRAGMA table_info(local_models)").fetchall()]:
             cursor.execute('ALTER TABLE local_models ADD COLUMN name TEXT NOT NULL UNIQUE')
        
        # Migration: Drop system_prompt if it exists
        if 'system_prompt' in column_names:
            app.logger.info("Migrating database: Dropping 'system_prompt' column from 'settings' table.")
            # SQLite doesn't support DROP COLUMN directly in older versions.
            # A more robust migration would recreate the table, but for this project, we assume a modern SQLite version or that this is acceptable.
            # For simplicity, we'll just ignore it going forward. A proper migration is complex.
            # A better approach is to not select it anymore.

        cursor = db.cursor()
        cursor.execute('SELECT id FROM settings WHERE id = 1')
        if cursor.fetchone() is None:
            # First time setup, insert with defaults.
            # Credentials are now managed exclusively via the UI.
            public_key = ""
            secret_key = ""
            host = LANGFUSE_HOST
            chroma_api_key = os.getenv("CHROMA_API_KEY", "")
            chroma_tenant = os.getenv("CHROMA_TENANT", "")
            chroma_database = os.getenv("CHROMA_DATABASE", "")
            db.execute('INSERT INTO settings (id, num_predict, temperature, top_p, top_k, langfuse_public_key, langfuse_secret_key, langfuse_host, chroma_api_key, chroma_tenant, chroma_database, langfuse_enabled, chromadb_enabled, searxng_url, searxng_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                       (1, DEFAULT_SETTINGS['num_predict'], DEFAULT_SETTINGS['temperature'], DEFAULT_SETTINGS['top_p'], DEFAULT_SETTINGS['top_k'], public_key, secret_key, host, chroma_api_key, chroma_tenant, chroma_database, 0, 0, DEFAULT_SETTINGS['searxng_url'], 0))
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
            db.execute("UPDATE settings SET searxng_url = ? WHERE searxng_url IS NULL", (DEFAULT_SETTINGS['searxng_url'],))
            db.execute("UPDATE settings SET searxng_enabled = 0 WHERE searxng_enabled IS NULL")

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
        'langfuse_host': LANGFUSE_HOST,
        'chroma_api_key': '',
        'chroma_tenant': '',
        'chroma_database': '',
        'langfuse_enabled': False,
        'chromadb_enabled': False,
        'searxng_url': SEARXNG_URL,
        'searxng_enabled': False
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
        'chroma_api_key': str(settings_dict.get('chroma_api_key', '')),
        'chroma_tenant': str(settings_dict.get('chroma_tenant', '')),
        'chroma_database': str(settings_dict.get('chroma_database', '')),
        'langfuse_enabled': bool(settings_dict.get('langfuse_enabled', False)),
        'chromadb_enabled': bool(settings_dict.get('chromadb_enabled', False)),
        'searxng_url': str(settings_dict.get('searxng_url', '')),
        'searxng_enabled': bool(settings_dict.get('searxng_enabled', False))
    }

    # Always save to SQLite as the primary fallback
    try:
        db = get_db()
        db.execute(
            'UPDATE settings SET num_predict = ?, temperature = ?, top_p = ?, top_k = ?, langfuse_public_key = ?, langfuse_secret_key = ?, langfuse_host = ?, chroma_api_key = ?, chroma_tenant = ?, chroma_database = ?, langfuse_enabled = ?, chromadb_enabled = ?, searxng_url = ?, searxng_enabled = ? WHERE id = 1',
            (
                typed_settings['num_predict'], typed_settings['temperature'], typed_settings['top_p'], typed_settings['top_k'],
                typed_settings['langfuse_public_key'], typed_settings['langfuse_secret_key'], typed_settings['langfuse_host'],
                typed_settings['chroma_api_key'], typed_settings['chroma_tenant'], typed_settings['chroma_database'], 
                typed_settings['langfuse_enabled'], typed_settings['chromadb_enabled'],
                typed_settings['searxng_url'], typed_settings['searxng_enabled']
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
                    host=host or LANGFUSE_HOST,
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

def check_searxng_connection():
    """Check if SearXNG is running and accessible."""
    settings = get_settings()
    if not settings.get('searxng_enabled'):
        return False
    url = settings.get('searxng_url')
    if not url:
        return False
    try:
        # SearXNG's health endpoint or just the base URL
        response = requests.get(url, timeout=3)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False

def get_ollama_models():
    """Fetch the list of available models from the Ollama API."""
    if not check_ollama_connection():
        current_app.logger.warning("Cannot fetch Ollama models, connection failed.")
        return []
    try:
        db = get_db()
        # Get models from Ollama API
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        response.raise_for_status()
        models_data = response.json().get("models", [])
        api_model_names = {model['name'] for model in models_data}

        # Get models from our DB
        db_models_cursor = db.execute('SELECT name, active FROM local_models')
        db_models = {row['name']: row['active'] for row in db_models_cursor}

        # Sync: Add new models from API to DB
        for name in api_model_names:
            if name not in db_models:
                db.execute('INSERT INTO local_models (name, active) VALUES (?, ?)', (name, True))
                db_models[name] = True # Assume active by default

        # Sync: Remove models from DB that are no longer in API
        for name in list(db_models.keys()):
            if name not in api_model_names:
                db.execute('DELETE FROM local_models WHERE name = ?', (name,))
                del db_models[name]
        
        db.commit()

        # Return a list of dicts, sorted by name
        return sorted(
            [{'name': name, 'active': active} for name, active in db_models.items()],
            key=lambda x: x['name']
        )
    except (requests.exceptions.RequestException, ValueError) as e:
        current_app.logger.error(f"Could not fetch models from Ollama: {e}")
        return []

def get_cloud_models():
    """Fetch all configured cloud models from the database."""
    try:
        db = get_db()
        models_cursor = db.execute('SELECT id, service, base_url, api_key, model_name, active FROM cloud_models ORDER BY service, model_name').fetchall()
        # Return a list of dicts, but don't expose the full API key
        models = []
        for row in models_cursor:
            model_dict = dict(row)
            models.append(model_dict)
        return models
    except Exception as e:
        current_app.logger.error(f"Could not fetch cloud models: {e}")
        return []

def search_searxng(query):
    """Perform a search using SearXNG and return formatted results."""
    settings = get_settings()
    if not settings.get('searxng_enabled'):
        return "SearXNG is not enabled."

    base_url = settings.get('searxng_url')
    params = {
        'q': query,
        'format': 'json'
    }
    try:
        response = requests.get(base_url, params=params, timeout=10)
        response.raise_for_status()
        results = response.json()
        
        if not results.get('results'):
            return "No search results found."

        # Format results for the LLM
        formatted_results = f"Search results for '{query}':\n\n"
        for i, result in enumerate(results['results'][:5], 1): # Top 5 results
            formatted_results += f"{i}. {result.get('title', 'No Title')}\n"
            formatted_results += f"   URL: {result.get('url', 'No URL')}\n"
            formatted_results += f"   Snippet: {result.get('content', 'No snippet available.')}\n\n"
        return formatted_results
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"SearXNG search failed: {e}")
        return f"Error performing search: {e}"
    except Exception as e:
        current_app.logger.error(f"Error processing SearXNG results: {e}")
        return "Error processing search results."

def cloud_model_chat(messages, model_config, session_id=None, max_retries=3):
    """Send chat messages to a configured cloud API and get a response with Langfuse tracing."""
    settings = get_settings()
    model_name = model_config['model_name']

    for attempt in range(max_retries):
        try:
            payload = {
                "model": model_name,
                "messages": messages,
                "stream": False,
                # Some cloud providers might use these, others might not.
                # This is a generic payload.
                "max_tokens": int(settings.get('num_predict')),
                "temperature": float(settings.get('temperature')),
                "top_p": float(settings.get('top_p')),
            }

            headers = {
                'Content-Type': 'application/json',
                'Authorization': f"Bearer {model_config['api_key']}"
            }

            # Use the base_url from the model config
            api_url = f"{model_config['base_url'].rstrip('/')}/chat/completions"
            # Use the base_url from the model config and append the correct path.
            base_url = model_config['base_url'].rstrip('/')
            if base_url.endswith('/chat/completions'):
                api_url = base_url
            else:
                api_url = f"{base_url}/chat/completions"

            if langfuse_enabled:
                with langfuse.start_as_current_span(
                    name=f"{model_name}::cloud_chat_generation",
                    input={"messages": messages}
                ) as span:
                    span.update_trace(
                        user_id="cloud-model-user",
                        session_id=session_id or str(uuid4())
                    )

                    with langfuse.start_as_current_generation(
                        name=f"{model_name}::generation",
                        model=model_name,
                        input=messages,
                        model_parameters={k: v for k, v in payload.items() if k != 'messages'}
                    ) as gen:
                        response = requests.post(
                            api_url,
                            json=payload,
                            headers=headers,
                            timeout=300
                        )
                        response.raise_for_status()

                        data = response.json()
                        # OpenAI/Perplexity/DeepSeek compatible response format
                        assistant_response = data.get("choices", [{}])[0].get("message", {}).get("content", "Sorry, I couldn't get a response.")
                        usage = data.get("usage", {
                            "prompt_tokens": 0,
                            "completion_tokens": 0
                        })

                        gen.update(output=assistant_response, usage_details=usage)

                    span.update(output={"generated_text": assistant_response})
                    return {"content": assistant_response, "usage": usage}
            else:
                response = requests.post(
                    api_url,
                    json=payload,
                    headers=headers,
                    timeout=300
                )
                response.raise_for_status()

                data = response.json()
                assistant_response = data.get("choices", [{}])[0].get("message", {}).get("content", "Sorry, I couldn't get a response.")
                usage = data.get("usage", {
                    "prompt_tokens": data.get("usage", {}).get("prompt_tokens", 0),
                    "completion_tokens": data.get("usage", {}).get("completion_tokens", 0)
                })
                return {"content": assistant_response, "usage": usage}

        except requests.exceptions.Timeout as e:
            current_app.logger.warning(f"Cloud model attempt {attempt + 1} timed out: {e}")
            if attempt == max_retries - 1:
                return {"content": f"Request timed out after {max_retries} attempts.", "usage": {}}
        except requests.exceptions.RequestException as e:
            current_app.logger.error(f"Cloud model API error on attempt {attempt + 1}: {e} - Response: {e.response.text if e.response else 'N/A'}")
            if attempt == max_retries - 1:
                return {"content": f"Error connecting to the cloud model after {max_retries} attempts: {str(e)}", "usage": {}}
        except Exception as e:
            current_app.logger.error(f"Unexpected error with cloud model on attempt {attempt + 1}: {e}")
            if attempt == max_retries - 1:
                return {"content": f"An unexpected error occurred after {max_retries} attempts.", "usage": {}}

        if attempt < max_retries - 1:
            wait_time = 2 ** attempt
            current_app.logger.info(f"Retrying in {wait_time} seconds...")
            time.sleep(wait_time)

    return {"content": "Maximum retry attempts reached for cloud model.", "usage": {}}

def ollama_chat(messages, model, session_id=None, max_retries=3):
    """Send chat messages to Ollama API and get response with Langfuse tracing"""
    
    settings = get_settings()    
    
    for attempt in range(max_retries):
        try:
            # The system prompt is now part of the conversation history
            # managed by the frontend, so we don't need to prepend it here.
            # The first message can be a system prompt.
            final_messages = messages
            
            
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
    cloud_models = get_cloud_models()
    settings = get_settings()
    
    # Fetch active prompts for the dropdown
    prompts = []
    try:
        db = get_db()
        prompts = db.execute('SELECT id, title, content FROM prompts ORDER BY title ASC').fetchall()
    except Exception as e:
        current_app.logger.error(f"Could not fetch prompts for index page: {e}")

    # Check if a session_id is provided in the URL
    session_id = request.args.get('session_id')
    if session_id:
        session['session_id'] = session_id

    return render_template(
        'index.html', 
        page_title="AI Think | AI Think Chat",
        page_id="chat",
        header_title="💬 AI Think",
        nav_links=[
            {"href": "/history", "title": "Chat History", "icon": "history"},
            {"href": "/cloud_models", "title": "Cloud Models", "icon": "cloud"},
            {"href": "/models", "title": "Models Hub", "icon": "hub"},
        ],
        model_id=OLLAMA_MODEL, 
        available_models=[m for m in available_models if m.get('active', True)],
        cloud_models=cloud_models,
        ollama_status=ollama_status,
        langfuse_enabled=langfuse_enabled,
        prompts=prompts,
        searxng_enabled=settings.get('searxng_enabled', False)
    )

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handles file uploads and adds their content to the session."""
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    session_id = session['session_id']

    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file and file.filename.endswith('.txt'):
        try:
            content = file.read().decode('utf-8')
            
            # Store file content as a special message in the database
            message_to_save = f"File uploaded: {file.filename}\n\n--- CONTENT ---\n{content}"
            
            if chroma_connected:
                try:
                    chroma_collection.add(
                        documents=[message_to_save],
                        metadatas=[{
                            "sender": "system", # Special sender type for file context
                            "session_id": session_id,
                            "timestamp": datetime.now(ZoneInfo("UTC")).isoformat(),
                            "is_file_context": True # Custom metadata flag
                        }],
                        ids=[str(uuid.uuid4())]
                    )
                except Exception as e:
                    current_app.logger.error(f"Failed to save file context to ChromaDB: {e}")
            else:
                db = get_db()
                db.execute(
                    'INSERT INTO messages (session_id, sender, content) VALUES (?, ?, ?)',
                    (session_id, 'system', message_to_save)
                )
                db.commit()

            current_app.logger.info(f"Uploaded file '{file.filename}' and stored it in the database for session {session_id}.")
            return jsonify({"success": True, "filename": file.filename, "message": f"File '{file.filename}' uploaded. You can now ask questions about it."})
        except Exception as e:
            current_app.logger.error(f"Error reading uploaded file: {e}")
            return jsonify({"error": "Failed to read file"}), 500
    return jsonify({"error": "Invalid file type, please upload a .txt file"}), 400

@app.route('/generate', methods=['POST'])
def generate():
    if not check_ollama_connection():
        return jsonify({"error": "Ollama is not available"}), 503

    data = request.get_json()
    if not data or 'messages' not in data:
        return jsonify({"error": "Missing 'messages' or 'newMessage'"}), 400

    model = data.get('model', OLLAMA_MODEL)
    # The full conversation history, excluding the new message
    conversation_history = data['messages']
    # The new message from the user
    new_message_content = data.get('newMessage', {}).get('content', '')
    if not new_message_content:
        return jsonify({"error": "New message content is empty"}), 400

    # The model identifier might be prefixed with "cloud::"
    is_cloud_model = model.startswith('cloud::')
    model_id = model.replace('cloud::', '')

    # Use session ID from Flask session (or generate new if not exists)
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    session_id = session['session_id']

    # Handle /search command
    if new_message_content.strip().startswith('/search'):
        query = new_message_content.strip().replace('/search', '').strip()
        if query:
            current_app.logger.info(f"Performing SearXNG search for: '{query}'")
            search_results = search_searxng(query)
            # Prepend search results to the user's message for context
            contextual_prompt = f"Based on the following web search results, please answer the user's question.\n\n--- SEARCH RESULTS ---\n{search_results}\n\n--- USER QUESTION ---\n{query}"
            new_message_content = contextual_prompt
        else:
            # If no query, treat as a normal message
            pass

    # Construct the full message list for the model
    messages_for_model = conversation_history + [{'role': 'user', 'content': new_message_content}]

    # The user message to be saved is the (potentially modified) new message
    user_message_to_save = new_message_content

    current_app.logger.info(f"User message received for generation: '{user_message_to_save[:80]}...'")

    # Use session ID from Flask session (or generate new if not exists)
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    session_id = session['session_id']

    db = None
    if not chroma_connected:
        db = get_db()

    start_time = time.time()

    try:
        # This outer try-except block is to catch the client disconnecting.
        # If the user clicks "Stop" on the frontend, the request is aborted,
        # and this exception is raised when Flask tries to send the response.
        # By catching it, we can prevent the messages from being saved to the DB.

        # --- Model Routing and Generation ---

        assistant_response_data = None
        if is_cloud_model:
            # Fetch the specific cloud model's config
            db = get_db()
            model_config_row = db.execute('SELECT * FROM cloud_models WHERE id = ?', (int(model_id),)).fetchone()
            if not model_config_row:
                return jsonify({"error": f"Cloud model with ID {model_id} not found."}), 404
            
            # For cloud models, add file context as a system message if it's the first user message
            if not conversation_history: # If history is empty, this is the first user message
                file_context_message = None
                if chroma_connected:
                    try:
                        results = chroma_collection.get(
                            where={"$and": [{"session_id": session_id}, {"sender": "system"}]},
                            include=["documents"]
                        )
                        if results['documents']:
                            file_context_message = results['documents'][-1]
                    except Exception as e:
                        current_app.logger.error(f"Error fetching file context from ChromaDB for session {session_id}: {e}")
                else:
                    file_row = db.execute(
                        "SELECT content FROM messages WHERE session_id = ? AND sender = 'system' ORDER BY timestamp DESC LIMIT 1",
                        (session_id,)
                    ).fetchone()
                    if file_row:
                        file_context_message = file_row['content']
                
                if file_context_message and '\n\n--- CONTENT ---\n' in file_context_message:
                    filename_line, file_content = file_context_message.split('\n\n--- CONTENT ---\n', 1)
                    filename = filename_line.replace('File uploaded: ', '')
                    # Create a system message with the file content
                    system_context_prompt = f"You are an expert assistant. The user has provided a document named '{filename}'. Use its content to answer the user's question. The document content is as follows:\n\n---\n{file_content}\n---"
                    # Insert the system message at the beginning of the conversation
                    messages_for_model.insert(0, {"role": "system", "content": system_context_prompt})

            model_config = dict(model_config_row)
            current_app.logger.info(f"Routing to cloud model: {model_config['service']} - {model_config['model_name']}")
            assistant_response_data = cloud_model_chat(messages_for_model, model_config, session_id)
        else:
            # It's an Ollama model
            # For local models, prepend context to the user message
            if not conversation_history:  # If history is empty, this is the first user message
                file_context_message = None
                if chroma_connected:
                    try:
                        results = chroma_collection.get(
                            where={"$and": [{"session_id": session_id}, {"sender": "system"}]},
                            include=["documents"]
                        )
                        if results['documents']:
                            file_context_message = results['documents'][-1]
                    except Exception as e:
                        current_app.logger.error(f"Error fetching file context from ChromaDB for session {session_id}: {e}")
                else:
                    file_row = db.execute("SELECT content FROM messages WHERE session_id = ? AND sender = 'system' ORDER BY timestamp DESC LIMIT 1", (session_id,)).fetchone()
                    if file_row:
                        file_context_message = file_row['content']

                if file_context_message and '\n\n--- CONTENT ---\n' in file_context_message:
                    filename_line, file_content = file_context_message.split('\n\n--- CONTENT ---\n', 1)
                    filename = filename_line.replace('File uploaded: ', '')
                    contextual_prompt = f"Based on the content of the document '{filename}' provided below, please answer the following question.\n\n---\n\nDOCUMENT CONTENT:\n{file_content}\n\n---\n\nQUESTION:\n{new_message_content}"
                    # Replace the last message's content (the user's question)
                    messages_for_model[-1]['content'] = contextual_prompt
                    user_message_to_save = contextual_prompt  # Update the content to be saved

            current_app.logger.info(f"Routing to Ollama model: {model}")
            assistant_response_data = ollama_chat(messages_for_model, model, session_id)

        assistant_response = assistant_response_data['content']
        current_app.logger.info(f"Assistant response generated: '{assistant_response[:80]}...'")
        usage = assistant_response_data['usage']

        # --- Save messages AFTER successful generation ---
        # Save user message to database
        if chroma_connected:
            try:
                # Batch add user and assistant messages
                chroma_collection.add(
                    documents=[user_message_to_save, assistant_response],
                    metadatas=[
                        {"sender": "user", "session_id": session_id, "timestamp": datetime.now(ZoneInfo("UTC")).isoformat()},
                        {"sender": "assistant", "session_id": session_id, "timestamp": datetime.now(ZoneInfo("UTC")).isoformat()}
                    ],
                    ids=[str(uuid.uuid4()), str(uuid.uuid4())]
                )
            except Exception as e:
                current_app.logger.error(f"Failed to save messages to ChromaDB: {e}")
        else:
            db.execute('INSERT INTO messages (session_id, sender, content) VALUES (?, ?, ?)', (session_id, 'user', user_message_to_save))
            db.execute('INSERT INTO messages (session_id, sender, content) VALUES (?, ?, ?)', (session_id, 'assistant', assistant_response))
            db.commit() # Commit both user and assistant messages

        elapsed = time.time() - start_time

        return jsonify({
            "message": {
                "role": "assistant",
                "content": assistant_response
            },
            "user_message_content": user_message_to_save, # Send back the (potentially modified) user message
            "usage": usage,
            "generation_time_seconds": round(elapsed, 2),
            "langfuse_enabled": langfuse_enabled,
            "session_id": session_id
        })

    except ClientDisconnected:
        current_app.logger.info(f"Client disconnected, generation for session {session_id} cancelled. No data will be saved.")
        # Return a specific response so the frontend knows it was a client-side abort
        return jsonify({"status": "cancelled", "message": "Client disconnected."}), 204

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

@app.route('/api/session/<string:session_id>', methods=['GET'])
def get_session_history(session_id):
    """Fetches the message history for a specific session_id."""
    messages = []
    try:
        if chroma_connected:
            results = chroma_collection.get(
                where={"session_id": session_id},
                include=["metadatas", "documents"]
            )
            chroma_messages = []
            for i in range(len(results['ids'])):
                meta = results['metadatas'][i]
                # Ensure we only process messages, not other system data
                if meta.get('sender') in ['user', 'assistant', 'system']:
                    chroma_messages.append({
                        'role': meta['sender'],
                        'content': results['documents'][i],
                        'timestamp': meta['timestamp']
                    })
            # Sort by timestamp
            sorted_messages = sorted(chroma_messages, key=lambda x: datetime.fromisoformat(x['timestamp']))
            # We only need role and content for the conversation history
            messages = [{'role': msg['role'], 'content': msg['content']} for msg in sorted_messages]
        else:
            db = get_db()
            rows = db.execute(
                'SELECT sender, content FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
                (session_id,)
            ).fetchall()
            messages = [{'role': row['sender'], 'content': row['content']} for row in rows]

        if not messages:
            return jsonify({"error": "Session not found or has no messages"}), 404

        return jsonify(messages)
    except Exception as e:
        current_app.logger.error(f"Error fetching history for session {session_id}: {e}")
        return jsonify({"error": "An internal error occurred while fetching session history."}), 500

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    """Fetches a summary of all chat sessions."""
    threads = defaultdict(list)
    
    if chroma_connected:
        try:
            # This is less efficient in Chroma as we have to pull everything and process it.
            # For a production system with many messages, a different approach would be needed.
            results = chroma_collection.get(include=["metadatas", "documents"])
            all_messages = []
            for i, doc_id in enumerate(results['ids']):
                meta = results['metadatas'][i]
                all_messages.append({
                    'session_id': meta['session_id'],
                    'sender': meta['sender'],
                    'content': results['documents'][i],
                    'timestamp': datetime.fromisoformat(meta['timestamp'])
                })
            
            sorted_messages = sorted(all_messages, key=lambda x: x['timestamp'])
            for msg in sorted_messages:
                threads[msg['session_id']].append(msg)

        except Exception as e:
            current_app.logger.error(f"Failed to fetch sessions from ChromaDB: {e}")
            return jsonify({"error": "Failed to fetch sessions"}), 500
    else:
        db = get_db()
        messages = db.execute('SELECT session_id, sender, content, timestamp FROM messages ORDER BY timestamp ASC').fetchall()
        for msg in messages:
            threads[msg['session_id']].append(dict(msg))

    # Sort threads by the timestamp of the LAST message
    sorted_threads = sorted(
        threads.items(),
        key=lambda item: item[1][-1]['timestamp'],
        reverse=True
    )

    # Create summaries
    sessions_summary = []
    for session_id, messages in sorted_threads:
        # Find the first user message for the summary
        first_user_message = next((m['content'] for m in messages if m['sender'] == 'user'), 'Chat session')
        summary_text = (first_user_message[:50] + '...') if len(first_user_message) > 50 else first_user_message
        
        sessions_summary.append({
            'session_id': session_id,
            'summary': summary_text,
            'last_updated': messages[-1]['timestamp']
        })

    return jsonify(sessions_summary)


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
        page_title="Chat History | AI Think Chat",
        page_id="health",
        header_title="📚 Chat History",
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

@app.route('/delete_all_threads', methods=['DELETE'])
def delete_all_threads():
    """Deletes all messages from the database."""
    try:
        if chroma_connected:
            # This is a destructive operation. A safer way would be to delete and recreate the collection.
            # For now, we fetch all IDs and delete them.
            results = chroma_collection.get()
            if results['ids']:
                chroma_collection.delete(ids=results['ids'])
        else:
            db = get_db()
            db.execute('DELETE FROM messages')
            db.commit()
        current_app.logger.info("User deleted all threads.")
        return jsonify({"success": True, "message": "All threads deleted."})
    except Exception as e:
        current_app.logger.error(f"Error deleting all threads: {e}")
        return jsonify({"success": False, "error": "An internal error occurred."}), 500

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
    searxng_status = "Connected" if check_searxng_connection() else "Disconnected"

    # Create a map of model values to their display names for the health page
    model_name_map = {}
    local_models = get_ollama_models()
    for model in local_models:
        model_name_map[model['name']] = model['name']

    cloud_models = get_cloud_models()
    for model in cloud_models:
        # The value is 'cloud::' + id, the name is 'service / model_name'
        key = f"cloud::{model['id']}"
        name = f"{model['service']} / {model['model_name']}"
        model_name_map[key] = name
    
    return render_template(
        'health.html',
        status=overall_status,
        page_title="System Health | AI Think Chat",
        page_id="health",
        header_title="🏥 System Health Dashboard",
        cpu={"count": cpu_count, "percent": cpu_percent},
        memory=memory,
        disk=disk,
        gpu_info=gpu_info,
        ollama_status=ollama_status,
        ollama_model=OLLAMA_MODEL,
        langfuse_enabled=langfuse_enabled,
        chroma_connected=chroma_connected, # Add a comma here
        searxng_status=searxng_status,
        model_name_map=model_name_map
    )

@app.route('/models')
def models_hub():
    """Render the models hub page."""
    ollama_status = "Connected" if check_ollama_connection() else "Disconnected"
    return render_template(
        'models.html',
        page_title="Models Hub | AI Think Chat",
        page_id="models",
        header_title="📦 Models Hub",
        nav_links=[{"href": "/cloud_models", "title": "Cloud Models", "icon": "cloud"}],
        ollama_status=ollama_status
    )

@app.route('/api/models', methods=['GET'])
def api_get_models():
    """API endpoint to get local Ollama models."""
    if not check_ollama_connection():
        return jsonify({"error": "Ollama service is not available."}), 503
    try:
        # Get models from Ollama API
        api_response = requests.get(f"{OLLAMA_BASE_URL}/api/tags")
        api_response.raise_for_status()
        api_models = api_response.json().get("models", [])
        
        # Get active status from our DB
        local_models_from_db = get_ollama_models()
        active_status_map = {m['name']: m['active'] for m in local_models_from_db}
        
        # Combine API data with our active status
        for model in api_models:
            model['active'] = active_status_map.get(model['name'], True)

        return jsonify({"models": api_models})
    except (requests.RequestException, Exception) as e:
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

@app.route('/api/models/delete/all', methods=['POST'])
def api_delete_all_models():
    """API endpoint to delete all local models."""
    if not check_ollama_connection():
        return jsonify({"error": "Ollama service is not available."}), 503

    try:
        # First, get the list of all local models
        list_response = requests.get(f"{OLLAMA_BASE_URL}/api/tags")
        list_response.raise_for_status()
        models = list_response.json().get("models", [])

        # Iterate and delete each model
        for model in models:
            model_name = model.get('name')
            if model_name:
                requests.delete(f"{OLLAMA_BASE_URL}/api/delete", json={"name": model_name})
        
        return jsonify({"status": "success", "message": "All models are being deleted."}), 200
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
            'langfuse_enabled': 'langfuse_enabled' in request.form,
            'chroma_api_key': request.form.get('chroma_api_key', ''),
            'chroma_tenant': request.form.get('chroma_tenant', ''),
            'chroma_database': request.form.get('chroma_database', ''),
            'chromadb_enabled': 'chromadb_enabled' in request.form,
            'searxng_url': request.form.get('searxng_url', ''),
            'searxng_enabled': 'searxng_enabled' in request.form
        }
        save_settings(settings_to_save)
        current_app.logger.info(f"Settings updated: {request.form.to_dict()}")
        # Re-initialize services with new settings
        initialize_langfuse()
        initialize_chroma()
        return redirect(url_for('settings'))

    # Get current settings
    current_settings = get_settings()
    
    return render_template('settings.html',  page_title="Settings | AI Think Chat", page_id="settings", header_title="⚙️ Settings", settings=current_settings)

# --- Prompt Hub Endpoints ---

@app.route('/prompts')
def prompts_hub():
    """Render the prompts hub page."""
    return render_template(
        'prompts.html',
        page_title="Prompt Hub | AI Think Chat",
        page_id="prompts",
        header_title="🚀 Prompt Hub"
    )

@app.route('/api/prompts', methods=['GET'])
def api_get_prompts():
    """API endpoint to get all prompts."""
    try:
        db = get_db()
        prompts_cursor = db.execute('SELECT id, title, type, content, timestamp FROM prompts ORDER BY timestamp DESC').fetchall()
        prompts = [dict(row) for row in prompts_cursor]
        return jsonify(prompts)
    except Exception as e:
        current_app.logger.error(f"Error fetching prompts: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/prompts/create', methods=['POST'])
def api_create_prompt():
    """API endpoint to create a new prompt."""
    data = request.get_json()
    title = data.get('title')
    prompt_type = data.get('type')
    content = data.get('content')

    if not all([title, prompt_type, content]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        db = get_db()
        cursor = db.execute('INSERT INTO prompts (title, type, content) VALUES (?, ?, ?)', (title, prompt_type, content))
        db.commit()
        return jsonify({"success": True, "id": cursor.lastrowid}), 201
    except Exception as e:
        current_app.logger.error(f"Error creating prompt: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/prompts/update/<int:prompt_id>', methods=['POST'])
def api_update_prompt(prompt_id):
    """API endpoint to update an existing prompt."""
    data = request.get_json()
    title = data.get('title')
    prompt_type = data.get('type')
    content = data.get('content')

    if not all([title, prompt_type, content]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        db = get_db()
        db.execute('UPDATE prompts SET title = ?, type = ?, content = ? WHERE id = ?', (title, prompt_type, content, prompt_id))
        db.commit()
        return jsonify({"success": True, "id": prompt_id})
    except Exception as e:
        current_app.logger.error(f"Error updating prompt {prompt_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/prompts/delete/<int:prompt_id>', methods=['DELETE'])
def api_delete_prompt(prompt_id):
    db = get_db()
    db.execute('DELETE FROM prompts WHERE id = ?', (prompt_id,))
    db.commit()
    return jsonify({'success': True})

# --- Cloud Model Endpoints ---

@app.route('/cloud_models')
def cloud_models_page():
    """Render the Cloud Models management page."""
    return render_template(
        'cloud_models.html',
        page_title="Cloud Models | AI Think Chat",
        page_id="cloud_models",
        header_title="☁️ Cloud Model Management"
    )

@app.route('/api/cloud_models', methods=['GET'])
def api_get_cloud_models():
    """API endpoint to get all configured cloud models."""
    try:
        models = get_cloud_models()
        # For the API, we'll return a partial key for display purposes
        for model in models:
            if model.get('api_key'):
                model['api_key_partial'] = f"***{model['api_key'][-4:]}"
            del model['api_key'] # Don't send the full key to the client
            model['active'] = bool(model.get('active', True)) # Ensure boolean type
        return jsonify(models)
    except Exception as e:
        current_app.logger.error(f"Error fetching cloud models: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/cloud_models/<int:model_id>', methods=['GET'])
def api_get_cloud_model_details(model_id):
    """API endpoint to get full details for a single cloud model, including the API key."""
    try:
        db = get_db()
        model_row = db.execute('SELECT * FROM cloud_models WHERE id = ?', (model_id,)).fetchone()
        if not model_row:
            return jsonify({"error": "Model not found"}), 404
        return jsonify(dict(model_row))
    except Exception as e:
        current_app.logger.error(f"Error fetching details for cloud model {model_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/cloud_models/create', methods=['POST'])
def api_create_cloud_model():
    """API endpoint to create a new cloud model configuration."""
    data = request.get_json()
    service = data.get('service')
    base_url = data.get('base_url')
    api_key = data.get('api_key')
    model_name = data.get('model_name')

    if not all([service, base_url, api_key, model_name]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        db = get_db()
        cursor = db.execute('INSERT INTO cloud_models (service, base_url, api_key, model_name) VALUES (?, ?, ?, ?)',
                            (service, base_url, api_key, model_name))
        db.commit()
        return jsonify({"success": True, "id": cursor.lastrowid}), 201
    except Exception as e:
        current_app.logger.error(f"Error creating cloud model: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/cloud_models/update/<int:model_id>', methods=['POST'])
def api_update_cloud_model(model_id):
    """API endpoint to update an existing cloud model configuration."""
    data = request.get_json()
    
    # Only update fields that are provided
    updates = {k: v for k, v in data.items() if v is not None and k in ['service', 'base_url', 'api_key', 'model_name']}
    
    if not updates:
        return jsonify({"error": "No fields to update"}), 400
    # If api_key is empty, it means the user didn't want to change it.
    # We should not update it to an empty string.
    if 'api_key' in updates and not updates['api_key']:
        del updates['api_key']

    set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
    values = list(updates.values()) + [model_id]

    try:
        db = get_db()
        db.execute(f'UPDATE cloud_models SET {set_clause} WHERE id = ?', tuple(values))
        db.commit()
        return jsonify({"success": True, "id": model_id})
    except Exception as e:
        current_app.logger.error(f"Error updating cloud model {model_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/cloud_models/delete/<int:model_id>', methods=['DELETE'])
def api_delete_cloud_model(model_id):
    """API endpoint to delete a cloud model configuration."""
    try:
        db = get_db()
        db.execute('DELETE FROM cloud_models WHERE id = ?', (model_id,))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        current_app.logger.error(f"Error deleting cloud model {model_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/cloud_models/toggle_active/<int:model_id>', methods=['POST'])
def api_toggle_cloud_model_active(model_id):
    """API endpoint to toggle the active state of a cloud model."""
    data = request.get_json()
    is_active = data.get('active')

    if is_active is None:
        return jsonify({"error": "Missing 'active' field"}), 400

    db = get_db()
    db.execute('UPDATE cloud_models SET active = ? WHERE id = ?', (is_active, model_id))
    db.commit()
    current_app.logger.info(f"Toggled active state for cloud model {model_id} to {is_active}")
    return jsonify({'success': True})

@app.route('/api/local_models/toggle_active', methods=['POST'])
def api_toggle_local_model_active():
    """API endpoint to toggle the active state of a local model."""
    data = request.get_json()
    name = data.get('name')
    is_active = data.get('active')

    if not name or is_active is None:
        return jsonify({"error": "Missing 'name' or 'active' field"}), 400

    db = get_db()
    db.execute('UPDATE local_models SET active = ? WHERE name = ?', (is_active, name))
    db.commit()
    current_app.logger.info(f"Toggled active state for local model {name} to {is_active}")
    return jsonify({'success': True})

# Langfuse flush on app shutdown
@app.teardown_appcontext
def flush_langfuse(error):
    if langfuse_enabled:
        try:
            langfuse.flush()
        except Exception as e:
            current_app.logger.warning(f"Error flushing Langfuse: {e}")