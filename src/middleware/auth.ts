import { Request, Response, NextFunction } from 'express';
import { authenticateFromHeader } from '../utils/auth.js';
import logger from '../utils/logger.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
	try {
		const authHeader = req.headers.authorization;
		const auth = authenticateFromHeader(authHeader);

		if (!auth) {
			// For some endpoints, auth is optional
			(req as any).auth = null;
			next();
			return;
		}

		(req as any).auth = auth;
		next();
	} catch (error) {
		logger.error('[Middleware] Auth error:', error);
		res.status(500).json({
			error: 'Authentication middleware error'
		});
	}
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
	const auth = (req as any).auth;

	if (!auth) {
		res.status(401).json({
			error: 'Unauthorized. Missing or invalid authentication token.'
		});
		return;
	}

	next();
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
	logger.error('[ErrorHandler] Unhandled error:', err);

	res.status(err.status || 500).json({
		error: err.message || 'Internal server error',
		timestamp: new Date().toISOString()
	});
}
