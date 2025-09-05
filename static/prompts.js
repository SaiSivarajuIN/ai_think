document.addEventListener('DOMContentLoaded', function() {
    const grid = document.getElementById('prompt-hub-grid');
    const addPromptBtn = document.getElementById('add-prompt-btn');
    const modal = document.getElementById('prompt-modal');
    const closeModalBtn = modal.querySelector('.close-btn');
    const promptForm = document.getElementById('prompt-form');
    const modalTitle = document.getElementById('modal-title');
    const promptIdInput = document.getElementById('prompt-id');

    const promptIcons = {
        "Text": "📄",
        "Image": "🖼️",
        "Research": "🔬",
        "Code": "💻",
        "Creative": "🎨"
    };

    // --- Modal Logic ---
    function openModalForCreate() {
        modal.style.display = 'block';
        promptForm.reset();
        promptIdInput.value = '';
        modalTitle.textContent = 'Create New Prompt';
    }

    function openModalForEdit(prompt) {
        modal.style.display = 'block';
        promptForm.reset();
        promptIdInput.value = prompt.id;
        modalTitle.textContent = 'Edit Prompt';
        document.getElementById('prompt-title').value = prompt.title;
        document.getElementById('prompt-type').value = prompt.type;
        document.getElementById('prompt-content').value = prompt.content;
    }

    function closeModal() {
        modal.style.display = 'none';
        promptIdInput.value = '';
    }

    addPromptBtn.addEventListener('click', openModalForCreate);
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // --- API Calls ---
    async function fetchPrompts() {
        try {
            const response = await fetch('/api/prompts');
            if (!response.ok) throw new Error('Failed to fetch prompts');
            const prompts = await response.json();
            renderPrompts(prompts);
        } catch (error) {
            console.error('Error fetching prompts:', error);
            grid.innerHTML += '<p>Error loading prompts.</p>';
        }
    }

    async function savePrompt(event) {
        event.preventDefault();
        const formData = new FormData(promptForm);
        const data = Object.fromEntries(formData.entries());
        const promptId = promptIdInput.value;

        const url = promptId ? `/api/prompts/update/${promptId}` : '/api/prompts/create';
        const method = 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                throw new Error(`Failed to ${promptId ? 'update' : 'save'} prompt`);
            }
            closeModal();
            fetchPrompts(); // Refresh list
        } catch (error) {
            console.error('Error saving prompt:', error);
            alert('Failed to save prompt.');
        }
    }

    async function deletePrompt(promptId) {
        if (!confirm('Are you sure you want to delete this prompt?')) return;

        try {
            const response = await fetch(`/api/prompts/delete/${promptId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete prompt');
            fetchPrompts(); // Refresh list
        } catch (error) {
            console.error('Error deleting prompt:', error);
            alert('Failed to delete prompt.');
        }
    }

    // --- Rendering ---
    function renderPrompts(prompts) {
        // Clear existing prompts, but not the "add" button
        grid.querySelectorAll('.prompt-card').forEach(card => card.remove());

        if (prompts.length === 0) {
            // Optionally show a message
        }

        prompts.forEach(prompt => {
            const card = document.createElement('div');
            card.className = 'prompt-card';
            card.dataset.id = prompt.id;

            const icon = promptIcons[prompt.type] || '📝';

            card.innerHTML = `
                <div class="prompt-card-header">
                    <h3 class="prompt-card-title">
                        <span class="icon">${icon}</span>
                        ${prompt.title}
                    </h3>
                    <div class="prompt-card-actions">
                        <button class="edit-prompt-btn icon-btn" title="Edit Prompt">
                            <span class="material-icons">edit</span>
                        </button>
                        <button class="delete-prompt-btn icon-btn" title="Delete Prompt">
                            <span class="material-icons">delete</span>
                        </button>
                    </div>
                </div>
                <div class="prompt-card-content">
                    ${prompt.content}
                </div>
            `;
            grid.prepend(card); // Add new cards at the beginning

            // Add event listener for the new edit button
            card.querySelector('.edit-prompt-btn').addEventListener('click', () => {
                openModalForEdit(prompt);
            });
        });
    }

    // --- Event Listeners ---
    promptForm.addEventListener('submit', savePrompt);

    grid.addEventListener('click', (event) => {
        const deleteBtn = event.target.closest('.delete-prompt-btn');
        if (deleteBtn) {
            const card = deleteBtn.closest('.prompt-card');
            deletePrompt(card.dataset.id);
        }

        const editBtn = event.target.closest('.edit-prompt-btn');
        if (editBtn) {
            // The listener is now attached directly during rendering, so this part is not strictly needed but is good for clarity.
        }
    });

    // Initial load
    fetchPrompts();
});