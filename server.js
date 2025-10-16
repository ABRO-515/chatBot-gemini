const fastify = require('fastify')({ logger: true });
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Validate required environment variables
if (!GEMINI_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Register Fastify plugins
fastify.register(require('@fastify/cors'), {
  origin: true,
  credentials: true
});

fastify.register(require('@fastify/static'), {
  root: require('path').join(__dirname, 'public'),
  prefix: '/public/'
});

// Create HTTP server
const server = fastify.server;

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store connected users
const connectedUsers = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  
  // Handle user joining
  socket.on('user_join', (userData) => {
    const { username } = userData;
    connectedUsers.set(socket.id, { username, joinTime: new Date() });
    
    console.log(`👤 User joined: ${username} (${socket.id})`);
    
    // Notify all clients about the new user
    socket.broadcast.emit('user_joined', {
      username,
      message: `${username} joined the chat`,
      timestamp: new Date().toISOString()
    });
    
    // Send current user count
    io.emit('user_count', { count: connectedUsers.size });
  });

  // Handle incoming messages
  socket.on('message', async (messageData) => {
    try {
      const { message, username } = messageData;
      const user = connectedUsers.get(socket.id);
      
      if (!user) {
        socket.emit('error', { message: 'User not found. Please reconnect.' });
        return;
      }

      console.log(`💬 Message from ${username}: ${message}`);

      // Broadcast user message to all clients
      io.emit('user_message', {
        id: Date.now(),
        username,
        message,
        timestamp: new Date().toISOString(),
        type: 'user'
      });

      // Generate AI response using Gemini
      try {
        console.log('🤖 Generating AI response...');
        
        const prompt = `You are a helpful AI assistant in a chat room. Respond to this message in a conversational, friendly manner. Keep responses concise (1-2 sentences) and engaging. Message: "${message}"`;
        
        const result = await model.generateContent(prompt);
        const aiResponse = result.response.text();
        
        console.log(`🤖 AI Response: ${aiResponse}`);

        // Broadcast AI response to all clients
        io.emit('ai_message', {
          id: Date.now() + 1,
          username: 'AI Assistant',
          message: aiResponse,
          timestamp: new Date().toISOString(),
          type: 'ai'
        });

      } catch (aiError) {
        console.error('❌ Error generating AI response:', aiError);
        
        // Send error message to all clients
        io.emit('ai_message', {
          id: Date.now() + 1,
          username: 'AI Assistant',
          message: 'Sorry, I encountered an error while processing your message. Please try again.',
          timestamp: new Date().toISOString(),
          type: 'ai_error'
        });
      }

    } catch (error) {
      console.error('❌ Error handling message:', error);
      socket.emit('error', { message: 'Failed to process message' });
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      socket.broadcast.emit('user_typing', {
        username: user.username,
        isTyping: data.isTyping
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      console.log(`👋 User disconnected: ${user.username} (${socket.id})`);
      
      // Notify all clients about the user leaving
      socket.broadcast.emit('user_left', {
        username: user.username,
        message: `${user.username} left the chat`,
        timestamp: new Date().toISOString()
      });
      
      // Remove user from connected users
      connectedUsers.delete(socket.id);
      
      // Send updated user count
      io.emit('user_count', { count: connectedUsers.size });
    }
  });
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connectedUsers: connectedUsers.size,
    uptime: process.uptime()
  };
});

// API endpoint to get connected users
fastify.get('/api/users', async (request, reply) => {
  const users = Array.from(connectedUsers.values()).map(user => ({
    username: user.username,
    joinTime: user.joinTime
  }));
  
  return {
    users,
    count: users.length
  };
});

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
    console.log(`📡 Socket.io server ready for connections`);
    console.log(`🤖 Gemini AI integration enabled`);
    console.log(`👥 Connected users: ${connectedUsers.size}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

start();
