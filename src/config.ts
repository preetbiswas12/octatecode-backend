import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
	// Server
	port: parseInt(process.env.PORT || '3000', 10),
	wsPort: parseInt(process.env.WS_PORT || '3001', 10),
	host: process.env.HOST || '0.0.0.0',
	nodeEnv: process.env.NODE_ENV || 'development',
	appName: process.env.APP_NAME || 'octateBackend',
	appVersion: process.env.APP_VERSION || '1.0.0',
	apiDomain: process.env.API_DOMAIN || 'http://localhost:3000',
	frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

	// JWT
	jwt: {
		secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
		expiresIn: process.env.JWT_EXPIRATION || '24h'
	},

	// Supabase Configuration
	supabase: {
		url: process.env.SUPABASE_URL || 'https://your-project.supabase.co',
		anonKey: process.env.SUPABASE_ANON_KEY || '',
		serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
	},

	// Database
	database: {
		url: process.env.DATABASE_URL || 'postgresql://octate_user:octate_password@localhost:5432/octate_db',
		pool: {
			min: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
			max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10)
		}
	},

	// Redis
	redis: {
		url: process.env.REDIS_URL || 'redis://localhost:6379',
		db: parseInt(process.env.REDIS_DB || '0', 10),
		enabled: process.env.REDIS_URL ? true : false
	},

	// CORS
	cors: {
		origins: (process.env.CORS_ORIGINS || 'http://localhost:*').split(','),
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization']
	},

	// Logging
	logging: {
		level: process.env.LOG_LEVEL || 'info'
	}
};

export default config;
