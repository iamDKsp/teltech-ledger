import React from 'react';
import { View, Pressable } from 'react-native';
import { GlassView } from './GlassView';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass';
  onPress?: () => void;
}

export function Card({ children, className = '', variant = 'default', onPress }: CardProps) {
  const content = variant === 'glass' ? (
    <GlassView className={`p-4 ${className}`}>
      {children}
    </GlassView>
  ) : (
    <View className={`bg-[#2b2b2e] rounded-xl border border-[#313136] p-4 ${className}`}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className="active:opacity-80">
        {content}
      </Pressable>
    );
  }

  return content;
}
