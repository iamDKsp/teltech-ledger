import React from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useProjects } from '../../hooks';
import { ProjectCard } from '../../components/ProjectCard';
import { Plus } from 'lucide-react-native';

export default function ProjectsScreen() {
  const router = useRouter();
  const { data: projects, isLoading } = useProjects();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleCreateProject = () => {
    Alert.alert('Novo Projeto', 'Funcionalidade em desenvolvimento.');
  };

  const favorites = projects.filter(p => p.isFavorite);
  const allProjects = projects;

  return (
    <View className="flex-1 bg-[#111113]">
      <ScrollView 
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C5AC2" />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {favorites.length > 0 && (
          <View className="mb-6">
            <Text className="text-[#fafafa] text-xl font-bold mb-4">⭐ Favoritos</Text>
            {favorites.map(project => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                onPress={() => router.push(`/project/${project.id}/board`)}
              />
            ))}
          </View>
        )}

        <View>
          <Text className="text-[#fafafa] text-xl font-bold mb-4">📂 Todos os Projetos</Text>
          {allProjects.map(project => (
            <ProjectCard 
              key={project.id} 
              project={project} 
              onPress={() => router.push(`/project/${project.id}/board`)}
            />
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity 
        className="absolute bottom-6 right-6 w-14 h-14 bg-[#7C5AC2] rounded-full items-center justify-center shadow-lg shadow-[#7C5AC2]/30"
        onPress={handleCreateProject}
        activeOpacity={0.8}
      >
        <Plus color="#fafafa" size={24} />
      </TouchableOpacity>
    </View>
  );
}
