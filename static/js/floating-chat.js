
document.addEventListener('DOMContentLoaded', function() {
    const chatInput = document.getElementById('floating-chat-input');
    const sendButton = document.getElementById('floating-chat-send');
    const messagesContainer = document.getElementById('floating-chat-messages');
    
    let isNewChat = true;
    
    function addMessage(message, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `floating-chat-message ${isUser ? 'user' : 'assistant'}`;
        messageDiv.innerHTML = `
            <div class="message-content">
                ${message}
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function sendMessage(message) {
        if (!message.trim()) return;
        
        addMessage(message, true);
        chatInput.value = '';
        
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                is_new_chat: isNewChat
            }),
        })
        .then(response => response.json())
        .then(data => {
            addMessage(data.response);
            isNewChat = false;
        })
        .catch(error => {
            console.error('Error:', error);
            addMessage('Sorry, I encountered an error. Please try again.');
        });
    }
    
    // Send button click handler
    sendButton.addEventListener('click', () => {
        sendMessage(chatInput.value);
    });
    
    // Enter key handler
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage(chatInput.value);
        }
    });
    
    // Add welcome message when chat is opened
    document.getElementById('floating-chat').addEventListener('show.bs.collapse', function() {
        if (messagesContainer.children.length === 0) {
            addMessage("Hello! I'm your CrisisConnect AI Assistant. How can I help you today?");
        }
    });
});
