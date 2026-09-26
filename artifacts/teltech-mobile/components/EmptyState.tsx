import React from 'react';
import { View, Text } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <View className="w-20 h-20 rounded-full bg-[#232326] items-center justify-center mb-4">
        <Icon size={32} color="#a1a1aa" />
      </View>
      <Text className="text-xl font-bold text-[#fafafa] text-center mb-2">{title}</Text>
      <Text className="text-[#a1a1aa] text-center text-base">{description}</Text>
    </View>
  );
}
