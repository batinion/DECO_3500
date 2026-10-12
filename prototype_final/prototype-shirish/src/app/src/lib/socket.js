import { io } from "socket.io-client";

let socket = null;
let currentUrl = null;

export function getSocket(serverUrl) {
  if (socket && currentUrl === serverUrl) return socket;
  if (socket) socket.disconnect();
  currentUrl = serverUrl;
  socket = io(serverUrl, { transports: ["websocket"], forceNew: true });
  return socket;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
  currentUrl = null;
}

/** Emit an event and resolve with the server's ack payload, or reject on timeout. */
export function emitWithAck(evt, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error("Not connected."));
    const timer = setTimeout(() => reject(new Error("Server did not respond in time.")), timeoutMs);
    socket.emit(evt, payload, (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}
