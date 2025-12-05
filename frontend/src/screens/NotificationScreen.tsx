import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BackIcon, UserIcon, BellIcon, StarIcon, CourseIcon, CheckCircleIcon } from '../components/svg';
import { FONTS } from '../constants/theme';
import { AuthStorage } from '../utils/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../utils/api';
import { userWebSocket } from '../utils/userWebSocket';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

interface NotificationScreenProps {
  onBack: () => void;
  onAcceptFriendRequest?: (requestId: number) => void;
  onNavigateToCard?: (cardName: string) => void;
}

// Notification type icons - dark minimal style
const getNotificationIconType = (type: string) => {
  switch (type) {
    case 'payment':
      return 'payment';
    case 'friend_request':
    case 'friend_accepted':
      return 'friend';
    case 'benefit_tip':
      return 'benefit';
    case 'course_shared':
      return 'course';
    default:
      return 'default';
  }
};

const renderNotificationIcon = (type: string) => {
  const iconType = getNotificationIconType(type);
  switch (iconType) {
    case 'payment':
      return <Text style={{ fontSize: 14, fontFamily: FONTS.bold, color: '#4AA63C' }}>W</Text>;
    case 'friend':
      return <UserIcon width={18} height={18} color="#666666" />;
    case 'benefit':
      return <StarIcon width={18} height={18} color="#FF6600" filled />;
    case 'course':
      return <CourseIcon width={18} height={18} color="#666666" />;
    default:
      return <BellIcon width={18} height={18} color="#666666" />;
  }
};

// Format relative time
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString('ko-KR');
};

export const NotificationScreen: React.FC<NotificationScreenProps> = ({
  onBack,
  onAcceptFriendRequest,
  onNavigateToCard,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptedRequests, setAcceptedRequests] = useState<Set<number>>(new Set());
  const [acceptingRequests, setAcceptingRequests] = useState<Set<number>>(new Set());
  const unsubscribeRefs = useRef<(() => void)[]>([]);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    fetchNotifications();
    setupWebSocket();

    return () => {
      // Cleanup using stored unsubscribe functions
      unsubscribeRefs.current.forEach(unsub => unsub());
      unsubscribeRefs.current = [];
    };
  }, []);

  const setupWebSocket = () => {
    userWebSocket.connect();

    // Listen for when a friend request is accepted (for both sender and receiver)
    const unsub1 = userWebSocket.on('friend_request_accepted', (data) => {
      if (data.request_id) {
        setAcceptedRequests(prev => new Set(prev).add(data.request_id));
      }
      // Refresh notifications to show updated state
      fetchNotifications();
    });

    // Listen for new friend requests
    const unsub2 = userWebSocket.on('friend_request_received', () => {
      fetchNotifications();
    });

    unsubscribeRefs.current = [unsub1, unsub2];
  };

  const handleBack = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onBack();
    });
  };

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/notifications/read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (data.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      try {
        const token = await AuthStorage.getToken();
        if (token) {
          await fetch(`${API_URL}/api/notifications/read`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ notification_ids: [notification.id] }),
          });
          setNotifications(prev =>
            prev.map(n =>
              n.id === notification.id ? { ...n, is_read: true } : n
            )
          );
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Handle action based on type
    if (notification.type === 'friend_request' && notification.data?.request_id) {
      Alert.alert(
        '친구 요청',
        notification.message,
        [
          { text: '나중에', style: 'cancel' },
          {
            text: '수락하기',
            onPress: () => handleAcceptFriendRequest(notification.data.request_id),
          },
        ]
      );
    } else if (notification.type === 'benefit_tip' && notification.data?.card_name) {
      if (onNavigateToCard) {
        onNavigateToCard(notification.data.card_name);
      }
    }
  };

  const handleAcceptFriendRequest = async (requestId: number) => {
    // Prevent double submission
    if (acceptingRequests.has(requestId) || acceptedRequests.has(requestId)) return;

    setAcceptingRequests(prev => new Set(prev).add(requestId));

    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/friends/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ request_id: requestId }),
      });

      const data = await response.json();
      if (data.success) {
        // Mark as accepted locally
        setAcceptedRequests(prev => new Set(prev).add(requestId));

        if (onAcceptFriendRequest) {
          onAcceptFriendRequest(requestId);
        }

        // Emit WebSocket event to notify the other user
        userWebSocket.emit('friend_request_accepted', { request_id: requestId });
      } else {
        Alert.alert('오류', data.error || '친구 요청 수락에 실패했습니다');
      }
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      Alert.alert('오류', '네트워크 오류가 발생했습니다');
    } finally {
      setAcceptingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const renderNotificationItem = (notification: Notification, index: number) => {
    const isLast = index === notifications.length - 1;

    return (
      <TouchableOpacity
        key={notification.id}
        style={[
          styles.notificationItem,
          !notification.is_read && styles.notificationItemUnread,
          isLast && styles.notificationItemLast,
        ]}
        onPress={() => handleNotificationPress(notification)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationIcon}>
          {renderNotificationIcon(notification.type)}
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <View style={styles.notificationTitleRow}>
              {!notification.is_read && <View style={styles.unreadDot} />}
              <Text style={[
                styles.notificationTitle,
                !notification.is_read && styles.notificationTitleUnread
              ]}>
                {notification.title}
              </Text>
            </View>
            <Text style={styles.notificationTime}>
              {formatRelativeTime(notification.created_at)}
            </Text>
          </View>
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {notification.message}
          </Text>
          {notification.type === 'friend_request' && notification.data?.request_id && (
            (() => {
              const requestId = notification.data.request_id;
              const isAccepted = acceptedRequests.has(requestId);
              const isAccepting = acceptingRequests.has(requestId);

              if (isAccepted) {
                return (
                  <View style={styles.acceptedButton}>
                    <CheckCircleIcon width={14} height={14} color="#4AA63C" />
                    <Text style={styles.acceptedButtonText}>수락됨</Text>
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  style={[styles.actionButton, isAccepting && styles.actionButtonDisabled]}
                  onPress={() => handleAcceptFriendRequest(requestId)}
                  disabled={isAccepting}
                  activeOpacity={0.7}
                >
                  {isAccepting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionButtonText}>수락</Text>
                  )}
                </TouchableOpacity>
              );
            })()
          )}
          {notification.type === 'benefit_tip' && notification.data?.card_name && (
            <TouchableOpacity
              style={styles.actionButtonSecondary}
              onPress={() => onNavigateToCard?.(notification.data.card_name)}
            >
              <Text style={styles.actionButtonSecondaryText}>확인하기</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateX: slideAnim }] },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BackIcon width={10} height={18} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>알림</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} activeOpacity={0.7}>
              <Text style={styles.markAllReadText}>전체 읽음</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchNotifications();
            }}
          />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <BellIcon width={32} height={32} color="#CCCCCC" />
            </View>
            <Text style={styles.emptyTitle}>알림이 없습니다</Text>
            <Text style={styles.emptySubtitle}>
              새로운 알림이 오면 여기에 표시됩니다
            </Text>
          </View>
        ) : (
          <View style={styles.notificationList}>
            {notifications.map((notification, index) =>
              renderNotificationItem(notification, index)
            )}
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 60,
    bottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  headerBadge: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  headerBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  headerLeft: {
    width: 60,
    alignItems: 'flex-start',
    zIndex: 1,
  },
  headerRight: {
    width: 60,
    alignItems: 'flex-end',
    zIndex: 1,
  },
  markAllReadText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  scrollView: {
    flex: 1,
  },
  notificationList: {
    backgroundColor: '#FFFFFF',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    backgroundColor: '#FFFFFF',
  },
  notificationItemUnread: {
    backgroundColor: '#FAFAFA',
  },
  notificationItemLast: {
    borderBottomWidth: 0,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  notificationTitle: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  notificationTitleUnread: {
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
  },
  notificationTime: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#AAAAAA',
  },
  notificationMessage: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#888888',
    lineHeight: 20,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6600',
    marginRight: 8,
  },
  actionButton: {
    marginTop: 12,
    backgroundColor: '#1A1A1A',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
    minWidth: 60,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#666666',
  },
  actionButtonText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  acceptedButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  acceptedButtonText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#4AA63C',
  },
  actionButtonSecondary: {
    marginTop: 12,
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  actionButtonSecondaryText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#1A1A1A',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
});
