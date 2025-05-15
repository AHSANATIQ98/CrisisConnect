import os
from datetime import datetime
from flask import render_template, request, redirect, url_for, flash, jsonify, abort, session
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash
from sse import publish
import json

from app import app, db
from models import User, Incident, IncidentUpdate, Resource, ResourceAllocation, WeatherAlert
from models import ROLES, INCIDENT_TYPES, SEVERITY_LEVELS, RESOURCE_TYPES
from ai_services import analyze_incident, recommend_resources, chat
from utils import validate_coordinates, format_timestamp, is_admin, is_responder

# Home route
@app.route('/')
def index():
    return render_template('index.html')

# Authentication routes
@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user)
            user.last_login = datetime.utcnow()
            db.session.commit()
            
            next_page = request.args.get('next')
            if not next_page or not next_page.startswith('/'):
                next_page = url_for('dashboard')
            
            flash('Login successful!', 'success')
            return redirect(next_page)
        else:
            flash('Invalid username or password', 'danger')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        first_name = request.form.get('first_name')
        last_name = request.form.get('last_name')
        role = request.form.get('role', 'community_member')
        phone = request.form.get('phone')
        location = request.form.get('location')
        skills = request.form.get('skills')
        
        # Basic validation
        if password != confirm_password:
            flash('Passwords do not match', 'danger')
            return render_template('register.html', roles=ROLES)
        
        # Check if username or email already exists
        if User.query.filter_by(username=username).first():
            flash('Username already exists', 'danger')
            return render_template('register.html', roles=ROLES)
        
        if User.query.filter_by(email=email).first():
            flash('Email already registered', 'danger')
            return render_template('register.html', roles=ROLES)
        
        # Create new user
        new_user = User(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=role,
            phone=phone,
            location=location,
            skills=skills
        )
        new_user.set_password(password)
        
        try:
            db.session.add(new_user)
            db.session.commit()
            flash('Registration successful! You can now log in.', 'success')
            return redirect(url_for('login'))
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error during registration: {str(e)}")
            flash('An error occurred during registration. Please try again.', 'danger')
    
    return render_template('register.html', roles=ROLES)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out successfully', 'info')
    return redirect(url_for('index'))

# Dashboard
@app.route('/dashboard')
@login_required
def dashboard():
    # Get recent incidents
    recent_incidents = Incident.query.order_by(Incident.created_at.desc()).limit(10).all()
    
    # Get open incidents by severity
    critical_count = Incident.query.filter_by(severity='critical').filter(Incident.status != 'resolved').count()
    high_count = Incident.query.filter_by(severity='high').filter(Incident.status != 'resolved').count()
    medium_count = Incident.query.filter_by(severity='medium').filter(Incident.status != 'resolved').count()
    low_count = Incident.query.filter_by(severity='low').filter(Incident.status != 'resolved').count()
    
    # Calculate additional metrics for response dashboard
    total_incidents = Incident.query.count()
    resolved_count = Incident.query.filter_by(status='resolved').count() 
    total_affected = db.session.query(db.func.sum(Incident.people_affected)).scalar() or 0
    
    # Calculate active areas (unique locations with unresolved incidents)
    active_areas_query = db.session.query(db.func.count(db.func.distinct(Incident.address))).filter(
        Incident.status != 'resolved'
    )
    active_areas = active_areas_query.scalar() or 0
    
    # Get incident types distribution
    incident_types = {}
    for incident_type in INCIDENT_TYPES:
        count = Incident.query.filter_by(incident_type=incident_type).count()
        if count > 0:
            incident_types[incident_type] = count
    
    # Get available resources
    available_resources = Resource.query.filter_by(status='available').all()
    
    # We no longer use weather alerts
    from datetime import datetime
    
    return render_template(
        'dashboard.html',
        recent_incidents=recent_incidents,
        critical_count=critical_count,
        high_count=high_count,
        medium_count=medium_count,
        low_count=low_count,
        incident_types=incident_types,
        available_resources=available_resources,
        # New metrics for the response dashboard
        total_incidents=total_incidents,
        resolved_count=resolved_count, 
        total_affected=total_affected,
        active_areas=active_areas
    )

# Incidents
@app.route('/incidents')
@login_required
def incidents():
    # Get filter parameters
    status = request.args.get('status', 'all')
    incident_type = request.args.get('type', 'all')
    severity = request.args.get('severity', 'all')
    
    # Query incidents with filters
    query = Incident.query
    
    if status != 'all':
        query = query.filter_by(status=status)
    
    if incident_type != 'all':
        query = query.filter_by(incident_type=incident_type)
    
    if severity != 'all':
        query = query.filter_by(severity=severity)
    
    # Order by created_at, most recent first
    incidents = query.order_by(Incident.created_at.desc()).all()
    
    return render_template(
        'incidents.html',
        incidents=incidents,
        incident_types=INCIDENT_TYPES,
        severity_levels=SEVERITY_LEVELS
    )

@app.route('/incidents/<int:incident_id>')
@login_required
def view_incident(incident_id):
    incident = Incident.query.get_or_404(incident_id)
    updates = incident.updates.order_by(IncidentUpdate.created_at.desc()).all()
    allocated_resources = ResourceAllocation.query.filter_by(incident_id=incident_id).all()
    
    return render_template(
        'incident_detail.html',
        incident=incident,
        updates=updates,
        allocated_resources=allocated_resources
    )

@app.route('/report-incident', methods=['GET', 'POST'])
@login_required
def report_incident():
    if request.method == 'POST':
        title = request.form.get('title')
        description = request.form.get('description')
        incident_type = request.form.get('incident_type')
        severity = request.form.get('severity')
        latitude = float(request.form.get('latitude'))
        longitude = float(request.form.get('longitude'))
        address = request.form.get('address')
        people_affected = int(request.form.get('people_affected', 0))
        
        # Validate coordinates
        if not validate_coordinates(latitude, longitude):
            flash('Invalid coordinates. Please try again.', 'danger')
            return render_template('report_incident.html', incident_types=INCIDENT_TYPES, severity_levels=SEVERITY_LEVELS)
        
        new_incident = Incident(
            title=title,
            description=description,
            incident_type=incident_type,
            severity=severity,
            latitude=latitude,
            longitude=longitude,
            address=address,
            people_affected=people_affected,
            reporter_id=current_user.id
        )
        
        try:
            db.session.add(new_incident)
            db.session.commit()
            
            # Use Gemini AI to analyze incident and recommend resources
            ai_analysis = analyze_incident(new_incident)
            new_incident.ai_analysis = ai_analysis
            db.session.commit()
            
            # Publish event for real-time updates
            publish({
                'incident_id': new_incident.id,
                'title': new_incident.title,
                'type': new_incident.incident_type,
                'severity': new_incident.severity,
                'location': new_incident.address or f"{new_incident.latitude}, {new_incident.longitude}",
                'timestamp': format_timestamp(new_incident.created_at)
            }, type='new-incident')
            
            flash('Incident reported successfully. Emergency resources have been notified.', 'success')
            return redirect(url_for('incidents'))
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error reporting incident: {str(e)}")
            flash('An error occurred while reporting the incident. Please try again.', 'danger')
    
    return render_template('report_incident.html', incident_types=INCIDENT_TYPES, severity_levels=SEVERITY_LEVELS)

@app.route('/incidents/<int:incident_id>/update', methods=['POST'])
@login_required
def update_incident(incident_id):
    incident = Incident.query.get_or_404(incident_id)
    
    # Check if user has permission to update this incident
    if not (current_user.id == incident.reporter_id or is_responder(current_user) or is_admin(current_user)):
        flash('You do not have permission to update this incident', 'danger')
        return redirect(url_for('view_incident', incident_id=incident_id))
    
    update_text = request.form.get('update_text')
    if not update_text:
        flash('Update text is required', 'danger')
        return redirect(url_for('view_incident', incident_id=incident_id))
    
    # Create new update
    new_update = IncidentUpdate(
        incident_id=incident_id,
        user_id=current_user.id,
        update_text=update_text
    )
    
    # Update incident status if provided
    new_status = request.form.get('status')
    # Allow reporters to resolve their own incidents or responders to change any status
    if new_status:
        if (new_status == 'resolved' and current_user.id == incident.reporter_id) or is_responder(current_user) or is_admin(current_user):
            incident.status = new_status
            if new_status == 'resolved':
                incident.resolved_at = datetime.utcnow()
    
    try:
        db.session.add(new_update)
        db.session.commit()
        
        # Publish event for real-time updates
        update_data = {
            'incident_id': incident.id,
            'update_id': new_update.id,
            'update_text': new_update.update_text,
            'user': current_user.username,
            'timestamp': format_timestamp(new_update.created_at)
        }
        
        # Include status if it was changed
        if new_status and ((new_status == 'resolved' and current_user.id == incident.reporter_id) or is_responder(current_user) or is_admin(current_user)):
            update_data['status'] = new_status
            
        publish(update_data, type='incident-update')
        
        flash('Incident updated successfully', 'success')
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error updating incident: {str(e)}")
        flash('An error occurred while updating the incident', 'danger')
    
    return redirect(url_for('view_incident', incident_id=incident_id))

# Resources
@app.route('/resources')
def resources():
    # Import current_user at function level to avoid issues with unauthenticated users
    from flask_login import current_user

    # Default values for unauthenticated users
    show_all = False
    show_verification = False
    
    # Determine user permissions and what to show
    if current_user.is_authenticated:
        show_all = is_responder(current_user) or is_admin(current_user)
        show_verification = is_admin(current_user)
        
        # For responders and admins, show all resources
        if show_all:
            resources = Resource.query.all()
        else:
            # For community members, show their contributions and verified resources
            resources = Resource.query.filter(
                db.or_(
                    Resource.contributor_id == current_user.id,
                    Resource.is_verified == True
                )
            ).all()
    else:
        # For unauthenticated users, only show verified resources
        resources = Resource.query.filter_by(is_verified=True).all()
    
    # Pass the current_user to the template to avoid issues in the template
    return render_template('resources.html', 
                          resources=resources, 
                          resource_types=RESOURCE_TYPES,
                          show_all=show_all,
                          show_verification=show_verification)

@app.route('/resources/add', methods=['GET', 'POST'])
@login_required
def add_resource():
    # Allow all authenticated users to add resources
    # Remove permission check to enable community resource contributions
    
    if request.method == 'POST':
        name = request.form.get('name')
        resource_type = request.form.get('resource_type')
        quantity = int(request.form.get('quantity', 1))
        location = request.form.get('location')
        latitude = float(request.form.get('latitude') or 0)
        longitude = float(request.form.get('longitude') or 0)
        description = request.form.get('description')
        contact_info = request.form.get('contact_info')
        expiration_date_str = request.form.get('expiration_date')
        
        # Parse expiration date if provided
        expiration_date = None
        if expiration_date_str:
            try:
                expiration_date = datetime.fromisoformat(expiration_date_str)
            except ValueError:
                app.logger.warning(f"Invalid expiration date format: {expiration_date_str}")
        
        # Create new resource with contributor information
        new_resource = Resource(
            name=name,
            resource_type=resource_type,
            quantity=quantity,
            location=location,
            latitude=latitude,
            longitude=longitude,
            description=description,
            contact_info=contact_info,
            expiration_date=expiration_date,
            contributor_id=current_user.id,
            is_verified=is_admin(current_user)  # Auto-verify if admin is adding
        )
        
        try:
            db.session.add(new_resource)
            db.session.commit()
            flash('Resource added successfully', 'success')
            return redirect(url_for('resources'))
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error adding resource: {str(e)}")
            flash('An error occurred while adding the resource', 'danger')
    
    return render_template('add_resource.html', resource_types=RESOURCE_TYPES)

@app.route('/resources/verify/<int:resource_id>', methods=['POST'])
@login_required
def verify_resource(resource_id):
    """Verify a contributed resource (admin only)"""
    if not is_admin(current_user):
        flash('You do not have permission to verify resources', 'danger')
        return redirect(url_for('resources'))
    
    resource = Resource.query.get_or_404(resource_id)
    
    # Toggle verification status
    resource.is_verified = not resource.is_verified
    
    try:
        db.session.commit()
        status = "verified" if resource.is_verified else "unverified"
        flash(f'Resource "{resource.name}" has been {status}', 'success')
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error verifying resource: {str(e)}")
        flash('An error occurred while updating resource verification status', 'danger')
    
    return redirect(url_for('resources'))

@app.route('/allocate-resource', methods=['POST'])
@login_required
def allocate_resource():
    if not is_responder(current_user) and not is_admin(current_user):
        flash('You do not have permission to allocate resources', 'danger')
        return redirect(url_for('dashboard'))
    
    resource_id = int(request.form.get('resource_id'))
    incident_id = int(request.form.get('incident_id'))
    quantity = int(request.form.get('quantity', 1))
    notes = request.form.get('notes', '')
    
    resource = Resource.query.get_or_404(resource_id)
    incident = Incident.query.get_or_404(incident_id)
    
    if resource.quantity < quantity:
        flash(f'Not enough {resource.name} available. Only {resource.quantity} units left.', 'danger')
        return redirect(url_for('view_incident', incident_id=incident_id))
    
    # Create allocation
    allocation = ResourceAllocation(
        resource_id=resource_id,
        incident_id=incident_id,
        responder_id=current_user.id,
        quantity=quantity,
        notes=notes
    )
    
    # Update resource quantity
    resource.quantity -= quantity
    if resource.quantity <= 0:
        resource.status = 'depleted'
    
    try:
        db.session.add(allocation)
        db.session.commit()
        
        # Publish resource allocation event
        publish({
            'incident_id': incident_id,
            'resource_name': resource.name,
            'quantity': quantity,
            'responder': current_user.username
        }, type='resource-allocation')
        
        flash('Resource allocated successfully', 'success')
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error allocating resource: {str(e)}")
        flash('An error occurred while allocating the resource', 'danger')
    
    return redirect(url_for('view_incident', incident_id=incident_id))

# User Profile
@app.route('/profile')
@login_required
def profile():
    return render_template('profile.html')

@app.route('/profile/edit', methods=['GET', 'POST'])
@login_required
def edit_profile():
    if request.method == 'POST':
        current_user.first_name = request.form.get('first_name')
        current_user.last_name = request.form.get('last_name')
        current_user.phone = request.form.get('phone')
        current_user.location = request.form.get('location')
        current_user.skills = request.form.get('skills')
        
        # Only admins can change roles
        if is_admin(current_user):
            current_user.role = request.form.get('role', current_user.role)
        
        try:
            db.session.commit()
            flash('Profile updated successfully', 'success')
            return redirect(url_for('profile'))
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error updating profile: {str(e)}")
            flash('An error occurred while updating your profile', 'danger')
    
    return render_template('edit_profile.html', roles=ROLES)

# API Endpoints for AJAX requests
@app.route('/api/incidents')
@login_required
def api_incidents():
    incidents = Incident.query.all()
    result = []
    
    for incident in incidents:
        result.append({
            'id': incident.id,
            'title': incident.title,
            'type': incident.incident_type,
            'severity': incident.severity,
            'status': incident.status,
            'latitude': incident.latitude,
            'longitude': incident.longitude,
            'reported_by': incident.reporter.username,
            'created_at': incident.created_at.isoformat()
        })
    
    return jsonify(result)

@app.route('/api/resources')
@login_required
def api_resources():
    if not is_responder(current_user) and not is_admin(current_user):
        return jsonify({'error': 'Unauthorized'}), 403
    
    resources = Resource.query.filter_by(status='available').all()
    result = []
    
    for resource in resources:
        result.append({
            'id': resource.id,
            'name': resource.name,
            'type': resource.resource_type,
            'quantity': resource.quantity,
            'location': resource.location,
            'latitude': resource.latitude,
            'longitude': resource.longitude
        })
    
    return jsonify(result)

@app.route('/api/map-data')
def api_map_data():
    """Return both incidents and resources for the map view"""
    # Get all incidents
    incidents = Incident.query.all()
    incident_results = []
    
    for incident in incidents:
        incident_results.append({
            'id': incident.id,
            'title': incident.title,
            'type': incident.incident_type,
            'severity': incident.severity,
            'status': incident.status,
            'latitude': incident.latitude,
            'longitude': incident.longitude,
            'reported_by': incident.reporter.username,
            'created_at': incident.created_at.isoformat(),
            'marker_type': 'incident'  # Tag to identify marker type
        })
    
    # Get resources that have coordinates
    # Only include resources with valid coordinates
    resources = Resource.query.filter(
        Resource.status == 'available',
        Resource.latitude.isnot(None),
        Resource.longitude.isnot(None)
    ).all()
    
    resource_results = []
    
    for resource in resources:
        resource_results.append({
            'id': resource.id,
            'title': resource.name,  # Use same field name for display consistency
            'type': resource.resource_type,
            'quantity': resource.quantity,
            'location': resource.location,
            'latitude': resource.latitude,
            'longitude': resource.longitude,
            'status': 'available',  # Resources have status too for consistent display
            'severity': 'low',  # Dummy value for consistent display
            'reported_by': resource.contributor.username if resource.contributor else 'Unknown',
            'created_at': resource.created_at.isoformat(),
            'marker_type': 'resource'  # Tag to identify marker type
        })
    
    # Combine the results
    return jsonify({
        'incidents': incident_results,
        'resources': resource_results
    })

@app.route('/api/incidents/<int:incident_id>/recommend-resources')
@login_required
def api_recommend_resources(incident_id):
    if not is_responder(current_user) and not is_admin(current_user):
        return jsonify({'error': 'Unauthorized'}), 403
    
    incident = Incident.query.get_or_404(incident_id)
    resources = Resource.query.filter_by(status='available').all()
    
    # Use Gemini AI to recommend resources
    recommendations = recommend_resources(incident, resources)
    
    return jsonify(recommendations)

# Weather prediction API endpoint has been removed

# Serve template for incident detail page
@app.route('/templates/incident_detail.html')
def incident_detail_template():
    return render_template('incident_detail.html', incident=None, updates=[], allocated_resources=[])

# Chatbot
@app.route('/chatbot')
@login_required
def chatbot():
    """Display the chatbot interface"""
    return render_template('chatbot.html')

@app.route('/api/test/maps')
def test_maps_api():
    """Test endpoint for Google Maps API"""
    api_key = app.config.get('GOOGLE_API_KEY')
    if not api_key:
        return jsonify({'status': 'error', 'message': 'Google Maps API key not found'})
    return jsonify({'status': 'ok', 'message': 'Google Maps API key is configured', 'key': api_key})

@app.route('/api/test/gemini')
def test_gemini_api():
    """Test endpoint for Gemini API"""
    try:
        response = chat(None, "Hello, are you working?", True)
        return jsonify({'status': 'ok', 'message': 'Gemini API is working', 'response': response})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/api/chat', methods=['POST'])
@login_required
def api_chat():
    """API endpoint for chatbot interactions"""
    message = request.json.get('message', '')
    is_new_chat = request.json.get('is_new_chat', False)
    
    if not message:
        return jsonify({'error': 'No message provided'}), 400
    
    # Get response from Gemini AI
    response = chat(current_user.id, message, is_new_chat)
    
    return jsonify({
        'response': response,
        'timestamp': datetime.utcnow().isoformat()
    })

# Error handlers
@app.errorhandler(404)
def page_not_found(e):
    return render_template('error.html', error_code=404, message='Page not found'), 404

@app.errorhandler(500)
def server_error(e):
    return render_template('error.html', error_code=500, message='Internal server error'), 500
