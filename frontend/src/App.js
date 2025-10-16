import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

function App() {
  const [socket, setSocket] = useState(null);
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showUsernameModal, setShowUsernameModal] = useState(true);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    // Connection events
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    // Chat events
    newSocket.on('user_joined', (data) => {
      addMessage(data.message, 'system');
    });

    newSocket.on('user_message', (data) => {
      addMessage(`${data.username}: ${data.message}`, 'user');
    });

    newSocket.on('ai_message', (data) => {
      addMessage(`${data.username}: ${data.message}`, 'ai');
    });

    newSocket.on('user_left', (data) => {
      addMessage(data.message, 'system');
    });

    newSocket.on('user_count', (data) => {
      setUserCount(data.count);
    });

    newSocket.on('user_typing', (data) => {
      if (data.isTyping) {
        setTypingUsers(prev => [...prev.filter(u => u !== data.username), data.username]);
      } else {
        setTypingUsers(prev => prev.filter(u => u !== data.username));
      }
    });

    newSocket.on('error', (data) => {
      addMessage(`Error: ${data.message}`, 'error');
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const addMessage = (text, type) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      text,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleUsernameSubmit = (e) => {
    e.preventDefault();
    if (username.trim() && socket) {
      socket.emit('user_join', { username: username.trim() });
      setShowUsernameModal(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && socket && username) {
      socket.emit('message', { message: message.trim(), username });
      setMessage('');
      setIsTyping(false);
      socket.emit('typing', { isTyping: false });
    }
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    
    if (!isTyping && socket) {
      setIsTyping(true);
      socket.emit('typing', { isTyping: true });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (socket) {
        socket.emit('typing', { isTyping: false });
      }
    }, 1000);
  };

  const getMessageClassName = (type) => {
    switch (type) {
      case 'user': return 'message user-message';
      case 'ai': return 'message ai-message';
      case 'system': return 'message system-message';
      case 'error': return 'message error-message';
      default: return 'message';
    }
  };

  return (
    <div className="App">
      {/* Username Modal */}
      {showUsernameModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Welcome to AI Chat! 🤖</h2>
            <form onSubmit={handleUsernameSubmit}>
              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                required
              />
              <button type="submit">Join Chat</button>
            </form>
          </div>
        </div>
      )}

      {/* Chat Interface */}
      <div className="chat-container">
        {/* Header */}
        <div className="chat-header">
          <div className="header-info">
            <h1>AI Chatbot 💬</h1>
            <div className="status-indicators">
              <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </span>
              <span className="user-count">👥 {userCount} users</span>
            </div>
          </div>
          <div className="user-info">
            <span className="username">👤 {username}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="welcome-message">
              <h3>Welcome to AI Chat! 🎉</h3>
              <p>Start a conversation and I'll respond using AI. Try asking me anything!</p>
              <div className="example-messages">
                <p><strong>Try these examples:</strong></p>
                <ul>
                  <li>"Hello! How are you?"</li>
                  <li>"What's the weather like?"</li>
                  <li>"Tell me a joke"</li>
                  <li>"Help me with coding"</li>
                </ul>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={getMessageClassName(msg.type)}>
                <div className="message-content">{msg.text}</div>
                <div className="message-time">{msg.timestamp}</div>
              </div>
            ))
          )}
          
          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="typing-indicator">
              <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <form className="message-form" onSubmit={handleSendMessage}>
          <div className="input-container">
            <input
              type="text"
              placeholder="Type your message here..."
              value={message}
              onChange={handleTyping}
              disabled={!isConnected || !username}
              maxLength={500}
            />
            <button 
              type="submit" 
              disabled={!message.trim() || !isConnected || !username}
              className="send-button"
            >
              📤
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
