import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  reconnectAttempts: number;
  joinPokerTable: (tableId: number) => void;
  leavePokerTable: (tableId: number) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  reconnectAttempts: 0,
  joinPokerTable: () => {},
  leavePokerTable: () => {},
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      const newSocket = io(process.env.REACT_APP_WS_URL || 'http://localhost:5000', {
        auth: {
          token,
        },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
      });

      newSocket.on('connect', () => {
        console.log('✅ Connected to server');
        setIsConnected(true);
        setReconnectAttempts(0);
        
        // Try to rejoin poker table if we were in one
        const savedTableId = localStorage.getItem('current_poker_table');
        if (savedTableId) {
          console.log('🔄 Attempting to rejoin poker table:', savedTableId);
          newSocket.emit('poker:join_table', { tableId: parseInt(savedTableId) });
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from server:', reason);
        setIsConnected(false);
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Reconnected after', attemptNumber, 'attempts');
        setReconnectAttempts(0);
      });

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log('🔄 Reconnection attempt', attemptNumber);
        setReconnectAttempts(attemptNumber);
      });

      newSocket.on('reconnect_failed', () => {
        console.log('❌ Reconnection failed after maximum attempts');
      });

      // Poker event listeners
      newSocket.on('hand_started', (data) => {
        console.log('🎰 Hand started:', data);
      });

      newSocket.on('betting_round_advanced', (data) => {
        console.log('🎲 Betting round advanced:', data);
      });

      newSocket.on('player_action', (data) => {
        console.log('🎯 Player action:', data);
      });

      newSocket.on('game_state_update', (data) => {
        console.log('🔄 Game state update:', data);
      });

      newSocket.on('hand_ended', (data) => {
        console.log('🏁 Hand ended:', data);
      });

      newSocket.on('poker_rejoined', (data) => {
        console.log('🔄 Rejoined poker table:', data);
      });

      // Heartbeat system - send ping every 30 seconds
      const heartbeat = setInterval(() => {
        if (newSocket.connected) {
          newSocket.emit('heartbeat', { timestamp: Date.now() });
        }
      }, 30000);

      setSocket(newSocket);

      return () => {
        clearInterval(heartbeat);
        newSocket.close();
      };
    } else {
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [token]);

  const joinPokerTable = (tableId: number) => {
    if (socket) {
      socket.emit('poker:join_table', { tableId });
      localStorage.setItem('current_poker_table', tableId.toString());
      console.log(`🎰 Joined poker table ${tableId}`);
    }
  };

  const leavePokerTable = (tableId: number) => {
    if (socket) {
      socket.emit('poker:leave_table', { tableId });
      localStorage.removeItem('current_poker_table');
      console.log(`🚪 Left poker table ${tableId}`);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, reconnectAttempts, joinPokerTable, leavePokerTable }}>
      {children}
    </SocketContext.Provider>
  );
};