export interface IOperation {
	type: 'insert' | 'delete';
	position: number;
	content?: string;
	length?: number;
	userId: string;
	timestamp: number;
	version: number;
	sessionId?: string;
}

export interface IRemoteUser {
	userId: string;
	userName: string;
	color: string;
	cursorPosition: number;
	selectionStart?: number;
	selectionEnd?: number;
	isActive: boolean;
	lastSeen: number;
}

export interface IRoom {
	id: string;
	name: string;
	fileId: string;
	host: string;
	content: string;
	operations: IOperation[];
	version: number;
	clients: Map<string, IClient>;
	createdAt: number;
	updatedAt: number;
	isActive: boolean;
}

export interface IClient {
	userId: string;
	userName: string;
	socket: any;
	version: number;
	isAuthenticated: boolean;
	joinedAt: number;
}

export interface ICollaborationSession {
	sessionId: string;
	roomId: string;
	fileId: string;
	roomName: string;
	host: string;
	owner: string;
	createdAt: number;
	version: number;
	isActive: boolean;
	participants: string[];
}

export interface IServerMessage {
	type: string;
	data?: any;
	sessionId?: string;
	userId?: string;
	timestamp?: number;
}

export enum ConnectionStatus {
	CONNECTING = 'connecting',
	CONNECTED = 'connected',
	DISCONNECTED = 'disconnected',
	RECONNECTING = 'reconnecting',
	ERROR = 'error'
}
