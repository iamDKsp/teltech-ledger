import React from 'react';
import { View, Text, Image } from 'react-native';
import { colors } from '../../lib/theme';

export interface AvatarProps {
  uri?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const avatarColors = [
  colors.primary,
  colors.success,
  colors.secondary,
  colors.destructive,
  '#f59e0b', // amber
  '#ec4899', // pink
];

export function Avatar({ uri, name = 'User', size = 'md', className = '' }: AvatarProps) {
  const dimensions = sizeMap[size];
  
  const getInitials = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % avatarColors.length;
    return avatarColors[index];
  };

  const textClass = () => {
    switch (size) {
      case 'sm': return 'text-xs';
      case 'lg': return 'text-xl';
      case 'xl': return 'text-3xl';
      case 'md':
      default: return 'text-base';
    }
  };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: dimensions, height: dimensions, borderRadius: dimensions / 2 }}
        className={`bg-[#2b2b2e] ${className}`}
      />
    );
  }

  return (
    <View
      style={{
        width: dimensions,
        height: dimensions,
        borderRadius: dimensions / 2,
        backgroundColor: getColor(name),
      }}
      className={`items-center justify-center ${className}`}
    >
      <Text className={`text-[#fafafa] font-bold ${textClass()}`}>
        {getInitials(name)}
      </Text>
    </View>
  );
}
