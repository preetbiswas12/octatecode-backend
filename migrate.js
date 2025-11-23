#!/usr/bin/env node

/**
 * Supabase Migration Runner
 * Runs SQL migrations against Supabase database
 *
 * Usage: node migrate.js
 * Requires: DATABASE_URL environment variable or .env file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error('❌ ERROR: DATABASE_URL environment variable is not set');
	console.error('   Add DATABASE_URL to .env file or set it in environment');
	process.exit(1);
}

const pool = new Pool({
	connectionString: DATABASE_URL,
	ssl: {
		rejectUnauthorized: false // Required for Supabase
	}
});

async function runMigrations() {
	const client = await pool.connect();
	const migrationsDir = path.join(__dirname, 'supabase', 'migrations');

	try {
		console.log('\n🔄 Starting database migrations...\n');

		// Get all SQL migration files sorted by name (includes timestamp)
		const files = fs.readdirSync(migrationsDir)
			.filter(f => f.endsWith('.sql'))
			.sort();

		if (files.length === 0) {
			console.log('⚠️  No migration files found in supabase/migrations/');
			return;
		}

		console.log(`Found ${files.length} migration file(s):\n`);

		for (const file of files) {
			const filePath = path.join(migrationsDir, file);
			const sql = fs.readFileSync(filePath, 'utf8');

			try {
				console.log(`📝 Running: ${file}`);
				await client.query(sql);
				console.log(`✅ ${file} - SUCCESS\n`);
			} catch (error) {
				console.error(`❌ ${file} - FAILED`);
				console.error(`   Error: ${error.message}\n`);
				throw error;
			}
		}

		console.log('\n✨ All migrations completed successfully!');
		console.log('📊 Tables created:');
		console.log('   ✓ collaboration_rooms');
		console.log('   ✓ operations');
		console.log('   ✓ room_participants');
		console.log('   ✓ room_statistics (view)');

	} catch (error) {
		console.error('\n❌ Migration failed!');
		console.error('   Error:', error.message);
		process.exit(1);
	} finally {
		await client.end();
		await pool.end();
	}
}

// Run migrations
runMigrations().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
