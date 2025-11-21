import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { v4 as uuidv4 } from 'uuid';

export interface IAuthPayload {
	userId: string;
	email: string;
	userName: string;
	iat: number;
	exp: number;
}

export interface IUser {
	userId: string;
	email: string;
	userName: string;
	passwordHash?: string;
}

export function generateToken(user: IUser): string {
	const payload: Partial<IAuthPayload> = {
		userId: user.userId,
		email: user.email,
		userName: user.userName
	};

	const options: SignOptions = {
		expiresIn: (config.jwt.expiresIn as any),
		algorithm: 'HS256' as const
	};

	return jwt.sign(payload, config.jwt.secret, options);
}

export function verifyToken(token: string): IAuthPayload | null {
	try {
		return jwt.verify(token, config.jwt.secret) as IAuthPayload;
	} catch (error) {
		return null;
	}
}

export function authenticateFromHeader(authHeader: string | undefined): IAuthPayload | null {
	if (!authHeader) {
		return null;
	}

	// Extract token from "Bearer <token>"
	const parts = authHeader.split(' ');
	if (parts.length !== 2 || parts[0] !== 'Bearer') {
		return null;
	}

	return verifyToken(parts[1]);
}

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

export function generateUserId(): string {
	return `user-${uuidv4()}`;
}

export function generateRoomId(): string {
	return `room-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function generateSessionId(): string {
	return uuidv4();
}
