import { AuthStorage } from './auth';
import { WS_URL } from './api';

type EventCallback = (data: any) => void;

interface WebSocketMessage {
  type: string;
  data: any;
}

class CorporateWebSocket {
  private socket: WebSocket | null = null;
  private cardId: number | null = null;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;

  async connect(cardId: number): Promise<void> {
    if (this.isConnecting) return;

    this.cardId = cardId;
    this.isConnecting = true;

    try {
      const token = await AuthStorage.getToken();
      if (!token) {
        console.error('[WebSocket] No token available');
        this.isConnecting = false;
        return;
      }

      // Socket.IO 프로토콜 사용
      const wsUrl = `${WS_URL}/socket.io/?EIO=4&transport=websocket`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;

        // 대시보드 룸 참가
        this.emit('join_dashboard', { card_id: cardId, token });
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.socket.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.isConnecting = false;
      };

      this.socket.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.isConnecting = false;
        this.handleReconnect();
      };

    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.isConnecting = false;
    }
  }

  private handleMessage(data: string): void {
    try {
      // Socket.IO 메시지 파싱
      // Socket.IO 프로토콜: 숫자 + JSON
      // 예: 42["event_name", {...}]
      if (data.startsWith('42')) {
        const jsonStr = data.substring(2);
        const parsed = JSON.parse(jsonStr);

        if (Array.isArray(parsed) && parsed.length >= 2) {
          const eventName = parsed[0];
          const eventData = parsed[1];

          this.triggerEvent(eventName, eventData);
        }
      } else if (data === '2') {
        // Ping - 응답으로 pong 보내기
        this.socket?.send('3');
      }
    } catch (error) {
      console.error('[WebSocket] Message parse error:', error);
    }
  }

  private emit(eventName: string, data: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      // Socket.IO 형식으로 메시지 전송
      const message = `42${JSON.stringify([eventName, data])}`;
      this.socket.send(message);
    }
  }

  private triggerEvent(eventName: string, data: any): void {
    const listeners = this.eventListeners.get(eventName) || [];
    listeners.forEach(callback => callback(data));
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.cardId) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;

      console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

      setTimeout(() => {
        if (this.cardId) {
          this.connect(this.cardId);
        }
      }, delay);
    }
  }

  on(eventName: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(eventName) || [];
    listeners.push(callback);
    this.eventListeners.set(eventName, listeners);
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

  disconnect(): void {
    if (this.socket) {
      if (this.cardId) {
        this.emit('leave_dashboard', { card_id: this.cardId });
      }
      this.socket.close();
      this.socket = null;
    }
    this.cardId = null;
    this.eventListeners.clear();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

// 싱글톤 인스턴스
export const corporateWebSocket = new CorporateWebSocket();

// React Hook으로 사용하기 위한 유틸리티
export const useCorporateWebSocket = () => {
  return {
    connect: (cardId: number) => corporateWebSocket.connect(cardId),
    disconnect: () => corporateWebSocket.disconnect(),
    on: (event: string, callback: EventCallback) => corporateWebSocket.on(event, callback),
    off: (event: string, callback?: EventCallback) => corporateWebSocket.off(event, callback),
    isConnected: () => corporateWebSocket.isConnected(),
  };
};
