import os
import time
import logging
from datetime import datetime
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from sqlalchemy.orm import DeclarativeBase
from sse import sse

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Initialize SQLAlchemy with a Base class
class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

# Create the Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")

# Configure PostgreSQL database
app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://neondb_owner:npg_yo4fIH5bdpZO@ep-silent-waterfall-a1ca0usy-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
    "pool_size": 5,
    "max_overflow": 2
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize SQLAlchemy
db.init_app(app)

# Set application configuration for API keys
app.config["GOOGLE_API_KEY"] = os.environ.get("GOOGLE_API_KEY", "AIzaSyDJSCLgyxsruo1o3YXxCHOGyE7NXsUW054")
if not app.config["GOOGLE_API_KEY"]:
    logging.warning("Google Maps API key not found in environment variables")

# Register SSE blueprint for real-time events
app.register_blueprint(sse, url_prefix='/stream')

# Initialize database tables
with app.app_context():
    try:
        db.create_all()
        logging.info("Database tables created successfully")
    except Exception as e:
        logging.error(f"Error creating database tables: {e}")

# Configure login manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page'
login_manager.login_message_category = 'warning'

# Import models and create tables
with app.app_context():
    import models
    db.create_all()

# Import and register routes
from routes import *

# User loader for Flask-Login
@login_manager.user_loader
def load_user(user_id):
    from models import User
    return User.query.get(int(user_id))

# Template context processor to provide global variables to all templates
@app.context_processor
def inject_globals():
    from utils import is_admin, is_responder, get_severity_class, format_timestamp
    return {
        'GOOGLE_API_KEY': app.config['GOOGLE_API_KEY'],
        'is_admin': is_admin,
        'is_responder': is_responder,
        'get_severity_class': get_severity_class,
        'format_timestamp': format_timestamp,
        'current_year': datetime.utcnow().year,
        'app_name': "CrisisConnect"
    }
