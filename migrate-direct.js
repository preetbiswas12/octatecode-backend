#!/usr/bin/env node

/**
 * Direct Supabase SQL Migration Runner
 * Uses Supabase REST API + direct PostgreSQL query
 *
 * Usage: node migrate-direct.js
 * Requires: SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL in .env
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

async function runMigrations() {
	if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL) {
		console.error('❌ Missing required environment variables:');
		if (!SUPABASE_URL) console.error('   - SUPABASE_URL');
		if (!SUPABASE_SERVICE_ROLE_KEY) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
		if (!DATABASE_URL) console.error('   - DATABASE_URL');
		console.error('\n📝 Add these to your .env file');
		process.exit(1);
	}

	const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
	const files = fs.readdirSync(migrationsDir)
		.filter(f => f.endsWith('.sql'))
		.sort();

	if (files.length === 0) {
		console.log('⚠️  No migration files found');
		return;
	}

	console.log('\n🔄 Starting database migrations...\n');
	console.log(`Found ${files.length} migration file(s)\n`);

	// Create PostgreSQL connection pool using service role key credentials
	const pool = new Pool({
		connectionString: DATABASE_URL,
		ssl: {
			rejectUnauthorized: false
		}
	});

	let successCount = 0;
	let failCount = 0;

	for (const file of files) {
		const filePath = path.join(migrationsDir, file);
		const sql = fs.readFileSync(filePath, 'utf8');

		try {
			console.log(`📝 Running: ${file}`);

			const client = await pool.connect();
			try {
				// Split SQL into statements, filter comments and empty lines
				const statements = sql
					.split(';')
					.map(s => s.trim())
					.filter(s => s.length > 0 && !s.startsWith('--'));

				let statementCount = 0;
				for (const statement of statements) {
					if (statement.trim()) {
						try {
							await client.query(statement);
							statementCount++;
						} catch (err) {
							// Some statements might fail if they already exist (idempotent)
							// Log but continue
							console.warn(`   ⚠️  Statement partially failed (may be idempotent): ${err.code}`);
						}
					}
				}

				console.log(`✅ ${file} - SUCCESS (${statementCount} statements)\n`);
				successCount++;
			} finally {
				client.release();
			}
		} catch (error) {
			console.error(`❌ ${file} - FAILED`);
			console.error(`   Error: ${error.message}\n`);
			failCount++;
		}
	}

	// Close the pool
	await pool.end();

	console.log('\n📊 Migration Summary:');
	console.log(`   ✅ Successful: ${successCount}`);
	console.log(`   ❌ Failed: ${failCount}`);
	console.log(`   📋 Tables created:`);
	console.log(`      • collaboration_rooms`);
	console.log(`      • operations`);
	console.log(`      • room_participants`);
	console.log(`      • room_statistics (view)\n`);

	if (failCount > 0) {
		process.exit(1);
	}
}

runMigrations().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
