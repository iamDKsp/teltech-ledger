import React from 'react';
import { View, Text } from 'react-native';

export interface BadgeProps {
  label: string;
  color?: string;
  size?: 'sm' | 'md';
  variant?: 'solid' | 'outline';
  className?: string;
}

export function Badge({
  label,
  color = '#7C5AC2',
  size = 'md',
  variant = 'solid',
  className = ''
}: BadgeProps) {
  const hexToRgba = (hex: string, alpha: number) => {
    // If color is not hex, just use a fallback transparent bg, though assuming it is hex.
    if (!hex.startsWith('#')) return 'transparent';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const bgStyle = variant === 'solid' ? { backgroundColor: hexToRgba(color, 0.2) } : { backgroundColor: 'transparent' };
  const borderStyle = variant === 'outline' ? { borderColor: color, borderWidth: 1 } : {};
  const px = size === 'sm' ? 'px-2' : 'px-2.5';
  const py = size === 'sm' ? 'py-0.5' : 'py-1';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <View style={[bgStyle, borderStyle]} className={`rounded-full ${px} ${py} self-start ${className}`}>
      <Text style={{ color }} className={`font-medium ${textSize}`}>
        {label}
      </Text>
    </View>
  );
}
