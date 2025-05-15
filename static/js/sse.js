// Server-Sent Events (SSE) handler for CrisisConnect

document.addEventListener('DOMContentLoaded', function() {
    // Set up SSE connection for real-time updates
    setupEventSource();
});

// Set up Server-Sent Events connection
function setupEventSource() {
    if (typeof EventSource === 'undefined') {
        console.warn('Server-Sent Events not supported by your browser.');
        return;
    }

    // Track if we are deliberately closing the connection
    let intentionalClose = false;
    let connectionAttempts = 0;
    const maxRetries = 5;

    // Create a new EventSource connection
    const evtSource = new EventSource('http://' + window.location.hostname + ':5000/stream/stream');
    console.log('Connecting to SSE stream...');

    // Listen for new incidents
    evtSource.addEventListener('new-incident', function(event) {
        const incident = JSON.parse(event.data);
        displayNotification(`New Incident: ${incident.title}`, incident.severity);
        updateIncidentCounters(1);

        // Add to incident list if on incidents page
        const incidentsList = document.getElementById('incidents-list');
        if (incidentsList) {
            addIncidentToList(incident, incidentsList);
        }

        // Add to map if available
        if (window.addIncidentMarker && window.map) {
            window.addIncidentMarker(incident);
        }
    });

    // Listen for incident updates
    evtSource.addEventListener('incident-update', function(event) {
        const update = JSON.parse(event.data);
        displayNotification(`Incident #${update.incident_id} Updated`, 'info');

        // Update incident in list if visible
        updateIncidentInList(update.incident_id, update.update_text);
    });

    // Listen for resource allocations
    evtSource.addEventListener('resource-allocation', function(event) {
        const allocation = JSON.parse(event.data);
        displayNotification(`Resources Allocated to Incident #${allocation.incident_id}`, 'success');
    });

    // Listen for status changes
    evtSource.addEventListener('status-change', function(event) {
        const statusUpdate = JSON.parse(event.data);
        displayNotification(`Incident #${statusUpdate.incident_id} Status Changed to ${statusUpdate.new_status}`, 'warning');

        // Update incident in list if visible
        updateIncidentStatusInList(statusUpdate.incident_id, statusUpdate.new_status);

        // Update counters if status changed to resolved
        if (statusUpdate.new_status === 'resolved') {
            updateIncidentCounters(-1);
        }
    });

    // Listen for message events (including keepalive and connection messages)
    evtSource.addEventListener('message', function(event) {
        try {
            const data = JSON.parse(event.data);

            // Check if we received a timeout message
            if (data.message && data.message.includes('timeout') || data.message.includes('ended')) {
                console.log('Server-side timeout received, will reconnect automatically');
                intentionalClose = true;
                evtSource.close();
                // Reset connection attempts since this is an expected timeout
                connectionAttempts = 0;
                // Reconnect immediately for timeout messages
                setTimeout(setupEventSource, 100);
            }

            // Reset connection attempts on any successful message
            connectionAttempts = 0;
        } catch (e) {
            console.warn('Could not parse message data:', event.data);
        }
    });

    // General error handler
    evtSource.onerror = function(error) {
        console.error('EventSource error:', error);

        // If this wasn't an intentional close, try to reconnect with exponential backoff
        if (!intentionalClose) {
            connectionAttempts++;
            if (connectionAttempts <= maxRetries) {
                const backoffTime = Math.min(1000 * Math.pow(2, connectionAttempts), 30000);
                console.log(`SSE connection attempt ${connectionAttempts}/${maxRetries}, retrying in ${backoffTime/1000} seconds`);
                setTimeout(setupEventSource, backoffTime);
            } else {
                console.error('Maximum SSE reconnection attempts reached. Please refresh the page.');
                displayNotification('Connection lost. Please refresh the page.', 'error');
            }
        }

        evtSource.close();
    };
}

// Display a notification toast
function displayNotification(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }

    // Map severity to Bootstrap color
    let colorClass = 'bg-info';
    if (type === 'critical') colorClass = 'bg-danger';
    else if (type === 'high') colorClass = 'bg-warning text-dark';
    else if (type === 'medium') colorClass = 'bg-primary';
    else if (type === 'low') colorClass = 'bg-info';
    else if (type === 'success') colorClass = 'bg-success';
    else if (type === 'warning') colorClass = 'bg-warning text-dark';
    else if (type === 'danger') colorClass = 'bg-danger';

    // Create toast
    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.className = `toast ${colorClass} text-white`;
    toast.id = toastId;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    toast.innerHTML = `
        <div class="toast-header">
            <strong class="me-auto">CrisisConnect Alert</strong>
            <small>Just now</small>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;

    // Append toast to container
    toastContainer.appendChild(toast);

    // Initialize and show toast
    const toastInstance = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 5000
    });
    toastInstance.show();

    // Play notification sound
    playNotificationSound(type);

    // Remove toast after it's hidden
    toast.addEventListener('hidden.bs.toast', function() {
        toast.remove();
    });
}

// Play notification sound based on type
function playNotificationSound(type) {
    let soundId = 'notification-sound';

    if (type === 'critical') soundId = 'critical-sound';
    else if (type === 'high' || type === 'warning') soundId = 'warning-sound';
    else if (type === 'success') soundId = 'success-sound';

    const sound = document.getElementById(soundId);
    if (sound) {
        sound.play().catch(e => {
            console.warn('Unable to play notification sound:', e);
        });
    }
}

// Add an incident to the incidents list
function addIncidentToList(incident, list) {
    // Create incident item
    const item = document.createElement('div');
    item.className = 'card mb-3 shadow-sm animate__animated animate__fadeIn';
    item.setAttribute('data-incident-id', incident.incident_id);

    // Get severity class
    const severityClass = getSeverityBadgeClass(incident.severity);

    item.innerHTML = `
        <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h5 class="card-title">${incident.title}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">${incident.location}</h6>
                </div>
                <span class="badge bg-${severityClass}">${incident.severity.toUpperCase()}</span>
            </div>
            <div class="card-text mt-2">
                <small class="text-muted">Reported ${incident.timestamp}</small>
            </div>
            <a href="/incidents/${incident.incident_id}" class="stretched-link"></a>
        </div>
    `;

    // Add to the beginning of the list
    list.insertBefore(item, list.firstChild);
}

// Update an incident in the list
function updateIncidentInList(incidentId, updateText) {
    const item = document.querySelector(`[data-incident-id="${incidentId}"]`);
    if (!item) return;

    // Add an update badge if not already present
    let updateBadge = item.querySelector('.update-badge');
    if (updateBadge) {
        // Increment the count
        const count = parseInt(updateBadge.textContent) + 1;
        updateBadge.textContent = count;
    } else {
        // Create a new badge
        const badgeContainer = document.createElement('div');
        badgeContainer.className = 'mt-2';
        badgeContainer.innerHTML = `<span class="badge bg-info update-badge">1</span> <small>new update</small>`;

        // Add to the card
        const cardText = item.querySelector('.card-text');
        if (cardText) {
            cardText.appendChild(badgeContainer);
        }
    }

    // Add animation to highlight the update
    item.classList.add('border-info', 'animate__animated', 'animate__pulse');

    // Remove animation classes after animation completes
    setTimeout(() => {
        item.classList.remove('animate__animated', 'animate__pulse');
    }, 1000);
}

// Update incident status in the list
function updateIncidentStatusInList(incidentId, newStatus) {
    const item = document.querySelector(`[data-incident-id="${incidentId}"]`);
    if (!item) return;

    // Add or update status badge
    let statusBadge = item.querySelector('.status-badge');
    const statusClass = getStatusBadgeClass(newStatus);

    if (statusBadge) {
        // Update existing badge
        statusBadge.className = `badge status-badge bg-${statusClass}`;
        statusBadge.textContent = formatStatus(newStatus);
    } else {
        // Create a new badge
        const badgeContainer = document.createElement('span');
        badgeContainer.className = 'ms-2';
        badgeContainer.innerHTML = `<span class="badge status-badge bg-${statusClass}">${formatStatus(newStatus)}</span>`;

        // Add to the card
        const severityBadge = item.querySelector('.badge');
        if (severityBadge) {
            severityBadge.parentNode.insertBefore(badgeContainer, severityBadge.nextSibling);
        }
    }

    // Add animation to highlight the update
    item.classList.add('animate__animated', 'animate__pulse');

    // Remove animation classes after animation completes
    setTimeout(() => {
        item.classList.remove('animate__animated', 'animate__pulse');
    }, 1000);

    // If resolved, add a resolved overlay
    if (newStatus === 'resolved') {
        item.classList.add('opacity-75');

        // Add resolved overlay
        const overlay = document.createElement('div');
        overlay.className = 'position-absolute top-0 end-0 p-2';
        overlay.innerHTML = '<span class="badge bg-success">RESOLVED</span>';

        item.style.position = 'relative';
        item.appendChild(overlay);
    }
}

// Update incident counters on the dashboard
function updateIncidentCounters(change) {
    const totalCounter = document.getElementById('total-incidents-counter');
    if (totalCounter) {
        const currentCount = parseInt(totalCounter.textContent);
        totalCounter.textContent = currentCount + change;
    }

    const activeCounter = document.getElementById('active-incidents-counter');
    if (activeCounter) {
        const currentCount = parseInt(activeCounter.textContent);
        activeCounter.textContent = currentCount + change;
    }
}

// Get Bootstrap badge class for severity
function getSeverityBadgeClass(severity) {
    switch (severity.toLowerCase()) {
        case 'critical':
            return 'danger';
        case 'high':
            return 'warning';
        case 'medium':
            return 'primary';
        case 'low':
            return 'info';
        default:
            return 'secondary';
    }
}

// Get Bootstrap badge class for status
function getStatusBadgeClass(status) {
    switch (status.toLowerCase()) {
        case 'reported':
            return 'secondary';
        case 'validated':
            return 'info';
        case 'in_progress':
            return 'primary';
        case 'resolved':
            return 'success';
        default:
            return 'secondary';
    }
}

// Format status for display
function formatStatus(status) {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
}