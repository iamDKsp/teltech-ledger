import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Circle, CheckCircle2 } from 'lucide-react-native';

interface TaskRowProps {
  task: {
    id: string;
    title: string;
    priority: 'low' | 'medium' | 'high';
    dueDate: string;
    projectName: string;
    projectColor: string;
    subtaskProgress?: string; // e.g. '2/4'
    isCompleted?: boolean;
    isOverdue?: boolean;
  };
  onPress?: () => void;
  onToggleComplete?: () => void;
}

const priorityColors = {
  low: '#4080d6',    // Secondary blue
  medium: '#f59e0b', // Amber
  high: '#d44040',   // Destructive red
};

export function TaskRow({ task, onPress, onToggleComplete }: TaskRowProps) {
  return (
    <TouchableOpacity 
      activeOpacity={0.7}
      onPress={onPress}
      className="bg-[#2b2b2e] rounded-xl p-4 border border-[#313136] mb-3 flex-row items-center"
    >
      <TouchableOpacity 
        onPress={onToggleComplete}
        className="mr-3"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {task.isCompleted ? (
          <CheckCircle2 size={24} color="#27a06b" />
        ) : (
          <Circle size={24} color="#36363c" />
        )}
      </TouchableOpacity>
      
      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <View 
            className="w-2 h-2 rounded-full mr-2" 
            style={{ backgroundColor: priorityColors[task.priority] }} 
          />
          <Text 
            className={`text-base font-semibold ${task.isCompleted ? 'text-[#a1a1aa] line-through' : 'text-[#fafafa]'}`}
            numberOfLines={1}
          >
            {task.title}
          </Text>
        </View>
        
        <View className="flex-row items-center">
          <View 
            className="px-2 py-0.5 rounded mr-2" 
            style={{ backgroundColor: `${task.projectColor}20` }}
          >
            <Text className="text-[10px] font-medium" style={{ color: task.projectColor }}>
              {task.projectName}
            </Text>
          </View>
          
          <Text className={`text-xs ${task.isOverdue && !task.isCompleted ? 'text-[#d44040] font-bold' : 'text-[#a1a1aa]'}`}>
            {task.dueDate}
          </Text>

          {task.subtaskProgress && (
            <>
              <Text className="text-[#a1a1aa] text-xs mx-2">•</Text>
              <Text className="text-[#a1a1aa] text-xs">{task.subtaskProgress}</Text>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
