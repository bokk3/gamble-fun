import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import PokerGameManager from './pokerHandler';
import AIPlayerManager from '../services/aiPlayerManager';

let pokerManager: PokerGameManager;

export const initializeSocket = (io: Server) => {
  // Initialize poker game manager
  pokerManager = new PokerGameManager(io);
  
  // Initialize AI Player Manager
  AIPlayerManager.initialize(io);

  // Authentication middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.data.user.username} connected`);

    // Join user to their personal room for balance updates
    socket.join(`user_${socket.data.user.id}`);

    // Handle game room joining
    socket.on('game:join', (gameType) => {
      socket.join(`game_${gameType}`);
      console.log(`User ${socket.data.user.username} joined game ${gameType}`);
    });

    // Handle game room leaving
    socket.on('game:leave', (gameType) => {
      socket.leave(`game_${gameType}`);
      console.log(`User ${socket.data.user.username} left game ${gameType}`);
    });

    // Handle real-time bet notifications
    socket.on('bet:placed', (betData) => {
      // Broadcast to all users in the same game room
      socket.to(`game_${betData.gameType}`).emit('bet:notification', {
        username: socket.data.user.username,
        betAmount: betData.betAmount,
        isWin: betData.isWin,
        winAmount: betData.winAmount
      });
    });

        // Poker-specific events
    socket.on('poker:join_table', (data) => PokerGameManager.handleJoinTable(socket, data));
    socket.on('poker:leave_table', (data) => pokerManager.leaveTable(socket, data));
    socket.on('poker:action', (data) => pokerManager.handlePlayerAction(socket, data));
    socket.on('poker:start_hand', (data) => pokerManager.startNewHand(data.tableId));
    
    // Heartbeat to keep connection alive and update player activity
    socket.on('heartbeat', (data) => PokerGameManager.handleHeartbeat(socket, data));

    socket.on('disconnect', () => {
      console.log(`User ${socket.data.user.username} disconnected`);
      pokerManager.handleDisconnect(socket);
    });
  });

  // Helper function to send balance updates (can be called from other modules)
  (io as any).sendBalanceUpdate = (userId: number, newBalance: number) => {
    io.to(`user_${userId}`).emit('balance:update', { balance: newBalance });
  };
};

export const getPokerManager = () => pokerManager;