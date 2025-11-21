import { Router, Request, Response } from 'express';
import collaborationService from '../services/collaboration.js';
import { WebSocketService } from '../services/websocket.js';
import logger from '../utils/logger.js';

const router = Router();
let wsService: WebSocketService | null = null;

export function setWebSocketService(ws: WebSocketService) {
	wsService = ws;
}

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
	res.status(200).json({
		status: 'ok',
		timestamp: new Date().toISOString(),
		uptime: process.uptime()
	});
});

/**
 * GET /api/stats
 * Get server statistics
 */
router.get('/stats', (req: Request, res: Response) => {
	try {
		const collabStats = collaborationService.getStats();
		const wsStats = wsService?.getStats() || { connectedClients: 0 };

		res.status(200).json({
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			memory: process.memoryUsage(),
			collaboration: collabStats,
			websocket: wsStats
		});
	} catch (error) {
		logger.error('[API] Stats error:', error);
		res.status(500).json({
			error: 'Failed to get stats'
		});
	}
});

/**
 * GET /api/rooms
 * Get all active rooms
 */
router.get('/rooms', (req: Request, res: Response) => {
	try {
		const rooms = collaborationService.getAllRooms();

		const roomsData = rooms.map(room => ({
			id: room.id,
			name: room.name,
			fileId: room.fileId,
			host: room.host,
			clientsCount: room.clients.size,
			contentLength: room.content.length,
			version: room.version,
			createdAt: room.createdAt,
			updatedAt: room.updatedAt
		}));

		res.status(200).json({
			count: roomsData.length,
			rooms: roomsData
		});
	} catch (error) {
		logger.error('[API] Get rooms error:', error);
		res.status(500).json({
			error: 'Failed to get rooms'
		});
	}
});

/**
 * GET /api/rooms/:roomId
 * Get specific room info
 */
router.get('/rooms/:roomId', (req: Request, res: Response): void => {
	try {
		const { roomId } = req.params;
		const room = collaborationService.getRoom(roomId);

		if (!room) {
			res.status(404).json({
				error: 'Room not found'
			});
			return;
		}

		res.status(200).json({
			id: room.id,
			name: room.name,
			fileId: room.fileId,
			host: room.host,
			clients: Array.from(room.clients.values()).map(client => ({
				userId: client.userId,
				userName: client.userName,
				joinedAt: client.joinedAt
			})),
			contentLength: room.content.length,
			version: room.version,
			operationsCount: room.operations.length,
			createdAt: room.createdAt,
			updatedAt: room.updatedAt
		});
	} catch (error) {
		logger.error('[API] Get room error:', error);
		res.status(500).json({
			error: 'Failed to get room'
		});
	}
});

export default router;
