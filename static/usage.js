document.addEventListener('DOMContentLoaded', function() {
    const usageTableBody = document.querySelector('#usage-table tbody');
    const loadingIndicator = document.getElementById('loading-usage');
    const timeRangeButtons = document.querySelectorAll('.time-range-btn');

    async function fetchUsageData(range = '1d') {
        if (!usageTableBody || !loadingIndicator) return;

        loadingIndicator.style.display = 'block';
        usageTableBody.innerHTML = ''; // Clear previous data

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
            usageTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--disconnected);">${error.message}</td></tr>`;
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    function renderUsageData(data) {
        if (data.length === 0) {
            usageTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No usage data available for this period.</td></tr>';
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');
            const timestamp = new Date(item.timestamp + 'Z'); // Assume UTC

            // Truncate session ID for display
            const shortSessionId = item.session_id.substring(0, 8);

            row.innerHTML = `
                <td>${item.model_name}</td>
                <td><span class="category-badge ${item.model_category}">${item.model_category}</span></td>
                <td title="${item.session_id}">${shortSessionId}...</td>
                <td>${item.input_tokens}</td>
                <td>${item.output_tokens}</td>
                <td title="${timestamp.toLocaleString()}">${timeAgo(timestamp)}</td>
            `;
            usageTableBody.appendChild(row);
        });
    }

    timeRangeButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Update active button state
            timeRangeButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            const range = this.dataset.range;
            fetchUsageData(range);
        });
    });

    // Utility function to format time
    function timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    }

    // Initial load
    fetchUsageData('1d');
});