import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
// Casino backend server
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/user';
import { gameRoutes } from './routes/game';
import { betRoutes } from './routes/bet';
import { leaderboardRoutes } from './routes/leaderboard';
import { adminRoutes } from './routes/admin';
import bonusRoutes from './routes/bonus';
import creditsRoutes from './routes/credits';
import pokerRoutes from './routes/poker';
import { initializeSocket } from './socket/socketHandler';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Rate limiting - Increased for debugging
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs (increased for debugging)
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Middleware to make io available to routes
app.use((req, res, next) => {
  (req as any).io = io;
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/bet', betRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bonus', bonusRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/poker', pokerRoutes);

// Error handling
app.use(errorHandler);

// Initialize connections
async function startServer() {
  try {
    await connectDatabase();
    await connectRedis();
    
    // Initialize WebSocket handlers
    initializeSocket(io);
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      // Poker system ready
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, io };