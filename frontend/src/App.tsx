import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SlotsGame from './pages/games/SlotsGame';
import DiceGame from './pages/games/DiceGame';
import CrashGame from './pages/games/CrashGame';
import BlackjackGame from './pages/games/BlackjackGame';
import RouletteGame from './pages/games/RouletteGame';
import Leaderboard from './pages/Leaderboard';

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <Router>
            <div className="min-h-screen bg-gradient-to-br from-casino-primary to-casino-secondary">
              <Navbar />
              <main className="container mx-auto px-4 py-8">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/games/slots" element={
                    <ProtectedRoute>
                      <SlotsGame />
                    </ProtectedRoute>
                  } />
                  <Route path="/games/dice" element={
                    <ProtectedRoute>
                      <DiceGame />
                    </ProtectedRoute>
                  } />
                  <Route path="/games/crash" element={
                    <ProtectedRoute>
                      <CrashGame />
                    </ProtectedRoute>
                  } />
                  <Route path="/games/blackjack" element={
                    <ProtectedRoute>
                      <BlackjackGame />
                    </ProtectedRoute>
                  } />
                  <Route path="/games/roulette" element={
                    <ProtectedRoute>
                      <RouletteGame />
                    </ProtectedRoute>
                  } />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                </Routes>
              </main>
              <Toaster 
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#16213e',
                    color: '#ffffff',
                    border: '1px solid #e94560'
                  }
                }}
              />
            </div>
          </Router>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;