import { Router, Request, Response } from 'express';
import { generateToken, generateUserId, IUser } from '../utils/auth.js';
import logger from '../utils/logger.js';

const router = Router();

// In-memory user store (replace with database in production)
const users = new Map<string, IUser>();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
	try {
		const { email, userName } = req.body;

		if (!email || !userName) {
			res.status(400).json({
				error: 'Missing required fields: email, userName'
			});
			return;
		}

		// Check if user exists
		const existingUser = Array.from(users.values()).find(u => u.email === email);
		if (existingUser) {
			res.status(409).json({
				error: 'User already exists'
			});
			return;
		}

		// Create new user
		const userId = generateUserId();
		const user: IUser = {
			userId,
			email,
			userName
		};

		users.set(userId, user);

		// Generate token
		const token = generateToken(user);

		logger.info(`[Auth] User registered: ${userId}`);

		res.status(201).json({
			userId,
			email,
			userName,
			token
		});
	} catch (error) {
		logger.error('[Auth] Registration error:', error);
		res.status(500).json({
			error: 'Registration failed'
		});
	}
});

/**
 * POST /api/auth/login
 * Login user (simplified - no password in this example)
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
	try {
		const { email, userName } = req.body;

		if (!email) {
			res.status(400).json({
				error: 'Missing required field: email'
			});
			return;
		}

		// Check if user exists
		let user = Array.from(users.values()).find(u => u.email === email);

		if (!user) {
			// Create new user if doesn't exist (guest login)
			const userId = generateUserId();
			user = {
				userId,
				email,
				userName: userName || email.split('@')[0]
			};
			users.set(userId, user);
			logger.info(`[Auth] New user created via login: ${userId}`);
		}

		// Generate token
		const token = generateToken(user);

		logger.info(`[Auth] User logged in: ${user.userId}`);

		res.status(200).json({
			userId: user.userId,
			email: user.email,
			userName: user.userName,
			token
		});
	} catch (error) {
		logger.error('[Auth] Login error:', error);
		res.status(500).json({
			error: 'Login failed'
		});
	}
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', (req: Request, res: Response): void => {
	try {
		const auth = (req as any).auth;

		if (!auth) {
			res.status(401).json({
				error: 'Not authenticated'
			});
			return;
		}

		const user = users.get(auth.userId);

		if (!user) {
			res.status(404).json({
				error: 'User not found'
			});
			return;
		}

		res.status(200).json({
			userId: user.userId,
			email: user.email,
			userName: user.userName
		});
	} catch (error) {
		logger.error('[Auth] Get user error:', error);
		res.status(500).json({
			error: 'Failed to get user'
		});
	}
});

/**
 * POST /api/auth/refresh
 * Refresh authentication token
 */
router.post('/refresh', (req: Request, res: Response): void => {
	try {
		const auth = (req as any).auth;

		if (!auth) {
			res.status(401).json({
				error: 'Not authenticated'
			});
			return;
		}

		const user = users.get(auth.userId);

		if (!user) {
			res.status(404).json({
				error: 'User not found'
			});
			return;
		}

		// Generate new token
		const token = generateToken(user);

		res.status(200).json({
			token
		});
	} catch (error) {
		logger.error('[Auth] Token refresh error:', error);
		res.status(500).json({
			error: 'Failed to refresh token'
		});
	}
});

export default router;
