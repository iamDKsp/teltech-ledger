import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';

// Queries
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => customFetch('/api/projects'),
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => customFetch('/api/dashboard'),
  });
}

export function useMyTasks() {
  return useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => customFetch('/api/tasks/my-tasks'),
  });
}

export function useProjectBoard(projectId: string) {
  return useQuery({
    queryKey: ['project-board', projectId],
    queryFn: () => customFetch(`/api/projects/${projectId}/board`),
  });
}

export function useProjectStats(projectId: string) {
  return useQuery({
    queryKey: ['project-stats', projectId],
    queryFn: () => customFetch(`/api/projects/${projectId}/stats`),
  });
}

export function useTaskDetail(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['task', projectId, taskId],
    queryFn: () => customFetch(`/api/projects/${projectId}/tasks/${taskId}`),
  });
}

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: () => customFetch('/api/members'),
  });
}

export function useFinanceDashboard(month?: number, year?: number) {
  return useQuery({
    queryKey: ['finance-dashboard', month, year],
    queryFn: () => {
      const params = new URLSearchParams();
      if (month !== undefined) params.append('month', month.toString());
      if (year !== undefined) params.append('year', year.toString());
      const queryString = params.toString();
      return customFetch(`/api/finance/dashboard${queryString ? \`?\${queryString}\` : ''}`);
    },
  });
}

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: () => customFetch('/api/goals'),
  });
}

export function useMeetings() {
  return useQuery({
    queryKey: ['meetings'],
    queryFn: () => customFetch('/api/meetings'),
  });
}

export function useWorkspaceStats() {
  return useQuery({
    queryKey: ['workspace-stats'],
    queryFn: () => customFetch('/api/workspace/stats'),
  });
}

// Mutations
export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: any) => 
      customFetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-board', projectId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });
}

export function useMoveTask(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { columnId: string; order: number }) => 
      customFetch(`/api/projects/${projectId}/tasks/${taskId}/move`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-board', projectId] });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: any) => 
      customFetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] });
    },
  });
}

export function useToggleSubtask(taskId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ subtaskId, completed }: { subtaskId: string; completed: boolean }) => 
      customFetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task'] });
    },
  });
}

export function useStartTimer(taskId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => 
      customFetch(`/api/tasks/${taskId}/timer/start`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });
}

export function useStopTimer(taskId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => 
      customFetch(`/api/tasks/${taskId}/timer/stop`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });
}
