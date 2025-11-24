import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { authenticateFromHeader } from '../utils/auth.js';
import { IServerMessage, IOperation } from '../models/types.js';
import collaborationService from './collaboration.js';
import logger from '../utils/logger.js';

export class WebSocketService {
	private wss: WebSocketServer;

	constructor(httpServer: HttpServer) {
		this.wss = new WebSocketServer({ server: httpServer, path: '/collaborate' });
		this.setupHandlers();
	}

	private setupHandlers(): void {
		this.wss.on('connection', (socket: WebSocket) => {
			logger.info('[WebSocket] New client connected');
			(socket as any).isAuthenticated = false;

			socket.on('message', (data: Buffer) => {
				this.handleMessage(socket, data);
			});

			socket.on('close', () => {
				this.handleDisconnect(socket);
			});

			socket.on('error', (error: Error) => {
				logger.error('[WebSocket] Error:', error);
			});

			// Send welcome message
			this.send(socket, {
				type: 'welcome',
				data: {
					message: 'Connected to Void collaboration server',
					version: '1.0.0'
				}
			});
		});

		logger.info('[WebSocket] Server initialized');
	}

	private handleMessage(socket: WebSocket, data: Buffer): void {
		try {
			const message: IServerMessage = JSON.parse(data.toString());
			console.log(`[WebSocket] Message received: ${message.type}`, message.data);

			// Check authentication for non-auth messages
			if (message.type !== 'auth' && !(socket as any).isAuthenticated) {
				console.error(`[WebSocket] Unauthenticated message: ${message.type}`);
				this.send(socket, {
					type: 'error',
					data: { message: 'Not authenticated. Send auth message first.' }
				});
				return;
			}

			switch (message.type) {
				case 'auth':
					this.handleAuth(socket, message);
					break;
				case 'create-room':
					this.handleCreateRoom(socket, message);
					break;
				case 'join-room':
					this.handleJoinRoom(socket, message);
					break;
				case 'operation':
					this.handleOperation(socket, message);
					break;
				case 'presence':
					this.handlePresence(socket, message);
					break;
				case 'ping':
					this.send(socket, { type: 'pong' });
					break;
				default:
					logger.warn(`[WebSocket] Unknown message type: ${message.type}`);
			}
		} catch (error) {
			logger.error('[WebSocket] Parse error:', error);
			this.send(socket, {
				type: 'error',
				data: { message: 'Invalid message format' }
			});
		}
	}

	private handleAuth(socket: WebSocket, message: IServerMessage): void {
		console.log(`[WebSocket] Auth attempt: ${message.data?.userId || 'anonymous'}`);
		const token = message.data?.token;
		const roomId = message.data?.roomId;
		const userId = message.data?.userId;
		const userName = message.data?.userName;

		if (!token && !roomId) {
			console.error(`[WebSocket] Auth failed: Missing token or roomId`);
			this.send(socket, {
				type: 'auth-error',
				data: { message: 'Missing token or roomId' }
			});
			return;
		}

		// Try JWT verification first (for production)
		let auth = token ? authenticateFromHeader(`Bearer ${token}`) : null;

		// Fallback: allow dev/room-based auth with roomId + userId (for development)
		if (!auth && roomId && userId) {
			auth = {
				userId: userId,
				email: `dev-${userId}@void.local`,
				userName: userName || userId,
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 86400
			};
			logger.info(`[WebSocket] Development auth enabled for room ${roomId}`);
		}

		if (!auth) {
			console.error(`[WebSocket] Auth FAILED: Invalid token`);
			this.send(socket, {
				type: 'auth-error',
				data: { message: 'Invalid token' }
			});
			socket.close(1008, 'Authentication failed');
			return;
		}

		// Mark as authenticated
		(socket as any).isAuthenticated = true;
		(socket as any).userId = auth.userId;
		(socket as any).email = auth.email;
		(socket as any).userName = auth.userName;

		console.log(`[WebSocket] ✅ Auth SUCCESS: userId=${auth.userId}, userName=${auth.userName}`);
		logger.info(`[WebSocket] User authenticated: ${auth.userId}`);

		this.send(socket, {
			type: 'auth-success',
			data: {
				userId: auth.userId,
				userName: auth.userName,
				email: auth.email
			}
		});
	}

	private handleCreateRoom(socket: WebSocket, message: IServerMessage): void {
		const userId = (socket as any).userId;
		const { roomName, fileId, userName } = message.data || {};
		console.log(`[WebSocket] Room creation request: roomName=${roomName}, fileId=${fileId}, userId=${userId}`);

		if (!roomName || !fileId) {
			console.error(`[WebSocket] Room creation FAILED: Missing roomName or fileId`);
			this.send(socket, {
				type: 'error',
				data: { message: 'Missing roomName or fileId' }
			});
			return;
		}

		// Generate room ID
		const roomId = `room-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

		// Create room
		const room = collaborationService.createRoom(roomId, roomName, fileId, userId, userName || userId, socket);

		console.log(`[WebSocket] ✅ Room created: ${roomId}`);
		logger.info(`[WebSocket] Room created: ${roomId}`);

		this.send(socket, {
			type: 'room-created',
			data: {
				roomId,
				roomName,
				fileId,
				version: room.version,
				content: room.content
			}
		});
	}

	private handleJoinRoom(socket: WebSocket, message: IServerMessage): void {
		const userId = (socket as any).userId;
		const { roomId, userName, fileId, roomName, host, content, version } = message.data || {};
		console.log(`[WebSocket] Join room request: roomId=${roomId}, userId=${userId}, userName=${userName}`);
		console.log(`[WebSocket] Metadata received: roomName=${roomName}, fileId=${fileId}, host=${host}, contentLength=${content?.length || 0}, version=${version}`);

		if (!roomId) {
			console.error(`[WebSocket] Join FAILED: Missing roomId`);
			this.send(socket, {
				type: 'error',
				data: { message: 'Missing roomId' }
			});
			return;
		}

		// Check if room exists, if not create it from metadata (for host flow)
		let room = collaborationService.getRoom(roomId);
		if (!room) {
			console.log(`[WebSocket] Room not found in memory: ${roomId}. Checking metadata...`);
			if (roomName || fileId) {
				console.log(`[WebSocket] Creating room from metadata: roomName=${roomName}, fileId=${fileId}`);
				room = collaborationService.createRoomFromMetadata(
					roomId,
					roomName || `Room ${roomId}`,
					fileId || '',
					host || userId,
					content || '',
					version || 0
				);
				console.log(`[WebSocket] ✅ Room created from metadata: ${roomId}`);
			}
		}

		// Join room
		if (!room) {
			console.log(`[WebSocket] Attempting standard joinRoom...`);
			const joinedRoom = collaborationService.joinRoom(roomId, userId, userName || userId, socket);
			if (joinedRoom) {
				room = joinedRoom;
				console.log(`[WebSocket] ✅ Joined existing room: ${roomId}`);
			}
		} else {
			// Add client to existing or newly created room
			console.log(`[WebSocket] Adding client to existing room: ${roomId}`);
			room.clients.set(userId, {
				userId,
				userName: userName || userId,
				socket,
				version: room.version,
				isAuthenticated: true,
				joinedAt: Date.now()
			});
			(collaborationService as any).clientRooms.set(socket, roomId);
			console.log(`[WebSocket] ✅ Client added to room: ${roomId}`);
		}

		if (!room) {
			console.error(`[WebSocket] Join FAILED: Room not found after all attempts: ${roomId}`);
			this.send(socket, {
				type: 'error',
				data: { message: 'Room not found' }
			});
			return;
		}

		console.log(`[WebSocket] ✅ User ${userId} joined room ${roomId}. Room now has ${room.clients.size} clients`);
		logger.info(`[WebSocket] User ${userId} joined room ${roomId}`);

		// Send sync data to joining client
		console.log(`[WebSocket] Sending sync data: content=${room.content.length} chars, version=${room.version}, clients=${room.clients.size}`);
		this.send(socket, {
			type: 'sync',
			data: {
				roomId,
				content: room.content,
				version: room.version,
				users: Array.from(room.clients.values()).map(client => ({
					userId: client.userId,
					userName: client.userName
				}))
			}
		});

		// Notify other clients in room
		console.log(`[WebSocket] Broadcasting user-joined to other clients in room: ${roomId}`);
		collaborationService.broadcastToRoom(roomId, {
			type: 'user-joined',
			data: { userId, userName }
		}, socket);
	}

	private handleOperation(socket: WebSocket, message: IServerMessage): void {
		const room = collaborationService.getRoomBySocket(socket);

		if (!room) {
			console.error(`[WebSocket] Operation failed: Not in a room`);
			this.send(socket, {
				type: 'error',
				data: { message: 'Not in a room' }
			});
			return;
		}

		const operation = message.data as IOperation;

		if (!operation || !operation.type || operation.position === undefined) {
			console.error(`[WebSocket] Operation failed: Invalid operation structure`);
			this.send(socket, {
				type: 'error',
				data: { message: 'Invalid operation' }
			});
			return;
		}

		console.log(`[WebSocket] Operation received: type=${operation.type}, position=${operation.position}, roomId=${room.id}`);

		// Apply operation
		const updatedRoom = collaborationService.applyOperation(room.id, operation);

		if (!updatedRoom) {
			console.error(`[WebSocket] Operation failed: Could not apply to room ${room.id}`);
			return;
		}

		console.log(`[WebSocket] ✅ Operation applied: version=${updatedRoom.version}, newContentLength=${updatedRoom.content.length}`);

		// Send ACK to sender
		this.send(socket, {
			type: 'ack',
			data: {
				version: updatedRoom.version,
				operationId: (operation as any).id
			}
		});

		// Broadcast operation to other clients
		console.log(`[WebSocket] Broadcasting operation to ${updatedRoom.clients.size - 1} other clients`);
		collaborationService.broadcastToRoom(room.id, {
			type: 'operation',
			data: operation
		}, socket);
	} private handlePresence(socket: WebSocket, message: IServerMessage): void {
		const room = collaborationService.getRoomBySocket(socket);

		if (!room) {
			return;
		}

		// Broadcast presence to other clients
		collaborationService.broadcastToRoom(room.id, {
			type: 'presence',
			data: message.data
		}, socket);
	}

	private handleDisconnect(socket: WebSocket): void {
		const userId = (socket as any).userId;
		const roomId = collaborationService.leaveRoom(socket);

		if (roomId) {
			console.log(`[WebSocket] ✅ User ${userId} disconnected from room ${roomId}`);
			logger.info(`[WebSocket] User disconnected from room ${roomId}`);

			const room = collaborationService.getRoom(roomId);
			if (room) {
				// Notify remaining clients
				console.log(`[WebSocket] Notifying ${room.clients.size} remaining clients of user departure`);
				collaborationService.broadcastToRoom(roomId, {
					type: 'user-left',
					data: { userId }
				});
			} else {
				console.log(`[WebSocket] Room ${roomId} deleted (was empty)`);
			}
		} else {
			console.log(`[WebSocket] User disconnected without being in a room`);
		}
	}

	private send(socket: WebSocket, message: any): void {
		if (socket.readyState === WebSocket.OPEN) {
			try {
				socket.send(JSON.stringify(message));
			} catch (error) {
				logger.error('[WebSocket] Failed to send message', error);
			}
		}
	}

	getStats() {
		return {
			connectedClients: this.wss.clients.size,
			rooms: collaborationService.getStats()
		};
	}
}



