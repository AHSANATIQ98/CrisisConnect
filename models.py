from datetime import datetime
from flask_login import UserMixin
from app import db
from werkzeug.security import generate_password_hash, check_password_hash

# User roles
ROLES = {
    'community_member': 'Community Member',
    'volunteer': 'Volunteer',
    'responder': 'Emergency Responder',
    'admin': 'Administrator'
}

# Incident types
INCIDENT_TYPES = [
    'fire', 'flood', 'earthquake', 'tornado', 'hurricane', 
    'medical_emergency', 'power_outage', 'gas_leak', 'chemical_spill',
    'road_accident', 'building_collapse', 'violent_incident', 'other'
]

# Incident severity levels
SEVERITY_LEVELS = [
    ('low', 'Low - Non-urgent response needed'),
    ('medium', 'Medium - Prompt response required'),
    ('high', 'High - Immediate response required'),
    ('critical', 'Critical - Life-threatening situation')
]

# Resource types
RESOURCE_TYPES = [
    'medical', 'rescue', 'shelter', 'food', 'water', 
    'transportation', 'communication', 'power', 'other'
]

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    first_name = db.Column(db.String(64))
    last_name = db.Column(db.String(64))
    role = db.Column(db.String(20), default='community_member')
    phone = db.Column(db.String(20))
    location = db.Column(db.String(120))
    skills = db.Column(db.String(256))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    reported_incidents = db.relationship('Incident', backref='reporter', lazy='dynamic')
    assigned_resources = db.relationship('ResourceAllocation', backref='responder', lazy='dynamic')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def get_full_name(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.username
    
    def __repr__(self):
        return f'<User {self.username}>'


class Incident(db.Model):
    __tablename__ = 'incidents'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=False)
    incident_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), default='medium')
    status = db.Column(db.String(20), default='reported')  # reported, validated, in_progress, resolved
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    address = db.Column(db.String(256))
    people_affected = db.Column(db.Integer, default=0)
    reporter_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)
    ai_analysis = db.Column(db.Text)
    
    # Relationships
    resources = db.relationship('ResourceAllocation', backref='incident', lazy='dynamic')
    updates = db.relationship('IncidentUpdate', backref='incident', lazy='dynamic')
    
    def __repr__(self):
        return f'<Incident {self.title}>'


class IncidentUpdate(db.Model):
    __tablename__ = 'incident_updates'
    
    id = db.Column(db.Integer, primary_key=True)
    incident_id = db.Column(db.Integer, db.ForeignKey('incidents.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    update_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    user = db.relationship('User', backref='updates')
    
    def __repr__(self):
        return f'<Update for Incident {self.incident_id}>'


class Resource(db.Model):
    __tablename__ = 'resources'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    resource_type = db.Column(db.String(50), nullable=False)
    quantity = db.Column(db.Integer, default=1)
    location = db.Column(db.String(256))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    status = db.Column(db.String(20), default='available')  # available, allocated, depleted
    description = db.Column(db.Text)
    # New fields for resource contributions
    contributor_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    contact_info = db.Column(db.String(100))
    expiration_date = db.Column(db.DateTime)  # For temporary resource contributions
    is_verified = db.Column(db.Boolean, default=False)  # For admin verification
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    allocations = db.relationship('ResourceAllocation', backref='resource', lazy='dynamic')
    contributor = db.relationship('User', backref='contributed_resources')
    
    def __repr__(self):
        return f'<Resource {self.name}>'


class ResourceAllocation(db.Model):
    __tablename__ = 'resource_allocations'
    
    id = db.Column(db.Integer, primary_key=True)
    resource_id = db.Column(db.Integer, db.ForeignKey('resources.id'), nullable=False)
    incident_id = db.Column(db.Integer, db.ForeignKey('incidents.id'), nullable=False)
    responder_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    quantity = db.Column(db.Integer, default=1)
    status = db.Column(db.String(20), default='allocated')  # allocated, in_transit, deployed, returned
    allocated_at = db.Column(db.DateTime, default=datetime.utcnow)
    deployed_at = db.Column(db.DateTime)
    returned_at = db.Column(db.DateTime)
    notes = db.Column(db.Text)
    
    def __repr__(self):
        return f'<ResourceAllocation {self.id}>'


class WeatherAlert(db.Model):
    __tablename__ = 'weather_alerts'
    
    id = db.Column(db.Integer, primary_key=True)
    alert_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), nullable=False)
    description = db.Column(db.Text, nullable=False)
    area_affected = db.Column(db.String(256), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<WeatherAlert {self.alert_type}>'
