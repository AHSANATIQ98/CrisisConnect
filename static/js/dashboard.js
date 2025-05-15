// Dashboard functionality for CrisisConnect

// Initialize dashboard elements
document.addEventListener('DOMContentLoaded', function() {
    // Initialize incident distribution chart
    initializeIncidentChart();
    
    // Initialize severity distribution chart
    initializeSeverityChart();
    
    // Set up real-time event listeners
    setupEventSource();
});

// Initialize incident type distribution chart
function initializeIncidentChart() {
    const incidentChartEl = document.getElementById('incidentTypeChart');
    if (!incidentChartEl) return;
    
    // Extract data from the page
    const dataContainer = document.getElementById('incident-type-data');
    if (!dataContainer) return;
    
    try {
        // Parse data from the server
        let incidentData = {};
        try {
            incidentData = JSON.parse(dataContainer.getAttribute('data-incident-types') || '{}');
        } catch (e) {
            console.warn('Unable to parse incident type data');
        }
        
        // If we have no data, show a message instead of an empty chart
        if (Object.keys(incidentData).length === 0) {
            incidentChartEl.parentElement.innerHTML = '<div class="alert alert-secondary text-center"><i class="bi bi-info-circle"></i> No incident data available</div>';
            return;
        }
        
        const labels = Object.keys(incidentData).map(formatIncidentType);
        const data = Object.values(incidentData);
        
        // Generate colors dynamically based on number of incident types
        const colors = generateColors(labels.length);
        
        // Create chart
        const incidentChart = new Chart(incidentChartEl, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#ffffff',
                            font: {
                                size: 12
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Incident Types',
                        color: '#ffffff',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error initializing incident type chart:', error);
        // Show error message in the chart area
        incidentChartEl.parentElement.innerHTML = '<div class="alert alert-warning m-3">Unable to load incident type chart</div>';
    }
}

// Generate colors for the chart dynamically
function generateColors(count) {
    // Base colors that match bootstrap theme
    const baseColors = [
        '#dc3545', // danger
        '#fd7e14', // orange
        '#ffc107', // warning
        '#0dcaf0', // info
        '#6610f2', // indigo
        '#6f42c1', // purple
        '#d63384', // pink
        '#198754', // success
        '#20c997', // teal
        '#0d6efd', // primary
        '#6c757d', // secondary
    ];
    
    // If we have fewer types than colors, return a subset
    if (count <= baseColors.length) {
        return baseColors.slice(0, count);
    }
    
    // Otherwise, generate additional colors by adjusting brightness
    const colors = [...baseColors];
    while (colors.length < count) {
        // Take a color from the base set and adjust its brightness
        const baseColor = baseColors[colors.length % baseColors.length];
        const adjustedColor = adjustColorBrightness(baseColor, (colors.length / baseColors.length) * 20);
        colors.push(adjustedColor);
    }
    
    return colors;
}

// Adjust the brightness of a hex color
function adjustColorBrightness(hex, percent) {
    // Convert hex to RGB
    let r = parseInt(hex.substring(1, 3), 16);
    let g = parseInt(hex.substring(3, 5), 16);
    let b = parseInt(hex.substring(5, 7), 16);
    
    // Adjust brightness
    r = Math.max(0, Math.min(255, r + Math.floor(percent)));
    g = Math.max(0, Math.min(255, g + Math.floor(percent)));
    b = Math.max(0, Math.min(255, b + Math.floor(percent)));
    
    // Convert back to hex
    return '#' + 
        ((1 << 24) + (r << 16) + (g << 8) + b)
        .toString(16)
        .slice(1);
}

// Initialize severity distribution chart
function initializeSeverityChart() {
    const severityChartEl = document.getElementById('severityChart');
    if (!severityChartEl) return;
    
    try {
        // Extract data from the page
        const criticalCount = parseInt(document.getElementById('critical-count')?.textContent || '0');
        const highCount = parseInt(document.getElementById('high-count')?.textContent || '0');
        const mediumCount = parseInt(document.getElementById('medium-count')?.textContent || '0');
        const lowCount = parseInt(document.getElementById('low-count')?.textContent || '0');
        
        // If all counts are zero, show message
        if (criticalCount === 0 && highCount === 0 && mediumCount === 0 && lowCount === 0) {
            severityChartEl.parentElement.innerHTML = '<div class="alert alert-secondary text-center"><i class="bi bi-info-circle"></i> No incident data available</div>';
            return;
        }
        
        // Create chart
        const severityChart = new Chart(severityChartEl, {
            type: 'bar',
            data: {
                labels: ['Critical', 'High', 'Medium', 'Low'],
                datasets: [{
                    label: 'Open Incidents by Severity',
                    data: [criticalCount, highCount, mediumCount, lowCount],
                    backgroundColor: [
                        '#dc3545', // danger
                        '#ffc107', // warning
                        '#0d6efd', // primary
                        '#0dcaf0', // info
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                            color: '#ffffff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#ffffff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // Hide legend as it's redundant with axis labels
                    },
                    title: {
                        display: true,
                        text: 'Open Incidents by Severity',
                        color: '#ffffff',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.raw + ' incident' + (context.raw !== 1 ? 's' : '');
                            }
                        }
                    }
                }
            }
        });
        
        // Expose the chart instance to the window so it can be updated by event handlers
        window.severityChart = severityChart;
    } catch (error) {
        console.error('Error initializing severity chart:', error);
        // Show error message in the chart area
        severityChartEl.parentElement.innerHTML = '<div class="alert alert-warning m-3">Unable to load severity chart</div>';
    }
}

// Set up Server-Sent Events for real-time updates
function setupEventSource() {
    if (typeof EventSource === 'undefined') {
        console.warn('Server-Sent Events not supported by your browser.');
        return;
    }
    
    const evtSource = new EventSource('/stream');
    
    // Listen for new incidents
    evtSource.addEventListener('new-incident', function(event) {
        const incident = JSON.parse(event.data);
        handleNewIncident(incident);
    });
    
    // Listen for incident updates
    evtSource.addEventListener('incident-update', function(event) {
        const update = JSON.parse(event.data);
        handleIncidentUpdate(update);
    });
    
    // Listen for resource allocations
    evtSource.addEventListener('resource-allocation', function(event) {
        const allocation = JSON.parse(event.data);
        handleResourceAllocation(allocation);
    });
    
    // General error handler
    evtSource.onerror = function(error) {
        console.error('EventSource error:', error);
        evtSource.close();
        
        // Try to reconnect after 5 seconds
        setTimeout(setupEventSource, 5000);
    };
}

// Handle new incident event
function handleNewIncident(incident) {
    // Add to recent incidents list
    const recentIncidentsList = document.getElementById('recent-incidents-list');
    if (recentIncidentsList) {
        const severityClass = getSeverityClass(incident.severity);
        
        const incidentItem = document.createElement('li');
        incidentItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        incidentItem.innerHTML = `
            <div>
                <span class="badge bg-${severityClass} me-2">${incident.severity.toUpperCase()}</span>
                <strong>${incident.title}</strong>
                <small class="d-block text-muted">${incident.location}</small>
            </div>
            <span class="text-muted">${incident.timestamp}</span>
        `;
        
        // Add click event to navigate to incident
        incidentItem.addEventListener('click', function() {
            window.location.href = `/incidents/${incident.incident_id}`;
        });
        
        // Add to the top of the list
        recentIncidentsList.insertBefore(incidentItem, recentIncidentsList.firstChild);
        
        // Remove the last item if there are more than 10
        if (recentIncidentsList.children.length > 10) {
            recentIncidentsList.removeChild(recentIncidentsList.lastChild);
        }
        
        // If this is the first incident, we might need to reinitialize charts
        // This handles the case when the page loaded with no incidents
        if (recentIncidentsList.children.length === 1) {
            // Get chart elements
            const incidentChartEl = document.getElementById('incidentTypeChart');
            const severityChartEl = document.getElementById('severityChart');
            
            // Check if the incident chart needs to be recreated
            if (incidentChartEl && incidentChartEl.parentElement.querySelector('.alert')) {
                // Replace the message with a canvas
                incidentChartEl.parentElement.innerHTML = '<canvas id="incidentTypeChart" height="200"></canvas>';
                // Reinitialize the chart with the new data
                initializeIncidentChart();
            }
            
            // Check if the severity chart needs to be recreated
            if (severityChartEl && severityChartEl.parentElement.querySelector('.alert')) {
                // Replace the message with a canvas
                severityChartEl.parentElement.innerHTML = '<canvas id="severityChart" height="200"></canvas>';
                // Reinitialize the chart
                initializeSeverityChart();
            }
        }
    }
    
    // Update severity counts
    updateSeverityCount(incident.severity, 1);
    
    // Update incident type count (if not already handled by updateSeverityCount)
    if (incident.type && !updateSeverityCount.handledTypeUpdate) {
        updateIncidentTypeCount(incident.type, 1);
    }
    
    // Update response metrics
    updateResponseMetrics('total-incidents-counter', 1);
    
    // Update people affected if available
    if (incident.people_affected) {
        updateResponseMetrics('people-affected-counter', parseInt(incident.people_affected));
    }
    
    // Update active areas (we'll add 1 as a simplification since we'd need backend logic to determine unique areas)
    updateResponseMetrics('active-areas-counter', 1);
    
    // Show notification
    showNotification('New Incident', `${incident.title} reported in ${incident.location}`, 'warning');
    
    // Add the incident to the map if possible
    if (window.addIncidentMarker && incident.latitude && incident.longitude) {
        window.addIncidentMarker({
            id: incident.incident_id,
            title: incident.title,
            type: incident.type || incident.incident_type,
            severity: incident.severity,
            status: incident.status || 'reported',
            latitude: incident.latitude, 
            longitude: incident.longitude
        });
    }
}

// Handle incident update event
function handleIncidentUpdate(update) {
    // Show notification
    showNotification('Incident Update', `${update.user} updated incident #${update.incident_id}: ${update.update_text.substring(0, 50)}...`, 'info');
    
    // Check if status was updated to resolved
    if (update.status === 'resolved') {
        // Update resolved counter
        updateResponseMetrics('resolved-incidents-counter', 1);
    }
}

// Handle resource allocation event
function handleResourceAllocation(allocation) {
    // Show notification
    showNotification('Resource Allocated', `${allocation.responder} allocated ${allocation.quantity} ${allocation.resource_name} to incident #${allocation.incident_id}`, 'success');
}

// Update severity count
function updateSeverityCount(severity, change) {
    const countElement = document.getElementById(`${severity}-count`);
    if (countElement) {
        const currentCount = parseInt(countElement.textContent || '0');
        countElement.textContent = currentCount + change;
    }
    
    // Update chart if visible
    const severityChart = Chart.getChart('severityChart');
    if (severityChart) {
        const severityIndex = {
            'critical': 0,
            'high': 1,
            'medium': 2,
            'low': 3
        }[severity];
        
        if (severityIndex !== undefined) {
            // Check if the chart has data
            if (severityChart.data && 
                severityChart.data.datasets && 
                severityChart.data.datasets[0] && 
                Array.isArray(severityChart.data.datasets[0].data)) {
                
                // Update the chart data
                severityChart.data.datasets[0].data[severityIndex] += change;
                severityChart.update();
                
                // Also update the incident type chart if needed
                updateIncidentTypeCount(severity, change);
            }
        }
    }
}

// Update incident type count
function updateIncidentTypeCount(incidentType, change) {
    // Get the incident type chart
    const incidentChart = Chart.getChart('incidentTypeChart');
    if (!incidentChart || !incidentType) return;
    
    // Get the data container to update the stored JSON
    const dataContainer = document.getElementById('incident-type-data');
    if (!dataContainer) return;
    
    try {
        // Parse the current data
        let incidentData = JSON.parse(dataContainer.getAttribute('data-incident-types') || '{}');
        
        // Update the count for this incident type
        if (incidentData[incidentType] !== undefined) {
            incidentData[incidentType] += change;
        } else {
            incidentData[incidentType] = change;
        }
        
        // Update the data attribute
        dataContainer.setAttribute('data-incident-types', JSON.stringify(incidentData));
        
        // Find the index of this incident type in the chart
        const labels = incidentChart.data.labels || [];
        const formattedType = formatIncidentType(incidentType);
        const typeIndex = labels.indexOf(formattedType);
        
        if (typeIndex >= 0) {
            // Update existing type
            incidentChart.data.datasets[0].data[typeIndex] += change;
        } else if (change > 0) {
            // Add new type
            incidentChart.data.labels.push(formattedType);
            incidentChart.data.datasets[0].data.push(change);
            
            // Update colors if needed
            if (incidentChart.data.datasets[0].backgroundColor) {
                const colors = generateColors(incidentChart.data.labels.length);
                incidentChart.data.datasets[0].backgroundColor = colors;
            }
        }
        
        // Update the chart
        incidentChart.update();
    } catch (error) {
        console.error('Error updating incident type chart:', error);
    }
}

// Show a notification
function showNotification(title, message, type = 'info') {
    // Create toast element
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.setAttribute('id', toastId);
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <strong>${title}:</strong> ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Initialize and show the toast
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 5000
    });
    
    bsToast.show();
    
    // Clean up after hiding
    toast.addEventListener('hidden.bs.toast', function() {
        toast.remove();
    });
    
    // Play notification sound if available
    const notificationSound = document.getElementById('notification-sound');
    if (notificationSound) {
        notificationSound.play().catch(e => {
            console.warn('Unable to play notification sound:', e);
        });
    }
}

// Format incident type for display
function formatIncidentType(type) {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Get Bootstrap class for incident severity
function getSeverityClass(severity) {
    switch (severity) {
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

// Update response metrics counters with animation
function updateResponseMetrics(elementId, increment) {
    const counterElement = document.getElementById(elementId);
    if (!counterElement) return;
    
    // Get current value
    const currentValue = parseInt(counterElement.textContent.replace(/,/g, '') || '0');
    const newValue = currentValue + increment;
    
    // Add animation class
    counterElement.classList.add('text-primary');
    
    // Update the value with a counting animation
    let count = currentValue;
    const duration = 1000; // Animation duration in ms
    const interval = 50; // Update interval in ms
    const steps = duration / interval;
    const step = increment / steps;
    
    const timer = setInterval(() => {
        count += step;
        if ((increment > 0 && count >= newValue) || (increment < 0 && count <= newValue)) {
            clearInterval(timer);
            count = newValue; // Ensure we end at the exact value
            
            // Remove animation class after a delay
            setTimeout(() => {
                counterElement.classList.remove('text-primary');
            }, 500);
        }
        
        // Format with commas for thousands
        counterElement.textContent = Math.round(count).toLocaleString();
    }, interval);
}
