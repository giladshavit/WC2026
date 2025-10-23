import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, User, AuthResponse } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  getCurrentUserId: () => number | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = '@auth_token';
const USER_KEY = '@auth_user';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = user !== null;

  // Load stored authentication data on app start
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);

      if (storedToken && storedUser) {
        // Set token in API service
        apiService.setAccessToken(storedToken);
        
        try {
          // Verify token is still valid by fetching current user
          const currentUser = await apiService.getCurrentUser();
          setUser(currentUser);
        } catch (error) {
          // Token is invalid, clear stored data
          console.log('Stored token is invalid, clearing auth data');
          await clearStoredAuth();
        }
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
      await clearStoredAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const storeAuth = async (authResponse: AuthResponse, userData: User) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(TOKEN_KEY, authResponse.access_token),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(userData)),
      ]);
    } catch (error) {
      console.error('Error storing auth data:', error);
    }
  };

  const clearStoredAuth = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(TOKEN_KEY),
        AsyncStorage.removeItem(USER_KEY),
      ]);
      apiService.logout();
      setUser(null);
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      const authResponse = await apiService.login({ username, password });
      const userData = await apiService.getCurrentUser();
      
      await storeAuth(authResponse, userData);
      setUser(userData);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, password: string, name: string) => {
    try {
      setIsLoading(true);
      const authResponse = await apiService.register({ username, password, name });
      const userData = await apiService.getCurrentUser();
      
      await storeAuth(authResponse, userData);
      setUser(userData);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await clearStoredAuth();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      if (isAuthenticated) {
        const userData = await apiService.getCurrentUser();
        setUser(userData);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
      // If refresh fails, user might need to login again
      await logout();
    }
  };

  const getCurrentUserId = (): number | null => {
    return user?.user_id || null;
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshUser,
    getCurrentUserId,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
