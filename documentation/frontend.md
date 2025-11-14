# frontend.md

### Comprehensive Frontend Development Notes

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

* Created in JS.
* Click scrolls to the message.
* Shows snippet on hover.

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

## 3.5 Thread Marker Bar

Right side vertical bar with clickable markers.

```css
#thread-marker-bar {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
}
```

JS populates the markers.

---

## 3.6 Cards (Dashboard / Settings)

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

## 3.7 Tables

Scrollable container with sticky headers.

Used in:

* Models
* Cloud Models
* Usage
* Dashboard statistics

---

## 3.8 Forms & Modals

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