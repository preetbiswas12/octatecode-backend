/*---------------------------------------------------------------------------------------------
 *  Void Backend - WebSocket Message Router
 *  Handles real-time collaboration messages and broadcasts to room members
 *--------------------------------------------------------------------------------------------*/

import { WebSocket } from 'ws';
import logger from '../utils/logger.js';

interface ConnectedUser {
	userId: string;
	userName: string;
	ws: WebSocket;
	roomId: string;
	connectedAt: number;
}

interface RoomSession {
	roomId: string;
	users: Map<string, ConnectedUser>;
	createdAt: number;
}

/**
 * WebSocket message router for collaboration
 * Manages connections, message routing, and presence tracking
 */
export class CollaborationWebSocketRouter {
	private rooms: Map<string, RoomSession> = new Map();
	private userConnections: Map<string, ConnectedUser> = new Map();

	/**
	 * Handle new WebSocket connection
	 */
	public handleNewConnection(ws: WebSocket): void {
		logger.info('[WS] New WebSocket connection');

		ws.on('message', (data) => {
			try {
				const message = JSON.parse(data.toString());
				this.routeMessage(ws, message);
			} catch (error) {
				logger.error('[WS] Error parsing message:', error);
				this.sendError(ws, 'Invalid message format');
			}
		});

		ws.on('close', () => {
			this.handleDisconnection(ws);
		});

		ws.on('error', (error) => {
			logger.error('[WS] WebSocket error:', error);
		});

		// Send welcome message
		this.sendMessage(ws, {
			type: 'connected',
			message: 'Connected to collaboration server',
			timestamp: Date.now()
		});
	}

	/**
	 * Route incoming messages to appropriate handlers
	 */
	private routeMessage(ws: WebSocket, message: any): void {
		const { type, roomId, userId, userName } = message;

		switch (type) {
			case 'join':
				this.handleJoinRoom(ws, roomId, userId, userName);
				break;

			case 'operation':
				this.handleOperation(message);
				break;

			case 'cursor':
				this.handleCursorUpdate(message);
				break;

			case 'presence':
				this.handlePresenceUpdate(message);
				break;

			case 'sync_request':
				this.handleSyncRequest(message);
				break;

			case 'ping':
				this.handlePing(ws, message);
				break;

			default:
				logger.warn('[WS] Unknown message type:', type);
		}
	}

	/**
	 * Handle user joining a room
	 */
	private handleJoinRoom(ws: WebSocket, roomId: string, userId: string, userName: string): void {
		try {
			logger.info(`[WS] User ${userName} (${userId}) joining room ${roomId}`);

			// Create or get room session
			let room = this.rooms.get(roomId);
			if (!room) {
				room = {
					roomId,
					users: new Map(),
					createdAt: Date.now()
				};
				this.rooms.set(roomId, room);
			}

			// Create user connection
			const user: ConnectedUser = {
				userId,
				userName,
				ws,
				roomId,
				connectedAt: Date.now()
			};

			room.users.set(userId, user);
			this.userConnections.set(userId, user);

			// Send confirmation
			this.sendMessage(ws, {
				type: 'joined',
				roomId,
				userId,
				message: `Joined room ${roomId}`,
				timestamp: Date.now()
			});

			// Notify other users in room
			this.broadcastToRoom(roomId, {
				type: 'user_joined',
				userId,
				userName,
				timestamp: Date.now()
			}, userId);

			// Send list of active users
			const activeUsers = Array.from(room.users.values()).map(u => ({
				userId: u.userId,
				userName: u.userName,
				isActive: true
			}));

			this.sendMessage(ws, {
				type: 'active_users',
				users: activeUsers,
				timestamp: Date.now()
			});

			logger.info(`[WS] Room ${roomId} now has ${room.users.size} user(s)`);
		} catch (error) {
			logger.error('[WS] Error joining room:', error);
			this.sendError(ws, 'Failed to join room');
		}
	}

	/**
	 * Handle document operation
	 */
	private handleOperation(message: any): void {
		try {
			const { roomId, userId, userName, operationId, data, version } = message;

			logger.info(`[WS] Operation from ${userName} in room ${roomId}: ${operationId}`);

			// Save to database
			this.saveOperation(roomId, userId, operationId, data, version).catch(error => {
				logger.error('[WS] Error saving operation:', error);
			});

			// Broadcast to all users except sender
			this.broadcastToRoom(roomId, {
				type: 'operation',
				userId,
				userName,
				operationId,
				data,
				version,
				timestamp: Date.now()
			}, userId);

			// Send acknowledgement to sender
			const user = this.userConnections.get(userId);
			if (user) {
				this.sendMessage(user.ws, {
					type: 'ack',
					operationId,
					timestamp: Date.now()
				});
			}
		} catch (error) {
			logger.error('[WS] Error handling operation:', error);
		}
	}

	/**
	 * Handle cursor update
	 */
	private handleCursorUpdate(message: any): void {
		try {
			const { roomId, userId, userName, line, column } = message;

			logger.debug(`[WS] Cursor update from ${userName}: line ${line}, column ${column}`);

			// Broadcast cursor position to all users except sender
			this.broadcastToRoom(roomId, {
				type: 'cursor',
				userId,
				userName,
				line,
				column,
				timestamp: Date.now()
			}, userId);
		} catch (error) {
			logger.error('[WS] Error handling cursor update:', error);
		}
	}

	/**
	 * Handle presence update
	 */
	private handlePresenceUpdate(message: any): void {
		try {
			const { roomId, userId, userName, isActive } = message;

			logger.info(`[WS] Presence update: ${userName} is ${isActive ? 'online' : 'offline'}`);

			// Update in database
			this.updateUserPresence(roomId, userId, isActive).catch(error => {
				logger.error('[WS] Error updating presence:', error);
			});

			// Broadcast to all users in room
			this.broadcastToRoom(roomId, {
				type: 'presence',
				userId,
				userName,
				isActive,
				lastSeen: Date.now(),
				timestamp: Date.now()
			});
		} catch (error) {
			logger.error('[WS] Error handling presence update:', error);
		}
	}

	/**
	 * Handle sync request
	 */
	private handleSyncRequest(message: any): void {
		try {
			const { roomId, userId } = message;

			logger.info(`[WS] Sync request from user ${userId} in room ${roomId}`);

			// Get full document history
			this.getDocumentHistory(roomId).then(operations => {
				const user = this.userConnections.get(userId);
				if (user) {
					this.sendMessage(user.ws, {
						type: 'sync',
						roomId,
						operations,
						timestamp: Date.now()
					});
				}
			}).catch(error => {
				logger.error('[WS] Error getting document history:', error);
			});
		} catch (error) {
			logger.error('[WS] Error handling sync request:', error);
		}
	}

	/**
	 * Handle ping (heartbeat)
	 */
	private handlePing(ws: WebSocket, message: any): void {
		this.sendMessage(ws, {
			type: 'pong',
			timestamp: Date.now()
		});
	}

	/**
	 * Broadcast message to all users in a room
	 */
	private broadcastToRoom(roomId: string, message: any, excludeUserId?: string): void {
		try {
			const room = this.rooms.get(roomId);
			if (!room) {
				return;
			}

			for (const user of room.users.values()) {
				if (excludeUserId && user.userId === excludeUserId) {
					continue; // Don't send to sender
				}

				if (user.ws.readyState === 1) { // WebSocket.OPEN
					this.sendMessage(user.ws, message);
				}
			}
		} catch (error) {
			logger.error('[WS] Error broadcasting to room:', error);
		}
	}

	/**
	 * Send message to specific WebSocket
	 */
	private sendMessage(ws: WebSocket, message: any): void {
		try {
			if (ws.readyState === 1) { // WebSocket.OPEN
				ws.send(JSON.stringify(message));
			}
		} catch (error) {
			logger.error('[WS] Error sending message:', error);
		}
	}

	/**
	 * Send error message
	 */
	private sendError(ws: WebSocket, error: string): void {
		this.sendMessage(ws, {
			type: 'error',
			error,
			timestamp: Date.now()
		});
	}

	/**
	 * Handle user disconnection
	 */
	private handleDisconnection(ws: WebSocket): void {
		try {
			// Find user associated with this WebSocket
			let disconnectedUser: ConnectedUser | null = null;

			for (const user of this.userConnections.values()) {
				if (user.ws === ws) {
					disconnectedUser = user;
					break;
				}
			}

			if (disconnectedUser) {
				logger.info(`[WS] User ${disconnectedUser.userName} disconnected from room ${disconnectedUser.roomId}`);

				// Remove from room
				const room = this.rooms.get(disconnectedUser.roomId);
				if (room) {
					room.users.delete(disconnectedUser.userId);

					// Notify remaining users
					this.broadcastToRoom(disconnectedUser.roomId, {
						type: 'user_left',
						userId: disconnectedUser.userId,
						userName: disconnectedUser.userName,
						timestamp: Date.now()
					});

					// Clean up empty rooms
					if (room.users.size === 0) {
						this.rooms.delete(disconnectedUser.roomId);
						logger.info(`[WS] Room ${disconnectedUser.roomId} is now empty, cleaning up`);
					}
				}

				// Remove user connection
				this.userConnections.delete(disconnectedUser.userId);
			}
		} catch (error) {
			logger.error('[WS] Error handling disconnection:', error);
		}
	}

	/**
	 * Save operation to database
	 */
	private async saveOperation(roomId: string, userId: string, operationId: string, data: string, version: number): Promise<void> {
		try {
			// Database integration - supabase client unavailable in this scope
			logger.info('[DB] Would save operation:', { operationId, roomId, userId });
		} catch (error) {
			logger.error('[DB] Exception saving operation:', error);
		}
	}

	/**
	 * Update user presence in database
	 */
	private async updateUserPresence(roomId: string, userId: string, isActive: boolean): Promise<void> {
		try {
			// Database integration - supabase client unavailable in this scope
			logger.info('[DB] Would update presence:', { roomId, userId, isActive });
		} catch (error) {
			logger.error('[DB] Exception updating presence:', error);
		}
	}

	/**
	 * Get document operation history
	 */
	private async getDocumentHistory(roomId: string): Promise<any[]> {
		try {
			// Database integration - supabase client unavailable in this scope
			logger.info('[DB] Would fetch operations for room:', roomId);
			return [];
		} catch (error) {
			logger.error('[DB] Exception fetching operations:', error);
			return [];
		}
	}

	/**
	 * Get room status
	 */
	public getRoomStatus(roomId: string): any {
		const room = this.rooms.get(roomId);
		if (!room) {
			return null;
		}

		return {
			roomId,
			userCount: room.users.size,
			users: Array.from(room.users.values()).map(u => ({
				userId: u.userId,
				userName: u.userName,
				connectedAt: u.connectedAt
			})),
			createdAt: room.createdAt,
			uptime: Date.now() - room.createdAt
		};
	}

	/**
	 * Get all active rooms
	 */
	public getActiveRooms(): any[] {
		const rooms = [];

		for (const [roomId, room] of this.rooms.entries()) {
			rooms.push({
				roomId,
				userCount: room.users.size,
				createdAt: room.createdAt,
				uptime: Date.now() - room.createdAt
			});
		}

		return rooms;
	}
}

// Export singleton instance
export const collaborationRouter = new CollaborationWebSocketRouter();
