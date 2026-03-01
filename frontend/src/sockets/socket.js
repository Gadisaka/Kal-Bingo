import { io } from "socket.io-client";
import { API_URL } from "../constant";

const SERVER_URL = API_URL;

let connectionState = "connecting"; // connecting | connected | disconnected | error | failed

const socket = io(SERVER_URL, {
  transports: ["websocket"],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

function emitConnectionState(state) {
  connectionState = state;
  socket.emit("connectionStateChange", state);
}

socket.on("connect", () => {
  emitConnectionState("connected");
});

socket.on("connect_error", () => {
  emitConnectionState("error");
});

socket.on("disconnect", (reason) => {
  if (reason === "io client disconnect") {
    emitConnectionState("disconnected");
  } else if (reason === "transport close" || reason === "ping timeout") {
    emitConnectionState("failed");
  } else {
    emitConnectionState("disconnected");
  }
});

export const socketClient = {
  instance: socket,
  getConnectionState: () => connectionState,
  reconnect: () => socket.connect(),
};
