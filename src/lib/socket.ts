// One Socket.IO connection to the game server, shared by the whole app.

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentUrl = '';

export function connect(url: string): Socket {
  if (socket && currentUrl === url) return socket;
  socket?.disconnect();
  currentUrl = url;
  socket = io(url, { transports: ['websocket'], reconnection: true });
  return socket;
}

export function getSocket() {
  return socket;
}

/** Sends an event and waits for the server's answer */
export function request<T = Record<string, unknown>>(event: string, payload: object = {}, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Not connected to the server'));
      return;
    }
    socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, res: { ok: boolean; error?: string } & T) => {
      if (err) reject(new Error(`Can't reach the server at ${currentUrl}. Is it running?`));
      else if (!res?.ok) reject(new Error(res?.error ?? 'Request failed'));
      else resolve(res);
    });
  });
}
