import os
from app import app

if __name__ == '__main__':
    # Use an environment variable to control debug mode
    # Example: export FLASK_DEBUG=1
    debug_mode = os.environ.get('FLASK_DEBUG', 'true').lower() in ['true', '1', 't']
    app.run(host='0.0.0.0', port=1111, debug=debug_mode, threaded=True)