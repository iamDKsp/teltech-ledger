import React from 'react';
import { View, Text } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatCard({ title, value, icon: Icon, iconColor, trend }: StatCardProps) {
  return (
    <View className="bg-[#2b2b2e] rounded-2xl p-4 border border-[#313136] flex-1">
      <View className="flex-row justify-between items-start mb-3">
        <View 
          className="w-10 h-10 rounded-full items-center justify-center" 
          style={{ backgroundColor: `${iconColor}20` }}
        >
          <Icon size={20} color={iconColor} />
        </View>
        {trend && (
          <View className={`flex-row items-center rounded-full px-2 py-1 ${trend.isPositive ? 'bg-[#27a06b]20' : 'bg-[#d44040]20'}`}>
            <Text className={`text-xs font-medium ${trend.isPositive ? 'text-[#27a06b]' : 'text-[#d44040]'}`}>
              {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
            </Text>
          </View>
        )}
      </View>
      <View>
        <Text className="text-3xl font-bold text-[#fafafa] mb-1">{value}</Text>
        <Text className="text-[#a1a1aa] text-sm font-medium">{title}</Text>
      </View>
    </View>
  );
}
