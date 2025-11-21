# octate Backend - README

Cloud backend service for octate Editor - providing real-time collaboration, authentication, and WebSocket communication.

## Features

✅ **Real-Time Collaboration**
- WebSocket-based communication
- Multi-user editing with operational transform
- Presence tracking (cursor positions)

✅ **Authentication**
- JWT-based token system
- User registration and login
- Token refresh

✅ **REST API**
- Health checks
- Statistics and metrics
- Room management
- User management

✅ **Production Ready**
- Docker support
- Environment configuration
- Error handling
- Logging system

## Directory Structure

```
octate-backend/
├── src/
│   ├── index.ts                 # Main server entry point
│   ├── config.ts                # Configuration management
│   ├── models/
│   │   └── types.ts             # TypeScript interfaces
│   ├── services/
│   │   ├── collaboration.ts     # Collaboration logic
│   │   └── websocket.ts         # WebSocket server
│   ├── routes/
│   │   ├── auth.ts              # Authentication endpoints
│   │   └── api.ts               # API endpoints
│   ├── middleware/
│   │   ├── auth.ts              # Authentication middleware
│   │   └── common.ts            # CORS, logging, security
│   └── utils/
│       ├── auth.ts              # Auth utilities
│       └── logger.ts            # Logging utilities
├── dist/                        # Compiled JavaScript
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── DEPLOYMENT.md                # Deployment guide
└── README.md                    # This file
```

## Quick Start

### Local Setup

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Build
npm run build

# Start
npm start
```

### Docker

```bash
# Build image
docker build -t octate-backend .

# Run with compose
docker-compose up -d

# View logs
docker-compose logs -f
```

## Configuration

Edit `.env` file:

```bash
# Server
NODE_ENV=production
PORT=3000
WS_PORT=3001
HOST=0.0.0.0

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=24h

# CORS
CORS_ORIGINS=https://your-domain.com

# Logging
LOG_LEVEL=info
```

## API Usage

### Authentication

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "userName": "username"
  }'

# Response
{
  "userId": "user-xxx",
  "email": "user@example.com",
  "userName": "username",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}

# Use token in subsequent requests
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/auth/me
```

### WebSocket Connection

```javascript
// Connect
const ws = new WebSocket('ws://localhost:3001/collaborate');

// Authenticate
ws.send(JSON.stringify({
  type: 'auth',
  data: { token: 'YOUR_JWT_TOKEN' }
}));

// Create room
ws.send(JSON.stringify({
  type: 'create-room',
  data: {
    roomName: 'My Project',
    fileId: 'file-123',
    userName: 'Alice'
  }
}));

// Send operation
ws.send(JSON.stringify({
  type: 'operation',
  data: {
    type: 'insert',
    position: 0,
    content: 'hello',
    userId: 'user-123',
    timestamp: Date.now()
  }
}));
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- AWS EC2 deployment
- Docker deployment
- Heroku deployment
- Nginx reverse proxy setup
- SSL/TLS configuration

Quick deploy to AWS:

```bash
chmod +x deploy.sh
./deploy.sh 54.123.45.67 production
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | development | Environment (development/production) |
| PORT | 3000 | HTTP server port |
| WS_PORT | 3001 | WebSocket port |
| HOST | 0.0.0.0 | Listen address |
| JWT_SECRET | dev-key | JWT signing secret |
| JWT_EXPIRATION | 24h | Token expiration time |
| DATABASE_URL | localhost | PostgreSQL connection string |
| REDIS_URL | localhost | Redis connection string |
| CORS_ORIGINS | localhost:* | Allowed CORS origins |
| LOG_LEVEL | info | Logging level |

## API Endpoints

### Health & Stats
- `GET /api/health` - Health check
- `GET /api/stats` - Server statistics

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh token

### Rooms
- `GET /api/rooms` - List all rooms
- `GET /api/rooms/:roomId` - Get room details

## WebSocket Events

### Client → Server
- `auth` - Authenticate connection
- `create-room` - Create new collaboration room
- `join-room` - Join existing room
- `operation` - Send edit operation
- `presence` - Update cursor position
- `ping` - Keep-alive signal

### Server → Client
- `welcome` - Initial connection message
- `auth-success` - Authentication succeeded
- `room-created` - Room successfully created
- `sync` - Initial sync data
- `ack` - Operation acknowledged
- `operation` - Receive other user's operation
- `presence` - Receive other user's presence
- `user-joined` - User joined room
- `user-left` - User left room
- `error` - Error message

## Performance

- Handles 1000+ concurrent connections
- Supports 100+ simultaneous rooms
- WebSocket latency: < 100ms
- Operation processing: < 10ms

## Security

- JWT token-based authentication
- CORS configuration
- Security headers (HSTS, X-Frame-Options, etc.)
- Input validation
- SQL injection protection (when DB added)

## Monitoring

```bash
# View logs
docker-compose logs -f octate-backend

# Check health
curl http://localhost:3000/api/health

# Get stats
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/stats
```

## Development

```bash
# Watch mode
npm run watch

# Lint
npm run lint

# Format
npm run format

# Build
npm run build
```

## Troubleshooting

**Port already in use:**
```bash
PORT=3001 npm start
```

**High memory usage:**
```bash
NODE_OPTIONS=--max-old-space-size=2048 npm start
```

**WebSocket connection refused:**
- Check firewall rules
- Verify WebSocket port is open
- Check CORS configuration

## License

MIT

## Support

- 📚 [Full Documentation](./DEPLOYMENT.md)
- 🐛 [Report Issues](https://github.com/octateeditor/octate-backend/issues)
- 💬 [Discord Community](https://discord.gg/octate)
- 📧 [Email](hello@octateeditor.com)

---

**octate Backend** - Making collaborative code editing accessible to everyone.
