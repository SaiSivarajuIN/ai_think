document.addEventListener('DOMContentLoaded', function() {
    const chatbox = document.getElementById('chatbox');
    const userInput = document.getElementById('userMessage');
    const sendButton = document.getElementById('sendButton');
    const modelSelector = document.getElementById('model-selector');
    let conversationHistory = [];
    let thinkingMessageId = null;

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
        // Store the initial value on page load. This ensures the health page
        // shows the correct model even before the user makes a change.
        localStorage.setItem('selectedOllamaModel', modelSelector.value);

        // Update the stored value whenever the user changes the selection.
        modelSelector.addEventListener('change', function() {
            localStorage.setItem('selectedOllamaModel', this.value);
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
            messageDiv.textContent = content;
        } else {
            messageDiv.innerHTML = formatMessage(content);
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
        footerHTML += `<button class="regenerate-btn icon-btn" title="Regenerate response"><span class="material-icons">refresh</span></button>`;
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

        // Add raw response to conversation history for context
        conversationHistory.push({
            role: 'assistant',
            content: botResponse
        });

        // Fix and trim the text between <think> and </think> for display
        const cleanedBotResponse = botResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        // Store raw content for the copy button
        thinkingElement.dataset.rawContent = cleanedBotResponse;

        // Update the thinking message placeholder with the actual response and footer
        thinkingElement.classList.remove('thinking');
        thinkingElement.innerHTML = formatMessage(cleanedBotResponse || "..."); // Show something if response is empty
        addMessageFooter(thinkingElement, usage, generationTime);
        thinkingMessageId = null; // Clear the ID as we've used the placeholder
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

        const selectedModel = document.getElementById('model-selector').value;

        // Disable input while processing
        userInput.disabled = true;
        sendButton.disabled = true;

        // Add user message to chat
        addMessage(message, true);
        
        // Add to conversation history
        conversationHistory.push({
            role: 'user',
            content: message
        });

        // Clear input
        userInput.value = '';

        // Show thinking indicator
        showThinking();

        try {
            const response = await fetch('/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: conversationHistory,
                    model: selectedModel
                })
            });

            if (!response.ok) {
                removeThinking(); // On server error, remove the indicator
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server error');
            }

            const data = await response.json();
            handleBotResponse(data); // This will now update the thinking message

        } catch (error) {
            removeThinking();
            console.error('Error:', error);
            addMessage(`❌ Error: ${error.message}`, false);
        } finally {
            // Re-enable input
            userInput.disabled = false;
            sendButton.disabled = false;
            userInput.focus();
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
                chatbox.innerHTML = '';
                addMessage('🆕 New conversation started!', false);
            }
        } catch (error) {
            console.error('Error resetting thread:', error);
            addMessage('❌ Error starting new conversation', false);
        }
    }

    // Regenerate the last response
    async function regenerateResponse() {
        const selectedModel = document.getElementById('model-selector').value;

        // Remove last bot message from history
        if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'assistant') {
            conversationHistory.pop();
        } else {
            console.error("Could not find a bot message to regenerate.");
            return;
        }

        // Remove last bot message from DOM
        const lastBotMessage = chatbox.querySelector('.bot-message:last-of-type');
        if (lastBotMessage) {
            lastBotMessage.remove();
        }

        // Disable input while processing
        userInput.disabled = true;
        sendButton.disabled = true;

        // Show thinking indicator
        showThinking();

        try {
            const response = await fetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: conversationHistory,
                    model: selectedModel
                })
            });

            if (!response.ok) {
                removeThinking(); // On server error, remove the indicator
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server error');
            }

            const data = await response.json();
            handleBotResponse(data); // This will update the thinking message

        } catch (error) {
            removeThinking();
            console.error('Error:', error);
            addMessage(`❌ Error: ${error.message}`, false);
        } finally {
            userInput.disabled = false;
            sendButton.disabled = false;
            userInput.focus();
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
        const regenerateBtn = e.target.closest('.regenerate-btn');
        if (regenerateBtn) {
            const botMessageDiv = regenerateBtn.closest('.bot-message');
            const lastBotMessage = chatbox.querySelector('.bot-message:last-of-type');
            if (botMessageDiv === lastBotMessage) {
                regenerateResponse();
            } else {
                alert("Sorry, you can only regenerate the last response for now.");
            }
            return; // Stop further processing
        }

        const copyBtn = e.target.closest('.copy-btn');
        if (copyBtn) {
            const messageDiv = copyBtn.closest('.bot-message');
            const rawContent = messageDiv.dataset.rawContent;
            if (rawContent) {
                navigator.clipboard.writeText(rawContent).then(() => {
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

    // Auto-resize textarea
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });

    // Focus input on load
    userInput.focus();

    // Make functions globally available
    window.sendMessage = sendMessage;
    window.resetThread = resetThread;

    // Initial welcome message
    addMessage('👋 Hello! I\'m your Ollama-powered assistant. How can I help you today?', false);
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
      const clone = threadDiv.cloneNode(true);
      // Apply styles if required to preserve the chat look

      // Optional: Prepend a title/date to top of PDF
      const container = document.createElement('div');
      const summary = btn.closest('summary');
      const heading = document.createElement('h2');
      heading.textContent = `Chat Session ${sessionId}`; // Construct the title with sessionId
      container.appendChild(heading);
      container.appendChild(clone);

      // Remove delete buttons from the clone so they don't appear in the PDF
      clone.querySelectorAll('.delete-btn').forEach(button => button.remove());

      // Wait for MathJax rendering if present
      if(window.MathJax && MathJax.typesetPromise){
        await MathJax.typesetPromise([clone]);
      }

      // Set font size for PDF
      container.style.fontSize = '12pt';

      // Download PDF
      html2pdf().from(container).set({
        margin: 10,
        filename: `chat-thread-${sessionId}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'portrait', format: 'a2' }
      }).save();
    }
  });
});
