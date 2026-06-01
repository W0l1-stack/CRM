import { io } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3002';

let socket = null;

/** getSocket returns a lazily-created, JWT-authenticated Socket.io connection. */
export function getSocket() {
  if (socket) return socket;
  const token = useAuthStore.getState().accessToken;
  socket = io(SOCKET_URL, {
    path: '/rt/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
