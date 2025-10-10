"""
Gunicorn configuration file for the AI Think application.

To run the application with this configuration:
gunicorn --config gunicorn_config.py app:app
"""

import multiprocessing
import os

# Bind to an interface & port (fallback to 5000)
bind = f"0.0.0.0:{os.getenv('PORT', '5000')}"

# Maximum number of pending connections
backlog = 2048

# Worker processes: (2 × CPU) + 1 is a reasonable starting point
workers = multiprocessing.cpu_count() * 2 + 1

# Since your app is I/O-bound (talking to Ollama, APIs, DB), use threads
worker_class = 'gthread'
threads = 2  # you can experiment with 2, 4, 8 depending on load

# Auto-restart workers to avoid memory leaks
max_requests = 1000
max_requests_jitter = 50

# Timeout settings (make sure this covers your slowest workloads)
timeout = 360
graceful_timeout = 60

# Preload app before forking (saves memory and speeds up startup of workers)
preload_app = True

# Logging
accesslog = '-'   # stdout
errorlog = '-'    # stderr
loglevel = os.getenv('LOG_LEVEL', 'info')

# PID file (useful for supervisors)
pidfile = os.getenv('GUNICORN_PID_FILE', 'gunicorn.pid')

# Optional: Worker affinity or CPU pinning (if you want each worker on a CPU)
# worker_cpu_affinity = "0-3"  # example for 4 cores

# Optional: SSL settings (if Gunicorn handles TLS directly, but usually proxy handles TLS)
# keyfile = '/path/to/ssl.key'
# certfile = '/path/to/ssl.crt'
