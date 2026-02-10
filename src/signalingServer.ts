/**
 * Signaling Server
 * WebSocket server for WebRTC signaling and peer introduction
 */

import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';
import { roomManager } from './roomManager.js';
import {
	SignalingMessage,
	SignalingMessageType,
	ISignalingServer,
	RemoteOperation,
} from './p2pTypes.js';

interface ClientInfo {
	userId: string;
	roomId: string;
	socket: WebSocket;
	connectedAt: number;
}

class SignalingServer extends EventEmitter implements ISignalingServer {
	private wss: WebSocketServer | null = null;
	private clients = new Map<WebSocket, ClientInfo>();
	private heartbeatInterval: NodeJS.Timeout | null = null;
	private readonly HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds

	public async start(port: number): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.wss = new WebSocketServer({ port });

				this.wss.on('connection', (socket) => {
					this.handleConnection(socket);
				});

				this.wss.on('listening', () => {
					console.log(`[SignalingServer] Started on port ${port}`);
					this.startHeartbeat();
					resolve();
				});

				this.wss.on('error', (error) => {
					console.error('[SignalingServer] Error:', error);
					reject(error);
				});
			} catch (error) {
				reject(error);
			}
		});
	}

	public async stop(): Promise<void> {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}

		if (this.wss) {
			return new Promise((resolve) => {
				this.wss!.close(() => {
					console.log('[SignalingServer] Stopped');
					this.clients.clear();
					resolve();
				});
			});
		}
	}

	private handleConnection(socket: WebSocket): void {
		socket.on('message', (data) => {
			try {
				const message = JSON.parse(data.toString()) as SignalingMessage;
				// Get current client info from the socket
				const clientInfo = this.clients.get(socket) || null;
				this.routeMessage(socket, message, clientInfo);
			} catch (error) {
				console.error('[SignalingServer] Message parse error:', error);
				this.sendError(socket, 'Invalid message format');
			}
		});

		socket.on('close', () => {
			const clientInfo = this.clients.get(socket);
			if (clientInfo) {
				this.handleClientDisconnect(clientInfo);
			}
			this.clients.delete(socket);
		});

		socket.on('error', (error) => {
			console.error('[SignalingServer] WebSocket error:', error);
		});

		socket.on('pong', () => {
			// Heartbeat response
		});
	}

	private routeMessage(
		socket: WebSocket,
		message: SignalingMessage,
		clientInfo: ClientInfo | null
	): void {
		switch (message.type) {
			case SignalingMessageType.AUTH:
				this.handleAuth(socket, message);
				break;

			case SignalingMessageType.CREATE_ROOM:
				if (!clientInfo)
					return this.sendError(socket, 'Not authenticated');
				this.handleCreateRoom(socket, message);
				break;

			case SignalingMessageType.JOIN_ROOM:
				if (!clientInfo)
					return this.sendError(socket, 'Not authenticated');
				this.handleJoinRoom(socket, message);
				break;

			case SignalingMessageType.LEAVE_ROOM:
				if (!clientInfo)
					return this.sendError(socket, 'Not authenticated');
				this.handleLeaveRoom(socket, message);
				break;

			case SignalingMessageType.SDP_OFFER:
				if (!clientInfo)
					return this.sendError(socket, 'Not authenticated');
				this.handleSDPOffer(
					message.roomId,
					message.userId,
					message.data as any
				);
				break;

			case SignalingMessageType.SDP_ANSWER:
				if (!clientInfo)
					return this.sendError(socket, 'Not authenticated');
				this.handleSDPAnswer(
					message.roomId,
					message.userId,
					message.data as any
				);
				break;

			case SignalingMessageType.ICE_CANDIDATE:
				if (!clientInfo)
					return this.sendError(socket, 'Not authenticated');
				this.handleICECandidate(
					message.roomId,
					message.userId,
					message.data as any
				);
				break;

			case SignalingMessageType.OPERATION:
				if (!clientInfo)
					return this.sendError(socket, 'Not authenticated');
				this.handleOperation(socket, message);
				break;

			case SignalingMessageType.HEARTBEAT:
				if (!clientInfo)
					return this.sendError(socket, 'Not authenticated');
				this.handleHeartbeat(socket, clientInfo);
				break;

			default:
				console.warn('[SignalingServer] Unknown message type:', message.type);
		}
	}

	private handleAuth(socket: WebSocket, message: SignalingMessage): void {
		const { userId, roomId } = message;

		if (!userId || !roomId) {
			return this.sendError(socket, 'Missing userId or roomId');
		}

		const clientInfo: ClientInfo = {
			userId,
			roomId,
			socket,
			connectedAt: Date.now(),
		};

		this.clients.set(socket, clientInfo);
		this.send(socket, {
			type: SignalingMessageType.AUTH,
			roomId,
			userId,
			data: { status: 'authenticated' },
			timestamp: Date.now(),
		});

		this.emit('clientConnected', { userId, roomId });
	}

	private handleCreateRoom(
		socket: WebSocket,
		message: SignalingMessage
	): void {
		const { roomId, userId, data } = message;

		const room = roomManager.createRoom(
			roomId,
			data?.roomName as string,
			userId,
			data?.userName as string,
			data?.fileId as string,
			data?.content as string,
			data?.version as number
		);

		if (room) {
			this.send(socket, {
				type: SignalingMessageType.ROOM_CREATED,
				roomId,
				userId,
				data: { room },
				timestamp: Date.now(),
			});
		} else {
			this.sendError(socket, 'Failed to create room');
		}
	}

	private handleJoinRoom(
		socket: WebSocket,
		message: SignalingMessage
	): void {
		const { roomId, userId, data } = message;

		const room = roomManager.joinRoom(
			roomId,
			userId,
			data?.userName as string
		);

		if (room) {
			this.send(socket, {
				type: SignalingMessageType.ROOM_JOINED,
				roomId,
				userId,
				data: { room },
				timestamp: Date.now(),
			});

			// Introduce existing peers to new peer
			const peers = roomManager.getPeerList(roomId);
			const otherPeers = peers.filter((p) => p.userId !== userId);

			if (otherPeers.length > 0) {
				this.broadcastToRoom(roomId, {
					type: SignalingMessageType.PEER_JOINED,
					roomId,
					userId,
					data: { peer: { userId, userName: data?.userName } },
					timestamp: Date.now(),
				});
			}
		} else {
			this.sendError(socket, 'Room not found or join failed');
		}
	}

	private handleLeaveRoom(
		socket: WebSocket,
		message: SignalingMessage
	): void {
		const { roomId, userId } = message;

		roomManager.leaveRoom(roomId, userId);

		this.broadcastToRoom(roomId, {
			type: SignalingMessageType.PEER_LEFT,
			roomId,
			userId,
			timestamp: Date.now(),
		});

		this.emit('clientDisconnected', { userId, roomId });
	}

	public handleSDPOffer(
		roomId: string,
		userId: string,
		offer: any
	): void {
		const room = roomManager.getRoomMetadata(roomId);
		if (!room) return;

		this.broadcastToRoom(roomId, {
			type: SignalingMessageType.SDP_OFFER,
			roomId,
			userId,
			data: { offer },
			timestamp: Date.now(),
		});
	}

	public handleSDPAnswer(
		roomId: string,
		userId: string,
		answer: any
	): void {
		this.broadcastToRoom(roomId, {
			type: SignalingMessageType.SDP_ANSWER,
			roomId,
			userId,
			data: { answer },
			timestamp: Date.now(),
		});
	}

	public handleICECandidate(
		roomId: string,
		userId: string,
		candidate: any
	): void {
		this.broadcastToRoom(roomId, {
			type: SignalingMessageType.ICE_CANDIDATE,
			roomId,
			userId,
			data: { candidate },
			timestamp: Date.now(),
		});
	}

	private handleOperation(
		socket: WebSocket,
		message: SignalingMessage
	): void {
		const { roomId, userId, data } = message;

		const operation = data as unknown as RemoteOperation;
		roomManager.recordOperation(roomId, operation);

		this.broadcastToRoom(
			roomId,
			{
				type: SignalingMessageType.OPERATION,
				roomId,
				userId,
				data: { operation },
				timestamp: Date.now(),
			},
			userId
		);
	}

	private handleHeartbeat(
		socket: WebSocket,
		clientInfo: ClientInfo
	): void {
		const { roomId, userId } = clientInfo;
		roomManager.updatePeerHeartbeat(roomId, userId);

		this.send(socket, {
			type: SignalingMessageType.HEARTBEAT,
			roomId,
			userId,
			timestamp: Date.now(),
		});
	}

	private handleClientDisconnect(clientInfo: ClientInfo): void {
		const { roomId, userId } = clientInfo;
		roomManager.leaveRoom(roomId, userId);

		this.broadcastToRoom(roomId, {
			type: SignalingMessageType.PEER_LEFT,
			roomId,
			userId,
			timestamp: Date.now(),
		});

		this.emit('clientDisconnected', { userId, roomId });
	}

	public broadcastOperation(roomId: string, operation: RemoteOperation): void {
		this.broadcastToRoom(roomId, {
			type: SignalingMessageType.OPERATION,
			roomId,
			userId: operation.userId,
			data: { operation },
			timestamp: Date.now(),
		});
	}

	private broadcastToRoom(
		roomId: string,
		message: SignalingMessage,
		exceptUserId?: string
	): void {
		for (const [socket, clientInfo] of this.clients) {
			if (clientInfo.roomId === roomId) {
				if (exceptUserId && clientInfo.userId === exceptUserId) {
					continue;
				}
				this.send(socket, message);
			}
		}
	}

	private forwardToUser(
		roomId: string,
		targetUserId: string,
		message: SignalingMessage
	): void {
		for (const [socket, clientInfo] of this.clients) {
			if (
				clientInfo.roomId === roomId &&
				clientInfo.userId === targetUserId
			) {
				this.send(socket, message);
				return;
			}
		}
	}

	private send(socket: WebSocket, message: SignalingMessage): void {
		if (socket.readyState === WebSocket.OPEN) {
			socket.send(JSON.stringify(message));
		}
	}

	private sendError(socket: WebSocket, error: string): void {
		if (socket.readyState === WebSocket.OPEN) {
			socket.send(
				JSON.stringify({
					type: SignalingMessageType.ERROR,
					roomId: '',
					userId: '',
					data: { error },
					timestamp: Date.now(),
				})
			);
		}
	}

	private startHeartbeat(): void {
		this.heartbeatInterval = setInterval(() => {
			for (const [socket] of this.clients) {
				if (socket.readyState === WebSocket.OPEN) {
					socket.ping();
				}
			}
		}, this.HEARTBEAT_INTERVAL);
	}

	public getConnectionStats(): Record<string, unknown> {
		return {
			connectedClients: this.clients.size,
			totalConnections: Array.from(this.clients.values()).reduce(
				(sum, client) => sum + 1,
				0
			),
			roomConnections: Array.from(this.clients.values()).reduce(
				(acc, client) => {
					acc[client.roomId] = (acc[client.roomId] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>
			),
		};
	}
}

export const signalingServer = new SignalingServer();
