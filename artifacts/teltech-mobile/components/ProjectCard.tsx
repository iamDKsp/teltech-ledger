import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LucideIcon, FolderKanban } from 'lucide-react-native';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    color: string;
    icon?: LucideIcon;
    status: 'active' | 'completed' | 'on_hold';
    isFavorite: boolean;
    taskCount: number;
    completedCount: number;
    members: string[]; // array of initials
  };
  onPress?: () => void;
}

const statusMap = {
  active: { label: 'Ativo', color: '#7C5AC2', bg: '#7C5AC220' },
  completed: { label: 'Concluído', color: '#27a06b', bg: '#27a06b20' },
  on_hold: { label: 'Pausado', color: '#d44040', bg: '#d4404020' },
};

export function ProjectCard({ project, onPress }: ProjectCardProps) {
  const Icon = project.icon || FolderKanban;
  const progress = project.taskCount > 0 ? (project.completedCount / project.taskCount) * 100 : 0;
  const statusInfo = statusMap[project.status];

  return (
    <TouchableOpacity 
      activeOpacity={0.8}
      onPress={onPress}
      className="bg-[#2b2b2e] rounded-2xl border border-[#313136] overflow-hidden mb-4 flex-row"
    >
      <View className="w-1.5 h-full absolute left-0 top-0 bottom-0 z-10" style={{ backgroundColor: project.color }} />
      <View className="p-4 pl-5 flex-1">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-row items-center flex-1">
            <View 
              className="w-10 h-10 rounded-full items-center justify-center mr-3" 
              style={{ backgroundColor: `${project.color}20` }}
            >
              <Icon size={20} color={project.color} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-[#fafafa]" numberOfLines={1}>{project.name}</Text>
            </View>
          </View>
          <View className="rounded-full px-2 py-1" style={{ backgroundColor: statusInfo.bg }}>
            <Text className="text-xs font-medium" style={{ color: statusInfo.color }}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        <View className="mb-4">
          <View className="flex-row justify-between mb-1.5">
            <Text className="text-[#a1a1aa] text-xs font-medium">Progresso</Text>
            <Text className="text-[#a1a1aa] text-xs font-medium">{project.completedCount}/{project.taskCount} ({Math.round(progress)}%)</Text>
          </View>
          <View className="h-1.5 bg-[#232326] rounded-full overflow-hidden">
            <View className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: project.color }} />
          </View>
        </View>

        <View className="flex-row justify-between items-center">
          <View className="flex-row">
            {project.members.slice(0, 4).map((initials, index) => (
              <View 
                key={index}
                className="w-7 h-7 rounded-full bg-[#36363c] border-2 border-[#2b2b2e] items-center justify-center"
                style={{ marginLeft: index > 0 ? -10 : 0 }}
              >
                <Text className="text-[10px] font-bold text-[#fafafa]">{initials}</Text>
              </View>
            ))}
            {project.members.length > 4 && (
              <View 
                className="w-7 h-7 rounded-full bg-[#36363c] border-2 border-[#2b2b2e] items-center justify-center"
                style={{ marginLeft: -10 }}
              >
                <Text className="text-[10px] font-bold text-[#fafafa]">+{project.members.length - 4}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
