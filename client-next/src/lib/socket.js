import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";

export function connectSocket() {
  return io(SOCKET_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"],
  });
}
