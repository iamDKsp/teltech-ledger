import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { MessageSquare, Paperclip, Clock } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

type Props = {
  id: string;
  title: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  tags: { label: string; color: string }[];
  assignees: { name: string; avatarUrl?: string }[];
  dueDate?: string;
  commentCount: number;
  attachmentCount: number;
  subtaskProgress?: { done: number; total: number };
  onPress: () => void;
  onLongPress: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRIORITY_COLORS = {
  low: '#4080d6',    // Secondary blue
  normal: '#a1a1aa', // Muted foreground
  high: '#f59e0b',   // Warning orange
  urgent: '#d44040', // Destructive red
};

export function KanbanCard({
  id,
  title,
  priority,
  tags,
  assignees,
  dueDate,
  commentCount,
  attachmentCount,
  subtaskProgress,
  onPress,
  onLongPress,
}: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      className="bg-[#2b2b2e] rounded-xl border border-[#313136] p-4 mb-3"
      style={animatedStyle}
    >
      {/* Tags */}
      {tags.length > 0 && (
        <View className="flex-row flex-wrap mb-2 gap-2">
          {tags.map((tag, index) => (
            <View
              key={index}
              className="px-2 py-0.5 rounded-md"
              style={{ backgroundColor: `${tag.color}20` }}
            >
              <Text style={{ color: tag.color }} className="text-[10px] font-medium">
                {tag.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Title */}
      <Text className="text-[#fafafa] font-medium text-sm leading-5 mb-3">
        {title}
      </Text>

      {/* Subtask Progress */}
      {subtaskProgress && subtaskProgress.total > 0 && (
        <View className="mb-3">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-[#a1a1aa] text-[10px]">Progresso</Text>
            <Text className="text-[#a1a1aa] text-[10px]">{subtaskProgress.done}/{subtaskProgress.total}</Text>
          </View>
          <View className="h-1 bg-[#111113] rounded-full overflow-hidden">
            <View 
              className="h-full bg-[#27a06b] rounded-full" 
              style={{ width: `${(subtaskProgress.done / subtaskProgress.total) * 100}%` }} 
            />
          </View>
        </View>
      )}

      {/* Footer Info */}
      <View className="flex-row justify-between items-end mt-2">
        <View className="flex-row items-center gap-3">
          {commentCount > 0 && (
            <View className="flex-row items-center gap-1">
              <MessageSquare size={12} color="#a1a1aa" />
              <Text className="text-[#a1a1aa] text-xs">{commentCount}</Text>
            </View>
          )}
          {attachmentCount > 0 && (
            <View className="flex-row items-center gap-1">
              <Paperclip size={12} color="#a1a1aa" />
              <Text className="text-[#a1a1aa] text-xs">{attachmentCount}</Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center gap-2">
          {dueDate && (
            <View className="flex-row items-center gap-1">
              <Clock size={12} color="#a1a1aa" />
              <Text className="text-[#a1a1aa] text-xs">{dueDate}</Text>
            </View>
          )}
          <View 
            className="w-2 h-2 rounded-full ml-1" 
            style={{ backgroundColor: PRIORITY_COLORS[priority] }} 
          />
        </View>
      </View>

      {/* Assignees */}
      {assignees.length > 0 && (
        <View className="flex-row items-center mt-3 pt-3 border-t border-[#313136]">
          {assignees.slice(0, 3).map((assignee, index) => (
            <View 
              key={index} 
              className={`w-6 h-6 rounded-full border border-[#2b2b2e] bg-[#36363c] items-center justify-center ${index > 0 ? '-ml-2' : ''}`}
              style={{ zIndex: 10 - index }}
            >
              {assignee.avatarUrl ? (
                <Image source={{ uri: assignee.avatarUrl }} className="w-full h-full rounded-full" />
              ) : (
                <Text className="text-[10px] text-white font-bold">
                  {assignee.name.charAt(0)}
                </Text>
              )}
            </View>
          ))}
          {assignees.length > 3 && (
            <View className="w-6 h-6 rounded-full border border-[#2b2b2e] bg-[#111113] items-center justify-center -ml-2 z-0">
              <Text className="text-[10px] text-[#a1a1aa]">+{assignees.length - 3}</Text>
            </View>
          )}
        </View>
      )}
    </AnimatedPressable>
  );
}
