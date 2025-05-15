// Add a marker for an incident
function addIncidentMarker(incident) {
    // Make sure we have valid coordinates
    if (!incident.latitude || !incident.longitude) {
        console.error('Invalid coordinates for incident:', incident);
        return null;
    }
    
    const position = {
        lat: parseFloat(incident.latitude),
        lng: parseFloat(incident.longitude)
    };
    
    // Validate the coordinates
    if (isNaN(position.lat) || isNaN(position.lng) || 
        position.lat < -90 || position.lat > 90 || 
        position.lng < -180 || position.lng > 180) {
        console.error('Invalid coordinates for incident:', incident);
        return null;
    }
    
    // Choose icon and color based on incident type and severity
    let iconUrl = 'https://maps.google.com/mapfiles/ms/icons/';
    
    // Set color based on severity
    switch (incident.severity) {
        case 'critical':
            iconUrl += 'red-dot.png';
            break;
        case 'high':
            iconUrl += 'orange-dot.png';
            break;
        case 'medium':
            iconUrl += 'yellow-dot.png';
            break;
        case 'low':
            iconUrl += 'blue-dot.png';
            break;
        default:
            iconUrl += 'green-dot.png';
    }
    
    // Create the marker
    const marker = new google.maps.Marker({
        position: position,
        map: map,
        title: incident.title,
        icon: iconUrl,
        animation: google.maps.Animation.DROP
    });
    
    // Create info window with incident details
    const statusClass = getStatusClass(incident.status);
    const severityClass = getSeverityClass(incident.severity);
    
    // Format date
    let formattedDate = 'Unknown';
    if (incident.created_at) {
        const date = new Date(incident.created_at);
        formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
    
    // Make sure incident type is properly passed
    const incidentType = incident.type || incident.incident_type || 'Unknown';
    
    const infoWindowContent = `
        <div class="p-2">
            <h5>${incident.title}</h5>
            <p><span class="badge bg-${severityClass}">${incident.severity.toUpperCase()}</span>
            <span class="badge bg-${statusClass}">${formatStatus(incident.status)}</span></p>
            <p><strong>Type:</strong> ${formatIncidentType(incidentType)}<br>
            <strong>Reported:</strong> ${formattedDate}<br>
            <strong>By:</strong> ${incident.reported_by || 'Unknown'}</p>
            <a href="/incidents/${incident.id}" class="btn btn-sm btn-primary">View Details</a>
        </div>
    `;
    
    const infoWindow = new google.maps.InfoWindow({
        content: infoWindowContent,
        maxWidth: 300
    });
    
    // Add click listener to open info window
    marker.addListener('click', () => {
        // Close all other info windows
        markers.forEach(m => {
            if (m.infoWindow && m.infoWindow !== infoWindow) {
                m.infoWindow.close();
            }
        });
        
        infoWindow.open(map, marker);
    });
    
    // Store info window with marker for later reference
    marker.infoWindow = infoWindow;
    
    // Add to markers array
    markers.push(marker);
    
    return marker;
}
