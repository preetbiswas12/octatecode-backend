import { IRoom, IClient, IOperation } from '../models/types.js';
import logger from '../utils/logger.js';

export class CollaborationService {
	private rooms: Map<string, IRoom> = new Map();
	private clientRooms: Map<any, string> = new Map();

	createRoom(roomId: string, roomName: string, fileId: string, userId: string, userName: string, socket: any): IRoom {
		const room: IRoom = {
			id: roomId,
			name: roomName,
			fileId,
			host: userId,
			content: '',
			operations: [],
			version: 0,
			clients: new Map(),
			createdAt: Date.now(),
			updatedAt: Date.now(),
			isActive: true
		};

		room.clients.set(userId, {
			userId,
			userName,
			socket,
			version: 0,
			isAuthenticated: true,
			joinedAt: Date.now()
		});

		this.rooms.set(roomId, room);
		this.clientRooms.set(socket, roomId);

		logger.info(`[Collab] Room created: ${roomId} by ${userId}`);

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
			return null;
		}

		const room = this.rooms.get(roomId);

		if (!room) {
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

		logger.info(`[Collab] User ${userId} left room ${roomId}`);

		// Delete room if empty
		if (room.clients.size === 0) {
			this.rooms.delete(roomId);
			logger.info(`[Collab] Room deleted: ${roomId}`);
		}

		this.clientRooms.delete(socket);

		return roomId;
	}

	applyOperation(roomId: string, operation: IOperation): IRoom | null {
		const room = this.rooms.get(roomId);

		if (!room) {
			return null;
		}

		// Update version and apply operation
		room.version++;
		(operation as any).version = room.version;

		// Apply operation to content
		room.content = this.applyOperationToText(room.content, operation);

		// Store operation in history
		room.operations.push(operation);
		room.updatedAt = Date.now();

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
