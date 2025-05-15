from datetime import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def validate_coordinates(latitude, longitude):
    """
    Validate that the given coordinates are within valid ranges
    
    Args:
        latitude: Latitude value to validate (-90 to 90)
        longitude: Longitude value to validate (-180 to 180)
        
    Returns:
        bool: True if coordinates are valid, False otherwise
    """
    try:
        lat = float(latitude)
        lng = float(longitude)
        
        if lat < -90 or lat > 90:
            return False
        
        if lng < -180 or lng > 180:
            return False
        
        return True
    except (ValueError, TypeError):
        return False

def format_timestamp(timestamp):
    """
    Format a datetime object for display
    
    Args:
        timestamp: The datetime object to format
        
    Returns:
        str: Formatted timestamp string
    """
    if not timestamp:
        return "N/A"
    
    try:
        now = datetime.utcnow()
        diff = now - timestamp
        
        if diff.days == 0:
            if diff.seconds < 60:
                return "Just now"
            elif diff.seconds < 3600:
                minutes = diff.seconds // 60
                return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
            else:
                hours = diff.seconds // 3600
                return f"{hours} hour{'s' if hours > 1 else ''} ago"
        elif diff.days == 1:
            return "Yesterday"
        elif diff.days < 7:
            return f"{diff.days} days ago"
        else:
            return timestamp.strftime("%b %d, %Y")
    except Exception as e:
        logger.error(f"Error formatting timestamp: {str(e)}")
        return str(timestamp)

def is_admin(user):
    """
    Check if the user has administrator role
    
    Args:
        user: The user object to check
        
    Returns:
        bool: True if user is an admin, False otherwise
    """
    return user and user.role == 'admin'

def is_responder(user):
    """
    Check if the user is an emergency responder
    
    Args:
        user: The user object to check
        
    Returns:
        bool: True if user is a responder, False otherwise
    """
    return user and user.role == 'responder'

def get_severity_class(severity):
    """
    Get the Bootstrap CSS class for a severity level
    
    Args:
        severity: The severity level ('critical', 'high', 'medium', 'low')
        
    Returns:
        str: The Bootstrap CSS class
    """
    severity_classes = {
        'critical': 'danger',
        'high': 'warning',
        'medium': 'primary',
        'low': 'info'
    }
    
    return severity_classes.get(severity, 'secondary')

def get_incident_icon(incident_type):
    """
    Get the appropriate icon for an incident type
    
    Args:
        incident_type: The type of incident
        
    Returns:
        str: The icon class
    """
    icon_mapping = {
        'fire': 'fire',
        'flood': 'water',
        'earthquake': 'globe',
        'tornado': 'wind',
        'hurricane': 'cloud-hurricane',
        'medical_emergency': 'heart-pulse',
        'power_outage': 'lightbulb-off',
        'gas_leak': 'cloud-fog',
        'chemical_spill': 'flask',
        'road_accident': 'car-crash',
        'building_collapse': 'building-damage',
        'violent_incident': 'exclamation-triangle',
        'other': 'question-circle'
    }
    
    return f"bi-{icon_mapping.get(incident_type, 'exclamation-circle')}"

def truncate_text(text, max_length=100):
    """
    Truncate text to a maximum length and add ellipsis
    
    Args:
        text: The text to truncate
        max_length: Maximum length before truncation
        
    Returns:
        str: Truncated text with ellipsis if needed
    """
    if not text:
        return ""
    
    if len(text) <= max_length:
        return text
    
    return text[:max_length] + "..."
