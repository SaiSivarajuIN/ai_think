document.addEventListener('DOMContentLoaded', function() {
    const chatbox = document.getElementById('chatbox');
    const userInput = document.getElementById('userMessage');
    const sendButton = document.getElementById('sendButton');
    const modelSelector = document.getElementById('model-selector');
    const uploadButton = document.getElementById('uploadButton');
    const fileInput = document.getElementById('fileUpload');
    const promptSelector = document.getElementById('prompt-selector');
    const searchButton = document.getElementById('search-button');
    const incognitoBtn = document.getElementById('incognito-toggle-btn');
    const incognitoIcon = document.getElementById('incognito-icon');
    let conversationHistory = [];
    const sidebarToggle = document.querySelector('.sidebar-toggle-btn');
    const historySidebarToggle = document.getElementById('history-sidebar-toggle');
    const historySidebar = document.querySelector('.history-sidebar');
    let thinkingMessageId = null;
    let abortController = null; // New: for cancelling fetch requests
    let fileContextActive = false;
    let isIncognito = false;

    // Showdown converter for Markdown rendering
    const converter = new showdown.Converter({
        simplifiedAutoLink: true,
        strikethrough: true,
        tables: true,
        tasklists: true,
        disableForced4SpacesIndentedSublists: true,
        simpleLineBreaks: true,
        openLinksInNewWindow: true,
        emoji: true,
    });

    // Helper: Escape HTML to prevent XSS
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Helper: Format and render markdown
    function formatMessage(text) {
        return converter.makeHtml(text);
    }

    // If the model selector exists on the page (i.e., on index.html),
    // set up an event listener to store its value in localStorage.
    if (modelSelector) {
        // On page load, try to set the selector to the last saved value.
        const lastSelectedModel = localStorage.getItem('selectedModel');
        if (lastSelectedModel) {
            modelSelector.value = lastSelectedModel;
        }

        // Update the stored value whenever the user changes the selection.
        modelSelector.addEventListener('change', function() {
            localStorage.setItem('selectedModel', this.value);
        });
    }

    // If the prompt selector exists, listen for changes to apply the prompt
    if (promptSelector) {
        promptSelector.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const promptContent = selectedOption.dataset.content;
            if (promptContent) {
                // Clear existing history and add the selected prompt as the system message
                conversationHistory = [{ role: 'system', content: promptContent }];
                chatbox.innerHTML = ''; // Clear the visual chat
                addMessage(`🚀 **Prompt Activated:** ${selectedOption.textContent}`, false);
            }
        });
    }

    // If the search button exists, add a click listener to focus the input
    // and pre-fill the search command.
    if (searchButton && userInput) {
        searchButton.addEventListener('click', function() {
            userInput.focus();
            // Only add the command if the input is empty to avoid overwriting user text
            if (userInput.value.trim() === '') {
                userInput.value = '/search ';
            }
        });
    }

    // --- Incognito Mode Logic ---
    function updateIncognitoUI() {
        if (!incognitoBtn || !incognitoIcon) return;

        if (isIncognito) {
            incognitoIcon.textContent = 'visibility_off';
            incognitoBtn.title = 'Disable Incognito Mode';
        } else {
            incognitoIcon.textContent = 'visibility';
            incognitoBtn.title = 'Enable Incognito Mode';
        }
    }

    // If the incognito button exists, add a listener
    if (incognitoBtn) {
        incognitoBtn.addEventListener('click', function() {
            isIncognito = !isIncognito; // Toggle the state
            updateIncognitoUI();

            // When toggling incognito, always start a new thread
            resetThread();
            if (isIncognito) {
                addMessage('👻 **Incognito Mode Enabled.** Chat history will not be saved.', false);
            } else {
                addMessage('✅ **Incognito Mode Disabled.** Chat history will now be saved.', false);
            }
        });
    }
    // Add message to chat
    function addMessage(content, isUser = false, messageId = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        if (messageId) {
            messageDiv.id = messageId;
        }

        if (isUser) {
            // Escape HTML for user messages to prevent XSS
            let displayContent = content;
            const rawContentForCopy = content; // Keep original for copy

            // Regex for both search and file context
            const searchRegex = /^Based on the following web search results, please answer the user's question\.\n\n--- SEARCH RESULTS ---\n([\s\S]*?)\n\n--- USER QUESTION ---\n([\s\S]*)$/m;
            const fileContextRegex = /^Based on the content of the document '(.+?)' provided below, please answer the following question\.\n\n---\n\nDOCUMENT CONTENT:\n([\s\S]*?)\n\n---\n\nQUESTION:\n([\s\S]*)$/m;
            
            const searchMatch = content.match(searchRegex);
            const fileMatch = content.match(fileContextRegex);

            if (searchMatch) {
                const userQuestion = searchMatch[2].trim();
                // Display only the user's original question part.
                // The full content with search results is still in `rawContentForCopy`.
                // The "Search Results" block is rendered on history.html from this raw content.
                displayContent = userQuestion;
            } else if (fileMatch) {
                const filename = fileMatch[1].trim();
                const userQuestion = fileMatch[3].trim();
                // Display only the user's question part. The full content is saved for history.
                // We'll add a small indicator about the file context.
                displayContent = `*(Querying about ${filename})*\n\n${userQuestion}`;
            }

            const formattedContent = formatMessage(escapeHtml(displayContent));
            messageDiv.innerHTML = formattedContent;
            // Store the full raw content (with search results) for copy/regen
            messageDiv.dataset.rawContent = rawContentForCopy;

            // Add a footer with just a copy button for user messages
            const footer = document.createElement('div');
            // footer.className = 'message-footer';
            footer.innerHTML = `<button class="copy-btn icon-btn" title="Copy message"><span class="material-icons">content_copy</span></button>`;
            messageDiv.appendChild(footer);
        } else {
            // For bot messages, also remove <think> blocks for display on index.html
            const cleanedContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            messageDiv.innerHTML = formatMessage(cleanedContent);
            // Store the original full content (with thoughts) for history.html rendering
            // and for the copy button on index.html.
            messageDiv.dataset.rawContent = content;
        }

        chatbox.appendChild(messageDiv);
        chatbox.scrollTop = chatbox.scrollHeight;

        // Render math only in bot (assistant) messages
        if (window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetPromise([messageDiv]).catch(err => console.error(err));
        }
        return messageDiv;
    }

    // Add message footer with stats and actions
    function addMessageFooter(messageDiv, usage, generationTime) {
        const footer = document.createElement('div');
        footer.className = 'message-footer';

        let footerHTML = '';
        if (generationTime) {
            footerHTML += `<span class="generation-time">${generationTime.toFixed(2)}s</span>`;
        }

        footerHTML += `<button class="copy-btn icon-btn" title="Copy message"><span class="material-icons">content_copy</span></button>`;
        footer.innerHTML = footerHTML;
        messageDiv.appendChild(footer);
    }

    // Handle bot response from server
    function handleBotResponse(data) {
        const thinkingElement = document.getElementById(thinkingMessageId);
        if (!thinkingElement) {
            // This can happen if there was an error and it was already removed.
            console.warn("Could not find thinking message placeholder to update.");
            return;
        }

        const botResponse = data.message.content;
        const generationTime = data.generation_time_seconds;
        const usage = data.usage;
        // The user message is now confirmed and can be added to the history
        // along with the bot response.
        const userMessageContent = data.user_message_content;
        conversationHistory.push({ role: 'user', content: userMessageContent });
        const sessionId = data.session_id;

        // Update URL with session_id if it's not already there
        if (!isIncognito && sessionId) {
            const url = new URL(window.location);
            url.searchParams.set('session_id', sessionId);
            window.history.pushState({ path: url.href }, '', url.href);

            // Refresh history sidebar to include the new session
            fetchHistorySidebar();
        }

        // Add raw response to conversation history for context
        conversationHistory.push({
            role: 'assistant',
            content: botResponse
        });

        // Fix and trim the text between <think> and   </think> for display
        const cleanedBotResponse = botResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        // Store raw content for the copy button
        thinkingElement.dataset.rawContent = cleanedBotResponse;

        // Update the thinking message placeholder with the actual response and footer
        thinkingElement.classList.remove('thinking');
        thinkingElement.innerHTML = formatMessage(cleanedBotResponse || "..."); // Show something if response is empty
        addMessageFooter(thinkingElement, usage, generationTime);
        thinkingMessageId = null; // Clear the ID as we've used the placeholder

        // Scroll to the bottom to ensure the new message is visible
        chatbox.scrollTop = chatbox.scrollHeight;
    }

    // Show thinking indicator
    function showThinking() {
        thinkingMessageId = 'thinking-' + Date.now();
        const thinkingDiv = addMessage('🤔 Thinking...', false, thinkingMessageId);
        thinkingDiv.classList.add('thinking');
    }

    // Remove thinking indicator
    function removeThinking() {
        if (thinkingMessageId) {
            const thinkingElement = document.getElementById(thinkingMessageId);
            if (thinkingElement) {
                thinkingElement.remove();
            }
            thinkingMessageId = null;
        }
    }

    // Send message to server
    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // If a generation is already in progress, do nothing.
        if (abortController) {
            return;
        }

        const selectedModel = document.getElementById('model-selector').value;

        // Disable input while processing
        userInput.disabled = true;
        // Change to Stop button
        toggleSendStopButton(true);

        // Add user message to chat
        const userMessageDiv = addMessage(message, true);
        
        // Clear input
        userInput.value = '';


        // Show thinking indicator
        showThinking();

        // Create a new AbortController for this request
        abortController = new AbortController();
        const signal = abortController.signal;

        try {
            const response = await fetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    messages: conversationHistory,
                    model: selectedModel,
                    newMessage: { role: 'user', content: message }, // Send new message separately
                    incognito: isIncognito // Send incognito status
                }),
                signal: signal // Pass the abort signal
            });

            if (!response.ok) {
                removeThinking(); // On server error, remove the indicator
                // Handle client disconnect (204 No Content) gracefully
                if (response.status === 204) {
                    return; // The request was cancelled on the server, do nothing more.
                }
                const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
                throw new Error(errorData.error || 'Server error');
            }

            const data = await response.json();
            // Add the user message content to the response data for history tracking
            data.user_message_content = message;
            handleBotResponse(data); // This will now update the thinking message

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted by user.');
            } else {
                removeThinking();
                console.error('Error:', error);
                addMessage(`❌ Error: ${error.message}`, false);
            }
        } finally {
            // Re-enable input
            toggleSendStopButton(false); // Reset to Send state
            userInput.disabled = false;
            userInput.focus();
            abortController = null; // Clear the controller
        }
    }

    // Reset conversation thread
    async function resetThread() {
        try {
            const response = await fetch('/reset_thread', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                conversationHistory = [];
                fileContextActive = false;
                chatbox.innerHTML = '';
                if (!isIncognito) {
                    addMessage('🆕 New conversation started!', false);
                    // Reset URL to the base path only if not in incognito
                    window.history.pushState({}, '', '/');
                }
            }
        } catch (error) {
            // Even if the server call fails, reset the frontend state
            conversationHistory = [];
            chatbox.innerHTML = '';
            // Also reset URL to the base path
            window.history.pushState({}, '', '/');
            console.error('Error resetting thread:', error);
            addMessage('❌ Error starting new conversation', false);
        }
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Event delegation for message actions (copy, regenerate)
    chatbox.addEventListener('click', function(e) {
        const copyBtn = e.target.closest('.copy-btn');
        if (copyBtn) {
            const messageDiv = copyBtn.closest('.message'); // Works for both .user-message and .bot-message
            const rawContent = messageDiv ? messageDiv.dataset.rawContent : null;
            let contentToCopy = rawContent;

            if (rawContent) {
                // If it's a user message, check if it contains search results and extract only the question.
                if (messageDiv.classList.contains('user-message')) {
                    const searchRegex = /^Based on the following web search results, please answer the user's question\.\n\n--- SEARCH RESULTS ---\n([\s\S]*?)\n\n--- USER QUESTION ---\n([\s\S]*)$/m;
                    const searchMatch = rawContent.match(searchRegex);
                    if (searchMatch) {
                        contentToCopy = searchMatch[2].trim(); // The user's actual question
                    }
                }

                navigator.clipboard.writeText(contentToCopy).then(() => {
                    const icon = copyBtn.querySelector('.material-icons');
                    const originalIcon = icon.textContent;
                    icon.textContent = 'done'; // Change to checkmark
                    setTimeout(() => {
                        icon.textContent = originalIcon; // Change back
                    }, 1500);
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                    alert('Failed to copy message.');
                });
            }
        }
    });

    // --- History Sidebar Logic ---
    if (historySidebarToggle && historySidebar) {
        historySidebarToggle.addEventListener('click', () => {
            historySidebar.classList.toggle('visible');
            document.querySelector('.main-content-wrapper').classList.toggle('history-visible');
        });
    }

    // New: Function to toggle send/stop button state
    function toggleSendStopButton(isSending) {
        if (isSending) {
            sendButton.innerHTML = '<span class="material-icons">stop</span>';
            sendButton.classList.add('stop-button');
            sendButton.title = 'Stop Generation';
            sendButton.removeEventListener('click', sendMessage);
            sendButton.addEventListener('click', stopGeneration);
            sendButton.disabled = false; // Ensure it's clickable to stop
        } else {
            sendButton.innerHTML = '<span class="material-icons">send</span>';
            sendButton.title = 'Send';
            sendButton.classList.remove('stop-button');
            sendButton.removeEventListener('click', stopGeneration);
            sendButton.addEventListener('click', sendMessage);
            sendButton.disabled = false; // Re-enable for sending
        }
    }

    // New: Function to stop ongoing generation
    function stopGeneration() {
        if (abortController) {
            abortController.abort();
            console.log('Generation manually aborted.');
            // Also remove the user's optimistic message from the UI
            const lastUserMessage = chatbox.querySelector('.user-message:last-of-type');
            if (lastUserMessage) {
                lastUserMessage.remove();
            }
        }
        removeThinking();
    }

    // Make functions globally available
    window.sendMessage = sendMessage;
    window.resetThread = resetThread;
    window.stopGeneration = stopGeneration; // Make stopGeneration globally available

    // --- Page Initialization ---
    async function initializeChat() {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');

        // If there's a session ID in the URL, we are NOT in incognito mode.
        if (sessionId) {
            isIncognito = false;
            updateIncognitoUI();
        }

        if (sessionId) {
            // A session ID is in the URL, try to load its history
            addMessage(`🔄 Loading chat session: ${escapeHtml(sessionId)}...`, false);
            try {
                const response = await fetch(`/api/session/${sessionId}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Session not found (HTTP ${response.status})`);
                }
                const history = await response.json();
                
                // Clear any welcome messages
                chatbox.innerHTML = '';

                // Populate conversation history and UI
                conversationHistory = history;
                history.forEach(msg => {
                    if (msg.role === 'user') {
                        addMessage(msg.content, true);
                    } else if (msg.role === 'assistant') {
                        const botMsgDiv = addMessage(msg.content, false);
                        // The addMessage function now handles setting the raw content,
                        // but we call it again here to be explicit and safe.
                        botMsgDiv.dataset.rawContent = msg.content;
                        addMessageFooter(botMsgDiv, null, null); // Add footer with copy/regen
                    }
                    // System messages (like file uploads) are in history but not always shown initially.
                    // You could add logic here to display them if needed.
                });

            } catch (error) {
                console.error('Failed to load session:', error);
                chatbox.innerHTML = ''; // Clear loading message
                addMessage(`❌ Could not load session: ${error.message}`, false);
                addMessage('Starting a new conversation instead.', false);
            }
        } else {
            // No session ID, start a fresh chat
            if (isIncognito) {
                addMessage('👻 **Incognito Mode Enabled.** Chat history will not be saved.', false);
            } else {
                addMessage('👋 Hello! I\'m your Ollama-powered assistant. How can I help you today?', false);
            }
        }
    }

    async function fetchHistorySidebar() {
        const historyContent = document.getElementById('history-sidebar-content');
        if (!historyContent) return;

        try {
            const response = await fetch('/api/sessions');
            if (!response.ok) throw new Error('Failed to fetch sessions');
            const groupedSessions = await response.json();

            historyContent.innerHTML = ''; // Clear old items
            if (Object.keys(groupedSessions).length === 0) {
                historyContent.innerHTML = '<p class="history-item">No history yet.</p>';
                return;
            }

            // Get group names and reverse them to show newest groups first (e.g., Today, Yesterday, etc.)
            const groupNames = Object.keys(groupedSessions).reverse();
            for (const groupName of groupNames) {
                const groupHeader = document.createElement('h4');
                groupHeader.className = 'history-group-header';
                groupHeader.textContent = groupName;
                historyContent.appendChild(groupHeader);

                const sessionsInGroup = groupedSessions[groupName];
                sessionsInGroup.forEach(session => {
                    const item = document.createElement('a');
                    item.className = 'history-item';
                    item.href = `/?session_id=${session.session_id}`;
                    item.title = `Continue chat from ${new Date(session.last_updated).toLocaleString()}`;
                    item.textContent = session.summary;
                    historyContent.appendChild(item);
                });
            }
        } catch (error) {
            console.error('Error fetching history sidebar:', error);
            historyContent.innerHTML = '<p class="history-item">Could not load history.</p>';
        }
    }

    // --- File Upload Logic ---
    if (uploadButton && fileInput) {
        uploadButton.addEventListener('click', () => {
            fileInput.click(); // Trigger the hidden file input
        });

        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) {
                return;
            }

            const formData = new FormData();
            formData.append('file', file);

            // Show a temporary "uploading" message
            const uploadingMsg = addMessage(`Uploading "${file.name}"...`, false);
            uploadingMsg.classList.add('thinking');

            try {
                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData,
                });

                const data = await response.json();

                // Remove the "uploading" message
                uploadingMsg.remove();

                if (response.ok && data.success) {
                    // Notify user in the chatbox
                    addMessage(`✅ **${data.message}**`, false);
                    fileContextActive = true;
                } else {
                    throw new Error(data.error || 'File upload failed.');
                }
            } catch (error) {
                uploadingMsg.remove();
                addMessage(`❌ Error: ${error.message}`, false);
            }
            // Reset file input to allow uploading the same file again
            event.target.value = '';
        });
    }

    // Auto-resize textarea
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });

    // Focus input on load
    userInput.focus();

    initializeChat();
    fetchHistorySidebar();

    // Ensure send button is in initial state with correct listener
    toggleSendStopButton(false);
});

document.addEventListener('DOMContentLoaded', function() {
    const sidebarToggle = document.querySelector('.sidebar-toggle-btn');
    const pageContainer = document.querySelector('.page-container');

    // The initial state is now handled by a script in <head> and a CSS class.
    // Here, we just need to sync the .page-container class with the pre-load state.
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        pageContainer.classList.add('sidebar-collapsed');
    }
    // Clean up the pre-load class from <html> so it doesn't interfere with other things.
    document.documentElement.classList.remove('sidebar-collapsed-preload');

    if (sidebarToggle && pageContainer) {
        sidebarToggle.addEventListener('click', () => {
            // Toggle the class on the main container for transitions
            pageContainer.classList.toggle('sidebar-collapsed');
            // Save the state to localStorage
            localStorage.setItem('sidebarCollapsed', pageContainer.classList.contains('sidebar-collapsed'));
        });
    }

    // Add keyboard shortcut for sidebar toggle (Alt + S)
    document.addEventListener('keydown', (event) => {
        if (event.altKey && event.key.toLowerCase() === 's') {
            event.preventDefault(); // Prevent browser's default "Save" action
            if (sidebarToggle) {
                sidebarToggle.click();
            }
        }
        if (event.altKey && event.key.toLowerCase() === 'h') {
            const historySidebarToggle = document.getElementById('history-sidebar-toggle');
            if (historySidebarToggle) {
                // Prevent default browser action for Alt+H (often opens Help menu)
                event.preventDefault();
                historySidebarToggle.click();
            }
        }
        if (event.altKey && event.key.toLowerCase() === 'n') {
            const incognitoBtn = document.getElementById('incognito-toggle-btn');
            if (incognitoBtn) {
                // Prevent default browser action for Alt+N (often new window)
                event.preventDefault();
                incognitoBtn.click();
            }
        }
    });
});

document.addEventListener('DOMContentLoaded', function() {

  // Use event delegation for all download buttons
  document.body.addEventListener('click', async function(e) {
    if (e.target.closest('.download-pdf-btn')) {
      const btn = e.target.closest('.download-pdf-btn');
      const sessionId = btn.getAttribute('data-session');
      const threadDiv = document.getElementById(`thread-${sessionId}`);

      if (!threadDiv) {
        alert('Thread messages not found!');
        return;
      }

      // Clone the actual thread node for printing, to avoid altering the UI
      const contentToPrint = threadDiv.cloneNode(true);

      // Create a container for the PDF content
      const container = document.createElement('div');
      container.style.padding = '20px'; // Add some padding for better layout
      container.style.fontFamily = "'Inter', sans-serif";

      // Clone and append stylesheets to the container to be printed
      const stylesheets = document.querySelectorAll('link[rel="stylesheet"], style');
      stylesheets.forEach(sheet => {
        container.appendChild(sheet.cloneNode(true));
      });

      // Create and style the header
      const header = document.createElement('div');
      // Use existing CSS classes for consistency if possible, or inline styles
      header.style.borderBottom = '2px solid #ccc';
      header.style.paddingBottom = '10px';
      header.style.marginBottom = '20px';
      header.style.textAlign = 'left';
      const heading = document.createElement('h2');
      heading.textContent = `Chat Session ${sessionId}`; // Construct the title with sessionId
      heading.style.margin = '0';
      header.appendChild(heading);
      container.appendChild(header);

      // Add the chat content
      container.appendChild(contentToPrint);

      // Create and style the footer
      const footer = document.createElement('div');
      footer.style.borderTop = '2px solid #ccc';
      footer.style.paddingTop = '10px';
      footer.style.marginTop = '20px';
      footer.style.textAlign = 'right';
      footer.style.fontSize = '10pt'; // 10pt is roughly 3.5mm, which is a good readable size.
      footer.textContent = `Generated on: ${new Date().toLocaleString()}`;
      container.appendChild(footer);

      // Remove delete buttons from the clone so they don't appear in the PDF
      contentToPrint.querySelectorAll('.delete-btn, .delete-thread-btn, .download-pdf-btn').forEach(button => button.remove());

      // Wait for MathJax rendering if present
      if(window.MathJax && MathJax.typesetPromise){
        await MathJax.typesetPromise([contentToPrint]);
      }

      // Set font size for PDF
      container.style.fontSize = '11pt'; // Adjusted for better fit on A4

      // Download PDF
      html2pdf().from(container).set({
        margin: 10,
        filename: `chat-thread-${sessionId}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a2', compressPDF: true }
      }).save();
    }

    if (e.target.closest('.download-doc-btn')) {
        const btn = e.target.closest('.download-doc-btn');
        const sessionId = btn.getAttribute('data-session');
        const threadDiv = document.getElementById(`thread-${sessionId}`);

        if (!threadDiv) {
            alert('Thread messages not found!');
            return;
        }

        // 1. Create the HTML content for the document
        let content = `
            <html xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <title>Chat History</title>
                <style>
                    body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; }
                    p { margin: 0; padding: 0; line-height: 1.15; }
                    .user-msg { font-weight: bold; color: #000080; } /* Dark Blue */
                    .bot-msg { font-weight: bold; color: #006400; } /* Dark Green */
                    .message-block { margin-bottom: 8pt; }
                    pre { 
                        background-color: #f0f0f0; 
                        border: 1px solid #ccc; 
                        padding: 10px; 
                        white-space: pre-wrap; 
                        word-wrap: break-word;
                        font-size: 8pt;
                        font-family: 'Courier New', Courier, monospace;
                    }
                    .section-heading {
                        font-weight: bold;
                        text-transform: uppercase;
                        font-size: 9pt;
                        margin-top: 10pt;
                        margin-bottom: 5pt;
                        color: #2121bbff; /* Dark Blue */
                        border-bottom: 1px solid #999;
                        padding-bottom: 2pt;
                    }
                    .thought-table {
                        border: 1px solid #000000;
                        border-collapse: collapse;
                        width: 100%;
                        margin: 5pt 0 10pt 0;
                        background-color: #f0f0f0; /* Gray background */
                    }
                    .thought-table td {
                        border: 1px solid #000000;
                        padding: 5pt;
                    }
                </style>
            </head>
            <body>
                <h1 style="font-size: 16pt;">Chat Session ${sessionId}</h1>
                <hr style="margin-bottom: 12pt;"/>
        `;

        threadDiv.querySelectorAll('.message-container').forEach(msgContainer => {
            const sender = msgContainer.querySelector('.user-sender') ? 'You' : 'Bot';
            const contentDiv = msgContainer.querySelector('.history-content');
            const senderClass = sender === 'You' ? 'user-msg' : 'bot-msg';

            // Start the message block
            content += `<div class="message-block"><p class="${senderClass}">${sender}:</p>`;

            // Use innerHTML to preserve formatting from showdown.js
            const renderedContent = contentDiv.innerHTML;
            if (sender === 'Bot' || (sender === 'You' && renderedContent.includes('<div class="thought"'))) {
                // Create a temporary div to parse the rendered content
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = renderedContent;

                // Replace web-specific thought/search divs with DOC-specific styled elements
                tempDiv.querySelectorAll('.thought').forEach(thoughtDiv => {
                    const headingElement = thoughtDiv.querySelector('strong');
                    const contentElement = thoughtDiv.querySelector('div');
                    if (headingElement && contentElement) {
                        const headingText = headingElement.innerText;
                        headingElement.outerHTML = `<p class="section-heading">${headingText}</p>`;
                        
                        if (headingText.toLowerCase().includes('thought process')) {
                            contentElement.outerHTML = `<table class="thought-table"><tr><td>${contentElement.innerHTML}</td></tr></table>`;
                        }
                    }
                });
                // Add a line space after thought process tables
                content += tempDiv.innerHTML.replace(/<\/table>/g, '</table><p>&nbsp;</p>');
            } else {
                // Regular message
                content += `<p>${contentDiv.innerText}</p>`;
            }

            content += `</div>`; // Close message-block
        });

        // Add the generation date at the end of the document
        content += `<hr style="margin-top: 12pt;"/><p style="font-size: 8pt; color: #888;">Generated on: ${new Date().toLocaleString()}</p>`;

        content += '</body></html>'; // Close the document

        // 2. Create a Blob and trigger download
        const blob = new Blob([content], { type: 'application/msword' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `chat-session-${sessionId}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  });
});