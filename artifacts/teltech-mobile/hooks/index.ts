export const useAuth = () => {
  return {
    isAuthenticated: true,
    isLoading: false,
    login: async () => {},
    logout: async () => {},
    user: { name: 'Usuário', initials: 'US' }
  };
};

export const useDashboard = () => {
  return {
    data: {
      stats: {
        tarefasDia: 5,
        atrasadas: 2,
        concluidas: 12,
        projetosAtivos: 3
      },
      tarefasHoje: [
        { id: '1', title: 'Revisar API', priority: 'high', dueDate: 'Hoje', projectName: 'Ledger Mobile', projectColor: '#7C5AC2' }
      ]
    },
    isLoading: false
  };
};

export const useProjects = () => {
  return {
    data: [
      { id: '1', name: 'Teltech Ledger', color: '#7C5AC2', status: 'active', isFavorite: true, taskCount: 45, completedCount: 30, members: ['TA', 'LU'] }
    ],
    isLoading: false
  };
};

export const useMyTasks = () => {
  return {
    data: [
      { id: '1', title: 'Implementar Auth', priority: 'high', dueDate: 'Atrasada', projectName: 'Ledger Mobile', projectColor: '#7C5AC2', isOverdue: true }
    ],
    isLoading: false
  };
};

export const useFinanceDashboard = () => {
  return {
    data: {
      mrr: 'R$ 45.000',
      saldo: 'R$ 120.500',
      burn: 'R$ 30.000',
      transacoes: []
    },
    isLoading: false
  };
};

export const useProjectBoard = (id: string) => {
  return {
    data: { columns: [] },
    isLoading: false
  };
};

export const useProjectStats = (id: string) => {
  return {
    data: { total: 10, completed: 5, inProgress: 3, overdue: 2 },
    isLoading: false
  };
};
