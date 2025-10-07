import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

export const initializeSocket = (io: Server) => {
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

    socket.on('disconnect', () => {
      console.log(`User ${socket.data.user.username} disconnected`);
    });
  });

  // Helper function to send balance updates (can be called from other modules)
  (io as any).sendBalanceUpdate = (userId: number, newBalance: number) => {
    io.to(`user_${userId}`).emit('balance:update', { balance: newBalance });
  };
};