import React from 'react';
import { Text, Pressable, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { haptics } from '../../lib/haptics';
import { colors } from '../../lib/theme';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'success' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onPress,
  children,
  leftIcon,
  rightIcon,
  className = '',
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.95, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  const handlePress = () => {
    if (disabled || loading) return;
    haptics.lightTap();
    onPress?.();
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary': return 'bg-[#7C5AC2]';
      case 'secondary': return 'bg-[#2b2b2e] border border-[#313136]';
      case 'success': return 'bg-[#27a06b]';
      case 'destructive': return 'bg-[#d44040]';
      case 'ghost': return 'bg-transparent';
      default: return 'bg-[#7C5AC2]';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return 'py-2 px-3 rounded-lg';
      case 'lg': return 'py-4 px-6 rounded-xl';
      case 'md':
      default: return 'py-3 px-5 rounded-xl';
    }
  };

  const getTextClasses = () => {
    switch (size) {
      case 'sm': return 'text-sm';
      case 'lg': return 'text-lg';
      case 'md':
      default: return 'text-base';
    }
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        className={`flex-row items-center justify-center ${getVariantClasses()} ${getSizeClasses()} ${disabled ? 'opacity-50' : 'opacity-100'} ${className}`}
      >
        {loading ? (
          <ActivityIndicator color={colors.foreground} size="small" />
        ) : (
          <>
            {leftIcon}
            <Text className={`text-[#fafafa] font-semibold text-center ${leftIcon ? 'ml-2' : ''} ${rightIcon ? 'mr-2' : ''} ${getTextClasses()}`}>
              {children}
            </Text>
            {rightIcon}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
