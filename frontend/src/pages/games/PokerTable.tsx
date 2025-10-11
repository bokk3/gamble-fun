import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';

interface Player {
  user_id: number;
  name: string;
  chips: number;
  current_bet: number;
  last_action: string | null;
  seat_position: number;
  is_active: boolean;
  hole_cards?: any[];
  timeLeft?: number;
}

interface GameState {
  game_id: number;
  betting_round: string;
  pot: number;
  current_player_position: number;
  community_cards: any[];
  players: Player[];
}

interface PokerTableProps {
  tableId?: number;
}

const PokerTable: React.FC<PokerTableProps> = ({ tableId: propTableId }) => {
  const { tableId: routeTableId } = useParams<{ tableId: string }>();
  const tableId = propTableId || parseInt(routeTableId || '1');
  const { socket, joinPokerTable, leavePokerTable } = useSocket();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionTimer, setActionTimer] = useState<number>(0);
  const [currentPlayerTimer, setCurrentPlayerTimer] = useState<NodeJS.Timeout | null>(null);

  // Join table on mount
  useEffect(() => {
    joinPokerTable(tableId);
    fetchGameState();
    
    return () => {
      leavePokerTable(tableId);
      if (currentPlayerTimer) {
        clearInterval(currentPlayerTimer);
      }
    };
  }, [tableId]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('hand_started', handleHandStarted);
    socket.on('betting_round_advanced', handleBettingRoundAdvanced);
    socket.on('player_action', handlePlayerAction);
    socket.on('game_state_update', handleGameStateUpdate);
    socket.on('hand_ended', handleHandEnded);

    return () => {
      socket.off('hand_started', handleHandStarted);
      socket.off('betting_round_advanced', handleBettingRoundAdvanced);
      socket.off('player_action', handlePlayerAction);
      socket.off('game_state_update', handleGameStateUpdate);
      socket.off('hand_ended', handleHandEnded);
    };
  }, [socket]);

  // Timer management
  useEffect(() => {
    if (gameState && gameState.current_player_position >= 0) {
      startPlayerTimer();
    }
    
    return () => {
      if (currentPlayerTimer) {
        clearInterval(currentPlayerTimer);
      }
    };
  }, [gameState?.current_player_position]);

  const fetchGameState = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/poker/game-state/${tableId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGameState(data.data);
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
    } finally {
      setLoading(false);
    }
  };

  const startPlayerTimer = () => {
    if (currentPlayerTimer) {
      clearInterval(currentPlayerTimer);
    }
    
    setActionTimer(30); // 30 second timer
    
    const timer = setInterval(() => {
      setActionTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    setCurrentPlayerTimer(timer);
  };

  const handleHandStarted = useCallback((data: any) => {
    console.log('🎰 Hand started:', data);
    setGameState(prev => prev ? { ...prev, ...data } : null);
    fetchGameState(); // Refresh full state
  }, []);

  const handleBettingRoundAdvanced = useCallback((data: any) => {
    console.log('🎲 Round advanced to:', data.round);
    setGameState(prev => prev ? { 
      ...prev, 
      betting_round: data.round,
      community_cards: data.communityCards,
      pot: data.pot 
    } : null);
  }, []);

  const handlePlayerAction = useCallback((data: any) => {
    console.log('🎯 Player action:', data);
    setGameState(prev => {
      if (!prev) return null;
      
      const updatedPlayers = prev.players.map(player => 
        player.user_id === data.playerId 
          ? { ...player, last_action: data.action, current_bet: data.betAmount || player.current_bet }
          : player
      );
      
      return { ...prev, players: updatedPlayers, pot: data.newPot || prev.pot };
    });
  }, []);

  const handleGameStateUpdate = useCallback((data: any) => {
    console.log('🔄 Game state update:', data);
    setGameState(prev => prev ? { ...prev, ...data } : null);
  }, []);

  const handleHandEnded = useCallback((data: any) => {
    console.log('🏁 Hand ended:', data);
    if (currentPlayerTimer) {
      clearInterval(currentPlayerTimer);
    }
    setActionTimer(0);
    
    // Show winner message
    setTimeout(() => {
      fetchGameState(); // Refresh for new hand
    }, 3000);
  }, [currentPlayerTimer]);

  const getCurrentPlayer = (): Player | null => {
    if (!gameState) return null;
    return gameState.players.find(p => p.seat_position === gameState.current_player_position) || null;
  };

  const getCardDisplay = (card: any): string => {
    if (!card) return '🂠';
    return card.display || `${card.rank}${card.suit}`;
  };

  const getActionColor = (action: string | null): string => {
    switch (action) {
      case 'fold': return 'text-red-500';
      case 'call': return 'text-blue-500';
      case 'raise': return 'text-green-500';
      case 'bet': return 'text-green-500';
      case 'check': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const getSeatPosition = (position: number): { top: string; left: string } => {
    // 8-seat circular table positioning
    const positions = [
      { top: '85%', left: '50%' }, // 0 - bottom
      { top: '70%', left: '20%' }, // 1 - bottom left
      { top: '45%', left: '10%' }, // 2 - left
      { top: '20%', left: '20%' }, // 3 - top left
      { top: '5%', left: '50%' },  // 4 - top
      { top: '20%', left: '80%' }, // 5 - top right
      { top: '45%', left: '90%' }, // 6 - right
      { top: '70%', left: '80%' }, // 7 - bottom right
    ];
    
    return positions[position] || { top: '50%', left: '50%' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-green-900">
        <div className="text-white text-xl">Loading poker table...</div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-green-900">
        <div className="text-white text-xl">No active game at this table</div>
      </div>
    );
  }

  const currentPlayer = getCurrentPlayer();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Game Info Header */}
        <div className="bg-black bg-opacity-50 rounded-lg p-4 mb-4 text-white">
          <div className="flex justify-between items-center">
            <div className="flex space-x-6">
              <div>Table {tableId}</div>
              <div className="capitalize font-bold text-yellow-400">
                {gameState.betting_round.replace('_', ' ')} Round
              </div>
              <div className="text-green-400 font-bold">
                Pot: ${gameState.pot.toFixed(2)}
              </div>
            </div>
            
            {currentPlayer && (
              <div className="flex items-center space-x-4">
                <div className="text-blue-400">
                  Current: {currentPlayer.name}
                </div>
                <div className={`font-bold ${actionTimer <= 10 ? 'text-red-400' : 'text-white'}`}>
                  {actionTimer}s
                </div>
                <div className="w-20 h-2 bg-gray-700 rounded">
                  <div 
                    className={`h-full rounded transition-all duration-1000 ${
                      actionTimer <= 10 ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${(actionTimer / 30) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Poker Table */}
        <div className="relative w-full h-96 bg-green-700 rounded-full border-8 border-amber-800 shadow-2xl">
          {/* Community Cards */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="flex space-x-2 mb-4">
              {gameState.community_cards?.map((card, index) => (
                <div
                  key={index}
                  className="w-12 h-16 bg-white rounded border-2 border-gray-300 flex items-center justify-center text-sm font-bold animate-flip-in"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  {getCardDisplay(card)}
                </div>
              )) || (
                // Placeholder cards
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="w-12 h-16 bg-blue-900 rounded border-2 border-gray-600" />
                ))
              )}
            </div>
            
            {/* Pot Display */}
            <div className="text-center">
              <div className="bg-yellow-500 text-black px-4 py-2 rounded-full font-bold shadow-lg">
                ${gameState.pot.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Players */}
          {gameState.players.map((player) => {
            const seatPos = getSeatPosition(player.seat_position);
            const isCurrentPlayer = player.seat_position === gameState.current_player_position;
            
            return (
              <div
                key={player.user_id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{ top: seatPos.top, left: seatPos.left }}
              >
                {/* Player Card */}
                <div className={`bg-gray-800 rounded-lg p-3 text-white text-center min-w-32 ${
                  isCurrentPlayer ? 'ring-4 ring-yellow-400 animate-pulse' : ''
                } ${player.last_action === 'fold' ? 'opacity-50' : ''}`}>
                  
                  {/* Player Name */}
                  <div className="font-bold text-sm mb-1">
                    {player.name}
                    {player.user_id < 0 && (
                      <span className="ml-1 text-xs bg-blue-500 px-1 rounded">AI</span>
                    )}
                  </div>
                  
                  {/* Chips */}
                  <div className="text-green-400 text-xs mb-2">
                    ${player.chips.toFixed(2)}
                  </div>
                  
                  {/* Hole Cards */}
                  {player.hole_cards && (
                    <div className="flex justify-center space-x-1 mb-2">
                      {player.hole_cards.map((card, index) => (
                        <div key={index} className="w-6 h-8 bg-white rounded text-xs flex items-center justify-center text-black">
                          {getCardDisplay(card)}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Current Bet */}
                  {player.current_bet > 0 && (
                    <div className="text-yellow-400 text-xs mb-1">
                      Bet: ${player.current_bet.toFixed(2)}
                    </div>
                  )}
                  
                  {/* Last Action */}
                  {player.last_action && (
                    <div className={`text-xs font-bold uppercase ${getActionColor(player.last_action)}`}>
                      {player.last_action}
                    </div>
                  )}
                  
                  {/* Action Timer for Current Player */}
                  {isCurrentPlayer && actionTimer > 0 && (
                    <div className="mt-2">
                      <div className="w-full h-1 bg-gray-600 rounded">
                        <div 
                          className={`h-full rounded transition-all duration-1000 ${
                            actionTimer <= 10 ? 'bg-red-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${(actionTimer / 30) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Game Status */}
        <div className="mt-4 text-center text-white">
          <div className="text-lg font-bold">
            {gameState.players.filter(p => p.is_active && p.last_action !== 'fold').length} players active
          </div>
          <div className="text-sm opacity-75">
            Waiting for {currentPlayer?.name || 'next player'} to act...
          </div>
        </div>
      </div>

      <style>{`
        @keyframes flip-in {
          0% {
            transform: rotateY(-90deg);
            opacity: 0;
          }
          100% {
            transform: rotateY(0deg);
            opacity: 1;
          }
        }
        .animate-flip-in {
          animation: flip-in 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default PokerTable;