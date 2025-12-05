import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { View, Platform, Vibration } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { AuthStorage } from '../utils/auth';
import { API_URL } from '../utils/api';
import { NotificationToast } from '../components/NotificationToast';
import { userWebSocket } from '../utils/userWebSocket';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

interface NavigationCallbacks {
  navigateToChat: (conversationId: number) => void;
  navigateToNotifications: () => void;
  navigateToCourse: (courseId?: number) => void;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationIds?: number[]) => Promise<void>;
  showToast: (notification: Notification) => void;
  setActiveConversationId: (id: number | null) => void;
  setNavigationCallbacks: (callbacks: NavigationCallbacks) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

// Format special message content for notification display
const formatMessageForNotification = (content: string): string => {
  if (!content) return '';

  // Handle split payment message
  if (content.startsWith('__SPLIT_PAYMENT__')) {
    try {
      const data = JSON.parse(content.replace('__SPLIT_PAYMENT__', ''));
      const amount = data.amount?.toLocaleString('ko-KR') || '0';
      if (data.status === 'completed') {
        return `${amount}원 정산 완료`;
      }
      return `${amount}원 정산 요청`;
    } catch {
      return '정산 요청';
    }
  }

  // Handle course share message
  if (content.startsWith('__COURSE_SHARE__')) {
    try {
      const data = JSON.parse(content.replace('__COURSE_SHARE__', ''));
      return `코스 공유: ${data.title || '코스'}`;
    } catch {
      return '코스 공유';
    }
  }

  return content;
};

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [toastQueue, setToastQueue] = useState<Notification[]>([]);
  const [currentToast, setCurrentToast] = useState<Notification | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeConversationIdRef = useRef<number | null>(null);
  const chatMessageUnsubRef = useRef<(() => void) | null>(null);
  const navigationCallbacksRef = useRef<NavigationCallbacks | null>(null);

  // Set navigation callbacks (called from HomeScreen or navigation container)
  const setNavigationCallbacks = useCallback((callbacks: NavigationCallbacks) => {
    navigationCallbacksRef.current = callbacks;
  }, []);

  // Play notification alert (vibration)
  const playNotificationAlert = () => {
    try {
      // Short vibration pattern for notification
      Vibration.vibrate([0, 100, 50, 100]);
    } catch (error) {
      console.log('Vibration not available:', error);
    }
  };

  // Initialize WebSocket connection
  useEffect(() => {
    const initializeSocket = async () => {
      const token = await AuthStorage.getToken();
      if (!token) return;

      // Extract base URL (remove /api if present)
      const baseUrl = API_URL.replace('/api', '');

      socketRef.current = io(baseUrl, {
        transports: ['websocket'],
        autoConnect: true,
      });

      socketRef.current.on('connect', () => {
        console.log('[WebSocket] Connected to notification server');
        setIsConnected(true);

        // Join notification room
        socketRef.current?.emit('join_notifications', { token });
      });

      socketRef.current.on('disconnect', () => {
        console.log('[WebSocket] Disconnected from notification server');
        setIsConnected(false);
      });

      socketRef.current.on('notifications_joined', (data: any) => {
        console.log('[WebSocket] Joined notifications room:', data);
      });

      socketRef.current.on('new_notification', (notification: Notification) => {
        console.log('[WebSocket] New notification received:', notification);

        // Add to notifications list
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);

        // Play alert (vibration)
        playNotificationAlert();

        // Show toast
        showToast(notification);
      });

      socketRef.current.on('error', (error: any) => {
        console.error('[WebSocket] Error:', error);
      });
    };

    initializeSocket();

    // Setup chat message listener for notifications
    const setupChatMessageListener = async () => {
      const token = await AuthStorage.getToken();
      if (!token) return;

      await userWebSocket.connect();

      chatMessageUnsubRef.current = userWebSocket.on('new_message', (data) => {
        // Only show notification if not currently viewing that conversation
        if (data.conversation_id !== activeConversationIdRef.current) {
          const formattedMessage = formatMessageForNotification(data.content);
          const chatNotification: Notification = {
            id: Date.now(),
            type: 'chat_message',
            title: data.sender_name || '새 메시지',
            message: formattedMessage.length > 50 ? formattedMessage.substring(0, 50) + '...' : formattedMessage,
            data: { conversation_id: data.conversation_id, sender_id: data.sender_id },
            is_read: false,
            created_at: new Date().toISOString(),
          };

          // Play alert
          playNotificationAlert();

          // Show toast
          showToast(chatNotification);
        }
      });
    };

    setupChatMessageListener();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (chatMessageUnsubRef.current) {
        chatMessageUnsubRef.current();
      }
    };
  }, []);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/notifications?limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, []);

  // Mark notifications as read
  const markAsRead = useCallback(async (notificationIds?: number[]) => {
    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/notifications/read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationIds ? { notification_ids: notificationIds } : {}),
      });

      const data = await response.json();
      if (data.success) {
        if (notificationIds) {
          setNotifications(prev =>
            prev.map(n =>
              notificationIds.includes(n.id) ? { ...n, is_read: true } : n
            )
          );
          setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
        } else {
          setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
          setUnreadCount(0);
        }
      }
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  }, []);

  // Show toast notification
  const showToast = useCallback((notification: Notification) => {
    setToastQueue(prev => [...prev, notification]);
  }, []);

  // Set active conversation ID (to suppress notifications when in chat room)
  const setActiveConversationId = useCallback((id: number | null) => {
    activeConversationIdRef.current = id;
  }, []);

  // Process toast queue
  useEffect(() => {
    if (!currentToast && toastQueue.length > 0) {
      setCurrentToast(toastQueue[0]);
      setToastQueue(prev => prev.slice(1));
    }
  }, [currentToast, toastQueue]);

  const handleToastDismiss = () => {
    setCurrentToast(null);
  };

  const handleToastPress = () => {
    if (!currentToast) return;

    const { type, data } = currentToast;
    const callbacks = navigationCallbacksRef.current;

    if (callbacks) {
      switch (type) {
        case 'chat_message':
          if (data?.conversation_id) {
            callbacks.navigateToChat(data.conversation_id);
          }
          break;
        case 'friend_request':
        case 'friend_accepted':
          callbacks.navigateToNotifications();
          break;
        case 'course_shared':
          callbacks.navigateToCourse(data?.course_id);
          break;
        default:
          callbacks.navigateToNotifications();
          break;
      }
    }

    setCurrentToast(null);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isConnected,
        fetchNotifications,
        markAsRead,
        showToast,
        setActiveConversationId,
        setNavigationCallbacks,
      }}
    >
      {children}
      {currentToast && (
        <NotificationToast
          notification={currentToast}
          onDismiss={handleToastDismiss}
          onPress={handleToastPress}
        />
      )}
    </NotificationContext.Provider>
  );
};
