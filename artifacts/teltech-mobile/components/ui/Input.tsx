import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { colors } from '../../lib/theme';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  className = '',
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  let borderColorClass = 'border-[#313136]';
  if (error) borderColorClass = 'border-[#d44040]';
  else if (isFocused) borderColorClass = 'border-[#7C5AC2]';

  return (
    <View className={`mb-4 ${className}`}>
      {label && (
        <Text className="text-sm text-[#a1a1aa] mb-1 font-medium">{label}</Text>
      )}
      <View className={`flex-row items-center bg-[#232326] rounded-lg border px-4 h-12 ${borderColorClass}`}>
        {leftIcon && <View className="mr-2">{leftIcon}</View>}
        <TextInput
          className="flex-1 text-[#fafafa] text-base h-full"
          placeholderTextColor={colors.mutedForeground}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {rightIcon && <View className="ml-2">{rightIcon}</View>}
      </View>
      {error && (
        <Text className="text-sm text-[#d44040] mt-1">{error}</Text>
      )}
    </View>
  );
}
