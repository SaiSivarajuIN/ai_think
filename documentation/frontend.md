# Frontend Developer Documentation

This comprehensive documentation provides detailed step-by-step guidance for understanding and working with the frontend architecture of the AI Chat application.

## Project Overview

The application is a web-based AI chat interface built with vanilla JavaScript, HTML5, and CSS3, featuring real-time messaging, model management, and chat history tracking.

### Technology Stack

- **Frontend Framework**: Vanilla JavaScript (ES6+)
- **Template Engine**: Jinja2 (server-side rendering)
- **Styling**: Custom CSS with CSS Variables for theming
- **Markdown Rendering**: Showdown.js library
- **LaTeX Rendering**: MathJax for mathematical expressions
- **PDF Generation**: html2pdf.js library
- **Icons**: Material Icons


## Architecture \& File Structure

### HTML Files

The application uses a template inheritance pattern with Jinja2:

1. **base.html** - Base template with common structure
2. **index.html** - Main chat interface
3. **history.html** - Chat history and thread management
4. **dashboard.html** - Usage statistics and analytics
5. **models.html** - Local model management
6. **cloud_models.html** - Cloud/API model configuration
7. **settings.html** - Application settings
8. **prompts.html** - Prompt management interface
9. **about.html** - About page
10. **health.html** - System health monitoring

### JavaScript Modules

The application is organized into focused JavaScript modules:

1. **script.js** (64KB) - Core chat functionality
2. **models.js** - Local model management
3. **cloud_models.js** - Cloud model configuration
4. **prompts.js** - Prompt library management
5. **usage.js** - Usage statistics display

### CSS Structure

**style.css** (27KB) - Single comprehensive stylesheet with:

- CSS custom properties for theming
- Responsive layout system
- Component-specific styles
- Dark mode support
- Animation definitions


## Detailed Component Documentation

### CSS Variables \& Theming

The application uses CSS custom properties for consistent theming:

```css
:root {
  --primary: #323138;
  --text: #111827;
  --background: #ffffff;
  --card: #f9fafb;
  --border: #e5e7eb;
  --message-user: #323138;
  --message-assistant: #f3f4f6;
  --theme-toggle-text: #6b7280;
  --connected: #22c55e;
  --disconnected: #ef4444;
  --container-margin: 1.5rem;
  --container-max-width: 1200px;
  --radius-sm: 0.375rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
}
```

**Dark Mode Override**:

```css
body.dark-theme {
  --primary: #323138;
  --text: #f3f4f6;
  --background: #1a1b1e;
  --card: #2a2b2f;
  --border: #374151;
  --message-assistant: #2a2b2f;
}
```


### Layout System

The application uses a **flexbox-based layout** with three main areas:

1. **Sidebar** (180px width, collapsible)
2. **Main Content Area** (flex-grow)
3. **History Sidebar** (250px width, slide-in)
```css
.page-container {
  display: flex;
  flex-direction: row;
  height: 100vh;
  max-width: 1600px;
  margin: 0 auto;
}
```


### Core Chat Interface (script.js)

#### Initialization \& Global Variables

The main script initializes on DOMContentLoaded:

```javascript
document.addEventListener('DOMContentLoaded', function() {
  // DOM element references
  const chatbox = document.getElementById('chatbox');
  const userInput = document.getElementById('userMessage');
  const sendButton = document.getElementById('sendButton');
  const modelSelector = document.getElementById('model-selector');
  
  // State variables
  let conversationHistory = [];
  let thinkingMessageId = null;
  let abortController = null;
  let fileContextActive = false;
  let isIncognito = localStorage.getItem('isIncognito') === 'true';
  
  // Showdown converter for Markdown
  const converter = new showdown.Converter({
    simplifiedAutoLink: true,
    strikethrough: true,
    tables: true,
    tasklists: true,
    simpleLineBreaks: true,
    openLinksInNewWindow: true,
    emoji: true
  });
});
```


#### Message Rendering System

**HTML Escaping for Security**:

```javascript
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """)
    .replace(/'/g, "'");
}
```

**Markdown + LaTeX Rendering**:

The application uses a sophisticated rendering pipeline that protects LaTeX expressions during Markdown conversion:

```javascript
function formatMessage(text) {
  // 1. Protect LaTeX expressions with unique tokens
  const latexMap = new Map();
  let counter = 0;
  
  // Handle display math: \[...\] and $...$
  text = text.replace(/\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g, (match, latex1, latex2) => {
    const token = `%%LATEX${counter}%%`;
    latexMap.set(token, match);
    counter++;
    return token;
  });
  
  // Handle inline math: \(...\) and $...$
  text = text.replace(/\\\(([\s\S]*?)\\\)|\$([^\$\n]*?)\$/g, (match, latex1, latex2) => {
    const token = `%%LATEX${counter}%%`;
    latexMap.set(token, match);
    counter++;
    return token;
  });
  
  // 2. Convert markdown
  let html = converter.makeHtml(text);
  
  // 3. Restore LaTeX expressions
  latexMap.forEach((latex, token) => {
    html = html.replace(token, latex);
  });
  
  return html;
}
```

**Message Display Function**:

```javascript
function addMessage(content, sender = 'bot', messageId = null) {
  const isUser = sender === 'user';
  const isSystem = sender === 'system';
  
  let messageContainer;
  
  if (isSystem) {
    // System messages are collapsible <details> elements
    messageContainer = document.createElement('details');
    messageContainer.className = 'message-container system-message-container';
    messageContainer.open = false;
    
    const summary = document.createElement('summary');
    summary.innerHTML = `<span class="material-icons">info</span> System Message`;
    messageContainer.appendChild(summary);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'history-content file-context-content';
    contentDiv.innerHTML = formatMessage(escapeHtml(content));
    messageContainer.appendChild(contentDiv);
    
  } else {
    // User and bot messages
    messageContainer = document.createElement('div');
    messageContainer.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    
    if (messageId) {
      messageContainer.id = messageId;
    }
    
    // Content rendering with different handling for user vs bot
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';
    contentWrapper.innerHTML = formatMessage(escapeHtml(content));
    messageContainer.appendChild(contentWrapper);
    
    // Add message footer with actions
    const footer = document.createElement('div');
    footer.className = 'message-footer';
    // ... footer buttons (copy, edit, regenerate)
    messageContainer.appendChild(footer);
  }
  
  chatbox.appendChild(messageContainer);
  chatbox.scrollTop = chatbox.scrollHeight;
  
  // Render LaTeX
  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetPromise([messageContainer]);
  }
  
  // Add copy buttons to code blocks
  addCopyButtonsToCodeBlocks(messageContainer);
}
```


#### Streaming Response Handler

The application supports server-sent events (SSE) for streaming responses:

```javascript
async function sendMessage() {
  const message = userInput.textContent.trim();
  if (!message) return;
  
  // Add user message to UI
  addMessage(message, 'user');
  conversationHistory.push({ role: 'user', content: message });
  
  // Clear input
  userInput.textContent = '';
  
  // Add thinking indicator
  thinkingMessageId = `bot-${Date.now()}`;
  addMessage('...', 'bot', thinkingMessageId);
  
  // Change send button to stop button
  sendButton.innerHTML = '<span class="material-icons">stop</span>';
  sendButton.classList.add('stop-button');
  
  // Create abort controller for cancellation
  abortController = new AbortController();
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        model: modelSelector.value,
        history: conversationHistory,
        stream: true
      }),
      signal: abortController.signal
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let botResponse = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          if (data.content) {
            botResponse += data.content;
            updateMessage(thinkingMessageId, botResponse);
          }
        }
      }
    }
    
    conversationHistory.push({ role: 'assistant', content: botResponse });
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request cancelled');
    } else {
      console.error('Error:', error);
      updateMessage(thinkingMessageId, 'Error: Could not get response');
    }
  } finally {
    // Reset button
    sendButton.innerHTML = '<span class="material-icons">send</span>';
    sendButton.classList.remove('stop-button');
    abortController = null;
  }
}
```


#### LocalStorage Management

The application uses localStorage for persistent state:

**Model Selection**:

```javascript
// Save selected model
if (modelSelector) {
  const lastSelectedModel = localStorage.getItem('selectedModel');
  if (lastSelectedModel) {
    modelSelector.value = lastSelectedModel;
  }
  
  modelSelector.addEventListener('change', function() {
    localStorage.setItem('selectedModel', this.value);
  });
}
```

**Incognito Mode**:

```javascript
let isIncognito = localStorage.getItem('isIncognito') === 'true';

function updateIncognitoUI() {
  if (isIncognito) {
    incognitoIcon.textContent = 'visibility_off';
    incognitoBtn.title = 'Disable Incognito Mode';
  } else {
    incognitoIcon.textContent = 'visibility';
    incognitoBtn.title = 'Enable Incognito Mode';
  }
}

incognitoBtn.addEventListener('click', function() {
  isIncognito = !isIncognito;
  localStorage.setItem('isIncognito', isIncognito);
  updateIncognitoUI();
  resetThread(); // Start new thread
});
```

**Search Mode**:

```javascript
function updateSearchButtonState() {
  const isSearchModeActive = localStorage.getItem('isSearchModeActive') === 'true';
  if (searchButton) {
    if (isSearchModeActive) {
      searchButton.classList.add('search-active');
    } else {
      searchButton.classList.remove('search-active');
    }
  }
}
```


#### File Upload System

The application supports document upload with context injection:

```javascript
if (uploadButton && fileInput) {
  uploadButton.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', async function() {
    const file = this.files[^0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        fileContextActive = true;
        addMessage(`📄 File uploaded: ${file.name}`, 'system');
        
        // Store file context for next message
        localStorage.setItem('fileContext', JSON.stringify({
          filename: file.name,
          content: data.content
        }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file');
    }
  });
}
```


### Sidebar Navigation

**Collapsible Sidebar**:

```javascript
if (sidebarToggle) {
  sidebarToggle.addEventListener('click', function() {
    document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', 
      document.body.classList.contains('sidebar-collapsed'));
  });
  
  // Restore state on load
  if (localStorage.getItem('sidebarCollapsed') === 'true') {
    document.body.classList.add('sidebar-collapsed');
  }
}
```

**CSS for Collapsed State**:

```css
.sidebar {
  width: 180px;
  transition: width 0.3s ease, padding 0.3s ease;
  overflow: hidden;
}

.sidebar-collapsed .sidebar {
  width: 0;
  padding-left: 0;
  padding-right: 0;
  border-right: none;
}

.sidebar-collapsed .sidebar > .nav-link,
.sidebar-collapsed .sidebar-header {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.1s ease-out;
}
```


### History Sidebar

**Slide-in History Panel**:

```css
.history-sidebar {
  position: fixed;
  top: 0;
  right: -250px; /* Start off-screen */
  width: 250px;
  height: 100%;
  background-color: var(--background);
  border-left: 1px solid var(--border);
  transition: right 0.3s ease;
  z-index: 100;
}

.history-sidebar.visible {
  right: 0; /* Slide in */
}
```

**Dynamic History Loading**:

```javascript
async function fetchHistorySidebar() {
  try {
    const response = await fetch('/api/history/grouped');
    if (!response.ok) throw new Error('Failed to fetch history');
    
    const groupedSessions = await response.json();
    const historyContent = document.querySelector('.history-sidebar-content');
    
    if (!historyContent) return;
    historyContent.innerHTML = '';
    
    if (Object.keys(groupedSessions).length === 0) {
      historyContent.innerHTML = '<p style="padding: 1rem;">No history yet.</p>';
      return;
    }
    
    // Group order: Today, Yesterday, Previous 7 Days, etc.
    const groupOrder = ["Today", "Yesterday", "Previous 7 Days", "Previous 30 Days"];
    const allGroupNames = Object.keys(groupedSessions);
    
    allGroupNames.sort((a, b) => {
      const indexA = groupOrder.indexOf(a);
      const indexB = groupOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return b.localeCompare(a);
    });
    
    for (const groupName of allGroupNames) {
      const groupHeader = document.createElement('h4');
      groupHeader.className = 'history-group-header';
      groupHeader.textContent = groupName;
      historyContent.appendChild(groupHeader);
      
      const sessionsInGroup = groupedSessions[groupName];
      sessionsInGroup.forEach(session => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.sessionId = session.session_id;
        
        const link = document.createElement('a');
        link.className = 'history-item-link';
        link.href = `/?session_id=${session.session_id}`;
        link.textContent = session.summary;
        
        item.appendChild(link);
        historyContent.appendChild(item);
      });
    }
  } catch (error) {
    console.error('Error fetching history:', error);
  }
}
```


### Models Management (models.js)

**Fetching and Displaying Local Models**:

```javascript
async function fetchModels() {
  try {
    const response = await fetch('/api/models');
    if (!response.ok) throw new Error('Server error');
    
    const data = await response.json();
    modelsTableBody.innerHTML = '';
    
    if (data.models && data.models.length > 0) {
      // Sort by modification date (newest first)
      data.models.sort((a, b) => 
        new Date(b.modified_at) - new Date(a.modified_at)
      );
      
      data.models.forEach(model => {
        const row = document.createElement('tr');
        const modifiedDate = new Date(model.modified_at);
        
        row.innerHTML = `
          <td>${model.name}</td>
          <td>${(model.size / (1024**3)).toFixed(2)} GB</td>
          <td>${modifiedDate.toLocaleDateString()}</td>
          <td>
            <button class="icon-btn delete-model-btn" 
                    data-model-name="${model.name}">
              <span class="material-icons">delete</span>
            </button>
          </td>
        `;
        
        modelsTableBody.appendChild(row);
      });
    }
  } catch (error) {
    console.error('Error fetching models:', error);
  }
}
```

**Model Pull with Progress**:

```javascript
async function pullModel(modelName) {
  pullStatusContainer.style.display = 'block';
  pullStatus.textContent = 'Starting download...';
  progressBar.style.width = '0%';
  
  try {
    const response = await fetch('/api/models/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_name: modelName })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = decoder.decode(value);
      const lines = text.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          
          if (data.status) {
            pullStatus.textContent = data.status;
          }
          
          if (data.completed && data.total) {
            const progress = (data.completed / data.total) * 100;
            progressBar.style.width = `${progress}%`;
          }
          
          if (data.status === 'success') {
            pullStatus.textContent = 'Download complete!';
            progressBar.style.width = '100%';
            setTimeout(() => {
              pullStatusContainer.style.display = 'none';
              fetchModels(); // Refresh list
            }, 2000);
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
    }
  } catch (error) {
    pullStatus.textContent = 'Error: ' + error.message;
  }
}
```


### Cloud Models Management (cloud_models.js)

**Modal-based CRUD Interface**:

```javascript
function openModalForCreate() {
  modal.style.display = 'block';
  modelForm.reset();
  modelIdInput.value = '';
  modalTitle.textContent = 'Add New Cloud Model';
  apiKeyInput.placeholder = 'Enter your API key';
  apiKeyInput.required = true;
  modelNamesContainer.innerHTML = '';
  addModelNameInput(); // Add one input by default
}

function openModalForEdit(model) {
  modal.style.display = 'block';
  modelForm.reset();
  modelIdInput.value = model.id;
  modalTitle.textContent = 'Edit Cloud Model';
  
  // Handle service selection
  const isPredefined = [...serviceSelect.options]
    .some(option => option.value === model.service);
    
  if (isPredefined) {
    serviceSelect.value = model.service;
  } else {
    serviceSelect.value = 'Other';
    document.getElementById('model-service-other').value = model.service;
  }
  
  document.getElementById('model-base-url').value = model.base_url;
  
  // Populate model names
  modelNamesContainer.innerHTML = '';
  model.model_names.forEach(name => addModelNameInput(name));
  
  apiKeyInput.placeholder = 'Leave blank to keep existing key';
  apiKeyInput.required = false;
}
```

**Dynamic Model Name Inputs**:

```javascript
function addModelNameInput(value = '') {
  const group = document.createElement('div');
  group.className = 'model-name-group';
  
  group.innerHTML = `
    <input type="text" name="model_names[]" 
           value="${value}" required 
           placeholder="e.g., gpt-4, claude-3-opus">
    <button type="button" class="icon-btn remove-model-name-btn">
      <span class="material-icons">remove_circle</span>
    </button>
  `;
  
  modelNamesContainer.appendChild(group);
  
  group.querySelector('.remove-model-name-btn')
    .addEventListener('click', () => {
      if (modelNamesContainer.children.length > 1) {
        group.remove();
      }
    });
}

addModelNameBtn.addEventListener('click', () => addModelNameInput());
```


### Prompts Management (prompts.js)

**Card-based Grid Layout**:

```javascript
function renderPrompts(prompts) {
  // Clear existing prompt cards
  grid.querySelectorAll('.prompt-card').forEach(card => card.remove());
  
  const promptIcons = {
    "Text": "📄",
    "Image": "🖼️",
    "Research": "🔬",
    "Code": "💻",
    "Creative": "🎨"
  };
  
  prompts.forEach(prompt => {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.dataset.id = prompt.id;
    
    const icon = promptIcons[prompt.type] || '📝';
    
    card.innerHTML = `
      <div class="prompt-icon">${icon}</div>
      <h3>${prompt.title}</h3>
      <p class="prompt-type">${prompt.type}</p>
      <p class="prompt-preview">${prompt.content.substring(0, 100)}...</p>
      <div class="prompt-actions">
        <button class="icon-btn edit-prompt-btn">
          <span class="material-icons">edit</span>
        </button>
        <button class="icon-btn delete-prompt-btn">
          <span class="material-icons">delete</span>
        </button>
      </div>
    `;
    
    grid.appendChild(card);
    
    // Event listeners
    card.querySelector('.edit-prompt-btn')
      .addEventListener('click', () => openModalForEdit(prompt));
    card.querySelector('.delete-prompt-btn')
      .addEventListener('click', () => deletePrompt(prompt.id));
  });
}
```


### Usage Statistics (usage.js)

**Time-range Filtered Data Display**:

```javascript
async function fetchUsageData(range = '1d') {
  loadingIndicator.style.display = 'block';
  usageTableBody.innerHTML = '';
  
  try {
    const response = await fetch(`/api/usage?range=${range}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch usage data');
    }
    
    const data = await response.json();
    renderUsageData(data);
    
  } catch (error) {
    console.error('Error fetching usage data:', error);
    usageTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--disconnected);">
          ${error.message}
        </td>
      </tr>
    `;
  } finally {
    loadingIndicator.style.display = 'none';
  }
}

function renderUsageData(data) {
  if (data.length === 0) {
    usageTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center;">No usage data for this period</td>
      </tr>
    `;
    return;
  }
  
  data.forEach(usage => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(usage.timestamp).toLocaleString()}</td>
      <td>${usage.model}</td>
      <td>${usage.input_tokens.toLocaleString()}</td>
      <td>${usage.output_tokens.toLocaleString()}</td>
      <td>${(usage.input_tokens + usage.output_tokens).toLocaleString()}</td>
    `;
    usageTableBody.appendChild(row);
  });
}

// Time range button handlers
timeRangeButtons.forEach(btn => {
  btn.addEventListener('click', function() {
    timeRangeButtons.forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    fetchUsageData(this.dataset.range);
  });
});
```


## Advanced Features

### Code Block Copy Functionality

**Automatic Copy Button Injection**:

```javascript
function addCopyButtonsToCodeBlocks(container) {
  const codeBlocks = container.querySelectorAll('pre code');
  
  codeBlocks.forEach(block => {
    const pre = block.parentElement;
    
    // Prevent duplicate buttons
    if (pre.querySelector('.copy-code-btn')) return;
    
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-code-btn';
    copyButton.innerHTML = '<span class="material-icons">content_copy</span> Copy';
    copyButton.title = 'Copy code';
    
    copyButton.addEventListener('click', () => {
      navigator.clipboard.writeText(block.textContent)
        .then(() => {
          copyButton.innerHTML = '<span class="material-icons">check</span> Copied!';
          setTimeout(() => {
            copyButton.innerHTML = '<span class="material-icons">content_copy</span> Copy';
          }, 2000);
        })
        .catch(err => {
          console.error('Failed to copy:', err);
          copyButton.textContent = 'Error';
        });
    });
    
    pre.appendChild(copyButton);
  });
}
```

**CSS Styling**:

```css
.copy-code-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.85rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

pre:hover .copy-code-btn {
  opacity: 1;
}
```


### PDF Export Functionality

**Thread-to-PDF Conversion**:

```javascript
async function downloadThreadAsPDF(sessionId) {
  const threadDiv = document.getElementById(`thread-${sessionId}`);
  if (!threadDiv) {
    alert('Thread not found!');
    return;
  }
  
  // Clone content for PDF
  const container = document.createElement('div');
  container.style.padding = '20px';
  container.style.fontFamily = 'Arial, sans-serif';
  
  const title = document.createElement('h1');
  title.textContent = `Chat Thread - ${sessionId}`;
  title.style.marginBottom = '20px';
  container.appendChild(title);
  
  const contentToPrint = threadDiv.cloneNode(true);
  container.appendChild(contentToPrint);
  
  // Add footer with timestamp
  const footer = document.createElement('div');
  footer.style.marginTop = '30px';
  footer.style.paddingTop = '10px';
  footer.style.borderTop = '1px solid #ccc';
  footer.style.fontSize = '10pt';
  footer.textContent = `Generated on: ${new Date().toLocaleString()}`;
  container.appendChild(footer);
  
  // Remove UI elements
  contentToPrint.querySelectorAll('.delete-btn, .delete-thread-btn, .download-pdf-btn')
    .forEach(button => button.remove());
  
  // Wait for MathJax rendering
  if (window.MathJax && MathJax.typesetPromise) {
    await MathJax.typesetPromise([contentToPrint]);
  }
  
  // Generate PDF
  html2pdf().from(container).set({
    margin: 10,
    filename: `chat-thread-${sessionId}.pdf`,
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4', compressPDF: true }
  }).save();
}
```


### Message Editing

**Inline Content Editing**:

```javascript
function makeMessageEditable(messageDiv) {
  const contentWrapper = messageDiv.querySelector('.message-content-wrapper');
  if (!contentWrapper) return;
  
  // Store original content
  const originalContent = messageDiv.dataset.rawContent || contentWrapper.textContent;
  
  // Make contentEditable
  contentWrapper.contentEditable = 'true';
  contentWrapper.focus();
  
  // Change edit button to save button
  const editBtn = messageDiv.querySelector('.edit-btn');
  editBtn.innerHTML = '<span class="material-icons">save</span>';
  editBtn.title = 'Save changes';
  
  // Create cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'icon-btn cancel-edit-btn';
  cancelBtn.innerHTML = '<span class="material-icons">close</span>';
  cancelBtn.title = 'Cancel';
  
  const footer = messageDiv.querySelector('.message-footer');
  footer.insertBefore(cancelBtn, editBtn.nextSibling);
  
  // Save handler
  const saveHandler = () => {
    const newContent = contentWrapper.textContent.trim();
    if (newContent) {
      contentWrapper.contentEditable = 'false';
      contentWrapper.innerHTML = formatMessage(escapeHtml(newContent));
      messageDiv.dataset.rawContent = newContent;
      
      // Update conversation history
      updateConversationHistory(messageDiv, newContent);
      
      // Restore edit button
      editBtn.innerHTML = '<span class="material-icons">edit</span>';
      editBtn.title = 'Edit message';
      cancelBtn.remove();
      
      // Re-render LaTeX and code blocks
      if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([contentWrapper]);
      }
      addCopyButtonsToCodeBlocks(contentWrapper);
    }
  };
  
  // Cancel handler
  const cancelHandler = () => {
    contentWrapper.contentEditable = 'false';
    contentWrapper.innerHTML = formatMessage(escapeHtml(originalContent));
    editBtn.innerHTML = '<span class="material-icons">edit</span>';
    cancelBtn.remove();
  };
  
  editBtn.onclick = saveHandler;
  cancelBtn.onclick = cancelHandler;
  
  // Save on Enter (Shift+Enter for new line)
  contentWrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveHandler();
    }
  });
}
```


### Search Integration

**Web Search Context Injection**:

```javascript
async function performWebSearch(query) {
  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query })
    });
    
    if (!response.ok) throw new Error('Search failed');
    
    const results = await response.json();
    
    // Format search results for context
    const searchContext = results.map((result, index) => 
      `[${index + 1}] ${result.title}\n${result.snippet}\nSource: ${result.url}`
    ).join('\n\n');
    
    // Create enhanced prompt with search context
    const enhancedMessage = `Based on the following web search results, please answer the user's question.

--- SEARCH RESULTS ---
${searchContext}

--- USER QUESTION ---
${query}`;
    
    return enhancedMessage;
    
  } catch (error) {
    console.error('Search error:', error);
    return query; // Fall back to original query
  }
}
```


## Responsive Design

### Mobile Breakpoints

The application includes responsive design for smaller screens:

```css
@media (max-width: 768px) {
  .page-container {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  
  .header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .header-nav {
    width: 100%;
    justify-content: space-between;
  }
  
  .message {
    max-width: 95%;
  }
  
  .dashboard {
    grid-template-columns: 1fr;
  }
  
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .input-area {
    flex-direction: column;
  }
  
  .user-message-container {
    width: 100%;
  }
  
  #sendButton {
    width: 100%;
    border-radius: var(--radius-md);
  }
}
```


## Performance Optimization

### Lazy Loading \& Code Splitting

**Conditional Script Loading**:

```html
{% block head_extra %}
  {% if page_type == 'chat' %}
    <script src="/static/script.js" defer></script>
  {% elif page_type == 'models' %}
    <script src="/static/models.js" defer></script>
  {% elif page_type == 'cloud_models' %}
    <script src="/static/cloud_models.js" defer></script>
  {% endif %}
{% endblock %}
```


### Debouncing User Input

For live search or auto-save features:

```javascript
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Usage example
const debouncedSearch = debounce(async (query) => {
  const results = await fetchSearchSuggestions(query);
  displaySuggestions(results);
}, 300);

searchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});
```


## API Integration

### Fetch API Patterns

**Standard POST Request**:

```javascript
async function apiRequest(endpoint, data) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Request failed');
    }
    
    return await response.json();
    
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}
```

**Streaming Response Handler**:

```javascript
async function streamingRequest(endpoint, data, onChunk) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, stream: true })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          onChunk(data);
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
    }
  }
}

// Usage
await streamingRequest('/api/chat', { message, model }, (data) => {
  if (data.content) {
    appendToMessage(data.content);
  }
});
```


## Error Handling

### Global Error Handler

```javascript
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  
  // Display user-friendly message
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-toast';
  errorDiv.textContent = 'An error occurred. Please try again.';
  document.body.appendChild(errorDiv);
  
  setTimeout(() => errorDiv.remove(), 5000);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
});
```


### Fetch Error Handling

```javascript
async function safeFetch(url, options = {}) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // Response not JSON
      }
      throw new Error(errorMessage);
    }
    
    return await response.json();
    
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection.');
    }
    throw error;
  }
}
```


## Testing Guidelines

### Unit Testing Setup

For testing individual functions:

```javascript
// test/formatMessage.test.js
import { formatMessage } from '../script.js';

describe('formatMessage', () => {
  test('should preserve LaTeX expressions', () => {
    const input = 'The formula is $x^2 + y^2 = r^2$';
    const output = formatMessage(input);
    expect(output).toContain('$x^2 + y^2 = r^2$');
  });
  
  test('should convert markdown to HTML', () => {
    const input = '**bold** and *italic*';
    const output = formatMessage(input);
    expect(output).toContain('<strong>');
    expect(output).toContain('<em>');
  });
});
```


### Integration Testing

For testing API interactions:

```javascript
// test/api.test.js
describe('API Integration', () => {
  test('should send message and receive response', async () => {
    const mockResponse = { content: 'Test response' };
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })
    );
    
    const result = await apiRequest('/api/chat', {
      message: 'Test',
      model: 'test-model'
    });
    
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object));
  });
});
```


## Deployment Checklist

### Production Build Steps

1. **Minify CSS and JavaScript**:

```bash
# Using tools like UglifyJS, Terser, or cssnano
terser script.js -o script.min.js -c -m
cssnano style.css style.min.css
```

2. **Update HTML references** to minified files
3. **Enable caching headers** for static assets
4. **Test all features** in production environment
5. **Monitor browser console** for errors
6. **Verify responsive design** on multiple devices

## Troubleshooting Common Issues

### LaTeX Not Rendering

**Problem**: Mathematical expressions display as raw LaTeX code

**Solution**: Ensure MathJax is loaded and typesetPromise is called:

```javascript
if (window.MathJax && MathJax.typesetPromise) {
  MathJax.typesetPromise([messageContainer]).catch(err => {
    console.error('MathJax error:', err);
  });
}
```


### Message History Not Persisting

**Problem**: Conversation history lost on page refresh

**Solution**: Check if incognito mode is enabled and verify localStorage:

```javascript
console.log('Incognito mode:', isIncognito);
console.log('Session ID:', sessionStorage.getItem('currentSessionId'));
```


### Sidebar Not Collapsing

**Problem**: Sidebar toggle button not working

**Solution**: Verify CSS classes and localStorage state:

```javascript
console.log('Sidebar collapsed:', document.body.classList.contains('sidebar-collapsed'));
console.log('LocalStorage:', localStorage.getItem('sidebarCollapsed'));
```


### Streaming Not Working

**Problem**: Messages appear all at once instead of streaming

**Solution**: Check Content-Type and streaming implementation:

```javascript
// Ensure stream: true is sent
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, model, stream: true })
});

// Verify response is a ReadableStream
console.log('Body type:', response.body);
```


## Best Practices

### Code Organization

1. **Group related functions** together in modules
2. **Use meaningful variable names** that describe purpose
3. **Add comments** for complex logic
4. **Keep functions small** and focused on single responsibility

### Security

1. **Always escape HTML** from user input
2. **Validate data** before sending to server
3. **Use HTTPS** in production
4. **Sanitize file uploads** on server-side

### Performance

1. **Debounce frequent events** like input changes
2. **Use event delegation** for dynamic elements
3. **Lazy load** non-critical resources
4. **Minimize DOM manipulations** by batching changes

### Accessibility

1. **Use semantic HTML** elements
2. **Add ARIA labels** to interactive elements
3. **Ensure keyboard navigation** works properly
4. **Test with screen readers**

