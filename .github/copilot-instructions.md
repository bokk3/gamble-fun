# Copilot Instructions for Gamble Fun Casino

## Project Architecture Overview

This is a **production-ready casino web application** with interactive gambling games. The system is built for scalability, security, and deployment with the following key components:

### Tech Stack
- **Frontend**: React 18 + TypeScript, TailwindCSS, Socket.IO client, React Query
- **Backend**: Node.js + Express + TypeScript, MySQL, Redis, Socket.IO server
- **Development**: Docker Compose orchestration with hot-reload
- **Security**: JWT auth, provably fair algorithms, input validation, rate limiting
- **Deployment**: Multi-stage Docker builds, Nginx reverse proxy, environment-based config

### Key File Structure
```
├── frontend/src/
│   ├── contexts/     # AuthContext, SocketContext for global state
│   ├── pages/        # Route components (Login, Dashboard, games/)
│   ├── components/   # Reusable UI components
│   └── services/     # API calls and WebSocket handlers
├── backend/src/
│   ├── routes/       # Express route handlers (auth, user, game, bet)
│   ├── services/     # Business logic (gameEngine.ts for provably fair)
│   ├── config/       # Database and Redis connections
│   └── middleware/   # Authentication, error handling, validation
├── database/init/    # MySQL schema and seed data
└── docker-compose.yml # Development orchestration
```

## Critical Development Patterns

### 1. Provably Fair Gaming System
All games use cryptographic fairness in `backend/src/services/gameEngine.ts`:
```typescript
// Server generates seed, client provides seed, nonce ensures uniqueness
const hash = generateHash(serverSeed, clientSeed, nonce);
const result = hashToFloat(hash); // Deterministic random from hash
```
**Always**: Store `server_seed`, `client_seed`, `nonce`, and `result_hash` in bets table for verification.

### 2. Database Transactions for Money Operations
```typescript
// Use executeTransaction() for atomic balance changes
const queries = [
  { query: 'UPDATE users SET balance = balance - ? WHERE id = ?', params: [betAmount, userId] },
  { query: 'INSERT INTO bets (...) VALUES (...)', params: [...] }
];
await executeTransaction(queries);
```

### 3. Real-time Game Updates
WebSocket events follow this pattern:
- `game:join` - User joins game room  
- `game:bet` - Place bet with validation
- `game:result` - Broadcast results to room
- `balance:update` - Notify balance changes

### 4. Authentication Flow
- JWT tokens in `Authorization: Bearer <token>` header
- `authenticateToken` middleware protects routes
- Context in `frontend/src/contexts/AuthContext.tsx` manages auth state
- Balance updates sync between frontend context and backend

## Docker & Environment Setup

### Development Commands (from project root):
```bash
npm run dev          # Starts all services with hot-reload
npm run dev:down     # Stops and cleans containers
```

### Environment Variables (.env file required):
- `JWT_SECRET` - Must be 32+ characters for production
- `DB_PASSWORD` - MySQL user password  
- `MYSQL_ROOT_PASSWORD` - MySQL root password
- Frontend URLs set via `REACT_APP_API_URL` and `REACT_APP_WS_URL`

### Service Dependencies:
1. **MySQL** starts first with persistent volume and init scripts
2. **Redis** for session caching and real-time data
3. **Backend** connects to both DB services
4. **Frontend** proxies API calls to backend

## Security Implementation Checklist

- ✅ **SQL Injection**: Use parameterized queries in `executeQuery(query, params)`
- ✅ **Input Validation**: Joi schemas in routes (see `auth.ts` register/login)
- ✅ **Rate Limiting**: Express rate limit middleware (100 req/15min)
- ✅ **CORS**: Configured for frontend origin only
- ✅ **Headers**: Helmet.js security headers
- ✅ **Password Hashing**: bcrypt with salt rounds = 10
- ✅ **Game Fairness**: Cryptographic hash verification for all outcomes

## Common Development Tasks

### Adding a New Game:
1. Add game logic to `gameEngine.ts` (following provably fair pattern)
2. Create database entry in `games` table
3. Add route in `backend/src/routes/game.ts`
4. Create frontend component in `frontend/src/pages/games/`
5. Add route to `App.tsx` and navigation

### API Response Format:
```typescript
// Success response
{ success: true, message: "Operation completed", data: {...} }
// Error response  
{ success: false, message: "Error description" }
```

### Database Schema Notes:
- Use `DECIMAL(18,2)` for all money amounts
- Foreign keys with `ON DELETE CASCADE` for user data
- Indexes on frequently queried columns (`user_id`, `created_at`)
- JSON column for game-specific data storage

## Production Deployment

### Build Process:
```bash
npm run build    # Uses docker-compose.prod.yml
npm start        # Starts production containers
```

### Production Differences:
- Multi-stage Docker builds for optimized images
- Nginx serves static files and proxies API
- Environment variables from secrets/vault
- SSL termination at load balancer level
- Database connection pooling and backup strategies

## Troubleshooting Guide

**Database Connection Issues**: Check `DB_HOST=mysql` (service name in Docker)
**WebSocket Not Connecting**: Verify `REACT_APP_WS_URL` matches backend URL
**Balance Not Updating**: Check JWT token validity and `authenticateToken` middleware
**Game Results Not Fair**: Verify `server_seed` is generated securely and `nonce` increments

---

*This casino platform prioritizes security, fairness, and scalability. Always validate server-side, use transactions for money operations, and maintain cryptographic game integrity.*