import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { FONTS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserIcon, BellIcon, StarIcon, CourseIcon, CloseIcon } from './svg';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TOAST_DURATION = 5000; // 5 seconds

interface NotificationToastProps {
  notification: {
    id: number;
    type: string;
    title: string;
    message: string;
    data?: any;
  };
  onDismiss: () => void;
  onPress?: () => void;
}

// Notification type icons and colors - dark, sophisticated theme
const getNotificationStyle = (type: string) => {
  switch (type) {
    case 'payment':
      return { iconType: 'payment', bgColor: '#1A1A1A', iconBg: '#2D2D2D' };
    case 'friend_request':
      return { iconType: 'friend', bgColor: '#1A1A1A', iconBg: '#2D2D2D' };
    case 'friend_accepted':
      return { iconType: 'friend', bgColor: '#1A1A1A', iconBg: '#2D2D2D' };
    case 'benefit_tip':
      return { iconType: 'benefit', bgColor: '#1A1A1A', iconBg: '#2D2D2D' };
    case 'course_shared':
      return { iconType: 'course', bgColor: '#1A1A1A', iconBg: '#2D2D2D' };
    default:
      return { iconType: 'default', bgColor: '#1A1A1A', iconBg: '#2D2D2D' };
  }
};

const renderIcon = (iconType: string) => {
  switch (iconType) {
    case 'payment':
      return <Text style={styles.paymentIcon}>W</Text>;
    case 'friend':
      return <UserIcon width={18} height={18} color="#FFFFFF" />;
    case 'benefit':
      return <StarIcon width={18} height={18} color="#FF6600" filled />;
    case 'course':
      return <CourseIcon width={18} height={18} color="#FFFFFF" />;
    default:
      return <BellIcon width={18} height={18} color="#FFFFFF" />;
  }
};

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
  onPress,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-200)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { iconType, bgColor, iconBg } = getNotificationStyle(notification.type);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Allow horizontal swipe
        if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
          translateX.setValue(gestureState.dx);
        }
        // Allow upward swipe to dismiss
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Swipe left or right to dismiss
        if (Math.abs(gestureState.dx) > 80 || Math.abs(gestureState.vx) > 0.5) {
          const direction = gestureState.dx > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH;
          Animated.timing(translateX, {
            toValue: direction,
            duration: 200,
            useNativeDriver: true,
          }).start(onDismiss);
        }
        // Swipe up to dismiss
        else if (gestureState.dy < -50 || gestureState.vy < -0.5) {
          Animated.timing(translateY, {
            toValue: -200,
            duration: 200,
            useNativeDriver: true,
          }).start(onDismiss);
        }
        // Reset position
        else {
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss after duration
    timerRef.current = setTimeout(() => {
      dismissToast();
    }, TOAST_DURATION);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const dismissToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(onDismiss);
  };

  const handlePress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (onPress) {
      onPress();
    }
    dismissToast();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 8,
          transform: [{ translateY }, { translateX }],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={[styles.toast, { backgroundColor: bgColor }]}
        onPress={handlePress}
        activeOpacity={0.95}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
          {renderIcon(iconType)}
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.message} numberOfLines={1}>
            {notification.message}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={dismissToast}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <CloseIcon width={10} height={10} color="rgba(255, 255, 255, 0.6)" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentIcon: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: '#4AA63C',
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  closeButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
