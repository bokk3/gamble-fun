/**
 * Poker Table Component
 * Main poker game interface with real-time multiplayer functionality
 */

import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';

interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: number;
  display: string;
}

interface PokerPlayer {
  userId: number;
  username: string;
  avatar?: string;
  seatPosition: number;
  chips: number;
  currentBet: number;
  lastAction: string | null;
  isActive: boolean;
  isAllIn: boolean;
  isFolded: boolean;
  holeCards?: Card[];
  isAI?: boolean;
  playingStyle?: string;
  skillLevel?: string;
}

interface TableState {
  tableId: number;
  players: PokerPlayer[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  minRaise: number;
  currentPlayerPosition: number;
  dealerPosition: number;
  bettingRound: string;
  handNumber: number;
}

interface PokerTable {
  id: number;
  name: string;
  table_type: string;
  max_players: number;
  min_players: number;
  small_blind: string;
  big_blind: string;
  min_buy_in: string;
  max_buy_in: string;
  current_players: number;
  avg_chips: string;
}

const PokerGame: React.FC = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();

  const [tables, setTables] = useState<PokerTable[]>([]);
  const [currentTable, setCurrentTable] = useState<TableState | null>(null);
  
  // Debug logging
  console.log('Current tables state:', tables);
  const [joinedTableId, setJoinedTableId] = useState<number | null>(null);
  const [buyInAmount, setBuyInAmount] = useState<number>(0);
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [selectedTable, setSelectedTable] = useState<PokerTable | null>(null);
  const [actionAmount, setActionAmount] = useState<number>(0);
  const [isPlayerTurn, setIsPlayerTurn] = useState<boolean>(false);
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [showCards, setShowCards] = useState<boolean>(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    console.log('PokerGame useEffect - User:', user.username, 'Socket:', !!socket);
    fetchTables();
    setupSocketListeners();
    
    return () => {
      cleanupSocketListeners();
    };
  }, [user, socket]);

  const setupSocketListeners = () => {
    console.log('Setting up socket listeners. Socket available:', !!socket);
    if (!socket) {
      console.warn('❌ No socket connection available for poker listeners!');
      return;
    }

    console.log('✅ Adding poker socket listeners');
    socket.on('poker:joined_table', handleJoinedTable);
    socket.on('poker:table_state', handleTableState);
    socket.on('poker:player_joined', handlePlayerJoined);
    socket.on('poker:player_left', handlePlayerLeft);
    socket.on('poker:player_action', handlePlayerActionEvent);
    socket.on('poker:hand_started', handleHandStarted);
    socket.on('poker:new_round', handleNewRound);
    socket.on('poker:showdown', handleShowdown);
    socket.on('poker:hand_complete', handleHandComplete);
    socket.on('poker:error', handlePokerError);
    socket.on('ai_action', handleAIAction);
  };

  const cleanupSocketListeners = () => {
    if (!socket) return;

    socket.off('poker:joined_table');
    socket.off('poker:table_state');
    socket.off('poker:player_joined');
    socket.off('poker:player_left');
    socket.off('poker:player_action');
    socket.off('poker:hand_started');
    socket.off('poker:new_round');
    socket.off('poker:showdown');
    socket.off('poker:hand_complete');
    socket.off('poker:error');
    socket.off('ai_action');
  };

  const fetchTables = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/poker/tables`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('casino_token')}` }
      });
      
      console.log('Poker tables response:', response.data);
      
      if (response.data.success) {
        console.log('Setting tables:', response.data.data.tables);
        setTables(response.data.data.tables);
      }
    } catch (error) {
      console.error('Error fetching poker tables:', error);
    }
  };

  const fetchTableState = async (tableId: number) => {
    try {
      console.log('Fetching table state for table:', tableId);
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/poker/table/${tableId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('casino_token')}` }
      });
      
      if (response.data.success) {
        const { table, players, currentGame } = response.data.data;
        
        // Convert to TableState format
        const tableState: TableState = {
          tableId: table.id,
          players: players.map((p: any) => ({
            userId: p.userId,
            username: p.username,
            seatPosition: p.seatPosition,
            chips: parseFloat(p.chips),
            currentBet: parseFloat(p.currentBet || 0),
            lastAction: p.lastAction,
            isActive: !!p.isActive,
            isAllIn: !!p.isAllIn,
            isFolded: !!p.isFolded,
            isAI: !!p.isAI,
            playingStyle: p.playing_style,
            skillLevel: p.skill_level
          })),
          communityCards: currentGame?.community_cards ? JSON.parse(currentGame.community_cards) : [],
          pot: currentGame ? parseFloat(currentGame.pot_amount || 0) : 0,
          currentBet: currentGame ? parseFloat(currentGame.current_bet || 0) : 0,
          minRaise: currentGame ? parseFloat(currentGame.min_raise || table.big_blind) : parseFloat(table.big_blind),
          currentPlayerPosition: currentGame ? currentGame.current_player_position : 0,
          dealerPosition: currentGame ? currentGame.dealer_position : 0,
          bettingRound: currentGame ? currentGame.betting_round : 'pre_flop',
          handNumber: currentGame ? currentGame.hand_number : 1
        };
        
        console.log('✅ Table state fetched via API:', tableState);
        setCurrentTable(tableState);
        
        // Check if it's player's turn (same logic as WebSocket handler)
        const currentPlayer = tableState.players.find(p => p.userId === user?.id);
        console.log('🎯 API Turn check:', {
          currentPlayerPos: tableState.currentPlayerPosition,
          myPosition: currentPlayer?.seatPosition,
          myId: user?.id,
          folded: currentPlayer?.isFolded,
          allIn: currentPlayer?.isAllIn,
          active: currentPlayer?.isActive
        });
        
        const isMyTurn = currentPlayer && 
          tableState.currentPlayerPosition === currentPlayer.seatPosition &&
          !currentPlayer.isFolded && 
          !currentPlayer.isAllIn &&
          currentPlayer.isActive;
        
        setIsPlayerTurn(!!isMyTurn);
        console.log(`🎯 API My turn status: ${!!isMyTurn}`);
      }
    } catch (error) {
      console.error('Error fetching table state:', error);
    }
  };

  const handleJoinTable = async (table: PokerTable) => {
    try {
      console.log('Attempting to join table:', table.id);
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/poker/join`,
        {
          tableId: table.id,
          buyIn: buyInAmount
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('casino_token')}` }
        }
      );

      console.log('Join table API response:', response.data);

      if (response.data.success) {
        setJoinedTableId(table.id);
        setShowJoinModal(false);
        
        // Join table via WebSocket
        console.log('Socket connected:', !!socket);
        if (socket) {
          console.log('Emitting poker:join_table event for table:', table.id);
          socket.emit('poker:join_table', { tableId: table.id });
        } else {
          console.error('No socket connection available! Using fallback...');
        }
        
        // Fallback: Fetch table state directly if WebSocket not available
        setTimeout(() => {
          if (!currentTable) {
            console.log('WebSocket failed, fetching table state via API');
            fetchTableState(table.id);
          }
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error joining table:', error);
      alert(error.response?.data?.message || 'Failed to join table');
    }
  };

  const handleLeaveTable = async () => {
    if (!joinedTableId) return;

    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL}/poker/leave`,
        { tableId: joinedTableId },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('casino_token')}` }
        }
      );

      if (socket) {
        socket.emit('poker:leave_table', { tableId: joinedTableId });
      }

      setJoinedTableId(null);
      setCurrentTable(null);
      setPlayerCards([]);
      setShowCards(false);
      fetchTables();
    } catch (error: any) {
      console.error('Error leaving table:', error);
      alert(error.response?.data?.message || 'Failed to leave table');
    }
  };

  const handlePlayerAction = (action: string, amount?: number) => {
    if (!socket || !joinedTableId) return;

    socket.emit('poker:action', {
      tableId: joinedTableId,
      action,
      amount: amount || 0
    });
  };

  const startNewHand = async () => {
    console.log('🎯 START HAND BUTTON CLICKED!');
    console.log('joinedTableId:', joinedTableId);
    console.log('socket:', !!socket);
    console.log('isConnected:', isConnected);
    
    if (!joinedTableId) {
      console.error('No joined table ID!');
      alert('You must join a table first!');
      return;
    }
    
    try {
      console.log('Starting hand for table:', joinedTableId);
      
      // Try WebSocket first if available
      if (socket && isConnected) {
        console.log('Using WebSocket to start hand');
        socket.emit('poker:start_hand', { tableId: joinedTableId });
      } else {
        // Fallback to REST API
        console.log('Using REST API to start hand');
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/poker/start-hand`,
          { tableId: joinedTableId },
          {
            headers: { Authorization: `Bearer ${localStorage.getItem('casino_token')}` }
          }
        );
        
        console.log('Start hand API response:', response.data);
        
        if (response.data.success) {
          console.log('✅ Hand started successfully!');
          alert(`✅ Hand started! ${response.data.data.playerCount} players`);
          // Manually fetch updated table state
          setTimeout(() => {
            fetchTableState(joinedTableId);
          }, 1000);
        } else {
          console.error('❌ Failed to start hand:', response.data);
          alert('❌ Failed to start hand: ' + response.data.message);
        }
      }
    } catch (error) {
      console.error('Error starting hand:', error);
    }
  };

  // Socket event handlers
  const handleJoinedTable = (data: any) => {
    console.log('✅ WebSocket: Joined table event received:', data);
  };

  const handleTableState = (tableState: TableState) => {
    console.log('✅ WebSocket: Table state received:', tableState);
    setCurrentTable(tableState);
    
    // Check if it's player's turn with improved detection
    const currentPlayer = tableState.players.find(p => p.userId === user?.id);
    console.log('🎯 Turn check:', {
      currentPlayerPos: tableState.currentPlayerPosition,
      myPosition: currentPlayer?.seatPosition,
      myId: user?.id,
      folded: currentPlayer?.isFolded,
      allIn: currentPlayer?.isAllIn
    });
    
    const isMyTurn = currentPlayer && 
      tableState.currentPlayerPosition === currentPlayer.seatPosition &&
      !currentPlayer.isFolded && 
      !currentPlayer.isAllIn &&
      currentPlayer.isActive;
    
    setIsPlayerTurn(!!isMyTurn);
    console.log(`🎯 My turn status: ${!!isMyTurn}`);
    
    // Set player's cards if available
    if (currentPlayer?.holeCards && currentPlayer.holeCards.length > 0) {
      setPlayerCards(currentPlayer.holeCards);
      setShowCards(true);
      console.log('🃏 My cards:', currentPlayer.holeCards);
    }
  };

  const handlePlayerJoined = (data: any) => {
    console.log('Player joined:', data.player.username);
  };

  const handlePlayerLeft = (data: any) => {
    console.log('Player left:', data.userId);
  };

  const handlePlayerActionEvent = (data: any) => {
    console.log('Player action:', data);
  };

  const handleHandStarted = (data: any) => {
    console.log('Hand started:', data.handId);
    setShowCards(false);
  };

  const handleNewRound = (data: any) => {
    console.log('New round:', data.round);
  };

  const handleShowdown = (data: any) => {
    console.log('Showdown:', data.results);
    setShowCards(true);
  };

  const handleHandComplete = (data: any) => {
    console.log('Hand complete:', data);
  };

  const handlePokerError = (data: any) => {
    console.error('Poker error:', data.message);
    alert(data.message);
  };

  const handleAIAction = (data: any) => {
    console.log('🤖 AI Action:', data);
    // Refresh table state after AI action
    if (joinedTableId) {
      setTimeout(() => {
        fetchTableState(joinedTableId);
      }, 500);
    }
  };

  const getCardDisplay = (card: Card) => {
    const suitColors = {
      hearts: 'text-red-500',
      diamonds: 'text-red-500',
      clubs: 'text-gray-800',
      spades: 'text-gray-800'
    };

    return (
      <div className={`inline-block text-2xl ${suitColors[card.suit]}`}>
        {card.display}
      </div>
    );
  };

  const getSeatPosition = (position: number, totalSeats: number = 8) => {
    const angle = (position * 360) / totalSeats;
    const radius = 45; // percentage from center
    const x = 50 + radius * Math.cos((angle - 90) * Math.PI / 180);
    const y = 50 + radius * Math.sin((angle - 90) * Math.PI / 180);
    
    return { x: `${x}%`, y: `${y}%` };
  };

  if (!joinedTableId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">🃏 Poker Tables</h1>
            <p className="text-green-200">Choose a table and join the action!</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tables.map(table => (
              <div key={table.id} className="bg-green-800 rounded-xl p-6 border border-green-600">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-white">{table.name}</h3>
                  <span className="bg-green-600 text-white px-2 py-1 rounded text-sm">
                    {table.current_players}/{table.max_players}
                  </span>
                </div>
                
                <div className="space-y-2 text-green-100 mb-4">
                  <p><span className="font-semibold">Stakes:</span> ${table.small_blind}/${table.big_blind}</p>
                  <p><span className="font-semibold">Buy-in:</span> ${table.min_buy_in} - ${table.max_buy_in}</p>
                  <p><span className="font-semibold">Type:</span> {table.table_type}</p>
                </div>

                <button
                  onClick={() => {
                    setSelectedTable(table);
                    setBuyInAmount(parseFloat(table.min_buy_in));
                    setShowJoinModal(true);
                  }}
                  disabled={table.current_players >= table.max_players}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 
                           text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  {table.current_players >= table.max_players ? 'Table Full' : 'Join Table'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Join Table Modal */}
        {showJoinModal && selectedTable && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-4">Join {selectedTable.name}</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-bold mb-2">
                  Buy-in Amount (${selectedTable.min_buy_in} - ${selectedTable.max_buy_in})
                </label>
                <input
                  type="number"
                  value={buyInAmount}
                  onChange={(e) => setBuyInAmount(Number(e.target.value))}
                  min={parseFloat(selectedTable.min_buy_in)}
                  max={parseFloat(selectedTable.max_buy_in)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleJoinTable(selectedTable)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
                  Join Table
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Table Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">
            🃏 Poker Table {joinedTableId}
          </h1>
          <button
            onClick={handleLeaveTable}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            Leave Table
          </button>
        </div>

        {currentTable && (
          <>
            {/* Game Info */}
            <div className="bg-green-800 rounded-lg p-4 mb-6 border border-green-600">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white">
                <div>
                  <span className="text-green-200">Pot:</span>
                  <span className="font-bold ml-2">${currentTable.pot.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-green-200">Current Bet:</span>
                  <span className="font-bold ml-2">${currentTable.currentBet.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-green-200">Round:</span>
                  <span className="font-bold ml-2 capitalize">{currentTable.bettingRound.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-green-200">Hand #:</span>
                  <span className="font-bold ml-2">{currentTable.handNumber}</span>
                </div>
              </div>
            </div>

            {/* Poker Table */}
            <div className="relative">
              {/* Table Surface */}
              <div className="w-full aspect-[4/3] bg-green-600 rounded-full border-8 border-green-700 relative overflow-hidden">
                
                {/* Community Cards */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="flex space-x-2 mb-4">
                    {currentTable.communityCards.map((card, index) => (
                      <div key={index} className="w-12 h-16 bg-white rounded border border-gray-300 flex items-center justify-center">
                        {getCardDisplay(card)}
                      </div>
                    ))}
                    {/* Placeholder cards */}
                    {Array.from({ length: 5 - currentTable.communityCards.length }).map((_, index) => (
                      <div key={`placeholder-${index}`} className="w-12 h-16 bg-gray-700 rounded border border-gray-600"></div>
                    ))}
                  </div>
                  
                  {/* Pot Display */}
                  <div className="text-center">
                    <div className="bg-yellow-600 text-white px-4 py-2 rounded-full font-bold">
                      Pot: ${currentTable.pot.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Player Seats */}
                {currentTable.players.map((player) => {
                  const position = getSeatPosition(player.seatPosition);
                  const isDealer = player.seatPosition === currentTable.dealerPosition;
                  const isCurrentPlayer = player.seatPosition === currentTable.currentPlayerPosition;
                  const isMe = player.userId === user?.id;

                  return (
                    <div
                      key={player.userId}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2"
                      style={{ left: position.x, top: position.y }}
                    >
                      <div className={`bg-white rounded-lg p-3 min-w-[120px] text-center border-2 ${
                        isCurrentPlayer ? 'border-yellow-400 shadow-lg' : 'border-gray-300'
                      } ${isMe ? 'bg-blue-50' : ''}`}>
                        
                        {/* Dealer Button */}
                        {isDealer && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-white border-2 border-gray-800 rounded-full flex items-center justify-center text-xs font-bold">
                            D
                          </div>
                        )}

                        <div className="text-sm font-bold text-gray-800 truncate flex items-center justify-center">
                          {player.username}
                          {player.isAI && (
                            <span className="ml-1 px-1 py-0.5 bg-purple-100 text-purple-600 text-xs rounded font-normal">
                              AI
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">
                          ${player.chips.toFixed(2)}
                        </div>
                        {player.isAI && player.skillLevel && (
                          <div className="text-xs text-purple-600 capitalize">
                            {player.skillLevel}
                          </div>
                        )}
                        
                        {/* Player Status */}
                        {player.isFolded && (
                          <div className="text-xs text-red-600 font-bold">FOLDED</div>
                        )}
                        {player.isAllIn && (
                          <div className="text-xs text-orange-600 font-bold">ALL-IN</div>
                        )}
                        {player.lastAction && !player.isFolded && (
                          <div className="text-xs text-blue-600 font-bold uppercase">
                            {player.lastAction}
                          </div>
                        )}
                        
                        {/* Current Bet */}
                        {player.currentBet > 0 && (
                          <div className="text-xs bg-yellow-200 rounded px-1 mt-1">
                            Bet: ${player.currentBet.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Player Cards (if showing) */}
            {showCards && playerCards.length > 0 && (
              <div className="mt-6 text-center">
                <h3 className="text-white font-bold mb-2">Your Cards:</h3>
                <div className="flex justify-center space-x-4">
                  {playerCards.map((card, index) => (
                    <div key={index} className="w-16 h-24 bg-white rounded border border-gray-300 flex items-center justify-center">
                      {getCardDisplay(card)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {isPlayerTurn && (
              <div className="mt-6 bg-green-800 rounded-lg p-4 border border-green-600">
                <h3 className="text-white font-bold mb-4 text-center">Your Turn - Choose Action</h3>
                
                <div className="flex flex-wrap justify-center gap-3 mb-4">
                  <button
                    onClick={() => handlePlayerAction('fold')}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Fold
                  </button>
                  
                  {currentTable.currentBet === 0 ? (
                    <button
                      onClick={() => handlePlayerAction('check')}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    >
                      Check
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePlayerAction('call')}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                    >
                      Call ${currentTable.currentBet.toFixed(2)}
                    </button>
                  )}
                  
                  <button
                    onClick={() => handlePlayerAction('all_in')}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded"
                  >
                    All-In
                  </button>
                </div>

                {/* Bet/Raise Input */}
                <div className="flex justify-center items-center space-x-3">
                  <input
                    type="number"
                    value={actionAmount}
                    onChange={(e) => setActionAmount(Number(e.target.value))}
                    min={currentTable.minRaise}
                    placeholder="Amount"
                    className="px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <button
                    onClick={() => handlePlayerAction(currentTable.currentBet === 0 ? 'bet' : 'raise', actionAmount)}
                    disabled={actionAmount < currentTable.minRaise}
                    className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                  >
                    {currentTable.currentBet === 0 ? 'Bet' : 'Raise'}
                  </button>
                </div>
              </div>
            )}

            {/* Start Hand Button (for testing) */}
            {joinedTableId && (
              <div className="mt-6 text-center">
                <button
                  onClick={startNewHand}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded shadow-lg"
                >
                  🎯 Start New Hand
                </button>
                <p className="text-sm text-gray-400 mt-2">
                  WebSocket: {isConnected ? '✅ Connected' : '❌ Disconnected (using REST API)'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PokerGame;