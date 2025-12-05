import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BackIcon, ChatIcon, SearchIcon, UserIcon, PlusIcon } from '../components/svg';
import { FONTS } from '../constants/theme';
import { AuthStorage } from '../utils/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../utils/api';
import { userWebSocket, Conversation } from '../utils/userWebSocket';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface ChatListScreenProps {
  onBack: () => void;
  onOpenChat: (conversation: Conversation) => void;
}

interface SearchUser {
  user_id: string;
  user_name: string;
  user_email: string;
  is_friend: boolean;
  friendship_status: 'accepted' | 'pending' | 'sent_pending' | null;
}

const formatMessageTime = (dateString?: string) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return '어제';
  } else if (diffDays < 7) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[date.getDay()] + '요일';
  } else {
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  }
};

export const ChatListScreen: React.FC<ChatListScreenProps> = ({
  onBack,
  onOpenChat,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalUnread, setTotalUnread] = useState(0);

  // Friend search state
  const [activeTab, setActiveTab] = useState<'chat' | 'addFriend'>('chat');
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  const unsubscribeRefs = useRef<(() => void)[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    fetchConversations();
    setupWebSocket();

    return () => {
      // Cleanup WebSocket listeners using stored unsubscribe functions
      unsubscribeRefs.current.forEach(unsub => unsub());
      unsubscribeRefs.current = [];
    };
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = conversations.filter(conv =>
        conv.friend_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredConversations(filtered);
    } else {
      setFilteredConversations(conversations);
    }
  }, [searchQuery, conversations]);

  // Debounced friend search
  useEffect(() => {
    if (activeTab !== 'addFriend') return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (friendSearchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchFriends();
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [friendSearchQuery, activeTab]);

  const searchFriends = async () => {
    if (friendSearchQuery.trim().length < 2) return;

    setIsSearching(true);
    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(
        `${API_URL}/api/friends/search?query=${encodeURIComponent(friendSearchQuery.trim())}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setSearchResults(data.users || []);
      }
    } catch (error) {
      console.error('Failed to search friends:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (targetUserId: string) => {
    setSendingRequest(targetUserId);
    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/friends/request`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ friend_id: targetUserId }),
      });

      const data = await response.json();
      if (data.success) {
        // Update local state
        setSearchResults(prev =>
          prev.map(user =>
            user.user_id === targetUserId
              ? { ...user, friendship_status: 'sent_pending' }
              : user
          )
        );
        Alert.alert('알림', '친구 요청을 보냈습니다.');
      } else {
        Alert.alert('오류', data.error || '친구 요청에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to send friend request:', error);
      Alert.alert('오류', '친구 요청에 실패했습니다.');
    } finally {
      setSendingRequest(null);
    }
  };

  const startChatWithFriend = (user: SearchUser) => {
    // Create a conversation object for the friend
    const conversation: Conversation = {
      id: null, // Will be created when first message is sent
      friend_id: user.user_id,
      friend_name: user.user_name,
      friend_email: user.user_email,
      unread_count: 0,
    };
    onOpenChat(conversation);
  };

  const setupWebSocket = () => {
    userWebSocket.connect();

    const unsub1 = userWebSocket.on('new_message', (data) => {
      // Update conversation list when new message arrives
      setConversations(prev => {
        const index = prev.findIndex(c => c.id === data.conversation_id);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            last_message: data.content,
            last_message_time: data.created_at,
            unread_count: updated[index].unread_count + 1,
          };
          // Move to top
          const [conversation] = updated.splice(index, 1);
          return [conversation, ...updated];
        }
        return prev;
      });
      // Update total unread
      setTotalUnread(prev => prev + 1);
    });

    const unsub2 = userWebSocket.on('message_read', (data) => {
      // Update when other user reads our messages (update read status)
      setConversations(prev => {
        const index = prev.findIndex(c => c.id === data.conversation_id);
        if (index > -1) {
          const updated = [...prev];
          // Messages were read by other party
          return updated;
        }
        return prev;
      });
    });

    const unsub3 = userWebSocket.on('conversation_updated', (data) => {
      fetchConversations();
    });

    unsubscribeRefs.current = [unsub1, unsub2, unsub3];
  };

  // Clear unread count when opening a chat
  const handleOpenChat = (conversation: Conversation) => {
    if (conversation.id !== null && conversation.unread_count > 0) {
      setConversations(prev => {
        return prev.map(c => {
          if (c.id === conversation.id) {
            return { ...c, unread_count: 0 };
          }
          return c;
        });
      });
      setTotalUnread(prev => Math.max(0, prev - conversation.unread_count));
    }
    onOpenChat(conversation);
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

  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/chat/conversations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setConversations(data.conversations || []);
        setTotalUnread(data.total_unread || 0);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversations();
  }, []);

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0];
    }
    return name.substring(0, 2);
  };

  const formatMessagePreview = (content?: string): string => {
    if (!content) return '대화를 시작해보세요';

    // Parse split payment message
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

    // Parse course share message
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

  const renderConversationItem = (conversation: Conversation, index: number) => {
    const isLast = index === filteredConversations.length - 1;
    const itemKey = conversation.id !== null ? `conv-${conversation.id}` : `friend-${conversation.friend_id}`;

    return (
      <TouchableOpacity
        key={itemKey}
        style={[
          styles.conversationItem,
          isLast && styles.conversationItemLast,
        ]}
        onPress={() => handleOpenChat(conversation)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(conversation.friend_name)}</Text>
          </View>
          {conversation.unread_count > 0 && (
            <View style={styles.onlineIndicator} />
          )}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[
              styles.friendName,
              conversation.unread_count > 0 && styles.friendNameUnread
            ]}>
              {conversation.friend_name}
            </Text>
            <Text style={styles.messageTime}>
              {formatMessageTime(conversation.last_message_time)}
            </Text>
          </View>
          <View style={styles.messageRow}>
            <Text
              style={[
                styles.lastMessage,
                conversation.unread_count > 0 && styles.lastMessageUnread
              ]}
              numberOfLines={1}
            >
              {formatMessagePreview(conversation.last_message)}
            </Text>
            {conversation.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSearchResultItem = (user: SearchUser, index: number) => {
    const isLast = index === searchResults.length - 1;
    const isSending = sendingRequest === user.user_id;

    let actionButton = null;
    if (user.is_friend || user.friendship_status === 'accepted') {
      // Already friends - can start chat
      actionButton = (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => startChatWithFriend(user)}
          activeOpacity={0.7}
        >
          <ChatIcon width={16} height={16} color="#1A1A1A" />
          <Text style={styles.actionButtonText}>대화</Text>
        </TouchableOpacity>
      );
    } else if (user.friendship_status === 'sent_pending') {
      // Request already sent
      actionButton = (
        <View style={[styles.actionButton, styles.actionButtonDisabled]}>
          <Text style={styles.actionButtonTextDisabled}>요청됨</Text>
        </View>
      );
    } else if (user.friendship_status === 'pending') {
      // Received request - show pending
      actionButton = (
        <View style={[styles.actionButton, styles.actionButtonPending]}>
          <Text style={styles.actionButtonTextPending}>요청 받음</Text>
        </View>
      );
    } else {
      // Can send friend request
      actionButton = (
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={() => sendFriendRequest(user.user_id)}
          disabled={isSending}
          activeOpacity={0.7}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <PlusIcon width={12} height={12} color="#FFFFFF" />
              <Text style={styles.actionButtonTextPrimary}>친구 추가</Text>
            </>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <View
        key={user.user_id}
        style={[
          styles.searchResultItem,
          isLast && styles.searchResultItemLast,
        ]}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user.user_name)}</Text>
          </View>
        </View>

        <View style={styles.searchResultContent}>
          <Text style={styles.searchResultName}>{user.user_name}</Text>
          <Text style={styles.searchResultEmail}>{user.user_email}</Text>
        </View>

        {actionButton}
      </View>
    );
  };

  const displayedConversations = filteredConversations;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateX: slideAnim }] },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
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
          <Text style={styles.headerTitle}>채팅</Text>
          {totalUnread > 0 && activeTab === 'chat' && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
          onPress={() => setActiveTab('chat')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>
            대화
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'addFriend' && styles.tabActive]}
          onPress={() => setActiveTab('addFriend')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'addFriend' && styles.tabTextActive]}>
            친구 추가
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'chat' ? (
        <>
          {/* Search Bar for conversations */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <SearchIcon width={18} height={18} color="#999999" />
              <TextInput
                style={styles.searchInput}
                placeholder="친구 검색"
                placeholderTextColor="#999999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
          >
            {displayedConversations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                  <ChatIcon width={32} height={32} color="#CCCCCC" />
                </View>
                <Text style={styles.emptyTitle}>
                  {searchQuery ? '검색 결과가 없습니다' : '대화가 없습니다'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? '다른 검색어로 시도해보세요'
                    : '친구를 추가하고 대화를 시작해보세요'}
                </Text>
              </View>
            ) : (
              <View style={styles.conversationList}>
                {displayedConversations.map((conversation, index) =>
                  renderConversationItem(conversation, index)
                )}
              </View>
            )}
          </ScrollView>
        </>
      ) : (
        <>
          {/* Search Bar for adding friends */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <SearchIcon width={18} height={18} color="#999999" />
              <TextInput
                style={styles.searchInput}
                placeholder="이메일 또는 아이디로 검색"
                placeholderTextColor="#999999"
                value={friendSearchQuery}
                onChangeText={setFriendSearchQuery}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            showsVerticalScrollIndicator={false}
          >
            {isSearching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#1A1A1A" />
              </View>
            ) : friendSearchQuery.trim().length < 2 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                  <UserIcon width={32} height={32} color="#CCCCCC" />
                </View>
                <Text style={styles.emptyTitle}>친구 검색</Text>
                <Text style={styles.emptySubtitle}>
                  이메일 또는 아이디로 친구를 찾아보세요{'\n'}(2글자 이상 입력)
                </Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                  <SearchIcon width={32} height={32} color="#CCCCCC" />
                </View>
                <Text style={styles.emptyTitle}>검색 결과가 없습니다</Text>
                <Text style={styles.emptySubtitle}>
                  다른 검색어로 시도해보세요
                </Text>
              </View>
            ) : (
              <View style={styles.searchResultList}>
                {searchResults.map((user, index) =>
                  renderSearchResultItem(user, index)
                )}
              </View>
            )}
          </ScrollView>
        </>
      )}
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
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
    letterSpacing: -0.3,
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
  },
  headerRight: {
    width: 60,
    alignItems: 'flex-end',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1A1A1A',
  },
  tabText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#999999',
  },
  tabTextActive: {
    color: '#1A1A1A',
    fontFamily: FONTS.semiBold,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: '#1A1A1A',
    padding: 0,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  conversationList: {
    backgroundColor: '#FFFFFF',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    backgroundColor: '#FFFFFF',
  },
  conversationItemLast: {
    borderBottomWidth: 0,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#666666',
    textTransform: 'uppercase',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4AA63C',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  friendName: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: '#1A1A1A',
  },
  friendNameUnread: {
    fontFamily: FONTS.semiBold,
  },
  messageTime: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#AAAAAA',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#888888',
    marginRight: 8,
  },
  lastMessageUnread: {
    color: '#1A1A1A',
    fontFamily: FONTS.medium,
  },
  unreadBadge: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  searchResultList: {
    backgroundColor: '#FFFFFF',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    backgroundColor: '#FFFFFF',
  },
  searchResultItemLast: {
    borderBottomWidth: 0,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  searchResultEmail: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#888888',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    gap: 4,
  },
  actionButtonPrimary: {
    backgroundColor: '#1A1A1A',
  },
  actionButtonDisabled: {
    backgroundColor: '#F0F0F0',
  },
  actionButtonPending: {
    backgroundColor: '#FFF5E6',
  },
  actionButtonText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#1A1A1A',
  },
  actionButtonTextPrimary: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#FFFFFF',
  },
  actionButtonTextDisabled: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#AAAAAA',
  },
  actionButtonTextPending: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#F5A623',
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
    textAlign: 'center',
  },
});
