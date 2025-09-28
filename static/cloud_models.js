document.addEventListener('DOMContentLoaded', function() {
    const modelsTableBody = document.querySelector('#cloud-models-table tbody');
    const loadingIndicator = document.getElementById('loading-models');
    const addModelBtn = document.getElementById('add-model-btn');
    const modal = document.getElementById('model-modal');
    const closeModalBtn = modal.querySelector('.close-btn');
    const modelForm = document.getElementById('model-form');
    const modalTitle = document.getElementById('modal-title');
    const modelIdInput = document.getElementById('model-id');
    const apiKeyInput = document.getElementById('model-api-key');
    const serviceSelect = document.getElementById('model-service');
    const otherServiceGroup = document.getElementById('other-service-group');

    // --- Modal Logic ---
    function openModalForCreate() {
        modal.style.display = 'block';
        modelForm.reset();
        modelIdInput.value = '';
        modalTitle.textContent = 'Add New Cloud Model';
        otherServiceGroup.style.display = 'none'; // Hide on create
        document.getElementById('model-service-other').required = false;
        apiKeyInput.placeholder = 'Enter your API key';
        apiKeyInput.required = true;
    }

    function openModalForEdit(model) {
        modal.style.display = 'block';
        modelForm.reset();
        modelIdInput.value = model.id;
        modalTitle.textContent = 'Edit Cloud Model';
        
        // Check if the service is one of the predefined options
        const isPredefined = [...serviceSelect.options].some(option => option.value === model.service);

        if (isPredefined) {
            serviceSelect.value = model.service;
            otherServiceGroup.style.display = 'none';
            document.getElementById('model-service-other').required = false;
        } else {
            // If it's a custom service, select "Other" and show the custom input
            serviceSelect.value = 'Other';
            otherServiceGroup.style.display = 'block';
            document.getElementById('model-service-other').value = model.service;
            document.getElementById('model-service-other').required = true;
        }

        document.getElementById('model-base-url').value = model.base_url;
        document.getElementById('model-name').value = model.model_name;

        apiKeyInput.placeholder = 'Leave blank to keep existing key';
        apiKeyInput.required = false;
    }

    function closeModal() {
        modal.style.display = 'none';
        modelIdInput.value = '';
        otherServiceGroup.style.display = 'none';
        document.getElementById('model-service-other').required = false;
    }

    addModelBtn.addEventListener('click', openModalForCreate);
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Show/hide custom service input
    serviceSelect.addEventListener('change', function() {
        const otherInput = document.getElementById('model-service-other');
        if (this.value === 'Other') {
            otherServiceGroup.style.display = 'block';
            otherInput.required = true;
        } else {
            otherServiceGroup.style.display = 'none';
            otherInput.required = false;
        }
    });

    // --- API Calls ---
    async function fetchModels() {
        try {
            const response = await fetch('/api/cloud_models');
            if (!response.ok) throw new Error('Failed to fetch models');
            const models = await response.json();
            renderModels(models);
        } catch (error) {
            console.error('Error fetching models:', error);
            modelsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--disconnected);">Error loading models.</td></tr>`;
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    async function saveModel(event) {
        event.preventDefault();
        const formData = new FormData(modelForm);
        const data = Object.fromEntries(formData.entries());

        if (data.service === 'Other' && data.service_other) {
            data.service = data.service_other;
        }
        delete data.service_other;

        const modelId = modelIdInput.value;
        const url = modelId ? `/api/cloud_models/update/${modelId}` : '/api/cloud_models/create';
        const method = 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `Failed to ${modelId ? 'update' : 'save'} model`);
            }
            closeModal();
            fetchModels(); // Refresh list
        } catch (error) {
            console.error('Error saving model:', error);
            alert(`Failed to save model: ${error.message}`);
        }
    }

    async function copyKey(modelId) {
        const copyBtn = document.querySelector(`tr[data-id="${modelId}"] .copy-key-btn`);
        if (!copyBtn) return;
 
        try {
            const response = await fetch(`/api/cloud_models/${modelId}`);
            if (!response.ok) throw new Error('Failed to fetch key');
            const modelDetails = await response.json();
            const fullKey = modelDetails.api_key;
 
            copyToClipboard(fullKey, copyBtn);
        } catch (error) {
            console.error('Error fetching API key:', error);
            alert('Could not retrieve the full API key.');
        }
    }
    async function deleteModel(modelId) {
        if (!confirm('Are you sure you want to delete this cloud model configuration?')) return;

        try {
            const response = await fetch(`/api/cloud_models/delete/${modelId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete model');
            fetchModels(); // Refresh list
        } catch (error) {
            console.error('Error deleting model:', error);
            alert('Failed to delete model.');
        }
    }

    async function toggleActive(modelId, isActive) {
        try {
            const response = await fetch(`/api/cloud_models/toggle_active/${modelId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: isActive }),
            });
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to toggle model status');
            }
            // No need to fetchModels() here as the UI is already updated.
            // This prevents the table from re-rendering and losing focus.
        } catch (error) {
            console.error('Error toggling model active state:', error);
            alert(`Failed to update model status: ${error.message}`);
            // Revert the toggle on error
            const toggle = document.querySelector(`tr[data-id="${modelId}"] .active-toggle`);
            if (toggle) toggle.checked = !isActive;
        }
    }

    function copyToClipboard(text, buttonElement) {
        navigator.clipboard.writeText(text).then(() => {
            const icon = buttonElement.querySelector('.material-icons');
            const originalIcon = icon.textContent;
            icon.textContent = 'done'; // Change to checkmark
            buttonElement.disabled = true;
            setTimeout(() => {
                icon.textContent = originalIcon; // Change back
                buttonElement.disabled = false;
            }, 1500);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy API key.');
        });
    }
    // --- Rendering ---
    function renderModels(models) {
        modelsTableBody.innerHTML = ''; // Clear existing rows

        if (models.length === 0) {
            modelsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No cloud models configured.</td></tr>';
            return;
        }

        models.forEach(model => {
            const displayUrl = model.base_url.length > 26 ? model.base_url.substring(0, 26) + '...' : model.base_url;
            const row = document.createElement('tr');
            row.dataset.id = model.id;
            row.innerHTML = `
                <td>${model.service}</td>
                <td>${model.model_name}</td>
                <td>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                        <span class="api-key-text" title="${model.base_url}">${displayUrl}</span>
                        <button class="copy-base_url-btn icon-btn" title="Copy Base URL">
                            <span class="material-icons">content_copy</span>
                        </button>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                        <span class="api-key-text">${model.api_key_partial || 'Not set'}</span>
                        <button class="copy-key-btn icon-btn" title="Copy Key">
                            <span class="material-icons">content_copy</span>
                        </button>
                    </div>
                </td>
                <td style="display: flex; align-items: center; gap: 1rem;">
                    <label class="switch" title="${model.active ? 'Deactivate' : 'Activate'} Model">
                        <input type="checkbox" class="active-toggle" ${model.active ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                    <button class="edit-model-btn icon-btn" title="Edit Model"><span class="material-icons">edit</span></button>
                    <button class="delete-model-btn icon-btn" title="Delete Model"><span class="material-icons">delete</span></button>
                </td>
            `;
            modelsTableBody.appendChild(row);

            // Add event listeners for the new buttons
            row.querySelector('.edit-model-btn').addEventListener('click', () => openModalForEdit(model));
            row.querySelector('.delete-model-btn').addEventListener('click', () => deleteModel(model.id));
            row.querySelector('.copy-key-btn').addEventListener('click', () => copyKey(model.id));
            row.querySelector('.copy-base_url-btn').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                copyToClipboard(model.base_url, btn);
            });
            row.querySelector('.active-toggle').addEventListener('change', (e) => {
                toggleActive(model.id, e.target.checked);
            });
        });
    }

    // --- Event Listeners ---
    modelForm.addEventListener('submit', saveModel);

    // Initial load
    fetchModels();

    // --- Column Resizing Logic ---
    const table = document.getElementById('cloud-models-table');
    const headers = table.querySelectorAll('th');

    headers.forEach(header => {
        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        header.appendChild(resizer);
        addResizer(resizer, header);
    });

    function addResizer(resizer, header) {
        let x = 0;
        let w = 0;

        const mouseDownHandler = function(e) {
            x = e.clientX;
            const styles = window.getComputedStyle(header);
            w = parseInt(styles.width, 10);

            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            resizer.classList.add('resizing');
        };

        const mouseMoveHandler = function(e) {
            const dx = e.clientX - x;
            header.style.width = `${w + dx}px`;
        };

        const mouseUpHandler = function() {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            resizer.classList.remove('resizing');
        };

        resizer.addEventListener('mousedown', mouseDownHandler);
    }
});