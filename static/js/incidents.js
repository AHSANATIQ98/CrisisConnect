// Incident management functionality for CrisisConnect

document.addEventListener('DOMContentLoaded', function() {
    // Initialize filter functionality
    setupFilters();
    
    // Setup resource recommendation functionality
    setupResourceRecommendations();
    
    // Setup real-time updates for incident details
    setupIncidentUpdates();
});

// Setup incident filter functionality
function setupFilters() {
    const filterForm = document.getElementById('incident-filter-form');
    if (!filterForm) return;
    
    // Update incidents when filters change
    const filterInputs = filterForm.querySelectorAll('select');
    filterInputs.forEach(input => {
        input.addEventListener('change', function() {
            filterForm.submit();
        });
    });
    
    // Clear filters button
    const clearFiltersBtn = document.getElementById('clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            filterInputs.forEach(input => {
                input.value = 'all';
            });
            
            filterForm.submit();
        });
    }
}

// Setup resource recommendation functionality
function setupResourceRecommendations() {
    const recommendBtn = document.getElementById('recommend-resources');
    if (!recommendBtn) return;
    
    recommendBtn.addEventListener('click', function() {
        const incidentId = this.getAttribute('data-incident-id');
        if (!incidentId) return;
        
        // Show loading indicator
        const recommendationsContainer = document.getElementById('resource-recommendations');
        if (recommendationsContainer) {
            recommendationsContainer.innerHTML = '<div class="d-flex justify-content-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading recommendations...</span></div></div>';
        }
        
        // Fetch recommendations from API
        fetch(`/api/incidents/${incidentId}/recommend-resources`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    recommendationsContainer.innerHTML = `<div class="alert alert-warning">${data.error}</div>`;
                    return;
                }
                
                // Create recommendations display
                const priorityBadgeClass = getPriorityBadgeClass(data.priority_level);
                
                let recommendationsHtml = `
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">AI Recommended Resources</h5>
                            <span class="badge bg-${priorityBadgeClass}">${data.priority_level.toUpperCase()} PRIORITY</span>
                        </div>
                        <div class="card-body">
                `;
                
                // Add recommendations
                if (data.recommendations && data.recommendations.length > 0) {
                    recommendationsHtml += '<div class="table-responsive"><table class="table table-hover">';
                    recommendationsHtml += '<thead><tr><th>Resource</th><th>Quantity</th><th>Rationale</th><th>Action</th></tr></thead><tbody>';
                    
                    data.recommendations.forEach(rec => {
                        recommendationsHtml += `
                            <tr>
                                <td>${rec.resource_name}</td>
                                <td>${rec.quantity}</td>
                                <td>${rec.rationale}</td>
                                <td>
                                    <button class="btn btn-sm btn-primary allocate-resource-btn" 
                                        data-resource-id="${rec.resource_id}"
                                        data-resource-name="${rec.resource_name}"
                                        data-quantity="${rec.quantity}">
                                        Allocate
                                    </button>
                                </td>
                            </tr>
                        `;
                    });
                    
                    recommendationsHtml += '</tbody></table></div>';
                } else {
                    recommendationsHtml += '<p>No specific resources recommended.</p>';
                }
                
                // Add resource gaps
                if (data.resource_gaps && data.resource_gaps.length > 0) {
                    recommendationsHtml += '<div class="mt-3"><h6>Resource Gaps Identified:</h6><ul>';
                    
                    data.resource_gaps.forEach(gap => {
                        recommendationsHtml += `<li>${gap}</li>`;
                    });
                    
                    recommendationsHtml += '</ul></div>';
                }
                
                recommendationsHtml += '</div></div>';
                
                // Update the container
                recommendationsContainer.innerHTML = recommendationsHtml;
                
                // Set up allocate buttons
                const allocateButtons = document.querySelectorAll('.allocate-resource-btn');
                allocateButtons.forEach(button => {
                    button.addEventListener('click', function() {
                        const resourceId = this.getAttribute('data-resource-id');
                        const resourceName = this.getAttribute('data-resource-name');
                        const quantity = this.getAttribute('data-quantity');
                        
                        // Populate and show the allocation modal
                        const modal = document.getElementById('allocate-resource-modal');
                        if (modal) {
                            document.getElementById('resource-id').value = resourceId;
                            document.getElementById('incident-id').value = incidentId;
                            document.getElementById('quantity').value = quantity;
                            document.getElementById('resource-name-display').textContent = resourceName;
                            
                            const bsModal = new bootstrap.Modal(modal);
                            bsModal.show();
                        }
                    });
                });
            })
            .catch(error => {
                console.error('Error getting resource recommendations:', error);
                recommendationsContainer.innerHTML = '<div class="alert alert-danger">Error loading recommendations</div>';
            });
    });
}

// Setup real-time updates for incident details
function setupIncidentUpdates() {
    if (typeof EventSource === 'undefined') {
        console.warn('Server-Sent Events not supported by your browser.');
        return;
    }
    
    // Get incident ID from the page
    const incidentDetailContainer = document.getElementById('incident-detail');
    if (!incidentDetailContainer) return;
    
    const incidentId = incidentDetailContainer.getAttribute('data-incident-id');
    if (!incidentId) return;
    
    // Track connection state
    let intentionalClose = false;
    let connectionAttempts = 0;
    const maxRetries = 5;
    
    // Create a new SSE connection
    const evtSource = new EventSource('/stream/stream');
    console.log('Connecting to SSE stream for incident updates...');
    
    // Listen for incident updates
    evtSource.addEventListener('incident-update', function(event) {
        const update = JSON.parse(event.data);
        
        // Check if update is for current incident
        if (parseInt(update.incident_id) === parseInt(incidentId)) {
            addUpdateToList(update);
        }
        
        // Reset connection attempts on any successful message
        connectionAttempts = 0;
    });
    
    // Listen for resource allocations
    evtSource.addEventListener('resource-allocation', function(event) {
        const allocation = JSON.parse(event.data);
        
        // Check if allocation is for current incident
        if (parseInt(allocation.incident_id) === parseInt(incidentId)) {
            addResourceAllocationToList(allocation);
        }
        
        // Reset connection attempts on any successful message
        connectionAttempts = 0;
    });
    
    // Listen for message events (including keepalive and connection messages)
    evtSource.addEventListener('message', function(event) {
        try {
            const data = JSON.parse(event.data);
            
            // Check if we received a timeout message
            if (data.message && (data.message.includes('timeout') || data.message.includes('ended'))) {
                console.log('Server-side timeout received, will reconnect automatically');
                intentionalClose = true;
                evtSource.close();
                // Reset connection attempts since this is an expected timeout
                connectionAttempts = 0;
                // Reconnect immediately for timeout messages
                setTimeout(setupIncidentUpdates, 100);
            }
            
            // Reset connection attempts on any successful message
            connectionAttempts = 0;
        } catch (e) {
            console.warn('Could not parse message data:', event.data);
        }
    });
    
    // Error handler
    evtSource.onerror = function(error) {
        console.error('EventSource error:', error);
        
        // If this wasn't an intentional close, try to reconnect with exponential backoff
        if (!intentionalClose) {
            connectionAttempts++;
            if (connectionAttempts <= maxRetries) {
                const backoffTime = Math.min(1000 * Math.pow(2, connectionAttempts), 30000);
                console.log(`SSE connection attempt ${connectionAttempts}/${maxRetries}, retrying in ${backoffTime/1000} seconds`);
                setTimeout(setupIncidentUpdates, backoffTime);
            } else {
                console.error('Maximum SSE reconnection attempts reached. Please refresh the page.');
                alert('Connection to server lost. Please refresh the page to continue receiving updates.');
            }
        }
        
        evtSource.close();
    };
}

// Add update to the updates list
function addUpdateToList(update) {
    const updatesList = document.getElementById('incident-updates');
    if (!updatesList) return;
    
    const updateItem = document.createElement('div');
    updateItem.className = 'card mb-2 border-left-primary animate__animated animate__fadeIn';
    updateItem.innerHTML = `
        <div class="card-body py-2 px-3">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <p class="mb-1">${update.update_text}</p>
                    <small class="text-muted">By ${update.user}</small>
                </div>
                <small class="text-muted">${update.timestamp}</small>
            </div>
        </div>
    `;
    
    // Add to the top of the list
    updatesList.insertBefore(updateItem, updatesList.firstChild);
    
    // Play update sound if available
    const updateSound = document.getElementById('update-sound');
    if (updateSound) {
        updateSound.play().catch(e => {
            console.warn('Unable to play update sound:', e);
        });
    }
}

// Add resource allocation to the allocations list
function addResourceAllocationToList(allocation) {
    const allocsList = document.getElementById('resource-allocations');
    if (!allocsList) return;
    
    const allocItem = document.createElement('div');
    allocItem.className = 'alert alert-success animate__animated animate__fadeIn';
    allocItem.innerHTML = `
        <strong>${allocation.quantity} ${allocation.resource_name}</strong> allocated by ${allocation.responder}
    `;
    
    // Add to the top of the list
    allocsList.insertBefore(allocItem, allocsList.firstChild);
    
    // Play allocation sound if available
    const allocationSound = document.getElementById('allocation-sound');
    if (allocationSound) {
        allocationSound.play().catch(e => {
            console.warn('Unable to play allocation sound:', e);
        });
    }
}

// Get Bootstrap class for priority level
function getPriorityBadgeClass(priority) {
    switch (priority.toLowerCase()) {
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
