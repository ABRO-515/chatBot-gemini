const fastify = require('fastify')({ logger: true });
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const path = require('path');

// Configuration
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Validate environment variables
if (!GEMINI_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Register Fastify plugins
fastify.register(require('@fastify/cors'), {
  origin: true,
  credentials: true
});

fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
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

// User memory for Buddy mode
const userMemory = new Map();

// Socket.io connection
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on('user_join', (userData) => {
    const { username } = userData;
    connectedUsers.set(socket.id, { username, joinTime: new Date() });

    console.log(`👤 User joined: ${username} (${socket.id})`);

    socket.broadcast.emit('user_joined', {
      username,
      message: `${username} joined the chat`,
      timestamp: new Date().toISOString()
    });

    io.emit('user_count', { count: connectedUsers.size });
  });

  // Message handler with Buddy memory
  socket.on('message', async (messageData) => {
    try {
      const { message, username } = messageData;

      const user = connectedUsers.get(socket.id);
      if (!user) {
        socket.emit('error', { message: 'User not found. Please reconnect.' });
        return;
      }

      console.log(`💬 Message from ${username}: ${message}`);

      // Broadcast user message
      io.emit('user_message', {
        id: Date.now(),
        username,
        message,
        timestamp: new Date().toISOString(),
        type: 'user'
      });

      // Maintain per-user memory
      if (!userMemory.has(socket.id)) userMemory.set(socket.id, []);
      const chatHistory = userMemory.get(socket.id);

      chatHistory.push({ role: 'user', content: message });
      if (chatHistory.length > 10) chatHistory.shift(); // keep last 10

      // Generate prompt with context (no questions to user)
      const historyString = chatHistory
        .map(msg => `${msg.role === 'user' ? 'User' : 'Buddy'}: ${msg.content}`)
        .join('\n');

      const prompt = `
You are "Buddy" — a warm, caring AI friend who chats naturally in Hinglish.
Respond **directly and casually**; never ask the user what to do next.
Keep replies short, friendly, and genuine — like a real dost.

🧩 Conversation Style:
- Casual Hinglish (mix English + Hindi/Urdu)
- Refer to previous messages naturally
- Never ask the user questions or offer options
- Use empathy, jokes, or friendly tone based on the vibe

🧠 Memory Behavior:
- Remember key details from the chat (user mood, plans, food, etc.)
- Refer back naturally, do not prompt the user for actions

${historyString}
Buddy:
`;

      console.log('🤖 Generating AI response...');
      const result = await model.generateContent(prompt);
      const aiResponse = result.response.text();

      console.log(`🤖 AI Response: ${aiResponse}`);

      chatHistory.push({ role: 'assistant', content: aiResponse });

      io.emit('ai_message', {
        id: Date.now() + 1,
        username: 'AI Assistant',
        message: aiResponse,
        timestamp: new Date().toISOString(),
        type: 'ai'
      });

    } catch (error) {
      console.error('❌ Error handling message:', error);
      socket.emit('error', { message: 'Failed to process message' });
    }
  });

  socket.on('typing', (data) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      socket.broadcast.emit('user_typing', {
        username: user.username,
        isTyping: data.isTyping
      });
    }
  });

  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      console.log(`👋 User disconnected: ${user.username} (${socket.id})`);

      socket.broadcast.emit('user_left', {
        username: user.username,
        message: `${user.username} left the chat`,
        timestamp: new Date().toISOString()
      });

      connectedUsers.delete(socket.id);
      userMemory.delete(socket.id);
      io.emit('user_count', { count: connectedUsers.size });
    }
  });
});

// API route for Buddy messages
fastify.post('/api/buddy', async (request, reply) => {
  try {
    const { message, history } = request.body;

    if (!message) return reply.status(400).send({ success: false, error: 'Message is required' });

    console.log(`💬 API message received: ${message}`);

    const historyString = (history || [])
      .map(msg => `${msg.role === 'user' ? 'User' : 'Buddy'}: ${msg.content}`)
      .join('\n');

    const prompt = `
You are "Buddy" — a warm, caring AI friend who chats naturally in Hinglish.
Respond directly and casually; never ask the user what to do next.
Keep replies short, friendly, and genuine — like a real dost.

🧩 Conversation Style:
- Casual Hinglish (mix English + Hindi/Urdu)
- Refer to previous messages naturally
- Never ask the user questions or offer options

🧠 Memory Behavior:
- Remember key details from the chat
- Refer back naturally, do not prompt the user for actions

${historyString}
Buddy:
`;

    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    console.log(`🤖 API AI Response: ${aiResponse}`);

    return reply.send({
      success: true,
      reply: aiResponse
    });

  } catch (error) {
    console.error('❌ Error in /api/buddy:', error);
    return reply.status(500).send({
      success: false,
      error: 'Failed to generate AI response'
    });
  }
});

// Buddy greeting API
fastify.get('/api/buddy/greeting', async (request, reply) => {
  try {
    const hour = new Date().getHours();
    let timeGreeting = hour < 12 ? "Good morning! 🌞" : hour < 18 ? "Good afternoon! ☀️" : "Good evening! 🌙";

    const greetings = [
      `${timeGreeting} Kaise ho Buddy? 😄`,
      "Oye kya haal hai? 😜",
      "Hello dost! Mood kaisa hai aaj? 😊",
      "Yo Buddy! Kya scene hai? 😎",
      "Aaj ka din kaisa jaa raha hai? 😊",
    ];

    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

    return reply.send({
      success: true,
      greeting: randomGreeting,
    });
  } catch (error) {
    console.error("❌ Error in /api/buddy/greeting:", error);
    return reply.status(500).send({
      success: false,
      greeting: "Hey Buddy! Kaise ho? 😄", // fallback
    });
  }
});

// Health check
fastify.get('/health', async () => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  connectedUsers: connectedUsers.size,
  uptime: process.uptime()
}));

// Connected users list
fastify.get('/api/users', async () => {
  const users = Array.from(connectedUsers.values()).map(user => ({
    username: user.username,
    joinTime: user.joinTime
  }));
  return { users, count: users.length };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
    console.log(`📡 Socket.io ready`);
    console.log(`🤖 Gemini AI integration enabled`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => { console.log('🛑 SIGTERM'); await fastify.close(); process.exit(0); });
process.on('SIGINT', async () => { console.log('🛑 SIGINT'); await fastify.close(); process.exit(0); });
process.on('uncaughtException', (error) => { console.error('❌ Uncaught Exception:', error); process.exit(1); });
process.on('unhandledRejection', (reason, promise) => { console.error('❌ Unhandled Rejection:', promise, 'reason:', reason); process.exit(1); });

start();
