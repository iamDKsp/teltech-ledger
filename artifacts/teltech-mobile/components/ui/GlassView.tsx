import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';

export interface GlassViewProps {
  children: React.ReactNode;
  intensity?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function GlassView({ children, intensity = 40, className = '', style }: GlassViewProps) {
  return (
    <BlurView
      tint="dark"
      intensity={intensity}
      className={`rounded-xl overflow-hidden border border-white/10 ${className}`}
      style={style}
    >
      {children}
    </BlurView>
  );
}
