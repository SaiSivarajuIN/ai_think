# frontend documentation

### (JavaScript + CSS Internals)

---

# 1. Overview

The frontend uses vanilla HTML, CSS, and JavaScript with minimal external libraries (Showdown, Highlight.js, MathJax).
Each page loads its own `*.js` file and extends a shared `base.html`.
All JavaScript is written in modular, page-specific patterns wrapped in `DOMContentLoaded`.

This documentation covers all JS logic and the entire CSS system.

---

# 2. JavaScript Modules (Detailed)

---

## 2.1 script.js (Chat Page Logic)

This is the largest and most complex script. It implements the entire chat experience.

### Major Responsibilities

* Rendering user, system, and assistant messages.
* Markdown transformation using Showdown.
* LaTeX processing using MathJax.
* Syntax highlighting using Highlight.js.
* File uploads (text + image), preview, and download.
* Conversation history state.
* Streaming assistant responses using fetch reader.
* Thread markers (right-side vertical bar).
* Search mode toggle + state stored in localStorage.
* Incognito mode toggle + state saved.
* Model and prompt selector behavior.
* Scroll management for long chats.
* Inline message editing (for user messages).
* Adding copy buttons to code blocks.

### Key Sections

#### A. Markdown + LaTeX Formatting

`formatMessage(text)`:

* Protects LaTeX blocks by temporarily replacing them with tokens.
* Converts Markdown via Showdown.
* Restores LaTeX.
* Supports:

  * Inline LaTeX: `$...$`, `\(...\)`
  * Display LaTeX: `$$...$$`, `\[...\]`
  * Matrix environments.

#### B. Rendering Messages

`addMessage(content, sender, id)`:

* Creates user, bot, or system message containers.
* Renders file uploads using `<details>`.
* Renders Markdown and LaTeX.
* Adds footer (copy, edit, regenerate).
* Stores raw full content in dataset for history + regenerate functionality.
* Auto-scrolls to bottom.
* Syntax-highlights code blocks and inserts copy buttons.

#### C. Thinking Placeholder

During streaming:

* A temporary message is added with CSS animation.
* Replaced with final assistant reply via `handleBotResponse()`.

#### D. Conversation History

* Stored in memory (`conversationHistory`) while user is active.
* Saved to backend unless Incognito mode is active.
* User queries that used "Search Mode" have a hidden metadata block.

#### E. Search Mode

* Toggled via button.
* Stored in `localStorage.isSearchModeActive`.
* Changes the UI of the send button.
* Ensures user input is cleared when turning on or off.

#### F. Incognito Mode

* Toggles with icon and title update.
* Saved in localStorage as `isIncognito`.
* On enable: clears thread ID, history won't be saved.

#### G. Code Block Copy Buttons

`addCopyButtonsToCodeBlocks(container)`:

* Inserts copy button into each `<pre><code>`.
* Prevents duplicates.
* Provides feedback (icons switch to "done").

#### H. File Upload Rendering

Supports:

* Images (base64 preview)
* Text and other files (content displayed in `<pre><code>`)

System messages for file uploads expand/collapse via `<details>`.

#### I. Thread Marker Bar

Adds vertical markers on the right side of viewport, tied to each message’s scroll position:

* Created in JS beside the scrollable chat area.
* Automatically rebuilds when messages change.
* Distinguishes user, assistant, and system/file-context messages.
* Highlights the marker nearest the current viewport center.
* Click scrolls smoothly to the message.
* Hidden on small screens.

---

## 2.2 cloud_models.js (Cloud Model Configuration Manager)

Controls cloud model CRUD operations, grouping, display, and activation states.

### Responsibilities

* Load models via `/api/cloud_models`.
* Group models by `service + base_url`.
* Render models table.
* Render services sidebar list.
* Modal for:

  * Creating models
  * Editing existing models
* Dynamic input fields for multiple model names.
* Copy buttons for API key and base URL.
* Toggle activation:

  * Single model
  * All models
* Persist selected service in localStorage (`cloud_models.selected_service`).

### Modal Logic

* On create: reset all fields, show single empty model name input.
* On edit: populate values, create input fields for all names.
* Custom service field appears when service === "Other".

### Rendering

`renderModels()` creates table rows:

* Service name
* List of model names
* Base URL + copy
* Partial API key + copy
* Activation toggle
* Edit/delete buttons

### API Communication

* Create → `/api/cloud_models/create`
* Update → `/api/cloud_models/update/:id`
* Delete → `/api/cloud_models/delete/:id`
* Toggle active → `/api/cloud_models/toggle_active/:id`
* Toggle all → `/api/cloud_models/toggle_all_active`

---
### Service Logo Rendering

The backend provides a `logo_filename` for each service, based on the mapping in `cloud_logos.csv`. The `cloud_models.js` script uses this filename to construct the path to the logo image.

*   **Path**: The script assumes all logos are located in `/static/logos/`.
*   **Rendering**: When `renderModels()` is called, it generates an `<img>` tag with a source like `static/logos/openai.png` and places it next to the service name in the table and sidebar.
*   **Fallback**: If a logo filename is not provided by the API, no image is rendered. Fallback to `ollama.png`.

---

## 2.3 models.js (Local/Ollama Models Manager)

Controls installed local models via backend API.

### Responsibilities

* Fetch all local models via `/api/models`.
* Render model list with:

  * Name
  * Size (GB)
  * Modified date (timeAgo)
  * Activation switch
  * Delete button
* Pull models using `/api/models/pull` with streaming JSON.
* Delete model via `/api/models/delete`.
* Toggle model active/inactive.
* Toggle all models active/inactive.

### Pull Progress Streaming

Ollama returns streamed JSON lines:

```
{ status, completed, total }
```

Frontend:

* Updates progress bar width.
* Updates status messages.
* Automatically hides progress area shortly after completion.

---

## 2.4 prompts.js (Prompt Hub)

Manages CRUD operations for user-created prompts.

### Responsibilities

* Load all prompts.
* Grid layout with prompt cards.
* Modal for:

  * Creating prompts
  * Editing prompts
* Delete prompts.
* Icons per prompt type.

### Rendering

`renderPrompts(prompts)`:

* Creates `.prompt-card`
* Inserts title, icon, content preview.
* Adds Edit/Delete buttons.

### API

* GET `/api/prompts`
* POST `/api/prompts/create`
* POST `/api/prompts/update/:id`
* DELETE `/api/prompts/delete/:id`

---

## 2.5 usage.js (Usage Dashboard Logic)

Displays API usage per selected timeframe.

### Responsibilities

* Fetch usage data via `/api/usage?range=X`.
* Ranges: 1d, 7d, 30d, 90d, all.
* Render table rows with:

  * model_name
  * category badge
  * truncated session ID
  * input tokens
  * output tokens
  * time ago

### Utility

`timeAgo(date)` used for timestamps.

---

# 3. CSS Architecture (style.css in detail)

The CSS system is theme-based, responsive, and modern.
All design tokens are defined in `:root`, with dark mode overrides.

---

## 3.1 Theme Variables

### Light Theme

```css
:root {
  --primary: #000;
  --text: #111827;
  --background: #fff;
  --card: #f9fafb;
  --border: #e5e7eb;
  --radius-sm: .375rem;
  --radius-md: .75rem;
  --radius-lg: 1rem;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
  --shadow-lg: 0 12px 24px rgba(0,0,0,0.12);
}
```

### Dark Theme

Activated by:

```html
<body class="dark-theme">
```

---

## 3.2 Layout

### Page Container

```css
.page-container {
  display: flex;
  height: 100vh;
}
```

### Sidebar

* Fixed width
* Uses `<details>` accordion for sections
* Collapsible using class applied from JS (via localStorage)

### Main Content Wrapper

Contains:

* Header
* Page content (scrollable)
* Chat input (fixed bottom)

---

## 3.3 Messaging System Styles

### Message Bubbles

```css
.message {
  padding: .75rem 1.25rem;
  border-radius: var(--radius-lg);
  max-width: 80%;
}
.user-message { background: black; color: white; }
.bot-message  { background: var(--message-assistant); }
```

### System Messages

Using `<details>` collapse styling.

### Code Blocks

`pre code` styled + copy button added by JS.

### Copy Code Button

Absolute positioned inside `<pre>`.

---

## 3.4 Input Area

### Wrapper

```css
.input-area {
  display: flex;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
}
```

### Textarea (contenteditable)

* Multi-line
* Auto scroll
* Placeholder using `:empty:before`

### Send button

Circular:

```css
.send-button {
  width: 44px;
  height: 44px;
  border-radius: 50%;
}
```

Stop button is red variant.

---

## 3.5 Cards (Dashboard / Settings)

Reusable layout:

```css
.card {
  background: linear-gradient(135deg, var(--card), var(--background));
  border-radius: 1rem;
  box-shadow: var(--shadow-md);
}
```

Used across Dashboard, Settings, About, Health, Prompts.

---

## 3.6 Tables

Scrollable container with sticky headers.

Used in:

* Models
* Cloud Models
* Usage
* Dashboard statistics

---

## 3.7 Forms & Modals

### Modals

`position: fixed; background rgba(0,0,0,0.5);`

### Form Groups

```css
.form-group {
  display: flex;
  flex-direction: column;
  gap: .5rem;
}
```

### Toggles

Custom switch:

```css
.switch { position: relative; width: 50px; height: 28px; }
.slider.round { border-radius: 34px; }
```

---

# 4. External Libraries Used

### Showdown.js

Markdown → HTML

### MathJax

LaTeX rendering

### Highlight.js

Code syntax highlighting

### Google Fonts: Inter

Base typography

### Material Icons

UI icons for buttons

No frontend frameworks (React/Vue/Angular) are used.

---

# 5. Summary

This frontend is built using clean and maintainable vanilla JavaScript with a highly structured CSS theme system.
Pages are isolated by script files, and all dynamic UI elements follow clear rendering patterns.
The chat page contains the most advanced logic with Markdown, LaTeX, streaming, and file embedding.

---

# 6. Current Feature Additions and Implementation Notes

This section documents newer frontend behavior present in the current templates and JavaScript files without removing the older documentation above.

---

## 6.1 Chat Page Additions (`static/script.js` + `templates/index.html`)

### Persistent Model Selection

The model selector stores the last selected model in:

```text
localStorage.selectedModel
```

On page load, the selector restores that value when it is still present in the rendered options.

### Search Mode State

The search button toggles:

```text
localStorage.isSearchModeActive
```

When active, the next message is sent as a search-backed request. The UI clears the input when search mode is toggled so stale text does not accidentally get sent with a changed mode.

### Incognito State

Incognito mode is stored in:

```text
localStorage.isIncognito
```

When enabled:

- The icon changes to `visibility_off`.
- The URL is updated with `?incognito=true`.
- The current thread is reset.
- Search mode is turned off.
- The backend is told not to persist or trace the generation.

### Prompt Selector

Selecting a prompt inserts or replaces the first system message in the in-memory `conversationHistory` array. Selecting the empty prompt option removes the active system prompt.

Prompt activation/deactivation system messages are intentionally hidden from the visible chat UI.

### Upload Flow and OCR-Friendly UX

The upload button triggers the hidden file input and sends the selected file to:

```text
POST /upload
```

During upload, a temporary "Uploading" assistant message is shown. On success, the returned system message is passed through `addMessage()`.

File upload system messages for prompt/file context are not shown in the main chat stream by default, but the raw context remains available to the conversation and history rendering.

The page also includes OCR popup handlers:

- `#ocrPopup`
- `#ocrOk`

The OK button closes the popup and reloads the page.

### Abort / Stop Generation

`script.js` maintains an `AbortController` for in-flight generation. The send button is switched into a stop state while a response is running, allowing the frontend to abort the request.

### Scroll Restoration

Before unload, the script stores:

```text
sessionStorage.scrollPosition
sessionStorage.lastSessionId
```

This supports restoring the scroll position when returning to a session or refreshing the page.

### History Sidebar Actions

The chat page fetches and renders a history sidebar from backend session APIs. Each history item supports:

- Open session.
- Rename session inline.
- Delete session.
- Context menu behavior that closes when clicking elsewhere.

Renames call:

```text
POST /api/session/rename
```

Deletes call:

```text
DELETE /delete_thread/:session_id
```

### Sidebar Keyboard Shortcuts

Global shortcuts are registered in `script.js`:

| Shortcut | Action |
| -------- | ------ |
| `Alt + S` | Toggle main sidebar |
| `Alt + H` | Toggle history sidebar |
| `Alt + N` | Toggle incognito mode |

### Welcome Screen State

`templates/index.html` uses:

```text
localStorage.hasVisited
```

to avoid showing the welcome screen after the first visit.

### Custom Select Controls

`templates/index.html` enhances native selects into custom dropdown controls that support:

- Provider/model grouping.
- Logo HTML from option data attributes.
- Viewport-aware dropdown positioning.
- Escape-to-close behavior.
- Repositioning on scroll and resize.

---

## 6.2 History Page Additions (`templates/history.html`)

The history page includes a larger inline script for browsing, filtering, rendering, deleting, and exporting conversations.

### Search and Date Filtering

History filters are applied by rebuilding the current URL query string.

Supported query params:

- `search`
- `start_date`
- `end_date`
- `page`

The custom date modal supports:

- Start date.
- End date.
- Clear date.
- Apply date.
- Escape-to-close.
- Click-outside-to-close.

### Message Rendering

History rendering preserves the chat formatting stack:

- Markdown via Showdown.
- LaTeX preservation and MathJax rendering.
- Highlighted code blocks.
- Copy buttons for code blocks.
- File and image upload previews.
- Download buttons for uploaded files/images.

### Thought and Search Blocks

The history renderer recognizes:

- `<think>...</think>` blocks and renders them as collapsible thought sections.
- Search-augmented prompts and renders the embedded search results separately from the user's visible question.

### Delete Controls

History supports:

- `DELETE /delete_message/:id` for single messages.
- `DELETE /delete_thread/:session_id` for a full thread.
- `DELETE /delete_all_threads` for all threads.

The UI removes deleted items optimistically after successful responses.

### Export Controls

The delegated download handlers support:

- PDF export through `html2pdf`.
- Word-compatible `.doc` export through generated HTML and Blob download.

Exports clone the existing thread DOM, remove action buttons, preserve rendered formatting where possible, and add a generated timestamp.

---

## 6.3 Cloud Models Page Additions (`static/cloud_models.js` + `templates/cloud_models.html`)

### Service URL Auto-Fill

`templates/cloud_models.html` fetches:

```text
GET /api/cloud_models/service_url_map
```

When the user selects a known provider, the base URL input is filled from `data/cloud_api.csv`.

### Service Logo Options

The cloud service select uses option-level `data-logo` HTML. `cloud_models.js` builds a `serviceLogoMap` from those attributes and uses it in:

- The services sidebar.
- The service detail panel.

### Grouped Service Model

Although the backend stores one row per model name, the frontend groups models by:

```text
service + "::" + base_url
```

Grouped records expose a `model_names` array in the UI.

### Service Sidebar and Detail Panel

The page now includes a service-oriented layout:

- Filterable services list.
- Active/inactive status dots.
- Persisted selected service:

```text
localStorage.cloud_models.selected_service
```

- Detail card with service, status, base URL, API key, and model list.
- Header toggle for enabling/disabling the selected service group.

### Inline Model Name Management

Inside the detail panel:

- Existing model names are displayed as rows.
- Individual model names can be deleted as long as at least one remains.
- The Add flow opens an inline popup.
- Existing names can be marked for removal.
- New names can be added in multiple fields.
- Duplicate names are removed before save.

All changes are saved through:

```text
POST /api/cloud_models/update/:id
```

### API Key Handling

The list endpoint only exposes masked API keys. When the user copies a key, the frontend calls:

```text
GET /api/cloud_models/:id
```

The returned full key is cached in memory for that page session only.

### Column Resizing

The cloud models table adds draggable `.resizer` handles to header cells and updates column widths during mouse movement.

---

## 6.4 Local Models Page Additions (`static/models.js` + `templates/models.html`)

### Pull Card Collapse State

The model pull card stores collapsed state in:

```text
localStorage.pullModelCardCollapsed
```

### Duplicate Pull Guard

`templates/models.html` includes a guard that compares the requested model name with the visible local model table before starting a pull, helping avoid duplicate pulls from the UI.

### Pull Streaming

`models.js` reads the streamed response from:

```text
POST /api/models/pull
```

It parses newline-delimited JSON chunks and updates:

- Status text.
- Progress bar width when `completed` and `total` are present.
- The model table after completion.

### Activation Toggles

The page supports:

- Per-model active toggles through `POST /api/local_models/toggle_active`.
- Master active toggle through `POST /api/local_models/toggle_all_active`.

The master toggle reflects whether all visible model toggles are enabled.

### Delete All Models

The delete-all button calls:

```text
POST /api/models/delete/all
```

The UI waits briefly before refreshing the table because Ollama deletion can lag behind the API response.

---

## 6.5 Settings Page Additions (`templates/settings.html`)

Settings now support route-backed tabs:

```text
/settings
/settings/:tab_name
```

The tab script:

- Updates visible tab content.
- Pushes the current tab into browser history.
- Restores tab state on browser back/forward with `popstate`.
- Submits an `active_tab` value so the backend can redirect back to the tab the user edited.

---

## 6.6 Health Page Additions (`templates/health.html`)

The health page reads the selected model from:

```text
localStorage.selectedModel
```

It maps that value through backend-provided `model_name_map`, falling back to the default model when no local selection is stored.

---

## 6.7 Dashboard Page Additions (`templates/dashboard.html`)

The dashboard is rendered server-side from `GET /dashboard` rather than the older `usage.js` `/api/usage` flow.

Current dashboard ranges include:

- `5m`
- `15m`
- `30m`
- `1h`
- `1d`
- `7d`
- `28d`
- `90d`
- Custom start/end dates

The page displays session/message totals, token totals, peak RPM/TPM/RPD metrics, model call counts, and recent usage rows.

---

## 6.8 Additional Frontend Libraries

In addition to Showdown, Highlight.js, MathJax, Google Fonts, and Material Icons, current history export behavior can use:

- `html2pdf` for PDF export.
- Browser Blob/Object URL APIs for Word-compatible `.doc` export and uploaded file downloads.

---

## 6.9 State Storage Summary

| Key | Storage | Purpose |
| --- | ------- | ------- |
| `selectedModel` | `localStorage` | Last selected chat model and health-page active model display. |
| `isSearchModeActive` | `localStorage` | Search mode button state. |
| `isIncognito` | `localStorage` | Incognito mode state. |
| `sidebarCollapsed` | `localStorage` | Main sidebar collapsed state. |
| `cloud_models.selected_service` | `localStorage` | Last selected cloud service group. |
| `pullModelCardCollapsed` | `localStorage` | Models page pull-card collapsed state. |
| `hasVisited` | `localStorage` | Welcome screen suppression. |
| `scrollPosition` | `sessionStorage` | Chat scroll restoration. |
| `lastSessionId` | `sessionStorage` | Session-aware scroll restoration. |
