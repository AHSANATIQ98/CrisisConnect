import os
import json
import logging
from datetime import datetime
import google.generativeai as genai

# Configure Google Generative AI with API key
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
genai.configure(api_key=GEMINI_API_KEY)

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize Gemini model
try:
    # Use Gemini 1.5 Flash for better performance and capabilities
    model = genai.GenerativeModel('gemini-1.5-flash')
    chat_model = genai.GenerativeModel('gemini-1.5-flash')
    logger.info("Gemini AI 1.5 Flash model initialized successfully")
except Exception as e:
    logger.error(f"Error initializing Gemini AI model: {str(e)}")
    # Fallback to Gemini Pro if 1.5 is not available
    try:
        model = genai.GenerativeModel('gemini-pro')
        chat_model = genai.GenerativeModel('gemini-pro')
        logger.info("Falling back to Gemini Pro model")
    except Exception as fallback_error:
        logger.error(f"Error initializing fallback Gemini model: {str(fallback_error)}")
        model = None
        chat_model = None

# Store chat history for each user
chat_histories = {}

def analyze_incident(incident):
    """
    Use Gemini AI to analyze an incident and provide insights
    
    Args:
        incident: The Incident object to analyze
        
    Returns:
        str: AI analysis of the incident
    """
    if not model:
        logger.error("Gemini AI model not available")
        return "AI analysis unavailable"
    
    try:
        prompt = f"""
        Analyze this emergency incident and provide key insights:
        
        Title: {incident.title}
        Type: {incident.incident_type}
        Description: {incident.description}
        Severity: {incident.severity}
        Location: {incident.address or f"Coordinates: {incident.latitude}, {incident.longitude}"}
        People affected: {incident.people_affected}
        Reported at: {incident.created_at}
        
        First, determine if the current severity level ({incident.severity}) and incident type ({incident.incident_type}) are appropriate based on the description. If they should be different, clearly indicate the recommended classification.
        
        Then provide:
        1. Incident classification and priority assessment
        2. Potential risks and complications
        3. Recommended immediate actions
        4. Resource requirements (medical, rescue, shelter, etc.)
        5. Coordination instructions for emergency responders
        
        Format the response in a clear, structured manner suitable for emergency responders.
        Start with a "CLASSIFICATION RECOMMENDATIONS:" section that specifically addresses if the severity and incident type should be changed.
        """
        
        response = model.generate_content(prompt)
        analysis = response.text
        
        logger.info(f"Successfully generated AI analysis for incident {incident.id}")
        return analysis
        
    except Exception as e:
        logger.error(f"Error generating AI analysis: {str(e)}")
        return f"Error generating AI analysis: {str(e)}"

def recommend_resources(incident, available_resources):
    """
    Use Gemini AI to recommend resources for an incident
    
    Args:
        incident: The Incident object
        available_resources: List of available Resource objects
        
    Returns:
        dict: Recommended resources and rationale
    """
    if not model:
        logger.error("Gemini AI model not available")
        return {"error": "AI resource recommendation unavailable"}
    
    try:
        # Format available resources for the prompt
        resources_text = "\n".join([
            f"- {r.name}: Type={r.resource_type}, Quantity={r.quantity}, Location={r.location or 'Unknown'}" 
            for r in available_resources
        ])
        
        prompt = f"""
        Based on this emergency incident, recommend the most appropriate resources to allocate:
        
        INCIDENT DETAILS:
        Title: {incident.title}
        Type: {incident.incident_type}
        Description: {incident.description}
        Severity: {incident.severity}
        Location: {incident.address or f"Coordinates: {incident.latitude}, {incident.longitude}"}
        People affected: {incident.people_affected}
        Status: {incident.status}
        AI Analysis: {incident.ai_analysis or "Not available"}
        
        AVAILABLE RESOURCES:
        {resources_text}
        
        Please provide:
        1. A ranked list of the most important resources to allocate to this incident
        2. The recommended quantity for each resource
        3. A brief explanation for each recommendation
        4. Any critical resource gaps that need to be addressed
        
        Format your response as a valid JSON object with these keys:
        - recommendations: array of objects with resource_id, resource_name, quantity, and rationale
        - resource_gaps: array of strings describing missing resources
        - priority_level: string (critical, high, medium, low)
        """
        
        response = model.generate_content(prompt)
        
        # Extract JSON from the response
        response_text = response.text
        
        # Try to find JSON in the response
        start_index = response_text.find('{')
        end_index = response_text.rfind('}') + 1
        
        if start_index != -1 and end_index != -1:
            json_str = response_text[start_index:end_index]
            try:
                recommendations = json.loads(json_str)
                logger.info(f"Successfully generated resource recommendations for incident {incident.id}")
                return recommendations
            except json.JSONDecodeError:
                logger.error(f"Error parsing AI recommendation JSON: {json_str}")
        
        # If JSON parsing failed, return a structured response
        logger.warning("Could not parse JSON from AI recommendation, creating structured response")
        
        # Create a manual structured response
        return {
            "recommendations": [
                {"resource_id": r.id, "resource_name": r.name, "quantity": 1, "rationale": "AI-recommended based on incident type"} 
                for r in available_resources[:3]  # Recommend the first 3 resources
            ],
            "resource_gaps": ["Could not determine resource gaps due to processing error"],
            "priority_level": incident.severity
        }
        
    except Exception as e:
        logger.error(f"Error recommending resources: {str(e)}")
        return {"error": f"Error recommending resources: {str(e)}"}

def chat(user_id, message, is_new_chat=False):
    """
    Handle chat interactions with Gemini AI
    
    Args:
        user_id: The ID of the user chatting
        message: The user's message
        is_new_chat: Whether this is a new chat session
        
    Returns:
        str: AI response to the user's message
    """
    if not chat_model:
        logger.error("Gemini AI chat model not available")
        return "I'm sorry, the AI assistant is currently unavailable. Please try again later."
    
    try:
        # Initialize chat history for user if it doesn't exist or if this is a new chat
        if user_id not in chat_histories or is_new_chat:
            chat_histories[user_id] = chat_model.start_chat(
                history=[
                    {
                        "role": "user",
                        "parts": ["You are CrisisConnect Assistant, an AI helper for a disaster response platform. Your expertise is in emergency management, disaster response, and crisis coordination. You're helpful, empathetic, and focused on providing practical advice for disaster situations. Please introduce yourself briefly."]
                    },
                    {
                        "role": "model",
                        "parts": ["Hello! I'm the CrisisConnect Assistant, here to help with disaster response and emergency management questions. I can provide information about emergency preparedness, disaster response protocols, resource coordination, and crisis management. Whether you need advice on preparing for a natural disaster, understanding emergency protocols, or coordinating response efforts, I'm here to assist. How can I help you today with emergency or disaster-related matters?"]
                    }
                ]
            )
        
        # Get the user's chat history
        chat = chat_histories[user_id]
        
        # Send the user's message and get a response
        response = chat.send_message(message)
        
        # Return the model's response text
        return response.text
        
    except Exception as e:
        logger.error(f"Error in chat conversation: {str(e)}")
        return f"I'm sorry, I encountered an error: {str(e)}. Please try again."

# Weather prediction function has been removed as per user request
