import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import collaborationService from '../services/collaboration.js';
import { WebSocketService } from '../services/websocket.js';
import { getSupabaseClient } from '../services/supabase.js';
import config from '../config.js';
import logger from '../utils/logger.js';

const router = Router();
let wsService: WebSocketService | null = null;

export function setWebSocketService(ws: WebSocketService) {
	wsService = ws;
}

/**
 * Check database connection status
 */
async function checkDatabaseConnection(): Promise<boolean> {
	try {
		const client = getSupabaseClient();
		if (!client) {
			return false;
		}

		// Attempt a simple query to verify connection
		const { error } = await client
			.from('collaboration_rooms')
			.select('count')
			.limit(1);

		return !error;
	} catch (error) {
		logger.error('[Health] Database connection check failed:', error);
		return false;
	}
}

/**
 * GET /api/config
 * Get client configuration (Supabase credentials and WebSocket endpoint)
 */
router.get('/config', (req: Request, res: Response) => {
	try {
		res.status(200).json({
			supabaseUrl: config.supabase.url,
			supabaseAnonKey: config.supabase.anonKey,
			wsEndpoint: `wss://${config.apiDomain.replace(/^https?:\/\//, '')}/collaborate`
		});
	} catch (error) {
		logger.error('[API] Config error:', error);
		res.status(500).json({
			error: 'Failed to get config'
		});
	}
});

/**
 * POST /api/migrate
 * Execute database migration (SQL file)
 * Body: { sql: string, filename?: string }
 */
router.post('/migrate', async (req: Request, res: Response) => {
	try {
		const { sql, filename } = req.body;

		if (!sql || typeof sql !== 'string') {
			res.status(400).json({
				error: 'Missing or invalid SQL content'
			});
			return;
		}

		logger.info(`[Migration] Executing migration: ${filename || 'unknown'}`);

		// Create a direct PostgreSQL connection using service role key for DDL operations
		const pool = new Pool({
			connectionString: config.database.url,
			ssl: {
				rejectUnauthorized: false
			}
		});

		try {
			const client = await pool.connect();
			try {
				// Split SQL into individual statements and execute them
				const statements = sql
					.split(';')
					.map(s => s.trim())
					.filter(s => s.length > 0 && !s.startsWith('--'));

				for (const statement of statements) {
					if (statement.trim()) {
						await client.query(statement);
					}
				}

				logger.info(`[Migration] Successfully executed: ${filename || 'unknown'}`);
				res.status(200).json({
					success: true,
					message: `Migration executed: ${filename || 'unknown'}`,
					statementsExecuted: statements.length,
					timestamp: new Date().toISOString()
				});
			} finally {
				client.release();
			}
		} finally {
			await pool.end();
		}

	} catch (error) {
		logger.error('[API] Migration error:', error);
		res.status(500).json({
			error: 'Migration execution failed',
			message: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
	try {
		const dbConnected = await checkDatabaseConnection();

		res.status(200).json({
			status: 'ok',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			database: dbConnected ? 'connected' : 'disconnected'
		});
	} catch (error) {
		logger.error('[Health] Health check error:', error);
		res.status(500).json({
			status: 'error',
			timestamp: new Date().toISOString(),
			database: 'disconnected'
		});
	}
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

/**
 * POST /api/rooms
 * Create a new collaboration room
 * Body: { room_id, name, file_id, host, content?, version? }
 */
router.post('/rooms', async (req: Request, res: Response) => {
	try {
		const { room_id, name, file_id, host, content, version } = req.body;

		// Validate required fields
		if (!room_id || !name || !file_id || !host) {
			res.status(400).json({
				error: 'Missing required fields: room_id, name, file_id, host'
			});
			return;
		}

		const client = getSupabaseClient();
		if (!client) {
			res.status(500).json({
				error: 'Database client not available'
			});
			return;
		}

		logger.info(`[API] Creating room: ${room_id}`);

		// Insert room into Supabase
		const { data, error } = await client
			.from('collaboration_rooms')
			.insert([
				{
					room_id,
					name,
					file_id,
					host,
					content: content || '',
					version: version || 0,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				}
			])
			.select();

		if (error) {
			logger.error('[API] Room creation error:', error);
			res.status(500).json({
				error: 'Failed to create room',
				details: error.message
			});
			return;
		}

		logger.info(`[API] Room created successfully: ${room_id}`);
		res.status(201).json({
			success: true,
			data: data?.[0] || { room_id, name, file_id, host, version: version || 0 }
		});

	} catch (error) {
		logger.error('[API] Room creation exception:', error);
		res.status(500).json({
			error: 'Server error creating room',
			message: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

/**
 * POST /api/rooms/:roomId/join
 * Add participant to a room
 * Body: { user_id, user_name }
 */
router.post('/rooms/:roomId/join', async (req: Request, res: Response) => {
	try {
		const { roomId } = req.params;
		const { user_id, user_name } = req.body;

		if (!user_id || !user_name) {
			res.status(400).json({
				error: 'Missing required fields: user_id, user_name'
			});
			return;
		}

		const client = getSupabaseClient();
		if (!client) {
			res.status(500).json({
				error: 'Database client not available'
			});
			return;
		}

		logger.info(`[API] User ${user_name} (${user_id}) joining room: ${roomId}`);

		// Check if room exists
		const { data: roomData, error: roomError } = await client
			.from('collaboration_rooms')
			.select('room_id')
			.eq('room_id', roomId)
			.single();

		if (roomError || !roomData) {
			res.status(404).json({
				error: 'Room not found'
			});
			return;
		}

		// Add participant to room
		const { data, error } = await client
			.from('room_participants')
			.insert([
				{
					room_id: roomId,
					user_id,
					user_name,
					joined_at: new Date().toISOString(),
					active: true
				}
			])
			.select();

		if (error) {
			logger.error('[API] Failed to add participant:', error);
			res.status(500).json({
				error: 'Failed to join room',
				details: error.message
			});
			return;
		}

		logger.info(`[API] Participant added to room: ${roomId}`);
		res.status(200).json({
			success: true,
			data: data?.[0]
		});

	} catch (error) {
		logger.error('[API] Join room exception:', error);
		res.status(500).json({
			error: 'Server error joining room',
			message: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

/**
 * POST /api/rooms/:roomId/operations
 * Save an operation (for operational transformation)
 * Body: { operation_id, user_id, data, version }
 */
router.post('/rooms/:roomId/operations', async (req: Request, res: Response) => {
	try {
		const { roomId } = req.params;
		const { operation_id, user_id, data, version } = req.body;

		if (!operation_id || !user_id) {
			res.status(400).json({
				error: 'Missing required fields: operation_id, user_id'
			});
			return;
		}

		const client = getSupabaseClient();
		if (!client) {
			res.status(500).json({
				error: 'Database client not available'
			});
			return;
		}

		logger.info(`[API] Saving operation for room: ${roomId}`);

		// Insert operation
		const { data: opData, error } = await client
			.from('operations')
			.insert([
				{
					room_id: roomId,
					operation_id,
					user_id,
					data: data || {},
					version: version || 0,
					created_at: new Date().toISOString()
				}
			])
			.select();

		if (error) {
			logger.error('[API] Failed to save operation:', error);
			res.status(500).json({
				error: 'Failed to save operation',
				details: error.message
			});
			return;
		}

		logger.info(`[API] Operation saved for room: ${roomId}`);
		res.status(201).json({
			success: true,
			data: opData?.[0]
		});

	} catch (error) {
		logger.error('[API] Save operation exception:', error);
		res.status(500).json({
			error: 'Server error saving operation',
			message: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

/**
 * POST /api/rooms/:roomId/leave
 * Mark participant as inactive
 * Body: { user_id }
 */
router.post('/rooms/:roomId/leave', async (req: Request, res: Response) => {
	try {
		const { roomId } = req.params;
		const { user_id } = req.body;

		if (!user_id) {
			res.status(400).json({
				error: 'Missing required field: user_id'
			});
			return;
		}

		const client = getSupabaseClient();
		if (!client) {
			res.status(500).json({
				error: 'Database client not available'
			});
			return;
		}

		logger.info(`[API] User ${user_id} leaving room: ${roomId}`);

		// Mark participant as inactive
		const { error } = await client
			.from('room_participants')
			.update({ active: false })
			.eq('room_id', roomId)
			.eq('user_id', user_id);

		if (error) {
			logger.error('[API] Failed to mark as inactive:', error);
			res.status(500).json({
				error: 'Failed to leave room',
				details: error.message
			});
			return;
		}

		logger.info(`[API] User left room: ${roomId}`);
		res.status(200).json({
			success: true,
			message: 'Successfully left room'
		});

	} catch (error) {
		logger.error('[API] Leave room exception:', error);
		res.status(500).json({
			error: 'Server error leaving room',
			message: error instanceof Error ? error.message : 'Unknown error'
		});
	}
});

export default router;
