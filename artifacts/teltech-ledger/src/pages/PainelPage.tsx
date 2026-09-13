import React, { useState, useEffect } from 'react';
import { Activity, CheckSquare, Clock, AlertTriangle, Users, Briefcase } from 'lucide-react';
import { API } from '../lib/api';

interface Stats {
  tasksOverview: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
  };
  tasksByMember: Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
    assignedTasks: number;
    completedTasks: number;
    completionRate: number;
  }>;
  projectsSummary: Array<{
    id: string;
    name: string;
    color: string;
    progress: number;
    taskCount: number;
  }>;
  weeklyTrend: Array<{
    label: string;
    completions: number;
  }>;
}

export const PainelPage: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await API.get('/api/workspace/stats');
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#a1a1aa' }}>Carregando painel...</div>;
  }

  const { tasksOverview, tasksByMember, projectsSummary, weeklyTrend } = stats;

  const maxCompletions = Math.max(...weeklyTrend.map(d => d.completions), 10);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: '#fafafa', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 600, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Activity style={{ color: '#7C5AC2' }} size={28} />
          Painel Global
        </h1>
        <p style={{ margin: 0, color: '#a1a1aa' }}>Visão geral da produtividade e saúde dos projetos.</p>
      </div>

      {/* Top Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {[
          { label: 'Total Tarefas', value: tasksOverview.total, icon: <Briefcase size={24} color="#a1a1aa" />, color: '#242424' },
          { label: 'Concluídas', value: tasksOverview.completed, icon: <CheckSquare size={24} color="#10B981" />, color: 'rgba(16, 185, 129, 0.1)' },
          { label: 'Em Andamento', value: tasksOverview.inProgress, icon: <Clock size={24} color="#7C5AC2" />, color: 'rgba(124, 90, 194, 0.1)' },
          { label: 'Atrasadas', value: tasksOverview.overdue, icon: <AlertTriangle size={24} color="#ef4444" />, color: 'rgba(239, 68, 68, 0.1)' },
        ].map((stat, i) => (
          <div key={i} style={{ backgroundColor: '#1a1a1a', padding: '24px', borderRadius: '12px', border: '1px solid #242424', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ color: '#a1a1aa', fontSize: '14px', marginBottom: '4px' }}>{stat.label}</div>
              <div style={{ fontSize: '28px', fontWeight: 600 }}>{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Team Performance */}
          <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', border: '1px solid #242424', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} color="#7C5AC2" /> Desempenho da Equipe
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {tasksByMember.map(member => (
                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#313136', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {member.avatarUrl ? <img src={member.avatarUrl} alt={member.name} style={{ width: '100%', height: '100%' }} /> : member.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 500, fontSize: '14px' }}>{member.name}</span>
                      <span style={{ fontSize: '13px', color: '#a1a1aa' }}>{member.completedTasks} / {member.assignedTasks} tarefas</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: '#313136', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', backgroundColor: '#7C5AC2', width: `${member.completionRate}%` }} />
                    </div>
                  </div>
                  <div style={{ width: '48px', textAlign: 'right', fontWeight: 600, fontSize: '14px' }}>
                    {member.completionRate}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Chart */}
          <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', border: '1px solid #242424', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 24px 0' }}>Tarefas Concluídas (Últimos 7 dias)</h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '200px', paddingTop: '20px' }}>
              {weeklyTrend.map((day, i) => {
                const heightPct = (day.completions / maxCompletions) * 100;
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <div style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 500 }}>{day.completions}</div>
                    <div style={{ width: '32px', height: '150px', display: 'flex', alignItems: 'flex-end', backgroundColor: '#242424', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: `${heightPct}%`, backgroundColor: '#10B981', transition: 'height 1s ease-out' }} />
                    </div>
                    <div style={{ fontSize: '12px', color: '#a1a1aa' }}>{day.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column: Projects Health */}
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', border: '1px solid #242424', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 20px 0' }}>Saúde dos Projetos</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {projectsSummary.map(proj => (
              <div key={proj.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: proj.color }} />
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{proj.name}</span>
                  </div>
                  <span style={{ fontSize: '13px', color: '#a1a1aa' }}>{proj.taskCount} tarefas</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, height: '6px', backgroundColor: '#313136', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', backgroundColor: proj.progress > 70 ? '#10B981' : proj.progress < 30 ? '#ef4444' : '#7C5AC2', width: `${proj.progress}%` }} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 500, width: '36px', textAlign: 'right' }}>{proj.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
