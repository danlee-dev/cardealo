import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { BackIcon, SendIcon, UserIcon, PlusIcon, CourseIcon, ReceiptIcon, CloseIcon } from '../components/svg';
import { FONTS } from '../constants/theme';
import { AuthStorage } from '../utils/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../utils/api';
import { userWebSocket, ChatMessage, Conversation } from '../utils/userWebSocket';
import { useNotifications } from '../contexts/NotificationContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.72;

interface SharedCourse {
  id: string;
  title: string;
  description: string;
}

interface ChatRoomScreenProps {
  conversation: Conversation;
  onBack: () => void;
  onViewCourse?: (course: SharedCourse) => void;
}

interface MessageGroup {
  date: string;
  messages: ChatMessage[];
}

const formatMessageTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

const formatDateHeader = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) {
    return '오늘';
  } else if (diffDays === 1) {
    return '어제';
  } else {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  }
};

const getDateKey = (dateString: string) => {
  const date = new Date(dateString);
  return date.toDateString();
};

export const ChatRoomScreen: React.FC<ChatRoomScreenProps> = ({
  conversation,
  onBack,
  onViewCourse,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const { setActiveConversationId } = useNotifications();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageGroups, setMessageGroups] = useState<MessageGroup[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [currentUserId, setCurrentUserId] = useState<string | number | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(conversation.id);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showSplitPaymentModal, setShowSplitPaymentModal] = useState(false);
  const [splitPaymentAmount, setSplitPaymentAmount] = useState('');
  const [showCourseShareModal, setShowCourseShareModal] = useState(false);
  const [savedCourses, setSavedCourses] = useState<Array<{ id: string; title: string; description: string; }>>([]);
  const [loadingSavedCourses, setLoadingSavedCourses] = useState(false);
  const [virtualBalance, setVirtualBalance] = useState(100000); // 가상 잔액 10만원
  const [pendingPayments, setPendingPayments] = useState<Map<number, { amount: number; status: 'pending' | 'completed' | 'cancelled' }>>(new Map());
  const attachmentMenuAnim = useRef(new Animated.Value(0)).current;
  const conversationIdRef = useRef<number | null>(conversation.id);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const unsubscribeRefs = useRef<(() => void)[]>([]);

  // Keep ref in sync with state and update notification context
  useEffect(() => {
    conversationIdRef.current = conversationId;
    // Tell notification context we're viewing this conversation (suppress notifications)
    setActiveConversationId(conversationId);
  }, [conversationId, setActiveConversationId]);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    getCurrentUser();

    // Ensure WebSocket is connected first
    userWebSocket.connect().then(() => {
      if (conversationId !== null) {
        fetchMessages();
        setupWebSocket();
      } else {
        setIsLoading(false);
        setHasMore(false);
        // Still set up listeners for when conversation is created
        setupWebSocket();
      }
    });

    return () => {
      if (conversationIdRef.current !== null) {
        userWebSocket.leaveConversation(conversationIdRef.current);
      }
      // Cleanup using stored unsubscribe functions
      unsubscribeRefs.current.forEach(unsub => unsub());
      unsubscribeRefs.current = [];
      // Clear active conversation so notifications can show again
      setActiveConversationId(null);
    };
  }, [setActiveConversationId]);

  useEffect(() => {
    // Sort messages by timestamp first
    const sortedMessages = [...messages].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Group messages by date
    const groups: MessageGroup[] = [];
    let currentDate = '';
    let currentGroup: ChatMessage[] = [];

    sortedMessages.forEach((message) => {
      const dateKey = getDateKey(message.created_at);
      if (dateKey !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup });
        }
        currentDate = dateKey;
        currentGroup = [message];
      } else {
        currentGroup.push(message);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup });
    }

    setMessageGroups(groups);
  }, [messages]);

  const getCurrentUser = async () => {
    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setCurrentUserId(data.user.id);
      }
    } catch (error) {
      console.error('Failed to get current user:', error);
    }
  };

  const setupWebSocket = (convId?: number | null) => {
    const activeConvId = convId ?? conversationId;

    // Join conversation room if we have an ID
    if (activeConvId !== null) {
      userWebSocket.joinConversation(activeConvId);
    }

    const unsub1 = userWebSocket.on('new_message', (data) => {
      // Use ref to get current conversation ID (handles dynamic ID for new conversations)
      const currentConvId = conversationIdRef.current;
      if (currentConvId !== null && data.conversation_id === currentConvId) {
        // Check if this is a split payment completion message
        if (data.content.startsWith('__SPLIT_PAYMENT__')) {
          try {
            const paymentData = JSON.parse(data.content.replace('__SPLIT_PAYMENT__', ''));
            if (paymentData.status === 'completed' && paymentData.paymentId) {
              // Update existing pending payment message to completed
              setMessages(prev => prev.map(msg => {
                if (msg.content.startsWith('__SPLIT_PAYMENT__') &&
                    msg.content.includes(`"paymentId":${paymentData.paymentId}`) &&
                    msg.content.includes('"status":"pending"')) {
                  const existingData = JSON.parse(msg.content.replace('__SPLIT_PAYMENT__', ''));
                  const updatedData = { ...existingData, status: 'completed', completedAt: paymentData.completedAt };
                  return { ...msg, content: `__SPLIT_PAYMENT__${JSON.stringify(updatedData)}` };
                }
                return msg;
              }));
              // Don't add duplicate completion message, just update the original
              return;
            }
          } catch (e) {
            // Not a valid payment message, proceed normally
          }
        }

        const newMessage: ChatMessage = {
          id: data.id,
          conversation_id: data.conversation_id,
          sender_id: data.sender_id,
          content: data.content,
          created_at: data.created_at,
          is_read: false,
          sender_name: data.sender_name,
        };

        setMessages(prev => [...prev, newMessage]);

        // Auto scroll to bottom
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);

        // Mark as read if from other user
        if (data.sender_id !== currentUserId) {
          userWebSocket.markMessagesRead(currentConvId);
        }
      }
    });

    const unsub2 = userWebSocket.on('message_read', (data) => {
      const currentConvId = conversationIdRef.current;
      if (currentConvId !== null && data.conversation_id === currentConvId) {
        setMessages(prev =>
          prev.map(m => ({ ...m, is_read: true }))
        );
      }
    });

    const unsub3 = userWebSocket.on('typing', (data) => {
      const currentConvId = conversationIdRef.current;
      if (currentConvId !== null && data.conversation_id === currentConvId && data.user_id !== currentUserId) {
        setIsTyping(data.is_typing);
      }
    });

    unsubscribeRefs.current = [unsub1, unsub2, unsub3];
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

  const fetchMessages = async (pageNum = 1, convId?: number | null) => {
    const activeConvId = convId ?? conversationId;
    if (activeConvId === null) {
      setIsLoading(false);
      return;
    }

    try {
      if (pageNum === 1) setIsLoading(true);

      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(
        `${API_URL}/api/chat/messages/${activeConvId}?page=${pageNum}&limit=30`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();
      if (data.success) {
        const newMessages = data.messages || [];

        if (pageNum === 1) {
          setMessages(newMessages.reverse());
          // Scroll to bottom after initial load
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: false });
          }, 100);
        } else {
          setMessages(prev => [...newMessages.reverse(), ...prev]);
        }

        setHasMore(data.has_more);
        setPage(pageNum);

        // Mark messages as read
        if (newMessages.length > 0) {
          userWebSocket.markMessagesRead(activeConvId);
        }
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreMessages = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchMessages(page + 1);
    }
  }, [isLoading, hasMore, page]);

  const handleSendMessage = async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText || isSending) return;

    setIsSending(true);
    setInputText('');

    // Optimistic update
    const tempId = Date.now();
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversation_id: conversationId || 0,
      sender_id: currentUserId || 0,
      content: trimmedText,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    setMessages(prev => [...prev, optimisticMessage]);

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      let activeConvId = conversationId;

      // If no conversation exists, start a new one
      if (activeConvId === null) {
        const startResponse = await fetch(`${API_URL}/api/chat/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            friend_id: conversation.friend_id,
          }),
        });

        const startData = await startResponse.json();
        if (startData.success && startData.conversation) {
          activeConvId = startData.conversation.id;
          setConversationId(activeConvId);
          // Setup WebSocket for the new conversation
          setupWebSocket(activeConvId);
        } else {
          // Remove optimistic message on failure
          setMessages(prev => prev.filter(m => m.id !== tempId));
          setIsSending(false);
          return;
        }
      }

      const response = await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: activeConvId,
          content: trimmedText,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Replace optimistic message with real one
        setMessages(prev =>
          prev.map(m =>
            m.id === tempId
              ? { ...m, id: data.message.id, conversation_id: activeConvId!, created_at: data.message.created_at }
              : m
          )
        );
      } else {
        // Remove optimistic message on failure
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);

    // Only send typing indicator if conversation exists
    if (conversationId === null) return;

    // Send typing indicator (throttled)
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      userWebSocket.sendTyping(conversationId, true);
      lastTypingSentRef.current = now;
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      if (conversationId !== null) {
        userWebSocket.sendTyping(conversationId, false);
      }
    }, 3000);
  };

  const toggleAttachmentMenu = () => {
    const toValue = showAttachmentMenu ? 0 : 1;
    setShowAttachmentMenu(!showAttachmentMenu);
    Animated.spring(attachmentMenuAnim, {
      toValue,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  };

  const fetchSavedCourses = async () => {
    setLoadingSavedCourses(true);
    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/course/saved`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success && data.courses) {
        setSavedCourses(data.courses);
      }
    } catch (error) {
      console.error('Failed to fetch saved courses:', error);
    } finally {
      setLoadingSavedCourses(false);
    }
  };

  const handleShareCourse = () => {
    setShowAttachmentMenu(false);
    Animated.timing(attachmentMenuAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
    fetchSavedCourses();
    setShowCourseShareModal(true);
  };

  const handleSendCourseShare = async (course: { id: string; title: string; description: string }) => {
    const courseShareData = {
      type: 'course_share',
      courseId: course.id,
      title: course.title,
      description: course.description,
    };

    const courseMessage = `__COURSE_SHARE__${JSON.stringify(courseShareData)}`;
    setShowCourseShareModal(false);
    await sendSpecialMessage(courseMessage);
  };

  const sendSpecialMessage = async (content: string) => {
    if (isSending) return;
    setIsSending(true);

    const tempId = Date.now();
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversation_id: conversationId || 0,
      sender_id: currentUserId || 0,
      content: content,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      const token = await AuthStorage.getToken();
      if (!token) return;

      let activeConvId = conversationId;

      if (activeConvId === null) {
        const startResponse = await fetch(`${API_URL}/api/chat/start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ friend_id: conversation.friend_id }),
        });

        const startData = await startResponse.json();
        if (startData.success && startData.conversation) {
          activeConvId = startData.conversation.id;
          setConversationId(activeConvId);
          setupWebSocket(activeConvId);
        } else {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          setIsSending(false);
          return;
        }
      }

      const response = await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: activeConvId,
          content: content,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setMessages(prev =>
          prev.map(m =>
            m.id === tempId
              ? { ...m, id: data.message.id, conversation_id: activeConvId!, created_at: data.message.created_at }
              : m
          )
        );
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } catch (error) {
      console.error('Failed to send special message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  const handleSplitPayment = () => {
    setShowAttachmentMenu(false);
    Animated.timing(attachmentMenuAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
    setShowSplitPaymentModal(true);
  };

  const handleSendSplitPayment = async () => {
    const amount = parseInt(splitPaymentAmount.replace(/,/g, ''), 10);
    if (isNaN(amount) || amount <= 0) return;

    // Create special JSON format for split payment card
    const paymentId = Date.now();
    const splitPaymentData = {
      type: 'split_payment',
      paymentId,
      amount,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    const splitMessage = `__SPLIT_PAYMENT__${JSON.stringify(splitPaymentData)}`;

    // Track pending payment
    setPendingPayments(prev => new Map(prev).set(paymentId, { amount, status: 'pending' }));

    setSplitPaymentAmount('');
    setShowSplitPaymentModal(false);
    await sendSpecialMessage(splitMessage);
  };

  const handleCompleteSplitPayment = async (messageId: number, paymentId: number, amount: number) => {
    if (virtualBalance < amount) {
      // Not enough balance
      return;
    }

    // Deduct from virtual balance
    setVirtualBalance(prev => prev - amount);

    // Update payment status in local state
    setPendingPayments(prev => {
      const newMap = new Map(prev);
      newMap.set(paymentId, { amount, status: 'completed' });
      return newMap;
    });

    // Update the message content to mark as completed
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId && msg.content.includes(`"paymentId":${paymentId}`)) {
        const data = parseSplitPaymentMessage(msg.content);
        if (data) {
          const updatedData = { ...data, status: 'completed', completedAt: new Date().toISOString() };
          return { ...msg, content: `__SPLIT_PAYMENT__${JSON.stringify(updatedData)}` };
        }
      }
      return msg;
    }));

    // Send completion message so the requester gets notified via WebSocket
    const completionData = {
      type: 'split_payment',
      paymentId,
      amount,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };
    await sendSpecialMessage(`__SPLIT_PAYMENT__${JSON.stringify(completionData)}`);
  };

  const parseSplitPaymentMessage = (content: string): { type: string; paymentId: number; amount: number; status: string; requestedAt: string; completedAt?: string } | null => {
    if (!content.startsWith('__SPLIT_PAYMENT__')) return null;
    try {
      return JSON.parse(content.replace('__SPLIT_PAYMENT__', ''));
    } catch {
      return null;
    }
  };

  const parseCourseShareMessage = (content: string): { type: string; courseId: string; title: string; description: string } | null => {
    if (!content.startsWith('__COURSE_SHARE__')) return null;
    try {
      return JSON.parse(content.replace('__COURSE_SHARE__', ''));
    } catch {
      return null;
    }
  };

  const formatAmountInput = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    if (numericValue === '') {
      setSplitPaymentAmount('');
      return;
    }
    const formatted = parseInt(numericValue, 10).toLocaleString('ko-KR');
    setSplitPaymentAmount(formatted);
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0];
    }
    return name.substring(0, 2);
  };

  const shouldShowTime = (message: ChatMessage, index: number, groupMessages: ChatMessage[]) => {
    // Always show time for last message
    if (index === groupMessages.length - 1) return true;

    // Show time if next message is from different sender
    const nextMessage = groupMessages[index + 1];
    if (nextMessage && nextMessage.sender_id !== message.sender_id) return true;

    // Show time if more than 5 minutes gap
    if (nextMessage) {
      const currentTime = new Date(message.created_at).getTime();
      const nextTime = new Date(nextMessage.created_at).getTime();
      if (nextTime - currentTime > 5 * 60 * 1000) return true;
    }

    return false;
  };

  const renderSplitPaymentCard = (message: ChatMessage, data: { paymentId: number; amount: number; status: string; completedAt?: string }, isMine: boolean) => {
    const isCompleted = data.status === 'completed';
    const canPay = !isMine && !isCompleted;

    return (
      <View style={styles.splitPaymentCard}>
        <View style={styles.splitPaymentCardHeader}>
          <ReceiptIcon width={20} height={20} color="#1A1A1A" />
          <Text style={styles.splitPaymentCardTitle}>더치페이 요청</Text>
        </View>
        <View style={styles.splitPaymentCardBody}>
          <Text style={styles.splitPaymentAmount}>
            {data.amount.toLocaleString('ko-KR')}원
          </Text>
          <Text style={styles.splitPaymentDescription}>
            {isMine
              ? `${conversation.friend_name}님에게 정산을 요청했습니다`
              : '정산 요청이 도착했습니다'}
          </Text>
        </View>
        {isCompleted ? (
          <View style={styles.splitPaymentCompletedBadge}>
            <Text style={styles.splitPaymentCompletedText}>정산 완료</Text>
          </View>
        ) : canPay ? (
          <TouchableOpacity
            style={styles.splitPaymentSendButton}
            onPress={() => handleCompleteSplitPayment(message.id, data.paymentId, data.amount)}
            activeOpacity={0.8}
          >
            <Text style={styles.splitPaymentSendButtonText}>
              {virtualBalance >= data.amount ? '보내기' : '잔액 부족'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.splitPaymentPendingBadge}>
            <Text style={styles.splitPaymentPendingText}>대기중</Text>
          </View>
        )}
        {canPay && (
          <Text style={styles.splitPaymentBalance}>
            내 잔액: {virtualBalance.toLocaleString('ko-KR')}원
          </Text>
        )}
      </View>
    );
  };

  const handleViewCourse = (courseId: string, title: string, description: string) => {
    if (onViewCourse) {
      onViewCourse({ id: courseId, title, description });
    }
  };

  const renderCourseShareCard = (data: { courseId: string; title: string; description: string }) => {
    return (
      <View style={styles.courseShareCard}>
        <View style={styles.courseShareCardHeader}>
          <CourseIcon width={20} height={20} color="#1A1A1A" />
          <Text style={styles.courseShareCardTitle}>코스 공유</Text>
        </View>
        <View style={styles.courseShareCardBody}>
          <Text style={styles.courseShareCardName} numberOfLines={2}>
            {data.title}
          </Text>
          <Text style={styles.courseShareCardDesc} numberOfLines={2}>
            {data.description}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.courseShareCardButton}
          onPress={() => handleViewCourse(data.courseId, data.title, data.description)}
          activeOpacity={0.8}
        >
          <Text style={styles.courseShareCardButtonText}>코스 보기</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMessage = (message: ChatMessage, index: number, groupMessages: ChatMessage[]) => {
    const isMine = message.sender_id === currentUserId;
    const showTime = shouldShowTime(message, index, groupMessages);

    // Check if this is first message from this sender in a row
    const prevMessage = index > 0 ? groupMessages[index - 1] : null;
    const isFirstInGroup = !prevMessage || prevMessage.sender_id !== message.sender_id;

    // Check if this is a special message type
    const splitPaymentData = parseSplitPaymentMessage(message.content);
    const courseShareData = parseCourseShareMessage(message.content);

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isMine ? styles.messageContainerMine : styles.messageContainerOther,
          !isFirstInGroup && { marginTop: 2 },
        ]}
      >
        {!isMine && isFirstInGroup && (
          <View style={styles.otherAvatar}>
            <Text style={styles.otherAvatarText}>
              {getInitials(conversation.friend_name)}
            </Text>
          </View>
        )}

        {!isMine && !isFirstInGroup && <View style={styles.avatarPlaceholder} />}

        <View style={[
          styles.messageContentWrapper,
          isMine ? styles.messageContentWrapperMine : styles.messageContentWrapperOther,
        ]}>
          {splitPaymentData ? (
            renderSplitPaymentCard(message, splitPaymentData, isMine)
          ) : courseShareData ? (
            renderCourseShareCard(courseShareData)
          ) : (
            <View style={[
              styles.messageBubble,
              isMine ? styles.messageBubbleMine : styles.messageBubbleOther,
              !isFirstInGroup && !isMine && styles.messageBubbleOtherContinued,
            ]}>
              <Text style={[
                styles.messageText,
                isMine ? styles.messageTextMine : styles.messageTextOther
              ]}>
                {message.content}
              </Text>
            </View>
          )}

          {showTime && (
            <View style={[
              styles.messageTimeContainer,
              isMine ? styles.messageTimeContainerMine : styles.messageTimeContainerOther
            ]}>
              {isMine && !message.is_read && (
                <Text style={styles.unreadCount}>1</Text>
              )}
              <Text style={styles.messageTime}>
                {formatMessageTime(message.created_at)}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderDateHeader = (date: string) => (
    <View style={styles.dateHeaderContainer}>
      <View style={styles.dateHeaderLine} />
      <Text style={styles.dateHeaderText}>{formatDateHeader(date)}</Text>
      <View style={styles.dateHeaderLine} />
    </View>
  );

  const renderTypingIndicator = () => (
    <View style={[styles.messageContainer, styles.messageContainerOther]}>
      <View style={styles.otherAvatar}>
        <Text style={styles.otherAvatarText}>
          {getInitials(conversation.friend_name)}
        </Text>
      </View>
      <View style={[styles.messageBubble, styles.messageBubbleOther, styles.typingBubble]}>
        <View style={styles.typingDots}>
          <View style={[styles.typingDot, styles.typingDot1]} />
          <View style={[styles.typingDot, styles.typingDot2]} />
          <View style={[styles.typingDot, styles.typingDot3]} />
        </View>
      </View>
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateX: slideAnim }] },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <BackIcon width={10} height={18} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {getInitials(conversation.friend_name)}
            </Text>
          </View>
          <Text style={styles.headerName}>{conversation.friend_name}</Text>
        </View>

        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onScroll={({ nativeEvent }) => {
            if (nativeEvent.contentOffset.y < 50 && hasMore && !isLoading) {
              loadMoreMessages();
            }
          }}
          scrollEventThrottle={400}
        >
          {isLoading && page === 1 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#1A1A1A" />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <UserIcon width={28} height={28} color="#CCCCCC" />
              </View>
              <Text style={styles.emptyTitle}>{conversation.friend_name}</Text>
              <Text style={styles.emptySubtitle}>
                첫 메시지를 보내 대화를 시작해보세요
              </Text>
            </View>
          ) : (
            <>
              {hasMore && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={loadMoreMessages}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loadMoreText}>이전 메시지 불러오기</Text>
                </TouchableOpacity>
              )}

              {messageGroups.map((group) => (
                <View key={group.date}>
                  {renderDateHeader(group.date)}
                  {group.messages.map((message, index) =>
                    renderMessage(message, index, group.messages)
                  )}
                </View>
              ))}

              {isTyping && renderTypingIndicator()}
            </>
          )}
        </ScrollView>

        {/* Input */}
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
          {/* Attachment Menu */}
          <Animated.View
            style={[
              styles.attachmentMenu,
              {
                opacity: attachmentMenuAnim,
                transform: [{
                  translateY: attachmentMenuAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                }],
              },
              !showAttachmentMenu && { display: 'none' },
            ]}
          >
            <TouchableOpacity
              style={styles.attachmentOption}
              onPress={handleShareCourse}
              activeOpacity={0.7}
            >
              <View style={styles.attachmentIconWrapper}>
                <CourseIcon width={20} height={20} color="#1A1A1A" />
              </View>
              <Text style={styles.attachmentLabel}>코스 공유</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachmentOption}
              onPress={handleSplitPayment}
              activeOpacity={0.7}
            >
              <View style={styles.attachmentIconWrapper}>
                <ReceiptIcon width={20} height={20} color="#1A1A1A" />
              </View>
              <Text style={styles.attachmentLabel}>더치페이</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.inputWrapper}>
            <TouchableOpacity
              style={styles.attachmentButton}
              onPress={toggleAttachmentMenu}
              activeOpacity={0.7}
            >
              <Animated.View style={{
                transform: [{
                  rotate: attachmentMenuAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '45deg'],
                  }),
                }],
              }}>
                <PlusIcon width={20} height={20} color={showAttachmentMenu ? '#1A1A1A' : '#888888'} />
              </Animated.View>
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="메시지 입력..."
              placeholderTextColor="#999999"
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                inputText.trim().length > 0 && styles.sendButtonActive,
              ]}
              onPress={handleSendMessage}
              disabled={inputText.trim().length === 0 || isSending}
              activeOpacity={0.7}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <SendIcon
                  width={18}
                  height={18}
                  color={inputText.trim().length > 0 ? '#FFFFFF' : '#CCCCCC'}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Split Payment Modal */}
      {showSplitPaymentModal && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowSplitPaymentModal(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>더치페이 요청</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowSplitPaymentModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <CloseIcon width={20} height={20} color="#666666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              {conversation.friend_name}님에게 정산을 요청합니다
            </Text>
            <View style={styles.amountInputContainer}>
              <TextInput
                style={styles.amountInput}
                placeholder="금액 입력"
                placeholderTextColor="#CCCCCC"
                value={splitPaymentAmount}
                onChangeText={formatAmountInput}
                keyboardType="numeric"
                autoFocus
              />
              <Text style={styles.amountUnit}>원</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.splitPaymentButton,
                splitPaymentAmount.length === 0 && styles.splitPaymentButtonDisabled,
              ]}
              onPress={handleSendSplitPayment}
              disabled={splitPaymentAmount.length === 0}
              activeOpacity={0.8}
            >
              <Text style={styles.splitPaymentButtonText}>요청 보내기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Course Share Modal */}
      {showCourseShareModal && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCourseShareModal(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>코스 공유</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowCourseShareModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <CloseIcon width={20} height={20} color="#666666" />
              </TouchableOpacity>
            </View>
            {loadingSavedCourses ? (
              <View style={styles.courseSharePlaceholder}>
                <ActivityIndicator size="small" color="#1A1A1A" />
              </View>
            ) : savedCourses.length === 0 ? (
              <View style={styles.courseSharePlaceholder}>
                <CourseIcon width={40} height={40} color="#CCCCCC" />
                <Text style={styles.courseSharePlaceholderText}>
                  저장된 코스가 없습니다
                </Text>
                <Text style={styles.courseShareHint}>
                  홈 화면에서 코스를 생성하고 저장해보세요
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.courseShareList} showsVerticalScrollIndicator={false}>
                {savedCourses.map((course) => (
                  <TouchableOpacity
                    key={course.id}
                    style={styles.courseShareItem}
                    onPress={() => handleSendCourseShare(course)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.courseShareItemIcon}>
                      <CourseIcon width={20} height={20} color="#1A1A1A" />
                    </View>
                    <View style={styles.courseShareItemContent}>
                      <Text style={styles.courseShareItemTitle} numberOfLines={1}>
                        {course.title}
                      </Text>
                      <Text style={styles.courseShareItemDesc} numberOfLines={1}>
                        {course.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.courseShareCloseButton}
              onPress={() => setShowCourseShareModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.courseShareCloseButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 40,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerAvatarText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#666666',
    textTransform: 'uppercase',
  },
  headerName: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
  },
  headerRight: {
    width: 40,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#888888',
  },
  loadMoreButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  loadMoreText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#888888',
  },
  dateHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  dateHeaderText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#999999',
    paddingHorizontal: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 2,
  },
  messageContainerMine: {
    justifyContent: 'flex-end',
  },
  messageContainerOther: {
    justifyContent: 'flex-start',
  },
  messageContentWrapper: {
    flexDirection: 'column',
    maxWidth: MAX_BUBBLE_WIDTH,
  },
  messageContentWrapperMine: {
    alignItems: 'flex-end',
  },
  messageContentWrapperOther: {
    alignItems: 'flex-start',
  },
  otherAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  otherAvatarText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: '#666666',
    textTransform: 'uppercase',
  },
  avatarPlaceholder: {
    width: 32,
    marginRight: 8,
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  messageBubbleMine: {
    backgroundColor: '#1A1A1A',
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  messageBubbleOtherContinued: {
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    lineHeight: 21,
  },
  messageTextMine: {
    color: '#FFFFFF',
  },
  messageTextOther: {
    color: '#1A1A1A',
  },
  messageTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  messageTimeContainerMine: {
    justifyContent: 'flex-end',
  },
  messageTimeContainerOther: {
    justifyContent: 'flex-start',
  },
  messageTime: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: '#AAAAAA',
  },
  unreadCount: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: '#4AA63C',
  },
  typingBubble: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CCCCCC',
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: '#1A1A1A',
    maxHeight: 100,
    paddingVertical: 8,
    paddingRight: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#1A1A1A',
  },
  attachmentButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  attachmentMenu: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 24,
    marginBottom: 8,
  },
  attachmentOption: {
    alignItems: 'center',
    gap: 6,
  },
  attachmentIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentLabel: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    width: SCREEN_WIDTH - 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#888888',
    marginBottom: 20,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
    paddingVertical: 16,
    textAlign: 'right',
  },
  amountUnit: {
    fontSize: 18,
    fontFamily: FONTS.medium,
    color: '#888888',
    marginLeft: 8,
  },
  splitPaymentButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  splitPaymentButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  splitPaymentButtonText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  courseSharePlaceholder: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  courseSharePlaceholderText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: '#888888',
    marginTop: 16,
  },
  courseShareHint: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#AAAAAA',
    marginTop: 8,
    textAlign: 'center',
  },
  courseShareCloseButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  courseShareCloseButtonText: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: '#666666',
  },
  courseShareList: {
    maxHeight: 250,
    marginBottom: 4,
  },
  courseShareItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  courseShareItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  courseShareItemContent: {
    flex: 1,
  },
  courseShareItemTitle: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  courseShareItemDesc: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#888888',
  },
  courseShareCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: MAX_BUBBLE_WIDTH,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  courseShareCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  courseShareCardTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
  },
  courseShareCardBody: {
    marginBottom: 16,
  },
  courseShareCardName: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  courseShareCardDesc: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#888888',
  },
  courseShareCardButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  courseShareCardButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  splitPaymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: MAX_BUBBLE_WIDTH,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  splitPaymentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  splitPaymentCardTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#1A1A1A',
  },
  splitPaymentCardBody: {
    marginBottom: 16,
  },
  splitPaymentAmount: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  splitPaymentDescription: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: '#888888',
  },
  splitPaymentSendButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  splitPaymentSendButtonText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  splitPaymentCompletedBadge: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  splitPaymentCompletedText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#2E7D32',
  },
  splitPaymentPendingBadge: {
    backgroundColor: '#FFF8E1',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  splitPaymentPendingText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#F57C00',
  },
  splitPaymentBalance: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: '#AAAAAA',
    textAlign: 'center',
    marginTop: 10,
  },
});
