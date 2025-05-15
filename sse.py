"""
Simple in-memory Server-Sent Events implementation for CrisisConnect.
This module provides a lightweight alternative to flask-sse without requiring Redis.
"""

import json
import queue
import time
from datetime import datetime
from flask import Blueprint, Response, current_app, request, stream_with_context

# Create a message queue for each event type
event_queues = {
    'new-incident': queue.Queue(),
    'incident-update': queue.Queue(),
    'resource-allocation': queue.Queue(),
    'status-change': queue.Queue(),
}

# Create a blueprint for SSE
sse = Blueprint('sse', __name__)

@sse.route('/ping')
def ping():
    """Simple endpoint to test if SSE blueprint is responding"""
    return {"status": "SSE service operational"}

@sse.route('/stream')
def stream():
    """
    Returns an event stream of updates.
    Client browsers use EventSource to connect to this endpoint.
    """
    # Very short-lived SSE connection to prevent worker timeouts
    # The client will automatically reconnect when the connection is closed
    max_duration = 5  # seconds
    max_events = 5    # maximum number of events to send per connection
    
    @stream_with_context
    def event_stream():
        # Send initial comment to keep the connection alive
        yield 'data: {"message": "Connected to CrisisConnect event stream"}\n\n'
        
        # Handle different event channels
        channel = request.args.get('channel', 'all')
        
        if channel == 'all':
            # Listen to all channels
            queues_to_check = list(event_queues.keys())
        elif channel in event_queues:
            # Listen to specific channel
            queues_to_check = [channel]
        else:
            # Invalid channel
            yield f'data: {{"error": "Invalid channel {channel}"}}\n\n'
            return
        
        # Set timeouts
        start_time = datetime.now()
        event_count = 0
        
        # Keep connection alive and yield events within the time and event limits
        while ((datetime.now() - start_time).seconds < max_duration and 
               event_count < max_events):
            
            # Check if any new messages in the queues
            events_found = False
            for event_type in queues_to_check:
                try:
                    if not event_queues[event_type].empty():
                        message = event_queues[event_type].get_nowait()
                        yield f'event: {event_type}\ndata: {json.dumps(message)}\n\n'
                        events_found = True
                        event_count += 1
                except Exception as e:
                    current_app.logger.error(f"Error in SSE stream: {str(e)}")
                    yield f'data: {{"error": "{str(e)}"}}\n\n'
            
            # If no events found, add a small delay to prevent CPU hogging
            if not events_found:
                # Send keep-alive and delay
                yield 'data: {"keepalive": true}\n\n'
                time.sleep(0.05)
        
        # Send a final message before closing the connection
        yield 'data: {"message": "Connection ended, client should reconnect"}\n\n'
    
    return Response(event_stream(), mimetype='text/event-stream', 
                   headers={'Cache-Control': 'no-cache', 
                            'X-Accel-Buffering': 'no'})

def publish(data, type='new-incident'):
    """
    Publish a message to a specific event type queue.
    
    Args:
        data: The message data to publish (will be converted to JSON)
        type: Event type ('new-incident', 'incident-update', 'resource-allocation', 'status-change')
    """
    if type in event_queues:
        event_queues[type].put(data)
        return True
    else:
        current_app.logger.error(f"Invalid SSE event type: {type}")
        return False