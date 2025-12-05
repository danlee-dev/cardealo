import { io, Socket } from 'socket.io-client';
import { AuthStorage } from './auth';
import { API_URL } from './api';

type EventCallback = (data: any) => void;

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number | string;
  content: string;
  created_at: string;
  is_read: boolean;
  sender_name?: string;
}

export interface Conversation {
  id: number | null;
  friend_id: number | string;
  friend_name: string;
  friend_email: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
}

class UserWebSocket {
  private socket: Socket | null = null;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private isConnecting = false;
  private userId: number | null = null;

  async connect(): Promise<void> {
    if (this.isConnecting) {
      // Wait for ongoing connection
      return new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (!this.isConnecting) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
      });
    }

    if (this.isConnected()) return;

    this.isConnecting = true;

    return new Promise(async (resolve) => {
      try {
        const token = await AuthStorage.getToken();
        if (!token) {
          console.error('[UserWebSocket] No token available');
          this.isConnecting = false;
          resolve();
          return;
        }

        // Extract base URL (remove /api if present)
        const baseUrl = API_URL.replace('/api', '');

        this.socket = io(baseUrl, {
          transports: ['websocket'],
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });

        this.socket.on('connect', () => {
          console.log('[UserWebSocket] Connected to server');
          this.isConnecting = false;

          // Join user room
          this.socket?.emit('join_user', { token });

          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('[UserWebSocket] Disconnected:', reason);
        });

        this.socket.on('connect_error', (error) => {
          console.error('[UserWebSocket] Connection error:', error);
          this.isConnecting = false;
          resolve();
        });

        // Set up event forwarding to internal listeners
        this.socket.onAny((eventName: string, data: any) => {
          console.log('[UserWebSocket] Event received:', eventName, data);
          this.triggerEvent(eventName, data);
        });

        // Handle user_joined event
        this.socket.on('user_joined', (data: any) => {
          console.log('[UserWebSocket] User joined:', data);
          if (data.user_id) {
            this.userId = data.user_id;
          }
        });

      } catch (error) {
        console.error('[UserWebSocket] Connection error:', error);
        this.isConnecting = false;
        resolve();
      }
    });
  }

  private triggerEvent(eventName: string, data: any): void {
    const listeners = this.eventListeners.get(eventName) || [];
    listeners.forEach(callback => callback(data));

    // Also trigger wildcard listeners
    const wildcardListeners = this.eventListeners.get('*') || [];
    wildcardListeners.forEach(callback => callback({ event: eventName, data }));
  }

  emit(eventName: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(eventName, data);
    } else {
      console.warn('[UserWebSocket] Cannot emit, socket not connected');
    }
  }

  on(eventName: string, callback: EventCallback): () => void {
    const listeners = this.eventListeners.get(eventName) || [];
    listeners.push(callback);
    this.eventListeners.set(eventName, listeners);

    // Return unsubscribe function
    return () => this.off(eventName, callback);
  }

  off(eventName: string, callback?: EventCallback): void {
    if (callback) {
      const listeners = this.eventListeners.get(eventName) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
        this.eventListeners.set(eventName, listeners);
      }
    } else {
      this.eventListeners.delete(eventName);
    }
  }

  // Chat specific methods
  sendMessage(conversationId: number, content: string): void {
    this.emit('chat_message', {
      conversation_id: conversationId,
      content,
    });
  }

  joinConversation(conversationId: number): void {
    this.emit('join_conversation', { conversation_id: conversationId });
  }

  leaveConversation(conversationId: number): void {
    this.emit('leave_conversation', { conversation_id: conversationId });
  }

  async markMessagesRead(conversationId: number): Promise<void> {
    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      await fetch(`${API_URL}/api/chat/read/${conversationId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Also emit via WebSocket for real-time update
      this.emit('mark_read', { conversation_id: conversationId });
    } catch (error) {
      console.error('[UserWebSocket] Failed to mark messages as read:', error);
    }
  }

  // Typing indicator
  sendTyping(conversationId: number, isTyping: boolean): void {
    this.emit('typing', { conversation_id: conversationId, is_typing: isTyping });
  }

  disconnect(): void {
    if (this.socket) {
      this.emit('leave_user', {});
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventListeners.clear();
    this.isConnecting = false;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Singleton instance
export const userWebSocket = new UserWebSocket();

// React Hook
export const useUserWebSocket = () => {
  return {
    connect: () => userWebSocket.connect(),
    disconnect: () => userWebSocket.disconnect(),
    on: (event: string, callback: EventCallback) => userWebSocket.on(event, callback),
    off: (event: string, callback?: EventCallback) => userWebSocket.off(event, callback),
    emit: (event: string, data: any) => userWebSocket.emit(event, data),
    sendMessage: (conversationId: number, content: string) =>
      userWebSocket.sendMessage(conversationId, content),
    joinConversation: (conversationId: number) =>
      userWebSocket.joinConversation(conversationId),
    leaveConversation: (conversationId: number) =>
      userWebSocket.leaveConversation(conversationId),
    markMessagesRead: (conversationId: number) =>
      userWebSocket.markMessagesRead(conversationId),
    sendTyping: (conversationId: number, isTyping: boolean) =>
      userWebSocket.sendTyping(conversationId, isTyping),
    isConnected: () => userWebSocket.isConnected(),
  };
};
