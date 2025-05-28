import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: ["http://localhost:3000"],
		methods: ["GET", "POST"],
	},
});

let ioInstance;
const userSocketMap = {}; // {userId: socketId}

export const initializeSocketIO = (io) => {
	ioInstance = io;

	ioInstance.on("connection", (socket) => {
		console.log("A user connected to main IO instance:", socket.id);

		socket.on("registerUser", (userId) => {
			if (userId) {
				userSocketMap[userId] = socket.id;
				console.log(`User ${userId} registered with socket ${socket.id} in userSocketMap`);
				// Notify all clients about the updated list of online users
				ioInstance.emit("getOnlineUsers", Object.keys(userSocketMap));
			}
		});

		// Emit the current list of online users to the newly connected client once they might register
		// Consider sending this after successful registration if that's preferred.
		socket.emit("getOnlineUsers", Object.keys(userSocketMap));

		socket.on("disconnect", () => {
			console.log("User disconnected from main IO instance:", socket.id);
			let userIdToRemove = null;
			for (const userId in userSocketMap) {
				if (userSocketMap[userId] === socket.id) {
					userIdToRemove = userId;
					break;
				}
			}
			if (userIdToRemove) {
				delete userSocketMap[userIdToRemove];
				console.log(`User ${userIdToRemove} unregistered from userSocketMap`);
				// Notify all clients about the updated list of online users
				ioInstance.emit("getOnlineUsers", Object.keys(userSocketMap));
			}
		});
	});
};

export const getSockets = (receiverId) => {
	return userSocketMap[receiverId];
};

// Export the main io instance so controllers can use it
// This will be undefined until initializeSocketIO is called from server.js
export { ioInstance as io }; 