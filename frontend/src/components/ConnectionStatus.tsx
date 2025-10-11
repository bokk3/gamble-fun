import React from 'react';
import { useSocket } from '../contexts/SocketContext';

const ConnectionStatus: React.FC = () => {
  const { isConnected, reconnectAttempts } = useSocket();

  if (isConnected) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-green-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Connected</span>
        </div>
      </div>
    );
  }

  if (reconnectAttempts > 0) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-yellow-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <div className="w-2 h-2 bg-white rounded-full animate-spin"></div>
          <span className="text-sm font-medium">
            Reconnecting... (attempt {reconnectAttempts})
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-red-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2">
        <div className="w-2 h-2 bg-white rounded-full"></div>
        <span className="text-sm font-medium">Disconnected</span>
      </div>
    </div>
  );
};

export default ConnectionStatus;