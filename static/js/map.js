// Map handling for CrisisConnect
let map;
let markers = [];
let userLocation = null;

// Execute when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if map container exists (either the main map or preview map)
    const mapElement = document.getElementById("map") || document.getElementById("map-preview");
    
    if (mapElement) {
        console.log("Map container found, waiting for Google Maps API...");
        // Check if Google Maps API is loaded
        if (window.google && window.google.maps) {
            console.log("Google Maps API already loaded, initializing map...");
            initMap(mapElement.id);
        } else {
            console.log("Google Maps API not loaded yet, setting callback...");
            // Set a global callback function for the API to call when loaded
            window.initMap = function() {
                initMap(mapElement.id);
            };
            
            // Add the API script dynamically if not already added
            if (!document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
                const apiKey = document.querySelector('meta[name="google-api-key"]')?.content;
                if (apiKey) {
                    const script = document.createElement('script');
                    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap&loading=async`;
                    script.async = true;
                    script.defer = true;
                    document.head.appendChild(script);
                    console.log("Google Maps API script added dynamically");
                } else {
                    console.error("Google API Key not found in meta tag");
                }
            } else {
                console.log("Google Maps API script already added, waiting for callback...");
            }
        }
    }
});

// Initialize the map
function initMap(mapElementId) {
    console.log("Initializing map for element:", mapElementId);
    // Default center (will be updated with user location if available)
    const defaultCenter = { lat: 37.7749, lng: -122.4194 }; // San Francisco by default
    
    // Create the map using the appropriate element ID
    map = new google.maps.Map(document.getElementById(mapElementId), {
        zoom: 10,
        center: defaultCenter,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
        },
        fullscreenControl: true,
        streetViewControl: false,
        zoomControl: true
    });
    
    // If this is just the preview map on the homepage, don't do anything else
    if (mapElementId === "map-preview") {
        // Add some sample markers to preview map for demonstration
        addSampleMarkers();
        return;
    }
    
    // For the full map, continue with full functionality
    
    // Try to get user's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                // Center map on user's location
                map.setCenter(userLocation);
                
                // Add a marker for the user's location
                const userMarker = new google.maps.Marker({
                    position: userLocation,
                    map: map,
                    title: 'Your Location',
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: '#4285F4',
                        fillOpacity: 1,
                        strokeColor: '#FFFFFF',
                        strokeWeight: 2
                    }
                });
                
                // Add info window for user's location
                const userInfoWindow = new google.maps.InfoWindow({
                    content: '<div class="p-2"><strong>Your Location</strong></div>'
                });
                
                userMarker.addListener('click', () => {
                    userInfoWindow.open(map, userMarker);
                });
                
                // If we're on the report incident page, populate coordinates
                if (document.getElementById('latitude') && document.getElementById('longitude')) {
                    document.getElementById('latitude').value = userLocation.lat;
                    document.getElementById('longitude').value = userLocation.lng;
                    
                    // Get address from coordinates
                    const geocoder = new google.maps.Geocoder();
                    geocoder.geocode({ location: userLocation }, (results, status) => {
                        if (status === 'OK' && results[0]) {
                            document.getElementById('address').value = results[0].formatted_address;
                        }
                    });
                }
            },
            (error) => {
                console.error('Error getting user location:', error);
            }
        );
    }
    
    // Add click event for selecting location on the map (for incident reporting)
    if (document.getElementById('latitude') && document.getElementById('longitude')) {
        // We're on the report incident page
        map.addListener('click', (event) => {
            const lat = event.latLng.lat();
            const lng = event.latLng.lng();
            
            // Update form fields
            document.getElementById('latitude').value = lat;
            document.getElementById('longitude').value = lng;
            
            // Update or add marker
            if (window.selectedLocationMarker) {
                window.selectedLocationMarker.setPosition(event.latLng);
            } else {
                window.selectedLocationMarker = new google.maps.Marker({
                    position: event.latLng,
                    map: map,
                    title: 'Selected Location',
                    animation: google.maps.Animation.DROP
                });
            }
            
            // Get address from coordinates
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: event.latLng.toJSON() }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    document.getElementById('address').value = results[0].formatted_address;
                }
            });
        });
    }
    
    // Load incidents if we're on a page that needs them
    if (typeof loadIncidents === 'function') {
        loadIncidents();
    }
}

// Add sample markers for the preview map
function addSampleMarkers() {
    if (!map) return;
    console.log("Adding sample markers to preview map");
    
    // Sample incident locations (just for preview)
    const sampleLocations = [
        { lat: 37.7749, lng: -122.4194, severity: 'high', title: 'Fire Incident' },     // San Francisco
        { lat: 37.8044, lng: -122.2712, severity: 'medium', title: 'Power Outage' },   // Oakland
        { lat: 37.7275, lng: -122.1553, severity: 'low', title: 'Road Closure' },      // San Leandro
        { lat: 37.5630, lng: -122.3255, severity: 'critical', title: 'Medical Emergency' }, // Redwood City
    ];
    
    // Add markers for sample locations
    sampleLocations.forEach(location => {
        // Choose icon color based on severity
        let iconUrl = 'https://maps.google.com/mapfiles/ms/icons/';
        switch (location.severity) {
            case 'critical': iconUrl += 'red-dot.png'; break;
            case 'high': iconUrl += 'orange-dot.png'; break;
            case 'medium': iconUrl += 'yellow-dot.png'; break;
            case 'low': iconUrl += 'blue-dot.png'; break;
            default: iconUrl += 'green-dot.png';
        }
        
        // Create marker
        const marker = new google.maps.Marker({
            position: location,
            map: map,
            title: location.title,
            icon: iconUrl,
            animation: google.maps.Animation.DROP
        });
        
        // Add info window
        const infoWindow = new google.maps.InfoWindow({
            content: `<div class="p-2"><strong>${location.title}</strong><br>Severity: ${location.severity}</div>`
        });
        
        // Add click listener
        marker.addListener('click', () => {
            infoWindow.open(map, marker);
        });
        
        // Add to markers array for later reference
        markers.push(marker);
    });
    
    // Fit map to show all sample markers
    const bounds = new google.maps.LatLngBounds();
    markers.forEach(marker => {
        bounds.extend(marker.getPosition());
    });
    map.fitBounds(bounds);
    
    // Don't zoom in too far
    map.addListener('idle', () => {
        if (map.getZoom() > 12) {
            map.setZoom(12);
        }
    });
}

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

// Clear all markers from the map
function clearMarkers() {
    markers.forEach(marker => {
        marker.setMap(null);
    });
    markers = [];
}

// Get Bootstrap class for incident status
function getStatusClass(status) {
    switch (status) {
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

// Format incident status
function formatStatus(status) {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Format incident type
function formatIncidentType(type) {
    return type ? type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown';
}

// Update selected location on report incident form
function updateSelectedLocation() {
    const lat = parseFloat(document.getElementById('latitude').value);
    const lng = parseFloat(document.getElementById('longitude').value);
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        alert('Please enter valid coordinates');
        return;
    }
    
    const position = { lat, lng };
    map.setCenter(position);
    
    if (window.selectedLocationMarker) {
        window.selectedLocationMarker.setPosition(position);
    } else {
        window.selectedLocationMarker = new google.maps.Marker({
            position: position,
            map: map,
            title: 'Selected Location',
            animation: google.maps.Animation.DROP
        });
    }
    
    // Get address from coordinates
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: position }, (results, status) => {
        if (status === 'OK' && results[0]) {
            document.getElementById('address').value = results[0].formatted_address;
        }
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
    const formattedType = formatIncidentType(resource.type);
    
    // Format date
    let formattedDate = 'Unknown';
    if (resource.created_at) {
        const date = new Date(resource.created_at);
        formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
    
    const infoWindowContent = `
        <div class="p-2">
            <h5>${resource.title}</h5>
            <p><span class="badge bg-success">Resource</span>
            <span class="badge bg-primary">${formattedType}</span></p>
            <p><strong>Quantity:</strong> ${resource.quantity}<br>
            <strong>Contributed:</strong> ${formattedDate}<br>
            <strong>By:</strong> ${resource.reported_by || 'Unknown'}</p>
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
