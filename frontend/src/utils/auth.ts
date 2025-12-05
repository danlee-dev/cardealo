import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './api';

const TOKEN_KEY = 'auth_token';
const USER_ID_KEY = 'user_id';

export const AuthStorage = {
  async saveToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error saving token:', error);
      throw error;
    }
  },

  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },

  async saveUserId(userId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_ID_KEY, userId);
    } catch (error) {
      console.error('Error saving user ID:', error);
      throw error;
    }
  },

  async getUserId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(USER_ID_KEY);
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  },

  async clearAuth(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_ID_KEY]);
    } catch (error) {
      console.error('Error clearing auth:', error);
      throw error;
    }
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null;
  },
};

export interface LoginRequest {
  user_email: string;
  user_pw: string;
}

export interface LoginResponse {
  success: boolean;
  msg?: string;
  token?: string;
  error?: string;
}

export interface RegisterRequest {
  user_name: string;
  user_id: string;
  user_pw: string;
  user_email: string;
  user_age: number;
  isBusiness: boolean;
  card_name: string;
}

export interface RegisterResponse {
  success: boolean;
  msg?: string;
  error?: string;
}

export const AuthAPI = {
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: email,
          user_pw: password,
        }),
      });

      const data: LoginResponse = await response.json();

      if (data.success && data.token) {
        await AuthStorage.saveToken(data.token);
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  },

  async register(userData: RegisterRequest): Promise<RegisterResponse> {
    try {
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data: RegisterResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Register error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  },

  async logout(): Promise<void> {
    await AuthStorage.clearAuth();
  },
};
