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
    const modelNamesContainer = document.getElementById('model-names-container');
    const addModelNameBtn = document.getElementById('add-model-name-btn');

    const servicesListEl = document.getElementById('services-list');
    const serviceDetailEl = document.getElementById('service-detail');
    const serviceFilterEl = document.getElementById('service-filter');

    let serviceLogoMap = {};
    let currentModels = [];
    let selectedServiceKey = null;
    // Restore previously selected service key on load (if available)
    try { selectedServiceKey = localStorage.getItem('cloud_models.selected_service') || null; } catch (_) {}
    const fullKeysCache = {};
    

    // --- Onload data fetching ---
    // Populate logo map from data attributes on the select options
    const serviceOptions = serviceSelect.querySelectorAll('option[data-logo]');
    serviceOptions.forEach(opt => {
        if (opt.value && opt.dataset.logo) {
            serviceLogoMap[opt.value] = opt.dataset.logo;
        }
    });
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
        modelNamesContainer.innerHTML = ''; // Clear previous
        addModelNameInput(); // Add one by default
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
        
        // Populate all model names for this service
        modelNamesContainer.innerHTML = '';
        model.model_names.forEach(name => {
            addModelNameInput(name);
        });

        apiKeyInput.placeholder = 'Leave blank to keep existing key';
        apiKeyInput.required = false;
    }

    function closeModal() {
        modal.style.display = 'none';
        modelIdInput.value = '';
        otherServiceGroup.style.display = 'none';
        document.getElementById('model-service-other').required = false;
        modelNamesContainer.innerHTML = '';
    }

    addModelBtn.addEventListener('click', openModalForCreate);
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // --- Dynamic Model Name Inputs ---
    function addModelNameInput(value = '') {
        const group = document.createElement('div');
        group.className = 'model-name-group';
        group.innerHTML = `
            <input type="text" name="model_names" required placeholder="e.g., gpt-5, llama-3, sonar" value="${value}">
            <button type="button" class="remove-model-name-btn icon-btn" title="Remove Model">&times;</button>
        `;
        modelNamesContainer.appendChild(group);

        group.querySelector('.remove-model-name-btn').addEventListener('click', () => {
            // Don't allow removing the last one
            if (modelNamesContainer.children.length > 1) {
                group.remove();
            }
        });
    }

    addModelNameBtn.addEventListener('click', () => addModelNameInput());





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
            let models = await response.json();

            // Group models by service configuration
            const groupedModels = {};
            models.forEach(m => {
                const key = `${m.service}::${m.base_url}`;
                if (!groupedModels[key]) groupedModels[key] = { ...m, model_names: [] };
                groupedModels[key].model_names.push(m.model_name);
            });
            models = Object.values(groupedModels);
            currentModels = models;
            renderModels(models);
            renderServicesList(models);
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
        
        // Handle multiple model names
        data.model_names = formData.getAll('model_names').filter(name => name.trim() !== '');
        delete data.model_name; // remove single entry if it exists

        if (data.service === 'Other' && data.service_other) {
            data.service = data.service_other;
        }
        delete data.service_other;
        delete data.model_id; // remove from payload

        const modelId = modelIdInput.value;
        const url = modelId ? `/api/cloud_models/update/${modelId}` : '/api/cloud_models/create';
        const method = 'POST';

        // Preserve selection using intended values after save
        try {
            const prospectiveKey = `${data.service}::${data.base_url}`;
            if (prospectiveKey && typeof prospectiveKey === 'string') {
                selectedServiceKey = prospectiveKey;
                try { localStorage.setItem('cloud_models.selected_service', selectedServiceKey); } catch(_) {}
            }
        } catch(_) {}

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

    async function toggleActive(model, isActive) {
        try {
            const response = await fetch(`/api/cloud_models/toggle_active/${model.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: isActive }),
            });
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to toggle model group status');
            }
            // No need to fetchModels() here as the UI is already updated.
            // This prevents the table from re-rendering and losing focus.
        } catch (error) {
            console.error('Error toggling model active state:', error);
            alert(`Failed to update model status: ${error.message}`);
            // Revert the toggle on error
            const toggle = document.querySelector(`tr[data-id="${model.id}"] .active-toggle`);
            if (toggle) toggle.checked = !isActive;
        }
    }

    async function toggleAllActive(isActive) {
        try {
            const response = await fetch('/api/cloud_models/toggle_all_active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: isActive }),
            });
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to toggle all models status');
            }
            // Update all visible toggles (legacy table)
            document.querySelectorAll('#cloud-models-table .active-toggle').forEach(toggle => {
                toggle.checked = isActive;
            });
            // Update header toggle if present
            const headerToggle = document.querySelector('.active-toggle-header');
            if (headerToggle) headerToggle.checked = isActive;
            // Update in-memory state so sidebar/detail reflect
            currentModels = currentModels.map(m => ({ ...m, active: isActive }));
            // Optionally refresh sidebar/detail selection
            renderServicesList(currentModels);
        } catch (error) {
            console.error('Error toggling all models active state:', error);
            alert(`Failed to update all models status: ${error.message}`);
            // Revert the master toggle on error
            const masterToggle = document.getElementById('toggle-all-active');
            if (masterToggle) {
                masterToggle.checked = !isActive;
            }
        }
    }

    function updateMasterToggleState() {
        const masterToggle = document.getElementById('toggle-all-active');
        if (!masterToggle) return;

        const allToggles = document.querySelectorAll('#cloud-models-table .active-toggle');
        const totalToggles = allToggles.length;
        if (totalToggles === 0) {
            masterToggle.checked = false;
            return;
        }

        const checkedCount = [...allToggles].filter(toggle => toggle.checked).length;
        // The master toggle is checked only if all individual toggles are checked.
        masterToggle.checked = totalToggles > 0 && checkedCount === totalToggles;
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
                <td>
                    <ul style="margin: 0; padding-left: 1.2rem;">
                        ${model.model_names.map(name => `<li>${name}</li>`).join('')}
                    </ul>
                </td>
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
                toggleActive(model, e.target.checked);
                // Update the master toggle's state after a short delay to allow the DOM to update.
                setTimeout(updateMasterToggleState, 100);
            });
        });
        updateMasterToggleState(); // Set initial state of master toggle after rendering
    }

    function renderServicesList(models) {
        if (!servicesListEl) return;
        const filter = (serviceFilterEl?.value || '').toLowerCase();
        servicesListEl.innerHTML = '';
        models
            .filter(m => m.service.toLowerCase().includes(filter))
            .sort((a,b) => (a.active === b.active) ? a.service.localeCompare(b.service) : (a.active ? -1 : 1))
            .forEach((m, idx) => {
                const li = document.createElement('li');
                li.className = 'service-item';
                const key = `${m.service}::${m.base_url}`;
                li.dataset.key = key;
                const statusClass = m.active ? 'status-active' : 'status-inactive';
                const statusText = m.active ? 'Active' : 'Inactive';                
                const logo = serviceLogoMap[m.service] || '';

                li.innerHTML = `
                    <span title="${m.base_url}" style="display:flex; align-items:center; gap:0.5rem;">${logo} ${m.service}</span>
                    <span class="status-tag ${statusClass}">${statusText}</span>
                `;
                if (selectedServiceKey && selectedServiceKey === key) {
                    li.classList.add('active');
                }
                li.addEventListener('click', (e) => {
                    document.querySelectorAll('.service-item').forEach(el => el.classList.remove('active'));
                    li.classList.add('active');
                    selectedServiceKey = key;
                    try { localStorage.setItem('cloud_models.selected_service', selectedServiceKey); } catch(_) {}
                    renderServiceDetail(m);
                });
                servicesListEl.appendChild(li);
            });

        // Ensure a selection exists
        let selectedModel = null;
        if (selectedServiceKey) {
            selectedModel = models.find(x => `${x.service}::${x.base_url}` === selectedServiceKey) || null;
        }
        if (!selectedModel) {
            if (models.length > 0) {
                selectedModel = models[0];
                selectedServiceKey = `${selectedModel.service}::${selectedModel.base_url}`;
                try { localStorage.setItem('cloud_models.selected_service', selectedServiceKey); } catch(_) {}
            }
        }
        document.querySelectorAll('.service-item').forEach(el => el.classList.remove('active'));
        if (selectedModel) {
            const selEl = servicesListEl.querySelector(`.service-item[data-key="${selectedServiceKey}"]`);
            if (selEl) selEl.classList.add('active');
            renderServiceDetail(selectedModel);
        } else {
            serviceDetailEl.innerHTML = '<div class="card-simple"><div style="color: var(--muted-foreground);">No services to display.</div></div>';
        }
    }

    serviceFilterEl?.addEventListener('input', () => renderServicesList(currentModels));

    function renderServiceDetail(model) {
        if (!serviceDetailEl) return;
        const displayUrl = model.base_url;
        const displayUrlTrunc = model.base_url.length > 26 ? model.base_url.substring(0,26) + '...' : model.base_url;
        const statusClass = model.active ? 'status-active' : 'status-inactive';
        const statusText = model.active ? 'Active' : 'Inactive';

        const logo = serviceLogoMap[model.service] || '';
        const keyMasked = model.api_key_partial || 'Not set';
        const modelKey = model.id;
        const showFull = false;

        serviceDetailEl.innerHTML = `
            <div class="card-simple">
                <div class="detail-header">
                    <h3 style="margin:0; display:flex; align-items:center; gap:0.5rem;">${logo} ${model.service} <span class="status-tag ${statusClass}" id="detail-status-tag">${statusText}</span></h3>
                    <div class="icon-actions">
                        <label class="switch" title="${model.active ? 'Deactivate' : 'Activate'} Model Group" style="margin-right:0.5rem;">
                            <input type="checkbox" class="active-toggle-header" ${model.active ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                        <button class="icon-btn small" title="Edit" data-action="edit"><span class="material-icons">edit</span></button>
                        <button class="icon-btn small" title="Delete" data-action="delete"><span class="material-icons">delete</span></button>
                    </div>
                </div>
                <div class="detail-grid" style="margin-top: 1rem;">
                    <div class="kv" id="kv-url"><span>Base URL</span><span class="mono" title="${displayUrl}" id="base-url-text">${displayUrlTrunc}</span></div>
                    <div class="kv" id="kv-key"><span>API Key</span><span class="mono" id="api-key-text">${keyMasked}</span></div>
                </div>
            </div>
            <div class="card-simple">
                <div class="detail-header"><h4 style="margin:0;">Models</h4><button class="send-button" id="add-model-name-inline" style="height:auto; padding:0.25rem 0.75rem;">Add</button></div>
                <div class="models-list" id="models-list"></div>
            </div>
        `;

        serviceDetailEl.querySelector('[data-action="edit"]').addEventListener('click', () => openModalForEdit(model));
        serviceDetailEl.querySelector('[data-action="delete"]').addEventListener('click', () => deleteModel(model.id));
        const headerToggle = serviceDetailEl.querySelector('.active-toggle-header');
        headerToggle.addEventListener('change', (e) => {
            const on = e.target.checked;
            toggleActive(model, on);
            model.active = on;
            currentModels = currentModels.map(m => m.id === model.id ? { ...m, active: on } : m);
            const tableRowToggle = document.querySelector(`tr[data-id="${model.id}"] .active-toggle`);
            if (tableRowToggle) tableRowToggle.checked = on;
            const tag = document.getElementById('detail-status-tag');
            if (tag) {
                tag.textContent = on ? 'Active' : 'Inactive';
                tag.classList.toggle('status-active', on);
                tag.classList.toggle('status-inactive', !on);
            }
            renderServicesList(currentModels);
            setTimeout(updateMasterToggleState, 100);
        });

        const kvUrl = serviceDetailEl.querySelector('#kv-url');
        const copyBaseBtn = document.createElement('button');
        copyBaseBtn.className = 'icon-btn small';
        copyBaseBtn.title = 'Copy Base URL';
        copyBaseBtn.innerHTML = '<span class="material-icons">content_copy</span>';
        kvUrl.appendChild(copyBaseBtn);
        copyBaseBtn.addEventListener('click', (e) => {
            copyToClipboard(model.base_url, copyBaseBtn);
        });

        const kvKey = serviceDetailEl.querySelector('#kv-key');
        const apiKeyTextEl = serviceDetailEl.querySelector('#api-key-text');
        const copyKeyBtn = document.createElement('button');
        copyKeyBtn.className = 'icon-btn small';
        copyKeyBtn.title = 'Copy API Key';
        copyKeyBtn.innerHTML = '<span class="material-icons">content_copy</span>';
        kvKey.appendChild(copyKeyBtn);
        copyKeyBtn.addEventListener('click', async () => {
            try {
                if (!fullKeysCache[modelKey]) {
                    const resp = await fetch(`/api/cloud_models/${modelKey}`);
                    if (!resp.ok) throw new Error('Failed to fetch key');
                    const details = await resp.json();
                    fullKeysCache[modelKey] = details.api_key || '';
                }
                const toCopy = fullKeysCache[modelKey] || '';
                if (!toCopy) throw new Error('API key not set');
                copyToClipboard(toCopy, copyKeyBtn);
            } catch (e) {
                alert('Could not retrieve the full API key.');
            }
        });

        const listEl = serviceDetailEl.querySelector('#models-list');
        function drawModels() {
            listEl.innerHTML = '';
            model.model_names.forEach(name => {
                const row = document.createElement('div');
                row.className = 'model-row';
                row.innerHTML = `
                    <span class="mono" title="${name}">${name}</span>
                    <div class="icon-actions">
                        <button class="icon-btn small" data-action="delete-model" data-name="${name}" title="${model.model_names.length <= 1 ? 'Cannot delete the only model' : 'Delete'}" ${model.model_names.length <= 1 ? 'disabled' : ''} style="${model.model_names.length <= 1 ? 'opacity:0.5; cursor:not-allowed;' : ''}"><span class="material-icons">delete</span></button>
                    </div>
                `;
                listEl.appendChild(row);
            });
            listEl.querySelectorAll('[data-action="delete-model"]').forEach(el => {
                el.addEventListener('click', async (e) => {
                    if (model.model_names.length <= 1) {
                        alert('At least one model is required for this service.');
                        return;
                    }
                    const name = e.currentTarget.getAttribute('data-name');
                    if (!confirm(`Remove model "${name}" from this service?`)) return;
                    const remaining = model.model_names.filter(n => n !== name);
                    try {
                        const payload = { service: model.service, base_url: model.base_url, api_key: '', model_names: remaining };
                        const resp = await fetch(`/api/cloud_models/update/${model.id}`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                        });
                        const result = await resp.json();
                        if (!resp.ok) throw new Error(result.error || 'Failed to update');
                        model.model_names = remaining;
                        drawModels();
                        fetchModels();
                    } catch (err) {
                        alert(`Failed to delete model name: ${err.message}`);
                    }
                });
            });
        }
        drawModels();

        const addInlineBtn = serviceDetailEl.querySelector('#add-model-name-inline');
        addInlineBtn.addEventListener('click', () => {
            const existing = serviceDetailEl.querySelector('.inline-add-popup');
            if (existing) existing.remove();
            const existingBackdrop = serviceDetailEl.querySelector('.inline-add-backdrop');
            if (existingBackdrop) existingBackdrop.remove();

            const backdrop = document.createElement('div');
            backdrop.className = 'inline-add-backdrop';
            backdrop.style.position = 'fixed';
            backdrop.style.top = '0';
            backdrop.style.left = '0';
            backdrop.style.width = '100vw';
            backdrop.style.height = '100vh';
            backdrop.style.background = 'rgba(0,0,0,0.35)';
            backdrop.style.zIndex = '999';
            serviceDetailEl.appendChild(backdrop);
            const popup = document.createElement('div');
            popup.className = 'inline-add-popup';
            popup.style.position = 'fixed';
            popup.style.background = 'var(--card)';
            popup.style.border = '1px solid var(--border)';
            popup.style.borderRadius = '8px';
            popup.style.padding = '0.75rem';
            popup.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
            popup.style.zIndex = '1000';
            popup.style.top = '50%';
            popup.style.left = '50%';
            popup.style.transform = 'translate(-50%, -50%)';
            popup.style.width = 'min(92vw, 520px)';
            popup.style.maxHeight = '80vh';
            popup.style.overflow = 'auto';
            popup.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:0.75rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <span class="material-icons" style="font-size:20px; color: var(--muted-foreground);">playlist_add</span>
                            <strong>Add Model Names</strong>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <button class="icon-btn small inline-cancel" title="Close"><span class="material-icons">close</span></button>
                        </div>
                    </div>
                    <div style="height:1px; background: var(--border);"></div>
                    <div>
                        <div style="font-weight:600; font-size:0.9rem; color: var(--muted-foreground); margin-bottom: 0.25rem;">Existing Models</div>
                        <div class="existing-models-chips" style="display:flex; flex-wrap:wrap; gap:0.4rem;">
                            ${model.model_names.map(n => `
                                <span class=\"chip\" data-name=\"${n}\" style=\"display:inline-flex; align-items:center; gap:0.35rem; padding:0.2rem 0.5rem; font-size:0.8rem; background: var(--muted); color: var(--foreground); border: 1px solid var(--border); border-radius: 999px;\">
                                    <span>${n}</span>
                                    <button class=\"icon-btn small chip-remove\" title=\"Remove\" data-name=\"${n}\" style=\"width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center;\"><span class=\"material-icons\" style=\"font-size:16px;\">close</span></button>
                                </span>
                            `).join('')}
                        </div>
                    </div>
                    <div class="inline-models-container" style="display:flex; flex-direction:column; gap:0.5rem; background: var(--muted); padding:0.5rem; border-radius:8px;"></div>
                    <button class="send-button inline-add-field" style="align-self: flex-start; padding: 0.5rem 1rem; font-size: 0.8rem; height: auto; width: auto; border-radius: var(--radius-md); margin-top: 0.5rem;">Add Another</button>
                    <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                        <button class="send-button inline-save" style="height:auto; padding:0.35rem 0.9rem;">Save</button>
                    </div>
                </div>
            `;
            serviceDetailEl.appendChild(popup);
            const list = popup.querySelector('.inline-models-container');
            const addFieldBtn = popup.querySelector('.inline-add-field');
            const saveBtn = popup.querySelector('.inline-save');
            const cancelBtn = popup.querySelector('.inline-cancel');
            const chipsEl = popup.querySelector('.existing-models-chips');
            const removedExisting = new Set();
            const cleanup = () => { popup.remove(); backdrop.remove(); };
            backdrop.addEventListener('click', cleanup);
            cancelBtn.addEventListener('click', cleanup);
            popup.addEventListener('keydown', (e) => { if (e.key === 'Escape') cleanup(); });
            const addField = (value = '') => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.gap = '0.5rem';
                row.style.alignItems = 'center';
                row.innerHTML = `
                    <input type="text" placeholder="Model name" class="inline-model-input" value="${value}" style="flex:1; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background: var(--card); color: var(--foreground);">
                    <button class="icon-btn small remove-inline-model" title="Remove"><span class="material-icons">close</span></button>
                `;
                list.appendChild(row);
                const removeBtn = row.querySelector('.remove-inline-model');
                removeBtn.addEventListener('click', () => {
                    if (list.children.length > 1) row.remove();
                });
                return row.querySelector('.inline-model-input');
            };
            // Initialize with one input
            const firstInput = addField('');
            addFieldBtn.addEventListener('click', () => {
                const input = addField('');
                setTimeout(() => input.focus(), 0);
            });

            // Handle existing chip remove toggles
            chipsEl.querySelectorAll('.chip-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const name = e.currentTarget.getAttribute('data-name');
                    const chip = chipsEl.querySelector(`.chip[data-name="${name}"]`);
                    // Calculate prospective kept + new additions to ensure at least one remains
                    const prospectiveRemoved = new Set(removedExisting);
                    if (!prospectiveRemoved.has(name)) prospectiveRemoved.add(name); else prospectiveRemoved.delete(name);
                    const keptExisting = model.model_names.filter(n => !prospectiveRemoved.has(n));
                    const inputs = [...popup.querySelectorAll('.inline-model-input')];
                    let newNames = [...new Set(inputs.map(i => (i.value || '').trim()).filter(Boolean))];
                    // Remove duplicates with existing kept
                    newNames = newNames.filter(n => !keptExisting.includes(n));
                    if ((keptExisting.length + newNames.length) <= 0) {
                        alert('At least one model is required for this service.');
                        return;
                    }
                    const isRemoving = !removedExisting.has(name);
                    if (isRemoving) {
                        removedExisting.add(name);
                        chip.style.opacity = '0.5';
                        chip.style.textDecoration = 'line-through';
                    } else {
                        removedExisting.delete(name);
                        chip.style.opacity = '';
                        chip.style.textDecoration = '';
                    }
                });
            });
            const doSave = async () => {
                const inputs = [...popup.querySelectorAll('.inline-model-input')];
                let names = inputs.map(i => (i.value || '').trim()).filter(Boolean);
                // Remove duplicates within new entries
                names = [...new Set(names)];
                // Compute kept existing after removals
                const keptExisting = model.model_names.filter(n => !removedExisting.has(n));
                // Filter already existing names
                const toAdd = names.filter(n => !keptExisting.includes(n));
                if ((keptExisting.length + toAdd.length) <= 0) {
                    alert('At least one model is required for this service.');
                    return;
                }
                try {
                    const updated = [...keptExisting, ...toAdd];
                    const payload = { service: model.service, base_url: model.base_url, api_key: '', model_names: updated };
                    const resp = await fetch(`/api/cloud_models/update/${model.id}`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                    });
                    const result = await resp.json();
                    if (!resp.ok) throw new Error(result.error || 'Failed to update');
                    model.model_names = updated;
                    drawModels();
                    fetchModels();
                    cleanup();
                } catch (err) {
                    alert(`Failed to add model name: ${err.message}`);
                }
            };
            saveBtn.addEventListener('click', doSave);
            popup.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); });
            setTimeout(() => firstInput.focus(), 0);
        });
    }

    // --- Event Listeners ---
    modelForm.addEventListener('submit', saveModel);

    const toggleAllCheckbox = document.getElementById('toggle-all-active');
    if (toggleAllCheckbox) {
        toggleAllCheckbox.addEventListener('change', (e) => toggleAllActive(e.target.checked));
    }

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