import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronUp, Target } from 'lucide-react-native';

interface GoalCardProps {
  title: string;
  progress: number;
  status: string;
  owner?: string;
  isObjective?: boolean;
  unit?: string;
  current?: number;
  target?: number;
  children?: React.ReactNode;
}

export function GoalCard({ 
  title, 
  progress, 
  status, 
  owner, 
  isObjective = true, 
  unit = '%', 
  current, 
  target,
  children
}: GoalCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const getProgressColor = (p: number) => {
    if (p < 34) return 'bg-[#d44040]';
    if (p < 67) return 'bg-[#eab308]';
    return 'bg-[#27a06b]';
  };
  
  const progressColor = getProgressColor(progress);

  if (!isObjective) {
    return (
      <View className="py-3 px-4 border-l-2 border-[#313136] ml-4 bg-[#232326]/50">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-[#fafafa] text-sm flex-1 mr-2" numberOfLines={2}>{title}</Text>
          <Text className="text-[#a1a1aa] text-xs font-semibold">
            {current !== undefined && target !== undefined ? `${current} / ${target} ${unit}` : `${progress}%`}
          </Text>
        </View>
        <View className="w-full h-2 bg-[#313136] rounded-full overflow-hidden">
          <View className={`h-full ${progressColor} rounded-full`} style={{ width: `${progress}%` }} />
        </View>
      </View>
    );
  }

  return (
    <View className="mb-4 bg-[#2b2b2e] rounded-xl border border-[#313136] overflow-hidden">
      <TouchableOpacity 
        className="p-4" 
        onPress={() => children && setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-row flex-1 mr-2">
            <View className="w-8 h-8 rounded-full bg-[#7C5AC2]/20 items-center justify-center mr-3 mt-1">
              <Target size={16} color="#7C5AC2" />
            </View>
            <View className="flex-1">
              <Text className="text-[#fafafa] text-lg font-bold mb-1">{title}</Text>
              {owner && <Text className="text-[#a1a1aa] text-sm">Resp: {owner}</Text>}
            </View>
          </View>
          <View className="bg-[#313136] px-2 py-1 rounded">
            <Text className="text-[#a1a1aa] text-xs font-bold uppercase">{status}</Text>
          </View>
        </View>
        
        <View className="flex-row items-center">
          <View className="flex-1 mr-4">
            <View className="w-full h-3 bg-[#111113] rounded-full overflow-hidden border border-[#313136]">
              <View className={`h-full ${progressColor} rounded-full`} style={{ width: `${progress}%` }} />
            </View>
          </View>
          <Text className="text-[#fafafa] font-bold w-10 text-right">{progress}%</Text>
          {children && (
            <View className="ml-2">
              {expanded ? <ChevronUp size={20} color="#a1a1aa" /> : <ChevronDown size={20} color="#a1a1aa" />}
            </View>
          )}
        </View>
      </TouchableOpacity>
      
      {expanded && children && (
        <View className="border-t border-[#313136] bg-[#2b2b2e]">
          {children}
        </View>
      )}
    </View>
  );
}
