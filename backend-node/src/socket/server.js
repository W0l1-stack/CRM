const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../logger');
const { roomForAccount } = require('./rooms');

let io = null;

// Pull the JWT from socket auth, query, or Authorization header.
function extractToken(socket) {
  const { auth, query, headers } = socket.handshake;
  if (auth && auth.token) return auth.token;
  if (query && query.token) return query.token;
  const header = headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// initSocket attaches a Socket.io server that authenticates every connection
// with the same JWT the Go API issues, then joins the account room.
function initSocket(httpServer) {
  io = new Server(httpServer, {
    path: '/rt/socket.io',
    cors: { origin: '*' },
  });

  io.use((socket, next) => {
    const token = extractToken(socket);
    if (!token) return next(new Error('unauthorized'));
    try {
      const claims = jwt.verify(token, config.jwtSecret);
      socket.data.accountID = claims.account_id;
      socket.data.userID = claims.user_id;
      next();
    } catch (err) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { accountID } = socket.data;
    socket.join(roomForAccount(accountID));
    logger.info({ accountID, socketId: socket.id }, 'socket connected');

    socket.on('disconnect', () => {
      logger.info({ accountID, socketId: socket.id }, 'socket disconnected');
    });
  });

  return io;
}

// emitToAccount sends an event to every socket in one account's room.
function emitToAccount(accountID, event, payload) {
  if (!io) return;
  io.to(roomForAccount(accountID)).emit(event, payload);
}

module.exports = { initSocket, emitToAccount, getIo: () => io };
