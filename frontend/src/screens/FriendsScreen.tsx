import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Animated,
  Alert,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, SearchIcon } from '../components/svg';
import { FONTS, COLORS } from '../constants/theme';
import { AuthStorage } from '../utils/auth';
import { API_URL } from '../utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Friend {
  user_id: string;
  user_name: string;
  user_email: string;
  is_friend?: boolean;
  friendship_status?: 'pending' | 'accepted' | 'sent_pending' | null;
}

interface FriendRequest {
  id: number;
  user_id: string;
  user_name: string;
  user_email: string;
  created_at: string;
}

interface FriendsScreenProps {
  onBack: () => void;
  onShareCourse?: (friendIds: string[]) => void;
  shareMode?: boolean;
  courseTitle?: string;
}

type TabType = 'friends' | 'requests' | 'search';

export const FriendsScreen: React.FC<FriendsScreenProps> = ({
  onBack,
  onShareCourse,
  shareMode = false,
  courseTitle,
}) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>(shareMode ? 'friends' : 'friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());

  // Animations
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const searchBarAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Item animations map
  const itemAnims = useRef<Map<string, Animated.Value>>(new Map()).current;

  const getItemAnim = (id: string) => {
    if (!itemAnims.has(id)) {
      itemAnims.set(id, new Animated.Value(0));
    }
    return itemAnims.get(id)!;
  };

  // Tab indicator animation
  useEffect(() => {
    const tabIndex = activeTab === 'friends' ? 0 : activeTab === 'requests' ? 1 : 2;
    Animated.spring(tabIndicatorAnim, {
      toValue: tabIndex * (SCREEN_WIDTH - 40) / 3,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [activeTab]);

  // Search bar animation
  useEffect(() => {
    if (activeTab === 'search') {
      Animated.timing(searchBarAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      searchBarAnim.setValue(0);
    }
  }, [activeTab]);

  // Fetch data on mount and tab change
  useEffect(() => {
    if (activeTab === 'friends') {
      fetchFriends();
    } else if (activeTab === 'requests') {
      fetchRequests();
    }
  }, [activeTab]);

  const animateItems = (items: any[], keyField: 'user_id' | 'id' = 'user_id') => {
    items.forEach((item, index) => {
      const key = keyField === 'id' ? String(item.id) : item.user_id;
      const anim = getItemAnim(key);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }).start();
    });
  };

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const token = await AuthStorage.getToken();
      const response = await fetch(`${API_URL}/api/friends`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setFriends(data.friends || []);
        animateItems(data.friends || []);
      }
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = await AuthStorage.getToken();
      const response = await fetch(`${API_URL}/api/friends/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setRequests(data.requests || []);
        animateItems(data.requests || [], 'id');
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setLoading(true);
      const token = await AuthStorage.getToken();
      const response = await fetch(`${API_URL}/api/friends/search?query=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.users || []);
        animateItems(data.users || []);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (friendId: string) => {
    try {
      const token = await AuthStorage.getToken();
      const response = await fetch(`${API_URL}/api/friends/request`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ friend_id: friendId }),
      });
      const data = await response.json();
      if (data.success) {
        // Update search results to show pending status
        setSearchResults(prev =>
          prev.map(u =>
            u.user_id === friendId ? { ...u, friendship_status: 'sent_pending' } : u
          )
        );
        Alert.alert('성공', '친구 요청을 보냈습니다');
      } else {
        Alert.alert('오류', data.error || '친구 요청에 실패했습니다');
      }
    } catch (error) {
      Alert.alert('오류', '친구 요청에 실패했습니다');
    }
  };

  const acceptRequest = async (requestId: number, userId: string) => {
    try {
      const token = await AuthStorage.getToken();
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
        // Animate removal
        const anim = getItemAnim(String(requestId));
        Animated.timing(anim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setRequests(prev => prev.filter(r => r.id !== requestId));
        });
        Alert.alert('성공', '친구 요청을 수락했습니다');
      }
    } catch (error) {
      Alert.alert('오류', '요청 처리에 실패했습니다');
    }
  };

  const rejectRequest = async (requestId: number) => {
    try {
      const token = await AuthStorage.getToken();
      const response = await fetch(`${API_URL}/api/friends/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ request_id: requestId }),
      });
      const data = await response.json();
      if (data.success) {
        const anim = getItemAnim(String(requestId));
        Animated.timing(anim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setRequests(prev => prev.filter(r => r.id !== requestId));
        });
      }
    } catch (error) {
      Alert.alert('오류', '요청 처리에 실패했습니다');
    }
  };

  const deleteFriend = async (friendId: string) => {
    Alert.alert(
      '친구 삭제',
      '정말 이 친구를 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AuthStorage.getToken();
              const response = await fetch(`${API_URL}/api/friends/${friendId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              const data = await response.json();
              if (data.success) {
                const anim = getItemAnim(friendId);
                Animated.timing(anim, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }).start(() => {
                  setFriends(prev => prev.filter(f => f.user_id !== friendId));
                });
              }
            } catch (error) {
              Alert.alert('오류', '친구 삭제에 실패했습니다');
            }
          },
        },
      ]
    );
  };

  const blockUser = async (userId: string) => {
    Alert.alert(
      '사용자 차단',
      '이 사용자를 차단하시겠습니까? 차단된 사용자는 회원님을 검색하거나 친구 요청을 보낼 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '차단',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AuthStorage.getToken();
              const response = await fetch(`${API_URL}/api/friends/block`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ user_id: userId }),
              });
              const data = await response.json();
              if (data.success) {
                setFriends(prev => prev.filter(f => f.user_id !== userId));
                setSearchResults(prev => prev.filter(u => u.user_id !== userId));
                Alert.alert('완료', '사용자를 차단했습니다');
              }
            } catch (error) {
              Alert.alert('오류', '차단에 실패했습니다');
            }
          },
        },
      ]
    );
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev => {
      const newSet = new Set(prev);
      if (newSet.has(friendId)) {
        newSet.delete(friendId);
      } else {
        newSet.add(friendId);
      }
      return newSet;
    });
  };

  const handleShareCourse = () => {
    if (selectedFriends.size === 0) {
      Alert.alert('알림', '공유할 친구를 선택해주세요');
      return;
    }
    onShareCourse?.(Array.from(selectedFriends));
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (activeTab === 'friends') {
      fetchFriends();
    } else if (activeTab === 'requests') {
      fetchRequests();
    }
  }, [activeTab]);

  const renderFriendItem = ({ item, index }: { item: Friend; index: number }) => {
    const anim = getItemAnim(item.user_id);
    const isSelected = selectedFriends.has(item.user_id);

    return (
      <Animated.View
        style={[
          styles.friendItem,
          {
            opacity: anim,
            transform: [
              {
                translateX: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.friendItemContent,
            shareMode && isSelected && styles.friendItemSelected,
          ]}
          onPress={() => shareMode ? toggleFriendSelection(item.user_id) : null}
          onLongPress={() => !shareMode && deleteFriend(item.user_id)}
          activeOpacity={shareMode ? 0.7 : 1}
        >
          <View style={[styles.avatar, shareMode && isSelected && styles.avatarSelected]}>
            <Text style={styles.avatarText}>
              {item.user_name?.charAt(0) || item.user_id?.charAt(0) || '?'}
            </Text>
          </View>
          <View style={styles.friendInfo}>
            <Text style={styles.friendName}>{item.user_name}</Text>
            <Text style={styles.friendEmail}>{item.user_email}</Text>
          </View>
          {shareMode ? (
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => {
                Alert.alert(
                  item.user_name,
                  '',
                  [
                    { text: '취소', style: 'cancel' },
                    { text: '친구 삭제', style: 'destructive', onPress: () => deleteFriend(item.user_id) },
                    { text: '차단하기', style: 'destructive', onPress: () => blockUser(item.user_id) },
                  ]
                );
              }}
            >
              <Text style={styles.moreButtonText}>···</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderRequestItem = ({ item }: { item: FriendRequest }) => {
    const anim = getItemAnim(String(item.id));

    return (
      <Animated.View
        style={[
          styles.requestItem,
          {
            opacity: anim,
            transform: [{ scale: anim }],
          },
        ]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.user_name?.charAt(0) || '?'}
          </Text>
        </View>
        <View style={styles.requestInfo}>
          <Text style={styles.friendName}>{item.user_name}</Text>
          <Text style={styles.friendEmail}>{item.user_email}</Text>
        </View>
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => acceptRequest(item.id, item.user_id)}
            activeOpacity={0.7}
          >
            <Text style={styles.acceptButtonText}>수락</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => rejectRequest(item.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.rejectButtonText}>거절</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderSearchItem = ({ item }: { item: Friend }) => {
    const anim = getItemAnim(item.user_id);

    const getStatusButton = () => {
      if (item.is_friend || item.friendship_status === 'accepted') {
        return (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>친구</Text>
          </View>
        );
      }
      if (item.friendship_status === 'sent_pending') {
        return (
          <View style={[styles.statusBadge, styles.statusBadgePending]}>
            <Text style={styles.statusBadgeTextPending}>요청됨</Text>
          </View>
        );
      }
      if (item.friendship_status === 'pending') {
        return (
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => {/* Handle accept from search */}}
          >
            <Text style={styles.acceptButtonText}>수락</Text>
          </TouchableOpacity>
        );
      }
      return (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => sendFriendRequest(item.user_id)}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>추가</Text>
        </TouchableOpacity>
      );
    };

    return (
      <Animated.View
        style={[
          styles.friendItem,
          {
            opacity: anim,
            transform: [
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.friendItemContent}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.user_name?.charAt(0) || item.user_id?.charAt(0) || '?'}
            </Text>
          </View>
          <View style={styles.friendInfo}>
            <Text style={styles.friendName}>{item.user_name}</Text>
            <Text style={styles.friendEmail}>{item.user_email}</Text>
          </View>
          {getStatusButton()}
        </View>
      </Animated.View>
    );
  };

  const renderEmptyState = (type: TabType) => {
    const messages = {
      friends: { title: '아직 친구가 없습니다', subtitle: '친구를 검색해서 추가해보세요' },
      requests: { title: '받은 요청이 없습니다', subtitle: '친구 요청을 기다려보세요' },
      search: { title: '검색 결과가 없습니다', subtitle: '이메일 또는 아이디로 검색해보세요' },
    };
    const msg = messages[type];

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateTitle}>{msg.title}</Text>
        <Text style={styles.emptyStateSubtitle}>{msg.subtitle}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <BackIcon width={24} height={24} color="#212121" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {shareMode ? '친구에게 공유' : '친구'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {shareMode && courseTitle && (
        <View style={styles.shareInfo}>
          <Text style={styles.shareInfoText}>"{courseTitle}" 코스를 공유합니다</Text>
        </View>
      )}

      {/* Tabs */}
      {!shareMode && (
        <View style={styles.tabContainer}>
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                transform: [{ translateX: tabIndicatorAnim }],
              },
            ]}
          />
          {(['friends', 'requests', 'search'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'friends' ? '친구 목록' : tab === 'requests' ? '받은 요청' : '검색'}
              </Text>
              {tab === 'requests' && requests.length > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{requests.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search Bar */}
      {(activeTab === 'search' || shareMode) && (
        <Animated.View
          style={[
            styles.searchContainer,
            !shareMode && {
              opacity: searchBarAnim,
              transform: [
                {
                  translateY: searchBarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.searchBar}>
            <SearchIcon width={20} height={20} color="#999999" />
            <TextInput
              style={styles.searchInput}
              placeholder={shareMode ? "친구 검색..." : "이메일 또는 아이디로 검색"}
              placeholderTextColor="#999999"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (!shareMode) {
                  searchUsers(text);
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => {
                if (!shareMode) {
                  searchUsers(searchQuery);
                }
                Keyboard.dismiss();
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              >
                <Text style={styles.clearButton}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#393A39" />
        </View>
      ) : (
        <>
          {activeTab === 'friends' && (
            <FlatList
              data={shareMode && searchQuery ? friends.filter(f =>
                f.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.user_email.toLowerCase().includes(searchQuery.toLowerCase())
              ) : friends}
              keyExtractor={(item) => item.user_id}
              renderItem={renderFriendItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => renderEmptyState('friends')}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#393A39" />
              }
            />
          )}

          {activeTab === 'requests' && (
            <FlatList
              data={requests}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderRequestItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => renderEmptyState('requests')}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#393A39" />
              }
            />
          )}

          {activeTab === 'search' && (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.user_id}
              renderItem={renderSearchItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => searchQuery.length >= 2 ? renderEmptyState('search') : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateSubtitle}>2글자 이상 입력해주세요</Text>
                </View>
              )}
            />
          )}
        </>
      )}

      {/* Share Button (Share Mode) */}
      {shareMode && (
        <View style={[styles.shareButtonContainer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[
              styles.shareButton,
              selectedFriends.size === 0 && styles.shareButtonDisabled,
            ]}
            onPress={handleShareCourse}
            disabled={selectedFriends.size === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.shareButtonText}>
              {selectedFriends.size > 0
                ? `${selectedFriends.size}명에게 공유하기`
                : '친구를 선택해주세요'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: '#212121',
  },
  headerRight: {
    width: 40,
  },
  shareInfo: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  shareInfoText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#666666',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    width: (SCREEN_WIDTH - 40 - 8) / 3,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    top: 4,
    left: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  tabText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: '#999999',
  },
  tabTextActive: {
    color: '#212121',
  },
  badgeContainer: {
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: '#212121',
  },
  clearButton: {
    fontSize: 16,
    color: '#999999',
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  friendItem: {
    marginBottom: 12,
  },
  friendItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 16,
  },
  friendItemSelected: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected: {
    backgroundColor: '#4CAF50',
  },
  avatarText: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: '#666666',
  },
  friendInfo: {
    flex: 1,
    marginLeft: 14,
  },
  requestInfo: {
    flex: 1,
    marginLeft: 14,
  },
  friendName: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#212121',
    marginBottom: 2,
  },
  friendEmail: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  moreButton: {
    padding: 8,
  },
  moreButtonText: {
    fontSize: 18,
    color: '#999999',
    fontFamily: FONTS.bold,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#212121',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  rejectButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rejectButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#666666',
  },
  addButton: {
    backgroundColor: '#212121',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  statusBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#4CAF50',
  },
  statusBadgePending: {
    backgroundColor: '#FFF8E7',
  },
  statusBadgeTextPending: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#FF9800',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: '#212121',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#999999',
  },
  shareButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  shareButton: {
    backgroundColor: '#212121',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  shareButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  shareButtonText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
});
