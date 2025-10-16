# Real-time Chat Backend

A Node.js backend for a real-time chat application using Fastify, Socket.io, and Google Gemini AI integration.

## Features

- 🚀 **Fastify** - Fast and low overhead web framework
- 🔌 **Socket.io** - Real-time bidirectional event-based communication
- 🤖 **Google Gemini AI** - AI-powered chat responses
- 👥 **User Management** - Track connected users and user count
- 💬 **Real-time Messaging** - Instant message broadcasting
- ⌨️ **Typing Indicators** - Show when users are typing
- 🛡️ **Error Handling** - Comprehensive error handling and logging
- 🔧 **Environment Configuration** - Secure API key management

## Prerequisites

- Node.js v18 or higher
- Google Gemini API key

## Installation

1. **Clone or download the project files**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   # Copy the example environment file
   cp env.example .env
   
   # Edit .env and add your Google Gemini API key
   GEMINI_API_KEY=your_actual_api_key_here
   ```

4. **Get your Google Gemini API key:**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key to your `.env` file

## Running the Server

### Development Mode (with auto-restart):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

The server will start on `http://localhost:3000` by default.

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and connected user count.

### Connected Users
```
GET /api/users
```
Returns list of currently connected users.

## Socket.io Events

### Client → Server Events

#### `user_join`
Join the chat with a username.
```javascript
socket.emit('user_join', { username: 'John Doe' });
```

#### `message`
Send a message to the chat.
```javascript
socket.emit('message', { 
  message: 'Hello everyone!', 
  username: 'John Doe' 
});
```

#### `typing`
Indicate typing status.
```javascript
socket.emit('typing', { isTyping: true });
```

### Server → Client Events

#### `user_joined`
Broadcasted when a user joins.
```javascript
socket.on('user_joined', (data) => {
  console.log(data.message); // "John Doe joined the chat"
});
```

#### `user_message`
Broadcasted when a user sends a message.
```javascript
socket.on('user_message', (data) => {
  console.log(`${data.username}: ${data.message}`);
});
```

#### `ai_message`
Broadcasted when AI responds to a message.
```javascript
socket.on('ai_message', (data) => {
  console.log(`${data.username}: ${data.message}`);
});
```

#### `user_left`
Broadcasted when a user leaves.
```javascript
socket.on('user_left', (data) => {
  console.log(data.message); // "John Doe left the chat"
});
```

#### `user_count`
Broadcasted when user count changes.
```javascript
socket.on('user_count', (data) => {
  console.log(`Connected users: ${data.count}`);
});
```

#### `user_typing`
Broadcasted when someone is typing.
```javascript
socket.on('user_typing', (data) => {
  console.log(`${data.username} is typing...`);
});
```

#### `error`
Broadcasted when an error occurs.
```javascript
socket.on('error', (data) => {
  console.error(data.message);
});
```

## Frontend Integration Example

Here's a basic HTML/JavaScript example to connect to your backend:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Chat App</title>
    <script src="/socket.io/socket.io.js"></script>
</head>
<body>
    <div id="messages"></div>
    <input type="text" id="messageInput" placeholder="Type a message...">
    <button onclick="sendMessage()">Send</button>
    
    <script>
        const socket = io('http://localhost:3000');
        const username = prompt('Enter your username:');
        
        // Join the chat
        socket.emit('user_join', { username });
        
        // Listen for messages
        socket.on('user_message', (data) => {
            addMessage(data.username, data.message, 'user');
        });
        
        socket.on('ai_message', (data) => {
            addMessage(data.username, data.message, 'ai');
        });
        
        // Send message
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            if (message) {
                socket.emit('message', { message, username });
                input.value = '';
            }
        }
        
        // Add message to chat
        function addMessage(username, message, type) {
            const messagesDiv = document.getElementById('messages');
            const messageDiv = document.createElement('div');
            messageDiv.innerHTML = `<strong>${username}:</strong> ${message}`;
            messageDiv.style.color = type === 'ai' ? 'blue' : 'black';
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        // Enter key to send
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    </script>
</body>
</html>
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key | Required |
| `PORT` | Server port | 3000 |
| `HOST` | Server host | 0.0.0.0 |

### Customization

You can modify the AI prompt in `server.js` to change how the AI responds:

```javascript
const prompt = `Your custom prompt here. Message: "${message}"`;
```

## Error Handling

The server includes comprehensive error handling for:
- Missing API keys
- Gemini API failures
- Socket connection errors
- Uncaught exceptions
- Graceful shutdown

## Logging

The server provides detailed console logs with emojis for easy identification:
- 🔌 User connections
- 👤 User joins/leaves
- 💬 Messages
- 🤖 AI responses
- ❌ Errors
- 🚀 Server startup

## Security Notes

- Keep your `.env` file secure and never commit it to version control
- The server includes CORS configuration for cross-origin requests
- Consider adding authentication for production use
- Rate limiting can be added for production deployments

## Troubleshooting

### Common Issues

1. **"GEMINI_API_KEY environment variable is required"**
   - Make sure you've created a `.env` file with your API key
   - Verify the API key is valid and active

2. **Socket connection fails**
   - Check if the server is running on the correct port
   - Verify CORS settings if connecting from a different domain

3. **AI responses not working**
   - Verify your Gemini API key has the necessary permissions
   - Check the console for API error messages

## License

MIT License - feel free to use this code for your projects!
