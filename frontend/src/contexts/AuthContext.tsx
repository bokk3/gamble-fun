import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { gameService } from '../services/gameService';

interface User {
  id: number;
  username: string;
  email: string;
  balance: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isBalanceLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (userData: RegisterData) => Promise<boolean>;
  logout: () => void;
  updateBalance: (newBalance: number) => void;
  refreshBalance: () => Promise<void>;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    const storedToken = localStorage.getItem('casino_token');
    const storedUser = localStorage.getItem('casino_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
      
      // Set axios default authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }
  }, []);

  // Automatic balance refresh every 30 seconds when authenticated
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    // Connect gameService to our balance refresh
    gameService.setBalanceRefreshCallback(refreshBalance);

    const balanceInterval = setInterval(() => {
      refreshBalance();
    }, 30000); // 30 seconds

    // Initial balance refresh on authentication
    refreshBalance();

    return () => clearInterval(balanceInterval);
  }, [isAuthenticated, token]);

  // Refresh balance when page becomes visible (user returns to tab)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshBalance();
      }
    };

    const handleFocus = () => {
      refreshBalance();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthenticated]);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    console.log('🔐 Login attempt started:', { 
      username: credentials.username, 
      apiUrl: API_BASE_URL, 
      fullUrl: `${API_BASE_URL}/auth/login` 
    });
    
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
      console.log('✅ Login API response:', response.data);
      
      if (response.data.success) {
        const { token: newToken, user: userData } = response.data.data;
        
        console.log('👤 Setting user data:', userData);
        setToken(newToken);
        setUser(userData);
        setIsAuthenticated(true);
        
        localStorage.setItem('casino_token', newToken);
        localStorage.setItem('casino_user', JSON.stringify(userData));
        
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        
        toast.success('Login successful! Welcome back!');
        return true;
      } else {
        console.warn('⚠️ Login API returned success=false:', response.data);
        toast.error(response.data.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('❌ Login error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
      
      const message = error.response?.data?.message || 
                     error.response?.statusText || 
                     error.message || 
                     'Login failed - please check your connection';
      toast.error(message);
    }
    return false;
  };

  const register = async (userData: RegisterData): Promise<boolean> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, userData);
      
      if (response.data.success) {
        const { token: newToken, user: newUser } = response.data.data;
        
        setToken(newToken);
        setUser(newUser);
        setIsAuthenticated(true);
        
        localStorage.setItem('casino_token', newToken);
        localStorage.setItem('casino_user', JSON.stringify(newUser));
        
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        
        toast.success('Registration successful!');
        return true;
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
    }
    return false;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    
    localStorage.removeItem('casino_token');
    localStorage.removeItem('casino_user');
    
    delete axios.defaults.headers.common['Authorization'];
    
    toast.success('Logged out successfully');
  };

  const updateBalance = (newBalance: number) => {
    if (user) {
      const updatedUser = { ...user, balance: newBalance };
      setUser(updatedUser);
      localStorage.setItem('casino_user', JSON.stringify(updatedUser));
    }
  };

  const refreshBalance = async () => {
    if (!token || !isAuthenticated) return;
    
    setIsBalanceLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/user/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success && user) {
        const newBalance = response.data.data.balance;
        console.log('Balance refreshed from server:', newBalance);
        updateBalance(newBalance);
      }
    } catch (error: any) {
      console.error('Failed to refresh balance:', error);
      if (error.response?.status === 401) {
        // Token expired, logout user
        logout();
        toast.error('Session expired. Please log in again.');
      }
    } finally {
      setIsBalanceLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    isBalanceLoading,
    login,
    register,
    logout,
    updateBalance,
    refreshBalance
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};