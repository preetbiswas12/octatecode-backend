import { createClient } from '@supabase/supabase-js';
import config from '../config.js';
import logger from '../utils/logger.js';

/**
 * Supabase Client Service
 * Manages connection to Supabase PostgreSQL database
 */

let supabaseClient: any = null;

export function initializeSupabase() {
	if (!config.supabase.url || !config.supabase.serviceRoleKey) {
		logger.warn('[Supabase] Missing configuration, skipping initialization');
		return null;
	}

	try {
		supabaseClient = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
			auth: {
				persistSession: false,
				autoRefreshToken: false
			}
		});

		logger.info('[Supabase] Client initialized successfully');
		return supabaseClient;
	} catch (error) {
		logger.error('[Supabase] Failed to initialize client:', error);
		return null;
	}
}

export function getSupabaseClient() {
	if (!supabaseClient) {
		return initializeSupabase();
	}
	return supabaseClient;
}

/**
 * Database operations
 */

export async function createCollaborationRoom(
	roomId: string,
	name: string,
	fileId: string,
	host: string,
	initialContent: string
) {
	const client = getSupabaseClient();
	if (!client) {
		throw new Error('Supabase client not initialized');
	}

	const { data, error } = await client
		.from('collaboration_rooms')
		.insert({
			room_id: roomId,
			name,
			file_id: fileId,
			host,
			content: initialContent,
			version: 0,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		})
		.select();

	if (error) {
		logger.error('[Supabase] Failed to create room:', error);
		throw error;
	}

	return data?.[0];
}

export async function getCollaborationRoom(roomId: string) {
	const client = getSupabaseClient();
	if (!client) {
		throw new Error('Supabase client not initialized');
	}

	const { data, error } = await client
		.from('collaboration_rooms')
		.select()
		.eq('room_id', roomId)
		.single();

	if (error && error.code !== 'PGRST116') {
		logger.error('[Supabase] Failed to fetch room:', error);
		throw error;
	}

	return data;
}

export async function updateCollaborationRoom(
	roomId: string,
	updates: Record<string, any>
) {
	const client = getSupabaseClient();
	if (!client) {
		throw new Error('Supabase client not initialized');
	}

	const { data, error } = await client
		.from('collaboration_rooms')
		.update({
			...updates,
			updated_at: new Date().toISOString()
		})
		.eq('room_id', roomId)
		.select();

	if (error) {
		logger.error('[Supabase] Failed to update room:', error);
		throw error;
	}

	return data?.[0];
}

export async function deleteCollaborationRoom(roomId: string) {
	const client = getSupabaseClient();
	if (!client) {
		throw new Error('Supabase client not initialized');
	}

	const { error } = await client
		.from('collaboration_rooms')
		.delete()
		.eq('room_id', roomId);

	if (error) {
		logger.error('[Supabase] Failed to delete room:', error);
		throw error;
	}
}

export async function getAllCollaborationRooms() {
	const client = getSupabaseClient();
	if (!client) {
		throw new Error('Supabase client not initialized');
	}

	const { data, error } = await client
		.from('collaboration_rooms')
		.select()
		.order('created_at', { ascending: false });

	if (error) {
		logger.error('[Supabase] Failed to fetch rooms:', error);
		throw error;
	}

	return data || [];
}

/**
 * Save operation to database
 */
export async function saveOperation(
	roomId: string,
	operationId: string,
	userId: string,
	operation: Record<string, any>
) {
	const client = getSupabaseClient();
	if (!client) {
		throw new Error('Supabase client not initialized');
	}

	const { data, error } = await client
		.from('operations')
		.insert({
			room_id: roomId,
			operation_id: operationId,
			user_id: userId,
			data: operation,
			created_at: new Date().toISOString()
		})
		.select();

	if (error) {
		logger.error('[Supabase] Failed to save operation:', error);
		throw error;
	}

	return data?.[0];
}

/**
 * Get operations for a room
 */
export async function getOperations(roomId: string, fromVersion: number = 0) {
	const client = getSupabaseClient();
	if (!client) {
		throw new Error('Supabase client not initialized');
	}

	const { data, error } = await client
		.from('operations')
		.select()
		.eq('room_id', roomId)
		.gte('data->>version', fromVersion)
		.order('created_at', { ascending: true });

	if (error) {
		logger.error('[Supabase] Failed to fetch operations:', error);
		throw error;
	}

	return data || [];
}

/**
 * Save room participant
 */
export async function addParticipant(
	roomId: string,
	userId: string,
	userName: string,
	joinedAt: Date
) {
	const client = getSupabaseClient();
	if (!client) {
		throw new Error('Supabase client not initialized');
	}

	const { data, error } = await client
		.from('room_participants')
		.insert({
			room_id: roomId,
			user_id: userId,
			user_name: userName,
			joined_at: joinedAt.toISOString(),
			active: true
		})
		.select();

	if (error) {
		logger.error('[Supabase] Failed to add participant:', error);
		throw error;
	}

	return data?.[0];
}

/**
 * Remove room participant
 */
export async function removeParticipant(roomId: string, userId: string) {
	const client = getSupabaseClient();
	if (!client) {
		throw new Error('Supabase client not initialized');
	}

	const { error } = await client
		.from('room_participants')
		.delete()
		.eq('room_id', roomId)
		.eq('user_id', userId);

	if (error) {
		logger.error('[Supabase] Failed to remove participant:', error);
		throw error;
	}
}

/**
 * Get active participants
 */
export async function getActiveParticipants(roomId: string) {
	const client = getSupabaseClient();
	if (!client) {
		throw new Error('Supabase client not initialized');
	}

	const { data, error } = await client
		.from('room_participants')
		.select()
		.eq('room_id', roomId)
		.eq('active', true);

	if (error) {
		logger.error('[Supabase] Failed to fetch participants:', error);
		throw error;
	}

	return data || [];
}

export default {
	initializeSupabase,
	getSupabaseClient,
	createCollaborationRoom,
	getCollaborationRoom,
	updateCollaborationRoom,
	deleteCollaborationRoom,
	getAllCollaborationRooms,
	saveOperation,
	getOperations,
	addParticipant,
	removeParticipant,
	getActiveParticipants
};
