# AI Think –  Frontend Developer Documentation

---

## Overview

AI Think is a modular web-based interface for managing and interacting with local and cloud-based AI models. The system is built with Flask on the backend, Jinja2 for templating, and modular JavaScript for dynamic interactivity. It uses a consistent HTML structure defined in `base.html` and shares global styling from `style.css`.

---

## HTML Templates

### base.html

Master layout defining:

* Sidebar navigation and header
* CSS and JS imports
* Theming via `dark-theme` class
* Template blocks for content and scripts:

  * `title`, `head_extra`, `content`, `after_content`, `page_scripts`

---

### index.html

Primary chat interface.

**Features**

* Chat conversation area
* Markdown + LaTeX rendering
* File upload support
* Image upload with client-side display and download
* Model selector
* Prompt selector
* Search and incognito mode toggles

**Scripts**

* Uses `script.js` for rendering messages, streaming replies, and managing chat context.

---

### dashboard.html

Displays usage statistics and performance metrics.

**Features**

* API usage and model performance table
* Filters for daily, weekly, monthly usage
* Uses `usage.js` for dynamic charting and data refresh

---

### models.html

Local model management.

**Features**

* Fetch local models
* Pull new models from Ollama
* Delete and toggle active models
* Show progress during downloads

**Scripts**

* `models.js` handles CRUD operations and UI updates.

---

### cloud_models.html

Cloud model configuration.

**Features**

* Add/edit cloud model configurations (OpenAI, Groq, Anthropic, etc.)
* Add multiple models per provider
* Toggle activation
* Copy and delete configurations

**Scripts**

* `cloud_models.js` manages API interactions and UI modals.

---

### prompts.html

Prompt management hub.

**Features**

* Add, edit, delete prompts
* Categorized by type (Text, Code, Creative, Research)
* Uses a modal for editing
* Dynamically updated without page reload

**Scripts**

* `prompts.js` controls modal logic, CRUD operations, and card rendering.

---

### history.html

Displays chat history and session management.

**Features**

* View and expand past conversations
* Search and filter by date or keyword
* Supports Markdown and LaTeX rendering

---

### settings.html

User settings and integrations.

**Features**

* Adjust model parameters (`temperature`, `top_p`, etc.)
* Configure API integrations
* Uses tabbed interface for better UX

---

### health.html

System and backend monitoring dashboard.

**Features**

* Displays system resource usage (CPU, RAM, GPU)
* Monitors backend service status (Ollama, Langfuse, ChromaDB)
* Uses dynamic color indicators for connected/disconnected states

---

### about.html

Informational page outlining:

* Project overview
* Key features
* License and credits

---

## JavaScript Files

### script.js

Central logic for the chat interface.

**Core Functions**

* Message handling (add, render, and format messages)
* Markdown and LaTeX rendering via Showdown and MathJax
* Code highlighting and copy functionality via Highlight.js
* Manages incognito mode, search mode, and thread resets
* Manages fetch requests and handles streaming model responses
* Handles image and text file uploads, displaying them in a collapsible summary

**Utilities**

* `escapeHTML()`: Safely escapes user input
* `formatMessage()`: Handles Markdown + MathJax rendering
* `addMessage()`: Adds user and bot messages to the chat
* `sendMessage()`: Sends prompts to the backend
* `handleBotResponse()`: Updates UI with model replies
* `resetThread()`: Resets current conversation context

---

### models.js

Local model management logic.

**Features**

* Fetch and list available models
* Pull new models with streaming progress updates
* Delete models
* Toggle active state for local models

**Key Functions**

* `fetchModels()`: Retrieves and renders models
* `pullModel()`: Streams model download progress
* `deleteModel()`: Removes local models
* `toggleActive()`: Enables/disables a specific model
* `toggleAllActive()`: Applies active state to all models

---

### cloud_models.js

Cloud model configuration manager.

**Features**

* Modal-based form for adding or editing providers
* Dynamic input for model names and API keys
* Activation toggles per model
* Delete, copy, and fetch model configurations

**Key Functions**

* `openModalForCreate()`, `openModalForEdit()`: Manage modal state
* `fetchModels()`: Fetches cloud models from API
* `saveModel()`: Submits configuration to backend
* `deleteModel()`: Deletes configuration
* `toggleActive()`, `toggleAllActive()`: Enable or disable services
* `copyKey()`: Securely copies stored API keys

---

### prompts.js

Prompt management interface logic.

**Features**

* Load, create, and edit prompt templates
* Uses modal for CRUD operations
* Renders prompt cards dynamically

**Key Functions**

* `fetchPrompts()`: Loads prompts from API
* `savePrompt()`: Saves new or updated prompt
* `deletePrompt()`: Removes prompt
* `renderPrompts()`: Renders UI grid for prompts

---

### usage.js

Dashboard usage analytics.

**Features**

* Fetches and displays API usage over time
* Allows switching between daily, weekly, and monthly ranges
* Displays models, token usage, and timestamps

**Key Functions**

* `fetchUsageData(range)`: Retrieves usage records
* `renderUsageData()`: Renders data in table format
* `timeAgo()`: Converts timestamps to human-readable format

---

## CSS (style.css)

### Theming and Variables

Defines color and layout variables for light and dark themes:

```css
:root {
    --primary: #323138;
    --text: #111827;
    --background: #ffffff;
    --card: #f9fafb;
    --border: #e5e7eb;
    --connected: #22c55e;
    --disconnected: #ef4444;
    --radius-md: 0.75rem;
}
body.dark-theme {
    --background: #1a1b1e;
    --text: #f3f4f6;
}
```

### Layout

* `.page-container`: main structure for sidebar + content
* `.sidebar`: collapsible left navigation
* `.main-content-wrapper`: holds header and page content
* `.header`: top navigation and title area
* `.page-content`: scrollable main body

### Chat Styling

* `.message`, `.user-message`, `.bot-message`: message bubbles
* `.thinking`: animation for “model thinking”
* `.message-footer`: holds copy/regenerate buttons and stats
* `.input-area`: user input container with send button

### Forms and Buttons

* `.settings-form`: standardized form layout
* `.toggle-group`: for switch toggles
* `.save-btn`: unified action button style
* `.switch`: custom toggle switch implementation

### Cards and Dashboard

* `.card`: content boxes for stats and info
* `.dashboard`: responsive grid for metrics
* `.status-indicator`: connected/disconnected indicators
* `.status-badge`: visual health states (stable, warning, critical)

### Responsive Design

* Uses `grid-template-columns` and `auto-fit` to adapt layout
* Sidebar collapses on small screens
* Typography scales with viewport width

---

## Common Design Patterns

**Templating**
All pages inherit from `base.html` using Jinja2:

```jinja2
{% extends "base.html" %}
{% block content %}
    <div>Page content here</div>
{% endblock %}
```

**Dynamic Data Binding**
All dynamic data (models, prompts, usage) is fetched from Flask REST APIs and rendered via JavaScript.

**Styling Consistency**
Theme colors, spacing, and shadows defined via CSS variables ensure visual consistency across all pages.

**Modular JS**
Each HTML page uses its own JS module to encapsulate functionality and reduce global scope pollution.

**Image Handling**
Images are uploaded to the backend, which returns a Base64 representation. The frontend then displays the image directly in a collapsible system message, complete with a download button. For multimodal models, the Base64 data is sent along with the next user prompt.

---

## Adding a New Page

1. Create a new HTML file extending `base.html`
2. Add page-specific content in `{% block content %}`
3. Add a JS file for dynamic logic (if needed)
4. Add a route in Flask:

   ```python
   @app.route("/newpage")
   def newpage():
       return render_template("newpage.html", page_title="New Page")
   ```

---

Would you like this documentation formatted as a **Markdown file (README.md)** for repository inclusion? I can produce a properly sectioned version with headings, code fences, and links.
