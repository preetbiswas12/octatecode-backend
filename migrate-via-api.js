#!/usr/bin/env node

/**
 * Supabase Migration Runner via Backend API
 * Uses the backend API to execute migrations
 *
 * Usage: node migrate-via-api.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend API endpoint
const BACKEND_URL = 'https://octate.qzz.io';
const MIGRATION_ENDPOINT = `${BACKEND_URL}/api/migrate`;

async function runMigrations() {
	try {
		console.log('\n🔄 Starting database migrations...\n');

		// Get all SQL migration files sorted by name (includes timestamp)
		const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
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

				const response = await axios.post(MIGRATION_ENDPOINT, {
					sql: sql,
					filename: file
				}, {
					timeout: 30000,
					headers: {
						'Content-Type': 'application/json'
					}
				});

				if (response.status === 200 || response.status === 201) {
					console.log(`✅ ${file} - SUCCESS\n`);
				} else {
					console.error(`⚠️  ${file} - Unexpected status ${response.status}`);
					console.error(`   Response:`, response.data);
				}
			} catch (error) {
				if (error.response?.status === 409) {
					console.log(`✓ ${file} - Already applied (idempotent)\n`);
				} else {
					console.error(`❌ ${file} - FAILED`);
					console.error(`   Error: ${error.message}\n`);
					throw error;
				}
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
	}
}

// Run migrations
runMigrations().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
