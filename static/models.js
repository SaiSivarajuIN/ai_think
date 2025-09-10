document.addEventListener('DOMContentLoaded', function() {
    const modelsTableBody = document.querySelector('#local-models-table tbody');
    const loadingIndicator = document.getElementById('loading-models');
    const pullButton = document.getElementById('pull-model-btn');
    const modelNameInput = document.getElementById('model-name-input');
    const pullStatusContainer = document.getElementById('pull-status-container');
    const pullStatus = document.getElementById('pull-status');
    const deleteAllBtn = document.getElementById('delete-all-models-btn');
    const progressBar = document.getElementById('progress-bar');

    // --- Fetch and Display Local Models ---
    async function fetchModels() {
        try {
            const response = await fetch('/api/models');
            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
            const data = await response.json();
            
            modelsTableBody.innerHTML = ''; // Clear existing rows

            if (data.models && data.models.length > 0) {
                data.models.sort((a, b) => new Date(b.modified_at) - new Date(a.modified_at));
                data.models.forEach(model => {
                    const row = document.createElement('tr');
                    const modifiedDate = new Date(model.modified_at);

                    row.innerHTML = `
                        <td>${model.name}</td>
                        <td>${(model.size / 1e9).toFixed(2)} GB</td>
                        <td title="${modifiedDate.toLocaleString()}">${timeAgo(modifiedDate)}</td>
                        <td>
                            <button class="delete-model-btn icon-btn" data-model-name="${model.name}" title="Delete Model">
                                <span class="material-icons">delete_forever</span>
                            </button>
                        </td>
                    `;
                    modelsTableBody.appendChild(row);
                });
            } else {
                modelsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No local models found.</td></tr>';
            }
        } catch (error) {
            console.error('Error fetching models:', error);
            modelsTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--disconnected);">Error fetching models. Is Ollama running?</td></tr>`;
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    // --- Pull New Model ---
    async function pullModel() {
        const modelName = modelNameInput.value.trim();
        if (!modelName) {
            alert('Please enter a model name.');
            return;
        }

        pullButton.disabled = true;
        modelNameInput.disabled = true;
        pullStatusContainer.style.display = 'block';
        pullStatus.textContent = `Starting pull for "${modelName}"...`;
        progressBar.style.width = '0%';

        try {
            const response = await fetch('/api/models/pull', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName }),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // Ollama sends a stream of JSON objects, one per line
                chunk.split('\n').forEach(line => {
                    if (line) {
                        try {
                            const data = JSON.parse(line);
                            if (data.error) {
                                pullStatus.textContent = `Error: ${data.error}`;
                                return;
                            }
                            pullStatus.textContent = data.status;
                            if (data.total && data.completed) {
                                const percent = (data.completed / data.total) * 100;
                                progressBar.style.width = `${percent.toFixed(2)}%`;
                            }
                        } catch (e) {
                            console.warn('Could not parse JSON line from stream:', line);
                        }
                    }
                });
            }
            pullStatus.textContent = `Successfully pulled "${modelName}"!`;
            await fetchModels(); // Refresh the list

        } catch (error) {
            console.error('Error pulling model:', error);
            pullStatus.textContent = `Failed to pull model. See console for details.`;
        } finally {
            pullButton.disabled = false;
            modelNameInput.disabled = false;
            modelNameInput.value = '';
            setTimeout(() => {
                pullStatusContainer.style.display = 'none';
            }, 5000);
        }
    }

    // --- Delete Model ---
    async function deleteModel(modelName) {
        if (!confirm(`Are you sure you want to delete the model "${modelName}"? This cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch('/api/models/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName }),
            });

            if (response.ok) {
                alert(`Successfully deleted "${modelName}".`);
                await fetchModels(); // Refresh the list
            } else {
                let errorData = { error: 'Failed to delete model.' };
                // Check if there's a JSON body to parse
                const responseText = await response.text();
                if (responseText) {
                    errorData = JSON.parse(responseText);
                }
                throw new Error(errorData.error || 'Failed to delete model.');
            }
        } catch (error) {
            console.error('Error deleting model:', error);
            alert(`Error: ${error.message}`);
        }
    }

    // --- Delete All Models ---
    async function deleteAllModels() {
        if (!confirm('Are you sure you want to delete ALL local models? This action is irreversible and will permanently remove all model data.')) {
            return;
        }

        try {
            const response = await fetch('/api/models/delete/all', {
                method: 'POST',
            });

            if (response.ok) {
                alert('All local models have been scheduled for deletion.');
                // The list will refresh, but it might take a moment for Ollama to delete them all.
                // We can add a small delay before refreshing to give it time.
                setTimeout(() => {
                    fetchModels();
                }, 2000); 
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete all models.');
            }
        } catch (error) {
            console.error('Error deleting all models:', error);
            alert(`Error: ${error.message}`);
        }
    }

    // --- Utility ---
    function timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    }

    // --- Event Listeners ---
    pullButton.addEventListener('click', pullModel);
    modelNameInput.addEventListener('keypress', (e) => e.key === 'Enter' && pullModel());
    modelsTableBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-model-btn');
        if (deleteBtn) {
            deleteModel(deleteBtn.dataset.modelName);
        }
    });
    
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', deleteAllModels);
    }

    // --- Initial Load ---
    fetchModels();
});