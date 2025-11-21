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
		description: 'Cloud backend for octate Editor',
		endpoints: {
			health: '/api/health',
			stats: '/api/stats',
			auth: {
				register: 'POST /api/auth/register',
				login: 'POST /api/auth/login',
				me: 'GET /api/auth/me',
				refresh: 'POST /api/auth/refresh'
			},
			collaboration: {
				rooms: 'GET /api/rooms',
				roomInfo: 'GET /api/rooms/:roomId'
			},
			websocket: 'wss://your-domain/collaborate'
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
