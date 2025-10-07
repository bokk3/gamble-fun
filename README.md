# 🎰 Gamble Fun Casino

A modern, web-based casino featuring interactive gambling games built with React, Node.js, and MySQL.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/gamble-fun.git
   cd gamble-fun
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred values
   ```

3. **Start the development environment**
   ```bash
   npm run dev
   ```

   This will start:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - MySQL: localhost:3306
   - Redis: localhost:6379

4. **Access the application**
   - Open http://localhost:3000 in your browser
   - Register a new account or use the default admin account

## 🎮 Games Available

- **🎰 Slots** - Classic slot machine with multiple paylines
- **🎲 Dice** - Bet on dice roll outcomes with customizable odds
- **💥 Crash** - Multiplier game where you cash out before the crash
- **🃏 Blackjack** - Classic 21 card game against the dealer
- **🎡 Roulette** - European roulette with full betting options

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript
- **Styling**: TailwindCSS with custom casino theme
- **State Management**: Zustand + React Query
- **Real-time**: Socket.IO client
- **Routing**: React Router v6
- **UI Components**: Custom casino-themed components

### Backend (Node.js + TypeScript)
- **Framework**: Express.js with TypeScript
- **Database**: MySQL with connection pooling
- **Caching**: Redis for session management
- **Authentication**: JWT tokens
- **Real-time**: Socket.IO server
- **Security**: Helmet, CORS, rate limiting
- **Game Logic**: Provably fair algorithms

### Database Schema
- **users** - User accounts and balances
- **games** - Game configurations and settings
- **bets** - Individual bet records with provably fair data
- **transactions** - Balance change history
- **game_sessions** - Active gaming sessions

## 🛡️ Security Features

- **Provably Fair Gaming**: All games use cryptographic hashing
- **JWT Authentication**: Secure token-based auth
- **Input Validation**: Joi schema validation
- **SQL Injection Protection**: Parameterized queries
- **Rate Limiting**: Prevents abuse and spam
- **HTTPS**: SSL/TLS encryption in production

## 🚀 Production Deployment

### Option 1: Docker Compose (Recommended)

1. **Set up production environment**
   ```bash
   cp .env.example .env
   # Configure production values in .env
   ```

2. **Deploy with Docker Compose**
   ```bash
   npm run build
   npm start
   ```

### Option 2: Cloud Deployment

The application is designed to work with:
- **AWS ECS/Fargate**: Container-based deployment
- **Google Cloud Run**: Serverless containers
- **DigitalOcean App Platform**: Simple PaaS deployment
- **Heroku**: With Docker buildpacks

## 🧪 Development Commands

```bash
# Start development environment
npm run dev

# Stop and clean up
npm run dev:down

# Run tests
npm run test

# Lint code
npm run lint

# Build for production
npm run build
```

## 🎯 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `GET /api/user/balance` - Get current balance

### Gaming
- `GET /api/games` - List available games
- `POST /api/bets/place` - Place a bet
- `GET /api/bets/history` - Bet history
- `GET /api/leaderboard` - Top players

### WebSocket Events
- `game:join` - Join a game room
- `game:bet` - Place a real-time bet
- `game:result` - Receive game results
- `balance:update` - Balance change notifications

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | `mysql` |
| `DB_USER` | MySQL username | `casino_user` |
| `DB_PASSWORD` | MySQL password | Required |
| `JWT_SECRET` | JWT signing key | Required |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` |

### Game Configuration

Games can be configured in the database `games` table:
- Minimum/maximum bet amounts
- House edge percentages
- Game-specific parameters

## 📊 Monitoring & Logging

- **Application Logs**: Structured JSON logging
- **Database Monitoring**: MySQL performance metrics  
- **Real-time Analytics**: Socket.IO connection stats
- **Error Tracking**: Centralized error handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This is a demonstration application for educational purposes. Please ensure compliance with local gambling laws and regulations before deploying in production.