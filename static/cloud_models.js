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
            modelsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--disconnected);">Error loading models.</td></tr>`;
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

    // --- Rendering ---
    function renderModels(models) {
        modelsTableBody.innerHTML = ''; // Clear existing rows

        if (models.length === 0) {
            modelsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No cloud models configured.</td></tr>';
            return;
        }

        models.forEach(model => {
            const row = document.createElement('tr');
            row.dataset.id = model.id;
            row.innerHTML = `
                <td>${model.service}</td>
                <td>${model.model_name}</td>
                <td>${model.base_url}</td>
                <td>${model.api_key_partial || 'Not set'}</td>
                <td>
                    <button class="edit-model-btn icon-btn" title="Edit Model">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="delete-model-btn icon-btn" title="Delete Model">
                        <span class="material-icons">delete</span>
                    </button>
                </td>
            `;
            modelsTableBody.appendChild(row);

            // Add event listeners for the new buttons
            row.querySelector('.edit-model-btn').addEventListener('click', () => openModalForEdit(model));
            row.querySelector('.delete-model-btn').addEventListener('click', () => deleteModel(model.id));
        });
    }

    // --- Event Listeners ---
    modelForm.addEventListener('submit', saveModel);

    // Initial load
    fetchModels();
});