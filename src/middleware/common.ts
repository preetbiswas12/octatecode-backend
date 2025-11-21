import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
	const origin = req.headers.origin;
	const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:*').split(',');

	// Check if origin is allowed
	const isAllowed = allowedOrigins.some(allowed => {
		if (allowed === '*') return true;
		if (allowed.includes('*')) {
			// Handle wildcard matching
			const pattern = allowed.replace(/\./g, '\\.').replace(/\*/g, '.*');
			return new RegExp(`^${pattern}$`).test(origin || '');
		}
		return allowed === origin;
	});

	if (isAllowed) {
		res.setHeader('Access-Control-Allow-Origin', origin || '*');
	}

	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	res.setHeader('Access-Control-Allow-Credentials', 'true');

	if (req.method === 'OPTIONS') {
		res.sendStatus(200);
		return;
	}

	next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
	const start = Date.now();

	res.on('finish', () => {
		const duration = Date.now() - start;
		logger.info(`[HTTP] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
	});

	next();
}

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('X-Frame-Options', 'DENY');
	res.setHeader('X-XSS-Protection', '1; mode=block');
	res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

	next();
}
