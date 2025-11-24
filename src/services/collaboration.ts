import { IRoom, IClient, IOperation } from '../models/types.js';
import logger from '../utils/logger.js';

export class CollaborationService {
	private rooms: Map<string, IRoom> = new Map();
	private clientRooms: Map<any, string> = new Map();

	createRoom(roomId: string, roomName: string, fileId: string, userId: string, userName: string, socket: any, content: string = '', version: number = 0): IRoom {
		console.log(`[Collab] Creating room: roomId=${roomId}, roomName=${roomName}, fileId=${fileId}, host=${userId}`);
		const room: IRoom = {
			id: roomId,
			name: roomName,
			fileId,
			host: userId,
			content: content,
			operations: [],
			version: version,
			clients: new Map(),
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isActive: true
		};

		room.clients.set(userId, {
			userId,
			userName,
			socket,
			version: version,
			isAuthenticated: true,
			joinedAt: Date.now()
		});

		this.rooms.set(roomId, room);
		this.clientRooms.set(socket, roomId);

		console.log(`[Collab] ✅ Room created: ${roomId} by ${userId} (content: ${content.length} chars, version: ${version})`);
		logger.info(`[Collab] Room created: ${roomId} by ${userId} (content: ${content.length} chars, version: ${version})`);

		return room;
	}

	createRoomFromMetadata(roomId: string, roomName: string, fileId: string, host: string, content: string = '', version: number = 0): IRoom {
		console.log(`[Collab] Creating room from metadata: roomId=${roomId}, roomName=${roomName}, fileId=${fileId}, host=${host}`);
		const room: IRoom = {
			id: roomId,
			name: roomName,
			fileId,
			host: host,
			content: content,
			operations: [],
			version: version,
			clients: new Map(),
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isActive: true
		};

		this.rooms.set(roomId, room);

		console.log(`[Collab] ✅ Room created from metadata: ${roomId} (content: ${content.length} chars, version: ${version})`);
		logger.info(`[Collab] Room created from metadata: ${roomId} by System (content: ${content.length} chars, version: ${version})`);

		return room;
	}

	joinRoom(roomId: string, userId: string, userName: string, socket: any): IRoom | null {
		const room = this.rooms.get(roomId);

		if (!room) {
			logger.warn(`[Collab] Room not found: ${roomId}`);
			return null;
		}

		room.clients.set(userId, {
			userId,
			userName,
			socket,
			version: room.version,
			isAuthenticated: true,
			joinedAt: Date.now()
		});

		this.clientRooms.set(socket, roomId);

		logger.info(`[Collab] User ${userId} joined room ${roomId}`);

		return room;
	}

	leaveRoom(socket: any): string | null {
		const roomId = this.clientRooms.get(socket);

		if (!roomId) {
			console.log(`[Collab] User left with no room association`);
			return null;
		}

		const room = this.rooms.get(roomId);

		if (!room) {
			console.log(`[Collab] Room already deleted: ${roomId}`);
			this.clientRooms.delete(socket);
			return roomId;
		}

		// Find and remove client
		let userId: string | null = null;
		for (const [id, client] of room.clients) {
			if (client.socket === socket) {
				userId = id;
				room.clients.delete(id);
				break;
			}
		}

		console.log(`[Collab] User ${userId} left room ${roomId}. Remaining clients: ${room.clients.size}`);
		logger.info(`[Collab] User ${userId} left room ${roomId}`);

		// Delete room if empty
		if (room.clients.size === 0) {
			this.rooms.delete(roomId);
			console.log(`[Collab] ✅ Room deleted (was empty): ${roomId}`);
			logger.info(`[Collab] Room deleted: ${roomId}`);
		}

		this.clientRooms.delete(socket);

		return roomId;
	}

	applyOperation(roomId: string, operation: IOperation): IRoom | null {
		const room = this.rooms.get(roomId);

		if (!room) {
			console.error(`[Collab] Operation failed: Room not found: ${roomId}`);
			return null;
		}

		console.log(`[Collab] Applying operation in ${roomId}: type=${operation.type}, position=${operation.position}, userId=${operation.userId}`);

		// Update version and apply operation
		room.version++;
		(operation as any).version = room.version;

		// Apply operation to content
		const oldLength = room.content.length;
		room.content = this.applyOperationToText(room.content, operation);
		const newLength = room.content.length;

		// Store operation in history
		room.operations.push(operation);
		room.updatedAt = Date.now();

		console.log(`[Collab] ✅ Operation applied: version=${room.version}, contentLength: ${oldLength} -> ${newLength}, totalOps=${room.operations.length}`);
		logger.debug(`[Collab] Operation applied in ${roomId}: ${operation.type} at ${operation.position}`);
		return room;
	}

	private applyOperationToText(text: string, operation: IOperation): string {
		if (operation.type === 'insert') {
			const content = operation.content || '';
			return text.slice(0, operation.position) + content + text.slice(operation.position);
		} else if (operation.type === 'delete') {
			const length = operation.length || 0;
			return text.slice(0, operation.position) + text.slice(operation.position + length);
		}
		return text;
	}

	getRoom(roomId: string): IRoom | undefined {
		return this.rooms.get(roomId);
	}

	getRoomBySocket(socket: any): IRoom | null {
		const roomId = this.clientRooms.get(socket);
		if (!roomId) {
			return null;
		}
		return this.rooms.get(roomId) || null;
	}

	getAllRooms(): IRoom[] {
		return Array.from(this.rooms.values());
	}

	getActiveRoomsCount(): number {
		return this.rooms.size;
	}

	broadcastToRoom(roomId: string, message: any, excludeSocket?: any): void {
		const room = this.rooms.get(roomId);

		if (!room) {
			return;
		}

		for (const [, client] of room.clients) {
			if (excludeSocket && client.socket === excludeSocket) {
				continue;
			}

			this.sendToClient(client.socket, message);
		}
	}

	private sendToClient(socket: any, message: any): void {
		if (socket && socket.readyState === 1) { // WebSocket.OPEN = 1
			try {
				socket.send(JSON.stringify(message));
			} catch (error) {
				logger.error('[Collab] Failed to send message to client', error);
			}
		}
	}

	getStats() {
		const rooms = this.getAllRooms();
		const totalClients = rooms.reduce((sum, room) => sum + room.clients.size, 0);

		return {
			roomsCount: rooms.length,
			totalClients,
			totalOperations: rooms.reduce((sum, room) => sum + room.operations.length, 0),
			rooms: rooms.map(room => ({
				id: room.id,
				name: room.name,
				clientsCount: room.clients.size,
				contentLength: room.content.length,
				version: room.version,
				createdAt: room.createdAt
			}))
		};
	}
}

export default new CollaborationService();
