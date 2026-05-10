const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const messageRoutes = require('./routes/messages');
const webhookRoutes = require('./routes/webhooks');

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/messages', messageRoutes);
app.use('/api/webhooks', webhookRoutes);

// WebSocket connections
const clients = new Map();

wss.on('connection', (ws, req) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    ws.close(1008, 'User ID required');
    return;
  }

  console.log(`Client connected: ${userId}`);
  clients.set(userId, ws);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log(`Message from ${userId}:`, message);
      // Broadcast to other users or handle messaging
    } catch (err) {
      console.error('Message parse error:', err);
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${userId}`);
    clients.delete(userId);
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error for ${userId}:`, err);
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Node.js API Server running on port ${PORT}`);
});

module.exports = { app, wss, clients };
