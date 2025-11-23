# Octate Backend API Documentation

**Base URL:** `https://octate.qzz.io`
**WebSocket:** `wss://octate.qzz.io/collaborate`

---

## Overview

Octate's cloud backend provides real-time collaboration and synchronization for the octate Editor. The API includes endpoints for authentication, collaboration room management, document operations tracking, and system health monitoring.

**Total Endpoints:** 17
- **GET Endpoints:** 5
- **POST Endpoints:** 6
- **WebSocket Endpoints:** 1
- **Auth Endpoints:** 4
- **Collaboration Endpoints:** 6
- **Info/Migration Endpoints:** 4

---

## Root Endpoint

### `GET /`

Returns comprehensive documentation of all available endpoints.

**Response:** `200 OK`
```json
{
  "name": "Octate Backend",
  "version": "1.0.0",
  "description": "Cloud backend for octate Editor - Real-time Collaboration & Sync",
  "uptime": 5000.123,
  "timestamp": "2025-01-19T10:30:45.000Z",
  "endpoints": { ... },
  "summary": { ... }
}
```

---

## System Endpoints

### `GET /api/health`

Check server and database health status.

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "uptime": 5000.123,
  "database_connected": true,
  "timestamp": "2025-01-19T10:30:45.000Z"
}
```

### `GET /api/stats`

Get server statistics including memory usage and active connections.

**Response:** `200 OK`
```json
{
  "uptime": 5000.123,
  "memory": {
    "heapUsed": 45265920,
    "heapTotal": 2146435072
  },
  "connections": {
    "active_rooms": 5,
    "connected_clients": 12
  },
  "timestamp": "2025-01-19T10:30:45.000Z"
}
```

### `GET /api/config`

Get Supabase configuration and WebSocket endpoint for frontend initialization.

**Response:** `200 OK`
```json
{
  "supabase": {
    "url": "https://fcsmfkwsmlinzxvqlvml.supabase.co",
    "anonKey": "sb_publishable_f5Aubji22o_P4OAhyLUWjQ_8JwAza51"
  },
  "websocket": "wss://octate.qzz.io/collaborate"
}
```

### `POST /api/migrate`

Execute database migrations. Admin only.

**Request Body:**
```json
{
  "sql": "CREATE TABLE IF NOT EXISTS ...",
  "filename": "20251122_create_collaboration_schema.sql"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Migration executed",
  "file": "20251122_create_collaboration_schema.sql"
}
```

---

## Authentication Endpoints

### `POST /api/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "username": "username"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "username": "username"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### `POST /api/auth/login`

Login to existing user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### `GET /api/auth/me`

Get current authenticated user information.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "username": "username",
  "created_at": "2025-01-15T10:30:45.000Z"
}
```

### `POST /api/auth/refresh`

Refresh authentication token.

**Request Body:**
```json
{
  "refresh_token": "refresh_token_xyz"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "new_refresh_token"
}
```

---

## Collaboration Endpoints

### Room Management

#### `GET /api/rooms`

List all active collaboration rooms.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "room_id": "room_abc123",
      "name": "Project Documentation",
      "host": "user_123",
      "file_id": "file_xyz",
      "created_at": "2025-01-19T10:00:00.000Z",
      "is_active": true
    }
  ]
}
```

#### `GET /api/rooms/:roomId`

Get specific room details.

**Parameters:**
- `roomId` (string, required): Room identifier

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "room_id": "room_abc123",
    "name": "Project Documentation",
    "host": "user_123",
    "file_id": "file_xyz",
    "content": "# Project Overview\n...",
    "version": 42,
    "participants": [
      { "user_id": "user_123", "user_name": "Alice", "joined_at": "2025-01-19T10:00:00.000Z" },
      { "user_id": "user_456", "user_name": "Bob", "joined_at": "2025-01-19T10:05:00.000Z" }
    ],
    "created_at": "2025-01-19T10:00:00.000Z",
    "is_active": true
  }
}
```

#### `POST /api/rooms`

Create a new collaboration room.

**Request Body:**
```json
{
  "room_id": "room_abc123",
  "name": "Project Documentation",
  "file_id": "file_xyz",
  "host": "user_123",
  "content": "# Project Overview",
  "version": 1
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "room_id": "room_abc123",
    "name": "Project Documentation",
    "host": "user_123",
    "file_id": "file_xyz",
    "created_at": "2025-01-19T10:00:00.000Z",
    "is_active": true
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields
- `409 Conflict`: Room already exists

#### `POST /api/rooms/:roomId/join`

Add a participant to a collaboration room.

**Parameters:**
- `roomId` (string, required): Room identifier

**Request Body:**
```json
{
  "user_id": "user_456",
  "user_name": "Bob"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "room_id": "room_abc123",
    "user_id": "user_456",
    "user_name": "Bob",
    "joined_at": "2025-01-19T10:05:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields
- `404 Not Found`: Room does not exist

### Operations & Synchronization

#### `POST /api/rooms/:roomId/operations`

Save a document operation for operational transformation (OT) sync.

**Parameters:**
- `roomId` (string, required): Room identifier

**Request Body:**
```json
{
  "operation_id": "op_123",
  "user_id": "user_456",
  "data": {
    "type": "insert",
    "position": 42,
    "content": "new text",
    "timestamp": 1642594200000
  },
  "version": 42
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "operation_id": "op_123",
    "room_id": "room_abc123",
    "user_id": "user_456",
    "data": { ... },
    "version": 42,
    "created_at": "2025-01-19T10:30:45.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields
- `404 Not Found`: Room does not exist

#### `POST /api/rooms/:roomId/leave`

Leave a collaboration room and mark participant as inactive.

**Parameters:**
- `roomId` (string, required): Room identifier

**Request Body:**
```json
{
  "user_id": "user_456"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Successfully left room"
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields
- `404 Not Found`: Participant not found in room

---

## WebSocket Endpoint

### `WS /collaborate`

WebSocket connection for real-time collaboration synchronization.

**Connection URL:** `wss://octate.qzz.io/collaborate`

**Message Format:**
```json
{
  "type": "operation",
  "room_id": "room_abc123",
  "user_id": "user_456",
  "operation": {
    "type": "insert",
    "position": 42,
    "content": "new text"
  }
}
```

**Events:**
- `connection`: Established connection
- `operation`: Receive real-time operation
- `cursor`: Receive cursor position update
- `user_joined`: User joined room
- `user_left`: User left room
- `sync_complete`: Full document sync received

---

## Error Handling

All endpoints follow consistent error response format:

**Error Response Format:**
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "status": 400
}
```

**Common Status Codes:**
- `200 OK`: Successful GET/POST request
- `201 Created`: Successful resource creation
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Permission denied
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource already exists
- `500 Internal Server Error`: Server error

---

## Rate Limiting

- General endpoints: 100 requests per minute per IP
- Auth endpoints: 20 requests per minute per IP
- WebSocket: Unlimited (connection-based)

---

## Authentication

Protected endpoints require Bearer token in Authorization header:

```
Authorization: Bearer <token>
```

Tokens are obtained through:
1. User registration: `/api/auth/register`
2. User login: `/api/auth/login`

---

## Database Schema

### Tables

**collaboration_rooms:**
- `room_id` (text, primary key)
- `name` (text)
- `file_id` (text)
- `host` (text)
- `content` (text)
- `version` (integer)
- `created_at` (timestamp)
- `is_active` (boolean)

**room_participants:**
- `id` (uuid, primary key)
- `room_id` (text, foreign key)
- `user_id` (text)
- `user_name` (text)
- `joined_at` (timestamp)
- `is_active` (boolean)

**operations:**
- `id` (uuid, primary key)
- `operation_id` (text)
- `room_id` (text, foreign key)
- `user_id` (text)
- `data` (jsonb)
- `version` (integer)
- `created_at` (timestamp)

---

## Examples

### Create and Join a Collaboration Room

```bash
# 1. Create room
curl -X POST https://octate.qzz.io/api/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "room_abc123",
    "name": "My Project",
    "file_id": "file_123",
    "host": "user_123"
  }'

# 2. Join room
curl -X POST https://octate.qzz.io/api/rooms/room_abc123/join \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_456",
    "user_name": "Bob"
  }'

# 3. Save operation
curl -X POST https://octate.qzz.io/api/rooms/room_abc123/operations \
  -H "Content-Type: application/json" \
  -d '{
    "operation_id": "op_123",
    "user_id": "user_456",
    "data": {"type": "insert", "position": 0, "content": "Hello"},
    "version": 1
  }'

# 4. Leave room
curl -X POST https://octate.qzz.io/api/rooms/room_abc123/leave \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_456"
  }'
```

---

## Support

For issues or questions about the API, please contact support or check the [Octate GitHub Repository](https://github.com/octate/void).
