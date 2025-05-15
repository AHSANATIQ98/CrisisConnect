// Load incidents and resources from the API and display them on the map
function loadIncidents() {
    fetch('/api/map-data')
        .then(response => response.json())
        .then(data => {
            // Clear existing markers
            clearMarkers();
            
            // Add markers for each incident
            if (data.incidents && data.incidents.length > 0) {
                data.incidents.forEach(incident => {
                    addIncidentMarker(incident);
                });
            }
            
            // Add markers for resources if available
            if (data.resources && data.resources.length > 0) {
                data.resources.forEach(resource => {
                    addResourceMarker(resource);
                });
            }
            
            // If there are markers, fit the map to show all markers
            if (markers.length > 0) {
                const bounds = new google.maps.LatLngBounds();
                markers.forEach(marker => {
                    bounds.extend(marker.getPosition());
                });
                
                // Include user location in bounds if available
                if (userLocation) {
                    bounds.extend(userLocation);
                }
                
                map.fitBounds(bounds);
                
                // Don't zoom in too far
                if (map.getZoom() > 15) {
                    map.setZoom(15);
                }
            }
        })
        .catch(error => {
            console.error('Error loading map data:', error);
        });
}

// Add a marker for a resource
function addResourceMarker(resource) {
    // Make sure we have valid coordinates
    if (!resource.latitude || !resource.longitude) {
        console.error('Invalid coordinates for resource:', resource);
        return null;
    }
    
    const position = {
        lat: parseFloat(resource.latitude),
        lng: parseFloat(resource.longitude)
    };
    
    // Validate the coordinates
    if (isNaN(position.lat) || isNaN(position.lng) || 
        position.lat < -90 || position.lat > 90 || 
        position.lng < -180 || position.lng > 180) {
        console.error('Invalid coordinates for resource:', resource);
        return null;
    }
    
    // Use a different icon for resources
    const iconUrl = 'https://maps.google.com/mapfiles/ms/icons/green-dot.png';
    
    // Create the marker
    const marker = new google.maps.Marker({
        position: position,
        map: map,
        title: resource.title,
        icon: iconUrl,
        animation: google.maps.Animation.DROP
    });
    
    // Create info window with resource details
    const infoWindowContent = `
        <div class="p-2">
            <h5>${resource.title}</h5>
            <p><span class="badge bg-success">RESOURCE</span>
            <span class="badge bg-info">${formatIncidentType(resource.type)}</span></p>
            <p><strong>Quantity:</strong> ${resource.quantity}<br>
            <strong>Location:</strong> ${resource.location || 'Unknown'}<br>
            <strong>Contributed by:</strong> ${resource.reported_by || 'Unknown'}</p>
            <a href="/resources/${resource.id}" class="btn btn-sm btn-primary">View Details</a>
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
