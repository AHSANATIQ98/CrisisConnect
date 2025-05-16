
# CrisisConnect

CrisisConnect is a decentralized disaster response platform that connects community members, volunteers, and emergency responders through an AI-powered web interface. The platform enables real-time incident reporting, resource coordination, and intelligent decision support for more effective emergency response.

## Features

- **Real-time Incident Reporting**: Report and track emergency incidents with geolocation support
- **Resource Management**: Coordinate and allocate emergency resources efficiently
- **AI-Powered Analysis**: Gemini AI integration for incident analysis and resource recommendations
- **Interactive Mapping**: Visual representation of incidents and available resources
- **Role-Based Access**: Different capabilities for community members, volunteers, and emergency responders
- **Real-time Updates**: Server-Sent Events (SSE) for live incident updates
- **Community Resource Sharing**: Platform for sharing and managing emergency resources

## Technologies Used

- **Backend**: Python, Flask, SQLAlchemy
- **Database**: PostgreSQL
- **Frontend**: HTML, CSS, JavaScript, Bootstrap
- **AI Integration**: Google Gemini AI
- **Maps**: Google Maps API
- **Real-time Updates**: Server-Sent Events (SSE)

## Getting Started

1. Clone the repository
2. Set up environment variables:
   - `SESSION_SECRET`: Secret key for session management
   - `GOOGLE_API_KEY`: Google Maps API key
   - `GEMINI_API_KEY`: Google Gemini AI API key

3. Install dependencies:
   ```bash
   pip install -r dependencies.txt
   ```

4. Run the application:
   ```bash
   python main.py
   ```

The application will be available at `http://0.0.0.0:5000`

## Project Structure

- `/static`: Static files (CSS, JavaScript)
- `/templates`: HTML templates
- `/ai_services.py`: AI integration services
- `/models.py`: Database models
- `/routes.py`: Application routes
- `/sse.py`: Server-Sent Events implementation
- `/utils.py`: Utility functions

## Features in Detail

### Incident Management
- Create and track emergency incidents
- Real-time status updates
- AI-powered incident analysis
- Resource allocation tracking

### Resource Coordination
- Resource inventory management
- Resource allocation system
- Community resource sharing
- Verification system for contributed resources

### AI Integration
- Incident severity analysis
- Resource recommendation
- AI chatbot for emergency guidance
- Decision support system

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built with Flask Framework
- Powered by Google Gemini AI
- Mapping by Google Maps API
