import express, { Express } from 'express';
import { createServer } from 'http';
import config from './config.js';
import logger from './utils/logger.js';
import { WebSocketService } from './services/websocket.js';
import { authMiddleware, requireAuth } from './middleware/auth.js';
import { corsMiddleware, requestLogger, securityHeaders } from './middleware/common.js';
import authRoutes from './routes/auth.js';
import apiRoutes, { setWebSocketService } from './routes/api.js';

// Create Express app
const app: Express = express();

// Create HTTP server
const httpServer = createServer(app);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(corsMiddleware);
app.use(requestLogger);
app.use(securityHeaders);
app.use(authMiddleware);

// Routes
app.get('/', (req: express.Request, res: express.Response) => {
	res.json({
		name: config.appName,
		version: config.appVersion,
		description: 'Cloud backend for octate Editor - Real-time Collaboration & Sync',
		uptime: process.uptime(),
		timestamp: new Date().toISOString(),
		endpoints: {
			info: {
				health: { method: 'GET', path: '/api/health', description: 'Health check and database connection status' },
				stats: { method: 'GET', path: '/api/stats', description: 'Server statistics (uptime, memory, connected clients)' },
				config: { method: 'GET', path: '/api/config', description: 'Get Supabase config and WebSocket endpoint' }
			},
			auth: {
				register: { method: 'POST', path: '/api/auth/register', description: 'Register new user' },
				login: { method: 'POST', path: '/api/auth/login', description: 'Login user' },
				me: { method: 'GET', path: '/api/auth/me', description: 'Get current user info' },
				refresh: { method: 'POST', path: '/api/auth/refresh', description: 'Refresh authentication token' }
			},
			collaboration: {
				rooms_list: { method: 'GET', path: '/api/rooms', description: 'Get all active collaboration rooms' },
				room_get: { method: 'GET', path: '/api/rooms/:roomId', description: 'Get specific room information' },
				room_create: { method: 'POST', path: '/api/rooms', description: 'Create new collaboration room', body: '{room_id, name, file_id, host, content?, version?}' },
				room_join: { method: 'POST', path: '/api/rooms/:roomId/join', description: 'Add participant to room', body: '{user_id, user_name}' },
				room_operations: { method: 'POST', path: '/api/rooms/:roomId/operations', description: 'Save document operation (for OT sync)', body: '{operation_id, user_id, data, version}' },
				room_leave: { method: 'POST', path: '/api/rooms/:roomId/leave', description: 'Leave room and mark participant as inactive', body: '{user_id}' }
			},
			migration: {
				migrate: { method: 'POST', path: '/api/migrate', description: 'Execute database migration', body: '{sql, filename?}' }
			},
			websocket: {
				collaborate: { method: 'WS', path: '/collaborate', description: 'WebSocket endpoint for real-time collaboration' }
			}
		},
		summary: {
			total_endpoints: 17,
			get_endpoints: 5,
			post_endpoints: 6,
			websocket_endpoints: 1,
			auth_endpoints: 4,
			collaboration_endpoints: 6,
			info_endpoints: 3,
			migration_endpoints: 1
		}
	});
});

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// 404 handler
app.use((req: express.Request, res: express.Response) => {
	res.status(404).json({
		error: 'Not found',
		path: req.path,
		method: req.method
	});
});

// Initialize WebSocket service
const wsService = new WebSocketService(httpServer);
setWebSocketService(wsService);

// Start server
httpServer.listen(config.port, config.host, () => {
	logger.info(`═════════════════════════════════════════════════════════════`);
	logger.info(`🚀 Void Backend Server Started`);
	logger.info(`═════════════════════════════════════════════════════════════`);
	logger.info(`📍 API Server: http://${config.host}:${config.port}`);
	logger.info(`🔌 WebSocket: ws://${config.host}:${config.wsPort}`);
	logger.info(`🌍 Environment: ${config.nodeEnv}`);
	logger.info(`═════════════════════════════════════════════════════════════`);
	logger.info('Available endpoints:');
	logger.info('  GET  /                          - Server info');
	logger.info('  POST /api/auth/register         - Register user');
	logger.info('  POST /api/auth/login            - Login user');
	logger.info('  GET  /api/auth/me               - Get current user');
	logger.info('  POST /api/auth/refresh          - Refresh token');
	logger.info('  GET  /api/health                - Health check');
	logger.info('  GET  /api/stats                 - Server statistics');
	logger.info('  GET  /api/rooms                 - List all rooms');
	logger.info('  GET  /api/rooms/:roomId         - Get room info');
	logger.info('  WS   /collaborate               - WebSocket endpoint');
	logger.info(`═════════════════════════════════════════════════════════════`);
});

// Graceful shutdown
process.on('SIGINT', () => {
	logger.info('\n[Server] Shutting down gracefully...');

	httpServer.close(() => {
		logger.info('[Server] HTTP server closed');
		process.exit(0);
	});

	// Force shutdown after 10 seconds
	setTimeout(() => {
		logger.error('[Server] Forced shutdown');
		process.exit(1);
	}, 10000);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
	logger.error('[Process] Uncaught exception:', error);
	process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
	logger.error('[Process] Unhandled rejection:', reason);
});

export default app;
